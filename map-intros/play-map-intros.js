(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const CHANNEL_NAME = "hub-map-intros-v1";
  const EVENT_NAME = "map_intro";
  const CSS_SRC = "map-intros/map-intros.css?v=20260916b";
  const MAPS = {
    SG7: {
      key: "SG7",
      title: "SG7",
      kicker: "SURVIVAL GAMES MAP",
      durationMs: 9888,
      image: "map-intros/assets/sg7.webp?v=20260916a",
      audio: "map-intros/assets/sg7-intro.mp3?v=20260916a"
    }
  };

  if (!window.supabase?.createClient) {
    console.error("[HUB Map Intros] Supabase client missing.");
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const handledNonces = new Set();
  let overlay = null;
  let audio = null;
  let closeTimer = 0;
  let fadeTimer = 0;
  let active = false;
  let logoDataUri = "";

  function installCss() {
    if (document.querySelector('link[data-hub-map-intro-css]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_SRC;
    link.dataset.hubMapIntroCss = "1";
    document.head.appendChild(link);
  }

  async function ensureLogo() {
    if (logoDataUri) return logoDataUri;
    try {
      const response = await fetch("index.html", { cache: "force-cache" });
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const candidates = [
        doc.querySelector("img.hub-logo")?.getAttribute("src"),
        doc.querySelector("#hub-favicon")?.getAttribute("href")
      ];
      logoDataUri = candidates.find(value => typeof value === "string" && value.startsWith("data:image/png;base64,")) || "";
    } catch (_) {}
    return logoDataUri;
  }

  function buildOverlay() {
    if (overlay) return overlay;
    const gameStage = document.getElementById("gameStage");
    if (!gameStage) return null;

    overlay = document.createElement("section");
    overlay.id = "hubMapIntroOverlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="hub-map-intro-image"></div>
      <div class="hub-map-intro-vignette"></div>
      <div class="hub-map-intro-footer">
        <div class="hub-map-intro-text">
          <span class="hub-map-intro-kicker"></span>
          <strong class="hub-map-intro-title"></strong>
        </div>
        <div class="hub-map-intro-loader" aria-hidden="true">
          <div class="hub-map-intro-outer-spinner hub-map-intro-animated">
            <svg viewBox="0 0 150 150"><circle class="hub-map-intro-grey-arc" cx="75" cy="75" r="71"></circle></svg>
          </div>
          <div class="hub-map-intro-inner-spinner hub-map-intro-animated">
            <svg viewBox="0 0 150 150"><circle class="hub-map-intro-gold-arc" cx="75" cy="75" r="62"></circle></svg>
          </div>
          <img class="hub-map-intro-logo" alt="The HUB">
        </div>
      </div>
      <audio class="hub-map-intro-audio" preload="auto"></audio>
    `;
    gameStage.appendChild(overlay);
    audio = overlay.querySelector(".hub-map-intro-audio");
    return overlay;
  }

  function restartRingAnimations() {
    overlay?.querySelectorAll(".hub-map-intro-animated").forEach(node => {
      const clone = node.cloneNode(true);
      node.replaceWith(clone);
    });
  }

  async function isParticipantOfLiveTournament(tournamentId) {
    if (!tournamentId) return false;
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session) return false;

      const [{ data: tournament, error: tournamentError }, { data: globalPlayerId, error: playerIdError }] = await Promise.all([
        db.from("tournaments").select("id,status").eq("id", tournamentId).maybeSingle(),
        db.rpc("my_global_player_id")
      ]);
      if (tournamentError || playerIdError || !globalPlayerId || tournament?.status !== "live") return false;

      const { data: rows, error } = await db.from("players")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("global_player_id", globalPlayerId)
        .limit(1);
      return !error && Array.isArray(rows) && rows.length > 0;
    } catch (error) {
      console.warn("[HUB Map Intros] Participant check failed", error);
      return false;
    }
  }

  function releaseBloxdPointerLock() {
    try { document.exitPointerLock?.(); } catch (_) {}
    try { window.postMessage({ type: "OVERLAY_OPEN", source: "hub-map-intro" }, "*"); } catch (_) {}
  }

  function restoreBloxdOverlayState() {
    try { window.postMessage({ type: "OVERLAY_CLOSE", source: "hub-map-intro" }, "*"); } catch (_) {}
  }

  function finishIntro(immediate = false) {
    if (!overlay || !active) return;
    active = false;
    clearTimeout(closeTimer);
    clearTimeout(fadeTimer);
    closeTimer = 0;
    fadeTimer = 0;
    try { audio.pause(); audio.currentTime = 0; } catch (_) {}
    overlay.classList.add("is-closing");
    overlay.classList.remove("is-open");
    restoreBloxdOverlayState();
    fadeTimer = window.setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove("is-closing");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("hub-map-intro-open");
    }, immediate ? 0 : 300);
  }

  async function playIntro(mapKey, payload = {}) {
    if (active) return;
    const config = MAPS[mapKey];
    if (!config) return;

    if (!buildOverlay()) return;
    const image = overlay.querySelector(".hub-map-intro-image");
    const title = overlay.querySelector(".hub-map-intro-title");
    const kicker = overlay.querySelector(".hub-map-intro-kicker");
    const logo = overlay.querySelector(".hub-map-intro-logo");

    image.style.backgroundImage = `url("${config.image}")`;
    title.textContent = config.title || mapKey;
    kicker.textContent = config.kicker || "";
    logo.src = await ensureLogo();
    audio.src = config.audio;
    audio.currentTime = 0;

    restartRingAnimations();
    active = true;
    document.body.classList.add("hub-map-intro-open");
    releaseBloxdPointerLock();
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.remove("is-closing");
    void overlay.offsetWidth;
    overlay.classList.add("is-open");

    let finished = false;
    const finishOnce = () => {
      if (finished) return;
      finished = true;
      finishIntro(false);
    };
    audio.onended = finishOnce;

    try {
      await audio.play();
    } catch (error) {
      console.warn("[HUB Map Intros] Audio autoplay was blocked by the browser.", error);
    }

    closeTimer = window.setTimeout(finishOnce, Number(config.durationMs || 10000) + 450);
    window.dispatchEvent(new CustomEvent("hub:map-intro-opened", { detail: { map: mapKey, payload } }));
  }

  async function receiveIntro(payload) {
    const map = String(payload?.map || "").toUpperCase();
    const tournamentId = String(payload?.tournamentId || "");
    const nonce = String(payload?.nonce || "");
    if (!map || !tournamentId || !nonce || handledNonces.has(nonce)) return;
    handledNonces.add(nonce);
    if (handledNonces.size > 50) handledNonces.delete(handledNonces.values().next().value);
    if (!await isParticipantOfLiveTournament(tournamentId)) return;
    await playIntro(map, payload);
  }

  installCss();
  ensureLogo();
  buildOverlay();

  const channel = db.channel(CHANNEL_NAME, { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: EVENT_NAME }, message => receiveIntro(message?.payload || {}));
  channel.subscribe(status => {
    if (status === "SUBSCRIBED") console.info("[HUB Map Intros] Ready.");
  });

  window.HubMapIntros = Object.freeze({
    playLocal: map => playIntro(String(map || "SG7").toUpperCase(), { localTest: true }),
    close: () => finishIntro(false)
  });
})();
