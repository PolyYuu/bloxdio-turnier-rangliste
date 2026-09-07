const crypto = require('crypto');

const ROOM_NAME = 'classic_playerSchematic';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function isAllowedBloxdHost(host) {
  return /^gs-[a-z0-9.-]+\.bloxd\.io$/i.test(host || '');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const host = String(req.query.host || '').trim();
  const lobbyName = String(req.query.lobbyName || '').trim();

  if (!isAllowedBloxdHost(host)) {
    return json(res, 400, { ok: false, error: 'Invalid Bloxd game-server host' });
  }
  if (!lobbyName || lobbyName.length > 160) {
    return json(res, 400, { ok: false, error: 'Invalid lobbyName' });
  }

  const playSessionId = crypto.randomBytes(10).toString('base64url');
  const url = `https://${host}/matchmake/joinOrCreate/${ROOM_NAME}`;
  const payload = {
    cookies: { origin: 'classic' },
    isMobile: false,
    browserInfo: {
      deviceType: 'mouseOnly',
      name: 'Chrome',
      platform: 'Linux x86_64',
      platformType: 'desktop',
      ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36',
      version: '152.0.0.0'
    },
    generalCookies: {
      joinDiscord: false,
      newGo: 'c'
    },
    isLoggedIn: false,
    languages: ['en-US', 'en'],
    lobbyName,
    playSessionId,
    siteUsed: 'bloxd',
    subsiteUsed: 'bloxd',
    version: 803
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: 'https://bloxd.io',
        referer: 'https://bloxd.io/',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': payload.browserInfo.ua
      },
      body: JSON.stringify(payload),
      redirect: 'manual'
    });

    const text = await upstream.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}

    const room = data && data.room ? data.room : null;
    return json(res, 200, {
      ok: upstream.ok,
      upstreamStatus: upstream.status,
      reservation: room ? {
        name: room.name || null,
        roomId: room.roomId || null,
        processId: room.processId || null,
        lobbyName: room.lobbyName || null,
        clients: room.clients ?? null,
        maxClients: room.maxClients ?? null,
        locked: room.locked ?? null,
        private: room.private ?? null,
        sessionIdPresent: !!data.sessionId
      } : null,
      error: upstream.ok ? null : (data && (data.error || data.message)) || text.slice(0, 300) || 'Bloxd matchmaker rejected probe'
    });
  } catch (error) {
    return json(res, 502, { ok: false, error: String(error && error.message || error) });
  }
};
