const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const WORLD_ID = process.env.BLOXD_WORLD_ID || 'HT_Y95VcEQaUBLbTc24H7';
const LOBBY = process.env.BLOXD_LOBBY || '1';
const USER_DATA_DIR = process.env.USER_DATA_DIR || '/data/chrome-profile';
const HEADLESS = String(process.env.HEADLESS || 'false').toLowerCase() === 'true';
const CHROME_CHANNEL = process.env.CHROME_CHANNEL || 'chromium';
const VERIFY_TIMEOUT_MS = Number(process.env.VERIFY_TIMEOUT_MS || 45000);
const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 5000);
const MARKER = '__SG_EVT__';

const inviteUrl = `https://bloxd.io/play/classic_playerSchematic%7C${WORLD_ID}?lobby=${encodeURIComponent(LOBBY)}`;

const state = {
  status: 'BOOTING',
  since: new Date().toISOString(),
  browserStarted: false,
  pageUrl: null,
  discoverySeen: false,
  joinSeen: false,
  websocketSeen: false,
  websocketFrames: 0,
  markerCount: 0,
  lastMarkerAt: null,
  lastError: null,
  verificationReason: null,
  generation: 0
};

function setStatus(status, extra = {}) {
  if (state.status !== status) {
    state.status = status;
    state.since = new Date().toISOString();
  }
  Object.assign(state, extra);
  console.log('[relay-state]', JSON.stringify({ status: state.status, since: state.since, ...extra }));
}

function safeError(err) {
  return String(err && err.message || err || 'unknown error')
    .replace(/[A-Za-z0-9_-]{80,}/g, '[LONG_VALUE]')
    .slice(0, 500);
}

function sanitizeMarker(text) {
  const at = text.indexOf(MARKER);
  if (at === -1) return null;
  const marker = text.slice(at).split(/\r?\n/)[0].trim();
  return marker.length <= 3000 ? marker : marker.slice(0, 3000);
}

async function installMarkerObserver(page) {
  await page.exposeFunction('__relayMarker', raw => {
    if (typeof raw !== 'string') return;
    const marker = sanitizeMarker(raw);
    if (!marker) return;
    state.markerCount += 1;
    state.lastMarkerAt = new Date().toISOString();
    // Machine-generated live-sync marker only. No arbitrary chat is logged.
    console.log('[sg-marker]', marker);
  }).catch(() => {});

  await page.evaluate(marker => {
    if (window.__sgRelayObserverInstalled) return;
    window.__sgRelayObserverInstalled = true;
    const seen = new Set();
    const scan = node => {
      const text = node && typeof node.textContent === 'string' ? node.textContent : '';
      if (!text || !text.includes(marker)) return;
      const lines = text.split(/\r?\n/).filter(line => line.includes(marker));
      for (const line of lines) {
        const key = line.trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        if (seen.size > 1000) seen.delete(seen.values().next().value);
        window.__relayMarker(key).catch(() => {});
      }
    };
    scan(document.body);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) scan(node);
      }
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true, characterData: true });
    window.__sgRelayObserver = observer;
  }, MARKER).catch(() => {});
}

async function watchOneGeneration(context) {
  state.generation += 1;
  const generation = state.generation;
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  state.discoverySeen = false;
  state.joinSeen = false;
  state.websocketSeen = false;
  state.websocketFrames = 0;
  state.verificationReason = null;
  setStatus('CONNECTING', { generation, lastError: null });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/social/bloxd-matchmake')) state.discoverySeen = true;
    if (url.includes('/matchmake/joinOrCreate/')) state.joinSeen = true;
  });

  page.on('websocket', ws => {
    state.websocketSeen = true;
    ws.on('framereceived', () => { state.websocketFrames += 1; });
  });

  page.on('console', msg => {
    const text = msg.text();
    if (/Traffic checks failed|Error getting traffic code|Obtained traffic code is nullish/i.test(text)) {
      setStatus('NEEDS_VERIFICATION', { verificationReason: 'Bloxd traffic verification failed.' });
    }
  });

  page.on('pageerror', err => {
    state.lastError = safeError(err);
  });

  await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  state.pageUrl = page.url();
  await installMarkerObserver(page);

  const started = Date.now();
  let trafficCheckObserved = false;
  while (Date.now() - started < VERIFY_TIMEOUT_MS) {
    await page.waitForTimeout(1000);
    state.pageUrl = page.url();

    if (state.joinSeen && state.websocketSeen) {
      setStatus('ONLINE', { verificationReason: null });
      break;
    }

    const bodyTail = await page.locator('body').innerText().then(t => t.slice(-2500)).catch(() => '');
    if (/traffic checks failed|please use chrome|verification/i.test(bodyTail)) {
      setStatus('NEEDS_VERIFICATION', { verificationReason: 'Bloxd requests browser verification.' });
      break;
    }
    if (/registering materials|finding lobby|joining lobby/i.test(bodyTail)) trafficCheckObserved = true;
  }

  if (state.status === 'CONNECTING') {
    setStatus('NEEDS_VERIFICATION', {
      verificationReason: trafficCheckObserved
        ? 'Bloxd did not complete its traffic check before the timeout.'
        : 'Bloxd did not reach the game-server join before the timeout.'
    });
  }

  while (!page.isClosed()) {
    await installMarkerObserver(page);
    if (state.status === 'NEEDS_VERIFICATION' && state.joinSeen && state.websocketSeen) {
      setStatus('ONLINE', { verificationReason: null });
    }
    if (state.status === 'ONLINE' && !state.websocketSeen) {
      setStatus('RECONNECTING');
      break;
    }
    await page.waitForTimeout(2000);
  }
}

async function main() {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  const launchOptions = {
    headless: HEADLESS,
    viewport: null,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-webgl'
    ]
  };
  if (CHROME_CHANNEL && CHROME_CHANNEL !== 'chromium') launchOptions.channel = CHROME_CHANNEL;

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, launchOptions);
  state.browserStarted = true;
  setStatus('CONNECTING');

  context.on('close', () => {
    state.browserStarted = false;
    setStatus('STOPPED', { lastError: 'Browser context closed.' });
  });

  while (state.browserStarted) {
    try {
      await watchOneGeneration(context);
      if (state.status === 'NEEDS_VERIFICATION') {
        // Keep the same browser/profile alive so a legitimate human verification can be completed remotely.
        while (state.status === 'NEEDS_VERIFICATION' && state.browserStarted) {
          const page = context.pages()[0];
          if (!page || page.isClosed()) break;
          if (state.joinSeen && state.websocketSeen) {
            setStatus('ONLINE', { verificationReason: null });
            break;
          }
          await installMarkerObserver(page);
          await page.waitForTimeout(2000);
        }
      }
    } catch (err) {
      setStatus('RECONNECTING', { lastError: safeError(err) });
    }
    if (!state.browserStarted) break;
    await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY_MS));
  }
}

const app = express();
app.get('/health', (_req, res) => {
  const ok = ['CONNECTING', 'ONLINE', 'NEEDS_VERIFICATION', 'RECONNECTING'].includes(state.status);
  res.status(ok ? 200 : 503).json({ ok, ...state });
});
app.get('/ready', (_req, res) => {
  res.status(state.status === 'ONLINE' ? 200 : 503).json({ ready: state.status === 'ONLINE', status: state.status });
});
app.get('/', (_req, res) => {
  res.type('text/plain').send(`Bloxd SG Relay\nstatus=${state.status}\nmarkers=${state.markerCount}\n`);
});

app.listen(PORT, '0.0.0.0', () => console.log(`[relay-http] listening on ${PORT}`));
main().catch(err => {
  setStatus('STOPPED', { lastError: safeError(err) });
  process.exitCode = 1;
});
