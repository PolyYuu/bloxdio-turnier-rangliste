(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const POINTS = { kill: 1, deathmatch: 3, win: 2 };
  const MODE_LABELS = { 1: "SOLO", 2: "DUO", 3: "TRIO", 4: "SQUAD" };
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const $ = (selector) => document.querySelector(selector);
  const shell = $("#playShell");
  const statusEl = $("#liveStatus");
  const overlay = $("#roundOverlay");
  const overlayTitle = $("#overlayTitle");
  const overlayRanking = $("#overlayRanking");
  const ratingBlock = $("#myRatingBlock");
  const ratingValue = $("#myRatingValue");

  let tournament = null;
  let teams = [];
  let players = [];
  let events = [];
  let myGlobalPlayerId = null;
  let latestFinalizedRound = 0;
  let initializedFinalizedRound = false;
  let refreshTimer = null;

  function setStatus(text, ok = true) {
    statusEl.textContent = text;
    statusEl.style.color = ok ? "#43e9dc" : "#ff7d92";
    statusEl.style.borderColor = ok ? "rgba(67,233,220,.55)" : "rgba(255,125,146,.55)";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function teamPoints(teamId, throughRound = Infinity) {
    const ids = new Set(players.filter((p) => p.team_id === teamId).map((p) => p.id));
    return events.reduce((sum, event) => {
      if (!ids.has(event.player_id) || event.round > throughRound) return sum;
      return sum + (POINTS[event.type] || 0);
    }, 0);
  }

  function teamLabel(team) {
    const names = players.filter((p) => p.team_id === team.id).map((p) => p.name);
    return names.length ? names.join(" + ") : team.name;
  }

  async function resolveTournament() {
    const requested = new URLSearchParams(location.search).get("tournament");
    let query = db.from("tournaments").select("*");
    if (requested) query = query.eq("id", requested);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    if (!data?.length) throw new Error("Kein Turnier gefunden");

    tournament = requested
      ? data[0]
      : data.find((item) => item.name === "Bloxd.io Turnier – Produktiv")
        || data.find((item) => item.status === "live")
        || data.find((item) => item.status === "draft")
        || data[0];
  }

  async function loadTournamentData() {
    if (!tournament) await resolveTournament();

    const [tRes, teamRes, playerRes, roundRes] = await Promise.all([
      db.from("tournaments").select("*").eq("id", tournament.id).single(),
      db.from("teams").select("*").eq("tournament_id", tournament.id).order("created_at"),
      db.from("players").select("*").eq("tournament_id", tournament.id).order("created_at"),
      db.from("rating_rounds").select("round,finalized_at").eq("tournament_id", tournament.id).order("round", { ascending: false }).limit(1)
    ]);

    if (tRes.error) throw tRes.error;
    if (teamRes.error) throw teamRes.error;
    if (playerRes.error) throw playerRes.error;
    if (roundRes.error) throw roundRes.error;

    tournament = tRes.data;
    teams = teamRes.data || [];
    players = playerRes.data || [];

    if (players.length) {
      const eRes = await db.from("events")
        .select("id,player_id,round,type,points,created_at")
        .in("player_id", players.map((p) => p.id))
        .order("created_at");
      if (eRes.error) throw eRes.error;
      events = eRes.data || [];
    } else {
      events = [];
    }

    $("#modeLabel").textContent = `SURVIVAL GAMES · ${MODE_LABELS[tournament.mode] || ""}`;
    $("#roundLabel").textContent = `RUNDE ${tournament.current_round}`;

    const finalized = roundRes.data?.[0]?.round || 0;
    if (!initializedFinalizedRound) {
      latestFinalizedRound = finalized;
      initializedFinalizedRound = true;
    } else if (finalized > latestFinalizedRound) {
      latestFinalizedRound = finalized;
      await showRoundOverlay(finalized);
    }
  }

  async function loadMyIdentity() {
    try {
      const { data: authData } = await db.auth.getSession();
      if (!authData?.session) return;
      const { data, error } = await db.rpc("my_global_player_id");
      if (!error && data) myGlobalPlayerId = data;
    } catch (_) {}
  }

  async function loadMyRoundResult(round) {
    if (!myGlobalPlayerId || !tournament) return null;
    try {
      const { data, error } = await db.rpc("get_my_competitive_history");
      if (error || !Array.isArray(data)) return null;
      return data.find((row) => row.tournament_id === tournament.id && Number(row.round) === Number(round)) || null;
    } catch (_) {
      return null;
    }
  }

  async function showRoundOverlay(round) {
    const rows = teams
      .map((team) => ({ team, points: teamPoints(team.id, round) }))
      .sort((a, b) => b.points - a.points || teamLabel(a.team).localeCompare(teamLabel(b.team), "de"));

    overlayTitle.textContent = `RUNDE ${round} BEENDET`;
    overlayRanking.innerHTML = rows.slice(0, 6).map((entry, index) => `
      <div class="overlay-row">
        <span class="place">#${index + 1}</span>
        <strong>${escapeHtml(teamLabel(entry.team))}</strong>
        <span class="pts">${entry.points} PTS</span>
      </div>`).join("") || '<div class="overlay-row"><strong>Ergebnis wird geladen…</strong></div>';

    ratingBlock.hidden = true;
    if (myGlobalPlayerId) {
      const [{ data: gp }, roundResult] = await Promise.all([
        db.from("global_players")
          .select("rating,placement_games,is_ranked")
          .eq("id", myGlobalPlayerId)
          .maybeSingle(),
        loadMyRoundResult(round)
      ]);

      if (gp) {
        ratingBlock.hidden = false;
        if (!gp.is_ranked) {
          ratingValue.textContent = `${gp.placement_games}/15 PLACEMENT`;
        } else if (roundResult && roundResult.rating_after !== null && roundResult.final_delta !== null) {
          const after = Math.round(Number(roundResult.rating_after));
          const delta = Math.round(Number(roundResult.final_delta));
          const before = Math.round(after - delta);
          ratingValue.textContent = `${before} → ${after} RP · ${delta >= 0 ? "+" : ""}${delta}`;
        } else {
          ratingValue.textContent = `${Math.round(Number(gp.rating))} RP`;
        }
      }
    }

    overlay.hidden = false;
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        await loadTournamentData();
        setStatus("HUB LIVE · VERBUNDEN", true);
      } catch (error) {
        console.error(error);
        setStatus("HUB LIVE · FEHLER", false);
      }
    }, 250);
  }

  function subscribeRealtime() {
    const channel = db.channel("play-live-v1");
    ["tournaments", "teams", "players", "events", "rating_rounds"].forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    });
    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") setStatus("HUB LIVE · VERBUNDEN", true);
    });
    setInterval(scheduleRefresh, 3000);
  }

  $("#fullscreenButton").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch (error) {
      console.warn("Website fullscreen unavailable", error);
    }
  });

  $("#closeOverlayButton").addEventListener("click", () => { overlay.hidden = true; });

  document.addEventListener("fullscreenchange", () => {
    $("#fullscreenButton").textContent = document.fullscreenElement === shell ? "✕ VOLLBILD" : "⛶ VOLLBILD";
  });

  (async () => {
    try {
      await loadMyIdentity();
      await resolveTournament();
      await loadTournamentData();
      subscribeRealtime();
      setStatus("HUB LIVE · VERBUNDEN", true);
    } catch (error) {
      console.error(error);
      setStatus("HUB LIVE · NICHT VERBUNDEN", false);
    }
  })();
})();
