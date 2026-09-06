from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
repls={
"Safe relay diagnostics. Phase 2 may start a bound Cup round; kills, points and rating are still read-only.":"Safe relay diagnostics. Phase 4 processes bound participants, teams, kills, Deathmatch, wins and round end live; placement and rating still require explicit finalization.",
"Sichere Relay-Diagnose. Phase 2 darf eine gebundene Cup-Runde starten; Kills, Punkte und Rating bleiben weiterhin unangetastet.":"Sichere Relay-Diagnose. Phase 4 verarbeitet gebundene Teilnehmer, Teams, Kills, Deathmatch, Siege und Rundenende live; Placement und Rating benötigen weiterhin ein ausdrückliches Finalisieren.",
"PHASE 2 · ROUND START":"PHASE 4 · LIVE RESULTS",
"Incoming events are stored and displayed. Only a bound ROUND_START may update Cup status/current round. Kills, Deathmatch, wins, placement, rating and career stats are still untouched.":"Bound live events may update participants, teams, kills, Deathmatch, wins and round results. Placement, Ranked Games and rating only change after explicit rating finalization.",
"Eingehende Events werden gespeichert und angezeigt. Nur ein gebundener ROUND_START darf Cup-Status und aktuelle Runde ändern. Kills, Deathmatch, Siege, Placement, Rating und Karriere-Stats bleiben unangetastet.":"Gebundene Live-Events dürfen Teilnehmer, Teams, Kills, Deathmatch, Siege und Rundenergebnisse aktualisieren. Placement, Ranked Games und Rating ändern sich erst nach dem ausdrücklichen Rating-Finalisieren."
}
for a,b in repls.items():
    n=s.count(a)
    if n!=1: raise SystemExit(f'expected 1 for {a[:45]!r}, got {n}')
    s=s.replace(a,b,1)
p.write_text(s,encoding='utf-8')
print('phase4 debug copy updated')
