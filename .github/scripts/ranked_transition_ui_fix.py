from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

def sub_once(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    s=s2
    print(label,'ok')

def replace_once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)
    print(label,'ok')

# ---------------------------------------------------------------------------
# 1) Real ranked overlay: use the actual before/after values instead of demo Elo.
# ---------------------------------------------------------------------------
rank_fn=r'''function openRankUpdate(payload={}){
  const legacy=typeof payload==='boolean';
  const before=legacy?(payload?1988:1908):Number(payload.before??payload.ratingBefore);
  const after=legacy?(payload?2015:1935):Number(payload.after??payload.ratingAfter);
  if(!Number.isFinite(before)||!Number.isFinite(after))return;
  const modal=document.querySelector("#roundUpdateModal"),card=document.querySelector("#rankUpdateCard"),icon=document.querySelector("#updateRankIcon"),bar=document.querySelector("#animatedUpdateBar"),message=document.querySelector("#rankUpMessage");
  if(!modal||!card||!icon||!bar||!message)return;
  const oldKey=(!legacy&&payload.rankBefore)||getRankKey(before),newKey=(!legacy&&payload.rankAfter)||getRankKey(after);
  const rankChanged=oldKey!==newKey,rankUp=rankChanged&&after>before,oldB=getBounds(before),newB=getBounds(after),beforePct=pct(before,oldB),afterPct=pct(after,newB),delta=after-before;
  card.classList.remove("rank-up");void card.offsetWidth;if(rankUp)card.classList.add("rank-up");message.hidden=true;
  icon.src=RANK_ICONS[oldKey];document.querySelector("#updateRankName").textContent=rankName(oldKey);
  document.querySelector("#ratingBefore").textContent=Math.round(before);document.querySelector("#ratingAfter").textContent=Math.round(after);
  const deltaEl=document.querySelector("#ratingDelta");deltaEl.textContent=`${delta>=0?'+':''}${Math.round(delta)} Rating`;deltaEl.className=`delta ${delta>=0?'positive':'negative'}`;
  const gameNo=Number(payload.gameNumber||0);document.querySelector("#updateKicker").textContent=gameNo?`RANKED UPDATE · GAME ${gameNo}`:"RANKED UPDATE";document.querySelector("#rankUpdateTitle").textContent=t("overlay.yourProgress");
  document.querySelector("#updateLow").textContent=oldB.low;document.querySelector("#updateHigh").textContent=oldB.high;document.querySelector("#updateProgressTitle").textContent=oldB.next?t("overlay.progressTo",{rank:rankName(oldB.next)}):rankName(oldKey);document.querySelector("#updateProgressPct").textContent=`${Math.round(beforePct)}%`;document.querySelector("#updateRemaining").textContent=t("overlay.left",{n:Math.max(0,Math.round(oldB.high-before))});
  const factors=document.querySelector("#rankUpdateCard .factor-grid");if(factors)factors.hidden=true;
  modal.hidden=false;bar.style.transition="none";bar.style.width=`${beforePct}%`;
  const firstTarget=rankChanged?(after>before?100:0):afterPct;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition="width 3.5s cubic-bezier(.2,.75,.2,1)";bar.style.width=`${firstTarget}%`;document.querySelector("#updateProgressPct").textContent=`${Math.round(firstTarget)}%`;}));
  if(rankChanged){setTimeout(()=>{icon.src=RANK_ICONS[newKey];document.querySelector("#updateRankName").textContent=rankName(newKey);document.querySelector("#newRankName").textContent=rankName(newKey);message.hidden=!rankUp;bar.style.transition="none";bar.style.width=after>before?"0%":"100%";document.querySelector("#updateLow").textContent=newB.low;document.querySelector("#updateHigh").textContent=newB.high;document.querySelector("#updateProgressTitle").textContent=newB.next?t("overlay.progressTo",{rank:rankName(newB.next)}):rankName(newKey);document.querySelector("#updateRemaining").textContent=t("overlay.left",{n:Math.max(0,Math.round(newB.high-after))});requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition="width 3.5s cubic-bezier(.2,.75,.2,1)";bar.style.width=`${afterPct}%`;document.querySelector("#updateProgressPct").textContent=`${Math.round(afterPct)}%`;}));},3850);}
}
window.simulateRealtimeRatingEvent=(payload={})=>openRankUpdate(payload);'''
sub_once(r'function openRankUpdate\(rankUp=false\)\{.*?window\.simulateRealtimeRatingEvent=\(payload=\{\}\)=>openRankUpdate\(!!payload\.rankUp\);',rank_fn,'real ranked overlay',re.S)

# ---------------------------------------------------------------------------
# 2) Placement 15: first animate 15/15, then reveal the actual rank + Elo.
# ---------------------------------------------------------------------------
placement_sim=r'''window.simulatePlacementRatingEvent=(payload={})=>{
    const done=Math.max(1,Math.min(15,Number(payload.done||7)));
    openPlacementDemo(done);
    const modal=document.querySelector("#placementModal");
    if(!modal)return;
    modal.querySelector(".placement-track")?.removeAttribute("hidden");
    const track=modal.querySelector("#placementTrack");if(track)track.style.display="";
    modal.classList.remove("placement-ranked-complete");
    if(done===15&&payload.completed&&Number.isFinite(Number(payload.rating))){
      const rating=Math.round(Number(payload.rating)),key=payload.rankAfter||getRankKey(rating);
      setTimeout(()=>{
        if(modal.hidden)return;
        modal.classList.add("placement-ranked-complete");
        const kicker=modal.querySelector("#placementKicker"),title=modal.querySelector("#placementTitle"),subtitle=modal.querySelector("#placementSubtitle"),status=modal.querySelector("#placementStatusLabel"),name=modal.querySelector("#placementRankName"),copyEl=modal.querySelector("#placementProgressCopy"),help=modal.querySelector("#placementHelp"),img=modal.querySelector(".unranked-badge-wrap img");
        const lang=(window.state?.lang||document.documentElement.lang||'de');
        if(kicker)kicker.textContent=lang==='de'?'EINRANKUNG ABGESCHLOSSEN':lang==='fr'?'CLASSEMENT TERMINÉ':'PLACEMENTS COMPLETE';
        if(title)title.textContent=lang==='de'?'DEIN RANG':lang==='fr'?'TON RANG':'YOUR RANK';
        if(subtitle)subtitle.textContent=lang==='de'?'Deine 15 Einrankungsmatches sind abgeschlossen.':lang==='fr'?'Tes 15 matchs de placement sont terminés.':'Your 15 placement games are complete.';
        if(status)status.textContent=lang==='de'?'AKTUELLER RANG':lang==='fr'?'RANG ACTUEL':'CURRENT RANK';
        if(name)name.textContent=rankName(key);if(copyEl)copyEl.innerHTML=`<b>${rating}</b> RATING`;if(help)help.textContent=lang==='de'?'Ab jetzt zählt jedes weitere Game als normales Ranked-Game.':lang==='fr'?'Les prochaines parties utilisent maintenant le système Ranked normal.':'Future games now use the normal Ranked system.';if(img)img.src=RANK_ICONS[key];if(track)track.style.display='none';
      },4200);
    }
  };'''
sub_once(r'window\.simulatePlacementRatingEvent=\(payload=\{\}\)=>openPlacementDemo\(Math\.max\(1,Math\.min\(15,payload\.done\|\|7\)\)\);',placement_sim,'placement final rank reveal')

# ---------------------------------------------------------------------------
# 3) API for finalize-only notifications. Recalculations/deletes do not emit these.
# ---------------------------------------------------------------------------
api_marker="  function subscribeToPlacementEvents(onInsert) { return client.channel('hub-placement-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'placement_update_notifications'},p=>onInsert(p.new)).subscribe(); }"
api_add=api_marker+"\n  function subscribeToCompetitiveUpdates(onInsert) { return client.channel('hub-competitive-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'competitive_update_notifications'},p=>onInsert(p.new)).subscribe(); }\n  async function getLatestCompetitiveUpdateId() { const {data,error}=await client.from('competitive_update_notifications').select('id').order('id',{ascending:false}).limit(1);if(error)throw error;return Number(data?.[0]?.id||0); }\n  async function getCompetitiveUpdatesAfter(id) { const {data,error}=await client.from('competitive_update_notifications').select('*').gt('id',Number(id||0)).order('id',{ascending:true}).limit(50);if(error)throw error;return data||[]; }"
replace_once(api_marker,api_add,'competitive notification API')

old_export="heartbeatPresence,clearPresence,adminGetOnlinePlayers,subscribeToRatingEvents,subscribeToPlacementEvents,subscribeToSocial,subscribeToCup,subscribeToStats };"
new_export="heartbeatPresence,clearPresence,adminGetOnlinePlayers,subscribeToRatingEvents,subscribeToPlacementEvents,subscribeToCompetitiveUpdates,getLatestCompetitiveUpdateId,getCompetitiveUpdatesAfter,subscribeToSocial,subscribeToCup,subscribeToStats };"
replace_once(old_export,new_export,'export competitive notification API')

# ---------------------------------------------------------------------------
# 4) Replace old rating_history/placement animation subscriptions with the
# finalize-only notification stream + a polling fallback. Keep a silent profile
# poll so edits/deletes reflect live without animations.
# ---------------------------------------------------------------------------
new_live=r'''  api.client.auth.onAuthStateChange(()=>setTimeout(()=>{competitiveCursor=null;seenCompetitiveUpdates.clear();restoreAuth(false);},0));

  let competitiveCursor=null,competitivePollBusy=false,silentProfilePollBusy=false;
  const seenCompetitiveUpdates=new Set();
  async function applyCompetitiveUpdate(evt){
    if(!live.player||evt.global_player_id!==live.player.id)return;
    const id=Number(evt.id||0);if(id&&seenCompetitiveUpdates.has(id))return;if(id){seenCompetitiveUpdates.add(id);competitiveCursor=Math.max(Number(competitiveCursor||0),id);}
    try{
      const refreshed=await api.getMyProfile();if(refreshed)live.player=refreshed;
      try{live.stats=await api.getCareerStatsFor(live.player.id);}catch(_){}
      await syncOwnProfileToUi();
      if(live.player.ranking_experience_enabled!==false){
        if(evt.placement_game_number!==null&&evt.placement_game_number!==undefined){
          const done=Math.max(1,Math.min(15,Number(evt.placement_game_number)));
          if(typeof window.simulatePlacementRatingEvent==='function')window.simulatePlacementRatingEvent({done,completed:!!evt.became_ranked,rating:evt.rating_after??live.player.rating,rankAfter:evt.rank_after,gameNumber:Number(evt.game_number||done)});
        }else if(typeof window.simulateRealtimeRatingEvent==='function'){
          window.simulateRealtimeRatingEvent({before:Number(evt.rating_before),after:Number(evt.rating_after),delta:Number(evt.final_delta),rankBefore:evt.rank_before,rankAfter:evt.rank_after,gameNumber:Number(evt.game_number||0)});
        }
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
      if(changed){live.player=refreshed;try{live.stats=await api.getCareerStatsFor(live.player.id);}catch(_){}await syncOwnProfileToUi();document.dispatchEvent(new CustomEvent('hub:rating-updated',{detail:{player:live.player,silent:true}}));}
    }catch(e){console.warn('Silent live profile refresh failed',e);}finally{silentProfilePollBusy=false;}
  },2000);

  restoreAuth(false).then(async()=>{updateRegistrationButton();try{if(live.session)competitiveCursor=await api.getLatestCompetitiveUpdateId();}catch(_){}});'''
sub_once(r"  api\.client\.auth\.onAuthStateChange\(.*?\n  restoreAuth\(false\)\.then\(updateRegistrationButton\);",new_live,'finalize-only live update pipeline',re.S)

# ---------------------------------------------------------------------------
# 5) Ranking: actual finalized game count, form and correctly aligned compact row.
# ---------------------------------------------------------------------------
replace_once(
"  function fakeAsPlayer(f){return {_fake:true,id:f.id,current_name:f.name,avatar_pixels:f.avatar_pixels,is_ranked:true,placement_games:Number(f.games||15),rating:Number(f.rating||0),peak_rating:Number(f.peak||f.rating||0),rank_key:f.rank_key,form:Array.isArray(f.form)?f.form:[]};}",
"  function fakeAsPlayer(f){return {_fake:true,id:f.id,current_name:f.name,avatar_pixels:f.avatar_pixels,is_ranked:true,placement_games:15,competitive_games:Number(f.games||15),rating:Number(f.rating||0),peak_rating:Number(f.peak||f.rating||0),rank_key:f.rank_key,form:Array.isArray(f.form)?f.form:[],trend:null};}",
'fake ranking game compatibility')

ranking_fn=r'''  function rankingRow(p,i,compact=false){
    const rank=p._fake?core.rankLabel(p.rank_key):core.rankLabel(core.rankKey(Number(p.rating))),attrs=p._fake?`data-v3-fake-row="${p.id}"`:`data-profile-player="${esc(p.current_name)}"`,games=Number(p.competitive_games??p.placement_games??0),trend=p.trend===null||p.trend===undefined?null:Number(p.trend),trendText=trend===null?'—':`${trend>=0?'+':''}${Math.round(trend)}`,trendClass=trend===null?'':trend>=0?'positive':'negative';
    const player=`<div class="player-name player-with-avatar">${avatarImg(p,'list-avatar pixel-avatar')}<span>${esc(p.current_name)}</span>${p._fake&&live.isAdmin?`<button class="v3-fake-delete" type="button" data-v3-delete-fake="${p.id}" title="${copy('Remove fake profile','Fake-Profil entfernen','Supprimer le faux profil')}">×</button>`:''}</div>`;
    const rankCell=`<div class="rank-cell"><img src="${rankIcon(p)}" alt=""><span>${rank}</span></div>`;
    if(compact)return `<div class="ranking-row v3-real-ranking-row ${p._fake?'v3-fake-ranking-row':''}" tabindex="0" role="button" ${attrs}><div class="placement">${i+1}</div>${player}${rankCell}<div class="rating">${Math.round(Number(p.rating))}</div><div class="trend ${trendClass}">${trendText}</div></div>`;
    return `<div class="ranking-row v3-real-ranking-row ${p._fake?'v3-fake-ranking-row':''}" tabindex="0" role="button" ${attrs}><div class="placement">${i+1}</div>${player}${rankCell}<div class="rating">${Math.round(Number(p.rating))}</div><div class="peak">${Math.round(Number(p.peak_rating||p.rating))}</div><div class="games">${games}</div><div class="form-pills">${formMarkup(p)}</div></div>`;
  }'''
sub_once(r'  function rankingRow\(p,i,compact=false\)\{.*?\n  \}\n  function ensureFakeRankingControls',ranking_fn+'\n  function ensureFakeRankingControls','ranking row alignment/games/form',re.S)

# ---------------------------------------------------------------------------
# 6) History: graph uses up to 40 chronological games, list is newest-first,
# default 10 and expandable to 40.
# ---------------------------------------------------------------------------
history_fn=r'''  function renderHistoryGraphV4(history){
    const panel=$('.history-panel'),recent=$('[data-page="profile"] .recent-updates');if(!panel||!recent)return;
    const h=(history||[]).slice(-40),chart=$('.chart',panel),updates=$('.update-list',recent);if(!chart||!updates)return;
    if(!h.length){chart.innerHTML=`<p class="v3-empty">${copy('No competitive games yet.','Noch keine Competitive-Games gespielt.','Aucune partie compétitive.')}</p>`;updates.innerHTML='';recent.hidden=true;return;}
    renderHistoryGraphV4._history=history;
    if(renderHistoryGraphV4.expanded===undefined)renderHistoryGraphV4.expanded=false;
    let toggle=panel.querySelector('.v3-history-toggle');const oldTag=panel.querySelector('.panel-header .mode-tag');if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='mode-tag v3-history-toggle';oldTag?.replaceWith(toggle);toggle.onclick=()=>{renderHistoryGraphV4.expanded=!renderHistoryGraphV4.expanded;renderHistoryGraphV4(renderHistoryGraphV4._history||[]);};}
    const maxRows=renderHistoryGraphV4.expanded?40:10;toggle.textContent=renderHistoryGraphV4.expanded?copy('Show latest 10','Nur letzte 10','Afficher les 10 dernières'):copy('Show up to 40','Bis zu 40 anzeigen','Afficher jusqu’à 40');toggle.disabled=h.length<=10;
    const display=[...h].reverse().slice(0,maxRows);
    const rows=`<div class="v3-history-list">${display.map((x,idx)=>{const game=Number(x.game_number||0),hidden=x.final_delta===null||x.final_delta===undefined||game<=15,delta=hidden?copy('HIDDEN','VERDECKT','CACHÉ'):`${Number(x.final_delta)>=0?'+':''}${Math.round(Number(x.final_delta))}`;return `<div class="v3-history-row"><div class="v3-history-game"><strong>Game ${game}</strong><small>${copy('Round','Runde','Manche')} ${Number(x.round||0)}</small></div><div class="v3-history-cup"><strong>${esc(x.tournament_name||copy('Competitive Cup','Competitive Cup','Cup compétitif'))}</strong><small>${x.created_at?new Date(x.created_at).toLocaleDateString():''}</small></div><div class="v3-history-stats"><i>K ${Number(x.round_kills||0)}</i><i>DM ${Number(x.round_deathmatches||0)}</i><i>W ${Number(x.round_wins||0)}</i><i>PTS ${Number(x.individual_points||0)}</i></div><div class="v3-history-delta ${hidden?'hidden-rating':Number(x.final_delta)>=0?'positive':'negative'}">${delta}</div></div>`;}).join('')}</div>`;
    const ranked=h.filter(x=>Number(x.game_number||0)>=16&&x.rating_after!==null&&x.rating_after!==undefined&&Number.isFinite(Number(x.rating_after)));
    let graph='';
    if(ranked.length){const first=ranked[0],firstGame=Number(first.game_number||16),firstAfter=Number(first.rating_after),firstDelta=Number(first.final_delta||0),points=[{game:Math.max(15,firstGame-1),rating:firstAfter-firstDelta,start:true},...ranked.map(x=>({game:Number(x.game_number),rating:Number(x.rating_after)}))],vals=points.map(x=>x.rating);let lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(100,hi-lo),pad=Math.max(25,span*.18);lo=Math.floor((lo-pad)/25)*25;hi=Math.ceil((hi+pad)/25)*25;if(hi-lo<100){const mid=(hi+lo)/2;lo=Math.floor((mid-50)/25)*25;hi=lo+100;}const W=720,H=236,L=12,R=12,T=12,B=24,plotW=W-L-R,plotH=H-T-B,xAt=i=>L+(points.length===1?plotW/2:(i/(points.length-1))*plotW),yAt=v=>T+((hi-v)/(hi-lo))*plotH,coords=points.map((pt,i)=>[xAt(i),yAt(pt.rating)]),line=coords.map((c,i)=>`${i?'L':'M'} ${c[0].toFixed(2)} ${c[1].toFixed(2)}`).join(' '),area=`${line} L ${coords[coords.length-1][0].toFixed(2)} ${(T+plotH).toFixed(2)} L ${coords[0][0].toFixed(2)} ${(T+plotH).toFixed(2)} Z`,ticks=Array.from({length:5},(_,i)=>hi-(hi-lo)*(i/4));graph=`<div class="v3-rating-graph"><div class="v3-rating-ylabels">${ticks.map(v=>`<span>${Math.round(v)}</span>`).join('')}</div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Rating Verlauf"><defs><linearGradient id="v3RatingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38ead8" stop-opacity=".30"/><stop offset="100%" stop-color="#38ead8" stop-opacity=".025"/></linearGradient></defs>${ticks.map(v=>`<line class="v3-rating-grid" x1="${L}" y1="${yAt(v)}" x2="${W-R}" y2="${yAt(v)}"/>`).join('')}<path class="v3-rating-area" d="${area}"/><path class="v3-rating-line" d="${line}"/>${coords.map((c,i)=>`<circle class="v3-rating-point" cx="${c[0]}" cy="${c[1]}" r="3"><title>${points[i].start?copy('Starting rating','Start-Rating','Rating initial'):`Game ${points[i].game}`}: ${Math.round(points[i].rating)}</title></circle>`).join('')}</svg><div class="v3-rating-xlabels"><span>${copy('START','START','DÉBUT')}</span><span>Game ${points[points.length-1].game}</span></div></div>`;}
    chart.innerHTML=graph+rows;
    const visible=h.filter(x=>Number(x.game_number||0)>=16&&x.final_delta!==null&&x.final_delta!==undefined).slice(-5).reverse();recent.hidden=!visible.length;updates.innerHTML=visible.map(x=>`<div><span>Game ${Number(x.game_number||0)}</span><strong class="${Number(x.final_delta)>=0?'positive':'negative'}">${Number(x.final_delta)>=0?'+':''}${Math.round(Number(x.final_delta))}</strong></div>`).join('');
  }'''
sub_once(r'  function renderHistoryGraphV4\(history\)\{.*?\n  \}\n  renderHistoryGraph=renderHistoryGraphV4;',history_fn+'\n  renderHistoryGraph=renderHistoryGraphV4;','newest-first 10/40 history',re.S)

# ---------------------------------------------------------------------------
# 7) Remove demo controls + slower animation + ranking/form polish.
# ---------------------------------------------------------------------------
style=r'''
<style id="hub-ranked-transition-fixes">
  .profile-demo-actions,#showRoundUpdateButton,#placementDemoButton,#rankUpDemoButton,#profileRoundUpdateButton{display:none!important}
  .v3-history-toggle{cursor:pointer;border:1px solid rgba(132,91,230,.34);color:#c8bddb;background:#26124d}
  .v3-history-toggle:disabled{opacity:.45;cursor:default}
  .v3-form-chips{display:flex;align-items:center;gap:5px}.v3-form-chips i{min-width:7px!important;width:7px!important;height:7px!important;padding:0!important;border-radius:50%!important;font-size:0!important}.v3-form-chips i.win{background:var(--green)!important}.v3-form-chips i.loss{background:var(--red)!important}.v3-form-chips i.draw{background:#73698a!important}
  .v3-real-ranking-row .player-with-avatar{display:flex;align-items:center;gap:10px}.v3-real-ranking-row .list-avatar{width:34px;height:34px;border-radius:6px;flex:0 0 34px}.compact-list .v3-real-ranking-row .rank-cell img{width:34px;height:34px}.compact-list .v3-real-ranking-row .trend{text-align:left}
  .placement-connector.arriving:after{animation:placementLineFill 2.08s cubic-bezier(.2,.7,.2,1) .58s forwards!important}
  .placement-node.arriving{animation:placementNodeArrive .92s cubic-bezier(.2,1.45,.35,1) 2.58s forwards!important}
  .placement-node.arriving b{animation:placementCheckAppear .5s ease 2.87s forwards!important}
  #placementModal.placement-ranked-complete .unranked-badge-wrap{animation:v3PlacementRankReveal 1.2s cubic-bezier(.2,1.1,.3,1) both}
  #placementModal.placement-ranked-complete .placement-rank-name{color:#fff;text-shadow:0 0 28px rgba(56,240,219,.38)}
  @keyframes v3PlacementRankReveal{0%{opacity:.15;transform:scale(.72)}65%{opacity:1;transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
  .rank-update-modal.rank-up{animation-duration:2.33s!important;animation-delay:3.67s!important}.rank-update-modal.rank-up .rankup-flare{animation-duration:2.5s!important;animation-delay:3.67s!important}.rank-update-modal.rank-up .update-rank-icon{animation-duration:3s!important;animation-delay:3.42s!important}
</style>
'''
if 'id="hub-ranked-transition-fixes"' in s: raise SystemExit('fix style already exists')
s=s.replace('</head>',style+'\n</head>',1)

# Remove the demo controls from DOM after old demo code has finished wiring itself.
marker='  const api=window.HubAPI, core=window.HubV3;\n  if(!api||!core)return;'
replace_once(marker,marker+"\n  document.querySelector('.profile-demo-actions')?.remove();document.querySelector('#showRoundUpdateButton')?.remove();",'remove demo controls from live DOM')

# Guards.
checks=[
 'competitive_update_notifications',
 'subscribeToCompetitiveUpdates',
 'became_ranked',
 'placement-ranked-complete',
 'width 3.5s cubic-bezier',
 'competitive_games??p.placement_games',
 'const display=[...h].reverse().slice(0,maxRows)',
 'Show up to 40',
 "document.querySelector('.profile-demo-actions')?.remove()",
]
for x in checks:
    if x not in s: raise SystemExit('missing expected patch: '+x)
if 'Number(p.placement_games||0)</span><span>${formMarkup(p)}' in s:
    raise SystemExit('old capped games renderer still present')

p.write_text(s)
print('all ranked transition UI assertions passed')
