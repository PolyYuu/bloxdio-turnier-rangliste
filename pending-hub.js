(() => {
  'use strict';

  const load = (src, done) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    if (done) script.addEventListener('load', done, {once:true});
    script.addEventListener('error', () => console.error(`[The HUB] Failed to load ${src}`), {once:true});
    (document.head || document.documentElement).appendChild(script);
  };

  function injectPlayNavigationStyles() {
    if (document.getElementById('hubPlayNavigationStyles')) return;
    const style = document.createElement('style');
    style.id = 'hubPlayNavigationStyles';
    style.textContent = `
      .primary-nav [data-hub-play-link]{
        position:relative!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        border:1px solid rgba(246,201,76,.72)!important;
        border-radius:10px!important;
        padding-left:14px!important;
        padding-right:14px!important;
        background:#f6c94c!important;
        color:#160d26!important;
        box-shadow:0 7px 20px rgba(246,201,76,.15),inset 0 1px 0 rgba(255,255,255,.28)!important;
        font-weight:950!important;
        letter-spacing:.05em!important;
        transition:transform .16s ease,box-shadow .16s ease,opacity .16s ease,background .16s ease!important;
      }
      .primary-nav [data-hub-play-link]::before{content:'▶';font-size:.68em;line-height:1;transform:translateY(-.2px)}
      .primary-nav [data-hub-play-link]:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(246,201,76,.22),inset 0 1px 0 rgba(255,255,255,.3)!important}
      .primary-nav [data-hub-play-link][data-play-state="pending"]{
        background:rgba(255,255,255,.075)!important;
        border-color:rgba(255,255,255,.13)!important;
        color:rgba(255,255,255,.36)!important;
        box-shadow:none!important;
        cursor:not-allowed!important;
        filter:saturate(0)!important;
      }
      .primary-nav [data-hub-play-link][data-play-state="pending"]:hover{transform:none!important}
      .primary-nav [data-hub-play-link][data-play-state="logged-out"]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function positionPlayLink(nav, link) {
    const cup = nav.querySelector('[data-route="cup"]');
    if (cup && link.nextElementSibling !== cup) nav.insertBefore(link, cup);
  }

  function setPlayState(link, state) {
    if (!link) return;
    link.dataset.playState = state;
    if (state === 'verified') {
      link.href = 'play.html';
      link.removeAttribute('aria-disabled');
      link.removeAttribute('aria-hidden');
      link.removeAttribute('title');
      link.tabIndex = 0;
    } else if (state === 'pending') {
      link.removeAttribute('href');
      link.removeAttribute('aria-hidden');
      link.setAttribute('aria-disabled', 'true');
      link.title = 'Nach deiner Verifizierung verfügbar';
      link.tabIndex = 0;
    } else {
      link.removeAttribute('href');
      link.removeAttribute('aria-disabled');
      link.setAttribute('aria-hidden', 'true');
      link.tabIndex = -1;
    }
  }

  async function refreshPlayNavigationState(link) {
    const client = window.HubAPI?.client;
    if (!client || !link) return;
    try {
      const {data:{session}} = await client.auth.getSession();
      if (!session) {
        setPlayState(link, 'logged-out');
        return;
      }

      if (document.body.classList.contains('hub-pending-account')) {
        setPlayState(link, 'pending');
        return;
      }

      const {data, error} = await client.rpc('get_my_registration_status');
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        const status = String(row?.status || row?.state || '').toLowerCase();
        setPlayState(link, status === 'verified' ? 'verified' : 'pending');
        return;
      }

      const {data:globalPlayerId} = await client.rpc('my_global_player_id');
      setPlayState(link, globalPlayerId ? 'verified' : 'pending');
    } catch (_) {
      setPlayState(link, document.body.classList.contains('hub-pending-account') ? 'pending' : 'logged-out');
    }
  }

  function installPlayNavigation() {
    injectPlayNavigationStyles();
    const nav = document.querySelector('.primary-nav');
    if (!nav) return;

    let link = nav.querySelector('[data-hub-play-link]');
    if (!link) {
      const cup = nav.querySelector('[data-route="cup"]');
      const ranking = nav.querySelector('[data-route="ranking"]');
      const reference = cup || ranking || nav.querySelector('a,button');
      link = document.createElement('a');
      link.dataset.hubPlayLink = '1';
      link.dataset.playState = 'logged-out';
      link.textContent = 'PLAY';
      link.className = reference?.className || '';
      link.removeAttribute('data-route');
      link.setAttribute('aria-label', 'Play Bloxd.io');
      link.addEventListener('click', event => {
        if (link.dataset.playState !== 'verified') event.preventDefault();
      });
      nav.appendChild(link);
    }

    positionPlayLink(nav, link);
    refreshPlayNavigationState(link);
  }

  function installPendingPublicProfileAccess() {
    const pendingStyles = document.getElementById('hubPendingStableStyles');
    if (pendingStyles && pendingStyles.dataset.publicProfilesUnlocked !== '1') {
      pendingStyles.textContent = pendingStyles.textContent
        .replace(/body\.hub-pending-account \[data-page="profile"\]>\*:not\(#hubPendingProfileSurface\)\{display:none!important\}\s*/g, '')
        .replace(/body\.hub-pending-account #hubPendingProfileSurface\{display:grid!important\}\s*/g, '');
      pendingStyles.dataset.publicProfilesUnlocked = '1';
    }

    if (!document.getElementById('hubPendingPublicProfileAccess')) {
      const style = document.createElement('style');
      style.id = 'hubPendingPublicProfileAccess';
      style.textContent = `
        /* Pending users may inspect public profiles like logged-out visitors.
           Their own unverified profile remains unavailable. */
        body.hub-pending-account #hubPendingProfileSurface{display:none!important}
      `;
      document.head.appendChild(style);
    }

    window.addEventListener('click', event => {
      if (!document.body.classList.contains('hub-pending-account')) return;
      const target = event.target instanceof Element ? event.target : null;
      const ownProfileButton = target?.closest('[data-hub-account-profile],[data-hub-pending-profile-open]');
      if (!ownProfileButton) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      document.getElementById('v3AccountModal')?.remove();

      const pendingStatus = document.getElementById('hubPendingHeaderStatus');
      if (pendingStatus) {
        pendingStatus.click();
      } else if (location.hash !== '#pending') {
        location.hash = '#pending';
      }
    }, true);
  }

  installPlayNavigation();
  load('map-intros/admin-map-intros.js?v=20260916b');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPlayNavigation, {once:true});
  }

  let navMutationTimer = 0;
  new MutationObserver(() => {
    clearTimeout(navMutationTimer);
    navMutationTimer = setTimeout(installPlayNavigation, 80);
  }).observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});

  window.addEventListener('focus', installPlayNavigation);
  window.addEventListener('hub:registration-status-changed', installPlayNavigation);

  load('pending-hub-core.js?v=20260915b', () => {
    installPendingPublicProfileAccess();
    installPlayNavigation();
    load('profile-live-guard.js?v=20260920audit1', () => {
      load('admin-pending-reset.js?v=20260915');
    });
  });
})();
