# HUB Map Intros (isolated test module)

This feature is intentionally isolated from the existing round-end overlay and tournament scoring logic.

Files:
- `admin-map-intros.js` – adds the Admin > Maps section and sends a Supabase Realtime broadcast.
- `play-map-intros.js` – listens on PLAY, verifies that the logged-in player belongs to the live tournament, and opens/closes the overlay.
- `map-intros.css` – visual layer only.
- `assets/sg7.webp` – SG7 loading image.
- `assets/sg7-intro.mp3` – SG7 intro audio.

No database schema changes are required. Bloxd.io is never paused or reloaded.

## Remove the feature
1. Remove the `map-intros/play-map-intros.js` script include from `play.html`.
2. Remove the `load('map-intros/admin-map-intros.js?...')` line from `pending-hub.js`.
3. Delete the `map-intros/` folder.

No rollback SQL is needed.
