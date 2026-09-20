# Audit remediation - first bounded repair

Baseline: `40646bbe2fe31c381f908bec4415bfa307ffb6a4`.
Source backup branch: `backup/pre-audit-fixes-20260920-40646bbe`.

## Frontend scope

- Stop the PLAY translation observer from observing its own synchronous render.
- Build profile error/loading text using DOM textContent, not interpolated HTML.
- Resume PLAY presence after pageshow and handle repeated pagehide/pageshow cycles.
- Read the own profile through get_my_profile and Cup profiles through player_directory.
- Change only the relevant cache query strings in entry points.

No rating formula, Cup points, Duo modal logic, rank animation, extension, or World Code changes are included.
The patch is guarded by the Git blob hash of every changed source and fails before writing if a reviewed source has changed.
The repair workflow can write only its hardcoded repair branch. It does not merge or deploy production.

## Backend change already applied separately

Supabase migration: `audit_phase1_restrict_internal_registration_rpc`.
This is a permission-only change; no function body or table row is modified:

- process_bloxd_registration_code(text): deny PUBLIC/anon/authenticated; keep service_role.
- service_is_bloxd_player_linked(text): deny PUBLIC/anon/authenticated; keep service_role.
- admin_set_player_pending(uuid): deny PUBLIC/anon; keep authenticated/service_role and the existing internal admin check.

Post-change verification confirmed the original function-body hashes and the required user-profile/status permissions. The stored GamingBro1234TEST profile remained at 1777 rating / 1815 peak / 23 career rounds / 39 kills / 3 cups / 99 points.
A source-code revert does NOT undo the database permission change.
Do not reopen the unsafe RPC grants merely to roll back an unrelated frontend change.

## Test evidence

The workflow runs the same isolated browser tests against baseline and patched files.
Baseline mode asserts known defect behavior. Fixed mode asserts its absence plus preserved controls.
All browser network requests are intercepted. Session, database, fullscreen and lifecycle APIs are mocked.
This is not a full authenticated production check or a real Bloxd match.
The JSON reports and source hash manifest are committed only after both runs pass.

## Still open (not fixed by this block)

Signed identity assertions with a coordinated World Code/extension/backend transition; per-identity replay/freshness checks; reliable personal rename/verification delivery; persistent relay retries and snapshot assembly; concurrent extension storage writes; consistent multi-Cup selection; full real-session acceptance testing.
The rename popup is NOT repaired by this frontend block. Existing extension installations remain unchanged.
