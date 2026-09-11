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
      passwordShort:'Password must be at least 8 characters long.', passwordMismatch:'Passwords do not match.', passwordSaved:'Password changed.', passwordError:'Password could not be changed.', blocked:'This feature becomes available after your Bloxd verification.',
      pendingIntro:'Your HUB account has been created, but it does not have a player name yet. Your name, stats, rating and tournament history are added only after Bloxd verification.',
      registration:'YOUR REGISTRATION', pendingTitle:'Verification pending', pendingText:'Your account was created successfully. This registration code belongs to your Pending account and stays visible until verification has been completed.',
      yourCode:'YOUR REGISTRATION CODE', copyCode:'COPY CODE', checkStatus:'CHECK STATUS', pendingNote:'Your verification is still pending. Once your permanent Bloxd ID has been confirmed, your profile is unlocked automatically.',
      copied:'Code copied.', copyFail:'Could not copy the code.', noCode:'No registration code is available for this account.', statusError:'Could not load verification status.',
      bridgeEyebrow:'DIRECT VERIFICATION', bridgeTitle:'HUB Verify Extension', bridgeBadge:'IN DEVELOPMENT', bridgeText:'As a second verification method, we are building our own Chrome extension. It runs directly on Bloxd.io and can securely pass the player identity required by the HUB to our website – without typing a long code.',
      bridgeStep1:'Install the HUB Verify Extension', bridgeStep2:'Connect it to your HUB account', bridgeStep3:'Open Bloxd and confirm automatically', bridgeButton:'EXTENSION COMING SOON', bridgeNote:'The extension is not enabled yet. The download will appear only after the complete verification flow has been tested.',
      untilThen:'Until then', untilText:'You can already use the HUB. Your player name, stats and account-bound features unlock automatically once verification is complete.', backHub:'TO OVERVIEW'
    },
    de: {
      pending:'VERIFIZIERUNG AUSSTEHEND', account:'ACCOUNT', myProfile:'MEIN PROFIL', changePassword:'PASSWORT ÄNDERN', logout:'LOG OUT',
      playerProfile:'SPIELERPROFIL', bloxdName:'Bloxd.io Name', verification:'BLOXD VERIFIZIERUNG', statsHidden:'STATISTIKEN NOCH NICHT SICHTBAR',
      statsText:'Deine Statistiken, dein Rating und deine bisherigen Turniere werden sichtbar, sobald du verifiziert wurdest. Bis dahin ist dein 8-Zeichen-Code deine HUB-Kennung.',
      viewStatus:'VERIFIZIERUNGSSTATUS ANSEHEN', overviewTitle:'VERIFIZIERUNG AUSSTEHEND', overviewText:'Du bist bereits eingeloggt. Stats, Rating und dein Bloxd.io Spielerprofil werden sichtbar, sobald deine Verifizierung abgeschlossen ist.', viewProfile:'MEIN PROFIL',
      passwordTitle:'Passwort ändern', newPassword:'Neues Passwort', confirmPassword:'Passwort wiederholen', savePassword:'PASSWORT SPEICHERN', cancel:'ABBRECHEN',
      passwordShort:'Das Passwort muss mindestens 8 Zeichen lang sein.', passwordMismatch:'Die Passwörter stimmen nicht überein.', passwordSaved:'Passwort wurde geändert.', passwordError:'Passwort konnte nicht geändert werden.', blocked:'Diese Funktion wird nach deiner Bloxd-Verifizierung freigeschaltet.',
      pendingIntro:'Dein HUB-Account ist angelegt, hat aber noch keinen Spielernamen. Name, Stats, Rating und Turnierhistorie werden erst nach der Bloxd-Verifizierung übernommen.',
      registration:'DEINE REGISTRIERUNG', pendingTitle:'Verifizierung ausstehend', pendingText:'Dein Account wurde erfolgreich erstellt. Dieser Registrierungscode gehört zu deinem Pending-Account und bleibt sichtbar, solange die Verifizierung noch nicht abgeschlossen ist.',
      yourCode:'DEIN REGISTRIERUNGSCODE', copyCode:'CODE KOPIEREN', checkStatus:'STATUS PRÜFEN', pendingNote:'Deine Verifizierung steht noch aus. Sobald deine permanente Bloxd-ID bestätigt wurde, wird dein Profil automatisch freigeschaltet.',
      copied:'Code kopiert.', copyFail:'Kopieren war nicht möglich.', noCode:'Für diesen Account ist kein Registrierungscode verfügbar.', statusError:'Status konnte nicht geladen werden.',
      bridgeEyebrow:'DIREKTE VERIFIZIERUNG', bridgeTitle:'HUB Verify Extension', bridgeBadge:'IN VORBEREITUNG', bridgeText:'Als zweite Verifizierungsart bauen wir eine eigene Chrome-Erweiterung. Sie läuft direkt auf Bloxd.io und kann die für den HUB benötigte Spieler-Identität sicher an unsere Website weiterreichen – ohne langen Code zum Abtippen.',
      bridgeStep1:'HUB Verify Extension installieren', bridgeStep2:'Mit deinem HUB-Account verbinden', bridgeStep3:'Bloxd öffnen und automatisch bestätigen', bridgeButton:'EXTENSION BALD VERFÜGBAR', bridgeNote:'Die Erweiterung ist noch nicht freigeschaltet. Wir zeigen den Download erst an, sobald die komplette Verifizierungskette getestet ist.',
      untilThen:'Bis dahin', untilText:'Du kannst den HUB bereits nutzen. Dein eigener Spielername, deine Stats und accountgebundene Funktionen werden automatisch freigeschaltet, sobald die Verifizierung abgeschlossen ist.', backHub:'ZUR OVERVIEW'
    },
    fr: {
      pending:'VÉRIFICATION EN ATTENTE', account:'COMPTE', myProfile:'MON PROFIL', changePassword:'CHANGER LE MOT DE PASSE', logout:'SE DÉCONNECTER',
      playerProfile:'PROFIL DU JOUEUR', bloxdName:'Nom Bloxd.io', verification:'VÉRIFICATION BLOXD', statsHidden:'STATISTIQUES PAS ENCORE VISIBLES',
      statsText:'Tes statistiques, ton rating et tes tournois précédents deviennent visibles dès que tu es vérifié. Jusque-là, ton code à 8 caractères est ton identifiant HUB.',
      viewStatus:'VOIR LE STATUT DE VÉRIFICATION', overviewTitle:'VÉRIFICATION EN ATTENTE', overviewText:'Tu es déjà connecté. Les statistiques, le rating et ton profil Bloxd.io deviennent visibles dès que la vérification est terminée.', viewProfile:'MON PROFIL',
      passwordTitle:'Changer le mot de passe', newPassword:'Nouveau mot de passe', confirmPassword:'Répéter le mot de passe', savePassword:'ENREGISTRER', cancel:'ANNULER',
      passwordShort:'Le mot de passe doit contenir au moins 8 caractères.', passwordMismatch:'Les mots de passe ne correspondent pas.', passwordSaved:'Mot de passe modifié.', passwordError:'Impossible de modifier le mot de passe.', blocked:'Cette fonction sera disponible après ta vérification Bloxd.',
      pendingIntro:'Ton compte HUB est créé, mais il n’a pas encore de nom de joueur. Le nom, les statistiques, le classement et l’historique sont ajoutés seulement après la vérification Bloxd.',
      registration:'TON INSCRIPTION', pendingTitle:'Vérification en attente', pendingText:'Ton compte a bien été créé. Ce code d’inscription appartient à ton compte en attente et reste visible jusqu’à la fin de la vérification.',
      yourCode:'TON CODE D’INSCRIPTION', copyCode:'COPIER LE CODE', checkStatus:'VÉRIFIER LE STATUT', pendingNote:'Ta vérification est toujours en attente. Dès que ton identifiant Bloxd permanent est confirmé, ton profil est débloqué automatiquement.',
      copied:'Code copié.', copyFail:'Impossible de copier le code.', noCode:'Aucun code d’inscription n’est disponible pour ce compte.', statusError:'Impossible de charger le statut de vérification.',
      bridgeEyebrow:'VÉRIFICATION DIRECTE', bridgeTitle:'HUB Verify Extension', bridgeBadge:'EN PRÉPARATION', bridgeText:'Comme deuxième méthode, nous préparons notre propre extension Chrome. Elle fonctionne directement sur Bloxd.io et transmet au HUB l’identité joueur nécessaire, sans long code à recopier.',
      bridgeStep1:'Installer HUB Verify Extension', bridgeStep2:'La connecter à ton compte HUB', bridgeStep3:'Ouvrir Bloxd et confirmer automatiquement', bridgeButton:'EXTENSION BIENTÔT DISPONIBLE', bridgeNote:'L’extension n’est pas encore activée. Le téléchargement sera proposé après le test complet du processus de vérification.',
      untilThen:'En attendant', untilText:'Tu peux déjà utiliser le HUB. Ton nom de joueur, tes statistiques et les fonctions liées au compte seront débloqués automatiquement après la vérification.', backHub:'VERS L’APERÇU'
    }
  };

  const normalizeLang = value => {
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
    return lang;
  }
  function language() {
    return persistLanguage(normalizeLang(localStorage.getItem('sg-lang')) || normalizeLang(localStorage.getItem('hub_language')) || normalizeLang(localStorage.getItem('hubLang')) || normalizeLang(document.documentElement.lang) || 'en');
  }
  const t = key => COPY[language()]?.[key] || COPY.en[key] || key;
  const cleanCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  function installBootProgress() {
    const root = document.documentElement;
    if (!root.classList.contains('hub-live-booting')) return;
    let finishing = false;
    let released = false;
    root.style.setProperty('--hub-load-progress', '0');
    const set = value => { if (!finishing) root.style.setProperty('--hub-load-progress', String(value)); };
    setTimeout(() => set(24), 35);
    setTimeout(() => set(52), 125);
    setTimeout(() => set(70), 245);
    setTimeout(() => set(80), 390);
    const observer = new MutationObserver(() => {
      if (released || finishing || root.classList.contains('hub-live-booting')) return;
      finishing = true;
      root.classList.add('hub-live-booting');
      root.style.setProperty('--hub-load-progress', '80');
      requestAnimationFrame(() => requestAnimationFrame(() => root.style.setProperty('--hub-load-progress', '100')));
      setTimeout(() => {
        released = true;
        root.classList.remove('hub-live-booting');
        observer.disconnect();
      }, 310);
    });
    observer.observe(root, {attributes:true, attributeFilter:['class']});
  }

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
      localStorage.setItem(CACHE_KEY, JSON.stringify({status:'pending', auth_user_id:id, source:data?.source || '', code:cleanCode(data?.code || readCache()?.code), cached_at:Date.now()}));
    } catch (_) {}
  }
  function clearCache() { try { localStorage.removeItem(CACHE_KEY); } catch (_) {} }

  let pendingState = live.registrationState?.status === 'pending' ? live.registrationState : readCache();
  let active = !!pendingState;
  let syncing = false;
  let syncTimer = 0;
  let lastLang = '';

  function accountCode() { return cleanCode(pendingState?.code || live.registrationState?.code || readCache()?.code) || 'PENDING'; }

  function injectStyles() {
    if ($('#hubPendingStableStyles')) return;
    const style = document.createElement('style');
    style.id = 'hubPendingStableStyles';
    style.textContent = `
      /* Boot progress: quickly reaches 80%, waits for real HUB boot, then completes. */
      html.hub-live-booting .site-header .hub-brand::before{content:""!important;visibility:visible!important;position:absolute!important;left:50%!important;bottom:-25px!important;transform:translateX(-50%)!important;width:92%!important;height:4px!important;border-radius:999px!important;background:rgba(255,255,255,.1)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)!important}
      html.hub-live-booting .site-header .hub-brand::after{content:""!important;visibility:visible!important;position:absolute!important;left:4%!important;bottom:-25px!important;width:calc(var(--hub-load-progress,0) * .92%)!important;height:4px!important;border-radius:999px!important;background:linear-gradient(90deg,#37ead7,#56c7ff,#aa55ff)!important;box-shadow:0 0 16px rgba(67,224,221,.38)!important;transition:width .26s cubic-bezier(.2,.8,.2,1)!important}

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
      .hub-pending-header-status:hover,.hub-pending-header-status.active{border-color:rgba(255,198,92,.58);background:rgba(255,198,92,.16)}
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

      /* Integrated Pending route: same SPA shell, no separate pending.html header. */
      .hub-pending-page{padding:30px 0 70px!important}
      .hub-pending-page-inner{display:grid;gap:16px;width:100%}
      .hub-pending-route-hero,.hub-pending-route-card,.hub-pending-route-strip{border:1px solid rgba(126,79,241,.46);border-radius:18px;background:linear-gradient(180deg,rgba(23,10,57,.94),rgba(12,8,36,.93));box-shadow:0 28px 80px rgba(5,0,20,.38),inset 0 1px 0 rgba(255,255,255,.035)}
      .hub-pending-route-hero{display:flex;align-items:center;gap:20px;padding:27px 26px}
      .hub-pending-route-avatar{display:grid;place-items:center;width:78px;height:78px;flex:0 0 78px;border:1px solid rgba(56,240,219,.4);border-radius:15px;background:linear-gradient(145deg,rgba(56,240,219,.13),rgba(124,66,255,.22));color:#38f0db;font:900 27px Montserrat}
      .hub-pending-route-copy{min-width:0}.hub-pending-route-badge{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;background:rgba(244,189,79,.11);color:#f4bd4f;font:900 9px/1 Montserrat;letter-spacing:.08em}.hub-pending-route-badge i{display:grid;place-items:center;width:14px;height:14px;border:1px solid currentColor;border-radius:50%;font:italic 800 8px Georgia}
      .hub-pending-route-copy h1{margin:8px 0;font:900 clamp(32px,5vw,52px)/1 Montserrat,Arial;letter-spacing:.12em;overflow-wrap:anywhere}.hub-pending-route-copy p{max-width:900px;margin:0;color:#a79bc8;font:600 13px/1.6 Montserrat,Arial}
      .hub-pending-route-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:16px}
      .hub-pending-route-card{padding:24px}.hub-pending-route-card .eyebrow{display:block;margin-bottom:5px;color:#f4bd4f;font-size:9px;font-weight:900;letter-spacing:.13em}.hub-pending-route-card .eyebrow.teal{color:#38f0db}.hub-pending-route-card h2{margin:6px 0 12px;font-size:28px;letter-spacing:-.03em}.hub-pending-route-card p{color:#a79bc8;line-height:1.65;font-size:13px}
      .hub-pending-route-code{display:grid;gap:10px;margin:17px 0;padding:17px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:rgba(255,255,255,.035)}.hub-pending-route-code>span{color:#81758f;font-size:8px;font-weight:900;letter-spacing:.13em}.hub-pending-route-code>strong{font-size:30px;letter-spacing:.18em;word-break:break-all}.hub-pending-route-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:5px}.hub-pending-route-status{min-height:18px;margin:10px 0 0!important;font-size:11px!important}.hub-pending-route-status.success{color:#54edbb!important}.hub-pending-route-status.error{color:#ff8194!important}.hub-pending-route-note{margin-top:15px!important;padding-top:15px;border-top:1px solid rgba(255,255,255,.06)}
      .hub-pending-bridge-badge{display:inline-flex;width:max-content;margin:4px 0 12px;padding:7px 10px;border:1px solid rgba(244,189,79,.3);border-radius:999px;background:rgba(244,189,79,.1);color:#f4bd4f;font-size:8px;font-weight:900;letter-spacing:.08em}.hub-pending-route-steps{display:grid;gap:8px;margin:18px 0}.hub-pending-route-steps>div{display:grid;grid-template-columns:27px 1fr;align-items:center;gap:9px}.hub-pending-route-steps b{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:rgba(56,240,219,.09);color:#38f0db;font-size:11px}.hub-pending-route-steps span{color:#aaa1b6;font-size:12px}.hub-pending-route-card button[disabled]{opacity:.48;cursor:not-allowed}
      .hub-pending-route-strip{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:21px 24px}.hub-pending-route-strip strong{font-size:16px}.hub-pending-route-strip p{max-width:900px;margin:4px 0 0;color:#a79bc8;font-size:13px;line-height:1.55}
      .hub-pending-modal-message{min-height:19px;margin:7px 0 0;color:#ff788f;font-size:12px;font-weight:700}.hub-pending-modal-message.ok{color:#67e9b8}
      @media(max-width:900px){.hub-pending-route-grid{grid-template-columns:1fr}}
      @media(max-width:760px){.hub-pending-profile-hero,.hub-pending-route-hero{align-items:flex-start;padding:20px}.hub-pending-avatar,.hub-pending-route-avatar{width:64px;height:64px;flex-basis:64px}.hub-pending-profile-card{padding:25px 20px}.hub-pending-route-card{padding:20px}.hub-pending-route-strip{align-items:stretch;flex-direction:column}}
      @media(max-width:480px){.hub-pending-route-actions{display:grid}.hub-pending-route-actions button{width:100%}.hub-pending-route-code>strong{font-size:22px;letter-spacing:.14em}}
    `;
    document.head.appendChild(style);
  }

  function overviewHost() {
    const known = $('.my-rank-card');
    if (known) return known;
    const login = $('[data-v3-overview-login]');
    return login?.closest('.panel,.card,section,article') || null;
  }

  function showPage(name) {
    $$('.page').forEach(page => page.classList.toggle('active', page.dataset.page === name));
    $$('.primary-nav [data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === name));
    $('#hubPendingHeaderStatus')?.classList.toggle('active', name === 'pending');
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    window.scrollTo({top:0, behavior:'smooth'});
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
      status.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        ensurePendingPage();
        showPage('pending');
      });
    }
    status.innerHTML = `<i>i</i>${t('pending')}`;
    status.classList.toggle('active', location.hash === '#pending');
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

  function ensurePendingPage() {
    const shell = $('.app-shell');
    if (!shell) return null;
    let page = $('#hubPendingPage');
    if (!page) {
      page = document.createElement('section');
      page.id = 'hubPendingPage';
      page.className = 'page hub-pending-page';
      page.dataset.page = 'pending';
      shell.appendChild(page);
    }
    renderPendingPage(page);
    return page;
  }

  function renderPendingPage(page = $('#hubPendingPage')) {
    if (!page) return;
    const lang = language();
    const code = accountCode();
    const oldStatus = $('#hubPendingRouteStatus', page)?.textContent || '';
    const oldStatusClass = $('#hubPendingRouteStatus', page)?.className || 'hub-pending-route-status';
    if (page.dataset.lang === lang && page.dataset.code === code && page.firstElementChild) return;
    page.dataset.lang = lang;
    page.dataset.code = code;
    page.innerHTML = `<div class="hub-pending-page-inner">
      <section class="hub-pending-route-hero"><div class="hub-pending-route-avatar">•••</div><div class="hub-pending-route-copy"><span class="hub-pending-route-badge"><i>i</i>${t('pending')}</span><h1>${code}</h1><p>${t('pendingIntro')}</p></div></section>
      <div class="hub-pending-route-grid">
        <article class="hub-pending-route-card"><span class="eyebrow">${t('registration')}</span><h2>${t('pendingTitle')}</h2><p>${t('pendingText')}</p><div class="hub-pending-route-code"><span>${t('yourCode')}</span><strong>${code}</strong><div class="hub-pending-route-actions"><button type="button" class="secondary-button" data-hub-copy-code>${t('copyCode')}</button><button type="button" class="secondary-button" data-hub-check-status>${t('checkStatus')}</button></div></div><p id="hubPendingRouteStatus" class="${oldStatusClass}">${oldStatus || t('pendingNote')}</p><p class="hub-pending-route-note">${t('pendingNote')}</p></article>
        <article class="hub-pending-route-card"><span class="eyebrow teal">${t('bridgeEyebrow')}</span><h2>${t('bridgeTitle')}</h2><span class="hub-pending-bridge-badge">${t('bridgeBadge')}</span><p>${t('bridgeText')}</p><div class="hub-pending-route-steps"><div><b>1</b><span>${t('bridgeStep1')}</span></div><div><b>2</b><span>${t('bridgeStep2')}</span></div><div><b>3</b><span>${t('bridgeStep3')}</span></div></div><button type="button" class="secondary-button" disabled>${t('bridgeButton')}</button><p>${t('bridgeNote')}</p></article>
      </div>
      <section class="hub-pending-route-strip"><div><strong>${t('untilThen')}</strong><p>${t('untilText')}</p></div><button type="button" class="secondary-button" data-hub-pending-overview-open>${t('backHub')}</button></section>
    </div>`;
  }

  function setRouteStatus(text, type = '') {
    const el = $('#hubPendingRouteStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `hub-pending-route-status ${type}`.trim();
  }

  function modalShell(id, inner) {
    $(`#${id}`)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'v3-modal-backdrop';
    el.innerHTML = inner;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-v3-close]')) el.remove(); });
    return el;
  }

  function openAccountModal() {
    if (!active) return;
    const m = modalShell('v3AccountModal', `<section class="v3-modal v3-account-modal"><button class="modal-close" data-v3-close type="button">×</button><span class="eyebrow">${t('account')}</span><h2>${accountCode()}</h2><div class="v3-account-actions"><button class="secondary-button wide" type="button" data-hub-account-profile>${t('myProfile')}</button><button class="ghost-button wide" type="button" data-hub-account-password>${t('changePassword')}</button><button class="ghost-button wide danger" type="button" data-hub-account-logout>${t('logout')}</button></div></section>`);
    $('[data-hub-account-profile]', m).onclick = () => { m.remove(); showPage('profile'); renderProfile(); };
    $('[data-hub-account-password]', m).onclick = () => { m.remove(); openPasswordModal(); };
    $('[data-hub-account-logout]', m).onclick = () => logout();
  }

  function openPasswordModal() {
    const m = modalShell('hubPendingPasswordModal', `<section class="v3-modal"><button class="modal-close" data-v3-close type="button">×</button><span class="eyebrow">${t('account')}</span><h2>${t('passwordTitle')}</h2><form id="hubPendingPasswordForm"><label><span>${t('newPassword')}</span><input name="one" type="password" autocomplete="new-password" minlength="8"></label><label><span>${t('confirmPassword')}</span><input name="two" type="password" autocomplete="new-password" minlength="8"></label><div class="hub-pending-modal-message"></div><div class="v3-account-actions"><button class="secondary-button wide" type="button" data-v3-close>${t('cancel')}</button><button class="cta-button wide" type="submit">${t('savePassword')}</button></div></form></section>`);
    $('#hubPendingPasswordForm', m).onsubmit = async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const one = String(form.get('one') || '');
      const two = String(form.get('two') || '');
      const message = $('.hub-pending-modal-message', m);
      message.classList.remove('ok');
      if (one.length < 8) { message.textContent = t('passwordShort'); return; }
      if (one !== two) { message.textContent = t('passwordMismatch'); return; }
      e.submitter.disabled = true;
      try {
        const {error} = await api.client.auth.updateUser({password:one});
        if (error) throw error;
        message.textContent = t('passwordSaved');
        message.classList.add('ok');
        setTimeout(() => m.remove(), 700);
      } catch (error) {
        console.error(error);
        message.textContent = t('passwordError');
        e.submitter.disabled = false;
      }
    };
    setTimeout(() => $('input[name="one"]', m)?.focus(), 30);
  }

  async function copyCode() {
    const code = accountCode();
    if (!code || code === 'PENDING') { setRouteStatus(t('noCode'), 'error'); return; }
    try { await navigator.clipboard.writeText(code); setRouteStatus(t('copied'), 'success'); }
    catch (_) { setRouteStatus(t('copyFail'), 'error'); }
  }

  async function logout() {
    try { if (window.HubPresenceClear) await window.HubPresenceClear(); } catch (_) {}
    try { await api.client.auth.signOut(); } catch (error) { console.warn(error); }
    clearCache();
    pendingState = null;
    active = false;
    live.registrationState = null;
    location.href = 'index.html#overview';
    location.reload();
  }

  function clearPendingUi() {
    active = false;
    pendingState = null;
    live.registrationState = null;
    document.body.classList.remove('hub-pending-account');
    if (document.body.dataset.hubAccountState === 'pending') delete document.body.dataset.hubAccountState;
    $('#hubPendingHeaderStatus')?.remove();
    $('#v3AccountModal')?.remove();
    $('#hubPendingPasswordModal')?.remove();
    $('#hubPendingProfileSurface')?.remove();
    $('#hubPendingOverviewSurface')?.remove();
    $('#hubPendingPage')?.remove();
    $$('.hub-pending-overview-host').forEach(host => host.classList.remove('hub-pending-overview-host'));
  }

  function sync() {
    if (!active || syncing) return;
    syncing = true;
    try {
      document.body.classList.add('hub-pending-account');
      document.body.dataset.hubAccountState = 'pending';
      $('#v3AuthModal')?.remove();
      installHeader();
      hideRestricted();
      renderOverview();
      renderProfile();
      ensurePendingPage();
      lastLang = language();
      const route = location.hash.replace('#', '');
      if (route === 'pending') showPage('pending');
    } finally { syncing = false; }
  }

  function queueSync(force = false) {
    if (!active || syncTimer) return;
    if (!force) {
      const headerOk = $('#loginDemoButton')?.textContent.trim() === accountCode();
      const langOk = language() === lastLang;
      const pendingOk = !!$('#hubPendingPage');
      const friendsHidden = !$('#communityButton') || getComputedStyle($('#communityButton')).display === 'none';
      if (headerOk && langOk && pendingOk && friendsHidden) return;
    }
    syncTimer = setTimeout(() => { syncTimer = 0; sync(); }, 30);
  }

  async function currentSession() {
    if (typeof api.currentSession === 'function') return await api.currentSession();
    const {data} = await api.client.auth.getSession();
    return data?.session || null;
  }

  async function refresh({showMessage = false} = {}) {
    try {
      const session = await currentSession();
      if (!session) { clearCache(); clearPendingUi(); if (location.hash === '#pending') showPage('overview'); return; }
      const {data, error} = await api.client.rpc('get_my_registration_status');
      if (error) throw error;
      if (data?.status === 'pending') {
        pendingState = data;
        live.registrationState = data;
        active = true;
        writeCache(data, session.user?.id);
        sync();
        if (showMessage) setRouteStatus(t('pendingNote'));
        return;
      }
      if (data?.status === 'verified') {
        const wasPending = active || location.hash === '#pending';
        clearCache();
        clearPendingUi();
        if (wasPending) { location.hash = '#profile'; location.reload(); }
        return;
      }
      if (data?.status === 'unlinked' || data?.status === 'logged_out') {
        clearCache();
        clearPendingUi();
        if (location.hash === '#pending') location.href = 'register.html';
        return;
      }
      if (showMessage) setRouteStatus(data?.failure_reason || t('statusError'), 'error');
    } catch (error) {
      console.warn('Pending state refresh failed', error);
      const cached = readCache();
      if (cached) { pendingState = cached; active = true; sync(); if (showMessage) setRouteStatus(t('statusError'), 'error'); }
      else if (showMessage) setRouteStatus(t('statusError'), 'error');
    }
  }

  function handleWindowCapture(event) {
    if (!active) return;
    const target = event.target;
    const accountButton = target.closest?.('#loginDemoButton');
    if (accountButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAccountModal();
      return;
    }
    if (target.closest?.('#communityButton,#friendsButton,[data-open-friends],[data-friends-button],[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      core.toast?.(t('blocked'), true);
    }
  }

  function handleDocumentClick(event) {
    if (!active) return;
    const target = event.target;
    if (target.closest?.('[data-hub-pending-profile-open]')) { event.preventDefault(); showPage('profile'); renderProfile(); return; }
    if (target.closest?.('[data-hub-pending-status-open]')) { event.preventDefault(); ensurePendingPage(); showPage('pending'); return; }
    if (target.closest?.('[data-hub-pending-overview-open]')) { event.preventDefault(); showPage('overview'); return; }
    if (target.closest?.('[data-hub-copy-code]')) { event.preventDefault(); copyCode(); return; }
    if (target.closest?.('[data-hub-check-status]')) { event.preventDefault(); refresh({showMessage:true}); return; }
    const langButton = target.closest?.('[data-lang]');
    if (langButton?.dataset.lang) {
      persistLanguage(langButton.dataset.lang);
      setTimeout(() => queueSync(true), 0);
      setTimeout(() => queueSync(true), 100);
    }
  }

  injectStyles();
  installBootProgress();
  window.addEventListener('click', handleWindowCapture, true);
  document.addEventListener('click', handleDocumentClick, true);
  window.addEventListener('hashchange', () => {
    if (!active) return;
    const route = location.hash.replace('#', '');
    if (route === 'pending') { ensurePendingPage(); showPage('pending'); }
    else $('#hubPendingHeaderStatus')?.classList.remove('active');
    queueSync(true);
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
      const wasPending = active;
      clearCache();
      clearPendingUi();
      if (wasPending && location.hash === '#pending') { location.hash = '#profile'; location.reload(); }
      return;
    }
    setTimeout(() => refresh(), 20);
  });
  new MutationObserver(() => queueSync(false)).observe(document.documentElement, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['hidden','class']});
  setTimeout(() => refresh(), 20);
  setInterval(() => refresh(), 10000);
})();
