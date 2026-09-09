(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const CACHE_KEY = "hub_pending_registration";

  const COPY = {
    de: {
      title:"HUB · Verifizierung",pending:"VERIFIZIERUNG AUSSTEHEND",pendingName:"PENDING",
      profileIntro:"Dein HUB-Account ist angelegt, hat aber noch keinen Spielernamen. Name, Stats, Rating und Turnierhistorie werden erst nach der Bloxd-Verifizierung übernommen.",
      pendingEyebrow:"DEINE REGISTRIERUNG",pendingTitle:"Verifizierung ausstehend",
      pendingText:"Dein Account wurde erfolgreich erstellt. Dieser Registrierungscode gehört zu deinem Pending-Account und bleibt sichtbar, solange die Verifizierung noch nicht abgeschlossen ist.",
      yourCode:"DEIN REGISTRIERUNGSCODE",copy:"CODE KOPIEREN",check:"STATUS PRÜFEN",loading:"Status wird geladen…",
      pendingStatus:"Deine Verifizierung steht noch aus. Sobald deine permanente Bloxd-ID bestätigt wurde, wird dein Profil automatisch freigeschaltet.",
      copied:"Code kopiert.",copyFail:"Kopieren war nicht möglich.",noCode:"Für diesen Account ist kein Registrierungscode verfügbar.",
      bridgeEyebrow:"DIREKTE VERIFIZIERUNG",bridgeTitle:"HUB Verify Extension",bridgeBadge:"IN VORBEREITUNG",
      bridgeText:"Als zweite Verifizierungsart bauen wir eine eigene Chrome-Erweiterung. Sie läuft direkt auf Bloxd.io und kann die für den HUB benötigte Spieler-Identität sicher an unsere Website weiterreichen – ohne langen Code zum Abtippen.",
      bridgeStep1:"HUB Verify Extension installieren",bridgeStep2:"Mit deinem HUB-Account verbinden",bridgeStep3:"Bloxd öffnen und automatisch bestätigen",bridgeButton:"EXTENSION BALD VERFÜGBAR",
      bridgeNote:"Die Erweiterung ist noch nicht freigeschaltet. Wir zeigen den Download erst an, sobald die komplette Verifizierungskette getestet ist.",
      availableTitle:"Bis dahin",availableText:"Du kannst den HUB bereits nutzen. Dein eigener Spielername, deine Stats und accountgebundene Funktionen werden automatisch freigeschaltet, sobald die Verifizierung abgeschlossen ist.",back:"ZUM HUB",
      error:"Status konnte nicht geladen werden."
    },
    en: {
      title:"HUB · Verification",pending:"VERIFICATION PENDING",pendingName:"PENDING",
      profileIntro:"Your HUB account has been created, but it does not have a player name yet. Your name, stats, rating and tournament history are added only after Bloxd verification.",
      pendingEyebrow:"YOUR REGISTRATION",pendingTitle:"Verification pending",
      pendingText:"Your account was created successfully. This registration code belongs to your Pending account and stays visible until verification has been completed.",
      yourCode:"YOUR REGISTRATION CODE",copy:"COPY CODE",check:"CHECK STATUS",loading:"Loading status…",
      pendingStatus:"Your verification is still pending. Once your permanent Bloxd ID has been confirmed, your profile is unlocked automatically.",
      copied:"Code copied.",copyFail:"Could not copy the code.",noCode:"No registration code is available for this account.",
      bridgeEyebrow:"DIRECT VERIFICATION",bridgeTitle:"HUB Verify Extension",bridgeBadge:"IN DEVELOPMENT",
      bridgeText:"As a second verification method, we are building our own Chrome extension. It runs directly on Bloxd.io and can securely pass the player identity required by the HUB to our website – without typing a long code.",
      bridgeStep1:"Install the HUB Verify Extension",bridgeStep2:"Connect it to your HUB account",bridgeStep3:"Open Bloxd and confirm automatically",bridgeButton:"EXTENSION COMING SOON",
      bridgeNote:"The extension is not enabled yet. The download will appear only after the complete verification flow has been tested.",
      availableTitle:"Until then",availableText:"You can already use the HUB. Your player name, stats and account-bound features unlock automatically once verification is complete.",back:"BACK TO HUB",
      error:"Could not load verification status."
    },
    fr: {
      title:"HUB · Vérification",pending:"VÉRIFICATION EN ATTENTE",pendingName:"EN ATTENTE",
      profileIntro:"Ton compte HUB est créé, mais il n’a pas encore de nom de joueur. Le nom, les statistiques, le classement et l’historique sont ajoutés seulement après la vérification Bloxd.",
      pendingEyebrow:"TON INSCRIPTION",pendingTitle:"Vérification en attente",
      pendingText:"Ton compte a bien été créé. Ce code d’inscription appartient à ton compte en attente et reste visible jusqu’à la fin de la vérification.",
      yourCode:"TON CODE D’INSCRIPTION",copy:"COPIER LE CODE",check:"VÉRIFIER LE STATUT",loading:"Chargement du statut…",
      pendingStatus:"Ta vérification est toujours en attente. Dès que ton identifiant Bloxd permanent est confirmé, ton profil est débloqué automatiquement.",
      copied:"Code copié.",copyFail:"Impossible de copier le code.",noCode:"Aucun code d’inscription n’est disponible pour ce compte.",
      bridgeEyebrow:"VÉRIFICATION DIRECTE",bridgeTitle:"HUB Verify Extension",bridgeBadge:"EN PRÉPARATION",
      bridgeText:"Comme deuxième méthode, nous préparons notre propre extension Chrome. Elle fonctionne directement sur Bloxd.io et transmet au HUB l’identité joueur nécessaire, sans long code à recopier.",
      bridgeStep1:"Installer HUB Verify Extension",bridgeStep2:"La connecter à ton compte HUB",bridgeStep3:"Ouvrir Bloxd et confirmer automatiquement",bridgeButton:"EXTENSION BIENTÔT DISPONIBLE",
      bridgeNote:"L’extension n’est pas encore activée. Le téléchargement sera proposé après le test complet du processus de vérification.",
      availableTitle:"En attendant",availableText:"Tu peux déjà utiliser le HUB. Ton nom de joueur, tes statistiques et les fonctions liées au compte seront débloqués automatiquement après la vérification.",back:"RETOUR AU HUB",
      error:"Impossible de charger le statut de vérification."
    }
  };

  let lang = detectLanguage();
  let current = null;

  function detectLanguage(){const raw=String(localStorage.getItem("hub_language")||localStorage.getItem("hubLang")||navigator.language||"de").toLowerCase();if(raw.startsWith("fr"))return"fr";if(raw.startsWith("en"))return"en";return"de";}
  const t = (key) => COPY[lang]?.[key] || COPY.de[key] || key;
  function cleanCode(value){return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);}
  function cachedCode(){try{return cleanCode(JSON.parse(localStorage.getItem(CACHE_KEY)||"null")?.code||"");}catch(_){return"";}}
  function clearCache(){try{localStorage.removeItem(CACHE_KEY);}catch(_){}}
  function writeCache(data,session){try{localStorage.setItem(CACHE_KEY,JSON.stringify({status:"pending",auth_user_id:session?.user?.id||"",source:data?.source||"",code:cleanCode(data?.code||cachedCode()),cached_at:Date.now()}));}catch(_){}}

  function injectStyles(){
    if($("#pendingV2Styles"))return;
    const style=document.createElement("style");style.id="pendingV2Styles";style.textContent=`
      .pending-v2-code{display:grid;gap:12px;margin:18px 0;padding:20px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:rgba(255,255,255,.035)}
      .pending-v2-code span{font-size:8px;letter-spacing:.13em;color:#837a91;font-weight:1000}.pending-v2-code strong{font-size:32px;letter-spacing:.18em;word-break:break-all}
      .pending-v2-actions{display:flex;gap:10px;flex-wrap:wrap}.pending-v2-actions button{min-width:150px}.pending-v2-note{margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,.06)}
      .bridge-badge{display:inline-flex;width:max-content;margin:4px 0 12px;border:1px solid rgba(244,189,79,.3);background:rgba(244,189,79,.1);color:#f4bd4f;border-radius:999px;padding:7px 10px;font-size:8px;font-weight:1000;letter-spacing:.08em}
      .bridge-card .instant-steps{margin-top:20px}.bridge-card .secondary[disabled]{opacity:.48;cursor:not-allowed}.bridge-note{margin-top:16px!important;font-size:11px!important}
      @media(max-width:480px){.pending-v2-actions{display:grid}.pending-v2-actions button{width:100%}.pending-v2-code strong{font-size:24px}}
    `;document.head.appendChild(style);
  }

  function rebuildVerificationArea(){
    const layout=$(".verify-layout");if(!layout)return;
    layout.innerHTML=`
      <article class="verify-card primary-card">
        <span class="eyebrow" id="pendingEyebrow"></span>
        <h2 id="pendingTitle"></h2>
        <p class="lead" id="pendingDescription"></p>
        <div class="pending-v2-code">
          <span id="yourCodeLabel"></span>
          <strong id="codeValue">--------</strong>
          <div class="pending-v2-actions">
            <button id="copyCode" type="button" class="secondary"></button>
            <button id="refreshStatus" type="button" class="secondary"></button>
          </div>
        </div>
        <p id="statusText" class="status-text"></p>
        <p class="pending-v2-note" id="pendingNote"></p>
      </article>
      <article class="verify-card bridge-card">
        <span class="eyebrow instant" id="bridgeEyebrow"></span>
        <h2 id="bridgeTitle"></h2>
        <span class="bridge-badge" id="bridgeBadge"></span>
        <p id="bridgeDescription"></p>
        <div class="instant-steps">
          <div><b>1</b><span id="bridgeStep1"></span></div>
          <div><b>2</b><span id="bridgeStep2"></span></div>
          <div><b>3</b><span id="bridgeStep3"></span></div>
        </div>
        <div class="actions"><button class="secondary strong" id="bridgeButton" type="button" disabled></button></div>
        <p class="bridge-note" id="bridgeNote"></p>
      </article>`;
    $("#whyModal")?.remove();
    $("#copyCode").onclick=copyCode;
    $("#refreshStatus").onclick=status;
  }

  function setStatus(text,type=""){const el=$("#statusText");if(!el)return;el.textContent=text;el.className=`status-text ${type}`.trim();}

  function setLanguage(next){
    lang=["de","en","fr"].includes(next)?next:"de";localStorage.setItem("hub_language",lang);localStorage.setItem("hubLang",lang);document.documentElement.lang=lang;document.title=t("title");
    $$('[data-lang]').forEach(btn=>btn.classList.toggle('active',btn.dataset.lang===lang));
    $("#accountStatusText")&&( $("#accountStatusText").textContent=t("pending") );$("#statusBadgeText")&&( $("#statusBadgeText").textContent=t("pending") );$("#playerName")&&( $("#playerName").textContent=t("pendingName") );$("#profileIntro")&&( $("#profileIntro").textContent=t("profileIntro") );
    $("#pendingEyebrow").textContent=t("pendingEyebrow");$("#pendingTitle").textContent=t("pendingTitle");$("#pendingDescription").textContent=t("pendingText");$("#yourCodeLabel").textContent=t("yourCode");$("#copyCode").textContent=t("copy");$("#refreshStatus").textContent=t("check");$("#pendingNote").textContent=t("pendingStatus");
    $("#bridgeEyebrow").textContent=t("bridgeEyebrow");$("#bridgeTitle").textContent=t("bridgeTitle");$("#bridgeBadge").textContent=t("bridgeBadge");$("#bridgeDescription").textContent=t("bridgeText");$("#bridgeStep1").textContent=t("bridgeStep1");$("#bridgeStep2").textContent=t("bridgeStep2");$("#bridgeStep3").textContent=t("bridgeStep3");$("#bridgeButton").textContent=t("bridgeButton");$("#bridgeNote").textContent=t("bridgeNote");
    $("#availableTitle")&&( $("#availableTitle").textContent=t("availableTitle") );$("#availableText")&&( $("#availableText").textContent=t("availableText") );$("#backToHub")&&( $("#backToHub").textContent=t("back") );
    if(current)render(current,false);else setStatus(t("loading"));
  }

  function render(data,updateStatus=true){
    current=data;const code=cleanCode(data?.code||cachedCode());$("#codeValue").textContent=code||"--------";if(updateStatus)setStatus(code?t("pendingStatus"):t("noCode"),code?"":"error");
  }

  async function status(){
    try{
      const {data:{session}}=await db.auth.getSession();if(!session){clearCache();location.href="index.html#overview";return;}
      const {data,error}=await db.rpc("get_my_registration_status");if(error)throw error;
      if(data?.status==="verified"){clearCache();location.href="index.html#profile";return;}
      if(!data||data.status==="unlinked"||data.status==="logged_out"){location.href="register.html";return;}
      writeCache(data,session);render(data);if(data.status!=="pending")setStatus(data.failure_reason||`Status: ${data.status}`,"error");
    }catch(err){console.warn("Pending status failed",err);setStatus(t("error"),"error");}
  }

  async function copyCode(){const code=cleanCode(current?.code||cachedCode());if(!code)return setStatus(t("noCode"),"error");try{await navigator.clipboard.writeText(code);setStatus(t("copied"),"success");}catch(_){setStatus(t("copyFail"),"error");}}

  injectStyles();rebuildVerificationArea();$$('[data-lang]').forEach(btn=>btn.addEventListener('click',()=>setLanguage(btn.dataset.lang)));setLanguage(lang);status();setInterval(status,15000);
})();
