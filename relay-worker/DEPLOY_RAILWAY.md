# Railway deployment plan — Phase 8 relay

This is the first remote E2E deployment plan. Keep the real HUB disconnected until the browser relay has proven that it can join Bloxd and receive diagnostic markers.

## 1. Create service from GitHub

Repository:

```text
PolyYuu/bloxdio-turnier-rangliste
```

Set the Railway service **Root Directory** to:

```text
/relay-worker
```

Railway should then detect `relay-worker/Dockerfile` automatically.

## 2. Attach persistent volume BEFORE browser verification

Attach one Railway Volume to the relay service.

Mount path:

```text
/data
```

The persistent Bloxd Chromium profile is stored at:

```text
/data/chrome-profile
```

Do not recreate/delete this volume between normal deploys, otherwise the browser profile and legitimate verification state are lost.

## 3. First-deploy variables

Use these non-secret values:

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
FORWARD_EVENTS=false
```

Create a strong random password as a Railway secret variable:

```text
VNC_PASSWORD=<strong random password>
```

For this first deployment DO NOT set a production HUB relay key and keep `FORWARD_EVENTS=false`.

## 4. Healthcheck

Set Railway healthcheck path:

```text
/health
```

The worker deliberately returns HTTP 200 while it is `CONNECTING`, `ONLINE`, `NEEDS_VERIFICATION`, or `RECONNECTING`, because needing legitimate Bloxd verification is not a crashed container.

## 5. Public browser-verification UI

The container listens on:

```text
3000  worker health/status HTTP
6080  noVNC browser UI
```

For the temporary verification UI, create a Railway public domain whose **target port is 6080**.

Opening that domain should display the browser desktop. noVNC/x11vnc will ask for the `VNC_PASSWORD` configured above.

Do not share this URL or password.

## 6. First proof — no HUB writes

With `FORWARD_EVENTS=false`:

1. Open the noVNC domain.
2. If Bloxd asks for its normal browser verification, complete it manually. Do not use automation or token-copying.
3. Let the browser enter the SG world.
4. Worker status should change from `NEEDS_VERIFICATION` / `CONNECTING` to `ONLINE` after the game-server reservation and WebSocket are present.
5. For the first live-sync test use only the diagnostic binding, not a production cup:

```text
/livesync bind t1 sg-headless-probe 1
```

6. Trigger a harmless test/round only after the relay player is visibly in the world.
7. Check worker logs for safe marker summaries such as `round_start`, `player_seen`, etc. The worker intentionally does not print arbitrary chat or secrets.
8. A complete round should also assemble `SNAPBEGIN`, `SNAPPLAYER`, `SNAPEND` into one `round_snapshot` after the original 2.5-second delay.

## 7. Only after the diagnostic relay is proven

Create a **fresh** private HUB relay key. Do not reuse any old key that appeared in previous chats, screenshots, source files, or logs.

Set Railway secret variables:

```text
HUB_API_URL=https://bloxdio-turnier-rangliste.vercel.app/api/bloxd/events
HUB_RELAY_KEY=<fresh private relay key>
FORWARD_EVENTS=true
```

Then perform another isolated diagnostic round and verify the HUB receives the same chain as the previous Tampermonkey relay.

## 8. Final cut-over

Only after the remote worker has proven:

```text
world join
-> live marker reception
-> snapshot assembly
-> HUB forwarding
-> heartbeat
-> reconnect with persistent profile
```

remove the requirement for Malik's personal Chrome/Tampermonkey tab.

The existing V22 World Code stays unchanged during this cut-over.
