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
  const $ = (s, root = document) => root.querySelector(s);

  const gameStage = $("#gameStage");
  const statusEl = $("#liveStatus");
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

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
  }

  function setStatus(text, ok = true) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = ok ? "#43e9dc" : "#ff7d92";
    statusEl.style.borderColor = ok ? "rgba(67,233,220,.55)" : "rgba(255,125,146,.55)";
  }

  function pixelAvatarDataUrl(pixels) {
    if (!Array.isArray(pixels) || pixels.length !== 256) return "";
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16; canvas.height = 16;
      const ctx = canvas.getContext("2d");
      const image = ctx.createImageData(16,16);
      pixels.forEach((color, i) => {
        const hex = String(color || "#1a1230").replace("#", "");
        const good = /^[0-9a-f]{6}$/i.test(hex) ? hex : "1a1230";
        image.data[i*4] = parseInt(good.slice(0,2),16);
        image.data[i*4+1] = parseInt(good.slice(2,4),16);
        image.data[i*4+2] = parseInt(good.slice(4,6),16);
        image.data[i*4+3] = 255;
      });
      ctx.putImageData(image,0,0);
      return canvas.toDataURL("image/png");
    } catch (_) { return ""; }
  }

  function teamMembers(teamId) {
    return players.filter(p => p.team_id === teamId);
  }

  function teamName(team) {
    const names = teamMembers(team.id).map(p => p.name);
    return names.length ? names.join(" + ") : (team.name || "TEAM");
  }

  function eventPoints(event) {
    const raw = Number(event?.points);
    if (Number.isFinite(raw)) return raw;
    return POINTS[event?.type] || 0;
  }

  function teamPoints(teamId, throughRound = Infinity) {
    const ids = new Set(teamMembers(teamId).map(p => p.id));
    return events.reduce((sum,e) => ids.has(e.player_id) && Number(e.round) <= throughRound ? sum + eventPoints(e) : sum, 0);
  }

  function standings(throughRound = Infinity) {
    return teams.map(team => ({team, points:teamPoints(team.id, throughRound)}))
      .sort((a,b) => b.points-a.points || teamName(a.team).localeCompare(teamName(b.team),"de"))
      .map((row,index) => ({...row, rank:index+1}));
  }

  function nearestFive(rows, teamId) {
    if (!rows.length) return [];
    if (!teamId) return rows.slice(0,5);
    const index = rows.findIndex(r => r.team.id === teamId);
    if (index < 0) return rows.slice(0,5);
    const size = Math.min(5, rows.length);
    const start = Math.max(0, Math.min(index - 2, rows.length - size));
    return rows.slice(start,start+size);
  }

  function playerChip(player) {
    const gp = player.global_player_id ? globalPlayers.get(player.global_player_id) : null;
    const avatar = pixelAvatarDataUrl(gp?.avatar_pixels);
    return `<div class="cup-player">${avatar ? `<img class="pixel-avatar" src="${avatar}" alt="">` : `<span class="pixel-avatar"></span>`}<span class="cup-player-name">${esc(player.name)}</span></div>`;
  }

  function renderCupSide() {
    const rows = standings(Number(tournament.current_round || 0));
    const visible = nearestFive(rows,myTeamId);
    sideEyebrow.textContent = "HUB · LIVE CUP";
    sideTitle.textContent = tournament.name || "LIVE CUP";
    const mine = rows.find(r => r.team.id === myTeamId);
    sideMeta.textContent = mine ? `Dein Team · Platz ${mine.rank} von ${rows.length} · Runde ${tournament.current_round}` : `Top ${Math.min(5,rows.length)} · Runde ${tournament.current_round}`;
    sideContent.innerHTML = `<div class="cup-neighborhood">${visible.map(row => {
      const members = teamMembers(row.team.id);
      return `<div class="cup-row ${row.team.id===myTeamId?'is-mine':''}">
        <div class="cup-place">#${row.rank}</div>
        <div class="cup-team">${members.map((p,i)=>`${i?'<span class="cup-plus">+</span>':''}${playerChip(p)}`).join('')}</div>
        <div class="cup-points"><strong>${row.points}</strong><span>PTS</span></div>
      </div>`;
    }).join("")}</div>`;
  }

  function rankInfo(rating) {
    const value = Number(rating || 0);
    return RANKS.slice().reverse().find(r => value >= r.min) || RANKS[0];
  }

  function renderRankSide() {
    sideEyebrow.textContent = "COMPETITIVE";
    sideTitle.textContent = "DEIN RANG";
    if (!myGlobalPlayerId || !myGlobalPlayer) {
      sideMeta.textContent = "Kein Cup live";
      sideContent.innerHTML = `<div class="side-empty">${myGlobalPlayerId ? 'Dein Rang konnte gerade nicht geladen werden.' : 'Melde dich mit einem verifizierten HUB-Account an, um hier deinen Competitive-Rang zu sehen.'}</div>`;
      return;
    }
    if (!myGlobalPlayer.is_ranked) {
      const games = Number(myGlobalPlayer.placement_games || 0);
      sideMeta.textContent = "Kein Cup live";
      sideContent.innerHTML = `<div class="rank-card"><div class="rank-orbit"><div class="rank-gem">○</div></div><span class="rank-kicker">CURRENT RANK</span><h3>UNRANKED</h3><div class="rank-rating">${games}<small> / 15</small></div><div class="rank-progress-wrap"><div class="rank-progress-label"><span>PLACEMENTS</span><span>${Math.min(100,Math.round(games/15*100))}%</span></div><div class="rank-progress"><i style="width:${Math.min(100,games/15*100)}%"></i></div></div><p class="rank-note">Nach <b>15 Competitive-Runden</b> erhältst du deinen ersten Rang.</p></div>`;
      return;
    }
    const rating = Math.round(Number(myGlobalPlayer.rating || 0));
    const rank = rankInfo(rating);
    const progress = rank.next ? Math.max(0,Math.min(100,(rating-rank.min)/(rank.next-rank.min)*100)) : 100;
    sideMeta.textContent = "Kein Cup live · Competitive Rating";
    sideContent.innerHTML = `<div class="rank-card"><div class="rank-orbit"><div class="rank-gem">${rank.symbol}</div></div><span class="rank-kicker">CURRENT RANK</span><h3>${rank.label}</h3><div class="rank-rating">${rating}<small> RP</small></div><div class="rank-progress-wrap"><div class="rank-progress-label"><span>${rank.next?'PROGRESS TO NEXT RANK':'TOP RANK'}</span><span>${Math.round(progress)}%</span></div><div class="rank-progress"><i style="width:${progress}%"></i></div></div><p class="rank-note">Peak Rating: <b>${Math.round(Number(myGlobalPlayer.peak_rating || rating))} RP</b></p></div>`;
  }

  async function loadIdentity() {
    myGlobalPlayerId = null; myGlobalPlayer = null;
    try {
      const {data:{session}} = await db.auth.getSession();
      if (!session) return;
      const {data,error} = await db.rpc("my_global_player_id");
      if (!error && data) myGlobalPlayerId = data;
      if (myGlobalPlayerId) {
        const res = await db.from("global_players").select("id,current_name,rating,placement_games,is_ranked,peak_rating,avatar_pixels").eq("id",myGlobalPlayerId).maybeSingle();
        if (!res.error) myGlobalPlayer = res.data || null;
      }
    } catch (_) {}
  }

  async function resolveLiveTournament() {
    const requested = new URLSearchParams(location.search).get("tournament");
    const {data,error} = await db.from("tournaments").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    const requestedCup = requested ? (data||[]).find(t => t.id === requested) : null;
    tournament = requestedCup?.status === "live" ? requestedCup : (data||[]).find(t => t.status === "live") || null;
  }

  async function clearCupData() {
    teams=[]; players=[]; events=[]; globalPlayers=new Map(); myTeamId=null;
    $("#modeLabel").textContent = "SURVIVAL GAMES";
    $("#roundLabel").textContent = "KEIN CUP LIVE";
    renderRankSide();
  }

  async function loadLiveCupData() {
    await resolveLiveTournament();
    if (!tournament) { await clearCupData(); return; }

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
    tournament=tRes.data; teams=teamRes.data||[]; players=playerRes.data||[];

    if (players.length) {
      const eventRes = await db.from("events").select("id,player_id,round,type,points,created_at").in("player_id",players.map(p=>p.id)).order("created_at");
      if (eventRes.error) throw eventRes.error;
      events=eventRes.data||[];
    } else events=[];

    const gpIds=[...new Set(players.map(p=>p.global_player_id).filter(Boolean))];
    globalPlayers=new Map();
    if (gpIds.length) {
      const gpRes=await db.from("global_players").select("id,current_name,avatar_pixels,rating,placement_games,is_ranked,peak_rating").in("id",gpIds);
      if (!gpRes.error) (gpRes.data||[]).forEach(gp=>globalPlayers.set(gp.id,gp));
    }
    if (myGlobalPlayerId && globalPlayers.has(myGlobalPlayerId)) myGlobalPlayer=globalPlayers.get(myGlobalPlayerId);
    myTeamId=players.find(p=>p.global_player_id===myGlobalPlayerId)?.team_id || null;

    $("#modeLabel").textContent=`SURVIVAL GAMES · ${MODE_LABELS[tournament.mode]||""}`;
    $("#roundLabel").textContent=`RUNDE ${tournament.current_round}`;
    renderCupSide();

    const finalized=Number(roundRes.data?.[0]?.round||0);
    if (!initializedFinalizedRound) { latestFinalizedRound=finalized; initializedFinalizedRound=true; }
    else if (finalized>latestFinalizedRound) {
      latestFinalizedRound=finalized;
      if (myTeamId && tournament.status==="live") await showRoundOverlay(finalized);
    }
  }

  async function loadMyRoundResult(round) {
    if (!myGlobalPlayerId || !tournament) return null;
    try {
      const {data,error}=await db.rpc("get_my_competitive_history");
      if (error || !Array.isArray(data)) return null;
      return data.find(r=>r.tournament_id===tournament.id && Number(r.round)===Number(round))||null;
    } catch (_) { return null; }
  }

  function overlayRowsForRound(round) {
    const before=standings(Math.max(0,round-1));
    const after=standings(round);
    const visible=nearestFive(after,myTeamId);
    const beforeMap=new Map(before.map(r=>[r.team.id,r]));
    return visible.map(row=>({after:row,before:beforeMap.get(row.team.id)||row,delta:teamPoints(row.team.id,round)-teamPoints(row.team.id,Math.max(0,round-1))}));
  }

  async function showRoundOverlay(round) {
    const rows=overlayRowsForRound(round);
    overlayTitle.textContent=`RUNDE ${round} BEENDET`;
    overlayRoundChip.textContent=`RUNDE ${round}`;
    overlaySubtitle.textContent="So hat sich der Cup nach dieser Runde verändert.";
    overlayRanking.innerHTML=rows.map(({after,before,delta})=>{
      const movement=before.rank-after.rank;
      const cls=movement>0?'up':movement<0?'down':'same';
      const text=movement>0?`▲ ${before.rank} → ${after.rank}`:movement<0?`▼ ${before.rank} → ${after.rank}`:`• #${after.rank}`;
      const translate=(after.rank-before.rank)*66;
      return `<div class="overlay-row ${after.team.id===myTeamId?'is-mine':''}" data-overlay-team="${after.team.id}" style="transform:translateY(${translate}px);opacity:.72"><span class="place">#${after.rank}</span><div class="overlay-team"><strong>${esc(teamName(after.team))}</strong><small>${teamMembers(after.team.id).map(p=>esc(p.name)).join(' + ')}</small></div><span class="overlay-move ${cls}">${text}</span><div class="overlay-points"><strong>${after.points} PTS</strong><small>${delta>=0?'+':''}${delta} DIESE RUNDE</small></div></div>`;
    }).join("") || `<div class="side-empty">Ergebnis wird geladen…</div>`;

    ratingBlock.hidden=true;
    const roundResult=await loadMyRoundResult(round);
    if (myGlobalPlayer) {
      ratingBlock.hidden=false;
      if (!myGlobalPlayer.is_ranked) ratingValue.textContent=`${Number(myGlobalPlayer.placement_games||0)}/15 PLACEMENT`;
      else if (roundResult && roundResult.rating_after!=null && roundResult.final_delta!=null) {
        const after=Math.round(Number(roundResult.rating_after)), delta=Math.round(Number(roundResult.final_delta));
        ratingValue.textContent=`${after-delta} → ${after} RP · ${delta>=0?'+':''}${delta}`;
      } else ratingValue.textContent=`${Math.round(Number(myGlobalPlayer.rating||0))} RP`;
    }

    overlay.hidden=false;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      overlayRanking.querySelectorAll('.overlay-row').forEach((row,i)=>{
        row.style.transitionDelay=`${i*55}ms`;
        row.style.transform='translateY(0)';
        row.style.opacity='1';
      });
    }));
  }

  async function refresh() {
    if (refreshing) return;
    refreshing=true;
    try {
      await loadIdentity();
      await loadLiveCupData();
      setStatus("HUB LIVE · VERBUNDEN",true);
    } catch (error) {
      console.error("Play live refresh failed",error);
      setStatus("HUB LIVE · FEHLER",false);
      if (!tournament) renderRankSide();
    } finally { refreshing=false; }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(refresh,220);
  }

  function subscribeRealtime() {
    const channel=db.channel("hub-play-live-v2");
    ["tournaments","teams","players","events","rating_rounds","global_players"].forEach(table=>{
      channel.on("postgres_changes",{event:"*",schema:"public",table},scheduleRefresh);
    });
    channel.subscribe(state=>{ if(state==="SUBSCRIBED") setStatus("HUB LIVE · VERBUNDEN",true); });
    setInterval(scheduleRefresh,3500);
  }

  $("#fullscreenButton")?.addEventListener("click",async()=>{
    try {
      if (document.fullscreenElement===gameStage) await document.exitFullscreen();
      else await gameStage.requestFullscreen();
    } catch(error) { console.warn("Play fullscreen unavailable",error); }
  });
  $("#closeOverlayButton")?.addEventListener("click",()=>{ overlay.hidden=true; });
  document.addEventListener("fullscreenchange",()=>{
    const button=$("#fullscreenButton");
    if(button) button.textContent=document.fullscreenElement===gameStage?"✕ VOLLBILD":"⛶ VOLLBILD";
  });

  (async()=>{
    setStatus("VERBINDE MIT HUB…",true);
    await refresh();
    subscribeRealtime();
  })();
})();
