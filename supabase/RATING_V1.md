# rating_v1

Production formula for per-round Survival Games rating.

The formula is intentionally not tuned to reproduce the final order of any specific historical Cup. If the mathematically calculated cross-Cup rating order differs from the Cup table, that is acceptable.

Per round, team rating uses:
- 55% placement/opponent strength
- 40% SG points
- 5% dominance
- Elo expectation scale 1400
- effective team strength: 70% strongest member + 30% average of the remaining member(s); for Duo this is exactly 70/30
- lobby normal-win targets: 47 (<=9 teams), 52 (10-12 teams), 57 (13+ teams)
- negative point-performance is softened so large ties on 0 points share the bottom penalty instead of every team being treated as a hard isolated last place
- individual split: 55% rating gap / 45% personal point performance, capped to min(25, 20% of team delta)

Placements:
- 15 rounds
- hidden start 1150
- positive delta x2.5, negative delta x0.5
- all rating and rank information remains invisible to the player until placement 15
- no normal rank multiplier during placements
- after round 15 clamp 650..1800 and round to an integer

Post-placement rank multipliers:
- Wood +x1.80 / -x0.20
- Iron +x1.20 / -x0.70
- Gold x1.00
- Emerald x1.00
- Diamond x1.00
- Master +x0.90 / -x1.03
- Grandmaster +x0.80 / -x1.15

Rounding:
- Wood and Diamond use mathematical ceil after the rank multiplier (+5.3 -> +6, -5.7 -> -5)
- Iron, Gold, Emerald, Master and Grandmaster round to the nearest integer
- placement decimals remain hidden until placement 15; the final placement rating is rounded after the 650..1800 clamp

Calibration checks:
- large ties on low/zero SG points must share placement appropriately instead of each participant being treated as a unique last place
- normal win magnitude scales by lobby size
- lower-rated teams beating much stronger opposition receive more than an equivalent result against equal-rated opposition
- no end-of-Cup placement bonus exists; every round is rated independently

The backend stores the formula version and every round calculation in rating_history, so later tuning can become rating_v2 without rewriting historical Cup results.