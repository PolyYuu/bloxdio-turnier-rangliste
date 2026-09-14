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

  load('pending-hub-core.js?v=20260914', () => {
    installPendingPublicProfileAccess();
    load('admin-pending-reset.js?v=20260914');
  });
})();
