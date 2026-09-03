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

# 1) Robust admin registration export via SECURITY DEFINER RPC.
api_marker="  async function ackMyAnimationState() { await rpc('ack_my_animation_state'); }"
api_new=api_marker+"\n  async function adminGetCupRegistrations(tournamentId) { const data=await rpc('admin_get_cup_registrations',{p_tournament_id:tournamentId}); return data||[]; }"
replace_once(api_marker,api_new,'admin registration RPC API')

old_export="getCompetitiveUpdatesAfter,getMyAnimationState,ackMyAnimationState,subscribeToSocial"
new_export="getCompetitiveUpdatesAfter,getMyAnimationState,ackMyAnimationState,adminGetCupRegistrations,subscribeToSocial"
replace_once(old_export,new_export,'export admin registration RPC')

old_loader="""  async function loadAdminRegistrationTeams(cupId){
    const [{data:regs,error:re},{data:members,error:me}]=await Promise.all([
      api.client.from('cup_registrations').select('id,status,created_by,confirmed_team_id,created_at').eq('tournament_id',cupId).order('created_at',{ascending:true}),
      api.client.from('cup_registration_members').select('registration_id,global_player_id,status,created_at').eq('tournament_id',cupId).order('created_at',{ascending:true})
    ]);
    if(re)throw re;if(me)throw me;
    const ids=[...new Set((members||[]).map(m=>m.global_player_id).filter(Boolean))];
    let directory=[];
    if(ids.length){const {data,error}=await api.client.from('player_directory').select('id,current_name').in('id',ids);if(error)throw error;directory=data||[];}
    const names=new Map(directory.map(p=>[p.id,p.current_name]));
    return (regs||[]).map(r=>({...r,members:(members||[]).filter(m=>m.registration_id===r.id).map(m=>names.get(m.global_player_id)||'Unbekannt')}));
  }"""
new_loader="""  async function loadAdminRegistrationTeams(cupId){
    const rows=await api.adminGetCupRegistrations(cupId);
    return (rows||[]).map(r=>({
      id:r.registration_id,
      status:r.status,
      created_by:r.created_by,
      created_at:r.created_at,
      members:Array.isArray(r.member_names)?r.member_names:[]
    }));
  }"""
replace_once(old_loader,new_loader,'registration loader uses RPC')

# 2) Close any Cup profile modal before routing to the global profile.
old_nav="""      const parentModal=foreign.closest('.modal-backdrop');
      if(parentModal)parentModal.hidden=true;
      const name=foreign.dataset.profilePlayer;"""
new_nav="""      const parentModal=foreign.closest('.modal-backdrop');
      if(parentModal){parentModal.hidden=true;parentModal.classList.remove('open','active');}
      ['teamDetailModal','cupPlayerDetailModal'].forEach(id=>{const m=document.getElementById(id);if(m){m.hidden=true;m.classList.remove('open','active');}});
      const name=foreign.dataset.profilePlayer;"""
replace_once(old_nav,new_nav,'hard close Cup overlays')

# 3) hidden attribute must always win over modal display rules.
style_marker='<style id="hub-offline-catchup-export-fixes">\n'
if style_marker not in s:
    raise SystemExit('catch-up style marker missing')
s=s.replace(style_marker,style_marker+'  [hidden]{display:none!important}\n',1)
print('global hidden rule ok')

# 4) If a live animation is interrupted by switching tabs, do NOT acknowledge it.
# Closing the visual and leaving the server checkpoint untouched causes the catch-up
# animation to be replayed when the user returns.
old_visibility="""  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      if(catchupBusy){catchupToken++;catchupBusy=false;closeCompetitiveOverlays();}
    }else setTimeout(runMissedCompetitiveCatchup,180);
  });"""
new_visibility="""  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      if(liveAckTimer){clearTimeout(liveAckTimer);liveAckTimer=null;}
      closeCompetitiveOverlays();
      if(catchupBusy){catchupToken++;catchupBusy=false;}
    }else setTimeout(runMissedCompetitiveCatchup,180);
  });"""
replace_once(old_visibility,new_visibility,'background tab preserves unseen state')

# Guards.
checks=[
  "admin_get_cup_registrations",
  "api.adminGetCupRegistrations(cupId)",
  "[hidden]{display:none!important}",
  "['teamDetailModal','cupPlayerDetailModal']",
  "if(liveAckTimer){clearTimeout(liveAckTimer);liveAckTimer=null;}",
]
for x in checks:
    if x not in s: raise SystemExit('missing expected patch: '+x)
if "api.client.from('cup_registration_members').select" in s:
    raise SystemExit('direct recursive registration-member query still present')

p.write_text(s)
print('all catch-up/modal/registration v2 assertions passed')
