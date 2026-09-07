const crypto = require('crypto');

const ROOM_NAME = 'classic_playerSchematic';
const DISCOVERY_URL = 'https://social2.bloxd.io/social/bloxd-matchmake';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function isAllowedBloxdHost(host) {
  return /^gs-[a-z0-9.-]+\.bloxd\.io$/i.test(host || '');
}

function isValidWorldId(worldId) {
  return /^[A-Za-z0-9_-]{8,120}$/.test(worldId || '');
}

function sanitize(value, depth = 0) {
  if (depth > 4) return '[max-depth]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 10).map(v => sanitize(v, depth + 1));
  if (typeof value !== 'object') {
    if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 40)}…(${value.length})` : value;
    return value;
  }
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const k = String(key).toLowerCase();
    if (/(session|token|cookie|auth|sid|traffic|secret|credential|password)/i.test(k)) {
      out[key] = val == null ? null : '[redacted]';
    } else {
      out[key] = sanitize(val, depth + 1);
    }
  }
  return out;
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  return { text, data };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const worldId = String(req.query.worldId || '').trim();
  if (!isValidWorldId(worldId)) {
    return json(res, 400, { ok: false, error: 'Invalid worldId' });
  }

  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36';
  const languages = ['de-DE', 'de', 'en-US', 'en', 'en-Gb'];

  try {
    // Step 1: ask Bloxd which game-server currently owns this custom world.
    const discoveryPayload = {
      contents: {
        gameNameWithVariation: `${ROOM_NAME}|${worldId}`,
        languages
      },
      metricsCookies: {
        '3PAPISID': 'N/A',
        '1PAPISID': 'N/A',
        '3PSID': 'N/A',
        '1PSID': 'N/A'
      }
    };

    const discoveryResponse = await fetch(DISCOVERY_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        referer: 'https://bloxd.io/',
        'user-agent': userAgent
      },
      body: JSON.stringify(discoveryPayload),
      redirect: 'manual'
    });

    const discoveryBody = await readJsonResponse(discoveryResponse);
    const discoveryData = discoveryBody.data;
    const host = discoveryData && typeof discoveryData.gameServerHost === 'string'
      ? discoveryData.gameServerHost.trim()
      : '';
    const shortLobbyName = discoveryData && discoveryData.lobbyName != null
      ? String(discoveryData.lobbyName)
      : '';
    const discoveryOk = !!(
      discoveryResponse.ok &&
      discoveryData &&
      discoveryData.succeeded === true &&
      isAllowedBloxdHost(host)
    );

    if (!discoveryOk) {
      return json(res, 200, {
        ok: false,
        phase: 'discovery',
        discovery: {
          ok: false,
          upstreamStatus: discoveryResponse.status,
          succeeded: !!(discoveryData && discoveryData.succeeded),
          gameServerHost: isAllowedBloxdHost(host) ? host : null,
          lobbyName: shortLobbyName || null,
          responseKeys: discoveryData && typeof discoveryData === 'object' && !Array.isArray(discoveryData)
            ? Object.keys(discoveryData)
            : [],
          sanitizedResponse: discoveryData == null
            ? { textLength: discoveryBody.text.length, prefix: discoveryBody.text.slice(0, 120) }
            : sanitize(discoveryData)
        },
        error: 'Bloxd game-server discovery failed'
      });
    }

    // The browser later sends the full custom-world lobby identifier to joinOrCreate.
    const fullLobbyName = `${worldId}|default|${shortLobbyName || '1'}`;
    const playSessionId = crypto.randomBytes(10).toString('base64url');
    const joinUrl = `https://${host}/matchmake/joinOrCreate/${ROOM_NAME}`;
    const joinPayload = {
      cookies: { origin: 'classic' },
      isMobile: false,
      browserInfo: {
        deviceType: 'mouseOnly',
        name: 'Chrome',
        platform: 'Linux x86_64',
        platformType: 'desktop',
        ua: userAgent,
        version: '152.0.0.0'
      },
      generalCookies: {
        joinDiscord: false,
        newGo: 'c'
      },
      isLoggedIn: false,
      languages,
      lobbyName: fullLobbyName,
      playSessionId,
      siteUsed: 'bloxd',
      subsiteUsed: 'bloxd',
      version: 803
    };

    const joinResponse = await fetch(joinUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        origin: 'https://bloxd.io',
        referer: 'https://bloxd.io/',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': userAgent
      },
      body: JSON.stringify(joinPayload),
      redirect: 'manual'
    });

    const joinBody = await readJsonResponse(joinResponse);
    const data = joinBody.data;
    const room = data && data.room ? data.room : null;
    const sessionIdPresent = !!(data && data.sessionId);
    const reservationOk = !!(
      joinResponse.ok &&
      room &&
      room.roomId &&
      room.processId &&
      sessionIdPresent
    );
    const bloxdCode = data && typeof data === 'object' && !Array.isArray(data) && data.code != null
      ? data.code
      : null;
    const bloxdError = data && typeof data === 'object' && !Array.isArray(data)
      ? (data.error || data.message || null)
      : null;

    return json(res, 200, {
      ok: reservationOk,
      phase: reservationOk ? 'reservation' : 'join',
      discovery: {
        ok: true,
        upstreamStatus: discoveryResponse.status,
        gameServerHost: host,
        lobbyName: shortLobbyName || null,
        gameNameWithVariation: discoveryData.gameNameWithVariation || null
      },
      join: {
        transportOk: joinResponse.ok,
        upstreamStatus: joinResponse.status,
        bloxdCode,
        bloxdError,
        fullLobbyName,
        responseType: data == null ? 'non-json' : Array.isArray(data) ? 'array' : typeof data,
        responseKeys: data && !Array.isArray(data) && typeof data === 'object' ? Object.keys(data) : [],
        reservation: room ? {
          name: room.name || null,
          roomId: room.roomId || null,
          processId: room.processId || null,
          lobbyName: room.lobbyName || null,
          clients: room.clients ?? null,
          maxClients: room.maxClients ?? null,
          locked: room.locked ?? null,
          private: room.private ?? null,
          sessionIdPresent
        } : null,
        sanitizedResponse: data == null
          ? { textLength: joinBody.text.length, prefix: joinBody.text.slice(0, 120) }
          : sanitize(data)
      },
      error: reservationOk
        ? null
        : (bloxdError || (!joinResponse.ok ? `Bloxd matchmaker HTTP ${joinResponse.status}` : 'No seat reservation returned'))
    });
  } catch (error) {
    return json(res, 502, {
      ok: false,
      phase: 'network',
      error: String(error && error.message || error)
    });
  }
};
