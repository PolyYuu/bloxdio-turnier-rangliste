(() => {
  "use strict";

  const STORAGE_KEY = "sg-tournament-ranking-demo-v6";
  const TEAM_COLOR_DEFS = [
    { label: "Lime Green", hex: "#7CFC00" },
    { label: "Cyan", hex: "#00DCEB" },
    { label: "Dark Blue", hex: "#1E3A8A" },
    { label: "Pink", hex: "#EC4899" },
    { label: "Dark Green", hex: "#166534" },
    { label: "White", hex: "#F8FAFC" },
    { label: "Brown", hex: "#8B5E3C" },
    { label: "Orange", hex: "#F97316" },
    { label: "Yellow", hex: "#FACC15" },
    { label: "Purple", hex: "#7E22CE" },
    { label: "Magenta", hex: "#D946EF" },
    { label: "Baby Blue", hex: "#7DD3FC" }
  ];
  const TEAM_COLORS = TEAM_COLOR_DEFS.map((item) => item.hex);
  const TEAM_COLOR_BY_NAME = Object.fromEntries(
    TEAM_COLOR_DEFS.map((item) => [item.label.toLocaleLowerCase("en"), item])
  );
  const EVENT_CONFIG = {
    kill: { label: "Kill", points: 1 },
    deathmatch: { label: "Deathmatch", points: 3 },
    win: { label: "Sieg", points: 5 }
  };
  const MODE_LABELS = { 1: "Solo", 2: "Duo", 3: "Trio", 4: "Squad" };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  const isoNow = () => new Date().toISOString();

  function makeEvent(round, type, count = 1) {
    return Array.from({ length: count }, () => ({
      id: uid("event"),
      round,
      type,
      points: EVENT_CONFIG[type].points,
      createdAt: isoNow()
    }));
  }

  function makePlayer(name, events = []) {
    return { id: uid("player"), name, events };
  }

  function sampleState() {
    const now = isoNow();
    const duoTournament = {
      id: uid("tournament"),
      name: "Bloxdio Turnier 22.08.",
      mode: 2,
      currentRound: 3,
      editingRound: 3,
      createdAt: now,
      updatedAt: now,
      teams: [
        {
          id: uid("team"), name: "Lime Green", color: "#7CFC00",
          players: [
            makePlayer("Hübscher Mann", [...makeEvent(1, "kill", 2), ...makeEvent(1, "deathmatch"), ...makeEvent(2, "win"), ...makeEvent(3, "kill")]),
            makePlayer("PixelRaven", [...makeEvent(1, "kill"), ...makeEvent(2, "deathmatch"), ...makeEvent(2, "kill", 2), ...makeEvent(3, "win")])
          ]
        },
        {
          id: uid("team"), name: "Cyan", color: "#00DCEB",
          players: [
            makePlayer("FoxByte", [...makeEvent(1, "deathmatch"), ...makeEvent(2, "kill", 3), ...makeEvent(3, "deathmatch")]),
            makePlayer("SnowNova", [...makeEvent(1, "kill", 2), ...makeEvent(2, "win"), ...makeEvent(3, "kill")])
          ]
        },
        {
          id: uid("team"), name: "Dark Blue", color: "#1E3A8A",
          players: [
            makePlayer("CobwebKing", [...makeEvent(1, "kill"), ...makeEvent(2, "deathmatch"), ...makeEvent(3, "kill", 2)]),
            makePlayer("BlockKnight", [...makeEvent(1, "win"), ...makeEvent(2, "kill"), ...makeEvent(3, "deathmatch")])
          ]
        }
      ]
    };

    const soloTournament = {
      id: uid("tournament"),
      name: "Solo Open",
      mode: 1,
      currentRound: 2,
      editingRound: 2,
      createdAt: now,
      updatedAt: now,
      teams: [
        { id: uid("solo"), name: "LavaLynx", color: "", players: [makePlayer("LavaLynx", [...makeEvent(1, "kill", 3), ...makeEvent(2, "win")])] },
        { id: uid("solo"), name: "EnderEcho", color: "", players: [makePlayer("EnderEcho", [...makeEvent(1, "deathmatch"), ...makeEvent(2, "kill", 2)])] },
        { id: uid("solo"), name: "MoonArcher", color: "", players: [makePlayer("MoonArcher", [...makeEvent(1, "kill"), ...makeEvent(2, "deathmatch")])] }
      ]
    };

    return {
      version: 6,
      activeTournamentId: duoTournament.id,
      updatedAt: now,
      tournaments: [duoTournament, soloTournament]
    };
  }

  let state = loadState();
  let publicRankingView = "team";
  let selectedTournamentMode = 0;
  let activeHistoryPlayerId = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.tournaments) && parsed.tournaments.length) return normalizeState(parsed);
    } catch (error) {
      console.warn("Turnierdaten konnten nicht geladen werden.", error);
    }
    const initial = sampleState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  function normalizeState(input) {
    const tournaments = (input.tournaments || []).map((sourceTournament) => {
      const currentRound = Math.max(1, Math.round(Number(sourceTournament.currentRound) || 1));
      const editingRound = Math.min(
        currentRound,
        Math.max(1, Math.round(Number(sourceTournament.editingRound) || currentRound))
      );

      return {
        id: sourceTournament.id || uid("tournament"),
        name: String(sourceTournament.name || "Unbenanntes Turnier").trim(),
        mode: Math.min(4, Math.max(1, Math.round(Number(sourceTournament.mode) || 1))),
        currentRound,
        editingRound,
        createdAt: sourceTournament.createdAt || isoNow(),
        updatedAt: sourceTournament.updatedAt || sourceTournament.createdAt || isoNow(),
        teams: (sourceTournament.teams || []).map((team) => ({
          id: team.id || uid("team"),
          name: String(team.name || "Unbenannt").trim(),
          color: team.color || "",
          players: (team.players || []).map((player) => ({
            id: player.id || uid("player"),
            name: String(player.name || "Unbenannter Spieler").trim(),
            events: (player.events || []).map((event) => ({
              id: event.id || uid("event"),
              round: Math.max(1, Math.round(Number(event.round) || 1)),
              type: EVENT_CONFIG[event.type] ? event.type : "kill",
              points: EVENT_CONFIG[event.type]?.points || 1,
              createdAt: event.createdAt || isoNow()
            }))
          }))
        }))
      };
    });

    const activeTournamentId = tournaments.some((item) => item.id === input.activeTournamentId)
      ? input.activeTournamentId
      : tournaments[0].id;

    return { version: 6, activeTournamentId, updatedAt: input.updatedAt || isoNow(), tournaments };
  }

  function persistState(message = "", touchTournament = true) {
    state.updatedAt = isoNow();
    if (touchTournament) {
      const tournament = getActiveTournament();
      if (tournament) tournament.updatedAt = state.updatedAt;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    if (message) showToast(message, "success");
  }

  function getActiveTournament() {
    return state.tournaments.find((item) => item.id === state.activeTournamentId) || state.tournaments[0] || null;
  }

  function setActiveTournament(tournamentId) {
    if (!state.tournaments.some((item) => item.id === tournamentId)) return;
    state.activeTournamentId = tournamentId;
    const tournament = getActiveTournament();
    tournament.editingRound = Math.min(tournament.currentRound, Math.max(1, tournament.editingRound || tournament.currentRound));
    publicRankingView = tournament.mode === 1 ? "individual" : "team";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  }

  function allPlayers(tournament) {
    return tournament.teams.flatMap((team) => team.players.map((player) => ({ player, team })));
  }

  function playerStats(player) {
    const stats = { kills: 0, deathmatches: 0, wins: 0, points: 0 };
    for (const event of player.events) {
      stats.points += EVENT_CONFIG[event.type]?.points || 0;
      if (event.type === "kill") stats.kills += 1;
      if (event.type === "deathmatch") stats.deathmatches += 1;
      if (event.type === "win") stats.wins += 1;
    }
    return stats;
  }

  function playerStatsThroughRound(player, maxRound) {
    const stats = { kills: 0, deathmatches: 0, wins: 0, points: 0 };
    for (const event of player.events) {
      if (event.round > maxRound) continue;
      stats.points += EVENT_CONFIG[event.type]?.points || 0;
      if (event.type === "kill") stats.kills += 1;
      if (event.type === "deathmatch") stats.deathmatches += 1;
      if (event.type === "win") stats.wins += 1;
    }
    return stats;
  }

  function teamPointsThroughRound(team, maxRound) {
    return team.players.reduce((total, player) => total + playerStatsThroughRound(player, maxRound).points, 0);
  }

  function publicTeamLabel(team) {
    return team.players.map((player) => player.name).join(" ♦ ");
  }

  function placementLabel(rank) {
    if (rank === 1) return "#1";
    if (rank === 2) return "2ND";
    if (rank === 3) return "3RD";
    return `${rank}TH`;
  }

  function teamRankMap(tournament, round) {
    const ranked = tournament.teams.slice().sort((a, b) =>
      teamPointsThroughRound(b, round) - teamPointsThroughRound(a, round) ||
      publicTeamLabel(a).localeCompare(publicTeamLabel(b), "de")
    );
    return new Map(ranked.map((team, index) => [team.id, index + 1]));
  }

  function playerRankMap(tournament, round) {
    const ranked = allPlayers(tournament).slice().sort((a, b) =>
      playerStatsThroughRound(b.player, round).points - playerStatsThroughRound(a.player, round).points ||
      a.player.name.localeCompare(b.player.name, "de")
    );
    return new Map(ranked.map(({ player }, index) => [player.id, index + 1]));
  }

  function movementMarkup(currentRank, previousRank, currentRound) {
    if (currentRound <= 1 || !previousRank) return '<span class="rank-movement empty" aria-hidden="true"></span>';
    if (currentRank < previousRank) {
      return `<span class="rank-movement up" title="Seit der letzten Runde um ${previousRank - currentRank} Platz/Plätze gestiegen" aria-label="Aufgestiegen">▲</span>`;
    }
    if (currentRank > previousRank) {
      return `<span class="rank-movement down" title="Seit der letzten Runde um ${currentRank - previousRank} Platz/Plätze gefallen" aria-label="Abgestiegen">▼</span>`;
    }
    return '<span class="rank-movement same" title="Platzierung unverändert" aria-label="Unverändert">•</span>';
  }

  function teamPoints(team) {
    return team.players.reduce((total, player) => total + playerStats(player).points, 0);
  }

  function teamStats(team) {
    return team.players.reduce((total, player) => {
      const stats = playerStats(player);
      total.kills += stats.kills;
      total.deathmatches += stats.deathmatches;
      total.wins += stats.wins;
      total.points += stats.points;
      return total;
    }, { kills: 0, deathmatches: 0, wins: 0, points: 0 });
  }

  function roundStats(player, round) {
    const events = player.events.filter((event) => event.round === round);
    const kills = events.filter((event) => event.type === "kill").length;
    const deathmatches = events.filter((event) => event.type === "deathmatch").length;
    const wins = events.filter((event) => event.type === "win").length;
    return {
      kills,
      deathmatches,
      wins,
      killPoints: kills,
      deathmatchPoints: deathmatches * EVENT_CONFIG.deathmatch.points,
      winPoints: wins * 5
    };
  }

  function sortedTeams(tournament, filter = "") {
    const term = filter.trim().toLocaleLowerCase("de");
    return tournament.teams
      .filter((team) => !term || `${team.name} ${publicTeamLabel(team)}`.toLocaleLowerCase("de").includes(term))
      .sort((a, b) =>
        teamPointsThroughRound(b, tournament.currentRound) - teamPointsThroughRound(a, tournament.currentRound) ||
        publicTeamLabel(a).localeCompare(publicTeamLabel(b), "de")
      );
  }

  function sortedPlayers(tournament, filter = "") {
    const term = filter.trim().toLocaleLowerCase("de");
    return allPlayers(tournament)
      .filter(({ player, team }) => !term || `${player.name} ${team.name} ${publicTeamLabel(team)}`.toLocaleLowerCase("de").includes(term))
      .sort((a, b) =>
        playerStatsThroughRound(b.player, tournament.currentRound).points - playerStatsThroughRound(a.player, tournament.currentRound).points ||
        a.player.name.localeCompare(b.player.name, "de")
      );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function publicPlayerBoxMarkup(player, compact = false) {
    return `
      <div class="standing-player-box ${compact ? "compact-name" : ""}">
        <strong>${escapeHtml(player.name)}</strong>
      </div>`;
  }

  function publicTeamPlayersMarkup(players) {
    return players
      .map((player) => publicPlayerBoxMarkup(player, players.length >= 3))
      .join('<span class="standing-plus" aria-hidden="true">+</span>');
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
      return "Unbekannter Zeitpunkt";
    }
  }

  function route() {
    const isAdmin = location.hash.toLowerCase() === "#admin";
    document.body.classList.toggle("public-mode", !isAdmin);
    document.body.classList.toggle("admin-mode", isAdmin);
    $("#rankingView").hidden = isAdmin;
    $("#adminView").hidden = !isAdmin;
    $$(".admin-only").forEach((element) => { element.hidden = !isAdmin; });
    $$('[data-nav]').forEach((link) => link.classList.toggle("active", link.dataset.nav === (isAdmin ? "admin" : "ranking")));
    document.title = isAdmin ? "Survival Games – Admin-Panel" : "Turnier Rangliste";
    closePopover();
    renderAll();
  }

  function renderTournamentSelects() {
    const options = state.tournaments.map((tournament) => `<option value="${tournament.id}" ${tournament.id === state.activeTournamentId ? "selected" : ""}>${escapeHtml(tournament.name)} · ${MODE_LABELS[tournament.mode]}</option>`).join("");
    $("#publicTournamentSelect").innerHTML = options;
    $("#adminTournamentSelect").innerHTML = options;
  }

  function renderAll() {
    renderTournamentSelects();
    renderPublic();
    renderAdmin();
  }

  function renderPublic() {
    const tournament = getActiveTournament();
    if (!tournament) return;

    if (tournament.mode === 1) publicRankingView = "individual";
    $("#publicTournamentTitle").textContent = tournament.name;
    $("#publicTournamentSubtitle").textContent = "";
    $("#publicUpdatedAt").textContent = `UPDATED ${formatDateTime(tournament.updatedAt)}`;
    $("#publicMode").textContent = MODE_LABELS[tournament.mode];
    $("#publicModeBadge").textContent = MODE_LABELS[tournament.mode].toUpperCase();
    $("#publicRoundBadge").textContent = tournament.currentRound;
    $("#publicGroupCountLabel").textContent = tournament.mode === 1 ? "Teilnehmer" : "Teams";
    $("#publicGroupCount").textContent = tournament.teams.length;
    $("#publicPlayerCount").textContent = allPlayers(tournament).length;
    $("#publicCurrentRound").textContent = tournament.currentRound;

    const toggle = $("#rankingViewToggle");
    toggle.hidden = tournament.mode === 1;
    $$('[data-ranking-view]', toggle).forEach((button) => button.classList.toggle("active", button.dataset.rankingView === publicRankingView));

    const search = $("#publicSearch").value || "";
    if (publicRankingView === "team" && tournament.mode > 1) renderPublicTeams(tournament, search);
    else renderPublicIndividuals(tournament, search);
  }

  function renderPublicTeams(tournament, search) {
    const teams = sortedTeams(tournament, search);
    const currentRanks = teamRankMap(tournament, tournament.currentRound);
    const previousRanks = tournament.currentRound > 1
      ? teamRankMap(tournament, tournament.currentRound - 1)
      : new Map();

    $("#rankingHeading").textContent = "Teamwertung";
    $("#publicRankingHead").innerHTML = "";
    $("#publicRankingRows").innerHTML = teams.map((team) => {
      const rank = currentRanks.get(team.id);
      const points = teamPointsThroughRound(team, tournament.currentRound);

      return `
        <div class="standing-row team-size-${team.players.length}" role="row" data-detail-team-id="${team.id}">
          <div class="standing-rank-box" role="cell">
            ${movementMarkup(rank, previousRanks.get(team.id), tournament.currentRound)}
            <span class="rank-number">${placementLabel(rank)}</span>
          </div>

          <div class="standing-team-boxes" role="cell">
            ${publicTeamPlayersMarkup(team.players)}
          </div>

          <div class="standing-points-box" role="cell">
            <strong>${points}</strong><span>PTS</span>
          </div>
        </div>`;
    }).join("");

    updatePublicEmpty(teams.length);
    $("#rowHint").textContent = "";
  }

  function renderPublicIndividuals(tournament, search) {
    const players = sortedPlayers(tournament, search);
    const currentRanks = playerRankMap(tournament, tournament.currentRound);
    const previousRanks = tournament.currentRound > 1
      ? playerRankMap(tournament, tournament.currentRound - 1)
      : new Map();

    $("#rankingHeading").textContent = "Einzelwertung";
    $("#publicRankingHead").innerHTML = "";
    $("#publicRankingRows").innerHTML = players.map(({ player, team }) => {
      const stats = playerStatsThroughRound(player, tournament.currentRound);
      const rank = currentRanks.get(player.id);

      return `
        <div class="standing-row solo-standing-row" role="row" data-detail-player-id="${player.id}" data-detail-team-id="${team.id}">
          <div class="standing-rank-box" role="cell">
            ${movementMarkup(rank, previousRanks.get(player.id), tournament.currentRound)}
            <span class="rank-number">${placementLabel(rank)}</span>
          </div>

          <div class="standing-team-boxes single-player-box" role="cell">
            ${publicPlayerBoxMarkup(player)}
          </div>

          <div class="standing-points-box" role="cell">
            <strong>${stats.points}</strong><span>PTS</span>
          </div>
        </div>`;
    }).join("");

    updatePublicEmpty(players.length);
    $("#rowHint").textContent = "";
  }

  function updatePublicEmpty(count) {
    $("#publicEmpty").hidden = count !== 0;
    $(".ranking-table").hidden = count === 0;
  }

  function renderAdmin() {
    const tournament = getActiveTournament();
    if (!tournament) return;
    const playerCount = allPlayers(tournament).length;
    $("#adminMode").textContent = MODE_LABELS[tournament.mode];
    $("#adminModeDescription").textContent = tournament.mode === 1 ? "Jeder Eintrag ist ein einzelner Spieler." : `Jeder neue Eintrag besteht automatisch aus ${tournament.mode} Spielern.`;
    const editingRound = Math.min(tournament.currentRound, Math.max(1, tournament.editingRound || tournament.currentRound));
    tournament.editingRound = editingRound;
    $("#adminCurrentRound").textContent = tournament.currentRound;
    $("#adminHeadRound").textContent = editingRound;
    renderRoundEditor(tournament);
    $("#adminParticipants").textContent = playerCount;
    $("#adminTeamsSummary").textContent = tournament.mode === 1 ? `${tournament.teams.length} Einzelspieler` : `${tournament.teams.length} Teams`;
    $("#deleteTournamentButton").disabled = state.tournaments.length <= 1;
    $("#adminEmptyText").textContent = tournament.mode === 1 ? "Lege den ersten Einzelspieler an." : `Lege das erste ${MODE_LABELS[tournament.mode]}-Team an.`;

    const term = $("#adminSearch").value.trim().toLocaleLowerCase("de");
    const teams = tournament.teams.filter((team) => !term || `${team.name} ${team.players.map((player) => player.name).join(" ")}`.toLocaleLowerCase("de").includes(term));
    const visiblePlayerCount = teams.reduce((sum, team) => sum + team.players.length, 0);
    $("#adminResultCount").textContent = `${visiblePlayerCount} Spieler`;

    $("#adminGroups").innerHTML = teams.map((team) => {
      const teamStyle = tournament.mode > 1 ? `--team-color:${team.color}` : "";
      const heading = tournament.mode > 1 ? `
        <div class="admin-team-heading" style="${teamStyle}">
          <div><strong>${escapeHtml(team.name)}</strong><small>${team.players.map((player) => escapeHtml(player.name)).join(" ♦ ")}</small></div>
          <div class="team-heading-score">${teamPoints(team)} Punkte</div>
        </div>` : "";
      const rows = team.players.map((player) => renderAdminPlayerRow(tournament, team, player)).join("");
      return `<section class="admin-team-group" data-team-id="${team.id}">${heading}${rows}</section>`;
    }).join("");

    $("#adminEmpty").hidden = teams.length !== 0;
  }

  function renderRoundEditor(tournament) {
    const editingRound = tournament.editingRound || tournament.currentRound;
    $("#adminEditingRound").textContent = `Runde ${editingRound}`;
    $("#roundEditingNote").textContent = editingRound === tournament.currentRound
      ? "Du bearbeitest die aktuelle Runde."
      : `Du bearbeitest nachträglich Runde ${editingRound}.`;

    $("#adminRoundTabs").innerHTML = Array.from({ length: tournament.currentRound }, (_, index) => index + 1)
      .map((round) => `
        <div class="round-tab-wrap ${round === editingRound ? "active" : ""}">
          <button class="round-tab ${round === editingRound ? "active" : ""} ${round === tournament.currentRound ? "current" : ""}" type="button" data-edit-round="${round}">
            Runde ${round}${round === tournament.currentRound ? "<small>aktuell</small>" : ""}
          </button>
          <button
            class="round-delete-button"
            type="button"
            data-delete-round="${round}"
            title="${tournament.currentRound <= 1 ? "Mindestens eine Runde muss bestehen bleiben" : `Runde ${round} löschen`}"
            aria-label="Runde ${round} löschen"
            ${tournament.currentRound <= 1 ? "disabled" : ""}
          >×</button>
        </div>
      `).join("");

    $("#roundBackButton").disabled = editingRound <= 1;
    $("#roundForwardButton").disabled = editingRound >= tournament.currentRound;
    $("#jumpCurrentRoundButton").disabled = editingRound === tournament.currentRound;
  }

  function renderAdminPlayerRow(tournament, team, player) {
    const stats = playerStats(player);
    const current = roundStats(player, tournament.editingRound || tournament.currentRound);
    const colorStyle = tournament.mode > 1 ? `--team-color:${team.color}` : "";
    return `
      <article class="admin-player-row" data-player-id="${player.id}" data-team-id="${team.id}" style="${colorStyle}">
        <div class="admin-player">
          <div>
            <strong>${escapeHtml(player.name)}</strong>
            <small>K ${stats.kills} · DM ${stats.deathmatches} · S ${stats.wins}</small>
          </div>
        </div>
        <div class="admin-team-name">${tournament.mode === 1 ? '<span class="entity-sub">Solo</span>' : escapeHtml(team.name)}</div>
        <div class="admin-points">${stats.points}</div>
        <div class="round-action-cell">
          <button class="event-button kill" type="button" data-event-type="kill">Kill +1${current.kills ? ` · ${current.kills}×` : ""}</button>
          <button class="event-button dm" type="button" data-event-type="deathmatch">DM +3${current.deathmatches ? ` · ${current.deathmatches}×` : ""}</button>
          <button class="event-button win" type="button" data-event-type="win">Sieg +5${current.wins ? ` · ${current.wins}×` : ""}</button>
        </div>
        <div class="row-actions">
          <button class="mini-button" type="button" data-action="history" title="Historie anzeigen" aria-label="Historie anzeigen">↶</button>
          <button class="mini-button delete" type="button" data-action="delete" title="Spieler oder Team löschen" aria-label="Löschen">×</button>
        </div>
      </article>`;
  }

  function renderDetail(teamId, focusPlayerId = "") {
    const tournament = getActiveTournament();
    const team = tournament.teams.find((item) => item.id === teamId);
    if (!team) return;
    const isSolo = tournament.mode === 1;
    const players = focusPlayerId ? team.players.filter((player) => player.id === focusPlayerId) : team.players;
    const total = focusPlayerId ? playerStats(players[0]).points : teamPoints(team);

    $("#detailEyebrow").textContent = isSolo || focusPlayerId ? "Spielerprofil" : `${MODE_LABELS[tournament.mode]}-Profil`;
    $("#detailModalTitle").textContent = focusPlayerId ? players[0].name : publicTeamLabel(team);
    $("#detailPlayerNames").textContent = focusPlayerId
      ? (isSolo ? "Solo-Turnier" : `Einzelwertung · ${publicTeamLabel(team)}`)
      : `${MODE_LABELS[tournament.mode]} · ${team.players.length} Spieler`;
    $("#detailTotalPoints").textContent = total;
    $("#detailScoreGhost").textContent = total;
    $("#detailRoundNumber").textContent = tournament.currentRound;
    $("#detailPlayersGrid").innerHTML = players
      .map((player) => renderPlayerProfileCard(tournament, player))
      .join('<div class="detail-team-plus" aria-hidden="true">+</div>');
    openModal("detailModal");
  }

  function renderPlayerProfileCard(tournament, player) {
    const stats = playerStats(player);
    const rounds = Array.from({ length: tournament.currentRound }, (_, index) => index + 1);

    return `
      <article class="player-profile-card">
        <div class="detail-player-standing">
          <div class="detail-player-name-box">
            <strong>${escapeHtml(player.name)}</strong>
          </div>
          <div class="detail-player-points-box">
            <strong>${stats.points}</strong><span>PTS</span>
          </div>
        </div>

        <div class="profile-stat-grid">
          <div class="profile-stat kill"><span>KILLS</span><strong>${stats.kills}</strong></div>
          <div class="profile-stat dm"><span>DEATHMATCHES</span><strong>${stats.deathmatches}</strong></div>
          <div class="profile-stat win"><span>WINS</span><strong>${stats.wins}</strong></div>
        </div>

        <div class="match-history">
          <h3>MATCH HISTORY</h3>
          <div class="round-history-list">
            ${rounds.map((round) => {
              const data = roundStats(player, round);
              return `
                <div class="round-history-row">
                  <strong>ROUND ${round}</strong>
                  <span>KILL <b>+${data.killPoints}</b></span>
                  <span>DEATHMATCH <b>+${data.deathmatchPoints}</b></span>
                  <span>WIN <b>+${data.winPoints}</b></span>
                </div>`;
            }).join("")}
          </div>
        </div>
      </article>`;
  }

  function renderHistory() {
    const tournament = getActiveTournament();
    const pair = allPlayers(tournament).find(({ player }) => player.id === activeHistoryPlayerId);
    if (!pair) return;
    const { player, team } = pair;
    const stats = playerStats(player);
    $("#historyModalTitle").textContent = `Historie · ${player.name}`;

    const roundBlocks = Array.from({ length: tournament.currentRound }, (_, index) => tournament.currentRound - index)
      .map((round) => {
        const events = player.events.filter((event) => event.round === round).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const content = events.length ? events.map((event) => `
          <div class="history-item">
            <div><strong>${EVENT_CONFIG[event.type].label} +${EVENT_CONFIG[event.type].points}</strong><small>${escapeHtml(formatDateTime(event.createdAt))}</small></div>
            <span class="history-delta">+${EVENT_CONFIG[event.type].points}</span>
            <button class="history-remove" type="button" data-history-event-id="${event.id}">Eintrag entfernen</button>
          </div>`).join("") : `<div class="history-empty">In dieser Runde gibt es noch keine Aktionen.</div>`;
        return `<section class="history-round"><div class="history-round-heading">Runde ${round}</div>${content}</section>`;
      }).join("");

    $("#historyContent").innerHTML = `
      <div class="history-summary">
        <div><span>Spieler</span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(tournament.mode === 1 ? "Solo" : team.name)}</small></div>
        <div><span>Aktueller Stand</span><strong class="history-total">${stats.points}</strong></div>
      </div>${roundBlocks}`;
  }

  function togglePopover() { $("#addPopover").hidden = !$("#addPopover").hidden; }
  function closePopover() { $("#addPopover").hidden = true; }
  function openModal(id) { closePopover(); $("#" + id).hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal(id) {
    $("#" + id).hidden = true;
    if (!$$('.modal-backdrop').some((element) => !element.hidden)) document.body.style.overflow = "";
  }

  function resetTournamentForm() {
    selectedTournamentMode = 0;
    $("#tournamentForm").reset();
    $("#saveTournamentButton").disabled = true;
    $("#modeExplanation").textContent = "Wähle einen Modus aus.";
    $$("#tournamentModePicker button").forEach((button) => button.classList.remove("active"));
  }

  function chooseTournamentMode(mode) {
    selectedTournamentMode = mode;
    $$("#tournamentModePicker button").forEach((button) => button.classList.toggle("active", Number(button.dataset.mode) === mode));
    $("#saveTournamentButton").disabled = false;
    $("#modeExplanation").textContent = mode === 1
      ? "Solo: Jeder neue Teilnehmer besteht aus genau einem Spieler. Die öffentliche Rangliste zeigt direkt die Einzelwertung."
      : `${MODE_LABELS[mode]}: Jeder neue Teilnehmer ist automatisch ein Team mit genau ${mode} Spielern. Standardmäßig wird öffentlich die Teamwertung angezeigt.`;
  }

  function createTournament(event) {
    event.preventDefault();
    const name = $("#tournamentNameInput").value.trim();
    if (!name || !selectedTournamentMode) return;
    const now = isoNow();
    const tournament = { id: uid("tournament"), name, mode: selectedTournamentMode, currentRound: 1, editingRound: 1, createdAt: now, updatedAt: now, teams: [] };
    state.tournaments.push(tournament);
    state.activeTournamentId = tournament.id;
    publicRankingView = tournament.mode === 1 ? "individual" : "team";
    closeModal("tournamentModal");
    resetTournamentForm();
    persistState(`${name} wurde als ${MODE_LABELS[tournament.mode]}-Turnier erstellt.`);
  }

  function getTeamColorDef(label) {
    return TEAM_COLOR_BY_NAME[String(label || "").trim().toLocaleLowerCase("en")] || TEAM_COLOR_DEFS[0];
  }

  function syncTeamColorSelection() {
    const selected = getTeamColorDef($("#teamNameInput").value);
    $("#teamColorInput").value = selected.hex;
    $("#teamColorValue").textContent = selected.label;
    $("#teamColorSwatch").style.background = selected.hex;
  }

  function resetParticipantForm() {
    const tournament = getActiveTournament();
    if (!tournament) return;

    $("#participantForm").reset();
    const isTeam = tournament.mode > 1;

    $("#teamOptions").hidden = !isTeam;
    $("#playersStepNumber").textContent = isTeam ? "2" : "1";
    $("#playersSectionTitle").textContent = isTeam ? `${MODE_LABELS[tournament.mode]}-Spieler eintragen` : "Spieler eintragen";
    $("#playersSectionHint").textContent = `Genau ${tournament.mode} Spieler anlegen. Alle starten bei 0 Punkten.`;

    if (isTeam) {
      const used = new Set(tournament.teams.map((team) => team.name.toLocaleLowerCase("en")));
      const firstFree = TEAM_COLOR_DEFS.find((item) => !used.has(item.label.toLocaleLowerCase("en"))) || TEAM_COLOR_DEFS[0];
      $("#teamNameInput").value = firstFree.label;
      syncTeamColorSelection();
    }

    renderPlayerFields(tournament.mode);
  }

  function renderPlayerFields(count) {
    const container = $("#playerFields");
    const template = $("#playerFieldTemplate");
    container.innerHTML = "";

    for (let index = 0; index < count; index += 1) {
      const fragment = template.content.cloneNode(true);
      $(".player-form-number", fragment).textContent = index + 1;
      container.appendChild(fragment);
    }
  }

  function createParticipant(event) {
    event.preventDefault();

    const tournament = getActiveTournament();
    const names = $$(".player-name-input", $("#playerFields")).map((input) => input.value.trim());

    if (names.some((name) => !name)) {
      showToast("Bitte trage für jeden Spieler einen Namen ein.", "error");
      return;
    }

    const players = names.map((name) => makePlayer(name, []));
    let team;

    if (tournament.mode === 1) {
      team = { id: uid("solo"), name: names[0], color: "", players };
    } else {
      const selected = getTeamColorDef($("#teamNameInput").value);

      if (tournament.teams.some((item) => item.name.toLocaleLowerCase("en") === selected.label.toLocaleLowerCase("en"))) {
        showToast(`${selected.label} ist bereits als Teamfarbe vergeben.`, "error");
        return;
      }

      team = {
        id: uid("team"),
        name: selected.label,
        color: selected.hex,
        players
      };
    }

    tournament.teams.push(team);
    closeModal("participantModal");

    persistState(
      tournament.mode === 1
        ? `${names[0]} wurde mit 0 Punkten angelegt.`
        : `${team.name} wurde mit ${players.length} Spielern angelegt.`
    );
  }

  function addEvent(playerId, type) {
    const tournament = getActiveTournament();
    const pair = allPlayers(tournament).find(({ player }) => player.id === playerId);
    if (!pair || !EVENT_CONFIG[type]) return;
    const targetRound = tournament.editingRound || tournament.currentRound;
    pair.player.events.push({ id: uid("event"), round: targetRound, type, points: EVENT_CONFIG[type].points, createdAt: isoNow() });
    persistState(`${EVENT_CONFIG[type].label} (+${EVENT_CONFIG[type].points}) für ${pair.player.name} in Runde ${targetRound}.`);
  }

  function deleteAdminEntity(teamId, playerId) {
    const tournament = getActiveTournament();
    const team = tournament.teams.find((item) => item.id === teamId);
    if (!team) return;

    if (tournament.mode > 1) {
      if (!confirm(`Soll das komplette Team „${team.name}“ inklusive aller Spieler und Statistiken gelöscht werden?`)) return;
      tournament.teams = tournament.teams.filter((item) => item.id !== teamId);
      persistState(`${team.name} wurde gelöscht.`);
    } else {
      const player = team.players.find((item) => item.id === playerId);
      if (!player || !confirm(`Soll ${player.name} gelöscht werden?`)) return;
      tournament.teams = tournament.teams.filter((item) => item.id !== teamId);
      persistState(`${player.name} wurde gelöscht.`);
    }
  }

  function setEditingRound(round) {
    const tournament = getActiveTournament();
    const next = Math.min(tournament.currentRound, Math.max(1, Math.round(Number(round) || 1)));
    tournament.editingRound = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAdmin();
  }

  function nextRound() {
    const tournament = getActiveTournament();
    const currentRound = tournament.currentRound;
    if (!confirm(`Runde ${currentRound} beenden und Runde ${currentRound + 1} starten? Frühere Runden bleiben weiterhin bearbeitbar.`)) return;
    tournament.currentRound += 1;
    tournament.editingRound = tournament.currentRound;
    persistState(`Runde ${currentRound} wurde beendet. Runde ${tournament.currentRound} ist jetzt aktiv und zur Bearbeitung ausgewählt.`);
  }

  function deleteRound(round) {
    const tournament = getActiveTournament();
    const targetRound = Math.max(1, Math.round(Number(round) || 1));

    if (tournament.currentRound <= 1) {
      showToast("Mindestens eine Runde muss bestehen bleiben.", "error");
      return;
    }

    if (targetRound > tournament.currentRound) return;

    if (!confirm(
      `Runde ${targetRound} wirklich löschen? Alle Kills, Deathmatches und Siege dieser Runde werden entfernt. Spätere Runden rücken automatisch eine Nummer nach vorne.`
    )) return;

    for (const { player } of allPlayers(tournament)) {
      player.events = player.events
        .filter((event) => event.round !== targetRound)
        .map((event) => ({
          ...event,
          round: event.round > targetRound ? event.round - 1 : event.round
        }));
    }

    tournament.currentRound -= 1;

    if (tournament.editingRound > targetRound) {
      tournament.editingRound -= 1;
    } else if (tournament.editingRound === targetRound) {
      tournament.editingRound = Math.min(targetRound, tournament.currentRound);
    }

    tournament.editingRound = Math.max(1, Math.min(tournament.currentRound, tournament.editingRound));
    persistState(`Runde ${targetRound} wurde gelöscht. Spätere Runden wurden neu nummeriert.`);
  }

  function removeHistoryEvent(eventId) {
    const tournament = getActiveTournament();
    const pair = allPlayers(tournament).find(({ player }) => player.id === activeHistoryPlayerId);
    if (!pair) return;
    const event = pair.player.events.find((item) => item.id === eventId);
    if (!event) return;
    pair.player.events = pair.player.events.filter((item) => item.id !== eventId);
    persistState(`${EVENT_CONFIG[event.type].label} aus Runde ${event.round} wurde entfernt.`);
    renderHistory();
  }

  function deleteTournament() {
    if (state.tournaments.length <= 1) {
      showToast("Mindestens ein Turnier muss bestehen bleiben.", "error");
      return;
    }
    const tournament = getActiveTournament();
    if (!confirm(`Soll das Turnier „${tournament.name}“ inklusive aller Teams und Statistiken gelöscht werden?`)) return;
    state.tournaments = state.tournaments.filter((item) => item.id !== tournament.id);
    state.activeTournamentId = state.tournaments[0].id;
    publicRankingView = state.tournaments[0].mode === 1 ? "individual" : "team";
    persistState(`${tournament.name} wurde gelöscht.`, false);
  }

  function importInstructions(tournament) {
    const targetRound = tournament.editingRound || tournament.currentRound;

    if (tournament.mode === 1) {
      return `Importiert wird in Runde ${targetRound}.

Solo-Beispiel:
Lime Green: huebscherMann: k:3 dm:1 w:1

Bedeutung:
k:3 = 3 einzelne Kills = 3 × +1
dm:1 = 1 Deathmatch = +3
w:1 = 1 Sieg = +5
/ = keine Aktion in dieser Runde

Ein erneuter Import ersetzt für den genannten Spieler die Werte dieser Runde.`;
    }

    return `Importiert wird in Runde ${targetRound}.

Erlaubte Teamfarben:
${TEAM_COLOR_DEFS.map((item) => item.label).join(", ")}

Beispiel:
Lime Green: huebscherMann: k:3 dm:1 w:1, Muiiq: k:2 dm:1,
Cyan: Laradic: k:1, bauerb: /,
Dark Blue: dicmic: k:2, sismas: dm:1,

Bedeutung:
k:3 = drei separate Kill-Ereignisse = 3 × +1
dm:1 = ein Deathmatch-Ereignis = +3
w:1 = ein Sieg-Ereignis = +5
/ = 0 Kills, 0 Deathmatches, 0 Siege

Die Farbe dient nur als interne Team-Zuordnung. Sie erscheint nicht in der öffentlichen Rangliste.
Ein erneuter Import ersetzt für die genannten Spieler die Werte der ausgewählten Runde.`;
  }

  function parseStatsTokenBlock(text) {
    const source = String(text || "").trim();

    if (!source || source === "/") {
      return { kills: 0, deathmatches: 0, wins: 0 };
    }

    const result = { kills: 0, deathmatches: 0, wins: 0 };
    const regex = /\b(k|dm|w)\s*:\s*(\d+)\b/gi;
    let match;
    let matched = false;

    while ((match = regex.exec(source))) {
      matched = true;
      const count = Math.max(0, Math.round(Number(match[2]) || 0));
      const key = match[1].toLowerCase();

      if (key === "k") result.kills += count;
      if (key === "dm") result.deathmatches += count;
      if (key === "w") result.wins += count;
    }

    if (!matched) {
      throw new Error(`Stats konnten nicht gelesen werden: „${source}“. Nutze k:X, dm:X, w:X oder /.`);
    }

    const rest = source
      .replace(/\b(k|dm|w)\s*:\s*\d+\b/gi, "")
      .replace(/[\/|+\-\s]/g, "")
      .trim();

    if (rest) {
      throw new Error(`Unbekannter Stat-Ausdruck: „${source}“.`);
    }

    return result;
  }

  function parseRoundImport(text, tournament) {
    const source = String(text || "").trim();
    if (!source) throw new Error("Kein Import-Inhalt gefunden.");

    const colorPattern = TEAM_COLOR_DEFS
      .map((item) => item.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length)
      .join("|");

    const headerRegex = new RegExp(`(?:^|[\\n;,])\\s*(${colorPattern})\\s*:`, "gi");
    const matches = Array.from(source.matchAll(headerRegex));

    if (!matches.length) {
      throw new Error("Keine gültige Teamfarbe gefunden.");
    }

    const parsedTeams = [];

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const colorDef = getTeamColorDef(match[1]);
      const contentStart = match.index + match[0].length;
      const contentEnd = index + 1 < matches.length ? matches[index + 1].index : source.length;

      let teamContent = source.slice(contentStart, contentEnd).trim();
      teamContent = teamContent.replace(/^[,;\s]+|[,;\s]+$/g, "");

      const rawPlayers = teamContent
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const players = rawPlayers.map((segment) => {
        const separator = segment.indexOf(":");

        if (separator < 1) {
          throw new Error(`Spielereintrag konnte nicht gelesen werden: „${segment}“.`);
        }

        const name = segment.slice(0, separator).trim();
        const statsText = segment.slice(separator + 1).trim();

        if (!name) throw new Error(`Ein Spielername fehlt bei ${colorDef.label}.`);

        return {
          name,
          stats: parseStatsTokenBlock(statsText)
        };
      });

      if (players.length !== tournament.mode) {
        throw new Error(
          `${colorDef.label} enthält ${players.length} Spieler. Im ${MODE_LABELS[tournament.mode]}-Turnier werden genau ${tournament.mode} benötigt.`
        );
      }

      parsedTeams.push({
        color: colorDef,
        players
      });
    }

    const normalizedColors = parsedTeams.map((team) => team.color.label.toLocaleLowerCase("en"));
    const duplicateColor = normalizedColors.find((value, index) => normalizedColors.indexOf(value) !== index);

    if (duplicateColor) {
      throw new Error(`Eine Teamfarbe kommt mehrfach vor: ${duplicateColor}.`);
    }

    return parsedTeams;
  }

  function replacePlayerRoundStats(player, round, stats) {
    player.events = player.events.filter((event) => event.round !== round);
    const now = isoNow();

    for (let index = 0; index < stats.kills; index += 1) {
      player.events.push({
        id: uid("event"),
        round,
        type: "kill",
        points: EVENT_CONFIG.kill.points,
        createdAt: now
      });
    }

    for (let index = 0; index < stats.deathmatches; index += 1) {
      player.events.push({
        id: uid("event"),
        round,
        type: "deathmatch",
        points: EVENT_CONFIG.deathmatch.points,
        createdAt: now
      });
    }

    for (let index = 0; index < stats.wins; index += 1) {
      player.events.push({
        id: uid("event"),
        round,
        type: "win",
        points: EVENT_CONFIG.win.points,
        createdAt: now
      });
    }
  }

  function importParticipants(event) {
    event.preventDefault();

    const tournament = getActiveTournament();
    const targetRound = tournament.editingRound || tournament.currentRound;

    try {
      const parsedTeams = parseRoundImport($("#importText").value, tournament);
      let importedPlayers = 0;
      let createdTeams = 0;

      for (const parsedTeam of parsedTeams) {
        let team;

        if (tournament.mode === 1) {
          const incoming = parsedTeam.players[0];

          team = tournament.teams.find((item) =>
            item.players.some((player) =>
              player.name.toLocaleLowerCase("de") === incoming.name.toLocaleLowerCase("de")
            )
          );

          if (!team) {
            team = {
              id: uid("solo"),
              name: incoming.name,
              color: "",
              players: [makePlayer(incoming.name, [])]
            };
            tournament.teams.push(team);
            createdTeams += 1;
          }

          replacePlayerRoundStats(team.players[0], targetRound, incoming.stats);
          importedPlayers += 1;
          continue;
        }

        team = tournament.teams.find((item) =>
          item.name.toLocaleLowerCase("en") === parsedTeam.color.label.toLocaleLowerCase("en") ||
          String(item.color).toLocaleLowerCase("en") === parsedTeam.color.hex.toLocaleLowerCase("en")
        );

        if (!team) {
          team = {
            id: uid("team"),
            name: parsedTeam.color.label,
            color: parsedTeam.color.hex,
            players: parsedTeam.players.map((entry) => makePlayer(entry.name, []))
          };
          tournament.teams.push(team);
          createdTeams += 1;
        }

        team.name = parsedTeam.color.label;
        team.color = parsedTeam.color.hex;

        if (team.players.length !== tournament.mode) {
          throw new Error(`${parsedTeam.color.label} hat im Admin-Panel nicht genau ${tournament.mode} Spieler.`);
        }

        const parsedNames = parsedTeam.players.map((entry) => entry.name.toLocaleLowerCase("de"));

        for (const incoming of parsedTeam.players) {
          let player = team.players.find(
            (item) => item.name.toLocaleLowerCase("de") === incoming.name.toLocaleLowerCase("de")
          );

          if (!player) {
            const freePlayer = team.players.find(
              (candidate) => !parsedNames.includes(candidate.name.toLocaleLowerCase("de"))
            );

            if (!freePlayer) {
              throw new Error(
                `${incoming.name} wurde in ${parsedTeam.color.label} nicht gefunden und das Team hat keinen freien Spielerplatz.`
              );
            }

            freePlayer.name = incoming.name;
            player = freePlayer;
          }

          replacePlayerRoundStats(player, targetRound, incoming.stats);
          importedPlayers += 1;
        }
      }

      closeModal("importModal");
      $("#importForm").reset();

      persistState(
        `Runde ${targetRound}: Werte für ${importedPlayers} Spieler wurden übernommen.${createdTeams ? ` ${createdTeams} neue Team-/Teilnehmergruppen wurden angelegt.` : ""}`
      );
    } catch (error) {
      showToast(error.message || "Import fehlgeschlagen.", "error");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `survival-games-turniere-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("JSON-Export wurde erstellt.", "success");
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    $("#toastRegion").appendChild(toast);
    window.setTimeout(() => toast.remove(), 3400);
  }

  function openParticipantModal() {
    resetParticipantForm();
    openModal("participantModal");
  }

  function openImportModal() {
    const tournament = getActiveTournament();
    const targetRound = tournament.editingRound || tournament.currentRound;

    $("#importForm").reset();
    $("#importRoundTarget").textContent = `Runde ${targetRound}`;
    $("#importNote").textContent = importInstructions(tournament);
    $("#importText").placeholder = importInstructions(tournament);
    openModal("importModal");
  }

  function bindEvents() {
    window.addEventListener("hashchange", route);
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) {
        state = loadState();
        renderAll();
        showToast("Turnierdaten wurden in einem anderen Tab aktualisiert.");
      }
    });

    $("#publicTournamentSelect").addEventListener("change", (event) => setActiveTournament(event.target.value));
    $("#adminTournamentSelect").addEventListener("change", (event) => setActiveTournament(event.target.value));
    $("#publicSearch").addEventListener("input", renderPublic);
    $("#adminSearch").addEventListener("input", renderAdmin);

    $("#rankingViewToggle").addEventListener("click", (event) => {
      const button = event.target.closest("[data-ranking-view]");
      if (!button) return;
      publicRankingView = button.dataset.rankingView;
      renderPublic();
    });

    $("#publicRankingRows").addEventListener("click", (event) => {
      const row = event.target.closest("[data-detail-team-id]");
      if (!row) return;
      renderDetail(row.dataset.detailTeamId, row.dataset.detailPlayerId || "");
    });

    $("#addButton").addEventListener("click", (event) => { event.stopPropagation(); togglePopover(); });
    document.addEventListener("click", (event) => {
      if (!$("#addPopover").contains(event.target) && event.target !== $("#addButton")) closePopover();
    });

    $("#addPopover").addEventListener("click", (event) => {
      const button = event.target.closest("[data-open]");
      if (!button) return;
      if (button.dataset.open === "tournament") { resetTournamentForm(); openModal("tournamentModal"); }
      if (button.dataset.open === "participant") openParticipantModal();
      if (button.dataset.open === "import") openImportModal();
    });

    $("#createTournamentButton").addEventListener("click", () => { resetTournamentForm(); openModal("tournamentModal"); });
    $("#addParticipantButton").addEventListener("click", openParticipantModal);
    $("#emptyAddButton").addEventListener("click", openParticipantModal);
    $("#importButton").addEventListener("click", openImportModal);
    $("#deleteTournamentButton").addEventListener("click", deleteTournament);
    $("#nextRoundButton").addEventListener("click", nextRound);
    $("#adminRoundTabs").addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-round]");

      if (deleteButton) {
        event.stopPropagation();
        deleteRound(Number(deleteButton.dataset.deleteRound));
        return;
      }

      const button = event.target.closest("[data-edit-round]");
      if (button) setEditingRound(Number(button.dataset.editRound));
    });
    $("#roundBackButton").addEventListener("click", () => {
      const tournament = getActiveTournament();
      setEditingRound((tournament.editingRound || tournament.currentRound) - 1);
    });
    $("#roundForwardButton").addEventListener("click", () => {
      const tournament = getActiveTournament();
      setEditingRound((tournament.editingRound || tournament.currentRound) + 1);
    });
    $("#jumpCurrentRoundButton").addEventListener("click", () => {
      const tournament = getActiveTournament();
      setEditingRound(tournament.currentRound);
    });
    $("#exportButton").addEventListener("click", exportJson);

    $$("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
    $$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) closeModal(backdrop.id); }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePopover();
        $$(".modal-backdrop").forEach((modal) => { if (!modal.hidden) closeModal(modal.id); });
      }
    });

    $("#tournamentModePicker").addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (button) chooseTournamentMode(Number(button.dataset.mode));
    });
    $("#tournamentForm").addEventListener("submit", createTournament);
    $("#participantForm").addEventListener("submit", createParticipant);
    $("#teamNameInput").addEventListener("change", syncTeamColorSelection);

    $("#adminGroups").addEventListener("click", (event) => {
      const row = event.target.closest("[data-player-id]");
      if (!row) return;
      const eventButton = event.target.closest("[data-event-type]");
      const actionButton = event.target.closest("[data-action]");
      if (eventButton) addEvent(row.dataset.playerId, eventButton.dataset.eventType);
      if (actionButton?.dataset.action === "history") {
        activeHistoryPlayerId = row.dataset.playerId;
        renderHistory();
        openModal("historyModal");
      }
      if (actionButton?.dataset.action === "delete") deleteAdminEntity(row.dataset.teamId, row.dataset.playerId);
    });

    $("#historyContent").addEventListener("click", (event) => {
      const button = event.target.closest("[data-history-event-id]");
      if (button) removeHistoryEvent(button.dataset.historyEventId);
    });

    $("#importForm").addEventListener("submit", importParticipants);
    $("#importFile").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (file) $("#importText").value = await file.text();
    });
  }

  bindEvents();
  route();
})();
