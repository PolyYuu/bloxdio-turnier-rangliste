# Bloxd SG Persistent Relay Worker

Phase-8 transport replacement for the personal Chrome/Tampermonkey relay.

## What this worker does

- launches Bloxd in a **persistent Chromium profile** (`/data/chrome-profile`)
- keeps the normal browser security/traffic verification intact
- reports `NEEDS_VERIFICATION` instead of trying to solve or bypass a challenge
- watches the Bloxd DOM only for machine-generated `__SG_EVT__` markers
- parses the established `BEGIN`, `PLAYER`, `KILL`, `DM`, `WIN`, and `END` formats
- can forward supported events to the HUB API when explicitly enabled
- exposes `/health` and `/ready`
- can expose a password-protected noVNC view for legitimate manual browser verification

## Important safety defaults

Event forwarding is **OFF by default**. The worker will not send anything to the production HUB unless all of these are configured:

```text
FORWARD_EVENTS=true
HUB_API_URL=https://.../api/bloxd/events
HUB_RELAY_KEY=<fresh private secret>
```

Do not reuse an older relay key that has previously appeared in chat, screenshots, logs, or source code.

The worker never extracts, logs, replays, forges, or attempts to solve Bloxd Turnstile/reCAPTCHA/traffic-verification tokens.

## Environment

```text
BLOXD_WORLD_ID=HT_Y95VcEQaUBLbTc24H7
BLOXD_LOBBY=1
USER_DATA_DIR=/data/chrome-profile
HEADLESS=false
CHROME_CHANNEL=chromium
PORT=3000
VERIFY_TIMEOUT_MS=45000
RECONNECT_DELAY_MS=5000
RELAY_ID=bloxd-persistent-relay

# Optional, leave disabled for the first diagnostic deployment
FORWARD_EVENTS=false
HUB_API_URL=
HUB_RELAY_KEY=

# Optional manual verification UI
VNC_PASSWORD=<strong random password>
```

## State machine

```text
BOOTING
  -> CONNECTING
      -> ONLINE
      -> NEEDS_VERIFICATION
      -> RECONNECTING
```

`NEEDS_VERIFICATION` is expected when Bloxd requires its normal browser traffic verification. The persistent profile is deliberately kept alive so a human can complete that legitimate browser step once. The profile remains on the mounted `/data` volume across restarts.

## Ports

- `3000`: health/status HTTP server
- `6080`: optional noVNC browser UI, only when `VNC_PASSWORD` is set

Never publish the noVNC endpoint without authentication.

## Current parser coverage

Supported and tested:

- `BEGIN` -> `round_start`
- `PLAYER` -> `player_seen`
- `KILL` -> `kill`
- `DM` -> `deathmatch_start`
- `WIN` -> `win`
- `END` -> `round_end`

The exact V1.3 snapshot-fragment wire format is intentionally **not guessed**. Unknown machine markers are counted as unsupported and are not forwarded until that format has been recovered and tested.

## Local checks

```bash
npm install
node --check src/worker.js
node --check src/event-parser.js
node test/event-parser.test.js
```

## Docker

```bash
docker build -t bloxd-sg-relay .
docker run --rm \
  -p 3000:3000 \
  -p 6080:6080 \
  -v bloxd-relay-data:/data \
  -e VNC_PASSWORD='change-me' \
  bloxd-sg-relay
```

For the first remote deployment, keep `FORWARD_EVENTS=false`. First prove: browser verification -> world join -> WebSocket online -> diagnostic marker reception. Only then enable HUB forwarding with a fresh relay key.
