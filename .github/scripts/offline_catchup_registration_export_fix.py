from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

def replace_once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)
    print(label,'ok')

def sub_once(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    s=s2
    print(label,'ok')

# ---------------------------------------------------------------------------
# 1) HubAPI: persistent seen-state RPCs.
# ---------------------------------------------------------------------------
api_marker="  async function getCompetitiveUpdatesAfter(id) { const {data,error}=await client.from('competitive_update_notifications').select('*').gt('id',Number(id||0)).order('id',{ascending:true}).limit(50);if(error)throw error;return data||[]; }"
api_add=api_marker+"\n  async function getMyAnimationState() { const data=await rpc('get_my_animation_state'); return Array.isArray(data)?(data[0]||null):data; }\n  async function ackMyAnimationState() { await rpc('ack_my_animation_state'); }"
replace_once(api_marker,api_add,'animation-state API')

old_export="heartbeatPresence,clearPresence,adminGetOnlinePlayers,subscribeToRatingEvents,subscribeToPlacementEvents,subscribeToCompetitiveUpdates,getLatestCompetitiveUpdateId,getCompetitiveUpdatesAfter,subscribeToSocial,subscribeToCup,subscribeToStats };"
new_export="heartbeatPresence,clearPresence,adminGetOnlinePlayers,subscribeToRatingEvents,subscribeToPlacementEvents,subscribeToCompetitiveUpdates,getLatestCompetitiveUpdateId,getCompetitiveUpdatesAfter,getMyAnimationState,ackMyAnimationState,subscribeToSocial,subscribeToCup,subscribeToStats };"
replace_once(old_export,new_export,'export animation-state API')

# ---------------------------------------------------------------------------
# 2) Clicking a player inside any Cup modal should close that modal first.
# ---------------------------------------------------------------------------
old_foreign="""    const foreign=e.target.closest('[data-profile-player]');
    if(foreign){
      e.preventDefault();e.stopImmediatePropagation();
      if(!live.session){openAuth('login');return;}
      const name=foreign.dataset.profilePlayer;
      state.profilePlayer=name;
      Promise.resolve(typeof window.HubV3?.renderProfileLive==='function'?window.HubV3.renderProfileLive(name):refreshForeignProfile(name)).then(()=>setPage('profile')).catch(err=>toast(err?.message||String(err),true));
    }"""
new_foreign="""    const foreign=e.target.closest('[data-profile-player]');
    if(foreign){
      e.preventDefault();e.stopImmediatePropagation();
      if(!live.session){openAuth('login');return;}
      const parentModal=foreign.closest('.modal-backdrop');
      if(parentModal)parentModal.hidden=true;
      const name=foreign.dataset.profilePlayer;
      state.profilePlayer=name;
      Promise.resolve(typeof window.HubV3?.renderProfileLive==='function'?window.HubV3.renderProfileLive(name):refreshForeignProfile(name)).then(()=>setPage('profile')).catch(err=>toast(err?.message||String(err),true));
    }"""
replace_once(old_foreign,new_foreign,'close Cup modal before global profile')

# ---------------------------------------------------------------------------
# 3) Replace the current live-notification pipeline with a persistent catch-up
#    system. Finalize is the only animated event. Edits/deletes are silent.
# ---------------------------------------------------------------------------
new_pipeline=r'''  api.client.auth.onAuthStateChange(()=>setTimeout(async()=>{
    competitiveCursor=null;seenCompetitiveUpdates.clear();catchupToken++;catchupBusy=false;
    await restoreAuth(false);
    try{if(live.session)competitiveCursor=await api.getLatestCompetitiveUpdateId();}catch(_){}
    setTimeout(runMissedCompetitiveCatchup,250);
  },0));

  let competitiveCursor=null,competitivePollBusy=false,silentProfilePollBusy=false;
  let catchupBusy=false,catchupToken=0,liveAckTimer=null;
  const seenCompetitiveUpdates=new Set();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function ackCompetitiveState(){
    try{if(live.session&&live.player)await api.ackMyAnimationState();}catch(e){console.warn('Could not acknowledge competitive animation state',e);}
  }
  function scheduleCompetitiveAck(ms=7600){
    clearTimeout(liveAckTimer);
    liveAckTimer=setTimeout(()=>{liveAckTimer=null;ackCompetitiveState();},ms);
  }
  function closeCompetitiveOverlays(){
    const p=document.querySelector('#placementModal'),r=document.querySelector('#roundUpdateModal');
    if(p)p.hidden=true;if(r)r.hidden=true;
  }

  function ratingBand(r){
    const x=Number(r);
    if(x>=2000)return {low:2000,high:3000,key:'grandmaster'};
    if(x>=1750)return {low:1750,high:2000,key:'master'};
    if(x>=1500)return {low:1500,high:1750,key:'diamond'};
    if(x>=1250)return {low:1250,high:1500,key:'emerald'};
    if(x>=1000)return {low:1000,high:1250,key:'gold'};
    if(x>=750)return {low:750,high:1000,key:'iron'};
    return {low:0,high:750,key:'wood'};
  }
  function buildRankJourney(before,after){
    before=Number(before);after=Number(after);
    if(!Number.isFinite(before)||!Number.isFinite(after))return [];
    if(Math.abs(after-before)<.001)return [{before,after,rankBefore:ratingBand(before).key,rankAfter:ratingBand(after).key}];
    const out=[];let v=before;const up=after>before;let guard=0;
    while((up?v<after-.001:v>after+.001)&&guard++<12){
      const b=ratingBand(v);
      if(up){
        if(after<b.high){out.push({before:v,after,rankBefore:b.key,rankAfter:b.key});break;}
        const edge=Math.max(v, b.high-.01);
        if(edge>v+.001)out.push({before:v,after:edge,rankBefore:b.key,rankAfter:b.key});
        v=b.high;
        if(Math.abs(after-v)<.001){const nb=ratingBand(v);out.push({before:v,after:v,rankBefore:nb.key,rankAfter:nb.key});break;}
      }else{
        if(after>=b.low){out.push({before:v,after,rankBefore:b.key,rankAfter:b.key});break;}
        const edge=Math.min(v,b.low+.01);
        if(edge<v-.001)out.push({before:v,after:edge,rankBefore:b.key,rankAfter:b.key});
        v=Math.max(0,b.low-.01);
        if(Math.abs(after-b.low)<.001){const nb=ratingBand(after);out.push({before:after,after,rankBefore:nb.key,rankAfter:nb.key});break;}
      }
    }
    return out.length?out:[{before,after,rankBefore:ratingBand(before).key,rankAfter:ratingBand(after).key}];
  }

  async function runMissedCompetitiveCatchup(){
    if(catchupBusy||document.hidden||!live.session||!live.player)return;
    let st;
    try{st=await api.getMyAnimationState();}catch(e){console.warn('Catch-up state failed',e);return;}
    if(!st)return;
    const curGames=Number(st.current_finalized_games||0),seenGames=Number(st.seen_finalized_games||0);
    const curPlacement=Number(st.current_placement_games||0),seenPlacement=Number(st.seen_placement_games||0);
    const curRanked=!!st.current_is_ranked,seenRanked=!!st.seen_is_ranked;

    // Rating edits, round deletes and Cup deletes must never create an animation.
    if(curGames<=seenGames){
      const drift=curGames!==seenGames||curPlacement!==seenPlacement||curRanked!==seenRanked||
        (curRanked&&seenRanked&&Math.abs(Number(st.current_rating||0)-Number(st.seen_rating||0))>.001);
      if(drift)await ackCompetitiveState();
      return;
    }
    if(live.player.ranking_experience_enabled===false){await ackCompetitiveState();return;}

    catchupBusy=true;const token=++catchupToken;
    try{
      if(!seenRanked){
        const last=Math.min(15,curPlacement);
        if(last>seenPlacement){
          for(let done=seenPlacement+1;done<=last;done++){
            if(token!==catchupToken||document.hidden)return;
            const completed=done===15&&curRanked;
            if(typeof window.simulatePlacementRatingEvent==='function'){
              window.simulatePlacementRatingEvent({
                done,completed,
                rating:completed?Number(st.current_rating):null,
                rankAfter:completed&&Number.isFinite(Number(st.current_rating))?ratingBand(Number(st.current_rating)).key:null,
                catchup:true
              });
            }
            await sleep(completed?6200:3400);
          }
        }else if(curRanked&&typeof window.simulatePlacementRatingEvent==='function'){
          window.simulatePlacementRatingEvent({done:15,completed:true,rating:Number(st.current_rating),rankAfter:ratingBand(Number(st.current_rating)).key,catchup:true});
          await sleep(6200);
        }
        // Deliberately stop at the CURRENT rank after placements. Do not replay intermediate ranks.
      }else if(curRanked){
        const before=Number(st.seen_rating),after=Number(st.current_rating);
        const journey=buildRankJourney(before,after);
        for(const seg of journey){
          if(token!==catchupToken||document.hidden)return;
          if(typeof window.simulateRealtimeRatingEvent==='function'){
            window.simulateRealtimeRatingEvent({...seg,catchup:true});
          }
          await sleep(4100);
        }
      }else{
        await ackCompetitiveState();return;
      }
      if(token===catchupToken)await ackCompetitiveState();
    }finally{
      if(token===catchupToken)catchupBusy=false;
    }
  }

  async function applyCompetitiveUpdate(evt){
    if(!live.player||evt.global_player_id!==live.player.id)return;
    const id=Number(evt.id||0);if(id&&seenCompetitiveUpdates.has(id))return;if(id){seenCompetitiveUpdates.add(id);competitiveCursor=Math.max(Number(competitiveCursor||0),id);}
    try{
      const refreshed=await api.getMyProfile();if(refreshed)live.player=refreshed;
      try{live.stats=await api.getCareerStatsFor(live.player.id);}catch(_){}
      await syncOwnProfileToUi();

      // A hidden/background tab counts as not seen: update data silently, but leave the checkpoint untouched.
      if(!document.hidden){
        if(live.player.ranking_experience_enabled!==false){
          if(evt.placement_game_number!==null&&evt.placement_game_number!==undefined){
            const done=Math.max(1,Math.min(15,Number(evt.placement_game_number)));
            if(typeof window.simulatePlacementRatingEvent==='function')window.simulatePlacementRatingEvent({done,completed:!!evt.became_ranked,rating:evt.rating_after??live.player.rating,rankAfter:evt.rank_after,gameNumber:Number(evt.game_number||done)});
            scheduleCompetitiveAck(evt.became_ranked?6800:4800);
          }else if(typeof window.simulateRealtimeRatingEvent==='function'){
            window.simulateRealtimeRatingEvent({before:Number(evt.rating_before),after:Number(evt.rating_after),delta:Number(evt.final_delta),rankBefore:evt.rank_before,rankAfter:evt.rank_after,gameNumber:Number(evt.game_number||0)});
            scheduleCompetitiveAck(7600);
          }
        }else await ackCompetitiveState();
      }
      document.dispatchEvent(new CustomEvent('hub:rating-updated',{detail:{event:evt,player:live.player,finalize:true}}));
    }catch(e){console.error('Competitive live update failed',e);}
  }

  api.subscribeToCompetitiveUpdates(evt=>{if(live.player&&evt.global_player_id===live.player.id)applyCompetitiveUpdate(evt);});

  setInterval(async()=>{
    if(competitivePollBusy||document.hidden||!live.session||!live.player)return;
    competitivePollBusy=true;
    try{
      if(competitiveCursor===null){competitiveCursor=await api.getLatestCompetitiveUpdateId();return;}
      const rows=await api.getCompetitiveUpdatesAfter(competitiveCursor);
      for(const evt of rows){competitiveCursor=Math.max(Number(competitiveCursor||0),Number(evt.id||0));await applyCompetitiveUpdate(evt);}
    }catch(e){console.warn('Competitive notification fallback failed',e);}
    finally{competitivePollBusy=false;}
  },2000);

  setInterval(async()=>{
    if(silentProfilePollBusy||document.hidden||!live.session||!live.player)return;
    silentProfilePollBusy=true;
    try{
      const before=live.player,refreshed=await api.getMyProfile();if(!refreshed)return;
      const changed=Number(before.placement_games||0)!==Number(refreshed.placement_games||0)||!!before.is_ranked!==!!refreshed.is_ranked||Math.abs(Number(before.rating||0)-Number(refreshed.rating||0))>.001;
      if(changed){live.player=refreshed;try{live.stats=await api.getCareerStatsFor(live.player.id);}catch(_){}await syncOwnProfileToUi();document.dispatchEvent(new CustomEvent('hub:rating-updated',{detail:{player:live.player,silent:true}}));setTimeout(runMissedCompetitiveCatchup,80);}
    }catch(e){console.warn('Silent live profile refresh failed',e);}finally{silentProfilePollBusy=false;}
  },2000);

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      if(catchupBusy){catchupToken++;catchupBusy=false;closeCompetitiveOverlays();}
    }else setTimeout(runMissedCompetitiveCatchup,180);
  });
  window.addEventListener('focus',()=>setTimeout(runMissedCompetitiveCatchup,180));

  document.addEventListener('click',e=>{
    const closes=e.target.closest('#placementModal [data-close-modal],#roundUpdateModal [data-close-modal]')||
      (e.target?.id==='placementModal'?e.target:null)||(e.target?.id==='roundUpdateModal'?e.target:null);
    if(!closes)return;
    if(catchupBusy){catchupToken++;catchupBusy=false;}
    if(liveAckTimer){clearTimeout(liveAckTimer);liveAckTimer=null;}
    ackCompetitiveState();
  },true);

  restoreAuth(false).then(async()=>{
    updateRegistrationButton();
    try{if(live.session)competitiveCursor=await api.getLatestCompetitiveUpdateId();}catch(_){}
    setTimeout(runMissedCompetitiveCatchup,300);
  });'''

sub_once(r"  api\.client\.auth\.onAuthStateChange\(.*?\n  restoreAuth\(false\)\.then\(async\(\)=>\{updateRegistrationButton\(\);try\{if\(live\.session\)competitiveCursor=await api\.getLatestCompetitiveUpdateId\(\);\}catch\(_\)\{\}\}\);",new_pipeline,'persistent offline catch-up pipeline',re.S)

# ---------------------------------------------------------------------------
# 4) Admin registration TXT export. The registration list remains informational.
# ---------------------------------------------------------------------------
old_reg="""  async function renderAdminRegistrations(cup){const wrap=$('#adminRegistrationRows');if(!wrap)return;try{const {data,error}=await api.client.from('cup_registrations').select('id,status,created_by,confirmed_team_id,created_at').eq('tournament_id',cup.id).order('created_at',{ascending:false});if(error)throw error;wrap.innerHTML=(data||[]).length?(data||[]).map(r=>`<div class=\"admin-registration-row\"><strong>${esc(r.id.slice(0,8))}</strong><span class=\"${r.status==='confirmed'?'status-confirmed':'status-pending'}\">${esc(r.status)}</span><span>${esc(gpById(r.created_by)?.current_name||'—')}</span><span>—</span></div>`).join(''):`<p class=\"v3-empty\">${copy('No registrations.','Keine Anmeldungen.','Aucune inscription.')}</p>`;}catch(e){wrap.innerHTML=`<p class=\"v3-empty\">${esc(e.message)}</p>`;}}"""
new_reg=r'''  async function loadAdminRegistrationTeams(cupId){
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
  }
  async function downloadAdminRegistrations(cup){
    try{
      const teams=(await loadAdminRegistrationTeams(cup.id)).filter(r=>!['cancelled','declined','rejected'].includes(String(r.status).toLowerCase()));
      if(!teams.length){toast(copy('No registrations to export.','Keine Registrierungen zum Exportieren.','Aucune inscription à exporter.'));return;}
      const text=teams.map((r,i)=>`Team ${i+1}:\n${r.members.map(n=>`\"${n}\"`).join('\n')}`).join('\n\n');
      const blob=new Blob([text+'\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`${String(cup.name||'cup').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'')||'cup'}-registrierungen.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){toast(e.message||String(e),true);}
  }
  async function renderAdminRegistrations(cup){
    const wrap=$('#adminRegistrationRows');if(!wrap)return;
    let bar=$('#v3RegistrationExportBar');if(!bar){bar=document.createElement('div');bar.id='v3RegistrationExportBar';bar.className='v3-registration-export';const tab=$('#adminRegistrationsTab');tab?.insertBefore(bar,tab.firstChild);}
    if(bar){bar.innerHTML=`<span>${copy('Registration overview only – no influence on tournament participation.','Nur Anmeldeübersicht – kein Einfluss auf die tatsächliche Turnierteilnahme.','Aperçu des inscriptions uniquement.')}</span><button class=\"ghost-button\" type=\"button\" id=\"v3DownloadRegistrations\">${copy('Download teams (.txt)','Teams herunterladen (.txt)','Télécharger équipes (.txt)')}</button>`;$('#v3DownloadRegistrations',bar).onclick=()=>downloadAdminRegistrations(cup);}
    try{
      const rows=await loadAdminRegistrationTeams(cup.id);
      wrap.innerHTML=rows.length?rows.slice().reverse().map(r=>`<div class=\"admin-registration-row\"><strong>${esc(r.members.join(' + ')||r.id.slice(0,8))}</strong><span class=\"${r.status==='confirmed'?'status-confirmed':'status-pending'}\">${esc(r.status)}</span><span>${esc(gpById(r.created_by)?.current_name||'—')}</span><span>${r.members.length}</span></div>`).join(''):`<p class=\"v3-empty\">${copy('No registrations.','Keine Anmeldungen.','Aucune inscription.')}</p>`;
    }catch(e){wrap.innerHTML=`<p class=\"v3-empty\">${esc(e.message)}</p>`;}
  }'''
replace_once(old_reg,new_reg,'registration TXT export')

# ---------------------------------------------------------------------------
# 5) Styling for export row.
# ---------------------------------------------------------------------------
css=r'''
<style id="hub-offline-catchup-export-fixes">
  .v3-registration-export{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 4px 14px;color:#8f88a5;font-size:11px}
  .v3-registration-export button{white-space:nowrap}
  @media(max-width:700px){.v3-registration-export{align-items:stretch;flex-direction:column}.v3-registration-export button{width:100%}}
</style>
'''
if 'id="hub-offline-catchup-export-fixes"' in s: raise SystemExit('catch-up/export style already exists')
s=s.replace('</head>',css+'\n</head>',1)

# Guards.
required=[
  "get_my_animation_state",
  "ack_my_animation_state",
  "runMissedCompetitiveCatchup",
  "buildRankJourney",
  "parentModal=foreign.closest('.modal-backdrop')",
  "Download teams (.txt)",
  "loadAdminRegistrationTeams",
  "Nur Anmeldeübersicht",
]
for needle in required:
    if needle not in s: raise SystemExit('missing expected patch: '+needle)
if old_foreign in s: raise SystemExit('old Cup profile navigation still present')
if old_reg in s: raise SystemExit('old registration renderer still present')

p.write_text(s)
print('all offline catch-up / registration export assertions passed')
