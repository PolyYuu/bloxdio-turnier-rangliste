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

  load('pending-hub-core.js?v=20260914', () => {
    load('admin-pending-reset.js?v=20260914');
  });
})();
