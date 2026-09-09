from pathlib import Path
import re

src = Path('index.html').read_text(encoding='utf-8')
needles = [
    'languagePicker', 'communityButton', 'loginDemoButton', 'header-actions',
    'data-route="overview"', 'data-route="ranking"', 'data-route="cup"',
    'data-route="profile"', 'location.hash', 'localStorage', 'language',
    'SURVIVAL GAMES', 'header-logo', 'hub-logo', '<header'
]

out = []
for needle in needles:
    positions = [m.start() for m in re.finditer(re.escape(needle), src, flags=re.I)]
    out.append(f'\n===== {needle} ({len(positions)}) =====\n')
    for i, pos in enumerate(positions[:8]):
        a = max(0, pos - 5000)
        b = min(len(src), pos + 10000)
        out.append(f'\n--- occurrence {i+1} @ {pos} ---\n')
        out.append(src[a:b])
        out.append('\n')

# Also extract the first full header element using a tolerant range.
h = re.search(r'<header\b', src, flags=re.I)
if h:
    close = src.find('</header>', h.start())
    if close != -1:
        out.append('\n===== FIRST FULL HEADER =====\n')
        out.append(src[h.start():close+9])

# Extract style blocks that mention key header selectors / font faces.
for m in re.finditer(r'<style\b[^>]*>(.*?)</style>', src, flags=re.I|re.S):
    block = m.group(0)
    if any(k.lower() in block.lower() for k in ['header-actions','languagepicker','main-header','site-header','@font-face','logo']):
        out.append('\n===== RELEVANT STYLE BLOCK =====\n')
        out.append(block)

Path('hub-shell-extract.txt').write_text(''.join(out), encoding='utf-8')
print('wrote', Path('hub-shell-extract.txt').stat().st_size, 'bytes')
