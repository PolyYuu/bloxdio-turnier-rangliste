from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

# Remove the visible self-service Bloxd name-change button entirely.
s_new,count=re.subn(r'<button class="ghost-button" id="renameButton" type="button"[^>]*>.*?</button>', '', s, count=1, flags=re.S)
if count==0 and 'id="renameButton"' in s:
    raise SystemExit('rename button found but could not be removed safely')
s=s_new

# Defensive global CSS: even if legacy markup is ever reintroduced, do not expose it.
style='''<style id="hub-no-manual-ingame-rename">\n#renameButton{display:none!important}\n</style>\n'''
if 'hub-no-manual-ingame-rename' not in s:
    marker='</head>'
    if marker not in s: raise SystemExit('head closing tag not found')
    s=s.replace(marker,style+marker,1)

p.write_text(s)
print('Manual HUB ingame-name editing removed')
