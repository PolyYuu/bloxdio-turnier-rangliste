# HUB V3 Backend

This branch will connect the V2 competitive UI to the real Supabase backend.

Backend pieces already provisioned in Supabase:
- global player identities and name history
- username/password account mapping (no user email required)
- player-owned avatar/name/ranking-experience settings
- admin avatar/name/rating/stat controls
- Cup lifecycle: draft / registration / live / finished
- confirmed team registration with member acceptance
- friends and friend requests
- rating history + Realtime tables
- `rating_v1` formula settings and round finalization RPCs
- Edge Functions: `hub-signup`, `hub-login`, `hub-change-password`, `hub-admin-account`

Important: historical Cup participant rows keep their finished-Cup name snapshots. Active/future Cup participant rows are automatically updated when the current ingame name changes, so future imports match the new current name only.
