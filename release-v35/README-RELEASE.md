# HUB V3.5 – Final Release Candidate

Stand: 2026-09-03

## Enthalten
- V3.4-Basis mit echtem Supabase-Live-State
- 8/15 Placement-/Hidden-Elo-System
- Hidden Elo nur im Admin für Unranked-Spieler
- Fake-Ranglistenprofile inkl. Name, Pixel-Avatar, Rank, Rating, Peak, Games und Form
- Fake-Profile im Admin löschbar
- Admin-Tab „Spieler Online“ über Presence-Heartbeat
- Realtime-Refresh für Ranking, Career Stats, Cups, Social State und Fake-Profile
- Import: Kill +1 / Deathmatch +3 / Sieg +2
- Kein globales Kill-Limit
- Kein globales Deathmatch-Limit
- Pro Spieler max. 1 DM je Runde
- Pro Runde max. 1 Sieger
- Rating wird erst explizit über „Finalize rating“ berechnet
- Bereits finalisierte Runden können über Recalculate aktualisiert werden
- Admin-Rundenpicker: kleines × zum Löschen nicht-finalisierter Runden wiederhergestellt

## Release-Sicherheitsänderungen
- Privilegierte SECURITY DEFINER RPCs sind nicht mehr für `anon` ausführbar.
- Service-RPCs bleiben service_role-only.
- `ranking_fake_profiles` ist öffentlich nur lesbar; Schreibzugriff erfolgt über Admin-RPCs.
- `player_online_sessions` ist nicht direkt aus dem Browser les-/schreibbar; Zugriff erfolgt nur über Presence-RPCs.
- `delete_tournament_round()` schützt finalisierte Rating-Runden vor inkonsistenter Löschung und verschiebt Participation-Daten zusammen mit Events.

## Statische Prüfungen
- 7/7 Inline-JavaScript-Blöcke: `node --check` erfolgreich
- 114 HTML IDs eindeutig, keine Duplikate
- Importparser enthält kein globales DM-Limit
- Win = +2, DM = +3, Kill = +1

## Noch manuell im echten Browser testen
1. Login/Logout mit echtem Account
2. Admin-Ansicht
3. Fake-Profil erstellen/löschen
4. Spieler-Online-Anzeige mit zwei Browserfenstern
5. Test-Cup: Import → Career Stats → Finalize Rating → Änderung → Recalculate
6. Nicht-finalisierte Testrunde mit × löschen

Hinweis: Ein lokaler Headless-Browser-Smoke-Test war in der Ausführungsumgebung durch eine Administrator-Netzwerkrichtlinie blockiert; die statischen JS/DOM-Prüfungen liefen erfolgreich.
