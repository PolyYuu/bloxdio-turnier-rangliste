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
# Shared animation controller + speed-aware ranked overlay.
# ---------------------------------------------------------------------------
rank_block=r'''window.HubAnimationUX=window.HubAnimationUX||{
  current:null,atFinal:true,
  label(final=false){
    const lang=(window.state?.lang||document.documentElement.lang||'de');
    if(final)return lang==='de'?'WEITER':lang==='fr'?'CONTINUER':'CONTINUE';
    return lang==='de'?'ANIMATION ÜBERSPRINGEN':lang==='fr'?"PASSER L’ANIMATION":'SKIP ANIMATION';
  },
  button(modal){return modal?.querySelector('.cta-button[data-close-modal]')||null;},
  begin(modal,finish){this.current={modal,finish};this.atFinal=false;const b=this.button(modal);if(b)b.textContent=this.label(false);},
  final(modal){this.atFinal=true;const b=this.button(modal);if(b)b.textContent=this.label(true);},
  finishNow(){if(this.atFinal)return false;const fn=this.current?.finish;if(typeof fn==='function')fn(true);return true;}
};

function openRankUpdate(payload={}){
  const legacy=typeof payload==='boolean';
  const before=legacy?(payload?1988:1908):Number(payload.before??payload.ratingBefore);
  const after=legacy?(payload?2015:1935):Number(payload.after??payload.ratingAfter);
  if(!Number.isFinite(before)||!Number.isFinite(after))return;
  const speed=Math.max(1,Number(payload.speed)||1),instant=!!payload.instant;
  const modal=document.querySelector('#roundUpdateModal'),card=document.querySelector('#rankUpdateCard'),icon=document.querySelector('#updateRankIcon'),bar=document.querySelector('#animatedUpdateBar'),message=document.querySelector('#rankUpMessage');
  if(!modal||!card||!icon||!bar||!message)return;
  clearTimeout(openRankUpdate._switchTimer);clearTimeout(openRankUpdate._finishTimer);
  const oldKey=(!legacy&&payload.rankBefore)||getRankKey(before),newKey=(!legacy&&payload.rankAfter)||getRankKey(after);
  const rankChanged=oldKey!==newKey,rankUp=rankChanged&&after>before,oldB=getBounds(before),newB=getBounds(after),beforePct=pct(before,oldB),afterPct=pct(after,newB),delta=after-before;
  const updateMeta=(key,bounds,p)=>{
    icon.src=RANK_ICONS[key];document.querySelector('#updateRankName').textContent=rankName(key);
    document.querySelector('#updateLow').textContent=bounds.low;document.querySelector('#updateHigh').textContent=bounds.high;
    document.querySelector('#updateProgressTitle').textContent=bounds.next?t('overlay.progressTo',{rank:rankName(bounds.next)}):rankName(key);
    document.querySelector('#updateProgressPct').textContent=`${Math.round(p)}%`;
    document.querySelector('#updateRemaining').textContent=t('overlay.left',{n:Math.max(0,Math.round(bounds.high-after))});
  };
  card.style.setProperty('--hub-rank-pulse-duration',`${2.33/speed}s`);card.style.setProperty('--hub-rank-pulse-delay',`${3.67/speed}s`);
  card.style.setProperty('--hub-flare-duration',`${2.5/speed}s`);card.style.setProperty('--hub-flare-delay',`${3.67/speed}s`);
  card.style.setProperty('--hub-icon-duration',`${3/speed}s`);card.style.setProperty('--hub-icon-delay',`${3.42/speed}s`);
  card.classList.remove('rank-up');void card.offsetWidth;if(rankUp&&!instant)card.classList.add('rank-up');message.hidden=true;
  icon.src=RANK_ICONS[oldKey];document.querySelector('#updateRankName').textContent=rankName(oldKey);
  document.querySelector('#ratingBefore').textContent=Math.round(before);document.querySelector('#ratingAfter').textContent=Math.round(after);
  const deltaEl=document.querySelector('#ratingDelta');deltaEl.textContent=`${delta>=0?'+':''}${Math.round(delta)} Rating`;deltaEl.className=`delta ${delta>=0?'positive':'negative'}`;
  const gameNo=Number(payload.gameNumber||0);document.querySelector('#updateKicker').textContent=gameNo?`RANKED UPDATE · GAME ${gameNo}`:'RANKED UPDATE';document.querySelector('#rankUpdateTitle').textContent=t('overlay.yourProgress');
  document.querySelector('#updateLow').textContent=oldB.low;document.querySelector('#updateHigh').textContent=oldB.high;document.querySelector('#updateProgressTitle').textContent=oldB.next?t('overlay.progressTo',{rank:rankName(oldB.next)}):rankName(oldKey);document.querySelector('#updateProgressPct').textContent=`${Math.round(beforePct)}%`;document.querySelector('#updateRemaining').textContent=t('overlay.left',{n:Math.max(0,Math.round(oldB.high-before))});
  const factors=document.querySelector('#rankUpdateCard .factor-grid');if(factors)factors.hidden=true;
  const finish=()=>{
    clearTimeout(openRankUpdate._switchTimer);clearTimeout(openRankUpdate._finishTimer);card.classList.remove('rank-up');
    updateMeta(newKey,newB,afterPct);document.querySelector('#newRankName').textContent=rankName(newKey);message.hidden=!rankUp;
    bar.style.transition='none';bar.style.width=`${afterPct}%`;
    window.HubAnimationUX.final(modal);
  };
  modal.hidden=false;window.HubAnimationUX.begin(modal,finish);
  if(instant){finish();return;}
  bar.style.transition='none';bar.style.width=`${beforePct}%`;
  const firstTarget=rankChanged?(after>before?100:0):afterPct;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition=`width ${3.5/speed}s cubic-bezier(.2,.75,.2,1)`;bar.style.width=`${firstTarget}%`;document.querySelector('#updateProgressPct').textContent=`${Math.round(firstTarget)}%`;}));
  if(rankChanged){
    openRankUpdate._switchTimer=setTimeout(()=>{
      icon.src=RANK_ICONS[newKey];document.querySelector('#updateRankName').textContent=rankName(newKey);document.querySelector('#newRankName').textContent=rankName(newKey);message.hidden=!rankUp;
      bar.style.transition='none';bar.style.width=after>before?'0%':'100%';document.querySelector('#updateLow').textContent=newB.low;document.querySelector('#updateHigh').textContent=newB.high;document.querySelector('#updateProgressTitle').textContent=newB.next?t('overlay.progressTo',{rank:rankName(newB.next)}):rankName(newKey);document.querySelector('#updateRemaining').textContent=t('overlay.left',{n:Math.max(0,Math.round(newB.high-after))});
      requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition=`width ${3.5/speed}s cubic-bezier(.2,.75,.2,1)`;bar.style.width=`${afterPct}%`;document.querySelector('#updateProgressPct').textContent=`${Math.round(afterPct)}%`;}));
    },3850/speed);
    openRankUpdate._finishTimer=setTimeout(finish,(3850+3500)/speed+80);
  }else openRankUpdate._finishTimer=setTimeout(finish,3500/speed+80);
}
window.simulateRealtimeRatingEvent=(payload={})=>openRankUpdate(payload);'''
sub_once(r'function openRankUpdate\(payload=\{\}\)\{.*?window\.simulateRealtimeRatingEvent=\(payload=\{\}\)=>openRankUpdate\(payload\);',rank_block,'speed-aware ranked overlay',re.S)

# ---------------------------------------------------------------------------
# Speed-aware placement animation and final reveal.
# ---------------------------------------------------------------------------
placement_block=r'''window.simulatePlacementRatingEvent=(payload={})=>{
    const done=Math.max(1,Math.min(15,Number(payload.done||7))),speed=Math.max(1,Number(payload.speed)||1),instant=!!payload.instant;
    openPlacementDemo(done);
    const modal=document.querySelector('#placementModal');if(!modal)return;
    clearTimeout(window.simulatePlacementRatingEvent._finishTimer);
    modal.style.setProperty('--hub-placement-line-duration',`${2.08/speed}s`);modal.style.setProperty('--hub-placement-line-delay',`${.58/speed}s`);
    modal.style.setProperty('--hub-placement-node-duration',`${.92/speed}s`);modal.style.setProperty('--hub-placement-node-delay',`${2.58/speed}s`);
    modal.style.setProperty('--hub-placement-check-duration',`${.5/speed}s`);modal.style.setProperty('--hub-placement-check-delay',`${2.87/speed}s`);
    modal.querySelector('.placement-track')?.removeAttribute('hidden');const track=modal.querySelector('#placementTrack');if(track)track.style.display='';modal.classList.remove('placement-ranked-complete');
    const completed=done===15&&payload.completed&&Number.isFinite(Number(payload.rating));
    const finish=()=>{
      clearTimeout(window.simulatePlacementRatingEvent._finishTimer);
      if(completed){
        const rating=Math.round(Number(payload.rating)),key=payload.rankAfter||getRankKey(rating),kicker=modal.querySelector('#placementKicker'),title=modal.querySelector('#placementTitle'),subtitle=modal.querySelector('#placementSubtitle'),status=modal.querySelector('#placementStatusLabel'),name=modal.querySelector('#placementRankName'),copyEl=modal.querySelector('#placementProgressCopy'),help=modal.querySelector('#placementHelp'),img=modal.querySelector('.unranked-badge-wrap img');
        const lang=(window.state?.lang||document.documentElement.lang||'de');modal.classList.add('placement-ranked-complete');
        if(kicker)kicker.textContent=lang==='de'?'EINRANKUNG ABGESCHLOSSEN':lang==='fr'?'CLASSEMENT TERMINÉ':'PLACEMENTS COMPLETE';
        if(title)title.textContent=lang==='de'?'DEIN RANG':lang==='fr'?'TON RANG':'YOUR RANK';
        if(subtitle)subtitle.textContent=lang==='de'?'Deine 15 Einrankungsmatches sind abgeschlossen.':lang==='fr'?'Tes 15 matchs de placement sont terminés.':'Your 15 placement games are complete.';
        if(status)status.textContent=lang==='de'?'AKTUELLER RANG':lang==='fr'?'RANG ACTUEL':'CURRENT RANK';
        if(name)name.textContent=rankName(key);if(copyEl)copyEl.innerHTML=`<b>${rating}</b> RATING`;if(help)help.textContent=lang==='de'?'Ab jetzt zählt jedes weitere Game als normales Ranked-Game.':lang==='fr'?'Les prochaines parties utilisent maintenant le système Ranked normal.':'Future games now use the normal Ranked system.';if(img)img.src=RANK_ICONS[key];if(track)track.style.display='none';
      }else renderPlacementTrack(done,false);
      window.HubAnimationUX.final(modal);
    };
    window.HubAnimationUX.begin(modal,finish);
    if(instant){finish();return;}
    window.simulatePlacementRatingEvent._finishTimer=setTimeout(finish,(completed?4200:3300)/speed);
  };'''
sub_once(r'window\.simulatePlacementRatingEvent=\(payload=\{\}\)=>\{.*?\n  \};\n\n  function injectPlacementDemoButton',placement_block+'\n\n  function injectPlacementDemoButton','speed-aware placement overlay',re.S)

# ---------------------------------------------------------------------------
# Catch-up sequence speed depends on number of missed finalized games.
# ---------------------------------------------------------------------------
replace_once('let catchupBusy=false,catchupToken=0,liveAckTimer=null;','let catchupBusy=false,catchupToken=0,liveAckTimer=null,catchupTarget=null,catchupFinalShown=false;','catchup state vars')

catchup_fn=r'''  async function runMissedCompetitiveCatchup(){
    if(catchupBusy||document.hidden||!live.session||!live.player)return;
    let st;try{st=await api.getMyAnimationState();}catch(e){console.warn('Catch-up state failed',e);return;}if(!st)return;
    const curGames=Number(st.current_finalized_games||0),seenGames=Number(st.seen_finalized_games||0),curPlacement=Number(st.current_placement_games||0),seenPlacement=Number(st.seen_placement_games||0),curRanked=!!st.current_is_ranked,seenRanked=!!st.seen_is_ranked;
    if(curGames<=seenGames){const drift=curGames!==seenGames||curPlacement!==seenPlacement||curRanked!==seenRanked||(curRanked&&seenRanked&&Math.abs(Number(st.current_rating||0)-Number(st.seen_rating||0))>.001);if(drift)await ackCompetitiveState();return;}
    if(live.player.ranking_experience_enabled===false){await ackCompetitiveState();return;}
    const missedGames=Math.max(1,curGames-seenGames),speed=missedGames===1?1:missedGames<=3?1.75:missedGames<=6?2.5:3;
    catchupTarget={...st,missedGames,speed};catchupFinalShown=false;catchupBusy=true;const token=++catchupToken;
    try{
      if(!seenRanked){
        const last=Math.min(15,curPlacement);
        if(last>seenPlacement){
          for(let done=seenPlacement+1;done<=last;done++){
            if(token!==catchupToken||document.hidden)return;const completed=done===15&&curRanked;
            window.simulatePlacementRatingEvent?.({done,completed,rating:completed?Number(st.current_rating):null,rankAfter:completed&&Number.isFinite(Number(st.current_rating))?ratingBand(Number(st.current_rating)).key:null,catchup:true,speed});
            await sleep((completed?6200:3400)/speed);
          }
        }else if(curRanked){window.simulatePlacementRatingEvent?.({done:15,completed:true,rating:Number(st.current_rating),rankAfter:ratingBand(Number(st.current_rating)).key,catchup:true,speed});await sleep(6200/speed);}
      }else if(curRanked){
        const journey=buildRankJourney(Number(st.seen_rating),Number(st.current_rating));
        for(const seg of journey){if(token!==catchupToken||document.hidden)return;window.simulateRealtimeRatingEvent?.({...seg,catchup:true,speed});await sleep(4100/speed);}
      }else{await ackCompetitiveState();return;}
      if(token===catchupToken){catchupFinalShown=true;await ackCompetitiveState();}
    }finally{if(token===catchupToken)catchupBusy=false;}
  }

  function showCatchupFinalInstant(){
    const st=catchupTarget;if(!st)return false;const speed=Number(st.speed||1);catchupToken++;catchupFinalShown=true;
    if(!st.seen_is_ranked){
      const done=Math.min(15,Number(st.current_placement_games||0));window.simulatePlacementRatingEvent?.({done,completed:!!st.current_is_ranked,rating:st.current_is_ranked?Number(st.current_rating):null,rankAfter:st.current_is_ranked?ratingBand(Number(st.current_rating)).key:null,catchup:true,speed,instant:true});
    }else if(st.current_is_ranked){
      window.simulateRealtimeRatingEvent?.({before:Number(st.seen_rating),after:Number(st.current_rating),rankBefore:ratingBand(Number(st.seen_rating)).key,rankAfter:ratingBand(Number(st.current_rating)).key,catchup:true,speed,instant:true});
    }
    ackCompetitiveState();return true;
  }'''
sub_once(r'  async function runMissedCompetitiveCatchup\(\)\{.*?\n  \}\n\n  async function applyCompetitiveUpdate',catchup_fn+'\n\n  async function applyCompetitiveUpdate','catchup speed tiers',re.S)

# Two-stage Continue: first click while animation is moving = final state, second = close.
click_handler=r'''  document.addEventListener('click',e=>{
    const cta=e.target.closest('#placementModal .cta-button[data-close-modal],#roundUpdateModal .cta-button[data-close-modal]');
    const closes=e.target.closest('#placementModal [data-close-modal],#roundUpdateModal [data-close-modal]')||(e.target?.id==='placementModal'?e.target:null)||(e.target?.id==='roundUpdateModal'?e.target:null);
    if(!closes)return;
    if(cta){
      if(catchupBusy&&!catchupFinalShown){e.preventDefault();e.stopImmediatePropagation();if(liveAckTimer){clearTimeout(liveAckTimer);liveAckTimer=null;}showCatchupFinalInstant();return;}
      if(window.HubAnimationUX&&!window.HubAnimationUX.atFinal){e.preventDefault();e.stopImmediatePropagation();if(liveAckTimer){clearTimeout(liveAckTimer);liveAckTimer=null;}window.HubAnimationUX.finishNow();ackCompetitiveState();return;}
    }
    if(catchupBusy){catchupToken++;catchupBusy=false;}
    if(liveAckTimer){clearTimeout(liveAckTimer);liveAckTimer=null;}
    ackCompetitiveState();
  },true);'''
sub_once(r"  document\.addEventListener\('click',e=>\{\n    const closes=e\.target\.closest\('#placementModal \[data-close-modal\],#roundUpdateModal \[data-close-modal\]'\)\|\|.*?\n  \},true\);",click_handler,'two-stage continue behavior',re.S)

# ---------------------------------------------------------------------------
# CSS longhand overrides allow timing variables to beat older !important shorthands.
# ---------------------------------------------------------------------------
css=r'''
<style id="hub-prelaunch-animation-ux">
  #placementModal .placement-connector.arriving:after{animation-duration:var(--hub-placement-line-duration,2.08s)!important;animation-delay:var(--hub-placement-line-delay,.58s)!important}
  #placementModal .placement-node.arriving{animation-duration:var(--hub-placement-node-duration,.92s)!important;animation-delay:var(--hub-placement-node-delay,2.58s)!important}
  #placementModal .placement-node.arriving b{animation-duration:var(--hub-placement-check-duration,.5s)!important;animation-delay:var(--hub-placement-check-delay,2.87s)!important}
  #rankUpdateCard.rank-up{animation-duration:var(--hub-rank-pulse-duration,2.33s)!important;animation-delay:var(--hub-rank-pulse-delay,3.67s)!important}
  #rankUpdateCard.rank-up .rankup-flare{animation-duration:var(--hub-flare-duration,2.5s)!important;animation-delay:var(--hub-flare-delay,3.67s)!important}
  #rankUpdateCard.rank-up .update-rank-icon{animation-duration:var(--hub-icon-duration,3s)!important;animation-delay:var(--hub-icon-delay,3.42s)!important}
</style>
'''
if 'id="hub-prelaunch-animation-ux"' in s:raise SystemExit('animation UX CSS already exists')
s=s.replace('</head>',css+'\n</head>',1)

# Static safety assertions.
for needle in ['HubAnimationUX','missedGames===1?1:missedGames<=3?1.75:missedGames<=6?2.5:3','showCatchupFinalInstant','ANIMATION ÜBERSPRINGEN','hub-prelaunch-animation-ux','instant:true']:
    if needle not in s:raise SystemExit('missing '+needle)
if 'bar.style.transition="width 3.5s cubic-bezier' in s:raise SystemExit('old fixed ranked speed remains')

p.write_text(s)
print('prelaunch animation UX patch complete')
