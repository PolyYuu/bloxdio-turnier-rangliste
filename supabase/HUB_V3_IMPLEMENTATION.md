# HUB V3 implementation map

## Authentication
- Public Edge Function `hub-signup`: ingame name + password, no player email required. Uses an internal auth email that is never shown.
- Public Edge Function `hub-login`: ingame name + password.
- Authenticated Edge Function `hub-change-password`: current password + new password + repeat new password.
- Authenticated admin Edge Function `hub-admin-account`: create account for an existing player, set a replacement password, or delete the website account/profile.

## Current-name import rule
`global_players.current_name` is the only current import identity. `player_name_history` is audit-only. Renaming a player updates participant rows in non-finished Cups so future imports match the new name. Finished Cups keep their historical display-name snapshot.

## Ranking visibility
`global_players.ranking_experience_enabled` is nullable:
- `null`: first-login question has not been answered
- `true`: player sees Ranking, rating overlays, ranks and career stats
- `false`: calculations continue invisibly, but the player UI hides all cross-Cup ranking information

## Rating
`rating_v1` is data-driven through `rating_formula_settings` and has round finalization/recalculation RPCs. Rating history is persisted for Realtime overlays and auditability.

## Cup registration
Cup status controls registration:
- `draft`: no public registration
- `registration`: invitations/acceptance allowed
- `live`: registration locked
- `finished`: registration locked, no live badge

A registration becomes confirmed only after the exact team-size number of members accepted. Admin can still add players/teams manually.
