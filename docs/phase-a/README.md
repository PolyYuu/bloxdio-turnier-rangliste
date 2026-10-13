# Phase A — aktive HUB-Konten

Stand: 13.10.2026. Lokaler Branch `codex/phase-a-active-hub-accounts`, Ausgangscommit
`f5d2b79f95da78e4d820e2dc513665f9ac5452ba`. Der Remote-main wurde vor Änderungen
mit `git ls-remote origin refs/heads/main` auf denselben Commit geprüft.

## Änderung und Umfang

Die aktive Seite lädt ihre API und Live-Oberfläche aus Inline-Skripten in `index.html`.
`app.js` ist hier nicht eingebunden; dessen Rankingfunktionen werden weiterhin separat getestet.

- `HubAPI.searchHubFriendCandidates(query)` verwendet ausschließlich die vorhandene
  `search_hub_friend_candidates`-RPC mit `p_query`. Die öffentliche Directory-Suche bleibt erhalten.
- Die Freundesuche verlangt eine Session und ein Spielerprofil, begrenzt die Eingabe
  auf 1–64 Unicode-Zeichen und übergibt `%`, `_` und Anführungszeichen wörtlich.
- Die Eingabe wartet 180 ms und unterbindet den alten Demo-Handler. Der Suchbutton
  startet sofort und bricht einen ausstehenden Timer ab. Neue Eingaben, leere Felder,
  Logout und Accountwechsel verhindern das Rendern veralteter Antworten und Fehler.
- Freund-/Anfragestatus und übersetzte Beschriftungen bleiben erhalten. Auch verspätete
  Social-Antworten eines anderen Accounts werden verworfen. Auth-Ereignisse leeren
  die Ansichten synchron; eine Session-Erneuerung lädt eine bestehende Suche erneut.
- Die Standard-Adminliste lädt ausschließlich `admin_get_account_players`, einschließlich
  Online-Status und letzter Aktivität. Fehler leeren Cache, alte Zeilen und Zähler.
- Der ausdrücklich aufgerufene Pfad **Cup-Verwaltung → Teilnehmer → Verwalten →
  HUB-Account erstellen** bleibt erhalten. Das Profilfenster prüft Session und Adminstatus
  auch nach beiden Leseabfragen. Es gibt keinen neuen Lookup für verwaiste Profile ohne Cup.

Keine Datenbereinigung, SQL-Migration, RPC-/RLS-/Auth-Änderung, Ratingänderung,
Extensionänderung oder World-Code-Installation ist Teil dieses Patches.

## Backend, ausschließlich lesend geprüft

Die Verbindung `sg-supabase-ro` gehört gemäß Projektkonfiguration und verifiziertem
Datensatzbestand zu `nxzrgbpaxukgjyzwupjp`. Alle ausgeführten SQL-Abfragen waren SELECTs.

| RPC | Verifizierter Vertrag |
| --- | --- |
| `search_hub_friend_candidates(p_query text)` | `id`, `current_name`, `avatar_pixels`, `is_ranked`, `placement_games`, `rating`; STABLE, SECURITY DEFINER, `search_path=pg_catalog`; echte eigene Anmeldung, Ziel mit Auth-Account, nicht gelöscht, nicht selbst, wörtliche Teilzeichenfolge, maximal zwölf Treffer; Unranked-Rating NULL |
| `admin_get_account_players()` | Zusätzlich Peak, Account-Erstellung, `last_seen`, `is_online`, `open_tabs`; STABLE, SECURITY DEFINER; interner Admincheck und aktive Accountprofile |
| `send_friend_request(p_receiver uuid)` | Login-, Self-, aktives Zielkonto-, bestehende Freundschaft- und Pending-Checks; keine Aufrufe im Live-Projekt durchgeführt |
| `admin_get_global_players()` | Admincheck und `deleted_at IS NULL`; ausschließlich für gezielte bestehende Verwaltung erhalten |

Beide Lese-RPCs und `send_friend_request` haben **kein EXECUTE für anon** und EXECUTE
für authenticated. `global_players`, `friend_requests`, `friendships` und
`player_online_sessions` haben RLS. Die acht in der Übergabe genannten privaten
Tabellen haben kein RLS, aber weiterhin **keine direkten SELECT-Rechte** für anon oder
authenticated; anon hat auch kein USAGE auf private. Die tatsächlichen Social-Policies
begrenzen Lesezugriff auf die beteiligten Spieler bzw. Admins.

`player_directory` bleibt die breite öffentliche Projektion für Cups/Rankings, maskiert
Unranked-Rating/Peak und filtert gelöschte Profile. Sie wurde nicht verändert.

Der MCP-Diagnosekontext hat keine `auth.uid()`. Ein SELECT-Aufruf der Freund-RPC
wurde mit `permission denied for function search_hub_friend_candidates` abgewiesen.
Dieser Schutz wurde nicht umgangen: Signaturen/Implementierung/Berechtigungen wurden
über Systemkataloge gelesen; authentifizierte Browseraufrufe sind lokal gemockt und
stehen bei der Preview-Abnahme noch aus.

| Zustand | Soll laut Übergabe | Live-SELECT beobachtet |
| --- | --- | --- |
| Auth-/HUB-Accounts | 22 / 22 | 22 / 22 |
| Aktive Accountprofile | 22 | 22 |
| Ausstehende Registrierungen / Identitätslinks | 0 / 12 | 0 / 12 |
| ImportTestB | Historisches Profil ohne Account | Vorhanden, nicht gelöscht, kein aktives Konto |
| TestAccount5 | Ein Login, kein Bloxd-Link | 1 / 0 |
| TestAccount5 Rating / Peak | 1621 / 1635 | 1621 / 1635 |
| TestAccount5 Rating-History / Cup-Einträge | 16 / 2 | 16 / 2 |
| Historischer Cup 22.08. | 18 Teilnehmer | 18 |

Die Zählwerte werden nicht im Frontend festgeschrieben. Es wurden keine synthetischen
Datensätze in der Produktion angelegt und keine gelöschten Konten reaktiviert.
Eine abschließende SELECT-Kontrolle bestätigte dieselbe TestAccount5-UUID, dieselben
Konten-/History-/Cup-Zählwerte und unveränderte Definitionshashes der vier RPCs.

RPC-Definitionshashes (MD5, reine Änderungsvergleichswerte):

```text
search_hub_friend_candidates 01843ef5027e280e65484af371146a61
admin_get_account_players   7c6ee7620238d680f8bbf5609938242e
send_friend_request         c86c33bf7400dcc0256a7f4f1a5d2238
admin_get_global_players    8d36328d6399fa0e4f13577f44943d37
```

Die Advisor-Ergebnisse wurden gelesen, nicht pauschal behoben. Offene Phase-F-Themen:
17 Tabellen mit RLS ohne Policy, die bewusste Security-Definer-Directory-View,
eine anon-aufrufbare und 71 authenticated-aufrufbare Security-Definer-Funktionen sowie
deaktivierter Schutz vor kompromittierten Passwörtern. Ob eine Funktion beabsichtigt
öffentlich ist, muss einzeln geprüft werden. Referenzen:
[RLS ohne Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[View](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view),
[anon RPC](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated RPC](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[Passwortschutz](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Automatisierte Prüfung

`tests/phase-a-accounts.test.cjs` führt die tatsächliche API-Factory, Renderer und
Handler aus `index.html` in isolierten JavaScript-VMs aus. Es verwendet ausschließlich
synthetische Sessions, Profile und RPC-Antworten. Die Tests prüfen unter anderem:

1. Dedizierte Kandidaten-RPC statt Directory-Zugriff.
2. Aktive fremde Konten und TestAccount5 als zulässige Treffer.
3. ImportTestB und gelöschte Profile ohne Treffer.
4. Self-Matches ohne Add-Button.
5. Fehlende Anmeldung ohne RPC-Aufruf.
6. Leere Eingabe und überlange Unicode-Eingabe.
7. Wörtliche Sonderzeichen und Trimming.
8. NULL-Antworten, Berechtigungsfehler und HTML-Escaping.
9. Freund- und Pending-Status.
10. Veraltete Erfolge und Fehler nach neuer Suche, Clear, Logout und Accountwechsel.
11. Deterministisches Debounce und Abbruch ausstehender Timer.
12. Accountliste ohne Globalprofile-Merge, Online-Zähler und Suchcache.
13. Adminrechte, fehlende Session und verspätete Adminantworten.
14. Synchrones Leeren bei Authwechsel und verspätete Social-Antworten.
15. Erhaltene breite Directory-Suche für historische Profile.

Die abschließende Suite besteht aus **40 bestandenen Tests**. Dieselben Tests gegen
den unveränderten Ausgangsstand ergeben 35 Fehler und fünf bestandene Kontrollen.
Die Fehler belegen insbesondere die fehlende API, die zu breite Suche, den Admin-Merge,
ungeschützte verspätete Antworten und fehlende Auth-Invalidierung.

`tests/phase-a-browser.py` prüft tatsächliche Funktionen und Eingabe-Handler in Headless
Chrome mit einem separaten temporären Profil. Der originale Demo-Bubble-Handler ist
ebenfalls registriert. Der gezielte Cup-Verwaltungsweg öffnet für ein synthetisches
Importprofil weiterhin das Profilfenster mit Account-Erstellungsbutton, ohne einen
Account anzulegen. Alle Seiten-Netzwerkaufrufe werden blockiert, Service Worker und
Erweiterungen werden nicht genutzt. **Sechs Fixtures mit jeweils 25 Assertions**
bestanden: 1280 px und 390 px, jeweils DE/EN/FR. Der maschinenlesbare Bericht liegt
in `browser-results.json`; die Node-Ergebnisse liegen in `node-results.json`.
Das ist ein fokussierter DOM-/Handler-Test, keine vollständige
Website-Abnahme oder Prüfung eines realen Logins, Bloxd-Spiels oder installierten Relays.

Zusätzlich bestanden die vorhandenen Rankingtests, Relay-Parser-/Snapshottests und
die Syntaxprüfung aller neun Inline-Skripte. Ein unabhängiger Review fand nach der
Session-Refresh-Korrektur keine blockierenden Befunde.

Reproduzieren mit einem vorhandenen Node 22+ und Python mit Playwright 1.55.0:

```sh
node --test ranking.test.js relay-worker/test/event-parser.test.js tests/phase-a-accounts.test.cjs
CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' python3 tests/phase-a-browser.py --output docs/phase-a/browser-results.json
```

Auf diesem Mac wurde das vorhandene Node v24.14.1 aus Dreamweaver verwendet;
Playwright wurde ausschließlich unter `/private/tmp/hub-phase-a-venv` installiert.
Chrome konnte erst außerhalb der Prozess-Sandbox mit dem isolierten Profil gestartet
werden. Es wurden keine Pakete oder Browserprofile des Nutzers verändert.

## Private Originale und spätere Phasen

Alle fünf Upload-Hashes stimmen; ZIP-CRC, Manifest 1.0.13 und alle 13 extrahierten
Dateien stimmen mit der Original-ZIP überein. Vier World-Module und acht Extension-JS-
Dateien bestehen die Syntaxprüfung. Die aktuelle LiveSync-Version ist 3.6.7;
der alte zusammengesetzte SG_BUILD-String in index.js ersetzt diesen Marker nicht.

Explorative lokale VM-Simulationen der Originale bestätigten getrennte Lobby-,
Block- und Chest-Speicherung sowie Queue-Recovery, Retry und Duplikatbehandlung.
Diese Ergebnisse belegen ausschließlich Mock-Verhalten. **Echte Chest-Persistenz
und Chrome-Service-Worker-Neustart bleiben unbewiesen.**

`lsLegacyReadChestQueue()` und `lsLegacyStoreTestRead()` können über
`lsLegacyEnsureChest()` eine fehlende Chest mit `api.setBlock` erstellen.
Der spätere echte Diagnose-Test benötigt deshalb Freigabe und eine isolierte Testwelt.
Keine private Originaldatei wurde verändert, installiert oder zur Veröffentlichung vorbereitet.

## Checkpoint 1, Risiko und Rückweg

Der Patch benötigt keine Datenbankmigration. Das verbleibende Risiko ist die Integration
mit einem echten angemeldeten Browser und den produktiven RPC-Berechtigungen.
Der lokale Secret-Scan berücksichtigt beide echten privaten Signingkeys, bekannte
Secret-Tokenmuster, Service-Role-JWTs und ZIP-Inhalte. Keine Werte werden ausgegeben;
private Quellen und Übergabe bleiben per Git ausgeschlossen. Abschließendes Ergebnis:
**151 öffentliche/vorgesehene Dateien einschließlich ZIP-Inhalten, null Funde.**

Ein lesender Zugriff auf das vorgesehene Vercel-Projekt
`prj_8AiLl1IeEP6mcoT1wEJqYQCQIrOj`, Team `team_6O8pRT9Gz2dU1hHUa3UkSh9c`, wurde
mit 403 für den Scope `sonyuuyt-gmailcoms-projects` abgewiesen. Der Vercel-CLI-Fallback
ist lokal nicht installiert. Daher wurden weder aktuelle Deploymentbereitschaft noch
Preview-Zielrechte als bestätigt markiert. Kein Push/Preview/Production-Deploy erfolgte.

Nächste Aktion: **Freigabe des GitHub-Pushs ausschließlich für den geprüften Feature-Branch.**
Remote: `PolyYuu/bloxdio-turnier-rangliste`; kein Merge nach main und keine Produktionsfreigabe.
Vor einem zusätzlichen Preview-Deploy müssen die richtigen Vercel-Zielrechte bestätigt sein.
Nach Bereitstellung einer Preview sind genau zwei Nutzerchecks vorgesehen:

1. Angemeldet in Freunde nach `ImportTestB` suchen: **0 Treffer**.
2. Als Admin in der Standard-Spielerliste nach `TestAccount5` suchen: **vorhanden**.

Rollback: Feature-Branch nicht veröffentlichen bzw. main auf dem verifizierten
Ausgangsstand belassen. Ein späteres Zurücknehmen des Frontend-Commits benötigt
keine Datenbank-, Account-, Rating- oder World-Code-Rücksetzung. Phasen B–F folgen
nach dem vereinbarten Checkpoint; die Originalprüfung ist bereits vorbereitet.
