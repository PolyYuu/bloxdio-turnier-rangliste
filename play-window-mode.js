(() => {
  "use strict";

  const BODY_CLASS = "play-viewport-fullscreen";

  function getStage() {
    return document.getElementById("gameStage");
  }

  function getButton() {
    return document.getElementById("fullscreenButton");
  }

  function injectStyles() {
    if (document.getElementById("hubPlayViewportModeStyles")) return;
    const style = document.createElement("style");
    style.id = "hubPlayViewportModeStyles";
    style.textContent = `
      body.${BODY_CLASS} #gameStage{
        position:fixed!important;
        inset:0!important;
        z-index:200000!important;
        width:100vw!important;
        height:100vh!important;
        min-width:0!important;
        min-height:0!important;
        border:0!important;
        border-radius:0!important;
        box-shadow:none!important;
        margin:0!important;
      }
      body.${BODY_CLASS} #gameStage .game-hud{z-index:100!important}
    `;
    document.head.appendChild(style);
  }

  function syncButton() {
    const button = getButton();
    if (!button) return;
    const enabled = document.body.classList.contains(BODY_CLASS);
    button.textContent = enabled ? "✕ VOLLBILD" : "⛶ VOLLBILD";
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.title = enabled
      ? "PLAY auf normale Größe zurücksetzen"
      : "PLAY im Browserfenster maximieren";
  }

  function setViewportMode(enabled) {
    document.body.classList.toggle(BODY_CLASS, Boolean(enabled));
    syncButton();
    window.dispatchEvent(new CustomEvent("hub:play-viewport-mode", {
      detail: { enabled: Boolean(enabled) }
    }));
  }

  async function toggleViewportMode() {
    const next = !document.body.classList.contains(BODY_CLASS);

    // The default PLAY button deliberately does not use the browser Fullscreen API.
    // If an old/foreign fullscreen is active, leave it before entering viewport mode.
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch (_) {}
    }
    setViewportMode(next);
  }

  injectStyles();
  syncButton();

  // Capture before play.js' original target listener so requestFullscreen() is never called.
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#fullscreenButton")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleViewportMode();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains(BODY_CLASS)) {
      setViewportMode(false);
    }
  }, true);

  window.addEventListener("pageshow", syncButton);

  window.HubPlayViewportMode = Object.freeze({
    open: () => setViewportMode(true),
    close: () => setViewportMode(false),
    toggle: toggleViewportMode,
    isOpen: () => document.body.classList.contains(BODY_CLASS),
    stage: getStage
  });
})();
