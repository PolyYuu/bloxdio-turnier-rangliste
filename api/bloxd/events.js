const INGEST_URL = 'https://nxzrgbpaxukgjyzwupjp.supabase.co/functions/v1/bloxd-relay-ingest';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', 'https://bloxd.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-SG-Relay-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const relayKey = String(req.headers['x-sg-relay-key'] || '');
  if (!relayKey) {
    return res.status(401).json({ ok: false, error: 'Missing relay key' });
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(rawBody, 'utf8') > 262144) {
      return res.status(413).json({ ok: false, error: 'Payload too large' });
    }

    const upstream = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sg-relay-key': relayKey,
        'x-sg-relay-proxy': 'hub-vercel-v1'
      },
      body: rawBody
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { ok: false, error: 'Invalid upstream response' }; }

    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error('[bloxd-relay] proxy error', error);
    return res.status(502).json({ ok: false, error: 'Relay ingest unavailable' });
  }
};
