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
| Stalker_Curry | +187 | 1287 |
| SuesserSuessling | +179 | 1279 |
| Haarglatzfall123 | +109 | 1209 |
| Haarsytem123 | +109 | 1209 |
| Fruechtebox | +108 | 1208 |
| rgyray | +105 | 1205 |
| Strebaer | +94 | 1194 |
| Meinii | +86 | 1186 |
| mino_o | +14 | 1114 |
| Holynazmoly | +11 | 1111 |
| KleinerWurm | -47 | 1053 |
| FetteEule | -53 | 1047 |
| SchlanzGurke | -67 | 1033 |
| 000Nemo000 | -69 | 1031 |
| LordLudes58 | -90 | 1010 |
| Mysterykiller12 | -93 | 1007 |
| luj00 | -118 | 982 |
| JuanDaLan | -120 | 980 |

Team-average deltas:
1. Orange +183.0
2. Dark Green +109.0
3. Pink +106.5
4. Yellow +90.0
5. Lime Green +12.5
6. Dark Blue -50.0
7. Cyan -68.0
8. Brown -91.5
9. White -119.0

Important: this file records calibration output, not live player ratings.