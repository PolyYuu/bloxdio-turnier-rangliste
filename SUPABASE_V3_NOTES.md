# HUB V3 Backend

The production Supabase project now contains the backend foundation for the HUB application.

Implemented backend pieces:
- global player identities and current-name-only import identity
- name history for audit only (old names are not import aliases)
- username/password account mapping without requiring a player email
- Edge Functions for signup, login, change password and admin account actions
- player-owned avatar/name/ranking-experience settings
- admin avatar/name/rating/stat controls
- Cup lifecycle: draft / registration / live / finished
- confirmed team registration only after every required member accepts
- friends and friend requests
- rating history + Realtime tables
- calibrated and active `rating_v1` round calculation
- round finalize + safe recalculation RPCs

Current rating_v1 calibration:
- 35% placement/opponent strength
- 60% SG points
- 5% dominance
- normal-win targets: 47 / 52 / 57 by lobby size
- hidden placement seed 1150, 15 placement rounds, +x2.5 / -x0.5, final clamp 650..1800

Historical Cup participant rows keep their finished-Cup name snapshots. Active/future Cup participant rows are automatically updated when the current ingame name changes, so future imports match the new current name only.

No old Cup was retroactively finalized into live rating history during calibration; Cup #1 tests were executed transactionally and rolled back.