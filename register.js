(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const SIGNUP_URL = `${SUPABASE_URL}/functions/v1/hub-signup`;
  const VERIFY_URL = `${SUPABASE_URL}/functions/v1/hub-verify-registration`;
  const BLOXD_SG_URL = "https://bloxd.io/play/classic_playerSchematic%7CHT_Y95VcEQaUBLbTc24H7?lobby=1";
  const PENDING_CACHE_KEY = "hub_pending_registration";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const I18N={
    de:{
      title:"HUB · Bloxd verknüpfen",back:"← HUB",eyebrow:"HUB · BLOXD ACCOUNT",heading:"ACCOUNT VERKNÜPFEN",intro:"Vor der Bloxd-Verifizierung bekommt dein HUB-Account noch keinen Spielernamen. Dein echter Name wird erst übernommen, wenn deine permanente Bloxd-ID bestätigt wurde.",
      tabBloxd:"ICH HABE EINEN BLOXD-CODE",tabWeb:"AUF WEBSITE STARTEN",codeLabel:"REGISTRIERUNGSCODE",codePlaceholder:"8 Zeichen oder SGR1.…",password:"PASSWORT",passwordRepeat:"PASSWORT WIEDERHOLEN",createAccount:"ACCOUNT ERSTELLEN",createCode:"CODE ERSTELLEN",
      bloxdHelp:"Standard: /register gibt dir einen kurzen 8-Zeichen-Code. Dein echter Bloxd-Name wird erst nach der Verifizierung übernommen.",webHelp:"Danach bekommst du einen 8-Zeichen-Code. Gib ihn in Bloxd mit /verify DEINCODE ein. Bis zur Bestätigung heißt dein HUB-Account nur Pending.",
      pending:"VERIFIZIERUNG AUSSTEHEND",accountCreated:"Account erstellt",yourCode:"DEIN CODE",check:"STATUS PRÜFEN",instantHelp:"Sofort freischalten? Gib in Bloxd /instantcode ein und füge den längeren Code hier ein.",instantVerify:"SOFORT VERIFIZIEREN",hint:"Unverifizierte Accounts haben noch keinen Spielernamen und können keine bestehenden Stats übernehmen, keine Freunde verwalten und sich nicht selbst für Turniere anmelden. Name und Stats werden erst aus Bloxd übernommen.",
      pendingWeb:"Gib den 8-Zeichen-Code jetzt in der Bloxd.io Lobby mit /verify DEINCODE ein. Bis deine echte Bloxd-ID bestätigt wurde, heißt dein HUB-Account nur Pending.",pendingBloxd:"Dein Account ist angelegt. Bis deine echte Bloxd-ID bestätigt wurde, heißt dein HUB-Account nur Pending. Deine Stats und dein echter Name werden danach automatisch übernommen.",verifyNow:"JETZT VERIFIZIEREN",registerNow:"JETZT REGISTRIEREN",goHub:"ZUM HUB",
      sessionFail:"Account erstellt, aber Sitzung konnte nicht gestartet werden.",signupFail:"Account konnte nicht erstellt werden.",verifiedProfile:(n)=>`Profil ${n||"Bloxd-Spieler"} erfolgreich verifiziert.`,needCode:"Bitte gib deinen Registrierungscode ein.",passMin:"Das Passwort muss mindestens 8 Zeichen lang sein.",passMismatch:"Die Passwörter stimmen nicht überein.",shortLen:"Der normale Code muss 8 Zeichen lang sein.",checking:"Prüfe Status…",verifiedAs:(n)=>`Verifiziert als ${n||"Bloxd-Spieler"}.`,stillPending:"Verifizierung steht noch aus. Dein Account bleibt bis dahin Pending.",rejected:"Verifizierung wurde abgelehnt.",unknown:"unbekannt",instantMissing:"Bitte füge den vollständigen Sofort-Code aus /instantcode ein.",loginFirst:"Bitte melde dich zuerst an.",instantFail:"Sofort-Verifizierung fehlgeschlagen.",error:"Fehler"
    },
    en:{
      title:"HUB · Link Bloxd",back:"← HUB",eyebrow:"HUB · BLOXD ACCOUNT",heading:"LINK ACCOUNT",intro:"Before Bloxd verification, your HUB account does not have a player name yet. Your real name is added only after your permanent Bloxd ID has been confirmed.",
      tabBloxd:"I HAVE A BLOXD CODE",tabWeb:"START ON WEBSITE",codeLabel:"REGISTRATION CODE",codePlaceholder:"8 characters or SGR1.…",password:"PASSWORD",passwordRepeat:"REPEAT PASSWORD",createAccount:"CREATE ACCOUNT",createCode:"CREATE CODE",
      bloxdHelp:"Standard: /register gives you a short 8-character code. Your real Bloxd name is added only after verification.",webHelp:"You will receive an 8-character code. Enter it in Bloxd with /verify YOURCODE. Until confirmation, your HUB account is shown only as Pending.",
      pending:"VERIFICATION PENDING",accountCreated:"Account created",yourCode:"YOUR CODE",check:"CHECK STATUS",instantHelp:"Unlock immediately? Enter /instantcode in Bloxd and paste the longer code here.",instantVerify:"VERIFY IMMEDIATELY",hint:"Unverified accounts do not have a player name yet and cannot claim existing stats, manage friends or register themselves for tournaments. Name and stats are taken from Bloxd only after verification.",
      pendingWeb:"Enter the 8-character code in the Bloxd.io lobby with /verify YOURCODE. Until your real Bloxd ID is confirmed, your HUB account remains Pending.",pendingBloxd:"Your account has been created. Until your real Bloxd ID is confirmed, your HUB account remains Pending. Your stats and real name are added automatically afterwards.",verifyNow:"VERIFY NOW",registerNow:"REGISTER NOW",goHub:"TO HUB",
      sessionFail:"Account created, but the session could not be started.",signupFail:"Account could not be created.",verifiedProfile:(n)=>`Profile ${n||"Bloxd player"} verified successfully.`,needCode:"Please enter your registration code.",passMin:"The password must be at least 8 characters long.",passMismatch:"The passwords do not match.",shortLen:"The normal code must be 8 characters long.",checking:"Checking status…",verifiedAs:(n)=>`Verified as ${n||"Bloxd player"}.`,stillPending:"Verification is still pending. Your account remains Pending until confirmation.",rejected:"Verification was rejected.",unknown:"unknown",instantMissing:"Please paste the complete instant code from /instantcode.",loginFirst:"Please sign in first.",instantFail:"Instant verification failed.",error:"Error"
    },
    fr:{
      title:"HUB · Lier Bloxd",back:"← HUB",eyebrow:"HUB · COMPTE BLOXD",heading:"LIER LE COMPTE",intro:"Avant la vérification Bloxd, ton compte HUB n’a pas encore de nom de joueur. Ton vrai nom est ajouté uniquement après confirmation de ton identifiant Bloxd permanent.",
      tabBloxd:"J’AI UN CODE BLOXD",tabWeb:"COMMENCER SUR LE SITE",codeLabel:"CODE D’INSCRIPTION",codePlaceholder:"8 caractères ou SGR1.…",password:"MOT DE PASSE",passwordRepeat:"RÉPÉTER LE MOT DE PASSE",createAccount:"CRÉER LE COMPTE",createCode:"CRÉER LE CODE",
      bloxdHelp:"Standard : /register te donne un code court de 8 caractères. Ton vrai nom Bloxd est ajouté seulement après la vérification.",webHelp:"Tu recevras un code de 8 caractères. Entre-le dans Bloxd avec /verify TONCODE. Jusqu’à la confirmation, ton compte HUB reste affiché comme Pending.",
      pending:"VÉRIFICATION EN ATTENTE",accountCreated:"Compte créé",yourCode:"TON CODE",check:"VÉRIFIER LE STATUT",instantHelp:"Débloquer immédiatement ? Entre /instantcode dans Bloxd puis colle ici le code plus long.",instantVerify:"VÉRIFIER IMMÉDIATEMENT",hint:"Les comptes non vérifiés n’ont pas encore de nom de joueur et ne peuvent pas récupérer des statistiques existantes, gérer des amis ni s’inscrire eux-mêmes aux tournois. Le nom et les statistiques proviennent de Bloxd uniquement après vérification.",
      pendingWeb:"Entre le code de 8 caractères dans le lobby Bloxd.io avec /verify TONCODE. Tant que ton identifiant Bloxd réel n’est pas confirmé, ton compte HUB reste Pending.",pendingBloxd:"Ton compte est créé. Tant que ton identifiant Bloxd réel n’est pas confirmé, ton compte HUB reste Pending. Tes statistiques et ton vrai nom seront ajoutés automatiquement ensuite.",verifyNow:"VÉRIFIER MAINTENANT",registerNow:"S’INSCRIRE MAINTENANT",goHub:"VERS LE HUB",
      sessionFail:"Le compte a été créé, mais la session n’a pas pu démarrer.",signupFail:"Le compte n’a pas pu être créé.",verifiedProfile:(n)=>`Profil ${n||"joueur Bloxd"} vérifié avec succès.`,needCode:"Entre ton code d’inscription.",passMin:"Le mot de passe doit contenir au moins 8 caractères.",passMismatch:"Les mots de passe ne correspondent pas.",shortLen:"Le code normal doit contenir 8 caractères.",checking:"Vérification du statut…",verifiedAs:(n)=>`Vérifié en tant que ${n||"joueur Bloxd"}.`,stillPending:"La vérification est toujours en attente. Ton compte reste Pending jusqu’à confirmation.",rejected:"La vérification a été refusée.",unknown:"inconnu",instantMissing:"Colle le code instantané complet obtenu avec /instantcode.",loginFirst:"Connecte-toi d’abord.",instantFail:"La vérification instantanée a échoué.",error:"Erreur"
    }
  };

  let lang=detectLanguage();
  let currentPendingResult=null;
  const t=(k,...args)=>{const v=I18N[lang]?.[k]??I18N.de[k]??k;return typeof v==='function'?v(...args):v;};
  function detectLanguage(){const raw=String(localStorage.getItem('hub_language')||localStorage.getItem('hubLang')||navigator.language||'de').toLowerCase();return raw.startsWith('fr')?'fr':raw.startsWith('en')?'en':'de';}
  function setLanguage(next){
    lang=['de','en','fr'].includes(next)?next:'de';
    localStorage.setItem('hub_language',lang);localStorage.setItem('hubLang',lang);document.documentElement.lang=lang;document.title=t('title');
    $$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
    $('#backHub').textContent=t('back');$('#eyebrow').textContent=t('eyebrow');$('#title').textContent=t('heading');$('#intro').textContent=t('intro');
    $('#tabBloxd').textContent=t('tabBloxd');$('#tabWeb').textContent=t('tabWeb');$('#registrationCodeLabel').textContent=t('codeLabel');$('#registrationCode').placeholder=t('codePlaceholder');
    $('#passwordLabel').textContent=t('password');$('#passwordRepeatLabel').textContent=t('passwordRepeat');$('#webPasswordLabel').textContent=t('password');$('#webPasswordRepeatLabel').textContent=t('passwordRepeat');
    $('#submitBloxd').textContent=t('createAccount');$('#submitWeb').textContent=t('createCode');$('#bloxdHelp').innerHTML=t('bloxdHelp').replace('/register','<strong>/register</strong>');$('#webHelp').innerHTML=t('webHelp').replace('/verify DEINCODE','<strong>/verify DEINCODE</strong>').replace('/verify YOURCODE','<strong>/verify YOURCODE</strong>').replace('/verify TONCODE','<strong>/verify TONCODE</strong>').replace('Pending','<strong>Pending</strong>');
    $('#pendingPill').textContent=t('pending');$('#pendingTitle').textContent=t('accountCreated');$('#yourCodeLabel').textContent=t('yourCode');$('#checkStatus').textContent=t('check');$('#instantHelp').innerHTML=t('instantHelp').replace('/instantcode','<code>/instantcode</code>');$('#instantVerify').textContent=t('instantVerify');$('#hint').textContent=t('hint');
    if(currentPendingResult)renderPendingCopy(currentPendingResult);
  }

  const tabBloxd=$("#tabBloxd"), tabWeb=$("#tabWeb"), bloxdForm=$("#bloxdForm"), webForm=$("#webForm");
  const message=$("#message"), pendingPanel=$("#pendingPanel"), pendingText=$("#pendingText"), pendingCodeWrap=$("#pendingCodeWrap"), pendingCode=$("#pendingCode");

  function show(text,type=""){message.textContent=text;message.className=`message ${type}`.trim();}
  function cleanShort(v){return String(v||"").toUpperCase().replace(/[\s-]+/g,"");}
  function setTab(mode){const b=mode==="bloxd";tabBloxd.classList.toggle("active",b);tabWeb.classList.toggle("active",!b);bloxdForm.classList.toggle("hidden",!b);webForm.classList.toggle("hidden",b);show("");}
  tabBloxd.onclick=()=>setTab("bloxd"); tabWeb.onclick=()=>setTab("web");
  $$('[data-lang]').forEach(b=>b.onclick=()=>setLanguage(b.dataset.lang));

  function cachePending(result){try{localStorage.setItem(PENDING_CACHE_KEY,JSON.stringify({status:"pending",auth_user_id:result?.user?.id||"",source:result?.verification_source||"",cached_at:Date.now()}));}catch(_){} }
  function clearPendingCache(){try{localStorage.removeItem(PENDING_CACHE_KEY);}catch(_){} }

  async function setSession(result){const s=result.session;if(!s?.access_token||!s?.refresh_token)throw new Error(t('sessionFail'));const {error}=await db.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});if(error)throw error;}

  function renderPendingCopy(result){
    const webFirst=result.verification_source==="web_first";
    pendingText.textContent=webFirst?t('pendingWeb'):t('pendingBloxd');
    let verify=document.querySelector('#pendingOpenVerify');
    if(verify)verify.textContent=webFirst?t('verifyNow'):t('registerNow');
    const go=document.querySelector('#pendingGoHub');if(go)go.textContent=t('goHub');
  }

  function showPending(result){
    currentPendingResult=result;cachePending(result);
    bloxdForm.classList.add("hidden");webForm.classList.add("hidden");document.querySelector(".tabs").classList.add("hidden");pendingPanel.classList.remove("hidden");
    if(result.verification_code){pendingCode.textContent=result.verification_code;pendingCodeWrap.classList.remove("hidden");}else pendingCodeWrap.classList.add("hidden");
    let verify=document.querySelector('#pendingOpenVerify');
    if(!verify){verify=document.createElement('button');verify.id='pendingOpenVerify';verify.type='button';verify.className='secondary';pendingPanel.insertBefore(verify,document.querySelector('#checkStatus'));}
    verify.hidden=false;verify.onclick=()=>window.open(BLOXD_SG_URL,'_blank','noopener,noreferrer');
    let go=document.querySelector('#pendingGoHub');
    if(!go){go=document.createElement('button');go.id='pendingGoHub';go.type='button';go.className='secondary';pendingPanel.insertBefore(go,document.querySelector('#checkStatus'));go.onclick=()=>location.href='index.html#overview';}
    renderPendingCopy(result);
  }

  async function signup(payload){
    const r=await fetch(SIGNUP_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify(payload)});
    const result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(result.error||t('signupFail'));
    await setSession(result);
    if(result.pending){showPending(result);return result;}
    clearPendingCache();show(t('verifiedProfile',result.username),"success");setTimeout(()=>location.href="index.html#profile",900);return result;
  }

  bloxdForm.addEventListener("submit",async(e)=>{
    e.preventDefault();show("");let code=$("#registrationCode").value.trim().replace(/\s+/g,"");const pass=$("#password").value,repeat=$("#passwordRepeat").value;
    if(!code)return show(t('needCode'),"error");if(pass.length<8)return show(t('passMin'),"error");if(pass!==repeat)return show(t('passMismatch'),"error");if(!code.startsWith("SGR1.")){code=cleanShort(code);if(code.length!==8)return show(t('shortLen'),"error");}
    const btn=$("#submitBloxd");btn.disabled=true;try{await signup({registrationCode:code,password:pass});}catch(err){show(err.message||t('error'),"error");btn.disabled=false;}
  });

  webForm.addEventListener("submit",async(e)=>{
    e.preventDefault();show("");const pass=$("#webPassword").value,repeat=$("#webPasswordRepeat").value;if(pass.length<8)return show(t('passMin'),"error");if(pass!==repeat)return show(t('passMismatch'),"error");
    const btn=$("#submitWeb");btn.disabled=true;try{await signup({mode:"web_first",password:pass});btn.disabled=false;}catch(err){show(err.message||t('error'),"error");btn.disabled=false;}
  });

  async function refreshStatus(){
    show(t('checking'));const {data,error}=await db.rpc("get_my_registration_status");if(error)return show(error.message,"error");
    if(data?.status==="verified"){clearPendingCache();show(t('verifiedAs',data.current_name),"success");setTimeout(()=>location.href="index.html#profile",700);return;}
    if(data?.status==="pending")show(t('stillPending'));else if(data?.status==="rejected")show(data.failure_reason||t('rejected'),"error");else show(`Status: ${data?.status||t('unknown')}`);
  }
  $("#checkStatus").onclick=refreshStatus;

  $("#instantVerify").onclick=async()=>{
    show("");const token=$("#instantCode").value.trim().replace(/\s+/g,"");if(!token.startsWith("SGR1."))return show(t('instantMissing'),"error");
    const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return show(t('loginFirst'),"error");
    const r=await fetch(VERIFY_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({instantCode:token})});const result=await r.json().catch(()=>({}));if(!r.ok)return show(result.error||t('instantFail'),"error");
    clearPendingCache();show(t('verifiedAs',result.username),"success");setTimeout(()=>location.href="index.html#profile",800);
  };

  const preset=new URLSearchParams(location.search).get("code");if(preset)$("#registrationCode").value=preset.trim();
  setLanguage(lang);
})();
