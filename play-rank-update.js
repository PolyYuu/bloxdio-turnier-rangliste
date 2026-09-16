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
    de:{kicker:'COMPETITIVE UPDATE',title:'Dein Rang wurde aktualisiert',placementTitle:'Einrangspiel abgeschlossen',placementCopy:'Dein Competitive-Fortschritt wurde aktualisiert.',rankCopy:'So hat sich dein Competitive Rating nach dieser Runde verändert.',rating:'RATING',progress:'FORTSCHRITT ZUM NÄCHSTEN RANG',top:'HÖCHSTER RANG',left:'übrig',continue:'WEITERSPIELEN',placement:'EINRANGSPIELE',unranked:'UNRANKED'},
    en:{kicker:'COMPETITIVE UPDATE',title:'Your rank was updated',placementTitle:'Placement game complete',placementCopy:'Your competitive progress has been updated.',rankCopy:'This is how your competitive rating changed after this round.',rating:'RATING',progress:'PROGRESS TO NEXT RANK',top:'TOP RANK',left:'left',continue:'CONTINUE PLAYING',placement:'PLACEMENTS',unranked:'UNRANKED'},
    fr:{kicker:'MISE À JOUR COMPÉTITIVE',title:'Ton rang a été mis à jour',placementTitle:'Match de placement terminé',placementCopy:'Ta progression compétitive a été mise à jour.',rankCopy:'Voici comment ton rating compétitif a changé après cette manche.',rating:'RATING',progress:'PROGRESSION VERS LE RANG SUIVANT',top:'RANG MAXIMAL',left:'restants',continue:'CONTINUER',placement:'PLACEMENTS',unranked:'UNRANKED'}
  };

  let overlay = null;
  let busy = false;
  let activeState = null;
  let closeTimer = 0;
  let hadRoundOverlayOpen = !roundOverlay.hidden;

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
  function pct(value, rank){
    if (!rank || rank.key === 'grandmaster') return 100;
    return Math.max(0,Math.min(100,(Number(value)-rank.min)/(rank.high-rank.min)*100));
  }

  function build(){
    if (overlay) return;
    overlay = document.createElement('section');
    overlay.id = 'playRankUpdateOverlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <article class="play-rank-update-card" role="dialog" aria-modal="true" aria-labelledby="playRankUpdateTitle">
        <button type="button" class="play-rank-update-close" aria-label="Close">×</button>
        <div class="play-rank-update-grid">
          <div class="play-rank-update-visual">
            <div class="play-rank-update-orbit"><div class="play-rank-update-symbol">◇</div></div>
            <strong class="play-rank-update-rank">UNRANKED</strong>
            <span class="play-rank-update-rating"></span>
          </div>
          <div class="play-rank-update-data">
            <span class="play-rank-update-kicker"></span>
            <h2 id="playRankUpdateTitle"></h2>
            <p class="play-rank-update-copy"></p>
            <div class="play-rank-rated-view">
              <div class="play-rank-rating-change"><span></span><i>→</i><strong></strong></div>
              <div class="play-rank-delta"></div>
              <div class="play-rank-progress-meta"><span></span><b></b></div>
              <div class="play-rank-progress"><i></i></div>
              <div class="play-rank-progress-scale"><span></span><span></span><span></span></div>
            </div>
            <div class="play-rank-placement-view" hidden>
              <div class="play-placement-count"><strong></strong><small>/ 15</small></div>
              <div class="play-rank-progress-meta"><span></span><b></b></div>
              <div class="play-placement-dots"></div>
            </div>
            <button type="button" class="play-rank-update-button"></button>
          </div>
        </div>
      </article>`;
    gameStage.appendChild(overlay);

    overlay.querySelector('.play-rank-update-close').addEventListener('click', () => handleClose(false));
    overlay.querySelector('.play-rank-update-button').addEventListener('click', () => handleClose(false));
    overlay.addEventListener('click', event => { if (event.target === overlay) handleClose(false); });
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
    if (!st) return false;
    return Number(st.current_finalized_games || 0) > Number(st.seen_finalized_games || 0);
  }

  function fillRated(st){
    const c = t();
    const before = Number(st.seen_rating || st.current_rating || 0);
    const after = Number(st.current_rating || before);
    const beforeRank = rankFor(before);
    const afterRank = rankFor(after);
    const delta = after-before;
    const afterPct = pct(after,afterRank);
    const beforePct = beforeRank.key === afterRank.key ? pct(before,beforeRank) : 0;

    overlay.classList.remove('is-placement');
    overlay.querySelector('.play-rank-rated-view').hidden = false;
    overlay.querySelector('.play-rank-placement-view').hidden = true;
    overlay.querySelector('.play-rank-update-kicker').textContent = c.kicker;
    overlay.querySelector('#playRankUpdateTitle').textContent = c.title;
    overlay.querySelector('.play-rank-update-copy').textContent = c.rankCopy;
    overlay.querySelector('.play-rank-update-symbol').textContent = afterRank.symbol;
    overlay.querySelector('.play-rank-update-rank').textContent = afterRank.label;
    overlay.querySelector('.play-rank-update-rating').textContent = `${Math.round(after)} RP`;
    const change = overlay.querySelector('.play-rank-rating-change');
    change.querySelector('span').textContent = Math.round(before);
    change.querySelector('strong').textContent = Math.round(after);
    const deltaEl = overlay.querySelector('.play-rank-delta');
    deltaEl.textContent = `${delta>=0?'+':''}${Math.round(delta)} ${c.rating}`;
    deltaEl.className = `play-rank-delta ${delta>0?'positive':delta<0?'negative':'neutral'}`;
    const meta = overlay.querySelector('.play-rank-progress-meta');
    meta.querySelector('span').textContent = afterRank.key === 'grandmaster' ? c.top : c.progress;
    meta.querySelector('b').textContent = `${Math.round(afterPct)}%`;
    const scale = overlay.querySelector('.play-rank-progress-scale');
    scale.children[0].textContent = Math.round(afterRank.min);
    scale.children[1].textContent = afterRank.key === 'grandmaster' ? c.top : `${Math.max(0,Math.round(afterRank.high-after))} ${c.left}`;
    scale.children[2].textContent = afterRank.key === 'grandmaster' ? '3000+' : Math.round(afterRank.high);
    overlay.style.setProperty('--rank-before-pct',`${beforePct}%`);
    overlay.style.setProperty('--rank-after-pct',`${afterPct}%`);
  }

  function fillPlacement(st){
    const c = t();
    const done = Math.max(0,Math.min(15,Number(st.current_placement_games || 0)));
    const completed = !!st.current_is_ranked;
    const rank = completed ? rankFor(Number(st.current_rating || 0)) : null;

    overlay.classList.add('is-placement');
    overlay.querySelector('.play-rank-rated-view').hidden = true;
    overlay.querySelector('.play-rank-placement-view').hidden = false;
    overlay.querySelector('.play-rank-update-kicker').textContent = c.kicker;
    overlay.querySelector('#playRankUpdateTitle').textContent = completed ? c.title : c.placementTitle;
    overlay.querySelector('.play-rank-update-copy').textContent = c.placementCopy;
    overlay.querySelector('.play-rank-update-symbol').textContent = completed ? rank.symbol : '○';
    overlay.querySelector('.play-rank-update-rank').textContent = completed ? rank.label : c.unranked;
    overlay.querySelector('.play-rank-update-rating').textContent = completed ? `${Math.round(Number(st.current_rating||0))} RP` : `${done} / 15`;
    overlay.querySelector('.play-placement-count strong').textContent = done;
    const meta = overlay.querySelector('.play-rank-placement-view .play-rank-progress-meta');
    meta.querySelector('span').textContent = c.placement;
    meta.querySelector('b').textContent = `${Math.round(done/15*100)}%`;
    const dots = overlay.querySelector('.play-placement-dots');
    dots.innerHTML = Array.from({length:15},(_,i)=>`<i class="${i<done?'done':''} ${i===done-1?'latest':''}"></i>`).join('');
  }

  function open(st){
    build();
    activeState = st;
    clearTimeout(closeTimer);

    if (!st.seen_is_ranked) fillPlacement(st);
    else fillRated(st);

    overlay.querySelector('.play-rank-update-button').textContent = t().continue;
    overlay.hidden = false;
    overlay.classList.remove('is-closing','is-instant','is-animating');
    document.body.classList.add('hub-play-rank-update-open');
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add('is-animating')));
    try { window.postMessage({type:'OVERLAY_OPEN'},'*'); } catch (_) {}
  }

  async function handleClose(instant){
    if (!overlay || overlay.hidden) return;
    if (!instant && !overlay.classList.contains('is-instant')) {
      // First Continue while the visual is still animating finishes it immediately,
      // matching the Cup overlay skip/continue interaction.
      const started = overlay.classList.contains('is-animating');
      if (started && performance.now() - Number(overlay.dataset.openedAt || 0) < 3300) {
        overlay.classList.add('is-instant');
        return;
      }
    }
    try { await acknowledge(); } catch (error) { console.warn('[The HUB] Could not acknowledge PLAY rank update',error); }
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open');
    closeTimer = setTimeout(()=>{
      overlay.hidden = true;
      overlay.classList.remove('is-closing','is-animating','is-instant');
      document.body.classList.remove('hub-play-rank-update-open');
      activeState = null;
      try { window.postMessage({type:'OVERLAY_CLOSE'},'*'); } catch (_) {}
      try { bloxdFrame?.focus(); } catch (_) {}
    },220);
  }

  async function showPendingAfterCup(){
    if (busy || !roundOverlay.hidden || document.hidden) return;
    busy = true;
    try {
      const {data:{session}} = await db.auth.getSession();
      if (!session) return;
      const st = await animationState();
      if (!hasUnseen(st)) return;
      // Ranking experience disabled means the user opted out of rank animations;
      // acknowledge silently just like the normal HUB does.
      const {data:profile,error:profileError} = await db.rpc('get_my_profile');
      if (profileError) throw profileError;
      if (profile?.ranking_experience_enabled === false) {
        await acknowledge();
        return;
      }
      open(st);
      overlay.dataset.openedAt = String(performance.now());
    } catch (error) {
      console.warn('[The HUB] PLAY competitive update unavailable',error);
    } finally {
      busy = false;
    }
  }

  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => m.type === 'attributes' && m.attributeName === 'hidden')) return;
    if (!roundOverlay.hidden) {
      hadRoundOverlayOpen = true;
      return;
    }
    if (hadRoundOverlayOpen) {
      hadRoundOverlayOpen = false;
      // Give the round close/focus handlers a moment to finish before taking over.
      setTimeout(showPendingAfterCup,180);
    }
  });
  observer.observe(roundOverlay,{attributes:true,attributeFilter:['hidden']});

  // Space/click behavior: while the rank update is visible, first input skips animation,
  // second input closes and acknowledges it.
  document.addEventListener('keydown',event=>{
    if (!overlay || overlay.hidden || event.code !== 'Space') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleClose(false);
  },true);

  // Do not auto-show on page load. PLAY rank updates are deliberately chained only
  // after a Cup standings overlay was actually seen/closed on this page.
})();
