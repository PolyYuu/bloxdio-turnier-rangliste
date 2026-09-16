(() => {
  'use strict';

  if (!window.supabase?.createClient) return;

  const db = window.supabase.createClient(
    'https://nxzrgbpaxukgjyzwupjp.supabase.co',
    'sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND'
  );

  let sessionId = '';
  let timer = 0;
  let stopped = false;

  function getSessionId() {
    if (sessionId) return sessionId;
    try {
      sessionId = sessionStorage.getItem('hub_presence_session') || crypto.randomUUID();
      sessionStorage.setItem('hub_presence_session', sessionId);
    } catch (_) {
      sessionId = crypto.randomUUID();
    }
    return sessionId;
  }

  async function heartbeat() {
    if (stopped) return;
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session) return;
      await db.rpc('heartbeat_presence', {
        p_session_id: getSessionId(),
        p_page: 'play'
      });
    } catch (_) {}
  }

  async function clear() {
    if (!sessionId) return;
    try {
      await db.rpc('clear_presence', { p_session_id: sessionId });
    } catch (_) {}
  }

  function start() {
    clearInterval(timer);
    stopped = false;
    heartbeat();
    timer = window.setInterval(heartbeat, 25000);
  }

  function stop() {
    stopped = true;
    clearInterval(timer);
    timer = 0;
    clear();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) heartbeat();
  });
  window.addEventListener('focus', heartbeat);
  window.addEventListener('pagehide', stop, { once: true });

  start();
})();
