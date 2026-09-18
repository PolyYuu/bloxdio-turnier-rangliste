(() => {
  'use strict';

  if (!window.supabase?.createClient) return;

  const SUPABASE_URL = 'https://nxzrgbpaxukgjyzwupjp.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND';
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const roundOverlay = document.getElementById('roundOverlay');
  const gameStage = document.getElementById('gameStage');
  const bloxdFrame = document.getElementById('bloxdFrame');
  if (!roundOverlay || !gameStage) return;

  const PRE_ANIMATION_HOLD_MS = 650;
  const RANK_SEGMENT_MS = 3500;
  const PLACEMENT_LINE_MS = 2080;
  const PLACEMENT_ANIMATION_MS = 2900;

  const RANKS = [
    {key:'wood',label:'WOOD',min:0,high:750,symbol:'◇'},
    {key:'iron',label:'IRON',min:750,high:1000,symbol:'⬡'},
    {key:'gold',label:'GOLD',min:1000,high:1250,symbol:'✦'},
    {key:'emerald',label:'EMERALD',min:1250,high:1500,symbol:'◆'},
    {key:'diamond',label:'DIAMOND',min:1500,high:1750,symbol:'◈'},
    {key:'master',label:'MASTER',min:1750,high:2000,symbol:'♛'},
    {key:'grandmaster',label:'GRANDMASTER',min:2000,high:3000,symbol:'✹'}
  ];

  const COPY = {
    de:{placementKicker:'PLACEMENT UPDATE',placements:'DEINE EINRANGUNG',placementSubtitle:'Schließe 15 Ranked-Runden ab, um deinen ersten Rang freizuschalten.',currentStatus:'AKTUELLER STATUS',progress:'EINRANGUNGSFORTSCHRITT',help:'Nur abgeschlossene Matches werden markiert. Dein verstecktes Rating wird während der Einrangung nicht angezeigt.',unranked:'UNRANKED',rankKicker:'RANKED UPDATE',rankTitle:'DEIN FORTSCHRITT',rating:'RATING',top:'HÖCHSTER RANG',left:'übrig',currentRank:'AKTUELLER RANG',rankUp:'RANGAUFSTIEG',skip:'LEERTASTE DRÜCKEN ZUM ÜBERSPRINGEN',close:'LEERTASTE DRÜCKEN ZUM SCHLIESSEN'},
    en:{placementKicker:'PLACEMENT UPDATE',placements:'YOUR PLACEMENTS',placementSubtitle:'Complete 15 ranked rounds to reveal your first rank.',currentStatus:'CURRENT STATUS',progress:'PLACEMENT PROGRESS',help:'Only completed matches are marked. Your hidden rating is not shown during placements.',unranked:'UNRANKED',rankKicker:'RANKED UPDATE',rankTitle:'YOUR PROGRESS',rating:'RATING',top:'TOP RANK',left:'left',currentRank:'CURRENT RANK',rankUp:'RANK UP',skip:'PRESS SPACE TO SKIP',close:'PRESS SPACE TO CLOSE'},
    fr:{placementKicker:'MISE À JOUR PLACEMENT',placements:'TES PLACEMENTS',placementSubtitle:'Termine 15 manches classées pour révéler ton premier rang.',currentStatus:'STATUT ACTUEL',progress:'PROGRESSION PLACEMENT',help:'Seuls les matchs terminés sont marqués. Ton rating caché reste invisible pendant les placements.',unranked:'UNRANKED',rankKicker:'MISE À JOUR RANKED',rankTitle:'TA PROGRESSION',rating:'RATING',top:'RANG MAXIMAL',left:'restants',currentRank:'RANG ACTUEL',rankUp:'RANG SUPÉRIEUR',skip:'APPUYEZ SUR ESPACE POUR PASSER',close:'APPUYEZ SUR ESPACE POUR FERMER'}
  };

  let overlay = null;
  let busy = false;
  let activeState = null;
  let closeTimer = 0;
  let startTimer = 0;
  let animationTimer = 0;
  let nodeTimer = 0;
  let switchTimer = 0;
  let progressFrame = 0;
  let hadRoundOverlayOpen = !roundOverlay.hidden;
  let iconPromise = null;
  let previousFrameTabIndex = null;
  const iconCache = {unranked:'',ranks:{}};

  function lang(){
    const raw = String(document.documentElement.lang || localStorage.getItem('sg-lang') || 'en').toLowerCase();
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('fr')) return 'fr';
    return 'en';
  }
  function t(){ return COPY[lang()] || COPY.en; }
  function clampPlacement(value){ return Math.max(0,Math.min(15,Number(value||0))); }
  function placementFill(done){ return done <= 1 ? 0 : ((done-1)/14*93.8); }
  function rankFor(value){
    const n = Number(value || 0);
    return RANKS.slice().reverse().find(r => n >= r.min) || RANKS[0];
  }
  function pct(value,rank){
    if (!rank || rank.key === 'grandmaster') return 100;
    return Math.max(0,Math.min(100,(Number(value)-rank.min)/(rank.high-rank.min)*100));
  }
  function nextRank(rank){
    const index=RANKS.findIndex(item=>item.key===rank?.key);
    return index>=0 && index<RANKS.length-1 ? RANKS[index+1] : null;
  }
  function progressTitle(rank){
    const next=nextRank(rank);
    if (!next) return t().top;
    if (lang()==='de') return `FORTSCHRITT ZU ${next.label}`;
    if (lang()==='fr') return `PROGRESSION VERS ${next.label}`;
    return `PROGRESS TO ${next.label}`;
  }
  function remainingText(value,rank){
    if (!nextRank(rank)) return t().top;
    const amount=Math.max(0,Math.round(rank.high-Number(value||0)));
    return `${amount} ${t().left}`;
  }

  async function loadCanonicalIcons(){
    if (iconPromise) return iconPromise;
    iconPromise = (async()=>{
      try{
        const html = await fetch('index.html',{cache:'force-cache'}).then(r=>r.text());
        const unranked = html.match(/(?:const|let|var)\s+UNRANKED_ICON\s*=\s*['\"]([^'\"]+)['\"]/);
        if (unranked) iconCache.unranked = unranked[1];
        for (const rank of RANKS) {
          const objectKey = new RegExp(`["']?${rank.key}["']?\\s*:\\s*["']([^"']+)["']`,'i');
          const indexedKey = new RegExp(`RANK_ICONS\\s*\\[\\s*["']${rank.key}["']\\s*\\]\\s*=\\s*["']([^"']+)["']`,'i');
          const hit = html.match(objectKey) || html.match(indexedKey);
          if (hit) iconCache.ranks[rank.key] = hit[1];
        }
      } catch (_) {}
      return iconCache;
    })();
    return iconPromise;
  }

  function rankGraphic(rank,cls=''){
    const src = iconCache.ranks[rank.key];
    return src
      ? `<img class="${cls}" src="${src}" alt="${rank.label}">`
      : `<div class="rank-icon-fallback ${cls}" aria-hidden="true">${rank.symbol}</div>`;
  }

  function build(){
    if (overlay) return;
    overlay = document.createElement('section');
    overlay.id = 'playRankUpdateOverlay';
    overlay.hidden = true;
    overlay.tabIndex = -1;
    gameStage.appendChild(overlay);
    overlay.addEventListener('click',event=>{
      if (event.target === overlay || event.target.closest('[data-play-rank-close]')) handleClose(false);
    });
  }

  async function animationState(){
    const {data,error} = await db.rpc('get_my_animation_state');
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  }
  async function acknowledge(){
    const {error} = await db.rpc('ack_my_animation_state');
    if (error) throw error;
  }
  function hasUnseen(st){
    return !!st && Number(st.current_finalized_games||0) > Number(st.seen_finalized_games||0);
  }

  function actionButtonLabel(mode){ return mode === 'close' ? t().close : t().skip; }
  function updateActionButton(mode){
    const button = overlay?.querySelector('.cta-button');
    if (!button) return;
    const label = actionButtonLabel(mode);
    button.textContent = label;
    button.setAttribute('aria-label',label);
  }

  function placementMarkup(st){
    const c=t();
    const done=clampPlacement(st.current_placement_games);
    const fallbackBefore=Math.max(0,done-1);
    const seenRaw=Number(st.seen_placement_games);
    const beforeDone=Number.isFinite(seenRaw) ? Math.min(done,clampPlacement(seenRaw)) : fallbackBefore;
    const completed=!!st.current_is_ranked;
    const rank=completed?rankFor(Number(st.current_rating||0)):null;
    const emblem=completed
      ? rankGraphic(rank)
      : iconCache.unranked
        ? `<img src="${iconCache.unranked}" alt="Unranked">`
        : `<div class="placement-fallback-emblem" aria-hidden="true">◇</div>`;
    const nodes=Array.from({length:15},(_,i)=>{
      const doneBefore=i<beforeDone;
      const newlyDone=i>=beforeDone && i<done;
      return `<span class="placement-node ${doneBefore?'done':''} ${newlyDone?'play-new-placement':''}" data-placement-index="${i+1}"></span>`;
    }).join('');
    const beforeFill=placementFill(beforeDone);
    const afterFill=placementFill(done);
    return `
      <section class="placement-modal ${completed?'placement-ranked-complete':''}" role="dialog" aria-modal="true" aria-labelledby="playPlacementTitle">
        <button class="modal-close" type="button" data-play-rank-close aria-label="Close">×</button>
        <span class="placement-kicker">${completed?'PLACEMENTS COMPLETE':`${c.placementKicker} · ROUND ${done}`}</span>
        <h2 id="playPlacementTitle">${completed?c.currentRank:c.placements}</h2>
        <p class="placement-subtitle">${completed?(lang()==='de'?'Deine 15 Einrangungsmatches sind abgeschlossen.':lang()==='fr'?'Tes 15 matchs de placement sont terminés.':'Your 15 placement games are complete.'):c.placementSubtitle}</p>
        <div class="unranked-badge-wrap">${emblem}</div>
        <span class="placement-rank-label">${completed?c.currentRank:c.currentStatus}</span>
        <strong class="placement-rank-name">${completed?rank.label:c.unranked}</strong>
        <div class="placement-progress-copy">${completed?`<b>${Math.round(Number(st.current_rating||0))}</b> RATING`:`${c.progress}: <b>${done}/15</b>`}</div>
        ${completed?'':`<div class="placement-track" data-before-fill="${beforeFill}" data-after-fill="${afterFill}"><i class="placement-progress-fill" style="width:${beforeFill}%;transition:none"></i>${nodes}</div>`}
        <p class="placement-help">${completed?(lang()==='de'?'Ab jetzt zählt jedes weitere Game als normales Ranked-Game.':lang()==='fr'?'Les prochaines parties utilisent maintenant le système Ranked normal.':'Future games now use the normal Ranked system.'):c.help}</p>
        <button class="cta-button" type="button" data-play-rank-close>${c.skip}</button>
      </section>`;
  }

  function ratedMarkup(st){
    const c=t();
    const before=Number(st.seen_rating||st.current_rating||0);
    const after=Number(st.current_rating||before);
    const oldRank=rankFor(before),newRank=rankFor(after);
    const beforePct=pct(before,oldRank),afterPct=pct(after,newRank);
    const delta=after-before;
    const gameNo=Number(st.current_finalized_games||0);
    const rankChanged=oldRank.key!==newRank.key;
    const rankUp=rankChanged&&after>before;
    return `
      <section class="rank-update-modal" id="rankUpdateCard" role="dialog" aria-modal="true" aria-labelledby="rankUpdateTitle"
        data-rating-before="${before}" data-rating-after="${after}" data-before-pct="${beforePct}" data-after-pct="${afterPct}"
        data-old-rank="${oldRank.key}" data-new-rank="${newRank.key}" data-rank-changed="${rankChanged?'1':'0'}" data-rank-up="${rankUp?'1':'0'}">
        <button class="modal-close" type="button" data-play-rank-close aria-label="Close">×</button>
        <div class="rank-update-grid">
          <div class="rank-update-visual">
            <span class="update-kicker" id="updateKicker">${c.rankKicker}${gameNo?` · GAME ${gameNo}`:''}</span>
            <h2 id="rankUpdateTitle">${c.rankTitle}</h2>
            <div class="update-rank-icon" id="updateRankIconWrap"><div class="rankup-flare" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>${rankGraphic(oldRank)}</div>
            <span class="update-rank-name" id="updateRankName">${oldRank.label}</span>
            <div class="rankup-message" id="rankUpMessage" hidden><small>${c.rankUp}</small><strong id="newRankName">${newRank.label}</strong></div>
          </div>
          <div class="rank-update-data">
            <div class="rating-change"><span id="ratingBefore">${Math.round(before)}</span><i>→</i><strong id="ratingAfter">${Math.round(after)}</strong></div>
            <div class="delta ${delta>0?'positive':delta<0?'negative':'neutral'}" id="ratingDelta">${delta>=0?'+':''}${Math.round(delta)} ${c.rating}</div>
            <div class="progress-wrap update-progress">
              <div class="progress-meta"><span id="updateProgressTitle">${progressTitle(oldRank)}</span><b id="updateProgressPct">${Math.round(beforePct)}%</b></div>
              <div class="rank-progress thick-progress"><i id="animatedUpdateBar" style="width:${beforePct}%;transition:none"></i></div>
              <div class="progress-scale"><span id="updateLow">${Math.round(oldRank.min)}</span><span id="updateRemaining">${remainingText(before,oldRank)}</span><span id="updateHigh">${oldRank.key==='grandmaster'?'3000+':Math.round(oldRank.high)}</span></div>
            </div>
            <button class="cta-button wide" type="button" data-play-rank-close>${c.skip}</button>
          </div>
        </div>
      </section>`;
  }

  function forceOverlayFocus(){
    if (!overlay || overlay.hidden) return;
    try{window.focus();}catch(_){}
    try{document.exitPointerLock?.();}catch(_){}
    try{bloxdFrame?.blur();}catch(_){}
    try{overlay.focus({preventScroll:true});}catch(_){try{overlay.focus();}catch(__){}}
  }

  function pauseGameForRankOverlay(){
    if (!bloxdFrame) return;
    previousFrameTabIndex=bloxdFrame.getAttribute('tabindex');
    bloxdFrame.setAttribute('tabindex','-1');
    bloxdFrame.style.pointerEvents='none';
    try{bloxdFrame.blur();}catch(_){}
  }

  function resumeGameAfterRankOverlay(){
    if (!bloxdFrame) return;
    if (previousFrameTabIndex == null) bloxdFrame.removeAttribute('tabindex');
    else bloxdFrame.setAttribute('tabindex',previousFrameTabIndex);
    previousFrameTabIndex=null;
    bloxdFrame.style.removeProperty('pointer-events');
    setTimeout(()=>{try{bloxdFrame.focus();}catch(_){}},0);
  }

  function clearAnimationWork(){
    clearTimeout(startTimer); startTimer=0;
    clearTimeout(animationTimer); animationTimer=0;
    clearTimeout(nodeTimer); nodeTimer=0;
    clearTimeout(switchTimer); switchTimer=0;
    if (progressFrame) cancelAnimationFrame(progressFrame);
    progressFrame=0;
  }

  function applyPlacementFinal(){
    const track=overlay?.querySelector('.placement-track');
    if (!track) return;
    const fill=track.querySelector('.placement-progress-fill');
    const target=Number(track.dataset.afterFill||0);
    if (fill){fill.style.transition='none';fill.style.width=`${target}%`;}
    track.querySelectorAll('.play-new-placement').forEach(node=>node.classList.add('done','latest','no-pop'));
  }

  function setRankStage(rank,value,progressValue){
    const card=overlay?.querySelector('#rankUpdateCard');
    if (!card) return;
    const iconWrap=card.querySelector('#updateRankIconWrap');
    const rankNameEl=card.querySelector('#updateRankName');
    const title=card.querySelector('#updateProgressTitle');
    const pctEl=card.querySelector('#updateProgressPct');
    const low=card.querySelector('#updateLow');
    const high=card.querySelector('#updateHigh');
    const remaining=card.querySelector('#updateRemaining');
    if (iconWrap) {
      const nextGraphic=document.createElement('div');
      nextGraphic.innerHTML=rankGraphic(rank);
      const nextNode=nextGraphic.firstElementChild;
      const currentGraphic=Array.from(iconWrap.children).find(el=>!el.classList.contains('rankup-flare'));
      if (currentGraphic && nextNode) currentGraphic.replaceWith(nextNode);
      else if (nextNode) iconWrap.appendChild(nextNode);
    }
    if (rankNameEl) rankNameEl.textContent=rank.label;
    if (title) title.textContent=progressTitle(rank);
    if (pctEl) pctEl.textContent=`${Math.round(progressValue)}%`;
    if (low) low.textContent=String(Math.round(rank.min));
    if (high) high.textContent=rank.key==='grandmaster'?'3000+':String(Math.round(rank.high));
    if (remaining) remaining.textContent=remainingText(value,rank);
  }

  function applyRankFinal(){
    const card=overlay?.querySelector('#rankUpdateCard');
    if (!card) return;
    const after=Number(card.dataset.ratingAfter||0);
    const afterPct=Number(card.dataset.afterPct||0);
    const newRank=RANKS.find(rank=>rank.key===card.dataset.newRank)||rankFor(after);
    const bar=card.querySelector('#animatedUpdateBar');
    const rankUp=card.dataset.rankUp==='1';
    setRankStage(newRank,after,afterPct);
    if (bar){bar.style.transition='none';bar.style.width=`${afterPct}%`;}
    const message=card.querySelector('#rankUpMessage');
    if (message) message.hidden=!rankUp;
    const newName=card.querySelector('#newRankName');
    if (newName) newName.textContent=newRank.label;
    card.classList.remove('rank-up');
  }

  function applyFinalVisuals(){
    if (!activeState) return;
    if (activeState.seen_is_ranked) applyRankFinal();
    else applyPlacementFinal();
  }

  function markAnimationDone(){
    if (!overlay || overlay.hidden) return;
    clearAnimationWork();
    applyFinalVisuals();
    overlay.dataset.animationState='done';
    updateActionButton('close');
  }

  function finishAnimationImmediately(){
    if (!overlay || overlay.hidden || overlay.dataset.animationState!=='running') return false;
    clearAnimationWork();
    overlay.classList.add('is-instant','is-animating');
    applyFinalVisuals();
    overlay.dataset.animationState='done';
    updateActionButton('close');
    forceOverlayFocus();
    return true;
  }

  function animatePlacement(){
    const track=overlay?.querySelector('.placement-track');
    if (!track){animationTimer=setTimeout(markAnimationDone,600);return;}
    const fill=track.querySelector('.placement-progress-fill');
    const target=Number(track.dataset.afterFill||0);
    if (fill){
      fill.style.transition=`width ${PLACEMENT_LINE_MS}ms cubic-bezier(.2,.75,.2,1)`;
      fill.style.width=`${target}%`;
    }
    nodeTimer=setTimeout(()=>{
      if (!overlay || overlay.hidden || overlay.dataset.animationState!=='running') return;
      track.querySelectorAll('.play-new-placement').forEach(node=>node.classList.add('done','latest'));
    },PLACEMENT_LINE_MS-100);
    animationTimer=setTimeout(markAnimationDone,PLACEMENT_ANIMATION_MS);
  }

  function animateProgressNumber(from,to,duration){
    if (progressFrame) cancelAnimationFrame(progressFrame);
    const pctEl=overlay?.querySelector('#updateProgressPct');
    const started=performance.now();
    const tick=now=>{
      if (!overlay || overlay.hidden || overlay.dataset.animationState!=='running') return;
      const p=Math.min(1,(now-started)/duration);
      if (pctEl) pctEl.textContent=`${Math.round(from+(to-from)*p)}%`;
      if (p<1) progressFrame=requestAnimationFrame(tick);
    };
    progressFrame=requestAnimationFrame(tick);
  }

  function animateRanked(){
    const card=overlay?.querySelector('#rankUpdateCard');
    if (!card){animationTimer=setTimeout(markAnimationDone,RANK_SEGMENT_MS);return;}
    const before=Number(card.dataset.ratingBefore||0);
    const after=Number(card.dataset.ratingAfter||before);
    const beforePct=Number(card.dataset.beforePct||0);
    const afterPct=Number(card.dataset.afterPct||beforePct);
    const oldRank=RANKS.find(rank=>rank.key===card.dataset.oldRank)||rankFor(before);
    const newRank=RANKS.find(rank=>rank.key===card.dataset.newRank)||rankFor(after);
    const rankChanged=card.dataset.rankChanged==='1';
    const rankUp=card.dataset.rankUp==='1';
    const bar=card.querySelector('#animatedUpdateBar');

    card.style.setProperty('--hub-rank-pulse-duration','2.33s');
    card.style.setProperty('--hub-rank-pulse-delay','3.67s');
    card.style.setProperty('--hub-flare-duration','2.5s');
    card.style.setProperty('--hub-flare-delay','3.67s');
    card.style.setProperty('--hub-icon-duration','3s');
    card.style.setProperty('--hub-icon-delay','3.42s');
    if (rankUp) card.classList.add('rank-up');

    if (!rankChanged) {
      if (bar){bar.style.transition=`width ${RANK_SEGMENT_MS}ms cubic-bezier(.2,.75,.2,1)`;bar.style.width=`${afterPct}%`;}
      animateProgressNumber(beforePct,afterPct,RANK_SEGMENT_MS);
      animationTimer=setTimeout(markAnimationDone,RANK_SEGMENT_MS+80);
      return;
    }

    const firstTarget=rankUp?100:0;
    if (bar){bar.style.transition=`width ${RANK_SEGMENT_MS}ms cubic-bezier(.2,.75,.2,1)`;bar.style.width=`${firstTarget}%`;}
    animateProgressNumber(beforePct,firstTarget,RANK_SEGMENT_MS);

    switchTimer=setTimeout(()=>{
      if (!overlay || overlay.hidden || overlay.dataset.animationState!=='running') return;
      setRankStage(newRank,after,rankUp?0:100);
      const message=card.querySelector('#rankUpMessage');
      if (message) message.hidden=!rankUp;
      const newName=card.querySelector('#newRankName');
      if (newName) newName.textContent=newRank.label;
      if (bar){
        bar.style.transition='none';
        bar.style.width=rankUp?'0%':'100%';
        void bar.offsetWidth;
        bar.style.transition=`width ${RANK_SEGMENT_MS}ms cubic-bezier(.2,.75,.2,1)`;
        bar.style.width=`${afterPct}%`;
      }
      animateProgressNumber(rankUp?0:100,afterPct,RANK_SEGMENT_MS);
    },RANK_SEGMENT_MS+80);
    animationTimer=setTimeout(markAnimationDone,(RANK_SEGMENT_MS*2)+180);
  }

  function beginAnimation(st){
    clearAnimationWork();
    overlay.dataset.animationState='running';
    updateActionButton('skip');
    startTimer=setTimeout(()=>{
      if (!overlay || overlay.hidden || overlay.dataset.animationState!=='running') return;
      overlay.classList.add('is-animating');
      if (st.seen_is_ranked) animateRanked();
      else animatePlacement();
    },PRE_ANIMATION_HOLD_MS);
  }

  async function open(st){
    build();
    await loadCanonicalIcons();
    activeState=st;
    clearTimeout(closeTimer);
    clearAnimationWork();
    overlay.innerHTML=!st.seen_is_ranked?placementMarkup(st):ratedMarkup(st);
    overlay.hidden=false;
    overlay.classList.remove('is-closing','is-instant','is-animating');
    overlay.dataset.animationState='idle';
    document.body.classList.add('hub-play-rank-update-open');
    pauseGameForRankOverlay();
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    forceOverlayFocus();
    [20,60,120,240].forEach(delay=>setTimeout(()=>{if (overlay && !overlay.hidden) forceOverlayFocus();},delay));
    beginAnimation(st);
    try{window.postMessage({type:'OVERLAY_OPEN'},'*');}catch(_){}
  }

  async function handleClose(instant){
    if (!overlay || overlay.hidden) return;
    if (!instant && finishAnimationImmediately()) return;
    clearAnimationWork();
    try{await acknowledge();}catch(error){console.warn('[The HUB] Could not acknowledge PLAY rank update',error);}
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open');
    closeTimer=setTimeout(()=>{
      overlay.hidden=true;
      overlay.innerHTML='';
      overlay.dataset.animationState='idle';
      overlay.classList.remove('is-closing','is-animating','is-instant');
      document.body.classList.remove('hub-play-rank-update-open');
      activeState=null;
      resumeGameAfterRankOverlay();
      try{window.postMessage({type:'OVERLAY_CLOSE'},'*');}catch(_){}
    },220);
  }

  async function showPendingAfterCup(){
    if (busy || !roundOverlay.hidden || document.hidden) return;
    busy=true;
    try{
      const {data:{session}}=await db.auth.getSession();
      if (!session) return;
      const st=await animationState();
      if (!hasUnseen(st)) return;
      const {data:profile,error:profileError}=await db.rpc('get_my_profile');
      if (profileError) throw profileError;
      if (profile?.ranking_experience_enabled===false){await acknowledge();return;}
      await open(st);
    }catch(error){console.warn('[The HUB] PLAY competitive update unavailable',error);}
    finally{busy=false;}
  }

  const observer=new MutationObserver(mutations=>{
    if (!mutations.some(m=>m.type==='attributes'&&m.attributeName==='hidden')) return;
    if (!roundOverlay.hidden){hadRoundOverlayOpen=true;return;}
    if (hadRoundOverlayOpen){hadRoundOverlayOpen=false;setTimeout(showPendingAfterCup,180);}
  });
  observer.observe(roundOverlay,{attributes:true,attributeFilter:['hidden']});

  document.addEventListener('focusin',event=>{
    if (!overlay || overlay.hidden) return;
    if (event.target===bloxdFrame) setTimeout(forceOverlayFocus,0);
  },true);

  document.addEventListener('keydown',event=>{
    if (!overlay || overlay.hidden || (event.code!=='Space'&&event.key!==' ')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (!finishAnimationImmediately()) handleClose(false);
  },true);
})();
