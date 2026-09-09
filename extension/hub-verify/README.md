# HUB Verify – Chrome Extension v0.1.0

HUB Verify is the first Manifest V3 bridge between the HUB Survival Games website and Bloxd.io.

## What v0.1.0 does

- Detects when the HUB verification page is open.
- Detects when Bloxd.io is open, including Bloxd embedded in an iframe.
- Keeps a short-lived pairing state in `chrome.storage.local`.
- Detects the normal 8-character HUB registration code when it appears in Bloxd chat.
- Detects a future World Code identity marker in this format:

  `__HUB_VERIFY__|db=PLAYER_DB_ID|name=PLAYER_NAME|code=ABCDEFGH|ts=TIMESTAMP`

- Sends detected verification data back to the HUB tab through extension messaging.
- Shows connection state in the extension popup.
- Never reads or stores Bloxd passwords or cookies.

## Install for development

1. Extract the ZIP.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `hub-verify-extension` folder.
6. Open the HUB pending page and Bloxd.io.

## Important

v0.1.0 is deliberately a bridge/diagnostic build. It does not yet claim a player profile by itself. The final claim is only enabled after the permanent Bloxd `PlayerDbId` can be proven through the World Code/relay path rather than trusted from arbitrary page text.
