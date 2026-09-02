# rating_v1 (draft production formalization)

Per round, team rating uses:
- 55% placement/opponent strength
- 40% SG points
- 5% dominance
- Elo expectation scale 1400
- effective Duo strength: 70% stronger member + 30% lower member
- lobby normal-win targets: 47 (<=9 teams), 52 (10-12 teams), 57 (13+ teams)
- individual split: 55% rating gap / 45% personal point performance, capped to min(25, 20% of team delta)

Placements:
- 15 rounds
- hidden start 950
- positive delta x2.5, negative delta x0.5
- no rank multiplier during placements
- after round 15 clamp 650..1800 and round to integer

Post-placement rank multipliers:
- Wood +x1.80 / -x0.20
- Iron +x1.20 / -x0.70
- Gold x1.00
- Emerald x1.00
- Diamond x1.00
- Master +x0.90 / -x1.03
- Grandmaster +x0.80 / -x1.15

Important: the backend stores formula settings/version and round history so calibration changes can create rating_v2 without rewriting old Cup history.