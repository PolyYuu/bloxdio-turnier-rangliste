from pathlib import Path
import re

index = Path('index.html').read_text(encoding='utf-8')
pending_path = Path('pending.html')
pending = pending_path.read_text(encoding='utf-8')

m = re.search(r'<header class="site-header">.*?</header>', index, flags=re.S)
if not m:
    raise SystemExit('site-header not found in index.html')
header = m.group(0)
header = re.sub(r'href="#(overview|ranking|cup|profile)"', r'href="index.html#\1"', header)
header = header.replace('data-route="overview" class="active"', 'data-route="overview"')
header = header.replace('data-route="profile" data-i18n="nav.profile"', 'data-route="profile" class="active" data-i18n="nav.profile"')
header = re.sub(r'(<button class="ghost-button" id="loginDemoButton"[^>]*>).*?(</button>)', r'\1PENDING\2', header, count=1, flags=re.S)
status = '<button id="hubPendingHeaderStatus" class="hub-pending-header-status" type="button"><span class="hub-pending-mini-info">i</span><span id="accountStatusText">VERIFIZIERUNG AUSSTEHEND</span></button>'
header = header.replace('</button>\n      <button class="cta-button next-cup-cta"', '</button>\n      '+status+'\n      <button class="cta-button next-cup-cta"', 1)
header = re.sub(r'\s*<button class="cta-button next-cup-cta".*?</button>', '', header, count=1, flags=re.S)
header = re.sub(r'\s*<button class="icon-only admin-launch".*?</button>', '', header, count=1, flags=re.S)

new_pending, n = re.subn(r'<header class="(?:hub-header|site-header)">.*?</header>', header, pending, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'pending header replacement failed: {n}')
pending = new_pending

# Keep exact HUB core CSS, then Pending page CSS, then a tiny high-specificity header guard.
if 'hub-shell-shared.css' not in pending:
    pending = pending.replace('<link rel="stylesheet" href="pending.css">', '<link rel="stylesheet" href="hub-shell-shared.css">\n  <link rel="stylesheet" href="pending.css">\n  <link rel="stylesheet" href="pending-header-fix.css">', 1)
elif 'pending-header-fix.css' not in pending:
    pending = pending.replace('<link rel="stylesheet" href="pending.css">', '<link rel="stylesheet" href="pending.css">\n  <link rel="stylesheet" href="pending-header-fix.css">', 1)
if 'pending-shell.js' not in pending:
    pending = pending.replace('<script src="pending.js"></script>', '<script src="pending.js"></script>\n  <script src="pending-shell.js"></script>', 1)
pending_path.write_text(pending, encoding='utf-8')

blocks = re.findall(r'<style\b[^>]*>(.*?)</style>', index, flags=re.S|re.I)
core = next((b for b in blocks if '.site-header{' in b and '.primary-nav{' in b and '.header-actions{' in b), None)
if core is None:
    raise SystemExit('core HUB style block not found')
Path('hub-shell-shared.css').write_text(core.strip()+"\n", encoding='utf-8')
print('Exact HUB header, routing and stylesheet copied into Pending page.')
