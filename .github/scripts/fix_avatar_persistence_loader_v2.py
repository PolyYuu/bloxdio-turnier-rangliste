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

# The previous patch accidentally kept the effective loader size at 310px:
# 248px * 1.25 = 310px. Make it a real +25% from 310px -> ~388px.
old_brand = "html.hub-live-booting .site-header .hub-brand{visibility:visible!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%) scale(1.25)!important;transform-origin:center center!important;width:248px!important;height:auto!important;min-width:0!important;overflow:visible!important}"
new_brand = "html.hub-live-booting .site-header .hub-brand{visibility:visible!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:388px!important;height:auto!important;min-width:0!important;overflow:visible!important}"
replace_once(old_brand, new_brand, 'real loader brand size')

old_logo = "html.hub-live-booting .site-header .hub-logo{visibility:visible!important;width:248px!important;height:auto!important;max-width:56vw!important;object-fit:contain!important;filter:drop-shadow(0 14px 34px rgba(122,66,255,.26))}"
new_logo = "html.hub-live-booting .site-header .hub-logo{visibility:visible!important;width:388px!important;height:auto!important;max-width:80vw!important;object-fit:contain!important;filter:drop-shadow(0 14px 34px rgba(122,66,255,.26))}"
replace_once(old_logo, new_logo, 'real loader logo size')

# The real editor renders .avatar-pixel buttons. The live Supabase saver was
# looking for .pixel-cell, so it always read 0 pixels and silently skipped DB save.
old_pixels = "return $$('#avatarPixelGrid .pixel-cell').map(cell=>{"
new_pixels = "return $$('#avatarPixelGrid .avatar-pixel, #avatarPixelGrid .pixel-cell').map(cell=>{"
replace_once(old_pixels, new_pixels, 'avatar editor pixel selector')

# Verify persistence by re-reading the profile from Supabase after save.
old_save = """  $('#avatarSaveButton')?.addEventListener('click',async()=>{
    if(!live.session||!live.player||state.profilePlayer!==state.ownPlayer)return;
    try{const pixels=pixelsFromEditor();if(pixels.length===256){await api.saveAvatar(pixels);live.player.avatar_pixels=pixels;const ownGp=(live.globalPlayers||[]).find(p=>p.id===live.player.id);if(ownGp)ownGp.avatar_pixels=pixels;cacheAvatar(live.player);const av=$('#profileAvatar');if(av)av.src=pixelDataUrl(pixels);toast(copy('Avatar saved.','Avatar gespeichert.','Avatar enregistré.'));}}
    catch(err){toast(err.message||String(err),true);}
  });"""
new_save = """  $('#avatarSaveButton')?.addEventListener('click',async()=>{
    if(!live.session||!live.player||state.profilePlayer!==state.ownPlayer)return;
    try{
      const pixels=pixelsFromEditor();
      if(pixels.length!==256)throw new Error(copy('Avatar editor did not return 256 pixels.','Der Avatar-Editor hat nicht 256 Pixel geliefert.','L’éditeur avatar n’a pas renvoyé 256 pixels.'));
      await api.saveAvatar(pixels);
      const refreshed=await api.getMyProfile();
      if(!refreshed||!Array.isArray(refreshed.avatar_pixels)||refreshed.avatar_pixels.length!==256)throw new Error(copy('Avatar was not persisted. Please try again.','Der Avatar wurde nicht dauerhaft gespeichert. Bitte erneut versuchen.','L’avatar n’a pas été enregistré durablement.'));
      live.player=refreshed;
      const ownGp=(live.globalPlayers||[]).find(p=>p.id===live.player.id);
      if(ownGp)ownGp.avatar_pixels=[...refreshed.avatar_pixels];
      cacheAvatar(refreshed);
      const av=$('#profileAvatar');if(av)av.src=pixelDataUrl(refreshed.avatar_pixels);
      toast(copy('Avatar saved.','Avatar gespeichert.','Avatar enregistré.'));
    }catch(err){toast(err.message||String(err),true);}
  });"""
replace_once(old_save, new_save, 'verified avatar persistence')

# Regression guards.
if "#avatarPixelGrid .pixel-cell').map" in s:
    raise SystemExit('old avatar-only selector still present')
if "width:388px!important" not in s:
    raise SystemExit('388px loader width missing')
if "renderHistoryGraph=renderHistoryGraphV4;" not in s:
    raise SystemExit('V4 rating graph hook missing')
if "game_number||idx+1)>=16" not in s:
    raise SystemExit('rating graph Game 16 gate missing')
if "window.HubV3.renderProfileLive=(name)=>renderProfileLive(name);" not in s:
    raise SystemExit('profile runtime bridge missing')

p.write_text(s)
print('all avatar/loader/graph assertions passed')
