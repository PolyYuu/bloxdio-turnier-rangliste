# HUB Verify — validated v1.0.1

HUB Verify is the Manifest V3 bridge between HUB Survival Games and Bloxd.io.

## Validated capabilities

- Passive account verification through Bloxd registration markers
- Tournament LiveSync relay for `BEGIN`, `PLAYER`, `KILL`, `DM`, `WIN`, snapshot, `END` and `CANCEL` markers
- Snapshot buffering and reconciliation upload
- 30-second Bloxd heartbeat
- Silent removal of technical `HUBSYNC` carrier lines
- DE/EN/FR popup UI and local diagnostic counters
- No Tampermonkey dependency

The end-to-end-tested pair is HUB Verify `v1.0.1` plus Bloxd World Code LiveSync `v3.2`. The World Code is not published here because it contains the private tournament-event signing key.

## Install for development

1. Extract `HUB-Verify-v1.0.1.zip` or use this folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted extension folder.
6. Reload any already-open Bloxd tab so Chrome injects the current content script.

## Security model

The extension can be installed by any player for account verification. Tournament events are only sent to the Bloxd account that an in-game admin selected as the active relay. Repeated delivery of the same event ID is deduplicated by the backend.

Do not add the World Code signing key or an unredacted World Code package to this public repository.
