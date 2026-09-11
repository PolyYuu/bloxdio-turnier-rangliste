(() => {
  'use strict';

  const api = window.HubAPI;
  const core = window.HubV3;
  if (!api || !core || !api.client) return;

  const live = core.live || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CACHE_KEY = 'hub_pending_registration';

  const COPY = {
    en: {
      pending:'VERIFICATION PENDING', account:'ACCOUNT', myProfile:'MY PROFILE', changePassword:'CHANGE PASSWORD', logout:'LOG OUT',
      playerProfile:'PLAYER PROFILE', bloxdName:'Bloxd.io name', verification:'BLOXD VERIFICATION', statsHidden:'STATISTICS NOT VISIBLE YET',
      statsText:'Your statistics, rating and previous tournaments become visible as soon as you are verified. Until then, your 8-character code is your HUB identifier.',
      viewStatus:'VIEW VERIFICATION STATUS', overviewTitle:'VERIFICATION PENDING', overviewText:'You are already logged in. Stats, rating and your Bloxd.io player profile become visible as soon as verification is complete.', viewProfile:'MY PROFILE',
      passwordTitle:'Change password', newPassword:'New password', confirmPassword:'Repeat password', savePassword:'SAVE PASSWORD', cancel:'CANCEL',
      passwordShort:'Password must be at least 8 characters long.', passwordMismatch:'Passwords do not match.', passwordSaved:'Password changed.', passwordError:'Password could not be changed.', blocked:'This feature becomes available after your Bloxd verification.'
    },
    de: {
      pending:'VERIFIZIERUNG AUSSTEHEND', account:'ACCOUNT', myProfile:'MEIN PROFIL', changePassword:'PASSWORT ÄNDERN', logout:'LOG OUT',
      playerProfile:'SPIELERPROFIL', bloxdName:'Bloxd.io Name', verification:'BLOXD VERIFIZIERUNG', statsHidden:'STATISTIKEN NOCH NICHT SICHTBAR',
      statsText:'Deine Statistiken, dein Rating und deine bisherigen Turniere werden sichtbar, sobald du verifiziert wurdest. Bis dahin ist dein 8-Zeichen-Code deine HUB-Kennung.',
      viewStatus:'VERIFIZIERUNGSSTATUS ANSEHEN', overviewTitle:'VERIFIZIERUNG AUSSTEHEND', overviewText:'Du bist bereits eingeloggt. Stats, Rating und dein Bloxd.io Spielerprofil werden sichtbar, sobald deine Verifizierung abgeschlossen ist.', viewProfile:'MEIN PROFIL',
      passwordTitle:'Passwort ändern', newPassword:'Neues Passwort', confirmPassword:'Passwort wiederholen', savePassword:'PASSWORT SPEICHERN', cancel:'ABBRECHEN',
      passwordShort:'Das Passwort muss mindestens 8 Zeichen lang sein.', passwordMismatch:'Die Passwörter stimmen nicht überein.', passwordSaved:'Passwort wurde geändert.', passwordError:'Passwort konnte nicht geändert werden.', blocked:'Diese Funktion wird nach deiner Bloxd-Verifizierung freigeschaltet.'
    },
    fr: {
      pending:'VÉRIFICATION EN ATTENTE', account:'COMPTE', myProfile:'MON PROFIL', changePassword:'CHANGER LE MOT DE PASSE', logout:'SE DÉCONNECTER',
      playerProfile:'PROFIL DU JOUEUR', bloxdName:'Nom Bloxd.io', verification:'VÉRIFICATION BLOXD', statsHidden:'STATISTIQUES PAS ENCORE VISIBLES',
      statsText:'Tes statistiques, ton rating et tes tournois précédents deviennent visibles dès que tu es vérifié. Jusque-là, ton code à 8 caractères est ton identifiant HUB.',
      viewStatus:'VOIR LE STATUT DE VÉRIFICATION', overviewTitle:'VÉRIFICATION EN ATTENTE', overviewText:'Tu es déjà connecté. Les statistiques, le rating et ton profil Bloxd.io deviennent visibles dès que la vérification est terminée.', viewProfile:'MON PROFIL',
      passwordTitle:'Changer le mot de passe', newPassword:'Nouveau mot de passe', confirmPassword:'Répéter le mot de passe', savePassword:'ENREGISTRER', cancel:'ANNULER',
      passwordShort:'Le mot de passe doit contenir au moins 8 caractères.', passwordMismatch:'Les mots de passe ne correspondent pas.', passwordSaved:'Mot de passe modifié.', passwordError:'Impossible de modifier le mot de passe.', blocked:'Cette fonction sera disponible après ta vérification Bloxd.'
    }
  };

  const normalizeLang = (value) => {
    const v = String(value || '').toLowerCase();
    if (v.startsWith('de')) return 'de';
    if (v.startsWith('fr')) return 'fr';
    if (v.startsWith('en')) return 'en';
    return '';
  };
  function persistLanguage(value) {
    const lang = normalizeLang(value);
    if (!lang) return '';
    localStorage.setItem('sg-lang', lang);
    localStorage.setItem('hub_language', lang);
    localStorage.setItem('hubLang', lang);
    document.documentElement.lang = lang;
    if (window.state && typeof window.state === 'object') window.state.lang = lang;
    return lang;
  }
  function language() {
    return persistLanguage(
      normalizeLang(localStorage.getItem('sg-lang')) ||
      normalizeLang(localStorage.getItem('hub_language')) ||
      normalizeLang(localStorage.getItem('hubLang')) ||
      normalizeLang(document.documentElement.lang) || 'en'
    );
  }
  const t = (key) => COPY[language()]?.[key] || COPY.en[key] || key;
  const cleanCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  function authUserId() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        const id = value?.user?.id || value?.currentSession?.user?.id || value?.session?.user?.id;
        if (id) return String(id);
      }
    } catch (_) {}
    return '';
  }
  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!value || value.status !== 'pending') return null;
      const id = authUserId();
      if (!id || (value.auth_user_id && value.auth_user_id !== id)) return null;
      return value;
    } catch (_) { return null; }
  }
  function writeCache(data, userId) {
    try {
      const id = userId || authUserId();
      if (!id) return;
      localStorage.setItem(CACHE_KEY, JSON.stringify({status:'pending', auth_user_id:id, code:cleanCode(data?.code), cached_at:Date.now()}));
    } catch (_) {}
  }
  function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (_) {} }

  let pendingState = live.registrationState?.status === 'pending' ? live.registrationState : readCache();
  let active = !!pendingState;
  let syncing = false;
  let lastLang = '';

  function accountCode() {
    return cleanCode(pendingState?.code || live.registrationState?.code || readCache()?.code) || 'PENDING';
  }

  function injectStyles() {
    if ($('#hubPendingStableStyles')) return;
    const style = document.createElement('style');
    style.id = 'hubPendingStableStyles';
    style.textContent = `
      #languageButton{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important}
      #languageButton>i{display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;padding-bottom:8px!important;box-sizing:border-box!important;transform:none!important;margin:0!important}

      body.hub-pending-account #communityButton,
      body.hub-pending-account #friendsButton,
      body.hub-pending-account [data-open-friends],
      body.hub-pending-account [data-friends-button],
      body.hub-pending-account [data-open-register],
      body.hub-pending-account .next-cup-cta,
      body.hub-pending-account [data-register-next-cup],
      body.hub-pending-account [data-next-cup-register],
      body.hub-pending-account #editAvatarButton,
      body.hub-pending-account #renameButton,
      body.hub-pending-account #profileAdminButton{display:none!important}

      body.hub-pending-account [data-page="profile"]>*:not(#hubPendingProfileSurface){display:none!important}
      body.hub-pending-account #hubPendingProfileSurface{display:grid!important}
      body.hub-pending-account .hub-pending-overview-host>*:not(#hubPendingOverviewSurface){display:none!important}
      body.hub-pending-account #hubPendingOverviewSurface{display:grid!important}

      .hub-pending-header-status{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,198,92,.28);background:rgba(255,198,92,.11);color:#ffc65c;border-radius:999px;padding:8px 11px;font:800 9px/1 Montserrat,Arial;letter-spacing:.06em;white-space:nowrap;cursor:pointer}
      .hub-pending-header-status i{display:grid;place-items:center;width:15px;height:15px;border:1px solid currentColor;border-radius:50%;font:italic 800 9px Georgia}

      #hubPendingOverviewSurface{gap:13px;align-content:start;box-sizing:border-box;width:100%;padding:20px 22px 18px}
      #hubPendingOverviewSurface .hub-pending-overview-kicker{color:#4de5dc;font:900 9px/1 Montserrat;letter-spacing:.12em}
      #hubPendingOverviewSurface h2{margin:0;font:900 23px/1.05 Montserrat,Arial;font-style:italic}
      #hubPendingOverviewSurface p{margin:0;color:#9d95ab;font:500 12px/1.55 Montserrat,Arial}
      #hubPendingOverviewSurface button{width:100%;margin-top:4px}

      #hubPendingProfileSurface{gap:16px;width:100%}
      .hub-pending-profile-hero,.hub-pending-profile-card{box-sizing:border-box;width:100%;border:1px solid rgba(105,60,174,.7);border-radius:16px;background:linear-gradient(180deg,rgba(30,13,52,.96),rgba(18,8,34,.96));color:#fff}
      .hub-pending-profile-hero{display:flex;align-items:center;gap:18px;padding:25px;min-height:130px}
      .hub-pending-avatar{display:grid;place-items:center;width:82px;height:82px;flex:0 0 82px;border:1px solid #3badd0;border-radius:13px;background:linear-gradient(135deg,#123f61,#32136c);font:900 25px Montserrat;color:#4de5dc;box-shadow:inset 0 0 0 8px rgba(255,255,255,.025)}
      .hub-pending-profile-copy{min-width:0}.hub-pending-profile-copy .kicker,.hub-pending-profile-card .kicker{display:block;margin-bottom:8px;color:#4de5dc;font:900 10px/1 Montserrat;letter-spacing:.12em}
      .hub-pending-profile-copy h1{margin:0;font:900 clamp(34px,5vw,58px)/.95 Montserrat,Arial;letter-spacing:.02em;overflow-wrap:anywhere}.hub-pending-profile-copy small{display:block;margin-top:8px;color:#8f88a1;font:600 10px Montserrat,Arial}.hub-pending-profile-copy small b{color:#ffc65c}
      .hub-pending-profile-card{padding:34px 32px;min-height:238px}.hub-pending-profile-card .kicker{color:#ffc65c}.hub-pending-profile-card h2{margin:0 0 14px;font:900 clamp(25px,3vw,34px)/1 Montserrat,Arial;font-style:italic}.hub-pending-profile-card p{max-width:760px;margin:0;color:#aaa2b7;font:500 15px/1.55 Montserrat,Arial}.hub-pending-profile-card button{margin-top:20px}

      #hubPendingPasswordModal{position:fixed;inset:0;z-index:10060;display:grid;place-items:center;padding:24px;background:rgba(5,2,18,.82);backdrop-filter:blur(10px)}
      #hubPendingPasswordModal[hidden]{display:none!important}
      .hub-pending-password-card{position:relative;width:min(520px,100%);box-sizing:border-box;padding:30px;border:1px solid rgba(145,86,255,.6);border-radius:22px;background:linear-gradient(180deg,rgba(27,14,58,.98),rgba(12,7,31,.98));color:#fff;box-shadow:0 28px 90px rgba(0,0,0,.6)}
      .hub-pending-password-card h2{margin:7px 0 18px;font:800 28px/1.05 Montserrat,sans-serif}.hub-pending-password-card label{display:grid;gap:7px;margin:12px 0;color:#d7d1e8;font:700 13px Montserrat}.hub-pending-password-card input{width:100%;box-sizing:border-box;border:1px solid rgba(145,86,255,.35);background:#0d0920;color:#fff;padding:13px 14px;border-radius:10px;outline:none;font:600 15px Montserrat}.hub-pending-password-actions{display:flex;gap:10px;margin-top:18px}.hub-pending-password-actions button{flex:1}.hub-pending-password-message{min-height:20px;margin:10px 0 0;color:#ff788f;font-size:12px;font-weight:700}.hub-pending-password-message.ok{color:#67e9b8}
      @media(max-width:760px){.hub-pending-profile-hero{align-items:flex-start;padding:20px}.hub-pending-avatar{width:64px;height:64px;flex-basis:64px}.hub-pending-profile-card{padding:25px 20px}}
    `;
    document.head.appendChild(style);
  }

  function overviewHost() {
    const known = $('.my-rank-card');
    if (known) return known;
    const login = $('[data-v3-overview-login]');
    return login?.closest('.panel,.card,section,article') || null;
  }

  function installHeader() {
    const button = $('#loginDemoButton');
    if (!button) return;
    button.removeAttribute('data-i18n');
    button.textContent = accountCode();
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.classList.add('is-account');
    button.title = t('account');

    let status = $('#hubPendingHeaderStatus');
    if (!status) {
      status = document.createElement('button');
      status.type = 'button';
      status.id = 'hubPendingHeaderStatus';
      status.className = 'hub-pending-header-status';
      button.insertAdjacentElement('afterend', status);
      status.addEventListener('click', (event) => { event.preventDefault(); location.href = 'pending.html'; });
    }
    status.innerHTML = `<i>i</i>${t('pending')}`;
  }

  function hideRestricted() {
    $$('[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register]').forEach(el => { el.hidden = true; el.style.setProperty('display','none','important'); });
    const header = $('.site-header') || document;
    $$('#communityButton,#friendsButton,[data-open-friends],[data-friends-button]', header).forEach(el => { el.hidden = true; el.style.setProperty('display','none','important'); });
  }

  function renderOverview() {
    const host = overviewHost();
    if (!host) return;
    host.classList.add('hub-pending-overview-host');
    let surface = $('#hubPendingOverviewSurface', host);
    if (!surface) { surface = document.createElement('div'); surface.id = 'hubPendingOverviewSurface'; host.appendChild(surface); }
    const lang = language();
    if (surface.dataset.lang === lang && surface.dataset.code === accountCode()) return;
    surface.dataset.lang = lang;
    surface.dataset.code = accountCode();
    surface.innerHTML = `<span class="hub-pending-overview-kicker">HUB ACCOUNT</span><h2>${t('overviewTitle')}</h2><p>${t('overviewText')}</p><button type="button" class="secondary-button" data-hub-pending-profile-open>${t('viewProfile')}</button>`;
  }

  function renderProfile() {
    const page = $('[data-page="profile"]');
    if (!page) return;
    let surface = $('#hubPendingProfileSurface', page);
    if (!surface) { surface = document.createElement('div'); surface.id = 'hubPendingProfileSurface'; page.prepend(surface); }
    const lang = language();
    if (surface.dataset.lang === lang && surface.dataset.code === accountCode()) return;
    surface.dataset.lang = lang;
    surface.dataset.code = accountCode();
    surface.innerHTML = `<section class="hub-pending-profile-hero"><div class="hub-pending-avatar">•••</div><div class="hub-pending-profile-copy"><span class="kicker">${t('playerProfile')}</span><h1>${accountCode()}</h1><small>${t('bloxdName')} · <b>ⓘ ${t('pending')}</b></small></div></section><section class="hub-pending-profile-card"><span class="kicker">${t('verification')}</span><h2>${t('statsHidden')}</h2><p>${t('statsText')}</p><button type="button" class="secondary-button" data-hub-pending-status-open>${t('viewStatus')}</button></section>`;
  }

  function showPage(name) {
    if (typeof window.setPage === 'function') { window.setPage(name); return; }
    $$('.page').forEach(page => page.classList.toggle('active', page.dataset.page === name));
    $$('.primary-nav [data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === name));
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function closeAccountModal() { $('#v3AccountModal[data-pending-account-modal="1"]')?.remove(); }
  function openAccountModal() {
    closeAccountModal();
    $('#v3AuthModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'v3AccountModal';
    modal.dataset.pendingAccountModal = '1';
    modal.className = 'v3-modal-backdrop';
    modal.innerHTML = `<section class="v3-modal v3-account-modal"><button class="modal-close" data-v3-close type="button">×</button><span class="eyebrow">${t('account')}</span><h2>${accountCode()}</h2><div class="v3-account-actions"><button class="secondary-button wide" id="v3GoProfile" type="button">${t('myProfile')}</button><button class="ghost-button wide" id="v3ChangePassword" type="button">${t('changePassword')}</button><button class="ghost-button wide danger" id="v3Logout" type="button">${t('logout')}</button></div></section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => { if (event.target === modal || event.target.closest('[data-v3-close]')) modal.remove(); });
    $('#v3GoProfile', modal).onclick = () => { modal.remove(); showPage('profile'); renderProfile(); };
    $('#v3ChangePassword', modal).onclick = () => { modal.remove(); openPasswordModal(); };
    $('#v3Logout', modal).onclick = () => logout();
  }

  function openPasswordModal() {
    let modal = $('#hubPendingPasswordModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'hubPendingPasswordModal'; document.body.appendChild(modal); }
    modal.innerHTML = `<section class="hub-pending-password-card"><span class="eyebrow">${t('account')}</span><h2>${t('passwordTitle')}</h2><label><span>${t('newPassword')}</span><input data-hub-pass-one type="password" autocomplete="new-password"></label><label><span>${t('confirmPassword')}</span><input data-hub-pass-two type="password" autocomplete="new-password"></label><p class="hub-pending-password-message" data-hub-pass-message></p><div class="hub-pending-password-actions"><button type="button" class="ghost-button" data-hub-pass-cancel>${t('cancel')}</button><button type="button" class="secondary-button" data-hub-pass-save>${t('savePassword')}</button></div></section>`;
    modal.hidden = false;
    modal.onclick = event => { if (event.target === modal || event.target.closest('[data-hub-pass-cancel]')) modal.hidden = true; };
    $('[data-hub-pass-save]', modal).onclick = savePassword;
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
      const {error} = await api.client.auth.updateUser({password:one});
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
    try { if (window.HubPresenceClear) await window.HubPresenceClear(); } catch (_) {}
    try { if (typeof api.logout === 'function') await api.logout(); else await api.client.auth.signOut(); } catch (error) { console.warn(error); }
    clearCache();
    pendingState = null;
    active = false;
    live.registrationState = null;
    location.href = 'index.html#overview';
    location.reload();
  }

  function sync() {
    if (!active || syncing) return;
    syncing = true;
    try {
      document.body.classList.add('hub-pending-account');
      document.body.dataset.hubAccountState = 'pending';
      installHeader();
      hideRestricted();
      renderOverview();
      renderProfile();
      lastLang = language();
    } finally { syncing = false; }
  }

  function clearPendingUi() {
    active = false;
    pendingState = null;
    live.registrationState = null;
    document.body.classList.remove('hub-pending-account');
    if (document.body.dataset.hubAccountState === 'pending') delete document.body.dataset.hubAccountState;
    $('#hubPendingHeaderStatus')?.remove();
    $('#v3AccountModal[data-pending-account-modal="1"]')?.remove();
    $('#hubPendingPasswordModal')?.remove();
    $('#hubPendingProfileSurface')?.remove();
    $('#hubPendingOverviewSurface')?.remove();
    $$('.hub-pending-overview-host').forEach(host => host.classList.remove('hub-pending-overview-host'));
  }

  async function currentSession() {
    if (typeof api.currentSession === 'function') return await api.currentSession();
    const {data} = await api.client.auth.getSession();
    return data?.session || null;
  }
  async function refresh() {
    try {
      const session = await currentSession();
      if (!session) { clearCache(); clearPendingUi(); return; }
      const {data, error} = await api.client.rpc('get_my_registration_status');
      if (error) throw error;
      if (data?.status === 'pending') {
        pendingState = data;
        live.registrationState = data;
        active = true;
        writeCache(data, session.user?.id);
        sync();
        return;
      }
      clearCache();
      const was = active;
      clearPendingUi();
      if (was) location.reload();
    } catch (error) {
      console.warn('Pending state refresh failed', error);
      const cached = readCache();
      if (cached) { pendingState = cached; active = true; sync(); }
    }
  }

  function handlePendingActions(event) {
    if (!active) return;
    const target = event.target;
    if (target.closest?.('[data-hub-pending-profile-open]')) { event.preventDefault(); event.stopImmediatePropagation(); showPage('profile'); renderProfile(); return; }
    if (target.closest?.('.primary-nav [data-route="profile"]')) { event.preventDefault(); event.stopImmediatePropagation(); showPage('profile'); renderProfile(); return; }
    if (target.closest?.('[data-hub-pending-status-open]')) { event.preventDefault(); event.stopImmediatePropagation(); location.href = 'pending.html'; return; }
    if (target.closest?.('#communityButton,#friendsButton,[data-open-friends],[data-friends-button],[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register]')) { event.preventDefault(); event.stopImmediatePropagation(); core.toast?.(t('blocked'), true); }
  }

  injectStyles();
  language();

  // Important: the verified V3 app intercepts this button on document capture.
  // Window capture runs first, so Pending can claim the click before V3 falls back to the login modal.
  window.addEventListener('click', event => {
    if (!active) return;
    const account = event.target.closest?.('#loginDemoButton');
    if (!account) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openAccountModal();
  }, true);

  document.addEventListener('click', handlePendingActions, true);
  document.addEventListener('click', event => {
    const langButton = event.target.closest?.('[data-lang]');
    if (!langButton?.dataset.lang) return;
    const lang = persistLanguage(langButton.dataset.lang);
    if (typeof window.applyLanguage === 'function') window.applyLanguage(lang);
    setTimeout(() => { if (active) sync(); }, 0);
    setTimeout(() => { if (active) sync(); }, 120);
  }, true);

  window.addEventListener('hashchange', () => { if (active) sync(); });
  window.addEventListener('storage', event => {
    if (!['sg-lang','hub_language','hubLang'].includes(event.key)) return;
    const lang = language();
    if (typeof window.applyLanguage === 'function') window.applyLanguage(lang);
    if (active) sync();
  });
  document.addEventListener('hub:auth-restored', event => {
    const detail = event.detail || {};
    if (detail.loggedIn === false) { clearCache(); clearPendingUi(); return; }
    if (detail.registrationState?.status === 'pending') {
      pendingState = detail.registrationState;
      live.registrationState = pendingState;
      active = true;
      writeCache(pendingState, detail.session?.user?.id || detail.user?.id);
      sync();
      return;
    }
    if (detail.registrationState?.status === 'verified') {
      const was = active;
      clearCache();
      clearPendingUi();
      if (was) location.reload();
      return;
    }
    setTimeout(refresh, 20);
  });

  new MutationObserver(() => {
    if (!active) return;
    const lang = language();
    if (lang !== lastLang) {
      if (typeof window.applyLanguage === 'function' && window.state?.lang !== lang) window.applyLanguage(lang);
      sync();
    }
  }).observe(document.documentElement, {childList:true, subtree:true, characterData:true});

  setTimeout(refresh, 20);
  setInterval(refresh, 10000);
})();
