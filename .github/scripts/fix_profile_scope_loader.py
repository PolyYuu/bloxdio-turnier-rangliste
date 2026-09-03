from pathlib import Path

p = Path('index.html')
s = p.read_text()

def replace_once(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected exactly 1 occurrence, got {n}')
    s = s.replace(old, new, 1)
    print(label, 'ok')

# Make loader visibly 25% larger via explicit transform scaling.
old_brand = "html.hub-live-booting .site-header .hub-brand{visibility:visible!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:310px!important;height:auto!important;min-width:0!important;overflow:visible!important}"
new_brand = "html.hub-live-booting .site-header .hub-brand{visibility:visible!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%) scale(1.25)!important;transform-origin:center center!important;width:248px!important;height:auto!important;min-width:0!important;overflow:visible!important}"
replace_once(old_brand, new_brand, 'loader brand scale')

old_logo = "html.hub-live-booting .site-header .hub-logo{visibility:visible!important;width:310px!important;height:auto!important;max-width:70vw!important;object-fit:contain!important;filter:drop-shadow(0 14px 34px rgba(122,66,255,.26))}"
new_logo = "html.hub-live-booting .site-header .hub-logo{visibility:visible!important;width:248px!important;height:auto!important;max-width:56vw!important;object-fit:contain!important;filter:drop-shadow(0 14px 34px rgba(122,66,255,.26))}"
replace_once(old_logo, new_logo, 'loader logo scale')

# The early account script cannot directly see renderProfileLive from the later live UI IIFE.
old_open = """async function openOwnProfile(){
    if(!live.session)return openAuth('login');
    const name=live.player?.current_name||state.ownPlayer;
    if(!name)return;
    await renderProfileLive(name);
    setPage('profile');
  }"""
new_open = """async function openOwnProfile(){
    if(!live.session)return openAuth('login');
    const name=live.player?.current_name||state.ownPlayer;
    if(!name)return;
    const renderLive=window.HubV3?.renderProfileLive;
    if(typeof renderLive==='function') await renderLive(name);
    else await syncOwnProfileToUi();
    setPage('profile');
  }"""
replace_once(old_open, new_open, 'openOwnProfile runtime bridge')

old_foreign = "Promise.resolve(renderProfileLive(name)).then(()=>setPage('profile')).catch(err=>toast(err?.message||String(err),true));"
new_foreign = "Promise.resolve(typeof window.HubV3?.renderProfileLive==='function'?window.HubV3.renderProfileLive(name):refreshForeignProfile(name)).then(()=>setPage('profile')).catch(err=>toast(err?.message||String(err),true));"
replace_once(old_foreign, new_foreign, 'profile click runtime bridge')

# Expose the later live renderer through the shared bridge. Function declarations are hoisted in this IIFE.
marker = "  async function renderProfileLive(name){"
if s.count(marker) != 1:
    raise SystemExit(f'renderProfileLive marker: expected 1, got {s.count(marker)}')
s = s.replace(marker, "  window.HubV3.renderProfileLive=(name)=>renderProfileLive(name);\n\n" + marker, 1)

# Guard against the regression that produced the Safari runtime error.
if "await renderProfileLive(name);" in s:
    raise SystemExit('direct early renderProfileLive call still present')
if "Promise.resolve(renderProfileLive(name))" in s:
    raise SystemExit('direct click renderProfileLive call still present')
if "window.HubV3.renderProfileLive=(name)=>renderProfileLive(name);" not in s:
    raise SystemExit('runtime bridge missing')
if "scale(1.25)!important" not in s:
    raise SystemExit('loader scale missing')

p.write_text(s)
print('all runtime assertions passed')
