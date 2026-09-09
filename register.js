(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const SIGNUP_URL = `${SUPABASE_URL}/functions/v1/hub-signup`;
  const BLOXD_SG_URL = "https://bloxd.io/play/classic_playerSchematic%7CHT_Y95VcEQaUBLbTc24H7?lobby=1";
  const PENDING_CACHE_KEY = "hub_pending_registration";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const I18N = {
    de: {
      title:"HUB · Bloxd verknüpfen",back:"← HUB",eyebrow:"HUB · BLOXD ACCOUNT",heading:"ACCOUNT VERKNÜPFEN",intro:"Vor der Bloxd-Verifizierung bekommt dein HUB-Account noch keinen Spielernamen. Dein echter Name wird erst übernommen, wenn deine permanente Bloxd-ID bestätigt wurde.",
      tabBloxd:"TUTORIAL",codeLabel:"REGISTRIERUNGSCODE",codePlaceholder:"8 Zeichen",password:"PASSWORT",passwordRepeat:"PASSWORT WIEDERHOLEN",createAccount:"ACCOUNT ERSTELLEN",getCode:"CODE HOLEN",
      tutorialTrigger:"WIE VERIFIZIERE ICH MICH?",tutorialKicker:"BLOXD VERIFIZIERUNG",tutorialStep:(n)=>`SCHRITT ${n}`,tutorialBack:"ZURÜCK",tutorialNext:"WEITER",tutorialDone:"FERTIG",
      tutorialSteps:[
        {title:"HOL DIR DEINEN CODE",copy:"Klicke unten auf „CODE HOLEN“. Bloxd öffnet sich in einem neuen Tab und bringt dich direkt zu unserer Survival-Games-Welt.",visual:"buttons"},
        {title:"BETRITT BLOXD",copy:"Tritt der HUB Survival-Games-Welt bei und warte, bis du vollständig im Spiel angekommen bist.",visual:"world"},
        {title:"GIB /register EIN",copy:"Öffne den Bloxd-Chat, gib /register ein und sende den Befehl ab. Du erhältst deinen persönlichen 8-Zeichen-Registrierungscode.",visual:"command"},
        {title:"CODE IM HUB EINGEBEN",copy:"Kehre zum HUB zurück, füge den Registrierungscode ein und wähle dein Passwort. Deinen Spielernamen musst du nicht selbst eingeben.",visual:"field"},
        {title:"ACCOUNT ERSTELLEN",copy:"Klicke auf „ACCOUNT ERSTELLEN“. Danach landest du direkt auf deinem Pending-Profil, bis deine Bloxd-ID bestätigt wurde.",visual:"success"}
      ],
      bloxdHelp:"In Bloxd: /register → 8-Zeichen-Code hier eingeben.",sessionFail:"Account erstellt, aber Sitzung konnte nicht gestartet werden.",signupFail:"Account konnte nicht erstellt werden.",verifiedProfile:(n)=>`Profil ${n||"Bloxd-Spieler"} erfolgreich verifiziert.`,needCode:"Bitte gib deinen Registrierungscode ein.",passMin:"Das Passwort muss mindestens 8 Zeichen lang sein.",passMismatch:"Die Passwörter stimmen nicht überein.",shortLen:"Der Registrierungscode muss 8 Zeichen lang sein.",error:"Fehler"
    },
    en: {
      title:"HUB · Link Bloxd",back:"← HUB",eyebrow:"HUB · BLOXD ACCOUNT",heading:"LINK ACCOUNT",intro:"Before Bloxd verification, your HUB account does not have a player name yet. Your real name is added only after your permanent Bloxd ID has been confirmed.",
      tabBloxd:"TUTORIAL",codeLabel:"REGISTRATION CODE",codePlaceholder:"8 characters",password:"PASSWORD",passwordRepeat:"REPEAT PASSWORD",createAccount:"CREATE ACCOUNT",getCode:"GET CODE",
      tutorialTrigger:"HOW DO I VERIFY?",tutorialKicker:"BLOXD VERIFICATION",tutorialStep:(n)=>`STEP ${n}`,tutorialBack:"BACK",tutorialNext:"NEXT",tutorialDone:"DONE",
      tutorialSteps:[
        {title:"GET YOUR CODE",copy:"Click “GET CODE” below. Bloxd opens in a new tab and takes you directly to our Survival Games world.",visual:"buttons"},
        {title:"JOIN BLOXD",copy:"Join the HUB Survival Games world and wait until you have fully loaded into the game.",visual:"world"},
        {title:"TYPE /register",copy:"Open the Bloxd chat, type /register and send the command. Bloxd will show your personal 8-character registration code.",visual:"command"},
        {title:"ENTER THE CODE",copy:"Return to the HUB, enter the registration code and choose your password. You do not need to enter your player name yourself.",visual:"field"},
        {title:"CREATE ACCOUNT",copy:"Click “CREATE ACCOUNT”. You are then taken directly to your Pending profile until your Bloxd ID is confirmed.",visual:"success"}
      ],
      bloxdHelp:"In Bloxd: /register → enter the 8-character code here.",sessionFail:"Account created, but the session could not be started.",signupFail:"Account could not be created.",verifiedProfile:(n)=>`Profile ${n||"Bloxd player"} verified successfully.`,needCode:"Please enter your registration code.",passMin:"The password must be at least 8 characters long.",passMismatch:"The passwords do not match.",shortLen:"The registration code must be 8 characters long.",error:"Error"
    },
    fr: {
      title:"HUB · Lier Bloxd",back:"← HUB",eyebrow:"HUB · COMPTE BLOXD",heading:"LIER LE COMPTE",intro:"Avant la vérification Bloxd, ton compte HUB n’a pas encore de nom de joueur. Ton vrai nom est ajouté uniquement après confirmation de ton identifiant Bloxd permanent.",
      tabBloxd:"TUTORIAL",codeLabel:"CODE D’INSCRIPTION",codePlaceholder:"8 caractères",password:"MOT DE PASSE",passwordRepeat:"RÉPÉTER LE MOT DE PASSE",createAccount:"CRÉER LE COMPTE",getCode:"OBTENIR LE CODE",
      tutorialTrigger:"COMMENT ME VÉRIFIER ?",tutorialKicker:"VÉRIFICATION BLOXD",tutorialStep:(n)=>`ÉTAPE ${n}`,tutorialBack:"RETOUR",tutorialNext:"SUIVANT",tutorialDone:"TERMINÉ",
      tutorialSteps:[
        {title:"OBTIENS TON CODE",copy:"Clique sur « OBTENIR LE CODE ». Bloxd s’ouvre dans un nouvel onglet et t’envoie directement vers notre monde Survival Games.",visual:"buttons"},
        {title:"REJOINS BLOXD",copy:"Rejoins le monde HUB Survival Games et attends que le jeu soit complètement chargé.",visual:"world"},
        {title:"ENTRE /register",copy:"Ouvre le chat Bloxd, entre /register et envoie la commande. Bloxd affiche alors ton code d’inscription personnel à 8 caractères.",visual:"command"},
        {title:"ENTRE LE CODE",copy:"Reviens dans le HUB, saisis ton code d’inscription puis choisis ton mot de passe. Tu n’as pas besoin de saisir ton nom de joueur.",visual:"field"},
        {title:"CRÉE TON COMPTE",copy:"Clique sur « CRÉER LE COMPTE ». Tu arrives ensuite directement sur ton profil Pending jusqu’à confirmation de ton identifiant Bloxd.",visual:"success"}
      ],
      bloxdHelp:"Dans Bloxd : /register → saisis ici le code à 8 caractères.",sessionFail:"Le compte a été créé, mais la session n’a pas pu démarrer.",signupFail:"Le compte n’a pas pu être créé.",verifiedProfile:(n)=>`Profil ${n||"joueur Bloxd"} vérifié avec succès.`,needCode:"Entre ton code d’inscription.",passMin:"Le mot de passe doit contenir au moins 8 caractères.",passMismatch:"Les mots de passe ne correspondent pas.",shortLen:"Le code d’inscription doit contenir 8 caractères.",error:"Erreur"
    }
  };

  let lang = detectLanguage();
  let tutorialStep = 0;
  const t = (k,...args)=>{const v=I18N[lang]?.[k]??I18N.de[k]??k;return typeof v==='function'?v(...args):v;};

  function detectLanguage(){const raw=String(localStorage.getItem('hub_language')||localStorage.getItem('hubLang')||navigator.language||'de').toLowerCase();return raw.startsWith('fr')?'fr':raw.startsWith('en')?'en':'de';}
  function cleanShort(v){return String(v||'').toUpperCase().replace(/[\s-]+/g,'').replace(/[^A-Z0-9]/g,'');}
  function show(text,type=''){const el=$('#message');el.textContent=text;el.className=`message ${type}`.trim();}

  function tutorialVisual(type){
    if(type==='buttons')return `<div class="tutorial-illustration"><div class="tutorial-ui-row"><div class="tutorial-ui-button">${t('createAccount')}</div><div class="tutorial-ui-button accent">${t('getCode')}</div></div></div>`;
    if(type==='world')return '<div class="tutorial-illustration"><div class="tutorial-browser"><div class="tutorial-browser-bar"><i></i><i></i><i></i></div><div class="tutorial-world">HUB · SURVIVAL GAMES</div></div></div>';
    if(type==='command')return '<div class="tutorial-illustration"><div class="tutorial-command"><span>BLOXD CHAT</span><code>/register</code></div></div>';
    if(type==='field')return `<div class="tutorial-illustration"><div class="tutorial-code-field"><span>${t('codeLabel')}</span><div class="tutorial-code-input">A7K4P2Q9</div></div></div>`;
    return `<div class="tutorial-illustration"><div class="tutorial-success"><div class="tutorial-check">✓</div><strong>${t('createAccount')}</strong></div></div>`;
  }

  function renderTutorial(){
    const steps=I18N[lang].tutorialSteps,step=steps[tutorialStep];
    $('#tutorialTriggerLabel').textContent=t('tutorialTrigger');$('#tutorialKicker').textContent=t('tutorialKicker');$('#tutorialCount').textContent=`${tutorialStep+1} / ${steps.length}`;$('#tutorialProgressFill').style.width=`${((tutorialStep+1)/steps.length)*100}%`;$('#tutorialStepLabel').textContent=t('tutorialStep',tutorialStep+1);$('#tutorialTitle').textContent=step.title;$('#tutorialCopy').textContent=step.copy;$('#tutorialBack').textContent=t('tutorialBack');$('#tutorialBack').disabled=tutorialStep===0;$('#tutorialNext').textContent=tutorialStep===steps.length-1?t('tutorialDone'):t('tutorialNext');$('#tutorialVisual').innerHTML=tutorialVisual(step.visual);
  }
  function openTutorial(){tutorialStep=0;renderTutorial();$('#verifyTutorial').classList.remove('hidden');document.body.style.overflow='hidden';$('#tutorialClose').focus();}
  function closeTutorial(){$('#verifyTutorial').classList.add('hidden');document.body.style.overflow='';$('#tutorialTrigger').focus();}

  function setLanguage(next){
    lang=['de','en','fr'].includes(next)?next:'de';localStorage.setItem('hub_language',lang);localStorage.setItem('hubLang',lang);document.documentElement.lang=lang;document.title=t('title');
    $$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
    $('#backHub').textContent=t('back');$('#eyebrow').textContent=t('eyebrow');$('#title').textContent=t('heading');$('#intro').textContent=t('intro');$('#tabBloxd').textContent=t('tabBloxd');$('#registrationCodeLabel').textContent=t('codeLabel');$('#registrationCode').placeholder=t('codePlaceholder');$('#passwordLabel').textContent=t('password');$('#passwordRepeatLabel').textContent=t('passwordRepeat');$('#submitBloxd').textContent=t('createAccount');$('#getBloxdCode').textContent=t('getCode');$('#bloxdHelp').innerHTML=t('bloxdHelp').replace('/register','<strong>/register</strong>');renderTutorial();
  }

  function cachePending(result,code){try{localStorage.setItem(PENDING_CACHE_KEY,JSON.stringify({status:'pending',auth_user_id:result?.user?.id||'',source:result?.verification_source||'',code:cleanShort(code),cached_at:Date.now()}));}catch(_){}}
  function clearPendingCache(){try{localStorage.removeItem(PENDING_CACHE_KEY);}catch(_){}}
  async function setSession(result){const s=result.session;if(!s?.access_token||!s?.refresh_token)throw new Error(t('sessionFail'));const {error}=await db.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});if(error)throw error;}

  async function signup(payload){
    const r=await fetch(SIGNUP_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY},body:JSON.stringify(payload)});
    const result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(result.error||t('signupFail'));await setSession(result);
    if(result.pending){cachePending(result,payload.registrationCode);location.href='pending.html';return result;}
    clearPendingCache();show(t('verifiedProfile',result.username),'success');setTimeout(()=>location.href='index.html#profile',900);return result;
  }

  $$('[data-lang]').forEach(b=>b.onclick=()=>setLanguage(b.dataset.lang));
  $('#getBloxdCode').onclick=()=>window.open(BLOXD_SG_URL,'_blank','noopener,noreferrer');$('#tutorialTrigger').onclick=openTutorial;$('#tabBloxd').onclick=openTutorial;$('#tutorialClose').onclick=closeTutorial;$('#verifyTutorial').addEventListener('click',e=>{if(e.target===$('#verifyTutorial'))closeTutorial();});$('#tutorialBack').onclick=()=>{if(tutorialStep>0){tutorialStep--;renderTutorial();}};$('#tutorialNext').onclick=()=>{const last=I18N[lang].tutorialSteps.length-1;if(tutorialStep>=last)return closeTutorial();tutorialStep++;renderTutorial();};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#verifyTutorial').classList.contains('hidden'))closeTutorial();});

  $('#bloxdForm').addEventListener('submit',async e=>{
    e.preventDefault();show('');const code=cleanShort($('#registrationCode').value),pass=$('#password').value,repeat=$('#passwordRepeat').value;
    if(!code)return show(t('needCode'),'error');if(code.length!==8)return show(t('shortLen'),'error');if(pass.length<8)return show(t('passMin'),'error');if(pass!==repeat)return show(t('passMismatch'),'error');
    const btn=$('#submitBloxd');btn.disabled=true;try{await signup({registrationCode:code,password:pass});}catch(err){show(err.message||t('error'),'error');btn.disabled=false;}
  });

  const preset=new URLSearchParams(location.search).get('code');if(preset)$('#registrationCode').value=cleanShort(preset).slice(0,8);setLanguage(lang);
})();
