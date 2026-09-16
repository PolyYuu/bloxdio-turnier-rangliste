(() => {
  "use strict";

  const CHANNEL_NAME = "hub-map-intros-v1";
  const EVENT_NAME = "map_intro";
  let client = null;
  let channel = null;
  let channelReady = false;
  let mapsMode = false;
  let liveCup = null;
  let assetsReady = false;
  let refreshTimer = 0;
  let applyQueued = false;

  function injectStyles() {
    if (document.getElementById("hubMapIntroAdminStyles")) return;
    const style = document.createElement("style");
    style.id = "hubMapIntroAdminStyles";
    style.textContent = `
      #hubAdminMapsPanel{margin-top:14px;padding:0;overflow:hidden}
      #hubAdminMapsPanel[hidden]{display:none!important}
      #hubAdminMapsPanel .hub-map-admin-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:22px;border-bottom:1px solid rgba(117,78,226,.18)}
      #hubAdminMapsPanel .hub-map-admin-header h2{margin:5px 0 6px;font-size:24px}
      #hubAdminMapsPanel .hub-map-admin-header p{margin:0;color:#81768f;font-size:10px;line-height:1.55}
      #hubAdminMapsPanel .hub-map-live-chip{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid rgba(49,240,209,.26);border-radius:999px;background:rgba(49,240,209,.07);color:#31f0d1;font-size:8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
      #hubAdminMapsPanel .hub-map-live-chip::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}
      #hubAdminMapsPanel .hub-map-live-chip.is-offline{border-color:rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#8d859b}
      #hubAdminMapsPanel .hub-map-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:18px 22px 22px}
      #hubAdminMapsPanel .hub-map-card{padding:18px;border:1px solid rgba(126,86,225,.22);border-radius:10px;background:linear-gradient(180deg,rgba(25,13,58,.72),rgba(13,7,34,.66))}
      #hubAdminMapsPanel .hub-map-card span,#hubAdminMapsPanel .hub-map-card strong,#hubAdminMapsPanel .hub-map-card small{display:block}
      #hubAdminMapsPanel .hub-map-card span{color:#8e82a1;font-size:8px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
      #hubAdminMapsPanel .hub-map-card strong{margin-top:7px;font-size:24px}
      #hubAdminMapsPanel .hub-map-card small{min-height:34px;margin:7px 0 15px;color:#7f748e;font-size:9px;line-height:1.55}
      #hubAdminMapsPanel .hub-map-trigger{width:100%;min-height:42px;border:1px solid #ffd20d;border-radius:7px;background:#ffd20d;color:#170f20;font:950 11px/1 Montserrat,Arial,sans-serif;letter-spacing:.06em;cursor:pointer;transition:transform .15s ease,opacity .15s ease,box-shadow .15s ease}
      #hubAdminMapsPanel .hub-map-trigger:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 22px rgba(255,210,13,.18)}
      #hubAdminMapsPanel .hub-map-trigger:disabled{opacity:.42;cursor:not-allowed}
      #hubAdminMapsPanel .hub-map-status{padding:0 22px 20px;color:#8d829d;font-size:9px;min-height:14px}
      #hubAdminMapsPanel .hub-map-status.ok{color:#31f0d1}
      #hubAdminMapsPanel .hub-map-status.error{color:#ff718d}
      @media(max-width:760px){#hubAdminMapsPanel .hub-map-admin-header{display:block}.hub-map-live-chip{margin-top:12px}}
    `;
    document.head.appendChild(style);
  }

  function getClient() {
    return window.HubAPI?.client || null;
  }

  function ensureChannel() {
    client = getClient();
    if (!client || channel) return;
    channel = client.channel(CHANNEL_NAME, { config: { broadcast: { self: false } } });
    channel.subscribe(status => {
      channelReady = status === "SUBSCRIBED";
      updateControls();
    });
  }

  function ensureUi() {
    const nav = document.querySelector("#v3AdminPrimaryNav .v3-admin-primary-tabs");
    const navWrap = document.getElementById("v3AdminPrimaryNav");
    if (!nav || !navWrap) return false;

    let button = nav.querySelector("[data-hub-admin-maps]");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.hubAdminMaps = "1";
      button.textContent = "Maps";
      nav.appendChild(button);
    }

    let panel = document.getElementById("hubAdminMapsPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "hubAdminMapsPanel";
      panel.className = "panel";
      panel.hidden = true;
      panel.innerHTML = `
        <header class="hub-map-admin-header">
          <div>
            <span class="eyebrow">ADMIN · MAPS</span>
            <h2>Map Intros</h2>
            <p>Startet den Loading-Screen nur bei Spielern, die Teilnehmer des aktuell laufenden Cups sind und PLAY geöffnet haben.</p>
          </div>
          <span id="hubMapLiveCupChip" class="hub-map-live-chip is-offline">Kein Live-Cup</span>
        </header>
        <div class="hub-map-grid">
          <article class="hub-map-card">
            <span>Loading Screen</span>
            <strong>SG7</strong>
            <small>SG7-Bild + 10-Sekunden-Theme. Bloxd.io läuft während des Overlays im Hintergrund weiter.</small>
            <button id="hubTriggerMapSG7" class="hub-map-trigger" type="button" disabled>SG7</button>
          </article>
        </div>
        <div id="hubMapAdminStatus" class="hub-map-status">Realtime-Verbindung wird vorbereitet …</div>
      `;
      navWrap.insertAdjacentElement("afterend", panel);
    }
    return true;
  }

  function setStatus(text, kind = "") {
    const el = document.getElementById("hubMapAdminStatus");
    if (!el) return;
    el.textContent = text;
    el.className = `hub-map-status${kind ? ` ${kind}` : ""}`;
  }

  function updateControls() {
    const chip = document.getElementById("hubMapLiveCupChip");
    const trigger = document.getElementById("hubTriggerMapSG7");
    if (chip) {
      chip.textContent = liveCup ? `LIVE · ${liveCup.name || "Cup"}` : "Kein Live-Cup";
      chip.classList.toggle("is-offline", !liveCup);
    }
    if (trigger && !trigger.dataset.cooldown) trigger.disabled = !(liveCup && channelReady && assetsReady);
    if (!assetsReady) setStatus("SG7-Medien werden vorbereitet …");
    else if (!channelReady) setStatus("Realtime-Verbindung wird vorbereitet …");
    else if (!liveCup) setStatus("Es läuft aktuell kein Cup. Der SG7-Trigger bleibt deaktiviert.");
    else setStatus(`Bereit für ${liveCup.name || "den Live-Cup"}.`);
  }

  async function refreshAssetState() {
    try {
      const [image, audio] = await Promise.all([
        fetch("map-intros/assets/sg7.webp?v=20260916a", { method: "GET", cache: "no-store" }),
        fetch("map-intros/assets/sg7-intro.mp3?v=20260916a", { method: "GET", cache: "no-store" })
      ]);
      assetsReady = image.ok && audio.ok;
    } catch (_) {
      assetsReady = false;
    }
    updateControls();
  }

  async function refreshLiveCup() {
    client = getClient();
    if (!client) return;
    try {
      const { data, error } = await client.from("tournaments")
        .select("id,name,status,created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      liveCup = Array.isArray(data) && data.length ? data[0] : null;
    } catch (error) {
      liveCup = null;
      if (mapsMode) setStatus("Live-Cup konnte nicht geladen werden.", "error");
    }
    updateControls();
  }

  function applyMapsVisibility() {
    applyQueued = false;
    const panel = document.getElementById("hubAdminMapsPanel");
    const mapsButton = document.querySelector("[data-hub-admin-maps]");
    if (!panel || !mapsButton) return;
    panel.hidden = !mapsMode;
    mapsButton.classList.toggle("active", mapsMode);
    if (!mapsMode) return;
    document.querySelectorAll("#v3AdminPrimaryNav [data-v3-admin-section]").forEach(button => button.classList.remove("active"));
    document.querySelector(".admin-overview-v2")?.setAttribute("hidden", "");
    document.querySelector(".admin-workbench")?.setAttribute("hidden", "");
    document.getElementById("v3AdminPlayersPanel")?.setAttribute("hidden", "");
    document.getElementById("v3AdminCupSelect")?.setAttribute("hidden", "");
  }

  function queueApplyVisibility() {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(applyMapsVisibility);
  }

  function openMaps() {
    mapsMode = true;
    applyMapsVisibility();
    refreshLiveCup();
    refreshAssetState();
  }

  function leaveMaps() {
    if (!mapsMode) return;
    mapsMode = false;
    const panel = document.getElementById("hubAdminMapsPanel");
    const mapsButton = document.querySelector("[data-hub-admin-maps]");
    if (panel) panel.hidden = true;
    mapsButton?.classList.remove("active");
  }

  async function triggerSG7() {
    if (!liveCup || !channelReady || !channel || !assetsReady) return;
    const button = document.getElementById("hubTriggerMapSG7");
    if (!button || button.dataset.cooldown) return;
    button.dataset.cooldown = "1";
    button.disabled = true;
    const nonce = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const payload = {
      version: 1,
      map: "SG7",
      tournamentId: String(liveCup.id),
      tournamentName: liveCup.name || "",
      sentAt: new Date().toISOString(),
      nonce
    };
    try {
      const result = await channel.send({ type: "broadcast", event: EVENT_NAME, payload });
      if (result !== "ok") throw new Error(String(result || "broadcast failed"));
      setStatus(`SG7 wurde an die Teilnehmer von ${liveCup.name || "dem Live-Cup"} gesendet.`, "ok");
    } catch (error) {
      console.error("[HUB Map Intros] Broadcast failed", error);
      setStatus("SG7 konnte nicht gesendet werden. Bitte erneut versuchen.", "error");
    }
    window.setTimeout(() => {
      delete button.dataset.cooldown;
      updateControls();
    }, 10500);
  }

  injectStyles();

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-hub-admin-maps]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMaps();
      return;
    }
    if (target?.closest("#hubTriggerMapSG7")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      triggerSG7();
      return;
    }
    if (target?.closest("[data-v3-admin-section]")) leaveMaps();
  }, true);

  const observer = new MutationObserver(() => {
    if (ensureUi()) {
      ensureChannel();
      if (mapsMode) queueApplyVisibility();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const bootstrap = () => {
    if (ensureUi()) {
      ensureChannel();
      refreshLiveCup();
      refreshAssetState();
    }
  };
  bootstrap();
  refreshTimer = window.setInterval(() => {
    if (document.getElementById("v3AdminPrimaryNav")) {
      ensureUi();
      ensureChannel();
      refreshLiveCup();
      refreshAssetState();
      if (mapsMode) queueApplyVisibility();
    }
  }, 3500);
})();
