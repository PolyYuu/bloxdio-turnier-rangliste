# Bloxd SG Persistent Relay Worker

Phase-8 transport replacement for the personal Chrome/Tampermonkey relay.

## What this worker does

- launches Bloxd in a **persistent Chromium profile** (`/data/chrome-profile`)
- keeps normal Bloxd browser/traffic verification intact
- reports `NEEDS_VERIFICATION` instead of trying to solve or bypass a challenge
- watches the Bloxd DOM only for machine-generated `__SG_EVT__` markers
- parses the production `BEGIN`, `PLAYER`, `KILL`, `DM`, `WIN`, `END`, `CANCEL` and V1.3 snapshot formats
- rebuilds `SNAPBEGIN` + `SNAPPLAYER` + `SNAPEND` into the same `round_snapshot` payload used by the proven Tampermonkey V1.1 snapshot relay
- preserves the original 2.5-second snapshot delay to avoid false mismatches from asynchronous KILL/DM/WIN HTTP requests
- can forward events to the HUB API when explicitly enabled
- sends the existing-style relay heartbeat every 20 seconds when forwarding is enabled
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
HEARTBEAT_INTERVAL_MS=20000
RELAY_ID=bloxd-persistent-relay

# Leave disabled for the first diagnostic deployment
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

`NEEDS_VERIFICATION` is expected when Bloxd requires its normal browser traffic verification. The persistent profile is deliberately kept alive so a human can complete that legitimate browser step remotely. The profile remains on the mounted `/data` volume across restarts.

## Ports

- `3000`: health/status HTTP server
- `6080`: optional noVNC browser UI, only when `VNC_PASSWORD` is set

Never publish the noVNC endpoint without authentication.

## Parser coverage

Supported and tested:

- `BEGIN` -> `round_start`
- `PLAYER` -> `player_seen`
- `KILL` -> `kill`
- `DM` -> `deathmatch_start`
- `WIN` -> `win`
- `END` -> `round_end`
- `CANCEL` -> `round_cancel`
- `SNAPBEGIN` / `SNAPPLAYER` / `SNAPEND` -> assembled `round_snapshot`

Unknown machine markers are counted but are not forwarded.

## Local checks

```bash
npm install
node --check src/worker.js
node --check src/event-parser.js
node --check src/snapshot-assembler.js
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

For the first remote deployment, keep `FORWARD_EVENTS=false`. First prove: normal browser verification -> world join -> WebSocket online -> diagnostic marker reception. Only then enable HUB forwarding with a fresh relay key.
