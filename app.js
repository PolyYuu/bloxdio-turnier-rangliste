(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const TEAM_COLOR_DEFS = [
    ["Lime Green", "#7CFC00"], ["Cyan", "#00DCEB"], ["Dark Blue", "#1E3A8A"],
    ["Pink", "#EC4899"], ["Dark Green", "#166534"], ["White", "#F8FAFC"],
    ["Brown", "#8B5E3C"], ["Orange", "#F97316"], ["Yellow", "#FACC15"],
    ["Purple", "#7E22CE"], ["Magenta", "#D946EF"], ["Baby Blue", "#7DD3FC"]
  ].map(([label, hex]) => ({ label, hex }));
  const COLOR_BY_NAME = new Map(TEAM_COLOR_DEFS.map((color) => [color.label.toLowerCase(), color]));
  const EVENT_CONFIG = { kill: { label: "Kill", points: 1 }, deathmatch: { label: "Deathmatch", points: 3 }, win: { label: "Sieg", points: 2 } };
  const MODE_LABELS = { 1: "Solo", 2: "Duo", 3: "Trio", 4: "Squad" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const db = typeof window !== "undefined" ? window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  let state = { tournaments: [], activeTournamentId: null, updatedAt: null };
  let rankingView = "team";
  let selectedMode = 0;
  let activeHistoryPlayerId = null;
  let isAdmin = false;
  let loading = true;
  let realtimeTimer = 0;
  let writeBusy = false;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const getTournament = () => state.tournaments.find((item) => item.id === state.activeTournamentId) || state.tournaments[0] || null;
  const allPlayers = (tournament) => tournament ? tournament.teams.flatMap((team) => team.players.map((player) => ({ player, team }))) : [];
  const statsThrough = (player, round = Infinity) => player.events.filter((event) => event.round <= round).reduce((stats, event) => {
    if (event.type === "kill") stats.kills += 1;
    if (event.type === "deathmatch") stats.deathmatches += 1;
    if (event.type === "win") stats.wins += 1;
    stats.points += EVENT_CONFIG[event.type]?.points || 0;
    return stats;
  }, { kills: 0, deathmatches: 0, wins: 0, points: 0 });
  const teamPoints = (team, round = Infinity) => team.players.reduce((sum, player) => sum + statsThrough(player, round).points, 0);
  const teamLabel = (team) => team.players.map((player) => player.name).join(" + ") || team.name;

  function friendlyError(error, fallback = "Die Aktion konnte nicht ausgeführt werden.") {
    console.error(error);
    if (/duplicate|unique/i.test(error?.message || "")) return "Dieser Name ist bereits vergeben.";
    if (/limit|maximum|deathmatch|win/i.test(error?.message || "")) return "Das Rundenlimit für Deathmatch oder Sieg wurde erreicht.";
    return fallback;
  }

  async function loadData({ quiet = false } = {}) {
    if (!db) { loading = false; showPublicFailure("Supabase konnte nicht geladen werden. Bitte die Verbindung prüfen."); return; }
    if (!quiet) { loading = true; renderPublic(); }
    const [tournamentsResult, teamsResult, playersResult, eventsResult] = await Promise.all([
      db.from("tournaments").select("*").order("created_at"),
      db.from("teams").select("*").order("created_at"),
      db.from("players").select("*").order("created_at"),
      db.from("events").select("*").order("created_at")
    ]);
    const error = [tournamentsResult, teamsResult, playersResult, eventsResult].find((result) => result.error)?.error;
    if (error) { loading = false; showPublicFailure("Die Live-Daten sind gerade nicht erreichbar. Bitte später erneut versuchen."); console.error(error); return; }
    const oldActive = state.activeTournamentId;
    const eventsByPlayer = new Map();
    for (const event of eventsResult.data) {
      const mapped = { id: event.id, round: event.round, type: event.type, points: event.points, createdAt: event.created_at };
      eventsByPlayer.set(event.player_id, [...(eventsByPlayer.get(event.player_id) || []), mapped]);
    }
    const playersByTeam = new Map();
    for (const player of playersResult.data) {
      const mapped = { id: player.id, name: player.name, events: eventsByPlayer.get(player.id) || [] };
      playersByTeam.set(player.team_id, [...(playersByTeam.get(player.team_id) || []), mapped]);
    }
    const teamsByTournament = new Map();
    for (const team of teamsResult.data) {
      const mapped = { id: team.id, name: team.name, color: team.color, players: playersByTeam.get(team.id) || [] };
      teamsByTournament.set(team.tournament_id, [...(teamsByTournament.get(team.tournament_id) || []), mapped]);
    }
    const tournaments = tournamentsResult.data.map((item) => ({
      id: item.id, name: item.name, mode: item.mode, currentRound: item.current_round,
      editingRound: item.editing_round, createdAt: item.created_at, updatedAt: item.updated_at,
      teams: teamsByTournament.get(item.id) || []
    }));
    state = { tournaments, activeTournamentId: tournaments.some((item) => item.id === oldActive) ? oldActive : tournaments[0]?.id || null, updatedAt: new Date().toISOString() };
    loading = false;
    if (getTournament()?.mode === 1) rankingView = "individual";
    renderAll();
  }

  function subscribeRealtime() {
    if (!db) return;
    const reload = () => { clearTimeout(realtimeTimer); realtimeTimer = setTimeout(() => loadData({ quiet: true }), 300); };
    const channel = db.channel("ranking-live");
    ["tournaments", "teams", "players", "events"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, reload));
    channel.subscribe();
  }

  function setActiveTournament(id) {
    if (!state.tournaments.some((item) => item.id === id)) return;
    state.activeTournamentId = id;
    rankingView = getTournament().mode === 1 ? "individual" : "team";
    renderAll();
  }

  function rankMaps(tournament, round, individual) {
    const entries = individual ? allPlayers(tournament) : tournament.teams;
    const sorted = entries.slice().sort((a, b) => {
      const ap = individual ? statsThrough(a.player, round).points : teamPoints(a, round);
      const bp = individual ? statsThrough(b.player, round).points : teamPoints(b, round);
      const an = individual ? a.player.name : teamLabel(a);
      const bn = individual ? b.player.name : teamLabel(b);
      return bp - ap || an.localeCompare(bn, "de");
    });
    return new Map(sorted.map((entry, index) => [individual ? entry.player.id : entry.id, index + 1]));
  }

  function movement(current, previous, round) {
    if (round <= 1) return '<span class="rank-movement empty"></span>';
    if (current < previous) return '<span class="rank-movement up" aria-label="Aufgestiegen">▲</span>';
    if (current > previous) return '<span class="rank-movement down" aria-label="Abgestiegen">▼</span>';
    return '<span class="rank-movement same" aria-label="Unverändert">•</span>';
  }

  function renderAll() { renderSelects(); renderPublic(); if (isAdmin) renderAdmin(); }
  function renderSelects() {
    const options = state.tournaments.map((t) => `<option value="${t.id}" ${t.id === state.activeTournamentId ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("");
    $("#publicTournamentSelect").innerHTML = options;
    $("#adminTournamentSelect").innerHTML = options;
  }

  function showPublicFailure(message) {
    $("#publicRankingRows").innerHTML = `<div class="empty-state standings-empty"><h3>Verbindung fehlgeschlagen</h3><p>${escapeHtml(message)}</p></div>`;
    $("#publicEmpty").hidden = true;
  }

  function renderPublic() {
    if (loading) { $("#publicRankingRows").innerHTML = '<div class="empty-state standings-empty"><h3>Live-Daten werden geladen …</h3></div>'; return; }
    const tournament = getTournament();
    if (!tournament) {
      $("#publicTournamentTitle").textContent = "Bloxdio Turnier 22.08.";
      $("#publicRankingRows").innerHTML = ""; $("#publicEmpty").hidden = false; $("#publicRankingHead").hidden = true; return;
    }
    $("#publicTournamentTitle").textContent = tournament.name;
    $("#publicModeBadge").textContent = MODE_LABELS[tournament.mode];
    $("#publicRoundBadge").textContent = tournament.currentRound;
    $("#publicUpdatedAt").textContent = tournament.updatedAt ? `Aktualisiert ${new Date(tournament.updatedAt).toLocaleString("de-DE")}` : "Live";
    $$("[data-ranking-view]").forEach((button) => button.classList.toggle("active", button.dataset.rankingView === rankingView));
    $$("[data-ranking-view='team']").forEach((button) => { button.disabled = tournament.mode === 1; });
    const individual = rankingView === "individual" || tournament.mode === 1;
    const currentRanks = rankMaps(tournament, tournament.currentRound, individual);
    const previousRanks = rankMaps(tournament, Math.max(1, tournament.currentRound - 1), individual);
    const entries = (individual ? allPlayers(tournament) : tournament.teams).slice().sort((a, b) => currentRanks.get(individual ? a.player.id : a.id) - currentRanks.get(individual ? b.player.id : b.id));
    $("#publicRankingHead").hidden = entries.length === 0;
    $("#publicRankingHead").innerHTML = '<span>PLATZ</span><span>SPIELER</span><span>PTS</span>';
    $("#publicRankingRows").innerHTML = entries.map((entry) => {
      const id = individual ? entry.player.id : entry.id;
      const points = individual ? statsThrough(entry.player).points : teamPoints(entry);
      const players = individual ? [entry.player] : entry.players;
      const boxes = players.map((player) => `<span class="ranking-player-box">${escapeHtml(player.name)}</span>`).join('<span class="ranking-player-plus">+</span>');
      return `<button class="ranking-row ranking-entry" data-team-id="${individual ? entry.team.id : entry.id}" data-player-id="${individual ? entry.player.id : ""}" type="button"><span class="ranking-place">${currentRanks.get(id)}${movement(currentRanks.get(id), previousRanks.get(id), tournament.currentRound)}</span><span class="ranking-player-stack">${boxes}</span><strong class="ranking-points">${points}<small>PTS</small></strong></button>`;
    }).join("");
    $("#publicEmpty").hidden = entries.length > 0;
  }

  function renderAdmin() {
    const tournament = getTournament();
    if (!tournament) {
      $("#adminMode").textContent = "–"; $("#adminGroups").innerHTML = ""; $("#adminEmpty").hidden = false; return;
    }
    $("#adminMode").textContent = MODE_LABELS[tournament.mode];
    $("#adminModeDescription").textContent = `${tournament.mode} Spieler pro Team`;
    $("#adminCurrentRound").textContent = tournament.currentRound;
    $("#adminEditingRound").textContent = `Runde ${tournament.editingRound}`;
    $("#adminHeadRound").textContent = tournament.editingRound;
    $("#adminParticipants").textContent = allPlayers(tournament).length;
    $("#adminTeamsSummary").textContent = `${tournament.teams.length} ${tournament.mode === 1 ? "Teilnehmer" : "Teams"}`;
    $("#adminRoundTabs").innerHTML = Array.from({ length: tournament.currentRound }, (_, index) => `<button type="button" class="round-tab ${index + 1 === tournament.editingRound ? "active" : ""}" data-round="${index + 1}">R ${index + 1}<span data-delete-round="${index + 1}" title="Runde löschen">×</span></button>`).join("");
    const filter = $("#adminSearch").value.trim().toLowerCase();
    let count = 0;
    $("#adminGroups").innerHTML = tournament.teams.map((team) => {
      const rows = team.players.filter((player) => !filter || player.name.toLowerCase().includes(filter) || team.name.toLowerCase().includes(filter)).map((player) => {
        count += 1; const total = statsThrough(player); const round = statsThrough({ events: player.events.filter((event) => event.round === tournament.editingRound) });
        return `<article class="admin-player-row" data-player-id="${player.id}" data-team-id="${team.id}"><div><strong>${escapeHtml(player.name)}</strong><small>K ${total.kills} · DM ${total.deathmatches} · S ${total.wins}</small></div><span><i class="team-color-dot" style="background:${escapeHtml(team.color)}"></i>${escapeHtml(team.name)}</span><strong>${total.points} PTS</strong><span>K ${round.kills} · DM ${round.deathmatches} · S ${round.wins}</span><div class="admin-row-actions"><button data-event-type="kill" type="button">Kill +1</button><button data-event-type="deathmatch" type="button">DM +3</button><button data-event-type="win" type="button">Sieg +2</button><button data-history type="button">History</button><button data-delete-player type="button">×</button></div></article>`;
      }).join("");
      return rows ? `<section class="admin-team-group"><header><i style="background:${escapeHtml(team.color)}"></i>${escapeHtml(team.name)}<button data-delete-team="${team.id}" type="button">Team löschen</button></header>${rows}</section>` : "";
    }).join("");
    $("#adminResultCount").textContent = `${count} Spieler`;
    $("#adminEmpty").hidden = tournament.teams.length > 0;
  }

  function renderDetail(teamId, playerId = "") {
    const tournament = getTournament(); const team = tournament?.teams.find((item) => item.id === teamId); if (!team) return;
    const players = playerId ? team.players.filter((player) => player.id === playerId) : team.players;
    $("#detailModalTitle").textContent = players.map((player) => player.name).join(" + ");
    $("#detailPlayerNames").textContent = `${MODE_LABELS[players.length] || "Einzel"} · ${players.length} Spieler`;
    $("#detailTotalPoints").textContent = players.reduce((sum, player) => sum + statsThrough(player).points, 0);
    $("#detailRoundNumber").textContent = tournament.currentRound;
    $("#detailPlayersGrid").innerHTML = players.map((player, index) => {
      const stats = statsThrough(player);
      const history = Array.from({ length: tournament.currentRound }, (_, r) => { const s = statsThrough({ events: player.events.filter((e) => e.round === r + 1) }); return `<li><b>Runde ${r + 1}</b><span>K ${s.kills} · DM ${s.deathmatches} · S ${s.wins} · ${s.points} PTS</span></li>`; }).join("");
      return `${index ? '<span class="detail-player-plus">+</span>' : ""}<article class="detail-player-card"><h3>${escapeHtml(player.name)}</h3><strong>${stats.points} PTS</strong><div class="profile-stats"><span>KILLS <b>${stats.kills}</b></span><span>DM <b>${stats.deathmatches}</b></span><span>SIEGE <b>${stats.wins}</b></span></div><ul class="match-history">${history}</ul></article>`;
    }).join("");
    openModal("detailModal");
  }

  async function checkAdminSession(message = "") {
    $("#adminAuthLoading").hidden = false; $("#adminLoginForm").hidden = true; $("#adminContent").hidden = true;
    if (!db) { showLogin("Die Verbindung zum Login-Dienst konnte nicht hergestellt werden."); return; }
    const { data: { session }, error } = await db.auth.getSession();
    if (error || !session) { isAdmin = false; showLogin(message); return; }
    const result = await db.rpc("is_admin");
    if (result.error || result.data !== true) { await db.auth.signOut(); isAdmin = false; showLogin("Kein Admin-Zugriff"); return; }
    isAdmin = true; $("#adminAuthLoading").hidden = true; $("#adminLoginForm").hidden = true; $("#adminContent").hidden = false; renderAdmin();
  }
  function showLogin(message = "") { $("#adminAuthLoading").hidden = true; $("#adminLoginForm").hidden = false; $("#adminContent").hidden = true; $("#adminLoginError").textContent = message; }
  async function login(event) {
    event.preventDefault(); if (!db) return showLogin("Die Verbindung zum Login-Dienst konnte nicht hergestellt werden."); const button = event.submitter; button.disabled = true; $("#adminLoginError").textContent = "";
    const result = await db.auth.signInWithPassword({ email: $("#adminEmail").value.trim(), password: $("#adminPassword").value });
    button.disabled = false; if (result.error) { showLogin("Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen."); return; } await checkAdminSession();
  }
  async function logout() { await db.auth.signOut(); isAdmin = false; showLogin("Erfolgreich abgemeldet."); }

  function route() {
    const admin = location.hash === "#admin";
    $("#rankingView").hidden = admin; $("#adminView").hidden = !admin; $("#addButton").hidden = !admin || !isAdmin;
    if (admin) checkAdminSession();
  }

  async function performWrite(action, success, button = null) {
    if (writeBusy) return false; writeBusy = true; if (button) button.disabled = true;
    try { const result = await action(); if (result?.error) throw result.error; await loadData({ quiet: true }); if (success) showToast(success); return true; }
    catch (error) { showToast(friendlyError(error), "error"); return false; }
    finally { writeBusy = false; if (button) button.disabled = false; }
  }

  async function createTournament(event) {
    event.preventDefault(); const name = $("#tournamentNameInput").value.trim(); if (!name || !selectedMode) return;
    if (await performWrite(() => db.from("tournaments").insert({ name, mode: selectedMode, current_round: 1, editing_round: 1 }).select().single(), "Turnier erstellt.", event.submitter)) closeModal("tournamentModal");
  }

  async function createParticipant(event) {
    event.preventDefault(); const tournament = getTournament(); if (!tournament) return;
    const names = $$(".player-name-input").map((input) => input.value.trim());
    if (names.length !== tournament.mode || names.some((name) => !name)) return showToast("Bitte alle Spielernamen ausfüllen.", "error");
    const existing = allPlayers(tournament).map(({ player }) => player.name.toLowerCase());
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length || names.some((name) => existing.includes(name.toLowerCase()))) return showToast("Spielernamen müssen eindeutig sein.", "error");
    const color = tournament.mode === 1 ? { label: names[0], hex: "" } : COLOR_BY_NAME.get($("#teamNameInput").value.toLowerCase());
    if (tournament.teams.some((team) => team.name.toLowerCase() === color.label.toLowerCase())) return showToast("Dieses Team existiert bereits.", "error");
    const ok = await performWrite(async () => {
      const teamResult = await db.from("teams").insert({ tournament_id: tournament.id, name: color.label, color: color.hex }).select().single(); if (teamResult.error) return teamResult;
      return db.from("players").insert(names.map((name) => ({ tournament_id: tournament.id, team_id: teamResult.data.id, name })));
    }, "Teilnehmer angelegt.", event.submitter);
    if (ok) closeModal("participantModal");
  }

  async function addEvent(playerId, type, button) {
    const tournament = getTournament(); await performWrite(() => db.from("events").insert({ player_id: playerId, round: tournament.editingRound, type, points: EVENT_CONFIG[type].points }), `${EVENT_CONFIG[type].label} eingetragen.`, button);
  }
  async function setEditingRound(round) { const tournament = getTournament(); await performWrite(() => db.from("tournaments").update({ editing_round: round }).eq("id", tournament.id), `Runde ${round} ausgewählt.`); }
  async function nextRound() { const t = getTournament(); await performWrite(() => db.from("tournaments").update({ current_round: t.currentRound + 1, editing_round: t.currentRound + 1 }).eq("id", t.id), "Neue Runde gestartet."); }
  async function deleteRound(round) { const t = getTournament(); if (!confirm(`Runde ${round} wirklich vollständig löschen?`)) return; await performWrite(() => db.rpc("delete_tournament_round", { p_tournament_id: t.id, p_round: round }), "Runde gelöscht."); }
  async function deleteTournament() { const t = getTournament(); if (!t || !confirm(`Turnier „${t.name}“ wirklich löschen?`)) return; await performWrite(() => db.from("tournaments").delete().eq("id", t.id), "Turnier gelöscht."); }

  function parseStatsTokenBlock(text) {
    if (text.trim() === "/") return { k: 0, dm: 0, w: 0 };
    const result = { k: 0, dm: 0, w: 0 }; const cleaned = text.trim();
    const tokens = [...cleaned.matchAll(/\b(k|dm|w)\s*:\s*(-?\d+)\b/gi)];
    if (!tokens.length || cleaned.replace(/\b(?:k|dm|w)\s*:\s*-?\d+\b/gi, "").trim()) throw new Error(`Ungültige Werte: ${text}`);
    for (const token of tokens) { const key = token[1].toLowerCase(); if (key === "k") result.k += Number(token[2]); else result[key] += Number(token[2]); }
    if (!Number.isInteger(result.k) || result.k < 0) throw new Error("Kills müssen mindestens 0 sein.");
    if (![0, 1].includes(result.dm) || ![0, 1].includes(result.w)) throw new Error("dm und w dürfen pro Spieler nur 0 oder 1 sein.");
    return result;
  }

  function parseRoundImport(text) {
    const colorPattern = TEAM_COLOR_DEFS.map((c) => c.label.replace(" ", "\\s+")).join("|");
    const sectionRegex = new RegExp(`(?:^|\\n)\\s*(${colorPattern})\\s*:\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:${colorPattern})\\s*:)|$)`, "gi");
    const sections = []; let match;
    while ((match = sectionRegex.exec(text.replace(/\r/g, "")))) {
      const color = COLOR_BY_NAME.get(match[1].replace(/\s+/g, " ").toLowerCase());
      const players = []; const playerRegex = /(?:^|,)\s*([^,:\n]+?)\s*:\s*(\/|(?:(?:k|dm|w)\s*:\s*-?\d+\s*)+)\s*(?=,|$)/gi; let playerMatch;
      while ((playerMatch = playerRegex.exec(match[2].trim().replace(/,+\s*$/, "")))) players.push({ name: playerMatch[1].trim(), ...parseStatsTokenBlock(playerMatch[2]) });
      if (!players.length) throw new Error(`Keine gültigen Spieler für ${color.label}.`);
      sections.push({ color: color.label, hex: color.hex, players });
    }
    if (!sections.length) throw new Error("Keine gültigen Farbteams gefunden.");
    const results = sections.flatMap((section) => section.players);
    if (results.filter((player) => player.dm === 1).length > 4) throw new Error("Maximal 4 Spieler dürfen dm:1 erhalten.");
    if (results.filter((player) => player.w === 1).length > 1) throw new Error("Maximal 1 Spieler darf w:1 erhalten.");
    return sections;
  }

  async function importParticipants(event) {
    event.preventDefault(); let sections; try { sections = parseRoundImport($("#importText").value); } catch (error) { showToast(error.message, "error"); return; }
    const tournament = getTournament(); const resolved = [];
    const importedNames = sections.flatMap((section) => section.players.map((player) => player.name.toLowerCase()));
    if (new Set(importedNames).size !== importedNames.length) return showToast("Jeder Spielername darf im Import nur einmal vorkommen.", "error");
    for (const section of sections) {
      const team = tournament.teams.find((item) => item.name.toLowerCase() === section.color.toLowerCase());
      if (!team && section.players.length !== tournament.mode) return showToast(`${section.color} benötigt genau ${tournament.mode} Spieler.`, "error");
      if (team) {
        const existing = team.players.map((player) => player.name.toLowerCase()).sort();
        const incoming = section.players.map((player) => player.name.toLowerCase()).sort();
        if (existing.length !== incoming.length || existing.some((name, index) => name !== incoming[index])) return showToast(`Team ${section.color} passt nicht zu den importierten Spielern.`, "error");
      }
    }
    const ok = await performWrite(async () => {
      for (const section of sections) {
        let team = tournament.teams.find((item) => item.name.toLowerCase() === section.color.toLowerCase());
        if (!team) {
          const teamResult = await db.from("teams").insert({ tournament_id: tournament.id, name: section.color, color: section.hex }).select().single(); if (teamResult.error) return teamResult;
          const playerResult = await db.from("players").insert(section.players.map((p) => ({ tournament_id: tournament.id, team_id: teamResult.data.id, name: p.name }))).select(); if (playerResult.error) return playerResult;
          team = { id: teamResult.data.id, players: playerResult.data };
        }
        for (const input of section.players) { const player = team.players.find((p) => p.name.toLowerCase() === input.name.toLowerCase()); resolved.push({ player_id: player.id, k: input.k, dm: input.dm, w: input.w }); }
      }
      return db.rpc("replace_round_results", { p_tournament_id: tournament.id, p_round: tournament.editingRound, p_results: resolved });
    }, `Runde ${tournament.editingRound} importiert.`, event.submitter);
    if (ok) closeModal("importModal");
  }

  function resetParticipantForm() {
    const tournament = getTournament(); if (!tournament) return;
    $("#teamOptions").hidden = tournament.mode === 1; $("#playerFields").innerHTML = "";
    for (let i = 0; i < tournament.mode; i += 1) { const fragment = $("#playerFieldTemplate").content.cloneNode(true); fragment.querySelector(".player-form-number").textContent = i + 1; $("#playerFields").append(fragment); }
    syncColor();
  }
  function syncColor() { const color = COLOR_BY_NAME.get($("#teamNameInput").value.toLowerCase()) || TEAM_COLOR_DEFS[0]; $("#teamColorSwatch").style.background = color.hex; $("#teamColorValue").textContent = color.label; $("#teamColorInput").value = color.hex; }
  function openModal(id) { $("#" + id).hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal(id) { $("#" + id).hidden = true; document.body.style.overflow = ""; }
  function showToast(message, type = "success") { const toast = document.createElement("div"); toast.className = `toast ${type}`; toast.textContent = message; $("#toastRegion").append(toast); setTimeout(() => toast.remove(), 4000); }
  function openImport() { const t = getTournament(); if (!t) return; $("#importRoundTarget").textContent = `Runde ${t.editingRound}`; $("#importNote").textContent = "k = Kill (+1), dm = Deathmatch (+3), w = Sieg (+2). Kein Kill-Limit; max. 4× dm und 1× w."; openModal("importModal"); }
  function exportJson() { const blob = new Blob([JSON.stringify(getTournament(), null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "turnier-export.json"; link.click(); URL.revokeObjectURL(link.href); }

  function bindEvents() {
    window.addEventListener("hashchange", route);
    $("#publicTournamentSelect").addEventListener("change", (e) => setActiveTournament(e.target.value));
    $("#adminTournamentSelect").addEventListener("change", (e) => setActiveTournament(e.target.value));
    $("#rankingViewToggle").addEventListener("click", (e) => { const button = e.target.closest("[data-ranking-view]"); if (button && !button.disabled) { rankingView = button.dataset.rankingView; renderPublic(); } });
    $("#publicRankingRows").addEventListener("click", (e) => { const row = e.target.closest("[data-team-id]"); if (row) renderDetail(row.dataset.teamId, row.dataset.playerId); });
    $("#adminLoginForm").addEventListener("submit", login); $("#logoutButton").addEventListener("click", logout);
    $("#createTournamentButton").addEventListener("click", () => { selectedMode = 0; $("#tournamentForm").reset(); openModal("tournamentModal"); });
    $("#tournamentModePicker").addEventListener("click", (e) => { const button = e.target.closest("[data-mode]"); if (!button) return; selectedMode = Number(button.dataset.mode); $$("[data-mode]").forEach((b) => b.classList.toggle("active", b === button)); $("#saveTournamentButton").disabled = false; $("#modeExplanation").textContent = `${MODE_LABELS[selectedMode]}: ${selectedMode} Spieler pro Team.`; });
    $("#tournamentForm").addEventListener("submit", createTournament);
    const participant = () => { resetParticipantForm(); openModal("participantModal"); };
    $("#addParticipantButton").addEventListener("click", participant); $("#emptyAddButton").addEventListener("click", participant); $("#participantForm").addEventListener("submit", createParticipant); $("#teamNameInput").addEventListener("change", syncColor);
    $("#importButton").addEventListener("click", openImport); $("#importForm").addEventListener("submit", importParticipants);
    $("#importFile").addEventListener("change", async (e) => { if (e.target.files[0]) $("#importText").value = await e.target.files[0].text(); });
    $("#nextRoundButton").addEventListener("click", nextRound); $("#deleteTournamentButton").addEventListener("click", deleteTournament); $("#exportButton").addEventListener("click", exportJson);
    $("#adminRoundTabs").addEventListener("click", (e) => { const del = e.target.closest("[data-delete-round]"); if (del) { e.stopPropagation(); deleteRound(Number(del.dataset.deleteRound)); return; } const tab = e.target.closest("[data-round]"); if (tab) setEditingRound(Number(tab.dataset.round)); });
    $("#roundBackButton").addEventListener("click", () => { const t = getTournament(); if (t?.editingRound > 1) setEditingRound(t.editingRound - 1); });
    $("#roundForwardButton").addEventListener("click", () => { const t = getTournament(); if (t?.editingRound < t.currentRound) setEditingRound(t.editingRound + 1); });
    $("#jumpCurrentRoundButton").addEventListener("click", () => { const t = getTournament(); if (t) setEditingRound(t.currentRound); });
    $("#adminSearch").addEventListener("input", renderAdmin);
    $("#adminGroups").addEventListener("click", async (e) => { const row = e.target.closest("[data-player-id]"); const eventButton = e.target.closest("[data-event-type]"); if (row && eventButton) return addEvent(row.dataset.playerId, eventButton.dataset.eventType, eventButton); if (row && e.target.closest("[data-history]")) { activeHistoryPlayerId = row.dataset.playerId; renderHistory(); return; } if (row && e.target.closest("[data-delete-player]") && confirm("Spieler wirklich löschen?")) return performWrite(() => db.from("players").delete().eq("id", row.dataset.playerId), "Spieler gelöscht."); const teamButton = e.target.closest("[data-delete-team]"); if (teamButton && confirm("Team samt Spielern und Ergebnissen löschen?")) return performWrite(() => db.from("teams").delete().eq("id", teamButton.dataset.deleteTeam), "Team gelöscht."); });
    $$("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
    $$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) closeModal(backdrop.id); }));
  }

  function renderHistory() {
    const found = allPlayers(getTournament()).find(({ player }) => player.id === activeHistoryPlayerId); if (!found) return;
    $("#historyModalTitle").textContent = found.player.name;
    $("#historyContent").innerHTML = found.player.events.length ? found.player.events.slice().reverse().map((event) => `<div class="history-row"><span>Runde ${event.round}: ${EVENT_CONFIG[event.type].label} +${EVENT_CONFIG[event.type].points}</span><button type="button" data-event-id="${event.id}">Löschen</button></div>`).join("") : "<p>Noch keine Events.</p>";
    $("#historyContent").onclick = (e) => { const button = e.target.closest("[data-event-id]"); if (button) performWrite(() => db.from("events").delete().eq("id", button.dataset.eventId), "Event gelöscht.").then(() => renderHistory()); };
    openModal("historyModal");
  }

  const importTestApi = { parseRoundImport, parseStatsTokenBlock };
  if (typeof module !== "undefined" && module.exports) module.exports = importTestApi;
  if (typeof document === "undefined") return;
  window.__IMPORT_TEST_API__ = importTestApi;
  bindEvents(); route(); loadData().then(subscribeRealtime);
})();
