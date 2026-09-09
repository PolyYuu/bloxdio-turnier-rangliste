from pathlib import Path
import re

src = Path('index.html').read_text(encoding='utf-8')

def write(name, text):
    Path(name).write_text(text, encoding='utf-8')
    print(name, len(text))

# Exact first header markup.
h = re.search(r'<header\b', src, flags=re.I)
header = ''
if h:
    close = src.find('</header>', h.start())
    if close != -1:
        header = src[h.start():close+9]
write('hub-header-exact.html', header)

# Compact windows around selectors / language / route logic.
def windows(needles, radius=3500, limit=4):
    chunks=[]
    seen=[]
    for needle in needles:
        for m in list(re.finditer(re.escape(needle), src, flags=re.I))[:limit]:
            a=max(0,m.start()-radius); b=min(len(src),m.start()+radius)
            # avoid near-duplicate windows
            if any(abs(a-x)<radius for x in seen):
                continue
            seen.append(a)
            chunks.append(f'\n===== {needle} @ {m.start()} =====\n{src[a:b]}\n')
    return ''.join(chunks)

write('hub-header-css-snippets.txt', windows([
    '.header-actions', '#languagePicker', '.language-picker', '.primary-nav', '.logo', '.hub-logo', '@font-face'
], radius=2500, limit=3))
write('hub-language-router-snippets.txt', windows([
    'languagePicker', 'hub_language', 'hubLang', 'data-route', 'location.hash', 'showPage(', 'setLanguage('
], radius=3000, limit=5))
write('hub-logo-font-snippets.txt', windows([
    'SURVIVAL GAMES', 'logo', 'Montserrat', 'font-family', 'font-face'
], radius=2200, limit=4))
