from pathlib import Path
import re

index = Path('index.html').read_text(encoding='utf-8')
pending_path = Path('pending.html')
pending = pending_path.read_text(encoding='utf-8')

# 1) Copy the exact current HUB header from index.html.
m = re.search(r'<header class="site-header">.*?</header>', index, flags=re.S)
if not m:
    raise SystemExit('site-header not found in index.html')
header = m.group(0)

# Make nav links work from a standalone page instead of staying on pending.html.
header = re.sub(r'href="#(overview|ranking|cup|profile)"', r'href="index.html#\1"', header)

# Pending page represents Profile, not Overview.
header = header.replace('data-route="overview" class="active"', 'data-route="overview"')
header = header.replace('data-route="profile" data-i18n="nav.profile"', 'data-route="profile" class="active" data-i18n="nav.profile"')

# Account button must show pending state. Keep original friends + language controls.
header = re.sub(
    r'(<button class="ghost-button" id="loginDemoButton"[^>]*>).*?(</button>)',
    r'\1PENDING\2',
    header,
    count=1,
    flags=re.S,
)
status = '<button id="hubPendingHeaderStatus" class="hub-pending-header-status" type="button"><span class="hub-pending-mini-info">i</span><span id="accountStatusText">VERIFIZIERUNG AUSSTEHEND</span></button>'
header = header.replace('</button>\n      <button class="cta-button next-cup-cta"', '</button>\n      '+status+'\n      <button class="cta-button next-cup-cta"', 1)
# Pending users cannot register for cup from this header.
header = re.sub(r'\s*<button class="cta-button next-cup-cta".*?</button>', '', header, count=1, flags=re.S)
# Admin launcher is irrelevant on standalone pending page.
header = re.sub(r'\s*<button class="icon-only admin-launch".*?</button>', '', header, count=1, flags=re.S)

# Replace the current synthetic pending header.
pending = re.sub(r'<header class="hub-header">.*?</header>', header, pending, count=1, flags=re.S)
if '<header class="site-header">' not in pending:
    raise SystemExit('pending header replacement failed')

# Add exact original core stylesheet extracted from the same index.html style block.
if 'hub-shell-shared.css' not in pending:
    pending = pending.replace('<link rel="stylesheet" href="pending.css">', '<link rel="stylesheet" href="hub-shell-shared.css">\n  <link rel="stylesheet" href="pending.css">', 1)

pending_path.write_text(pending, encoding='utf-8')

# 2) Extract the exact stylesheet block that owns .site-header from the original HUB.
blocks = re.findall(r'<style\b[^>]*>(.*?)</style>', index, flags=re.S|re.I)
core = next((b for b in blocks if '.site-header{' in b and '.primary-nav{' in b and '.header-actions{' in b), None)
if core is None:
    raise SystemExit('core HUB style block not found')
Path('hub-shell-shared.css').write_text(core.strip()+"\n", encoding='utf-8')
print('Exact HUB header and stylesheet copied into Pending page.')
