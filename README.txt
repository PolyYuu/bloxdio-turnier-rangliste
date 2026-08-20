# Bloxd.io Turnier-Rangliste – Live-Version

Öffentliche Live-Rangliste für das Bloxd.io Survival-Games-Turnier:
https://polyyuu.github.io/bloxdio-turnier-rangliste/

## Technik

Die Anwendung ist eine statische Vanilla-HTML/CSS/JavaScript-Seite für GitHub Pages. Supabase ist die alleinige Datenquelle für Turniere, Teams, Spieler und Events. Änderungen werden per Supabase Realtime automatisch an bereits geöffnete Ranglisten übertragen; es gibt keine lokale Speicherung von Turnierdaten.

Der Admin-Bereich ist über `index.html#admin` beziehungsweise `admin.html` erreichbar. Die Anmeldung verwendet Supabase Auth mit E-Mail und Passwort. Nach der Anmeldung wird die Berechtigung zusätzlich serverseitig mit `public.is_admin()` geprüft. Es gibt kein öffentliches Signup.

## Punktesystem und Limits

- Kill: **+1 Punkt**
- Deathmatch: **+3 Punkte**
- Sieg: **+2 Punkte**
- Kills haben **kein Limit**.
- Beliebig viele Spieler dürfen pro Runde das Deathmatch erreichen.
- Pro Runde ist höchstens ein Spieler mit einem Sieg erlaubt.
- Pro Spieler und Runde sind maximal ein Deathmatch-Ergebnis und ein Sieg erlaubt.
- Ein Sieg erzeugt nicht automatisch ein Deathmatch-Ergebnis.

Der Textimport schreibt atomar über `replace_round_results`; komplette Runden werden atomar über `delete_tournament_round` gelöscht.

## Sicherheit

Im Browser steht absichtlich ausschließlich die öffentliche Supabase Project URL mit dem **Publishable Key**. Ein Publishable Key ist für Browser-Anwendungen vorgesehen und kein Geheimnis. Niemals einen `service_role` Key oder ein Admin-Passwort in dieses Repository oder in Frontend-Code eintragen. Schreibrechte werden ausschließlich durch Supabase Auth, RLS und `public.is_admin()` vergeben.

## Lokale Nutzung

Da keine Build-Schritte nötig sind, kann das Verzeichnis mit einem statischen Webserver geöffnet werden, zum Beispiel:

```sh
python3 -m http.server 8000
```
