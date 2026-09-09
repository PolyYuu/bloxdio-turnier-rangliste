(() => {
  'use strict';

  const api = window.HubAPI;
  const core = window.HubV3;
  if (!api || !core) return;
  const live = core.live;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let state = null;
  let active = false;

  function initials(name) {
    return String(name || '?').replace(/[^A-Za-z0-9]/g, ' ').split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?';
  }

  function pendingName() {
    return state?.claimed_name || state?.verified_name || 'Account Preview';
  }

  function showPage(page) {
    $$('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
    $$('.primary-nav [data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === page));
    if (location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPendingProfile() {
    if (!state || state.status !== 'pending') return;
    showPage('profile');

    const name = pendingName();
    const title = $('#profilePlayerName');
    if (title) title.textContent = name;

    const rank = $('#profileGlobalRank');
    if (rank) {
      rank.hidden = false;
      rank.textContent = '● VERIFIZIERUNG AUSSTEHEND';
      rank.style.color = '#ffc65c';
      rank.style.cursor = 'pointer';
      rank.onclick = () => location.href = 'pending.html';
    }

    const avatar = $('#profileAvatar');
    if (avatar) avatar.hidden = true;
    const mono = $('#profileMonogram');
    if (mono) {
      mono.hidden = false;
      mono.textContent = initials(name);
    }

    $('#editAvatarButton')?.setAttribute('hidden', '');
    $('#renameButton')?.setAttribute('hidden', '');
    $('#profileAdminButton')?.setAttribute('hidden', '');

    const rankCard = $('.profile-rank-card');
    if (rankCard) {
      rankCard.hidden = false;
      rankCard.innerHTML = `
        <div class="hub-pending-profile-card">
          <span class="hub-pending-kicker">BLOXD VERIFIZIERUNG</span>
          <h2>Statistiken noch nicht sichtbar</h2>
          <p>Deine Statistiken, dein Rating und deine bisherigen Turniere werden sichtbar, sobald du verifiziert wurdest. Die automatische Verifizierung über die HUB-Bridge kann einige Stunden dauern.</p>
          <button type="button" class="secondary-button" data-hub-pending-status>VERIFIZIERUNGSSTATUS ANSEHEN</button>
        </div>`;
    }

    $('.stats-panel')?.setAttribute('hidden', '');
    $('.history-panel')?.setAttribute('hidden', '');
    $('[data-page="profile"] .recent-updates')?.setAttribute('hidden', '');
    document.querySelector('[data-hub-pending-status]')?.addEventListener('click', () => location.href = 'pending.html');
  }

  function renderOverviewPendingCard() {
    const card = $('.my-rank-card');
    if (!card || card.dataset.pendingRendered === '1') return;
    card.dataset.pendingRendered = '1';
    card.innerHTML = `
      <header class="panel-header tight">
        <div><span class="eyebrow">DEIN ACCOUNT</span><h2>Verifizierung ausstehend</h2></div>
        <button class="hub-pending-dot" type="button" data-hub-pending-status aria-label="Verifizierungsstatus">●</button>
      </header>
      <div class="hub-pending-overview">
        <strong>Stats werden nach der Bloxd-Synchronisation sichtbar.</strong>
        <p>Rangliste, Cups und öffentliche Spielerprofile kannst du bereits ganz normal ansehen.</p>
        <button class="secondary-button" type="button" data-hub-pending-profile>MEIN PROFIL ANSEHEN</button>
      </div>`;
  }

  function installHeader() {
    $('#hubPendingHeaderStatus')?.remove();
    const account = $('#loginDemoButton');
    if (!account) return;
    account.removeAttribute('data-i18n');
    account.textContent = pendingName();
    account.classList.add('is-account');

    const badge = document.createElement('button');
    badge.id = 'hubPendingHeaderStatus';
    badge.type = 'button';
    badge.className = 'hub-pending-header-status';
    badge.innerHTML = '<span>●</span> VERIFIZIERUNG AUSSTEHEND';
    badge.title = 'Verifizierungsstatus anzeigen';
    badge.onclick = () => location.href = 'pending.html';
    account.insertAdjacentElement('afterend', badge);
  }

  function addStyles() {
    if ($('#hubPendingIntegratedStyles')) return;
    const style = document.createElement('style');
    style.id = 'hubPendingIntegratedStyles';
    style.textContent = `
      .hub-pending-header-status{border:1px solid rgba(255,198,92,.28);background:rgba(255,198,92,.11);color:#ffc65c;border-radius:999px;padding:8px 11px;font:800 9px/1 Montserrat,Arial;letter-spacing:.06em;cursor:pointer;white-space:nowrap}
      .hub-pending-header-status span,.hub-pending-dot{color:#ffc65c}
      .hub-pending-dot{border:1px solid rgba(255,198,92,.25);background:rgba(255,198,92,.08);border-radius:50%;width:34px;height:34px;cursor:pointer}
      .hub-pending-overview{display:grid;gap:12px;padding:8px 2px 4px}.hub-pending-overview strong{font-size:18px}.hub-pending-overview p{margin:0;color:#9892a8;line-height:1.55;font-size:13px}.hub-pending-overview .secondary-button{width:max-content}
      body.hub-pending-account [data-page="profile"] .profile-grid{grid-template-columns:1fr!important}
      body.hub-pending-account [data-page="profile"] .profile-rank-card{width:100%;box-sizing:border-box}
      .hub-pending-profile-card{display:grid;gap:14px;padding:18px 12px}.hub-pending-profile-card h2{margin:0;font-size:30px}.hub-pending-profile-card p{max-width:760px;margin:0;color:#a29bad;line-height:1.65}.hub-pending-profile-card button{width:max-content}.hub-pending-kicker{color:#ffc65c;font:900 10px/1 Montserrat;letter-spacing:.12em}
      body.hub-pending-account #editAvatarButton,body.hub-pending-account #renameButton,body.hub-pending-account #profileAdminButton{display:none!important}
      body.hub-pending-account [data-page="profile"] .stats-panel,body.hub-pending-account [data-page="profile"] .history-panel,body.hub-pending-account [data-page="profile"] .recent-updates{display:none!important}
      @media(max-width:900px){.hub-pending-header-status{max-width:150px;overflow:hidden;text-overflow:ellipsis}.hub-pending-overview .secondary-button,.hub-pending-profile-card button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function applyUi() {
    if (!state || state.status !== 'pending') return;
    active = true;
    live.registrationState = state;
    document.body.classList.add('hub-pending-account');
    addStyles();
    installHeader();
    renderOverviewPendingCard();
    if (location.hash === '#profile') renderPendingProfile();
  }

  async function refresh() {
    try {
      const session = await api.currentSession();
      if (!session) return;
      const { data, error } = await api.client.rpc('get_my_registration_status');
      if (error) throw error;
      if (data?.status === 'verified') {
        if (active) location.reload();
        return;
      }
      if (data?.status !== 'pending') return;
      state = data;
      applyUi();
    } catch (err) {
      console.warn('Pending HUB state could not be refreshed', err);
    }
  }

  // Capture pending profile navigation BEFORE the old click-dummy profile renderer can run.
  document.addEventListener('click', (e) => {
    if (!state || state.status !== 'pending') return;

    const profileRoute = e.target.closest('[data-route="profile"], [data-hub-pending-profile]');
    if (profileRoute) {
      e.preventDefault();
      e.stopImmediatePropagation();
      renderPendingProfile();
      return;
    }

    if (e.target.closest('[data-hub-pending-status]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      location.href = 'pending.html';
      return;
    }

    const sensitive = e.target.closest('[data-v3-friend-add],[data-friend-add],[data-v3-friend-remove],[data-v3-friend-accept],[data-v3-friend-decline],[data-open-register],.next-cup-cta,#editAvatarButton,#renameButton');
    if (sensitive) {
      e.preventDefault();
      e.stopImmediatePropagation();
      core.toast?.('Diese Funktion wird nach deiner Bloxd-Verifizierung freigeschaltet.', true);
    }
  }, true);

  window.addEventListener('hashchange', () => {
    if (state?.status === 'pending' && location.hash === '#profile') setTimeout(renderPendingProfile, 0);
  });
  document.addEventListener('hub:auth-restored', () => setTimeout(refresh, 80));

  setTimeout(refresh, 120);
  setInterval(refresh, 12000);
})();
