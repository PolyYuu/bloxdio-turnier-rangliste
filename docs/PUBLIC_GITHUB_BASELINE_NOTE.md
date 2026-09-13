# HUB LiveSync baseline — 2026-09-13

The validated production reference is HUB Verify `v1.0.1` paired with Bloxd World Code LiveSync `v3.2`.

End-to-end tests with Tampermonkey disabled covered round start, player capture, kill, deathmatch, win, round end and snapshot reconciliation. Rounds 10 and 11 of the isolated `Bloxd Live Sync Test` cup both ended with `MATCHED` snapshots and no discrepancies.

The public repository contains the validated HUB Verify source. The matching World Code is intentionally retained only in the private project backup because it contains the tournament-event signing key.

Later `v1.0.2` and `v1.0.3` extension packages are preserved privately as UI/logo candidates. They are not labelled as the end-to-end-tested baseline until they pass a separate Chrome/Bloxd regression test.
