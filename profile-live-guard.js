(() => {
  'use strict';

  const core = window.HubV3;
  if (!core) return;

  const live = core.live || {};
  const originalRenderProfileLive = typeof core.renderProfileLive === 'function'
    ? core.renderProfileLive.bind(core)
    : null;

  const PROFILE_SELECTOR = '[data-profile-player],[data-player-profile],[data-open-player-profile]';
  const profilePage = () => document.querySelector('[data-page="profile"]');
  const profileName = () => document.querySelector('#profilePlayerName');

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function closeProfileSourceOverlay(profileTarget) {
    if (!profileTarget) return;

    const explicitOverlay = profileTarget.closest([
      '.v3-modal-backdrop',
      '.modal-backdrop',
      '.modal-overlay',
      '.cup-modal-backdrop',
      '.cup-detail-overlay',
      '.v3-cup-detail-overlay',
      '[class*="modal-backdrop"]',
      '[class*="detail-overlay"]',
      '[class*="cup-overlay"]',
      '[role="dialog"]'
    ].join(','));

    if (explicitOverlay) {
      const closeButton = explicitOverlay.querySelector('[data-v3-close],[data-close],.modal-close,.close-button,[aria-label="Close"],[aria-label="Schließen"]');
      if (closeButton) {
        try { closeButton.click(); } catch (_) {}
      }
      if (explicitOverlay.isConnected) explicitOverlay.remove();
    }

    // Cup/team detail cards have existed under a few different ids/classes over time.
    // Only run this when a player profile link was clicked, so stale detail overlays can never sit above PROFILE.
    document.querySelectorAll([
      '#v3CupDetailModal',
      '#cupDetailModal',
      '#teamDetailModal',
      '#v3TeamDetailModal',
      '[data-cup-detail-modal]',
      '[data-team-detail-modal]'
    ].join(',')).forEach(node => node.remove());

    const visibleModal = document.querySelector('.v3-modal-backdrop,.modal-backdrop,.modal-overlay,[class*="modal-backdrop"]');
    if (!visibleModal) {
      document.body.classList.remove('modal-open', 'no-scroll', 'overflow-hidden');
      if (document.body.style.overflow === 'hidden') document.body.style.removeProperty('overflow');
    }
  }

  function injectGuardStyles() {
    if (document.getElementById('hubProfileLiveGuardStyles')) return;
    const style = document.createElement('style');
    style.id = 'hubProfileLiveGuardStyles';
    style.textContent = `
      [data-page="profile"].hub-profile-live-loading>*:not(#hubProfileLiveGate),
      [data-page="profile"].hub-profile-live-error>*:not(#hubProfileLiveGate){visibility:hidden!important}
      #hubProfileLiveGate{display:none;box-sizing:border-box;width:100%;min-height:340px;place-items:center;padding:32px;text-align:center}
      [data-page="profile"].hub-profile-live-loading #hubProfileLiveGate,
      [data-page="profile"].hub-profile-live-error #hubProfileLiveGate{display:grid!important;visibility:visible!important}
      #hubProfileLiveGate .hub-profile-gate-card{max-width:620px;padding:28px 30px;border:1px solid rgba(126,79,241,.45);border-radius:18px;background:linear-gradient(180deg,rgba(23,10,57,.96),rgba(12,8,36,.96));box-shadow:0 25px 70px rgba(5,0,20,.38)}
      #hubProfileLiveGate strong{display:block;color:#fff;font:900 22px/1.1 Montserrat,Arial;margin-bottom:9px}
      #hubProfileLiveGate span{display:block;color:#9f96b5;font:600 12px/1.55 Montserrat,Arial}
    `;
    document.head.appendChild(style);
  }

  function ensureGate() {
    const page = profilePage();
    if (!page) return null;
    let gate = document.getElementById('hubProfileLiveGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'hubProfileLiveGate';
      page.appendChild(gate);
    }
    return gate;
  }

  function setGate(mode, title, text) {
    const page = profilePage();
    const gate = ensureGate();
    if (!page || !gate) return;
    page.classList.remove('hub-profile-live-loading', 'hub-profile-live-error');
    if (mode) page.classList.add(mode === 'error' ? 'hub-profile-live-error' : 'hub-profile-live-loading');
    const card = document.createElement('div');
    card.className = 'hub-profile-gate-card';
    const heading = document.createElement('strong');
    const detail = document.createElement('span');
    heading.textContent = String(title ?? '');
    detail.textContent = String(text ?? '');
    card.append(heading, detail);
    gate.replaceChildren(card);
  }

  function clearGate() {
    const page = profilePage();
    if (!page) return;
    page.classList.remove('hub-profile-live-loading', 'hub-profile-live-error');
  }

  function showProfilePage() {
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.dataset.page === 'profile'));
    document.querySelectorAll('.primary-nav [data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === 'profile'));
    if (location.hash !== '#profile') history.replaceState(null, '', '#profile');
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function playerNameFromElement(element) {
    if (!element) return '';
    return element.dataset.profilePlayer || element.dataset.playerProfile || element.dataset.openPlayerProfile || '';
  }

  async function waitForGlobalPlayer(name, timeoutMs = 2500) {
    const wanted = normalize(name);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const players = Array.isArray(live.globalPlayers) ? live.globalPlayers : [];
      const player = players.find(item => normalize(item?.current_name) === wanted);
      if (player) return player;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return null;
  }

  async function renderPublicLiveProfile(name) {
    const requested = String(name || '').trim();
    if (!requested) throw new Error('Kein Spieler ausgewählt.');
    if (!originalRenderProfileLive) throw new Error('Live-Profilrenderer ist nicht verfügbar.');

    showProfilePage();
    setGate('loading', 'Profil wird geladen …', 'Es werden ausschließlich die aktuellen Live-Daten geladen.');

    const gp = await waitForGlobalPlayer(requested);
    if (!gp) throw new Error(`Live-Profil für ${requested} wurde nicht gefunden.`);

    const hadPlayer = !!live.player;
    const previousPlayer = live.player;
    if (!hadPlayer) live.player = {id:'__public_viewer__', current_name:'', avatar_pixels:null};

    try {
      await originalRenderProfileLive(gp.current_name);
    } finally {
      if (!hadPlayer) live.player = previousPlayer || null;
    }

    const shownName = normalize(profileName()?.textContent);
    if (shownName !== normalize(gp.current_name)) throw new Error('Das Live-Profil konnte nicht bestätigt werden.');

    clearGate();
    document.dispatchEvent(new CustomEvent('hub:live-profile-rendered', {detail:{player:gp}}));
    return gp;
  }

  if (originalRenderProfileLive) {
    core.renderProfileLive = async name => {
      const requested = String(name || '').trim();
      const gp = await waitForGlobalPlayer(requested, 1800);
      const hadPlayer = !!live.player;
      const previousPlayer = live.player;
      if (!hadPlayer) live.player = {id:'__public_viewer__', current_name:'', avatar_pixels:null};
      try {
        await originalRenderProfileLive(gp?.current_name || requested);
      } finally {
        if (!hadPlayer) live.player = previousPlayer || null;
      }
      clearGate();
    };
  }

  window.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const profileTarget = target?.closest(PROFILE_SELECTOR);
    if (!profileTarget) return;

    const name = playerNameFromElement(profileTarget);
    if (!name) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    closeProfileSourceOverlay(profileTarget);

    renderPublicLiveProfile(name).catch(error => {
      console.error('[The HUB] Live profile failed', error);
      setGate('error', 'Profil konnte nicht geladen werden', error?.message || 'Die Live-Daten sind gerade nicht verfügbar.');
      showProfilePage();
    });
  }, true);

  // A static/demo profile must never be shown as a fallback.
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#profile') return;
    const page = profilePage();
    if (!page || page.classList.contains('hub-profile-live-loading')) return;
    const current = normalize(profileName()?.textContent);
    const players = Array.isArray(live.globalPlayers) ? live.globalPlayers : [];
    const isKnownLivePlayer = players.some(player => normalize(player?.current_name) === current);
    if (!isKnownLivePlayer) {
      setGate('error', 'Kein Live-Profil ausgewählt', 'Wähle einen Spieler aus Ranking, Cup oder einer Spielerliste aus.');
    }
  });

  injectGuardStyles();
})();
