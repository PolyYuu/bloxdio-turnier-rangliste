from pathlib import Path

p=Path('index.html')
s=p.read_text()

def replace_once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)
    print(label,'ok')

# 1) Career reset is now the single full competitive reset. Name + avatar remain.
old_buttons="""<button class=\"ghost-button\" data-v3-reset-stats>${copy('Reset career stats','Career-Stats zurücksetzen','Réinitialiser stats')}</button><button class=\"ghost-button danger\" data-v3-reset-all>${copy('Reset complete profile','Profil vollständig zurücksetzen','Réinitialiser profil')}</button>"""
new_buttons="""<button class=\"ghost-button danger\" data-v3-reset-stats>${copy('Reset career stats','Career-Stats zurücksetzen','Réinitialiser stats')}</button>"""
replace_once(old_buttons,new_buttons,'remove duplicate complete-reset button')

old_reset="""    $('[data-v3-reset-stats]',m).onclick=async()=>{if(!confirm(copy('Reset career stats to 0 from now on? Rating and placements stay unchanged.','Career-Stats ab jetzt wirklich auf 0 setzen? Rating und Placements bleiben bestehen.','Réinitialiser les stats ?')))return;try{await api.adminResetStats(gp.id,false);toast(copy('Career stats reset.','Career-Stats zurückgesetzt.','Stats réinitialisées.'));m.remove();real.adminAccounts=[];if(real.adminSection==='players')await renderAdminAccountPlayers(true);else await renderAdminLive();}catch(err){toast(err.message,true);}};
    $('[data-v3-reset-all]',m).onclick=async()=>{if(!confirm(copy('Reset the complete competitive profile? Rating becomes 1150 and placements return to 0/15.','Komplettes Competitive-Profil zurücksetzen? Rating wird 1150 und Placements gehen auf 0/15 zurück.','Réinitialiser le profil complet ?')))return;try{await api.adminResetStats(gp.id,true);toast(copy('Profile reset to Unranked 0/15.','Profil auf Unranked 0/15 zurückgesetzt.','Profil réinitialisé.'));m.remove();live.globalPlayers=await api.getGlobalPlayers();real.adminAccounts=[];if(real.adminSection==='players')await renderAdminAccountPlayers(true);else await renderAdminLive();}catch(err){toast(err.message,true);}};"""
new_reset="""    $('[data-v3-reset-stats]',m).onclick=async()=>{if(!confirm(copy('Reset the complete competitive career? Games and stats become 0, rating and peak become 1150, and placements return to 0/15. Name and avatar stay unchanged.','Competitive-Karriere wirklich vollständig zurücksetzen? Games und Stats gehen auf 0, Rating und Peak auf 1150 und Placements auf 0/15. Name und Avatar bleiben bestehen.','Réinitialiser complètement la carrière compétitive ?')))return;try{await api.adminResetStats(gp.id,true);if(live.player?.id===gp.id){live.player=await api.getMyProfile();try{live.stats=await api.getCareerStatsFor(gp.id);}catch(_){}await syncOwnProfileToUi();}toast(copy('Competitive career reset to a fresh account state.','Competitive-Karriere auf neuen Account-Zustand zurückgesetzt.','Carrière compétitive réinitialisée.'));m.remove();live.globalPlayers=await api.getGlobalPlayers();real.adminAccounts=[];if(real.adminSection==='players')await renderAdminAccountPlayers(true);else await renderAdminLive();}catch(err){toast(err.message,true);}};"""
replace_once(old_reset,new_reset,'career reset becomes full competitive reset')

# 2) If the admin edits their own player, immediately refresh the own live profile
# after saving so the placement/rank card cannot retain a stale 0/15 state.
old_save="""await api.adminSetStats(gp.id,payload);toast(copy('Player data saved. Future games continue from these values.','Spielerdaten gespeichert. Zukünftige Games rechnen von diesen Werten weiter.','Données enregistrées.'));m.remove();live.globalPlayers=await api.getGlobalPlayers();"""
new_save="""await api.adminSetStats(gp.id,payload);if(live.player?.id===gp.id){live.player=await api.getMyProfile();try{live.stats=await api.getCareerStatsFor(gp.id);}catch(_){}await syncOwnProfileToUi();}toast(copy('Player data saved. Games now also control placement/ranked status.','Spielerdaten gespeichert. Die Games steuern jetzt ebenfalls Placement-/Ranked-Status.','Données enregistrées.'));m.remove();live.globalPlayers=await api.getGlobalPlayers();"""
replace_once(old_save,new_save,'refresh own profile after admin save')

# 3) Swap only language and friends in the header. Other header controls keep their order.
css="""
<style id=\"hub-header-action-order-fix\">
  .header-actions #languagePicker{order:-2}
  .header-actions #communityButton{order:-1}
</style>
"""
if 'id="hub-header-action-order-fix"' in s:
    raise SystemExit('header order style already exists')
s=s.replace('</head>',css+'\n</head>',1)

# Guards
for needle in [
    "await api.adminResetStats(gp.id,true)",
    "Games now also control placement/ranked status.",
    ".header-actions #languagePicker{order:-2}",
    ".header-actions #communityButton{order:-1}",
]:
    if needle not in s: raise SystemExit('missing expected patch: '+needle)
if "await api.adminResetStats(gp.id,false)" in s:
    raise SystemExit('old stats-only reset still present')
if "data-v3-reset-all" in s:
    raise SystemExit('duplicate complete-reset control still present')

p.write_text(s)
print('all admin rank/header assertions passed')
