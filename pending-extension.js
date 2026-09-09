(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const ASSERT_URL = `${SUPABASE_URL}/functions/v1/hub-verify-assertion`;
  const SIGNED_URL = `${SUPABASE_URL}/functions/v1/hub-verify-registration`;
  const SOURCE_PAGE = "HUB_WEBSITE";
  const SOURCE_EXTENSION = "HUB_VERIFY_EXTENSION";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let extensionReady = false;
  let pendingCode = "";
  let verifying = false;
  let assertionPoll = null;

  const $ = (s) => document.querySelector(s);
  const cleanCode = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const lang = () => {
    const raw = String(localStorage.getItem("hub_language") || localStorage.getItem("hubLang") || document.documentElement.lang || "de").toLowerCase();
    return raw.startsWith("fr") ? "fr" : raw.startsWith("en") ? "en" : "de";
  };

  const COPY = {
    de: {
      installed:"EXTENSION INSTALLIERT", button:"MIT EXTENSION VERIFIZIEREN", ready:"Extension erkannt. Starte die Verbindung und gib anschließend in Bloxd /register ein.",
      opening:"Bloxd wird geöffnet. Gib dort /register ein. Den Rest übernimmt HUB Verify automatisch.", detected:"Bloxd-Code erkannt. Identität wird geprüft…",
      waiting:"Code erkannt, aber der sichere Server-Nachweis ist noch nicht angekommen. Warte kurz. Falls es nicht automatisch klappt, gib in Bloxd einmal /instantcode ein – den langen Code übernimmt die Extension automatisch.",
      signed:"Sicherer Bloxd-Nachweis erkannt. Account wird freigeschaltet…", success:"Verifizierung erfolgreich. Profil wird geöffnet…",
      mismatch:"Der erkannte Bloxd-Code gehört nicht zu diesem Pending-Account.", error:"Automatische Verifizierung konnte noch nicht abgeschlossen werden.", noext:"HUB Verify wurde nicht erkannt. Prüfe, ob die Extension installiert und aktiviert ist."
    },
    en: {
      installed:"EXTENSION INSTALLED", button:"VERIFY WITH EXTENSION", ready:"Extension detected. Start the connection, then enter /register in Bloxd.",
      opening:"Bloxd is opening. Enter /register there. HUB Verify handles the rest automatically.", detected:"Bloxd code detected. Checking identity…",
      waiting:"Code detected, but the trusted server proof has not arrived yet. Wait a moment. If it does not complete automatically, enter /instantcode once in Bloxd – the extension captures the long code automatically.",
      signed:"Secure Bloxd proof detected. Unlocking account…", success:"Verification successful. Opening profile…",
      mismatch:"The detected Bloxd code does not belong to this Pending account.", error:"Automatic verification could not be completed yet.", noext:"HUB Verify was not detected. Check that the extension is installed and enabled."
    },
    fr: {
      installed:"EXTENSION INSTALLÉE", button:"VÉRIFIER AVEC L’EXTENSION", ready:"Extension détectée. Lance la connexion puis entre /register dans Bloxd.",
      opening:"Bloxd va s’ouvrir. Entre /register. HUB Verify s’occupe automatiquement du reste.", detected:"Code Bloxd détecté. Vérification de l’identité…",
      waiting:"Code détecté, mais la preuve serveur sécurisée n’est pas encore arrivée. Attends un instant. Si cela ne se termine pas automatiquement, entre /instantcode une fois dans Bloxd – l’extension récupère automatiquement le code long.",
      signed:"Preuve Bloxd sécurisée détectée. Déblocage du compte…", success:"Vérification réussie. Ouverture du profil…",
      mismatch:"Le code Bloxd détecté n’appartient pas à ce compte en attente.", error:"La vérification automatique n’a pas encore pu être terminée.", noext:"HUB Verify n’a pas été détectée. Vérifie que l’extension est installée et activée."
    }
  };
  const t = (key) => COPY[lang()]?.[key] || COPY.de[key] || key;

  function bridgeNote(text, cls="") {
    const el = $("#bridgeNote");
    if (!el) return;
    el.textContent = text;
    el.className = `bridge-note ${cls}`.trim();
  }

  function updateBridgeUI() {
    const badge = $("#bridgeBadge");
    const button = $("#bridgeButton");
    if (!badge || !button) return false;
    if (extensionReady) {
      badge.textContent = t("installed");
      badge.style.color = "#55e6b1";
      badge.style.borderColor = "rgba(85,230,177,.38)";
      badge.style.background = "rgba(85,230,177,.1)";
      button.disabled = false;
      button.textContent = t("button");
      bridgeNote(t("ready"));
    }
    return true;
  }

  async function getSession() {
    const { data: { session } } = await db.auth.getSession();
    return session || null;
  }

  async function loadPendingCode() {
    try {
      const { data, error } = await db.rpc("get_my_registration_status");
      if (error) throw error;
      if (data?.status === "verified") {
        location.href = "index.html#profile";
        return "";
      }
      pendingCode = cleanCode(data?.code || $("#codeValue")?.textContent);
      return pendingCode;
    } catch (_) {
      pendingCode = cleanCode($("#codeValue")?.textContent);
      return pendingCode;
    }
  }

  async function postWithSession(url, body) {
    const session = await getSession();
    if (!session?.access_token) throw new Error("login_required");
    const response = await fetch(url, {
      method:"POST",
      headers:{"Content-Type":"application/json", "Authorization":`Bearer ${session.access_token}`, "apikey":SUPABASE_KEY},
      body:JSON.stringify(body || {})
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    return { response, data };
  }

  async function finishVerified() {
    if (assertionPoll) { clearInterval(assertionPoll); assertionPoll = null; }
    bridgeNote(t("success"), "success");
    setTimeout(() => { location.href = "index.html#profile"; }, 650);
  }

  async function verifyTrustedAssertion(identity = null) {
    if (verifying) return false;
    const code = cleanCode(identity?.code || pendingCode || await loadPendingCode());
    if (!code) return false;
    if (pendingCode && code !== pendingCode) {
      bridgeNote(t("mismatch"), "error");
      return false;
    }
    verifying = true;
    try {
      const { response, data } = await postWithSession(ASSERT_URL, {
        code,
        bloxdDbId: identity?.dbId || "",
        playerName: identity?.name || ""
      });
      if (response.ok && data?.status === "verified") {
        await finishVerified();
        return true;
      }
      if (response.status === 202 || data?.status === "waiting_for_assertion") {
        bridgeNote(t("waiting"));
        return false;
      }
      bridgeNote(data?.error || t("error"), "error");
      return false;
    } catch (_) {
      bridgeNote(t("error"), "error");
      return false;
    } finally {
      verifying = false;
    }
  }

  async function verifySignedProof(token) {
    const proof = String(token || "").trim();
    if (!/^SGR1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(proof)) return false;
    bridgeNote(t("signed"));
    try {
      const { response, data } = await postWithSession(SIGNED_URL, { instantCode: proof });
      if (response.ok && data?.status === "verified") {
        await finishVerified();
        return true;
      }
      bridgeNote(data?.error || t("error"), "error");
    } catch (_) {
      bridgeNote(t("error"), "error");
    }
    return false;
  }

  function pollAssertion(identity = null) {
    if (assertionPoll) clearInterval(assertionPoll);
    let tries = 0;
    assertionPoll = setInterval(async () => {
      tries += 1;
      const done = await verifyTrustedAssertion(identity);
      if (done || tries >= 8) {
        clearInterval(assertionPoll);
        assertionPoll = null;
      }
    }, 1800);
  }

  async function startExtensionFlow() {
    if (!extensionReady) return bridgeNote(t("noext"), "error");
    await loadPendingCode();
    window.postMessage({ source:SOURCE_PAGE, type:"VERIFY_EXTENSION_START", pendingCode, openBloxd:true }, window.location.origin);
    bridgeNote(t("opening"));
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== SOURCE_EXTENSION) return;

    if (data.type === "EXTENSION_READY" && data.ok) {
      extensionReady = true;
      updateBridgeUI();
      const state = data.state || {};
      if (state.latestSignedProof?.token) await verifySignedProof(state.latestSignedProof.token);
      else if (state.latestIdentity) { bridgeNote(t("detected")); pollAssertion(state.latestIdentity); }
      return;
    }
    if (data.type === "EXTENSION_PAIRING_STARTED" && data.ok) {
      bridgeNote(t("opening"));
      return;
    }
    if (data.type === "EXTENSION_REGISTRATION_CODE") {
      const code = cleanCode(data.code);
      if (!pendingCode) await loadPendingCode();
      if (pendingCode && code !== pendingCode) return bridgeNote(t("mismatch"), "error");
      bridgeNote(t("detected"));
      pollAssertion({ code });
      return;
    }
    if (data.type === "EXTENSION_IDENTITY" && data.identity) {
      if (!pendingCode) await loadPendingCode();
      bridgeNote(t("detected"));
      pollAssertion(data.identity);
      return;
    }
    if (data.type === "EXTENSION_SIGNED_PROOF" && data.token) {
      await verifySignedProof(data.token);
    }
  });

  function boot() {
    loadPendingCode();
    const timer = setInterval(() => {
      if (!updateBridgeUI()) return;
      clearInterval(timer);
      const button = $("#bridgeButton");
      if (button) button.addEventListener("click", startExtensionFlow);
      window.postMessage({ source:SOURCE_PAGE, type:"VERIFY_EXTENSION_PING" }, window.location.origin);
    }, 120);
    setTimeout(() => clearInterval(timer), 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
