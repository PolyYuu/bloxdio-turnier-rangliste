# HUB Survival Games – V3.5

Added before public release:
- Admin sees a subtle Hidden Elo line for unranked players.
- Admin can create fake leaderboard profiles with pixel avatar, name, manual rank, rating, peak, games and form; fake rows have an admin-only X removal button.
- New Admin tab “Spieler Online” shows authenticated players with an open browser tab. Presence is maintained by a 25-second heartbeat and expires after 75 seconds if a tab disappears without a clean logout.
- Malik’s username account is authorized as an admin in addition to the original admin account.
- Career/Cup views now refresh on event/stat/global-player changes; imports and manual K/DM/W edits rebuild career stats immediately.
- Placement progress updates after every finalized rated round. During placements, Hidden Elo remains private to normal players and visible only in Admin.
- Rating updates, ranking rows, Cup views and an open player profile are refreshed through Supabase Realtime.

Important distinction:
- Importing/editing a round updates Cup results + career stats immediately.
- “Finalize Rating” is what advances placement progress / rating for that round.
