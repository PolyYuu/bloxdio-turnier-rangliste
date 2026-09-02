# rating_v1

Calibrated production formula for per-round Survival Games rating.

Per round, team rating uses:
- 35% placement/opponent strength
- 60% SG points
- 5% dominance
- Elo expectation scale 1400
- effective team strength: 70% strongest member + 30% average of the remaining member(s); for Duo this is exactly 70/30
- lobby normal-win targets: 47 (<=9 teams), 52 (10-12 teams), 57 (13+ teams)
- negative point-performance is softened so large ties on 0 points share the bottom penalty instead of every team being treated as a hard isolated last place
- individual split: 55% rating gap / 45% personal point performance, capped to min(25, 20% of team delta)

The move from the provisional 55/40/5 split to 35/60/5 is deliberate: on the real 22.08 Cup data it makes the accumulated per-round rating reproduce the actual Cup ordering Orange #1, Dark Green #2, Pink #3, Yellow #4 without adding a separate end-of-Cup placement bonus.

Placements:
- 15 rounds
- hidden start 1150
- positive delta x2.5, negative delta x0.5
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

Golden calibration checks:
- 9-team Cup #1 round 1: four 0-point teams are about -19 each before integer rounding, not -35/-40
- equal-rating normal 9-team wins remain around +47 to +49 depending on the small dominance modifier
- real Cup #1 team-average deltas from an equal 1100 start: Orange +183.0, Dark Green +109.0, Pink +106.5, Yellow +90.0
- extreme lower-rated upsets can exceed a normal win because the pairwise placement-vs-expectation component is intentionally not clamped to +/-1

The backend stores the formula version and every round calculation in rating_history, so later tuning can become rating_v2 without rewriting historical Cup results.