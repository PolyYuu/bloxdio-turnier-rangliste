# Cup #1 diagnostic note

This file is retained only as a note that the real 22.08 Cup was used as a regression dataset.

The earlier 35% placement / 60% SG-points calibration was deliberately removed because it was too closely tuned to reproduce that Cup's final team order. `rating_v1` is now again the principled formula documented in `RATING_V1.md`:
- 55% placement/opponent strength
- 40% SG points
- 5% dominance

The 22.08 Cup is still useful for checking ties, round magnitudes, imports and placement behavior, but its final Cup order is not a target that the cross-Cup rating system must reproduce.

When this Cup is eventually backfilled into live ranking history, its eight rounds count as the first eight placement games for its participating players: hidden start 1150, positive round changes x2.5, negative round changes x0.5, with all rank/rating output invisible until placement game 15.