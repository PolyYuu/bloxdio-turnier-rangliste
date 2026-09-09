(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const VERIFY_URL = `${SUPABASE_URL}/functions/v1/hub-verify-registration`;
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const initials = (name) => String(name || "?").replace(/[^A-Za-z0-9]/g, " ").split(/\s+/).filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase() || "?";
  const CACHE_KEY = "hub_pending_registration";

  const I18N = {
    de: {
      title: "HUB · Verifizierung", overview: "OVERVIEW", ranking: "RANKING", cup: "CUP", profile: "PROFILE",
      pending: "VERIFIZIERUNG AUSSTEHEND", profileIntro: "Dein HUB-Account ist bereits angelegt. Stats, Rating und bestehende Turnierhistorie werden sichtbar, sobald deine permanente Bloxd-ID bestätigt wurde.",
      normalEyebrow: "NORMALE VERIFIZIERUNG", normalTitle: "8-Zeichen-Code",
      normalInstruction: "Gib den 8-Zeichen-Code in der Bloxd.io Lobby ein, um dich zu verifizieren. Dies kann einige Zeit dauern, weil du anschließend noch eine manuelle Bestätigung durch den Admin brauchst.",
      yourCode: "DEIN CODE", copy: "CODE KOPIEREN", show: "CODE ANZEIGEN", command: "IN BLOXD EINGEBEN", verifyNow: "JETZT VERIFIZIEREN ↗", registerNow: "JETZT REGISTRIEREN ↗", check: "STATUS PRÜFEN", loading: "Status wird geladen…",
      instantEyebrow: "SOFORT-VERIFIZIERUNG", instantTitle: "Direkt freischalten", instantDescription: "Wenn du nicht auf die manuelle Admin-Verifizierung warten möchtest, gib auf dem Server /instantcode ein. Du bekommst einen längeren Code, der deine permanente Bloxd-ID direkt bestätigt. Du musst nicht auf den Admin warten, der Code ist aber länger.",
      step1: "Server öffnen", step2: "/instantcode eingeben", step3: "Langen Code hier einfügen", instantCode: "INSTANT-CODE", instantVerify: "SOFORT VERIFIZIEREN",
      availableTitle: "Was ist bis dahin möglich?", availableText: "Overview, Rangliste, Cups und öffentliche Spielerprofile kannst du bereits normal nutzen. Eigene Stats, Profilbearbeitung, Freunde und eigene Turnieranmeldungen bleiben bis zur Verifizierung gesperrt.", back: "ZUM HUB",
      whyAria: "Info zur Verifizierung", whyEyebrow: "WIE FUNKTIONIERT DIE VERIFIZIERUNG?", whyTitle: "Zwei Wege zur Verifizierung", whyText: "Der normale 8-Zeichen-Code ist kurz und bequem. Nachdem du ihn in der Bloxd.io Lobby eingegeben hast, muss ein Admin deine Registrierung noch manuell bestätigen. Das kann einige Zeit dauern. Mit /instantcode bekommst du einen längeren Code, der deine permanente Bloxd-ID direkt bestätigt und keine manuelle Admin-Freigabe benötigt.",
      whyShortTitle: "8-Zeichen-Code", whyShortText: "Kurz und bequem. Nach der Eingabe ist noch eine manuelle Admin-Verifizierung nötig.", whyInstantTitle: "Instant-Code", whyInstantText: "Länger, dafür direkte Bestätigung deiner permanenten Bloxd-ID ohne Warten auf den Admin.", close: "Schließen",
      unavailable: "NICHT VERFÜGBAR", noCode: "Für diesen Account ist kein kurzer Code gespeichert.", copied: (code) => `Code ${code} wurde kopiert.`, copyFail: (code) => `Kopieren war nicht möglich. Dein Code ist ${code}.`, pendingStatus: "Verifizierung steht noch aus. Die endgültige Freigabe erfolgt nach der manuellen Admin-Bestätigung.", pendingBloxdStatus: "Deine Registrierung ist gespeichert. Die endgültige Freigabe erfolgt nach der manuellen Admin-Bestätigung.",
      instantMissing: "Bitte füge den vollständigen Code aus /instantcode ein.", loginAgain: "Bitte melde dich erneut an.", instantChecking: "Instant-Code wird geprüft…", instantFail: "Sofort-Verifizierung fehlgeschlagen.", verifiedAs: (name) => `Verifiziert als ${name}.`
    },
    en: {
      title: "HUB · Verification", overview: "OVERVIEW", ranking: "RANKING", cup: "CUP", profile: "PROFILE",
      pending: "VERIFICATION PENDING", profileIntro: "Your HUB account has already been created. Stats, rating and previous tournament history become visible once your permanent Bloxd ID has been confirmed.",
      normalEyebrow: "NORMAL VERIFICATION", normalTitle: "8-character code",
      normalInstruction: "Enter the 8-character code in the Bloxd.io lobby to verify yourself. This may take some time because your account still needs a manual confirmation by the admin afterwards.",
      yourCode: "YOUR CODE", copy: "COPY CODE", show: "SHOW CODE", command: "ENTER IN BLOXD", verifyNow: "VERIFY NOW ↗", registerNow: "REGISTER NOW ↗", check: "CHECK STATUS", loading: "Loading status…",
      instantEyebrow: "INSTANT VERIFICATION", instantTitle: "Unlock immediately", instantDescription: "If you do not want to wait for the manual admin verification, enter /instantcode on the server. You will receive a longer code that directly confirms your permanent Bloxd ID. You do not need to wait for the admin, but the code is longer.",
      step1: "Open server", step2: "Enter /instantcode", step3: "Paste the long code here", instantCode: "INSTANT CODE", instantVerify: "VERIFY INSTANTLY",
      availableTitle: "What can I use meanwhile?", availableText: "You can already use Overview, Ranking, Cups and public player profiles normally. Your own stats, profile editing, friends and your own cup registrations remain locked until verification.", back: "BACK TO HUB",
      whyAria: "Verification info", whyEyebrow: "HOW DOES VERIFICATION WORK?", whyTitle: "Two ways to verify", whyText: "The normal 8-character code is short and convenient. After you enter it in the Bloxd.io lobby, an admin still has to confirm your registration manually. This can take some time. With /instantcode you receive a longer code that directly confirms your permanent Bloxd ID and does not require manual admin approval.",
      whyShortTitle: "8-character code", whyShortText: "Short and convenient. Manual admin verification is still required after entering it.", whyInstantTitle: "Instant code", whyInstantText: "Longer, but directly confirms your permanent Bloxd ID without waiting for the admin.", close: "Close",
      unavailable: "NOT AVAILABLE", noCode: "No short code is stored for this account.", copied: (code) => `Code ${code} copied.`, copyFail: (code) => `Could not copy. Your code is ${code}.`, pendingStatus: "Verification is still pending. Final approval happens after the manual admin confirmation.", pendingBloxdStatus: "Your registration is saved. Final approval happens after the manual admin confirmation.",
      instantMissing: "Please paste the complete code from /instantcode.", loginAgain: "Please sign in again.", instantChecking: "Checking instant code…", instantFail: "Instant verification failed.", verifiedAs: (name) => `Verified as ${name}.`
    },
    fr: {
      title: "HUB · Vérification", overview: "APERÇU", ranking: "CLASSEMENT", cup: "CUP", profile: "PROFIL",
      pending: "VÉRIFICATION EN ATTENTE", profileIntro: "Ton compte HUB est déjà créé. Tes statistiques, ton classement et ton historique de tournois deviennent visibles dès que ton identifiant Bloxd permanent est confirmé.",
      normalEyebrow: "VÉRIFICATION NORMALE", normalTitle: "Code à 8 caractères",
      normalInstruction: "Entre le code à 8 caractères dans le lobby Bloxd.io pour te vérifier. Cela peut prendre un peu de temps, car ton compte doit ensuite être confirmé manuellement par l’administrateur.",
      yourCode: "TON CODE", copy: "COPIER LE CODE", show: "AFFICHER LE CODE", command: "À ENTRER DANS BLOXD", verifyNow: "VÉRIFIER MAINTENANT ↗", registerNow: "S’INSCRIRE MAINTENANT ↗", check: "VÉRIFIER LE STATUT", loading: "Chargement du statut…",
      instantEyebrow: "VÉRIFICATION INSTANTANÉE", instantTitle: "Débloquer immédiatement", instantDescription: "Si tu ne veux pas attendre la vérification manuelle par l’administrateur, entre /instantcode sur le serveur. Tu recevras un code plus long qui confirme directement ton identifiant Bloxd permanent. Tu n’as pas besoin d’attendre l’administrateur, mais le code est plus long.",
      step1: "Ouvrir le serveur", step2: "Entrer /instantcode", step3: "Coller le long code ici", instantCode: "CODE INSTANTANÉ", instantVerify: "VÉRIFIER IMMÉDIATEMENT",
      availableTitle: "Que puis-je utiliser en attendant ?", availableText: "Tu peux déjà utiliser normalement l’aperçu, le classement, les cups et les profils publics. Tes propres statistiques, la modification du profil, les amis et tes inscriptions restent bloqués jusqu’à la vérification.", back: "RETOUR AU HUB",
      whyAria: "Infos sur la vérification", whyEyebrow: "COMMENT FONCTIONNE LA VÉRIFICATION ?", whyTitle: "Deux façons de se vérifier", whyText: "Le code normal à 8 caractères est court et pratique. Après l’avoir entré dans le lobby Bloxd.io, un administrateur doit encore confirmer ton inscription manuellement. Cela peut prendre un peu de temps. Avec /instantcode, tu reçois un code plus long qui confirme directement ton identifiant Bloxd permanent sans validation manuelle de l’administrateur.",
      whyShortTitle: "Code à 8 caractères", whyShortText: "Court et pratique. Une vérification manuelle par l’administrateur reste nécessaire après la saisie.", whyInstantTitle: "Code instantané", whyInstantText: "Plus long, mais il confirme directement ton identifiant Bloxd permanent sans attendre l’administrateur.", close: "Fermer",
      unavailable: "INDISPONIBLE", noCode: "Aucun code court n’est enregistré pour ce compte.", copied: (code) => `Code ${code} copié.`, copyFail: (code) => `Impossible de copier. Ton code est ${code}.`, pendingStatus: "La vérification est toujours en attente. La validation finale a lieu après la confirmation manuelle de l’administrateur.", pendingBloxdStatus: "Ton inscription est enregistrée. La validation finale a lieu après la confirmation manuelle de l’administrateur.",
      instantMissing: "Colle le code complet obtenu avec /instantcode.", loginAgain: "Reconnecte-toi.", instantChecking: "Vérification du code instantané…", instantFail: "La vérification instantanée a échoué.", verifiedAs: (name) => `Vérifié en tant que ${name}.`
    }
  };

  let current = null;
  let lang = detectLanguage();

  function detectLanguage() {
    const raw = String(localStorage.getItem("hub_language") || localStorage.getItem("hubLang") || navigator.language || "de").toLowerCase();
    if (raw.startsWith("fr")) return "fr";
    if (raw.startsWith("en")) return "en";
    return "de";
  }
  const t = (key, ...args) => {
    const value = I18N[lang]?.[key] ?? I18N.de[key] ?? key;
    return typeof value === "function" ? value(...args) : value;
  };

  function setLanguage(next) {
    lang = ["de", "en", "fr"].includes(next) ? next : "de";
    localStorage.setItem("hub_language", lang);
    localStorage.setItem("hubLang", lang);
    document.documentElement.lang = lang;
    document.title = t("title");

    $$('[data-lang]').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
    $$('[data-nav-key]').forEach(link => { link.textContent = t(link.dataset.navKey); });
    $("#accountStatusText").textContent = t("pending");
    $("#statusBadgeText").textContent = t("pending");
    $("#profileIntro").textContent = t("profileIntro");
    $("#normalEyebrow").textContent = t("normalEyebrow");
    $("#normalTitle").textContent = t("normalTitle");
    $("#normalInstruction").textContent = t("normalInstruction");
    $("#yourCodeLabel").textContent = t("yourCode");
    $("#copyCode").textContent = t("copy");
    $("#showCode").textContent = t("show");
    $("#commandLabel").textContent = t("command");
    $("#refreshStatus").textContent = t("check");
    $("#instantEyebrow").textContent = t("instantEyebrow");
    $("#instantTitle").textContent = t("instantTitle");
    $("#instantDescription").textContent = t("instantDescription");
    $("#instantStep1").textContent = t("step1");
    $("#instantStep2").textContent = t("step2");
    $("#instantStep3").textContent = t("step3");
    $("#instantCodeLabel").textContent = t("instantCode");
    $("#instantVerify").textContent = t("instantVerify");
    $("#instantOpenGame").textContent = t("verifyNow");
    $("#availableTitle").textContent = t("availableTitle");
    $("#availableText").textContent = t("availableText");
    $("#backToHub").textContent = t("back");
    $("#whyButton").setAttribute("aria-label", t("whyAria"));
    $("#whyButton").title = t("whyAria");
    $("#whyEyebrow").textContent = t("whyEyebrow");
    $("#whyTitle").textContent = t("whyTitle");
    $("#whyText").textContent = t("whyText");
    $("#whyShortTitle").textContent = t("whyShortTitle");
    $("#whyShortText").textContent = t("whyShortText");
    $("#whyInstantTitle").textContent = t("whyInstantTitle");
    $("#whyInstantText").textContent = t("whyInstantText");
    $("#closeWhy").setAttribute("aria-label", t("close"));

    if (current) render(current, false);
    else setStatusText(t("loading"));
  }

  function writePendingCache(data, session) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        status: "pending",
        auth_user_id: session?.user?.id || "",
        claimed_name: data?.claimed_name || "",
        verified_name: data?.verified_name || "",
        source: data?.source || "",
        cached_at: Date.now()
      }));
    } catch (_) {}
  }

  function clearPendingCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
  }

  function setStatusText(text, type = "") {
    const el = $("#statusText");
    if (!el) return;
    el.textContent = text;
    el.className = `status-text ${type}`.trim();
  }

  function updateGameButtonMode(isWebFirst) {
    const text = isWebFirst ? t("verifyNow") : t("registerNow");
    $("#openGame").textContent = text;
    $("#openGameTop").textContent = text;
  }

  function render(data, updateStatus = true) {
    current = data;
    const name = data.claimed_name || data.verified_name || "Account Preview";
    $("#playerName").textContent = name;
    $("#avatar").textContent = initials(name);

    const code = String(data.code || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    $("#codeValue").textContent = code || t("unavailable");

    const isWebFirst = data.source === "web_first";
    updateGameButtonMode(isWebFirst);
    if (isWebFirst) {
      $("#commandValue").textContent = code ? `/verify ${code}` : "/verify DEINCODE";
      if (updateStatus) setStatusText(t("pendingStatus"));
    } else {
      $("#commandValue").textContent = "/register";
      if (updateStatus) setStatusText(t("pendingBloxdStatus"));
    }
  }

  async function status() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      clearPendingCache();
      location.href = "index.html#overview";
      return;
    }
    const { data, error } = await db.rpc("get_my_registration_status");
    if (error) {
      setStatusText(error.message, "error");
      return;
    }
    if (data?.status === "verified") {
      clearPendingCache();
      location.href = "index.html#profile";
      return;
    }
    if (!data || data.status === "unlinked" || data.status === "logged_out") {
      clearPendingCache();
      location.href = "register.html";
      return;
    }
    if (data.status === "pending") writePendingCache(data, session);
    render(data);
    if (data.status !== "pending") setStatusText(data.failure_reason || `Status: ${data.status}`, "error");
  }

  $("#showCode").onclick = () => {
    const code = String(current?.code || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    $("#codeValue").textContent = code || t("unavailable");
    $("#codeBox").scrollIntoView({ behavior: "smooth", block: "center" });
  };

  $("#copyCode").onclick = async () => {
    const code = String(current?.code || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (!code) {
      setStatusText(t("noCode"), "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setStatusText(t("copied", code), "success");
    } catch (_) {
      setStatusText(t("copyFail", code), "error");
    }
  };

  $("#refreshStatus").onclick = status;

  $("#instantVerify").onclick = async () => {
    const output = $("#instantMessage");
    output.textContent = "";
    output.className = "status-text";
    const token = $("#instantCode").value.trim().replace(/\s+/g, "");
    if (!token.startsWith("SGR1.")) {
      output.textContent = t("instantMissing");
      output.classList.add("error");
      return;
    }
    const { data: { session } } = await db.auth.getSession();
    if (!session?.access_token) {
      output.textContent = t("loginAgain");
      output.classList.add("error");
      return;
    }
    output.textContent = t("instantChecking");
    try {
      const r = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ instantCode: token })
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(result.error || t("instantFail"));
      clearPendingCache();
      output.textContent = t("verifiedAs", result.username || "Bloxd player");
      output.classList.add("success");
      setTimeout(() => { location.href = "index.html#profile"; }, 700);
    } catch (err) {
      output.textContent = err.message || t("instantFail");
      output.classList.add("error");
    }
  };

  $("#whyButton").onclick = () => $("#whyModal").classList.remove("hidden");
  $("#accountStatusButton").onclick = () => $("#whyModal").classList.remove("hidden");
  $("#closeWhy").onclick = () => $("#whyModal").classList.add("hidden");
  $("#whyModal").addEventListener("click", e => { if (e.target === $("#whyModal")) $("#whyModal").classList.add("hidden"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("#whyModal").classList.add("hidden"); });
  $$('[data-lang]').forEach(btn => { btn.onclick = () => setLanguage(btn.dataset.lang); });

  setLanguage(lang);
  status();
  setInterval(status, 15000);
})();
