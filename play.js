(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const POINTS = { kill: 1, deathmatch: 3, win: 2 };
  const MODE_LABELS = { 1: "SOLO", 2: "DUO", 3: "TRIO", 4: "SQUAD" };
  const RANKS = [
    { key:"wood", label:"WOOD", min:0, next:750, symbol:"◇" },
    { key:"iron", label:"IRON", min:750, next:1000, symbol:"⬡" },
    { key:"gold", label:"GOLD", min:1000, next:1250, symbol:"✦" },
    { key:"emerald", label:"EMERALD", min:1250, next:1500, symbol:"◆" },
    { key:"diamond", label:"DIAMOND", min:1500, next:1750, symbol:"◈" },
    { key:"master", label:"MASTER", min:1750, next:2000, symbol:"♛" },
    { key:"grandmaster", label:"GRANDMASTER", min:2000, next:null, symbol:"✹" }
  ];

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (selector, root = document) => root.querySelector(selector);

  const gameStage = $("#gameStage");
  const sideEyebrow = $("#sideEyebrow");
  const sideTitle = $("#sideTitle");
  const sideMeta = $("#sideMeta");
  const sideContent = $("#sidePanelContent");
  const overlay = $("#roundOverlay");
  const overlayTitle = $("#overlayTitle");
  const overlaySubtitle = $("#overlaySubtitle");
  const overlayRoundChip = $("#overlayRoundChip");
  const overlayRanking = $("#overlayRanking");
  const ratingBlock = $("#myRatingBlock");
  const ratingValue = $("#myRatingValue");
  const teamDetailModal = $("#teamDetailModal");

  let tournament = null;
  let teams = [];
  let players = [];
  let events = [];
  let globalPlayers = new Map();
  let myGlobalPlayerId = null;
  let myGlobalPlayer = null;
  let myTeamId = null;
  let latestFinalizedRound = 0;
  let initializedFinalizedRound = false;
  let refreshTimer = 0;
  let refreshing = false;
  let fullscreenGuardBusy = false;

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
    })[c]);
  }

  function hashString(value) {
    let h = 2166136261;
    for (const ch of String(value || "")) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function defaultAvatarPixels(name) {
    const seed = hashString(name);
    const skins = ["#f3c39c","#e6ad7d","#cf8f62","#a96b45","#75462f","#4b2d22"];
    const hairs = ["#1f1615","#352119","#57331f","#7c4b25","#b87333","#1d2330","#4a2a4e"];
    const shirts = ["#22d3c5","#6d55e8","#d54e7d","#3da6f0","#57b85c","#e6b938"];
    const skin = skins[seed % skins.length];
    const hair = hairs[(seed >>> 3) % hairs.length];
    const shirt = shirts[(seed >>> 6) % shirts.length];
    const eye = (seed & 1) ? "#244d68" : "#3b271e";
    const out = Array(256).fill("#FFFFFF");
    const set = (x,y,c) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) out[y*16+x] = c; };
    const fill = (x1,y1,x2,y2,c) => {
      for (let y=y1;y<=y2;y++) for (let x=x1;x<=x2;x++) set(x,y,c);
    };
    fill(2,1,13,13,skin); fill(1,5,2,10,skin); fill(13,5,14,10,skin);
    fill(2,1,13,4,hair); fill(2,4,4,6,hair); fill(11,4,13,6,hair);
    const fringe = (seed >>> 9) % 3;
    if (fringe === 0) fill(5,4,7,5,hair);
    else if (fringe === 1) fill(8,4,10,5,hair);
    else fill(6,4,9,4,hair);
    fill(4,7,6,8,"#FFFFFF"); fill(9,7,11,8,"#FFFFFF");
    set(5,8,eye); set(10,8,eye); set(7,9,"#b97555"); set(8,9,"#b97555");
    fill(6,11,9,11,"#6f3e3e");
    fill(3,14,12,15,shirt); fill(1,15,14,15,shirt);
    set(7,14,"#ece8ff"); set(8,14,"#ece8ff");
    return out;
  }

  function pixelAvatarDataUrl(pixels) {
    if (!Array.isArray(pixels) || pixels.length !== 256) return "";
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d");
      const image = ctx.createImageData(16,16);
      pixels.forEach((color, i) => {
        const hex = String(color || "#FFFFFF").replace("#", "");
        const good = /^[0-9a-f]{6}$/i.test(hex) ? hex : "FFFFFF";
        image.data[i*4] = parseInt(good.slice(0,2),16);
        image.data[i*4+1] = parseInt(good.slice(2,4),16);
        image.data[i*4+2] = parseInt(good.slice(4,6),16);
        image.data[i*4+3] = 255;
      });
      ctx.putImageData(image,0,0);
      return canvas.toDataURL("image/png");
    } catch (_) {
      return "";
    }
  }

  function playerGlobalProfile(player) {
    return player?.global_player_id ? globalPlayers.get(player.global_player_id) : null;
  }

  function avatarSrcForPlayer(player) {
    const gp = playerGlobalProfile(player);
    const name = gp?.current_name || player?.name || "?";
    return pixelAvatarDataUrl(gp?.avatar_pixels) || pixelAvatarDataUrl(defaultAvatarPixels(name));
  }

  function avatarSrcForGlobalPlayer(player) {
    const name = player?.current_name || "?";
    return pixelAvatarDataUrl(player?.avatar_pixels) || pixelAvatarDataUrl(defaultAvatarPixels(name));
  }

  function avatarMarkup(player, className = "pixel-avatar") {
    return `<img class="${className}" src="${avatarSrcForPlayer(player)}" alt="Profilbild von ${esc(player?.name || "")}">`;
  }

  function teamMembers(teamId) {
    return players.filter(player => player.team_id === teamId);
  }

  function teamName(team) {
    const names = teamMembers(team.id).map(player => player.name);
    return names.length ? names.join(" + ") : (team.name || "TEAM");
  }

  function statsForPlayer(player, throughRound = Infinity) {
    const ownEvents = events.filter(event =>
      event.player_id === player.id && Number(event.round) <= Number(throughRound)
    );
    let k = 0, dm = 0, w = 0;
    for (const event of ownEvents) {
      if (event.type === "kill") k++;
      if (event.type === "deathmatch") dm++;
      if (event.type === "win") w++;
    }
    return { k, dm, w, points:k + dm*POINTS.deathmatch + w*POINTS.win };
  }

  function roundStatsForPlayer(player, round) {
    const now = statsForPlayer(player, round);
    const prev = statsForPlayer(player, Number(round)-1);
    return {
      k:now.k-prev.k,
      dm:now.dm-prev.dm,
      w:now.w-prev.w,
      points:now.points-prev.points
    };
  }

  function cupDeaths(player) {
    const stats = statsForPlayer(player);
    return Math.max(0, Number(tournament?.current_round || 0) - stats.w);
  }

  function teamPoints(teamId, throughRound = Infinity) {
    return teamMembers(teamId).reduce((sum, player) => sum + statsForPlayer(player, throughRound).points, 0);
  }

  function standings(throughRound = Infinity) {
    const base = teams
      .map(team => ({ team, points:teamPoints(team.id, throughRound) }))
      .sort((a,b) => b.points-a.points || teamName(a.team).localeCompare(teamName(b.team),"de"));
    let previousPoints = null;
    let rank = 0;
    return base.map((row,index) => {
      if (index === 0 || row.points !== previousPoints) rank = index + 1;
      previousPoints = row.points;
      return { ...row, rank };
    });
  }

  function playerChip(player) {
    return `<div class="cup-player">${avatarMarkup(player)}<span class="cup-player-name">${esc(player.name)}</span></div>`;
  }

  function renderCupSide() {
    const rows = standings(Number(tournament.current_round || 0));
    const mine = rows.find(row => row.team.id === myTeamId);
    sideEyebrow.textContent = "HUB · LIVE CUP";
    sideTitle.textContent = tournament.name || "LIVE CUP";
    sideMeta.textContent = mine
      ? `Dein Team · Platz ${mine.rank} von ${rows.length} · Runde ${tournament.current_round}`
      : `${rows.length} Teams · Runde ${tournament.current_round}`;

    sideContent.innerHTML = `<div class="cup-neighborhood cup-all-teams">${rows.map(row => {
      const members = teamMembers(row.team.id);
      return `<button type="button" class="cup-row ${row.team.id===myTeamId ? "is-mine" : ""}" data-cup-team="${esc(row.team.id)}" aria-label="Team ${esc(teamName(row.team))} öffnen">
        <div class="cup-place">#${row.rank}</div>
        <div class="cup-team">${members.map((player,index) => `${index ? '<span class="cup-plus">+</span>' : ""}${playerChip(player)}`).join("")}</div>
        <div class="cup-points"><strong>${row.points}</strong><span>PTS</span></div>
      </button>`;
    }).join("")}</div>`;
  }

  function rankInfo(rating) {
    const value = Number(rating || 0);
    return RANKS.slice().reverse().find(rank => value >= rank.min) || RANKS[0];
  }

  function renderRankSide(reason = "no-live-cup") {
    sideEyebrow.textContent = "COMPETITIVE";
    sideTitle.textContent = "DEIN PROFIL";
    if (!myGlobalPlayerId || !myGlobalPlayer) {
      sideMeta.textContent = "";
      sideContent.innerHTML = `<div class="side-empty">Dein Profil konnte gerade nicht geladen werden.</div>`;
      return;
    }

    sideMeta.textContent = reason === "not-participant" && tournament
      ? `${tournament.name} läuft · Du bist kein Teilnehmer`
      : "Aktueller Competitive-Stand";

    const avatar = avatarSrcForGlobalPlayer(myGlobalPlayer);
    const name = esc(myGlobalPlayer.current_name || "HUB PLAYER");

    if (!myGlobalPlayer.is_ranked) {
      const games = Number(myGlobalPlayer.placement_games || 0);
      const progress = Math.min(100, Math.round(games/15*100));
      sideContent.innerHTML = `<div class="profile-mini">
        <img class="profile-mini-avatar" src="${avatar}" alt="Dein Profilbild">
        <h3 class="profile-mini-name">${name}</h3>
        <div class="rank-orbit"><div class="rank-gem">○</div></div>
        <span class="rank-kicker">CURRENT RANK</span>
        <h3>UNRANKED</h3>
        <div class="rank-rating">${games}<small> / 15</small></div>
        <div class="rank-progress-wrap">
          <div class="rank-progress-label"><span>PLACEMENTS</span><span>${progress}%</span></div>
          <div class="rank-progress"><i style="width:${progress}%"></i></div>
        </div>
        <p class="rank-note">Nach <b>15 Competitive-Runden</b> erhältst du deinen ersten Rang.</p>
      </div>`;
      return;
    }

    const rating = Math.round(Number(myGlobalPlayer.rating || 0));
    const rank = rankInfo(rating);
    const progress = rank.next ? Math.max(0,Math.min(100,(rating-rank.min)/(rank.next-rank.min)*100)) : 100;
    sideContent.innerHTML = `<div class="profile-mini">
      <img class="profile-mini-avatar" src="${avatar}" alt="Dein Profilbild">
      <h3 class="profile-mini-name">${name}</h3>
      <div class="rank-orbit"><div class="rank-gem">${rank.symbol}</div></div>
      <span class="rank-kicker">CURRENT RANK</span>
      <h3>${rank.label}</h3>
      <div class="rank-rating">${rating}<small> RP</small></div>
      <div class="rank-progress-wrap">
        <div class="rank-progress-label"><span>${rank.next ? "PROGRESS TO NEXT RANK" : "TOP RANK"}</span><span>${Math.round(progress)}%</span></div>
        <div class="rank-progress"><i style="width:${progress}%"></i></div>
      </div>
      <p class="rank-note">Peak Rating: <b>${Math.round(Number(myGlobalPlayer.peak_rating || rating))} RP</b></p>
    </div>`;
  }

  function openTeamProfile(teamId) {
    const team = teams.find(item => String(item.id) === String(teamId));
    if (!team || !tournament || !teamDetailModal) return;
    const members = teamMembers(team.id);
    if (!members.length) return;

    const stats = members.map(player => statsForPlayer(player));
    const total = stats.reduce((sum,item) => sum + item.points, 0);
    const kills = stats.reduce((sum,item) => sum + item.k, 0);
    const dm = stats.reduce((sum,item) => sum + item.dm, 0);
    const wins = stats.reduce((sum,item) => sum + item.w, 0);

    $("#teamDetailTitle").textContent = members.map(player => player.name).join(" + ");
    $("#teamDetailSummary").innerHTML = [
      ["Team points", total],
      ["Kills", kills],
      ["Deathmatches", dm],
      ["Wins", wins]
    ].map(([label,value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");

    $("#teamPlayerCards").innerHTML = members.map((player,index) => {
      const stat = stats[index];
      return `<article>
        <h3><button type="button" data-play-profile-player="${esc(player.name)}">${esc(player.name)} ↗</button></h3>
        <div class="player-mini-stats">
          <div><span>Points</span><b>${stat.points}</b></div>
          <div><span>Kills</span><b>${stat.k}</b></div>
          <div><span>DM</span><b>${stat.dm}</b></div>
          <div><span>Wins</span><b>${stat.w}</b></div>
          <div><span>Deaths</span><b>${cupDeaths(player)}</b></div>
        </div>
      </article>`;
    }).join("");

    const roundTable = $("#teamRoundTable");
    if (members.length >= 2) {
      const a = members[0], b = members[1];
      const head = `<div class="team-round-row head"><span>Round</span><span>${esc(a.name)}</span><span>PTS</span><span>K</span><span>DM</span><span>W</span><span>${esc(b.name)}</span><span>PTS</span><span>K</span><span>DM</span><span>W</span></div>`;
      const rows = Array.from({length:Number(tournament.current_round || 0)}, (_,i) => i+1).map(round => {
        const sa = roundStatsForPlayer(a, round);
        const sb = roundStatsForPlayer(b, round);
        const winner = sa.w || sb.w;
        return `<div class="team-round-row">
          <strong class="${winner ? "winner" : ""}">${round}</strong>
          <strong>${esc(a.name)}</strong><span class="round-total">${sa.points}</span><span>${sa.k}</span><span>${sa.dm}</span><span>${sa.w}</span>
          <strong>${esc(b.name)}</strong><span class="round-total">${sb.points}</span><span>${sb.k}</span><span>${sb.dm}</span><span>${sb.w}</span>
        </div>`;
      }).join("");
      roundTable.innerHTML = `<div class="team-round-table">${head}${rows}</div>`;
    } else {
      roundTable.innerHTML = `<div class="side-empty">Für dieses Team ist keine Duo-Rundenansicht verfügbar.</div>`;
    }

    teamDetailModal.hidden = false;
  }

  function closeTeamProfile() {
    if (teamDetailModal) teamDetailModal.hidden = true;
  }

  async function loadIdentity() {
    myGlobalPlayerId = null;
    myGlobalPlayer = null;
    try {
      const {data:{session}} = await db.auth.getSession();
      if (!session) return false;
      const {data,error} = await db.rpc("my_global_player_id");
      if (!error && data) myGlobalPlayerId = data;
      if (!myGlobalPlayerId) return false;
      const res = await db.from("global_players")
        .select("id,current_name,rating,placement_games,is_ranked,peak_rating,avatar_pixels")
        .eq("id",myGlobalPlayerId)
        .maybeSingle();
      if (!res.error) myGlobalPlayer = res.data || null;
      return !!myGlobalPlayerId;
    } catch (_) {
      return false;
    }
  }

  async function ensurePlayAccess() {
    try {
      const {data:{session}} = await db.auth.getSession();
      if (!session) {
        location.replace("index.html#overview");
        return false;
      }
      const {data,error} = await db.rpc("my_global_player_id");
      if (error || !data) {
        location.replace("index.html#pending");
        return false;
      }
      myGlobalPlayerId = data;
      return true;
    } catch (_) {
      location.replace("index.html#overview");
      return false;
    }
  }

  async function resolveLiveTournament() {
    const requested = new URLSearchParams(location.search).get("tournament");
    const {data,error} = await db.from("tournaments").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    const requestedCup = requested ? (data || []).find(item => item.id === requested) : null;
    tournament = requestedCup?.status === "live"
      ? requestedCup
      : (data || []).find(item => item.status === "live") || null;
  }

  async function clearCupData() {
    teams = [];
    players = [];
    events = [];
    globalPlayers = new Map();
    myTeamId = null;
    $("#modeLabel").textContent = "SURVIVAL GAMES";
    $("#roundLabel").textContent = "KEIN CUP LIVE";
    renderRankSide("no-live-cup");
  }

  async function loadLiveCupData() {
    await resolveLiveTournament();
    if (!tournament) {
      await clearCupData();
      return;
    }

    const [tRes,teamRes,playerRes,roundRes] = await Promise.all([
      db.from("tournaments").select("*").eq("id",tournament.id).single(),
      db.from("teams").select("*").eq("tournament_id",tournament.id).order("created_at"),
      db.from("players").select("*").eq("tournament_id",tournament.id).order("created_at"),
      db.from("rating_rounds").select("round,finalized_at").eq("tournament_id",tournament.id).not("finalized_at","is",null).order("round",{ascending:false}).limit(1)
    ]);
    if (tRes.error) throw tRes.error;
    if (teamRes.error) throw teamRes.error;
    if (playerRes.error) throw playerRes.error;
    if (roundRes.error) throw roundRes.error;

    tournament = tRes.data;
    teams = teamRes.data || [];
    players = playerRes.data || [];

    if (players.length) {
      const eventRes = await db.from("events")
        .select("id,player_id,round,type,points,created_at")
        .in("player_id", players.map(player => player.id))
        .order("created_at");
      if (eventRes.error) throw eventRes.error;
      events = eventRes.data || [];
    } else {
      events = [];
    }

    const gpIds = [...new Set(players.map(player => player.global_player_id).filter(Boolean))];
    globalPlayers = new Map();
    if (gpIds.length) {
      const gpRes = await db.from("global_players")
        .select("id,current_name,avatar_pixels,rating,placement_games,is_ranked,peak_rating")
        .in("id", gpIds);
      if (!gpRes.error) (gpRes.data || []).forEach(player => globalPlayers.set(player.id,player));
    }

    if (myGlobalPlayerId && globalPlayers.has(myGlobalPlayerId)) {
      myGlobalPlayer = globalPlayers.get(myGlobalPlayerId);
    }
    myTeamId = players.find(player => player.global_player_id === myGlobalPlayerId)?.team_id || null;

    $("#modeLabel").textContent = `SURVIVAL GAMES · ${MODE_LABELS[tournament.mode] || ""}`;
    $("#roundLabel").textContent = `RUNDE ${tournament.current_round}`;

    if (myTeamId) renderCupSide();
    else renderRankSide("not-participant");

    const finalized = Number(roundRes.data?.[0]?.round || 0);
    if (!initializedFinalizedRound) {
      latestFinalizedRound = finalized;
      initializedFinalizedRound = true;
    } else if (finalized > latestFinalizedRound) {
      latestFinalizedRound = finalized;
      if (myTeamId && tournament.status === "live") await showRoundOverlay(finalized);
    }
  }

  async function loadMyRoundResult(round) {
    if (!myGlobalPlayerId || !tournament) return null;
    try {
      const {data,error} = await db.rpc("get_my_competitive_history");
      if (error || !Array.isArray(data)) return null;
      return data.find(row =>
        row.tournament_id === tournament.id && Number(row.round) === Number(round)
      ) || null;
    } catch (_) {
      return null;
    }
  }

  async function showRoundOverlay(round) {
    overlayTitle.textContent = `RUNDE ${round} BEENDET`;
    overlayRoundChip.textContent = `RUNDE ${round}`;
    overlaySubtitle.textContent = "So hat sich der Cup nach dieser Runde verändert.";

    // There is intentionally no ranking renderer or animation here.
    // play-round-overlay-upgrade.js is the single owner of the Cup-style
    // seven-team ranking, avatars and 0.75s + 3.75s movement animation.
    overlayRanking.innerHTML = "";

    ratingBlock.hidden = true;
    const roundResult = await loadMyRoundResult(round);
    if (myGlobalPlayer) {
      ratingBlock.hidden = false;
      if (!myGlobalPlayer.is_ranked) {
        ratingValue.textContent = `${Number(myGlobalPlayer.placement_games || 0)}/15 PLACEMENT`;
      } else if (roundResult && roundResult.rating_after != null && roundResult.final_delta != null) {
        const after = Math.round(Number(roundResult.rating_after));
        const delta = Math.round(Number(roundResult.final_delta));
        ratingValue.textContent = `${after-delta} → ${after} RP · ${delta>=0 ? "+" : ""}${delta}`;
      } else {
        ratingValue.textContent = `${Math.round(Number(myGlobalPlayer.rating || 0))} RP`;
      }
    }

    overlay.hidden = false;
    window.dispatchEvent(new CustomEvent("hub:round-overlay-open", {detail:{round}}));
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const hasIdentity = await loadIdentity();
      if (!hasIdentity) return;
      await loadLiveCupData();
    } catch (error) {
      console.error("Play live refresh failed", error);
      renderRankSide(tournament ? "not-participant" : "no-live-cup");
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh,220);
  }

  function subscribeRealtime() {
    const channel = db.channel("hub-play-live-v4");
    ["tournaments","teams","players","events","rating_rounds","global_players"].forEach(table => {
      channel.on("postgres_changes",{event:"*",schema:"public",table},scheduleRefresh);
    });
    channel.subscribe();
    setInterval(scheduleRefresh,3500);
  }

  $("#fullscreenButton")?.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === gameStage) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      await gameStage.requestFullscreen();
    } catch (error) {
      console.warn("Play fullscreen unavailable",error);
    }
  });

  $("#closeOverlayButton")?.addEventListener("click", () => {
    overlay.hidden = true;
  });

  sideContent?.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest("[data-cup-team]") : null;
    if (button && myTeamId) openTeamProfile(button.dataset.cupTeam);
  });

  teamDetailModal?.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === teamDetailModal || target?.closest('[data-close-modal="teamDetailModal"]')) {
      closeTeamProfile();
      return;
    }
    const player = target?.closest("[data-play-profile-player]");
    if (player) {
      sessionStorage.setItem("hub_play_profile_target", player.dataset.playProfilePlayer || "");
      location.href = "index.html#profile";
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && teamDetailModal && !teamDetailModal.hidden) closeTeamProfile();
  });

  document.addEventListener("fullscreenchange", async () => {
    if (fullscreenGuardBusy) return;
    const current = document.fullscreenElement;
    const button = $("#fullscreenButton");

    if (!current) {
      if (button) button.textContent = "⛶ VOLLBILD";
      return;
    }

    if (current === gameStage) {
      if (button) button.textContent = "✕ VOLLBILD";
      return;
    }

    fullscreenGuardBusy = true;
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.warn("Foreign fullscreen could not be closed",error);
    } finally {
      fullscreenGuardBusy = false;
    }
  });

  (async () => {
    const allowed = await ensurePlayAccess();
    if (!allowed) return;
    await refresh();
    subscribeRealtime();
  })();
})();
