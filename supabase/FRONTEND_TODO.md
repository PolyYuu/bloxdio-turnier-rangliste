Frontend wiring checklist:
1. Load Supabase JS v2, then `hub-api.js`.
2. Replace demo login with `HubAPI.signUp` / `HubAPI.login` and persist the returned session.
3. `Profile` nav always resolves to `HubAPI.currentPlayerId()`; ranking-row profile clicks may open other players read-only.
4. Save 16x16 avatar with `HubAPI.saveAvatar`; only own-profile editor button is shown. Admin uses admin RPCs.
5. On first login, if `ranking_experience_enabled === null`, show the ranking-experience decision overlay.
6. If disabled, hide Ranking navigation, rank/rating/career stats, rating overlays and cross-Cup rank info; Cup-specific stats stay visible.
7. Show Register-for-Cup only when tournament `status === 'registration'`.
8. Friends/Cup invite drawer reads own request tables and uses the RPC helpers.
9. After admin import/manual edit, admin explicitly finalizes the round with `HubAPI.finalizeRoundRating`. Corrected finalized rounds use `recalculateRoundRating`.
10. Subscribe to rating_history inserts and show the existing V2 overlay only for the logged-in player and only if ranking experience is enabled.
11. Wire password settings to `HubAPI.changePassword(current,new,repeat)`.
