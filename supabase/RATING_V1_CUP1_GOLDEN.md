# rating_v1 – Cup #1 golden calibration

Reference simulation conditions:
- all 18 players start already ranked at 1100
- no placement x2.5/x0.5 multipliers
- normal post-placement rank multipliers still apply when a player crosses a rank boundary
- rounds 1-8 use the real 22.08 Cup event data
- simulation was executed inside a database transaction and rolled back; production player ratings were not changed

Final rating changes after 8 rounds:

| Player | Delta | Final |
|---|---:|---:|
| Stalker_Curry | +185 | 1285 |
| SuesserSuessling | +180 | 1280 |
| Fruechtebox | +109 | 1209 |
| rgyray | +107 | 1207 |
| Haarglatzfall123 | +106 | 1206 |
| Haarsytem123 | +105 | 1205 |
| Strebaer | +95 | 1195 |
| Meinii | +87 | 1187 |
| mino_o | +16 | 1116 |
| Holynazmoly | +12 | 1112 |
| KleinerWurm | -52 | 1048 |
| FetteEule | -58 | 1042 |
| SchlanzGurke | -70 | 1030 |
| 000Nemo000 | -74 | 1026 |
| LordLudes58 | -96 | 1004 |
| Mysterykiller12 | -96 | 1004 |
| luj00 | -125 | 975 |
| JuanDaLan | -127 | 973 |

Team-average deltas are approximately:
1. Orange +182.5
2. Dark Green +105.5
3. Pink +108.0 by individual average but the point-weight calibration is intentionally very close; this dataset remains a regression check for future tuning
4. Yellow +91.0

Important: this file records calibration output, not live player ratings.