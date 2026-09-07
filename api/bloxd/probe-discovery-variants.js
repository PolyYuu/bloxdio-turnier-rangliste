const crypto = require('crypto');

const DISCOVERY_URL = 'https://social2.bloxd.io/social/bloxd-matchmake';
const ROOM_NAME = 'classic_playerSchematic';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

async function runVariant(name, payload, userAgent) {
  const response = await fetch(DISCOVERY_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      referer: 'https://bloxd.io/',
      'user-agent': userAgent
    },
    body: JSON.stringify(payload),
    redirect: 'manual'
  });

  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}

  return {
    name,
    status: response.status,
    ok: response.ok,
    succeeded: !!(data && data.succeeded === true),
    hasGameServerHost: !!(data && typeof data.gameServerHost === 'string' && data.gameServerHost),
    responseKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [],
    bodyKind: data == null ? 'non-json' : Array.isArray(data) ? 'array' : typeof data,
    textLength: text.length
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const worldId = String(req.query.worldId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(worldId)) {
    return json(res, 400, { ok: false, error: 'Invalid worldId' });
  }

  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36';
  const contents = {
    gameNameWithVariation: `${ROOM_NAME}|${worldId}`,
    languages: ['de-DE', 'de', 'en-US', 'en', 'en-Gb']
  };

  const baseMetrics = {
    '3PAPISID': 'N/A',
    '1PAPISID': 'N/A',
    '3PSID': 'N/A',
    '1PSID': 'N/A'
  };

  const random = (bytes) => crypto.randomBytes(bytes).toString('base64url');
  const dummyMetrics = {
    ...baseMetrics,
    '3PSIDMC': random(180),
    '3PSIDMCPP': random(360),
    '3PSIDMCSP': random(42)
  };

  try {
    const variants = [];
    variants.push(await runVariant('baseline-na-only', { contents, metricsCookies: baseMetrics }, userAgent));
    variants.push(await runVariant('dummy-3psidmc-fields', { contents, metricsCookies: dummyMetrics }, userAgent));
    variants.push(await runVariant('no-metricsCookies', { contents }, userAgent));

    return json(res, 200, {
      ok: true,
      worldId,
      variants
    });
  } catch (error) {
    return json(res, 502, { ok: false, error: String(error && error.message || error) });
  }
};
