(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const overlay = $('#roundOverlay');
  const overlayRanking = $('#overlayRanking');
  const closeButton = $('#closeOverlayButton');
  const bloxdFrame = $('#bloxdFrame');
  if (!overlay || !overlayRanking || !closeButton) return;

  const SUPABASE_URL = 'https://nxzrgbpaxukgjyzwupjp.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND';
  const monitorDb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY, {
    auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}
  });

  let pausedForOverlay = false;
  let previousFrameTabIndex = null;
  let liveTournamentId = '';
  let roundOneFallbackBusy = false;

  function currentOverlayRound() {
    const text = $('#overlayRoundChip')?.textContent || $('#overlayTitle')?.textContent || '';
    const match = text.match(/(?:RUNDE|ROUND|MANCHE)\s*(\d+)/i);
    return match ? Number(match[1]) : 0;
  }

  function seenKey(tournamentId, round) {
    return `hub_play_overlay_seen:${tournamentId}:${round}`;
  }

  function markOverlaySeen(round = currentOverlayRound()) {
    if (!round || !liveTournamentId) return;
    try { sessionStorage.setItem(seenKey(liveTournamentId, round), '1'); } catch (_) {}
  }

  function wasOverlaySeen(tournamentId, round) {
    try { return sessionStorage.getItem(seenKey(tournamentId, round)) === '1'; }
    catch (_) { return false; }
  }

  function installCupHeader() {
    if ($('#roundCupTableHead', overlayRanking)) return;
    const head = document.createElement('div');
    head.id = 'roundCupTableHead';
    head.className = 'round-cup-table-head';
    head.innerHTML = '<span>#</span><span>TEAM</span><span>PTS</span>';
    overlayRanking.prepend(head);
  }

  function upgradeOverlayRows() {
    installCupHeader();
    $$('.overlay-row', overlayRanking).forEach(row => {
      row.classList.add('round-cup-row');
      const place = $('.place', row);
      const team = $('.overlay-team', row);
      const move = $('.overlay-move', row);
      const points = $('.overlay-points', row);

      if (place) place.classList.add('round-cup-rank');
      if (team) team.classList.add('round-cup-team');
      if (points) points.classList.add('round-cup-points');
      if (move && team && move.parentElement !== team) team.appendChild(move);

      const rank = Number((place?.textContent || '').replace(/\D/g,''));
      row.classList.toggle('top', rank === 1);
    });
  }

  function pauseGameForOverlay() {
    if (pausedForOverlay) return;
    pausedForOverlay = true;
    document.body.classList.add('hub-round-overlay-open');

    try { document.exitPointerLock?.(); } catch (_) {}

    if (bloxdFrame) {
      previousFrameTabIndex = bloxdFrame.getAttribute('tabindex');
      bloxdFrame.setAttribute('tabindex','-1');
      bloxdFrame.setAttribute('aria-hidden','true');
      try { bloxdFrame.blur(); } catch (_) {}
    }

    try { window.focus(); } catch (_) {}
    requestAnimationFrame(() => {
      try { closeButton.focus({preventScroll:true}); }
      catch (_) { try { closeButton.focus(); } catch (_) {} }
    });
  }

  function resumeGameAfterOverlay() {
    if (!pausedForOverlay) return;
    pausedForOverlay = false;
    document.body.classList.remove('hub-round-overlay-open');

    if (bloxdFrame) {
      if (previousFrameTabIndex == null) bloxdFrame.removeAttribute('tabindex');
      else bloxdFrame.setAttribute('tabindex', previousFrameTabIndex);
      bloxdFrame.removeAttribute('aria-hidden');
      previousFrameTabIndex = null;
      setTimeout(() => {
        try { bloxdFrame.focus(); } catch (_) {}
      }, 0);
    }
  }

  function syncOverlayState() {
    if (!overlay.hidden) {
      upgradeOverlayRows();
      markOverlaySeen();
      pauseGameForOverlay();
    } else {
      resumeGameAfterOverlay();
    }
  }

  function sideRowsNearestMine() {
    const rows = $$('#sidePanelContent .cup-row[data-cup-team]');
    if (!rows.length) return [];
    const mine = rows.findIndex(row => row.classList.contains('is-mine'));
    if (mine < 0) return [];
    const size = Math.min(5, rows.length);
    const start = Math.max(0, Math.min(mine - 2, rows.length - size));
    return rows.slice(start,start+size);
  }

  function roundOneRowMarkup(sourceRow) {
    const rankText = $('.cup-place',sourceRow)?.textContent?.trim() || '#–';
    const rank = Number(rankText.replace(/\D/g,'')) || 0;
    const names = $$('.cup-player-name',sourceRow).map(el => el.textContent.trim()).filter(Boolean);
    const teamLabel = names.join(' + ') || 'TEAM';
    const points = Number($('.cup-points strong',sourceRow)?.textContent || 0) || 0;
    const mine = sourceRow.classList.contains('is-mine');
    return `<div class="overlay-row round-cup-row static-round-one ${mine ? 'is-mine' : ''} ${rank===1 ? 'top' : ''}" style="transform:none;opacity:1">
      <span class="place round-cup-rank">${rankText}</span>
      <div class="overlay-team round-cup-team"><strong>${teamLabel}</strong><small>${teamLabel}</small><span class="overlay-move same">• ${rankText}</span></div>
      <div class="overlay-points round-cup-points"><strong>${points} PTS</strong><small>+${points} DIESE RUNDE</small></div>
    </div>`;
  }

  function showRoundOneFallback() {
    const rows = sideRowsNearestMine();
    if (!rows.length || !overlay.hidden) return false;

    $('#overlayTitle').textContent = 'RUNDE 1 BEENDET';
    $('#overlayRoundChip').textContent = 'RUNDE 1';
    $('#overlaySubtitle').textContent = 'So hat sich der Cup nach dieser Runde verändert.';
    overlayRanking.innerHTML = rows.map(roundOneRowMarkup).join('');
    const ratingBlock = $('#myRatingBlock');
    if (ratingBlock) ratingBlock.hidden = true;
    overlay.hidden = false;
    upgradeOverlayRows();
    markOverlaySeen(1);
    window.dispatchEvent(new CustomEvent('hub:round-overlay-fallback',{detail:{round:1}}));
    return true;
  }

  async function checkRoundOneFallback() {
    if (!monitorDb || roundOneFallbackBusy) return;
    roundOneFallbackBusy = true;
    try {
      const cupResult = await monitorDb.from('tournaments')
        .select('id,status,created_at')
        .eq('status','live')
        .order('created_at',{ascending:false})
        .limit(1);
      const cup = cupResult.data?.[0];
      if (!cup) return;
      liveTournamentId = cup.id;
      if (wasOverlaySeen(cup.id,1)) return;

      const roundResult = await monitorDb.from('rating_rounds')
        .select('round,finalized_at')
        .eq('tournament_id',cup.id)
        .not('finalized_at','is',null)
        .order('round',{ascending:false})
        .limit(1);
      const finalized = Number(roundResult.data?.[0]?.round || 0);
      if (finalized < 1) return;
      if (finalized !== 1) return;
      if (!overlay.hidden) {
        markOverlaySeen(currentOverlayRound() || 1);
        return;
      }

      // Give the built-in realtime handler enough time to show its own overlay first.
      await new Promise(resolve => setTimeout(resolve,900));
      if (!overlay.hidden || wasOverlaySeen(cup.id,1)) return;
      showRoundOneFallback();
    } catch (error) {
      console.warn('[The HUB] Round-one overlay fallback unavailable',error);
    } finally {
      roundOneFallbackBusy = false;
    }
  }

  // Keep game input away from the cross-origin Bloxd iframe while the result overlay is open.
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeButton.click();
      return;
    }
    if (event.key === 'Tab' || event.key === 'Shift' || event.key === 'Enter' || event.key === ' ') return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const overlayObserver = new MutationObserver(() => {
    syncOverlayState();
    if (!overlay.hidden) {
      setTimeout(upgradeOverlayRows,0);
      setTimeout(upgradeOverlayRows,120);
    }
  });
  overlayObserver.observe(overlay,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});

  const rankingObserver = new MutationObserver(() => {
    if (!overlay.hidden) {
      setTimeout(upgradeOverlayRows,0);
      setTimeout(upgradeOverlayRows,120);
    }
  });
  rankingObserver.observe(overlayRanking,{childList:true,subtree:true});

  // If the normal code already shows round 1 while PLAY is open, this observer simply marks it seen.
  // If PLAY is opened after round 1 was finalized, the fallback displays it once for that session.
  setInterval(checkRoundOneFallback,1400);
  setTimeout(checkRoundOneFallback,700);
  syncOverlayState();
})();
