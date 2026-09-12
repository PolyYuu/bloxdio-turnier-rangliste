from pathlib import Path

p = Path('index.html')
s = p.read_text()

old = """      <p>${copy('Use your current Bloxd.io ingame name. No email address is required.','Nutze deinen aktuellen Bloxd.io Ingame-Namen. Eine E-Mail-Adresse ist nicht erforderlich.','Utilise ton pseudo Bloxd.io actuel. Aucune adresse e-mail n’est requise.')}</p>\n      <form id=\"v3AuthForm\">\n        <label><span>${copy('Ingame name','Ingame-Name','Pseudo en jeu')}</span><input id=\"v3Username\" autocomplete=\"username\" maxlength=\"32\" required></label>"""
new = """      <p>${isLogin?copy('Use your current Bloxd.io ingame name or your 8-digit HUB code. No email address is required.','Nutze deinen aktuellen Bloxd.io Ingame-Namen oder deinen 8-stelligen HUB-Code. Eine E-Mail-Adresse ist nicht erforderlich.','Utilise ton pseudo Bloxd.io actuel ou ton code HUB à 8 caractères. Aucune adresse e-mail n’est requise.'):copy('Use your current Bloxd.io ingame name. No email address is required.','Nutze deinen aktuellen Bloxd.io Ingame-Namen. Eine E-Mail-Adresse ist nicht erforderlich.','Utilise ton pseudo Bloxd.io actuel. Aucune adresse e-mail n’est requise.')}</p>\n      <form id=\"v3AuthForm\">\n        <label><span>${isLogin?copy('Ingame name or 8-digit HUB code','Ingame-Name oder 8-stelliger HUB-Code','Pseudo en jeu ou code HUB à 8 caractères'):copy('Ingame name','Ingame-Name','Pseudo en jeu')}</span><input id=\"v3Username\" autocomplete=\"username\" maxlength=\"32\" required></label>"""

if old not in s:
    raise SystemExit('login modal copy anchor not found')

s = s.replace(old, new, 1)
p.write_text(s)
print('Updated login modal to advertise Bloxd name or 8-digit HUB code')
