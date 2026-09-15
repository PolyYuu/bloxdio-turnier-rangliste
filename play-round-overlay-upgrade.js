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

  const START_HOLD_MS = 750;
  const MOVE_MS = 3750;
  const WINDOW_SIZE = 7;
  const POINTS = {kill:1, deathmatch:3, win:2};

  let pausedForOverlay = false;
  let previousFrameTabIndex = null;
  let liveTournamentId = '';
  let roundOneFallbackBusy = false;
  let renderToken = 0;
  let fallbackTimer = 0;

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

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    })[char]);
  }

  function ownTeamIdFromPage() {
    return $('#sidePanelContent .cup-row.is-mine')?.dataset?.cupTeam || '';
  }

  function teamMembers(teamId, players) {
    return players.filter(player => String(player.team_id) === String(teamId));
  }

  function teamLabel(teamId, players) {
    const names = teamMembers(teamId,players).map(player => player.name).filter(Boolean);
    return names.length ? names.join(' + ') : 'TEAM';
  }

  function pointsThrough(teamId, round, players, events) {
    const playerIds = new Set(teamMembers(teamId,players).map(player => String(player.id)));
    return events.reduce((total,event) => {
      if (!playerIds.has(String(event.player_id)) || Number(event.round) > Number(round)) return total;
      return total + (POINTS[event.type] || 0);
    },0);
  }

  function standingsFor(round, teams, players, events) {
    const ordered = teams.map(team => ({
      team,
      members:teamMembers(team.id,players),
      label:teamLabel(team.id,players),
      points:pointsThrough(team.id,round,players,events)
    })).sort((a,b) => b.points-a.points || a.label.localeCompare(b.label,'de'));

    let previousPoints = null;
    let rank = 0;
    return ordered.map((row,index) => {
      if (index === 0 || row.points !== previousPoints) rank = index + 1;
      previousPoints = row.points;
      return {...row,rank,index};
    });
  }

  async function loadRoundSnapshot(round) {
    if (!monitorDb) throw new Error('Live-Datenbank ist nicht verfügbar.');

    const cupResult = await monitorDb.from('tournaments')
      .select('id,name,status,current_round,created_at')
      .eq('status','live')
      .order('created_at',{ascending:false})
      .limit(1);
    if (cupResult.error) throw cupResult.error;
    const cup = cupResult.data?.[0];
    if (!cup) throw new Error('Kein Live-Cup gefunden.');
    liveTournamentId = cup.id;

    const [teamsResult,playersResult] = await Promise.all([
      monitorDb.from('teams').select('id,name,created_at').eq('tournament_id',cup.id).order('created_at'),
      monitorDb.from('players').select('id,team_id,name,global_player_id,created_at').eq('tournament_id',cup.id).order('created_at')
    ]);
    if (teamsResult.error) throw teamsResult.error;
    if (playersResult.error) throw playersResult.error;

    const teams = teamsResult.data || [];
    const players = playersResult.data || [];
    let events = [];
    if (players.length) {
      const eventResult = await monitorDb.from('events')
        .select('player_id,round,type,created_at')
        .in('player_id',players.map(player => player.id))
        .lte('round',round)
        .order('created_at');
      if (eventResult.error) throw eventResult.error;
      events = eventResult.data || [];
    }

    return {
      cup,
      teams,
      players,
      events,
      before:standingsFor(Math.max(0,round-1),teams,players,events),
      after:standingsFor(round,teams,players,events)
    };
  }

  function focusWindow(after, before, ownTeamId) {
    if (!after.length) return {before:[],after:[]};
    const ownIndex = after.findIndex(row => String(row.team.id) === String(ownTeamId));
    const size = Math.min(WINDOW_SIZE,after.length);
    const safeIndex = ownIndex >= 0 ? ownIndex : 0;
    const start = Math.max(0,Math.min(safeIndex-3,after.length-size));
    const afterRows = after.slice(start,start+size);
    const ids = new Set(afterRows.map(row => String(row.team.id)));
    const beforeRows = before.filter(row => ids.has(String(row.team.id)));
    return {before:beforeRows,after:afterRows};
  }

  function avatarSrcFromSide(playerName) {
    const wanted = String(playerName || '').trim().toLowerCase();
    for (const chip of $$('#sidePanelContent .cup-player')) {
      const label = $('.cup-player-name',chip)?.textContent?.trim().toLowerCase();
      if (label !== wanted) continue;
      return $('img.pixel-avatar',chip)?.src || '';
    }
    return '';
  }

  function playerMarkup(player) {
    const src = avatarSrcFromSide(player.name);
    const avatar = src
      ? `<img class="round-cup-avatar" src="${esc(src)}" alt="${esc(player.name)}">`
      : `<span class="round-cup-avatar round-cup-avatar-fallback">${esc(String(player.name || '?').charAt(0).toUpperCase())}</span>`;
    return `<span class="round-cup-player">${avatar}<strong>${esc(player.name)}</strong></span>`;
  }

  function movementInfo(teamId, beforeMap, finalRank, round) {
    if (round <= 1) return {text:'',className:'same'};
    const previous = beforeMap.get(String(teamId));
    if (!previous) return {text:'',className:'same'};
    if (previous.rank > finalRank) return {text:`${previous.rank} → ${finalRank}`,className:'up'};
    if (previous.rank < finalRank) return {text:`${previous.rank} → ${finalRank}`,className:'down'};
    return {text:`${previous.rank} → ${finalRank}`,className:'same'};
  }

  function rowMarkup(row, ownTeamId, phase, beforeMap, round) {
    const mine = String(row.team.id) === String(ownTeamId);
    const duo = row.members.map((player,index) => `${index ? '<span class="round-cup-plus">+</span>' : ''}${playerMarkup(player)}`).join('');
    const move = movementInfo(row.team.id,beforeMap,row.rank,round);
    const showMove = phase === 'after' && move.text;
    return `<div class="round-cup-row hub-managed-round-row ${mine ? 'is-mine' : ''} ${row.rank===1 ? 'top' : ''}" data-team-id="${esc(row.team.id)}" data-phase="${phase}">
      <span class="round-cup-rank">#${row.rank}</span>
      <div class="round-cup-team"><div class="round-cup-players">${duo || `<strong>${esc(row.label)}</strong>`}</div></div>
      <div class="round-cup-points">
        <span class="round-cup-change ${move.className} ${showMove ? 'visible' : ''}">${esc(move.text)}</span>
        <span class="round-cup-score"><strong>${row.points}</strong><span>PTS</span></span>
      </div>
    </div>`;
  }

  function buildBoard(rows, ownTeamId, phase, beforeMap, round) {
    overlayRanking.innerHTML = '<div id="roundCupTableHead" class="round-cup-table-head"><span>#</span><span>TEAM</span><span>PTS</span></div>' +
      `<div class="hub-managed-round-board">${rows.map(row => rowMarkup(row,ownTeamId,phase,beforeMap,round)).join('')}</div>`;
  }

  function updateRowToFinal(rowElement, finalRow, beforeMap, round) {
    const rank = $('.round-cup-rank',rowElement);
    const points = $('.round-cup-score strong',rowElement);
    const change = $('.round-cup-change',rowElement);
    if (rank) rank.textContent = `#${finalRow.rank}`;
    if (points) points.textContent = String(finalRow.points);
    if (change) {
      const move = movementInfo(finalRow.team.id,beforeMap,finalRow.rank,round);
      change.textContent = move.text;
      change.classList.remove('up','down','same','visible');
      change.classList.add(move.className);
      if (move.text) change.classList.add('visible');
    }
    rowElement.classList.toggle('top',finalRow.rank===1);
    rowElement.dataset.phase = 'after';
  }

  async function animateBoardFromPrevious(snapshot, round, token) {
    const ownTeamId = ownTeamIdFromPage();
    const windowRows = focusWindow(snapshot.after,snapshot.before,ownTeamId);
    const before = windowRows.before;
    const after = windowRows.after;
    const beforeMap = new Map(snapshot.before.map(row => [String(row.team.id),row]));

    if (round <= 1) {
      buildBoard(after,ownTeamId,'after',beforeMap,round);
      overlay.classList.remove('hub-managed-preparing');
      overlay.classList.add('hub-managed-ready');
      return;
    }

    buildBoard(before,ownTeamId,'before',beforeMap,round);
    overlay.classList.remove('hub-managed-preparing');
    overlay.classList.add('hub-managed-ready');

    await new Promise(resolve => setTimeout(resolve,START_HOLD_MS));
    if (token !== renderToken || overlay.hidden) return;

    const board = $('.hub-managed-round-board',overlayRanking);
    if (!board) return;

    const firstRects = new Map();
    $$('.hub-managed-round-row',board).forEach(row => firstRects.set(row.dataset.teamId,row.getBoundingClientRect()));

    for (const finalRow of after) {
      const element = $(`.hub-managed-round-row[data-team-id="${CSS.escape(String(finalRow.team.id))}"]`,board);
      if (!element) continue;
      updateRowToFinal(element,finalRow,beforeMap,round);
      board.appendChild(element);
    }

    const lastRects = new Map();
    $$('.hub-managed-round-row',board).forEach(row => {
      lastRects.set(row.dataset.teamId,row.getBoundingClientRect());
      row.classList.remove('is-animating');
    });

    $$('.hub-managed-round-row',board).forEach(row => {
      const first = firstRects.get(row.dataset.teamId);
      const last = lastRects.get(row.dataset.teamId);
      if (!first || !last) return;
      row.style.transform = `translateY(${first.top-last.top}px)`;
    });

    void board.offsetHeight;
    requestAnimationFrame(() => {
      if (token !== renderToken || overlay.hidden) return;
      $$('.hub-managed-round-row',board).forEach(row => {
        row.classList.add('is-animating');
        row.style.transform = 'translateY(0)';
      });
    });

    setTimeout(() => {
      if (token !== renderToken) return;
      $$('.hub-managed-round-row',board).forEach(row => {
        row.classList.remove('is-animating');
        row.style.removeProperty('transform');
      });
    },MOVE_MS+100);
  }

  async function renderManagedRound(round) {
    if (!round || overlay.hidden) return;
    const token = ++renderToken;
    overlay.classList.add('hub-managed-preparing');
    overlay.classList.remove('hub-managed-ready');

    try {
      const snapshot = await loadRoundSnapshot(round);
      if (token !== renderToken || overlay.hidden) return;
      markOverlaySeen(round);
      await animateBoardFromPrevious(snapshot,round,token);
    } catch (error) {
      console.warn('[The HUB] Managed round overlay failed',error);
      overlay.classList.remove('hub-managed-preparing');
      overlay.classList.add('hub-managed-ready');
    }
  }

  function notifyBloxd(type) {
    try {
      bloxdFrame?.contentWindow?.postMessage?.({source:'SG_WEBSITE',type},'https://bloxd.io');
    } catch (_) {}
  }

  function forceOverlayFocus() {
    try { window.focus(); } catch (_) {}
    try { document.exitPointerLock?.(); } catch (_) {}
    try { overlay.focus({preventScroll:true}); } catch (_) {}
    try { closeButton.focus({preventScroll:true}); }
    catch (_) { try { closeButton.focus(); } catch (_) {} }
  }

  function pauseGameForOverlay() {
    if (pausedForOverlay) return;
    pausedForOverlay = true;
    document.body.classList.add('hub-round-overlay-open');
    overlay.tabIndex = -1;

    // This is the mechanism that made the old index test work: ask the code
    // running inside the Bloxd iframe to release its own pointer lock.
    notifyBloxd('OVERLAY_OPEN');

    if (bloxdFrame) {
      previousFrameTabIndex = bloxdFrame.getAttribute('tabindex');
      bloxdFrame.setAttribute('tabindex','-1');
      bloxdFrame.setAttribute('aria-hidden','true');
      bloxdFrame.style.pointerEvents = 'none';
      try { bloxdFrame.blur(); } catch (_) {}
    }

    forceOverlayFocus();
    [20,60,120,240,480,900].forEach(delay => setTimeout(() => {
      if (!overlay.hidden) {
        notifyBloxd('OVERLAY_OPEN');
        forceOverlayFocus();
      }
    },delay));
  }

  function resumeGameAfterOverlay() {
    if (!pausedForOverlay) return;
    pausedForOverlay = false;
    document.body.classList.remove('hub-round-overlay-open');
    ++renderToken;

    notifyBloxd('OVERLAY_CLOSE');

    if (bloxdFrame) {
      if (previousFrameTabIndex == null) bloxdFrame.removeAttribute('tabindex');
      else bloxdFrame.setAttribute('tabindex',previousFrameTabIndex);
      bloxdFrame.removeAttribute('aria-hidden');
      bloxdFrame.style.removeProperty('pointer-events');
      previousFrameTabIndex = null;
    }
    setTimeout(() => {
      try { bloxdFrame?.focus(); } catch (_) {}
    },0);
  }

  function syncOverlayState() {
    if (!overlay.hidden) {
      pauseGameForOverlay();
      const round = currentOverlayRound();
      if (round) renderManagedRound(round);
    } else {
      resumeGameAfterOverlay();
      overlay.classList.remove('hub-managed-preparing','hub-managed-ready');
    }
  }

  async function showRoundOneFallback() {
    if (!overlay.hidden) return false;
    $('#overlayTitle').textContent = 'RUNDE 1 BEENDET';
    $('#overlayRoundChip').textContent = 'RUNDE 1';
    $('#overlaySubtitle').textContent = 'So hat sich der Cup nach dieser Runde verändert.';
    const ratingBlock = $('#myRatingBlock');
    if (ratingBlock) ratingBlock.hidden = true;
    overlay.hidden = false;
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
      if (finalized !== 1) return;

      if (!overlay.hidden) {
        markOverlaySeen(currentOverlayRound() || 1);
        return;
      }

      await new Promise(resolve => setTimeout(resolve,900));
      if (!overlay.hidden || wasOverlaySeen(cup.id,1)) return;
      await showRoundOneFallback();
    } catch (error) {
      console.warn('[The HUB] Round-one overlay fallback unavailable',error);
    } finally {
      roundOneFallbackBusy = false;
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== bloxdFrame?.contentWindow || !event.data) return;
    if (event.data.source === 'HUB_VERIFY' && event.data.type === 'OVERLAY_POINTER_RELEASED') {
      forceOverlayFocus();
    }
  });

  document.addEventListener('focusin', event => {
    if (overlay.hidden) return;
    if (event.target === bloxdFrame || !overlay.contains(event.target)) {
      event.preventDefault?.();
      setTimeout(forceOverlayFocus,0);
    }
  },true);

  document.addEventListener('pointerdown', event => {
    if (overlay.hidden) return;
    if (!overlay.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      forceOverlayFocus();
    }
  },true);

  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeButton.click();
      return;
    }
    if (['Tab','Shift','Enter',' '].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);

  closeButton.addEventListener('pointerdown', event => {
    if (overlay.hidden) return;
    event.stopPropagation();
  },true);

  const overlayObserver = new MutationObserver(mutations => {
    if (!mutations.some(mutation => mutation.type === 'attributes' && mutation.attributeName === 'hidden')) return;
    syncOverlayState();
  });
  overlayObserver.observe(overlay,{attributes:true,attributeFilter:['hidden']});

  fallbackTimer = window.setInterval(checkRoundOneFallback,1400);
  setTimeout(checkRoundOneFallback,700);
  window.addEventListener('pagehide',() => clearInterval(fallbackTimer),{once:true});
  syncOverlayState();
})();
