(() => {
  'use strict';

  const api = window.HubAPI;
  const core = window.HubV3;
  if (!api || !core) return;
  const live = core.live;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let state = null;
  let pollTimer = null;
  let active = false;

  function initials(name) {
    return String(name || '?').replace(/[^A-Za-z0-9]/g, ' ').split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?';
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
    const name = state.claimed_name || 'Account Preview';
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
    if (mono) { mono.hidden = false; mono.textContent = initials(name); }
    $('#editAvatarButton')?.setAttribute('hidden', '');
    $('#renameButton')?.setAttribute('hidden', '');
    $('#profileAdminButton')?.setAttribute('hidden', '');

    const rankCard = $('.profile-rank-card');
    if (rankCard) {
      rankCard.innerHTML = `
        <div class="hub-pending-profile-card">
          <span class="hub-pending-kicker">BLOXD VERIFIZIERUNG</span>
          <h2>Stats noch nicht verfügbar</h2>
          <p>Dein Rating, deine bisherigen Turniere und deine Statistiken erscheinen hier automatisch, sobald deine permanente Bloxd-ID bestätigt wurde.</p>
          <button type="button" class="secondary-button" data-hub-pending-status>STATUS ANSEHEN</button>
        </div>`;
    }

    const grid = $('#profileStatGrid');
    if (grid) {
      const labels = ['Ranked Runden','Kills','K/D','Turniere','Turniersiege','Meiste Turnierpunkte','Ø Punkte / Runde','Rundensiege','Meiste Rundenpunkte'];
      grid.innerHTML = labels.map(label => `<div class="hub-pending-stat"><span>${label}</span><strong>—</strong><small>Nach Verifizierung</small></div>`).join('');
    }
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
        <button class="secondary-button" type="button" data-hub-pending-profile>ACCOUNT PREVIEW</button>
      </div>`;
  }

  function installHeader() {
    const old = $('#hubPendingHeaderStatus');
    if (old) old.remove();
    const account = $('#loginDemoButton');
    if (!account) return;
    account.removeAttribute('data-i18n');
    account.textContent = state?.claimed_name || 'Account';
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
      .hub-pending-profile-card{display:grid;gap:12px;padding:8px}.hub-pending-profile-card h2{margin:0;font-size:28px}.hub-pending-profile-card p{margin:0;color:#9892a8;line-height:1.6}.hub-pending-profile-card button{width:max-content}.hub-pending-kicker{color:#ffc65c;font:900 10px/1 Montserrat;letter-spacing:.12em}
      .hub-pending-stat small{display:block;margin-top:4px;color:#716b7d;font-size:9px}
      body.hub-pending-account #editAvatarButton,body.hub-pending-account #renameButton,body.hub-pending-account #profileAdminButton{display:none!important}
      @media(max-width:900px){.hub-pending-header-status{max-width:150px;overflow:hidden;text-overflow:ellipsis}.hub-pending-overview .secondary-button{width:100%}}
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

  window.addEventListener('hub:pending-profile-open', () => renderPendingProfile());
  document.addEventListener('click', (e) => {
    if (!state || state.status !== 'pending') return;
    if (e.target.closest('[data-hub-pending-profile]')) {
      e.preventDefault();
      renderPendingProfile();
      return;
    }
    if (e.target.closest('[data-hub-pending-status]')) {
      e.preventDefault();
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

  document.addEventListener('hub:auth-restored', () => setTimeout(refresh, 100));
  window.addEventListener('hashchange', () => {
    if (state?.status === 'pending' && location.hash === '#profile') setTimeout(renderPendingProfile, 0);
  });
  setTimeout(refresh, 250);
  pollTimer = setInterval(refresh, 12000);
})();
