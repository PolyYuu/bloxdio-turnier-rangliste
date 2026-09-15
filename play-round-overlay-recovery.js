(() => {
  'use strict';

  const overlay = document.querySelector('#roundOverlay');
  const title = document.querySelector('#overlayTitle');
  const chip = document.querySelector('#overlayRoundChip');
  if (!overlay || !title || !chip || !window.supabase?.createClient) return;

  const db = window.supabase.createClient(
    'https://nxzrgbpaxukgjyzwupjp.supabase.co',
    'sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND',
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
  );

  let busy = false;
  let timer = 0;

  function seenKey(tournamentId, round) {
    return `hub_play_overlay_seen:${tournamentId}:${round}`;
  }

  function alreadySeen(tournamentId, round) {
    try { return sessionStorage.getItem(seenKey(tournamentId, round)) === '1'; }
    catch (_) { return false; }
  }

  async function recoverLatestOverlay() {
    if (busy || !overlay.hidden) return;
    if (!document.querySelector('#sidePanelContent .cup-row.is-mine')) return;

    busy = true;
    try {
      const cupRes = await db.from('tournaments')
        .select('id,status,current_round,created_at')
        .eq('status','live')
        .order('created_at',{ascending:false})
        .limit(1);
      if (cupRes.error) throw cupRes.error;

      const cup = cupRes.data?.[0];
      if (!cup) return;

      const roundRes = await db.from('rating_rounds')
        .select('round,finalized_at')
        .eq('tournament_id',cup.id)
        .not('finalized_at','is',null)
        .order('round',{ascending:false})
        .limit(1);
      if (roundRes.error) throw roundRes.error;

      const finalized = Number(roundRes.data?.[0]?.round || 0);
      const currentRound = Number(cup.current_round || 0);
      if (!finalized || currentRound !== finalized) return;
      if (alreadySeen(cup.id,finalized)) return;
      if (!overlay.hidden) return;

      title.textContent = `RUNDE ${finalized} BEENDET`;
      chip.textContent = `RUNDE ${finalized}`;
      overlay.hidden = false;
    } catch (error) {
      console.warn('[The HUB] Overlay recovery unavailable',error);
    } finally {
      busy = false;
    }
  }

  timer = window.setInterval(recoverLatestOverlay,1200);
  setTimeout(recoverLatestOverlay,650);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
