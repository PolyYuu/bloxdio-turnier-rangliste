# Sitzungsstatus — 13.10.2026

Phase A ist lokal umgesetzt; nächster Halt ist **USER_CHECKPOINT 1**.
Branch: `codex/phase-a-active-hub-accounts`.
Ausgangscommit/Remote-main: `f5d2b79f95da78e4d820e2dc513665f9ac5452ba`.

Die Freundesuche verwendet die bestehende authentifizierte Kandidaten-RPC.
Die normale Adminliste zeigt ausschließlich aktive HUB-Accountprofile.
Debounce, alte Demo-Handler, verspätete Antworten und Sessionwechsel sind abgesichert.
Die gezielte Aufnahme historischer Cup-Profile über deren Admin-Verwaltung bleibt möglich.

Geänderte Produktdatei: `index.html`. Neue Tests: `tests/phase-a-accounts.test.cjs`,
`tests/phase-a-browser.py`. Vollständiger Bericht und reproduzierbare Kommandos:
[Phase-A-Prüfbericht](docs/phase-a/README.md),
[Browserresultate](docs/phase-a/browser-results.json).

Backend ausschließlich über `sg-supabase-ro` gelesen. Beobachtet: 22 aktive HUB-
Accountprofile, ImportTestB ohne Account, TestAccount5 unverändert bei 1621/1635,
16 Rating-History- und zwei Cup-Einträgen; historischer Cup 22.08. mit 18 Teilnehmern.
MCP hat keinen Spieler-Authkontext; ein direkter SELECT-RPC-Test wurde durch
Berechtigungen abgewiesen und nicht umgangen. Reale authentifizierte Browserabnahme offen.

Automatisierte Tests bestehen: 40 fokussierte Node-Regressionen, bestehende Ranking-
und Relay-/Snapshottests, alle neun Inline-Skripte; sechs Browserfixtures mit insgesamt
150 Assertions (Desktop/Mobil × DE/EN/FR), einschließlich des expliziten historischen
Cup-Profilwegs. Unabhängiger Codereview abgeschlossen.
Private Originale: fünf Hashes, ZIP/Manifest 1.0.13 und vier Module statisch bestätigt,
unverändert und von Git ausgeschlossen. Lokale Offline-/Retry-Simulationen sind
kein echter Bloxd-/Chrome-Persistenznachweis. Chest-Diagnose kann eine Chest erstellen.

Es wurden keine produktiven Daten, Accounts, Cups, Ratings, RLS, RPCs, Authkonfiguration,
installierten Erweiterungen oder World-Code-Module verändert. Kein GitHub-Push oder Deploy.
Keine gelöschten Konten reaktiviert. Private Schlüssel/Quellen nicht veröffentlicht.
Abschließender Secret-Scan: 151 öffentliche/vorgesehene Dateien einschließlich ZIP-
Inhalten, null Funde. Abschließender SELECT: TestAccount5-UUID und Zustand, historische
Teilnehmerzahl, Accountzahl und vier RPC-Definitionshashes unverändert.

Vercel-Projektprüfung weiterhin 403 im vorgesehenen Team; kein CLI-Fallback vorhanden.
Preview-/Production-Zielrechte und Deploymentstand sind daher nicht bestätigt.

**Eine nächste Aktion:** Nutzer gibt den Push des geprüften lokalen Feature-Branches
nach `PolyYuu/bloxdio-turnier-rangliste` frei. Kein Merge nach main und keine Freigabe
für produktive Änderungen. Anschließend Preview-Zugriff prüfen; nach verfügbarer
Preview genau die beiden UI-Checks: ImportTestB in Freunde = 0 Treffer;
TestAccount5 in Admin-Spielerliste = vorhanden.

Rollback: main auf dem Ausgangsstand belassen; Frontend-Commit später bei Bedarf
zurücknehmen. Keine Datenbank-/Account-/World-Code-Rücksetzung nötig.
Phasen B–F erst nach dem vereinbarten Checkpoint fortsetzen.
