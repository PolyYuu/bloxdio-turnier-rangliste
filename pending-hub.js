(() => {
  'use strict';

  const api = window.HubAPI;
  const core = window.HubV3;
  if (!api || !core || !api.client) return;

  const live = core.live || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const CACHE_KEY = 'hub_pending_registration';

  const COPY = {
    de: {
      pending: 'VERIFIZIERUNG AUSSTEHEND',
      account: 'ACCOUNT',
      myProfile: 'MEIN PROFIL',
      changePassword: 'PASSWORT ÄNDERN',
      logout: 'LOG OUT',
      playerProfile: 'SPIELERPROFIL',
      bloxdName: 'Bloxd.io Name',
      verification: 'BLOXD VERIFIZIERUNG',
      statsHidden: 'STATISTIKEN NOCH NICHT SICHTBAR',
      statsText: 'Deine Statistiken, dein Rating und deine bisherigen Turniere werden sichtbar, sobald du verifiziert wurdest. Bis dahin ist dein 8-Zeichen-Code deine HUB-Kennung.',
      viewStatus: 'VERIFIZIERUNGSSTATUS ANSEHEN',
      yourAccount: 'HUB ACCOUNT',
      overviewTitle: 'VERIFIZIERUNG AUSSTEHEND',
      overviewText: 'Du bist bereits eingeloggt. Stats, Rating und dein Bloxd.io Spielerprofil werden sichtbar, sobald deine Verifizierung abgeschlossen ist.',
      viewProfile: 'MEIN PROFIL',
      passwordTitle: 'Passwort ändern',
      newPassword: 'Neues Passwort',
      confirmPassword: 'Passwort wiederholen',
      savePassword: 'PASSWORT SPEICHERN',
      cancel: 'ABBRECHEN',
      passwordShort: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
      passwordMismatch: 'Die Passwörter stimmen nicht überein.',
      passwordSaved: 'Passwort wurde geändert.',
      passwordError: 'Passwort konnte nicht geändert werden.',
      blocked: 'Diese Funktion wird nach deiner Bloxd-Verifizierung freigeschaltet.'
    },
    en: {
      pending: 'VERIFICATION PENDING',
      account: 'ACCOUNT',
      myProfile: 'MY PROFILE',
      changePassword: 'CHANGE PASSWORD',
      logout: 'LOG OUT',
      playerProfile: 'PLAYER PROFILE',
      bloxdName: 'Bloxd.io name',
      verification: 'BLOXD VERIFICATION',
      statsHidden: 'STATISTICS NOT VISIBLE YET',
      statsText: 'Your statistics, rating and previous tournaments become visible as soon as you are verified. Until then, your 8-character code is your HUB identifier.',
      viewStatus: 'VIEW VERIFICATION STATUS',
      yourAccount: 'HUB ACCOUNT',
      overviewTitle: 'VERIFICATION PENDING',
      overviewText: 'You are already logged in. Stats, rating and your Bloxd.io player profile become visible as soon as verification is complete.',
      viewProfile: 'MY PROFILE',
      passwordTitle: 'Change password',
      newPassword: 'New password',
      confirmPassword: 'Repeat password',
      savePassword: 'SAVE PASSWORD',
      cancel: 'CANCEL',
      passwordShort: 'Password must be at least 8 characters long.',
      passwordMismatch: 'Passwords do not match.',
      passwordSaved: 'Password changed.',
      passwordError: 'Password could not be changed.',
      blocked: 'This feature becomes available after your Bloxd verification.'
    },
    fr: {
      pending: 'VÉRIFICATION EN ATTENTE',
      account: 'COMPTE',
      myProfile: 'MON PROFIL',
      changePassword: 'CHANGER LE MOT DE PASSE',
      logout: 'SE DÉCONNECTER',
      playerProfile: 'PROFIL DU JOUEUR',
      bloxdName: 'Nom Bloxd.io',
      verification: 'VÉRIFICATION BLOXD',
      statsHidden: 'STATISTIQUES PAS ENCORE VISIBLES',
      statsText: 'Tes statistiques, ton rating et tes tournois précédents deviennent visibles dès que tu es vérifié. Jusque-là, ton code à 8 caractères est ton identifiant HUB.',
      viewStatus: 'VOIR LE STATUT DE VÉRIFICATION',
      yourAccount: 'COMPTE HUB',
      overviewTitle: 'VÉRIFICATION EN ATTENTE',
      overviewText: 'Tu es déjà connecté. Les statistiques, le rating et ton profil Bloxd.io deviennent visibles dès que la vérification est terminée.',
      viewProfile: 'MON PROFIL',
      passwordTitle: 'Changer le mot de passe',
      newPassword: 'Nouveau mot de passe',
      confirmPassword: 'Répéter le mot de passe',
      savePassword: 'ENREGISTRER',
      cancel: 'ANNULER',
      passwordShort: 'Le mot de passe doit contenir au moins 8 caractères.',
      passwordMismatch: 'Les mots de passe ne correspondent pas.',
      passwordSaved: 'Mot de passe modifié.',
      passwordError: 'Impossible de modifier le mot de passe.',
      blocked: 'Cette fonction sera disponible après ta vérification Bloxd.'
    }
  };

  function visibleLanguageButtonValue() {
    const candidates = $$('button').filter((button) => {
      if (button.hidden) return false;
      const text = String(button.textContent || '').trim().toUpperCase();
      return text.length <= 14 && /(^|\s)(DE|EN|FR)(\s|$)/.test(text);
    });
    for (const button of candidates) {
      const match = String(button.textContent || '').toUpperCase().match(/\b(DE|EN|FR)\b/);
      if (match) return match[1].toLowerCase();
    }
    return '';
  }

  function language() {
    const stateLang = String(window.state?.lang || live.lang || '').toLowerCase();
    if (stateLang.startsWith('de')) return 'de';
    if (stateLang.startsWith('fr')) return 'fr';
    if (stateLang.startsWith('en')) return 'en';
    const visible = visibleLanguageButtonValue();
    if (visible) return visible;
    const htmlLang = String(document.documentElement.lang || '').toLowerCase();
    if (htmlLang.startsWith('de')) return 'de';
    if (htmlLang.startsWith('fr')) return 'fr';
    return 'en';
  }

  const t = (key) => COPY[language()]?.[key] || COPY.en[key] || key;
  const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  function storedAuthUserId() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        const id = parsed?.user?.id || parsed?.currentSession?.user?.id || parsed?.session?.user?.id;
        if (id) return String(id);
      }
    } catch (_) {}
    return '';
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || cached.status !== 'pending') return null;
      const authId = storedAuthUserId();
      if (!authId || (cached.auth_user_id && cached.auth_user_id !== authId)) return null;
      return cached;
    } catch (_) {
      return null;
    }
  }

  function writeCache(data, authUserId) {
    try {
      const id = authUserId || storedAuthUserId();
      if (!id) return;
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        status: 'pending',
        auth_user_id: id,
        code: normalizeCode(data?.code),
        cached_at: Date.now()
      }));
    } catch (_) {}
  }

  function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
  }

  let state = live.registrationState?.status === 'pending' ? live.registrationState : null;
  let active = !!state;
  let syncing = false;
  let queued = false;
  let lastLanguage = '';

  function accountCode() {
    return normalizeCode(state?.code || live.registrationState?.code || readCache()?.code) || 'PENDING';
  }

  function addStyles() {
    if ($('#hubPendingStableStyles')) return;
    const style = document.createElement('style');
    style.id = 'hubPendingStableStyles';
    style.textContent = `
      body.hub-pending-account #v3AuthModal,
      body.hub-pending-account [data-auth-modal],
      body.hub-pending-account [data-v3-overview-login],
      body.hub-pending-account #communityButton,
      body.hub-pending-account #friendsButton,
      body.hub-pending-account [data-open-friends],
      body.hub-pending-account [data-friends-button],
      body.hub-pending-account .site-header [aria-label*="friend" i],
      body.hub-pending-account .site-header [title*="friend" i],
      body.hub-pending-account .site-header [aria-label*="freund" i],
      body.hub-pending-account .site-header [title*="freund" i],
      body.hub-pending-account .site-header [aria-label*="ami" i],
      body.hub-pending-account .site-header [title*="ami" i],
      body.hub-pending-account [data-open-register],
      body.hub-pending-account .next-cup-cta,
      body.hub-pending-account [data-register-next-cup],
      body.hub-pending-account [data-next-cup-register],
      body.hub-pending-account #editAvatarButton,
      body.hub-pending-account #renameButton,
      body.hub-pending-account #profileAdminButton {
        display:none!important;
      }

      body.hub-pending-account [data-page="profile"] > *:not(#hubPendingProfileSurface) {
        display:none!important;
      }
      body.hub-pending-account #hubPendingProfileSurface {
        display:grid!important;
      }

      body.hub-pending-account .hub-pending-overview-host > *:not(#hubPendingOverviewSurface) {
        display:none!important;
      }
      body.hub-pending-account #hubPendingOverviewSurface {
        display:grid!important;
      }

      .hub-pending-header-status {
        display:inline-flex;align-items:center;gap:7px;
        border:1px solid rgba(255,198,92,.28);background:rgba(255,198,92,.11);color:#ffc65c;
        border-radius:999px;padding:8px 11px;font:800 9px/1 Montserrat,Arial;letter-spacing:.06em;white-space:nowrap;cursor:pointer;
      }
      .hub-pending-header-status i {display:grid;place-items:center;width:15px;height:15px;border:1px solid currentColor;border-radius:50%;font:italic 800 9px Georgia;}

      #hubPendingProfileSurface {gap:16px;width:100%;}
      .hub-pending-profile-hero,.hub-pending-profile-card {
        box-sizing:border-box;width:100%;border:1px solid rgba(105,60,174,.7);border-radius:16px;
        background:linear-gradient(180deg,rgba(30,13,52,.96),rgba(18,8,34,.96));color:#fff;
      }
      .hub-pending-profile-hero {display:flex;align-items:center;gap:18px;padding:25px;min-height:130px;}
      .hub-pending-avatar {display:grid;place-items:center;width:82px;height:82px;border:1px solid #3badd0;border-radius:13px;background:linear-gradient(135deg,#123f61,#32136c);font:900 30px Montserrat;color:#4de5dc;box-shadow:inset 0 0 0 8px rgba(255,255,255,.025);}
      .hub-pending-profile-copy {min-width:0;}
      .hub-pending-profile-copy .kicker,.hub-pending-profile-card .kicker {display:block;margin-bottom:8px;color:#4de5dc;font:900 10px/1 Montserrat;letter-spacing:.12em;}
      .hub-pending-profile-copy h1 {margin:0;font:900 clamp(34px,5vw,58px)/.95 Montserrat,Arial;letter-spacing:.02em;overflow-wrap:anywhere;}
      .hub-pending-profile-copy small {display:block;margin-top:8px;color:#8f88a1;font:600 10px Montserrat,Arial;}
      .hub-pending-profile-copy small b {color:#ffc65c;}
      .hub-pending-profile-card {padding:34px 32px;min-height:238px;}
      .hub-pending-profile-card .kicker {color:#ffc65c;}
      .hub-pending-profile-card h2 {margin:0 0 14px;font:900 clamp(25px,3vw,34px)/1 Montserrat,Arial;font-style:italic;}
      .hub-pending-profile-card p {max-width:760px;margin:0;color:#aaa2b7;font:500 15px/1.55 Montserrat,Arial;}
      .hub-pending-profile-card button {margin-top:20px;}

      #hubPendingOverviewSurface {gap:14px;align-content:start;}
      #hubPendingOverviewSurface .hub-pending-overview-kicker {color:#4de5dc;font:900 9px/1 Montserrat;letter-spacing:.12em;}
      #hubPendingOverviewSurface h2 {margin:0;font:900 23px/1.05 Montserrat,Arial;font-style:italic;}
      #hubPendingOverviewSurface p {margin:0;color:#9d95ab;font:500 12px/1.55 Montserrat,Arial;}
      #hubPendingOverviewSurface button {width:100%;margin-top:3px;}

      #hubPendingAccountModal,#hubPendingPasswordModal {
        position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;
        background:rgba(3,1,8,.72);backdrop-filter:blur(8px);
      }
      #hubPendingAccountModal[hidden],#hubPendingPasswordModal[hidden] {display:none!important;}
      .hub-pending-account-card,.hub-pending-password-card {
        position:relative;width:min(460px,100%);box-sizing:border-box;border:1px solid #6038a3;border-radius:16px;
        background:linear-gradient(180deg,#1a0c2d,#10071c);padding:26px;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.62);
      }
      .hub-pending-account-card .eyebrow {color:#4de5dc;font:900 9px Montserrat;letter-spacing:.1em;}
      .hub-pending-account-card h2 {margin:7px 0 20px;font:900 28px Montserrat,Arial;}
      .hub-pending-modal-close {position:absolute;right:14px;top:14px;width:34px;height:34px;border:1px solid #53327e;border-radius:8px;background:#170c26;color:#b9adc8;cursor:pointer;}
      .hub-pending-account-actions {display:grid;gap:10px;}
      .hub-pending-account-actions button {min-height:44px;border:1px solid #56358b;border-radius:7px;background:#1a0d2d;color:#fff;font:900 11px Montserrat,Arial;cursor:pointer;}
      .hub-pending-account-actions button:hover {border-color:#4de5dc;}
      .hub-pending-account-actions .danger {color:#ff8292;border-color:#6b2442;}
      .hub-pending-password-card h2 {margin:0 0 18px;}
      .hub-pending-password-card label {display:grid;gap:7px;margin:12px 0;color:#c7bed2;font:700 12px Montserrat,Arial;}
      .hub-pending-password-card input {width:100%;box-sizing:border-box;border:1px solid #553582;background:#09040f;color:#fff;border-radius:9px;padding:12px;font:600 14px Arial;}
      .hub-pending-password-actions {display:flex;gap:8px;margin-top:18px;}
      .hub-pending-password-actions button {flex:1;}
      .hub-pending-password-message {min-height:20px;margin:10px 0 0;color:#ffb2bd;font-size:12px;}
      .hub-pending-password-message.ok {color:#67e9b8;}

      @media(max-width:760px){
        .hub-pending-profile-hero{align-items:flex-start;padding:20px}.hub-pending-avatar{width:64px;height:64px}.hub-pending-profile-card{padding:25px 20px}
      }
    `;
    document.head.appendChild(style);
  }

  function findOverviewHost() {
    const known = $('.my-rank-card');
    if (known) return known;
    const login = $('[data-v3-overview-login]');
    if (!login) return null;
    return login.closest('.my-rank-card,.panel,.card,section,article') || login.parentElement;
  }

  function installHeader() {
    const button = $('#loginDemoButton');
    if (!button) return;
    button.removeAttribute('data-i18n');
    button.textContent = accountCode();
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.classList.add('is-account');

    let status = $('#hubPendingHeaderStatus');
    if (!status) {
      status = document.createElement('button');
      status.type = 'button';
      status.id = 'hubPendingHeaderStatus';
      status.className = 'hub-pending-header-status';
      button.insertAdjacentElement('afterend', status);
    }
    status.innerHTML = `<i>i</i>${t('pending')}`;
  }

  function renderOverviewSurface() {
    const host = findOverviewHost();
    if (!host) return;
    host.classList.add('hub-pending-overview-host');
    let surface = $('#hubPendingOverviewSurface', host);
    if (!surface) {
      surface = document.createElement('div');
      surface.id = 'hubPendingOverviewSurface';
      host.appendChild(surface);
    }
    const lang = language();
    if (surface.dataset.lang === lang && surface.dataset.code === accountCode()) return;
    surface.dataset.lang = lang;
    surface.dataset.code = accountCode();
    surface.innerHTML = `
      <span class="hub-pending-overview-kicker">${t('yourAccount')}</span>
      <h2>${t('overviewTitle')}</h2>
      <p>${t('overviewText')}</p>
      <button type="button" class="secondary-button" data-hub-pending-profile-open>${t('viewProfile')}</button>
    `;
  }

  function renderProfileSurface() {
    const page = $('[data-page="profile"]');
    if (!page) return;
    let surface = $('#hubPendingProfileSurface', page);
    if (!surface) {
      surface = document.createElement('div');
      surface.id = 'hubPendingProfileSurface';
      page.prepend(surface);
    }
    const lang = language();
    if (surface.dataset.lang === lang && surface.dataset.code === accountCode()) return;
    surface.dataset.lang = lang;
    surface.dataset.code = accountCode();
    surface.innerHTML = `
      <section class="hub-pending-profile-hero">
        <div class="hub-pending-avatar">•••</div>
        <div class="hub-pending-profile-copy">
          <span class="kicker">${t('playerProfile')}</span>
          <h1>${accountCode()}</h1>
          <small>${t('bloxdName')} · <b>ⓘ ${t('pending')}</b></small>
        </div>
      </section>
      <section class="hub-pending-profile-card">
        <span class="kicker">${t('verification')}</span>
        <h2>${t('statsHidden')}</h2>
        <p>${t('statsText')}</p>
        <button type="button" class="secondary-button" data-hub-pending-status-open>${t('viewStatus')}</button>
      </section>
    `;
  }

  function hideRestrictedControls() {
    $$('[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register]').forEach((element) => {
      element.hidden = true;
      element.style.setProperty('display', 'none', 'important');
    });
    const header = $('.site-header') || document;
    $$('#communityButton,#friendsButton,[data-open-friends],[data-friends-button],[aria-label*="friend" i],[title*="friend" i],[aria-label*="freund" i],[title*="freund" i],[aria-label*="ami" i],[title*="ami" i]', header).forEach((element) => {
      element.hidden = true;
      element.style.setProperty('display', 'none', 'important');
    });
  }

  function cleanupOldPatchArtifacts() {
    $('#hubPendingCupBadge')?.remove();
    $('#hubPendingIntegratedStyles')?.remove();
    $('#hubViewportSafetyStyles')?.remove();
    $('#hubPendingAccountMenu')?.remove();
  }

  function showPage(name) {
    $$('.page').forEach((page) => page.classList.toggle('active', page.dataset.page === name));
    $$('.primary-nav [data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === name));
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openAccountModal() {
    let modal = $('#hubPendingAccountModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hubPendingAccountModal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <section class="hub-pending-account-card">
        <button class="hub-pending-modal-close" type="button" data-hub-account-close>×</button>
        <span class="eyebrow">${t('account')}</span>
        <h2>${accountCode()}</h2>
        <div class="hub-pending-account-actions">
          <button type="button" data-hub-pending-profile-open>${t('myProfile')}</button>
          <button type="button" data-hub-password-open>${t('changePassword')}</button>
          <button type="button" class="danger" data-hub-logout>${t('logout')}</button>
        </div>
      </section>
    `;
    modal.hidden = false;
  }

  function closeAccountModal() {
    const modal = $('#hubPendingAccountModal');
    if (modal) modal.hidden = true;
  }

  function openPasswordModal() {
    let modal = $('#hubPendingPasswordModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hubPendingPasswordModal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <section class="hub-pending-password-card">
        <h2>${t('passwordTitle')}</h2>
        <label><span>${t('newPassword')}</span><input data-hub-pass-one type="password" autocomplete="new-password"></label>
        <label><span>${t('confirmPassword')}</span><input data-hub-pass-two type="password" autocomplete="new-password"></label>
        <p class="hub-pending-password-message" data-hub-pass-message></p>
        <div class="hub-pending-password-actions">
          <button type="button" class="secondary-button" data-hub-pass-cancel>${t('cancel')}</button>
          <button type="button" class="primary-button" data-hub-pass-save>${t('savePassword')}</button>
        </div>
      </section>
    `;
    modal.hidden = false;
    setTimeout(() => $('[data-hub-pass-one]', modal)?.focus(), 30);
  }

  async function savePassword() {
    const modal = $('#hubPendingPasswordModal');
    if (!modal) return;
    const one = $('[data-hub-pass-one]', modal)?.value || '';
    const two = $('[data-hub-pass-two]', modal)?.value || '';
    const message = $('[data-hub-pass-message]', modal);
    if (!message) return;
    message.classList.remove('ok');
    if (one.length < 8) { message.textContent = t('passwordShort'); return; }
    if (one !== two) { message.textContent = t('passwordMismatch'); return; }
    try {
      const { error } = await api.client.auth.updateUser({ password: one });
      if (error) throw error;
      message.textContent = t('passwordSaved');
      message.classList.add('ok');
      setTimeout(() => { modal.hidden = true; }, 800);
    } catch (error) {
      console.error(error);
      message.textContent = t('passwordError');
    }
  }

  async function logout() {
    try { await api.client.auth.signOut(); } catch (error) { console.warn(error); }
    clearCache();
    location.href = 'index.html#overview';
    location.reload();
  }

  function sync() {
    if (!active || syncing) return;
    syncing = true;
    try {
      addStyles();
      cleanupOldPatchArtifacts();
      document.body.classList.add('hub-pending-account');
      document.body.dataset.hubAccountState = 'pending';
      $('#v3AuthModal')?.setAttribute('hidden', '');
      installHeader();
      hideRestrictedControls();
      renderOverviewSurface();
      renderProfileSurface();
      lastLanguage = language();
    } finally {
      syncing = false;
    }
  }

  function queueSync(force = false) {
    if (!active) return;
    if (!force && language() === lastLanguage) {
      const accountOkay = $('#loginDemoButton')?.textContent.trim() === accountCode();
      const profileOkay = !!$('#hubPendingProfileSurface');
      const overviewHost = findOverviewHost();
      const overviewOkay = !overviewHost || !!$('#hubPendingOverviewSurface', overviewHost);
      const authClosed = !$('#v3AuthModal') || $('#v3AuthModal').hidden;
      if (accountOkay && profileOkay && overviewOkay && authClosed) return;
    }
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      sync();
    }, 20);
  }

  function clearPendingUi() {
    active = false;
    state = null;
    live.registrationState = null;
    document.body.classList.remove('hub-pending-account');
    if (document.body.dataset.hubAccountState === 'pending') delete document.body.dataset.hubAccountState;
    $('#hubPendingHeaderStatus')?.remove();
    $('#hubPendingAccountModal')?.remove();
    $('#hubPendingPasswordModal')?.remove();
    $('#hubPendingProfileSurface')?.remove();
    $('#hubPendingOverviewSurface')?.remove();
    $$('.hub-pending-overview-host').forEach((host) => host.classList.remove('hub-pending-overview-host'));
  }

  async function currentSession() {
    if (typeof api.currentSession === 'function') return await api.currentSession();
    const { data } = await api.client.auth.getSession();
    return data?.session || null;
  }

  async function refreshState() {
    try {
      const session = await currentSession();
      if (!session) {
        clearCache();
        clearPendingUi();
        return;
      }
      const { data, error } = await api.client.rpc('get_my_registration_status');
      if (error) throw error;
      if (data?.status === 'pending') {
        state = data;
        live.registrationState = data;
        active = true;
        writeCache(data, session.user?.id);
        sync();
        return;
      }
      clearCache();
      const wasPending = active;
      clearPendingUi();
      if (wasPending) location.reload();
    } catch (error) {
      console.warn('Pending state refresh failed', error);
      const cached = readCache();
      if (cached) {
        state = cached;
        active = true;
        sync();
      }
    }
  }

  function handleClick(event) {
    if (!active) return;
    const target = event.target;

    if (target.closest?.('#loginDemoButton')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      $('#v3AuthModal')?.setAttribute('hidden', '');
      openAccountModal();
      return;
    }
    if (target.closest?.('[data-hub-account-close]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAccountModal();
      return;
    }
    if (target === $('#hubPendingAccountModal')) {
      closeAccountModal();
      return;
    }
    if (target.closest?.('[data-hub-pending-profile-open]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAccountModal();
      showPage('profile');
      renderProfileSurface();
      return;
    }
    if (target.closest?.('.primary-nav [data-route="profile"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showPage('profile');
      renderProfileSurface();
      return;
    }
    if (target.closest?.('[data-hub-pending-status-open],#hubPendingHeaderStatus')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = 'pending.html';
      return;
    }
    if (target.closest?.('[data-hub-password-open]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAccountModal();
      openPasswordModal();
      return;
    }
    if (target.closest?.('[data-hub-pass-cancel]')) {
      event.preventDefault();
      $('#hubPendingPasswordModal').hidden = true;
      return;
    }
    if (target.closest?.('[data-hub-pass-save]')) {
      event.preventDefault();
      savePassword();
      return;
    }
    if (target === $('#hubPendingPasswordModal')) {
      $('#hubPendingPasswordModal').hidden = true;
      return;
    }
    if (target.closest?.('[data-hub-logout]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      logout();
      return;
    }
    if (target.closest?.('#communityButton,#friendsButton,[data-open-friends],[data-friends-button],[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register],[data-v3-friend-add],[data-friend-add]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      core.toast?.(t('blocked'), true);
    }
  }

  addStyles();
  cleanupOldPatchArtifacts();
  if (active) sync();

  document.addEventListener('click', handleClick, true);
  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-lang],#languageButton')) return;
    setTimeout(() => queueSync(true), 0);
    setTimeout(() => queueSync(true), 120);
  }, true);

  window.addEventListener('hashchange', () => queueSync(true));
  document.addEventListener('hub:auth-restored', (event) => {
    const detail = event.detail || {};
    if (detail.loggedIn === false) {
      clearCache();
      clearPendingUi();
      return;
    }
    if (detail.registrationState?.status === 'pending') {
      state = detail.registrationState;
      live.registrationState = detail.registrationState;
      active = true;
      writeCache(detail.registrationState, detail.session?.user?.id || detail.user?.id);
      sync();
      return;
    }
    if (detail.registrationState?.status === 'verified') {
      const wasPending = active;
      clearCache();
      clearPendingUi();
      if (wasPending) location.reload();
      return;
    }
    setTimeout(refreshState, 20);
  });

  new MutationObserver(() => queueSync(false)).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['hidden', 'class']
  });

  setTimeout(refreshState, 20);
  setInterval(refreshState, 10000);
})();
