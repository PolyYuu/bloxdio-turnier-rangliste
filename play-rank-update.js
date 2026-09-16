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

  const RANK_ANIMATION_MS = 3700;
  const PLACEMENT_ANIMATION_MS = 1800;

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
    de:{placementKicker:'PLACEMENT UPDATE',placements:'DEINE EINRANGUNG',placementSubtitle:'Schließe 15 Ranked-Runden ab, um deinen ersten Rang freizuschalten.',currentStatus:'AKTUELLER STATUS',progress:'EINRANGUNGSFORTSCHRITT',help:'Nur abgeschlossene Matches werden markiert. Dein verstecktes Rating wird während der Einrangung nicht angezeigt.',unranked:'UNRANKED',continue:'WEITER',rankKicker:'RANKED UPDATE',rankTitle:'DEIN FORTSCHRITT',rankSubtitle:'So hat sich dein Competitive Rating nach dieser Runde verändert.',rating:'RATING',toNext:'FORTSCHRITT ZUM NÄCHSTEN RANG',top:'HÖCHSTER RANG',left:'übrig',currentRank:'AKTUELLER RANG'},
    en:{placementKicker:'PLACEMENT UPDATE',placements:'YOUR PLACEMENTS',placementSubtitle:'Complete 15 ranked rounds to reveal your first rank.',currentStatus:'CURRENT STATUS',progress:'PLACEMENT PROGRESS',help:'Only completed matches are marked. Your hidden rating is not shown during placements.',unranked:'UNRANKED',continue:'CONTINUE',rankKicker:'RANKED UPDATE',rankTitle:'YOUR PROGRESS',rankSubtitle:'This is how your competitive rating changed after this round.',rating:'RATING',toNext:'PROGRESS TO NEXT RANK',top:'TOP RANK',left:'left',currentRank:'CURRENT RANK'},
    fr:{placementKicker:'MISE À JOUR PLACEMENT',placements:'TES PLACEMENTS',placementSubtitle:'Termine 15 manches classées pour révéler ton premier rang.',currentStatus:'STATUT ACTUEL',progress:'PROGRESSION PLACEMENT',help:'Seuls les matchs terminés sont marqués. Ton rating caché reste invisible pendant les placements.',unranked:'UNRANKED',continue:'CONTINUER',rankKicker:'MISE À JOUR RANKED',rankTitle:'TA PROGRESSION',rankSubtitle:'Voici comment ton rating compétitif a changé après cette manche.',rating:'RATING',toNext:'PROGRESSION VERS LE RANG SUIVANT',top:'RANG MAXIMAL',left:'restants',currentRank:'RANG ACTUEL'}
  };

  let overlay = null;
  let busy = false;
  let activeState = null;
  let closeTimer = 0;
  let animationTimer = 0;
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
  function rankFor(value){
    const n = Number(value || 0);
    return RANKS.slice().reverse().find(r => n >= r.min) || RANKS[0];
  }
  function pct(value,rank){
    if (!rank || rank.key === 'grandmaster') return 100;
    return Math.max(0,Math.min(100,(Number(value)-rank.min)/(rank.high-rank.min)*100));
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
      if (event.target === overlay) handleClose(false);
      if (event.target.closest('[data-play-rank-close]')) handleClose(false);
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

  function placementMarkup(st){
    const c=t();
    const done=Math.max(0,Math.min(15,Number(st.current_placement_games||0)));
    const completed=!!st.current_is_ranked;
    const rank=completed?rankFor(Number(st.current_rating||0)):null;
    const emblem=completed
      ? rankGraphic(rank)
      : iconCache.unranked
        ? `<img src="${iconCache.unranked}" alt="Unranked">`
        : `<div class="placement-fallback-emblem" aria-hidden="true">◇</div>`;
    const nodes=Array.from({length:15},(_,i)=>`<span class="placement-node ${i<done?'done':''} ${i===done-1?'latest':''}"></span>`).join('');
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
        ${completed?'':`<div class="placement-track" style="--placement-fill:${done<=1?0:((done-1)/14*93.8)}%"><i class="placement-progress-fill"></i>${nodes}</div>`}
        <p class="placement-help">${completed?(lang()==='de'?'Ab jetzt zählt jedes weitere Game als normales Ranked-Game.':lang()==='fr'?'Les prochaines parties utilisent maintenant le système Ranked normal.':'Future games now use the normal Ranked system.'):c.help}</p>
        <button class="cta-button" type="button" data-play-rank-close>${c.continue}</button>
      </section>`;
  }

  function ratedMarkup(st){
    const c=t();
    const before=Number(st.seen_rating||st.current_rating||0);
    const after=Number(st.current_rating||before);
    const oldRank=rankFor(before),newRank=rankFor(after);
    const delta=after-before;
    const afterPct=pct(after,newRank);
    const gameNo=Number(st.current_finalized_games||0);
    return `
      <section class="rank-update-modal" role="dialog" aria-modal="true" aria-labelledby="playRankTitle">
        <button class="modal-close" type="button" data-play-rank-close aria-label="Close">×</button>
        <div class="rank-update-header">
          <span class="update-kicker">${c.rankKicker}${gameNo?` · GAME ${gameNo}`:''}</span>
          <h2 id="playRankTitle">${c.rankTitle}</h2>
          <p class="rank-update-subtitle">${c.rankSubtitle}</p>
        </div>
        <div class="rank-transition-wrap">
          <div class="rank-transition-rank old-rank">${rankGraphic(oldRank)}<strong>${oldRank.label}</strong></div>
          <i class="rank-transition-arrow">→</i>
          <div class="rank-transition-rank new-rank">${rankGraphic(newRank)}<strong>${newRank.label}</strong></div>
        </div>
        <div class="rank-rating-change"><span>${Math.round(before)}</span><i>→</i><strong>${Math.round(after)}</strong></div>
        <div class="rank-delta ${delta>0?'positive':delta<0?'negative':'neutral'}">${delta>=0?'+':''}${Math.round(delta)} ${c.rating}</div>
        <div class="progress-wrap">
          <div class="progress-meta"><span>${newRank.key==='grandmaster'?c.top:c.toNext}</span><b>${Math.round(afterPct)}%</b></div>
          <div class="rank-progress"><i></i></div>
          <div class="progress-scale"><span>${Math.round(newRank.min)}</span><span>${newRank.key==='grandmaster'?c.top:`${Math.max(0,Math.round(newRank.high-after))} ${c.left}`}</span><span>${newRank.key==='grandmaster'?'3000+':Math.round(newRank.high)}</span></div>
        </div>
        <button class="cta-button" type="button" data-play-rank-close>${c.continue}</button>
      </section>`;
  }

  function forceOverlayFocus(){
    if (!overlay || overlay.hidden) return;
    try{window.focus();}catch(_){}
    try{document.exitPointerLock?.();}catch(_){}
    try{bloxdFrame?.blur();}catch(_){}
    try{overlay.focus({preventScroll:true});}
    catch(_){try{overlay.focus();}catch(__){}}
  }

  function pauseGameForRankOverlay(){
    if (!bloxdFrame) return;
    previousFrameTabIndex = bloxdFrame.getAttribute('tabindex');
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

  function markAnimationDone(){
    if (!overlay || overlay.hidden) return;
    clearTimeout(animationTimer);
    animationTimer=0;
    overlay.dataset.animationState='done';
    overlay.classList.add('rank-transition-arrived');
  }

  function finishAnimationImmediately(){
    if (!overlay || overlay.hidden || overlay.dataset.animationState!=='running') return false;
    clearTimeout(animationTimer);
    animationTimer=0;
    overlay.classList.add('is-instant','is-animating','rank-transition-arrived');
    overlay.dataset.animationState='done';
    forceOverlayFocus();
    return true;
  }

  function beginAnimation(st){
    clearTimeout(animationTimer);
    overlay.dataset.animationState='running';
    requestAnimationFrame(()=>{
      if (!overlay || overlay.hidden) return;
      overlay.classList.add('is-animating','rank-transition-arrived');
      animationTimer=setTimeout(markAnimationDone,st.seen_is_ranked?RANK_ANIMATION_MS:PLACEMENT_ANIMATION_MS);
    });
  }

  async function open(st){
    build();
    await loadCanonicalIcons();
    activeState=st;
    clearTimeout(closeTimer);
    clearTimeout(animationTimer);
    overlay.innerHTML = !st.seen_is_ranked ? placementMarkup(st) : ratedMarkup(st);
    overlay.style.setProperty('--rank-before-pct',`${!st.seen_is_ranked?0:(rankFor(Number(st.seen_rating||0)).key===rankFor(Number(st.current_rating||0)).key?pct(Number(st.seen_rating||0),rankFor(Number(st.seen_rating||0))):0)}%`);
    overlay.style.setProperty('--rank-after-pct',`${!st.seen_is_ranked?0:pct(Number(st.current_rating||0),rankFor(Number(st.current_rating||0)))}%`);
    overlay.hidden=false;
    overlay.classList.remove('is-closing','is-instant','is-animating','rank-transition-arrived');
    overlay.dataset.animationState='idle';
    document.body.classList.add('hub-play-rank-update-open');
    pauseGameForRankOverlay();
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    forceOverlayFocus();
    [20,60,120,240].forEach(delay=>setTimeout(()=>{
      if (overlay && !overlay.hidden) forceOverlayFocus();
    },delay));
    beginAnimation(st);
    try{window.postMessage({type:'OVERLAY_OPEN'},'*');}catch(_){}
  }

  async function handleClose(instant){
    if (!overlay || overlay.hidden) return;
    if (!instant && finishAnimationImmediately()) return;

    clearTimeout(animationTimer);
    animationTimer=0;
    try{await acknowledge();}catch(error){console.warn('[The HUB] Could not acknowledge PLAY rank update',error);}
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open');
    closeTimer=setTimeout(()=>{
      overlay.hidden=true;
      overlay.innerHTML='';
      overlay.dataset.animationState='idle';
      overlay.classList.remove('is-closing','is-animating','is-instant','rank-transition-arrived');
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
    if (!overlay || overlay.hidden || (event.code!=='Space' && event.key!==' ')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!finishAnimationImmediately()) handleClose(false);
  },true);
})();
