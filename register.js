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

  const tabBloxd=$("#tabBloxd"), tabWeb=$("#tabWeb"), bloxdForm=$("#bloxdForm"), webForm=$("#webForm");
  const message=$("#message"), pendingPanel=$("#pendingPanel"), pendingText=$("#pendingText"), pendingCodeWrap=$("#pendingCodeWrap"), pendingCode=$("#pendingCode");

  function show(text,type=""){message.textContent=text;message.className=`message ${type}`.trim();}
  function cleanShort(v){return String(v||"").toUpperCase().replace(/[\s-]+/g,"");}
  function setTab(mode){const b=mode==="bloxd";tabBloxd.classList.toggle("active",b);tabWeb.classList.toggle("active",!b);bloxdForm.classList.toggle("hidden",!b);webForm.classList.toggle("hidden",b);show("");}
  tabBloxd.onclick=()=>setTab("bloxd"); tabWeb.onclick=()=>setTab("web");

  function cachePending(result){
    try{
      localStorage.setItem(PENDING_CACHE_KEY,JSON.stringify({
        status:"pending",
        auth_user_id:result?.user?.id||"",
        source:result?.verification_source||"",
        cached_at:Date.now()
      }));
    }catch(_){}
  }
  function clearPendingCache(){try{localStorage.removeItem(PENDING_CACHE_KEY);}catch(_){}}

  async function setSession(result){const s=result.session;if(!s?.access_token||!s?.refresh_token)throw new Error("Account erstellt, aber Sitzung konnte nicht gestartet werden.");const {error}=await db.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});if(error)throw error;}

  function showPending(result){
    cachePending(result);
    bloxdForm.classList.add("hidden");webForm.classList.add("hidden");document.querySelector(".tabs").classList.add("hidden");pendingPanel.classList.remove("hidden");
    const webFirst=result.verification_source==="web_first";
    pendingText.textContent=webFirst
      ?"Gib den 8-Zeichen-Code jetzt in der Bloxd.io Lobby mit /verify DEINCODE ein. Bis deine echte Bloxd-ID bestätigt wurde, heißt dein HUB-Account nur Pending."
      :"Dein Account ist angelegt. Bis deine echte Bloxd-ID bestätigt wurde, heißt dein HUB-Account nur Pending. Deine Stats und dein echter Name werden danach automatisch übernommen.";
    if(result.verification_code){pendingCode.textContent=result.verification_code;pendingCodeWrap.classList.remove("hidden");}else pendingCodeWrap.classList.add("hidden");

    let verify=document.querySelector('#pendingOpenVerify');
    if(!verify){verify=document.createElement('button');verify.id='pendingOpenVerify';verify.type='button';verify.className='secondary';pendingPanel.insertBefore(verify,document.querySelector('#checkStatus'));}
    verify.hidden=false;
    verify.textContent=webFirst?'JETZT VERIFIZIEREN':'JETZT REGISTRIEREN';
    verify.onclick=()=>window.open(BLOXD_SG_URL,'_blank','noopener,noreferrer');

    let go=document.querySelector('#pendingGoHub');
    if(!go){go=document.createElement('button');go.id='pendingGoHub';go.type='button';go.className='secondary';go.textContent='ZUM HUB';pendingPanel.insertBefore(go,document.querySelector('#checkStatus'));go.onclick=()=>location.href='index.html#overview';}
  }

  async function signup(payload){
    const r=await fetch(SIGNUP_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify(payload)});
    const result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(result.error||"Account konnte nicht erstellt werden.");
    await setSession(result);
    if(result.pending){showPending(result);return result;}
    clearPendingCache();
    show(`Profil ${result.username||"Bloxd-Spieler"} erfolgreich verifiziert.`,"success");setTimeout(()=>location.href="index.html#profile",900);return result;
  }

  bloxdForm.addEventListener("submit",async(e)=>{
    e.preventDefault();show("");
    let code=$("#registrationCode").value.trim().replace(/\s+/g,"");
    const pass=$("#password").value,repeat=$("#passwordRepeat").value;
    if(!code)return show("Bitte gib deinen Registrierungscode ein.","error");
    if(pass.length<8)return show("Das Passwort muss mindestens 8 Zeichen lang sein.","error");
    if(pass!==repeat)return show("Die Passwörter stimmen nicht überein.","error");
    if(!code.startsWith("SGR1.")){code=cleanShort(code);if(code.length!==8)return show("Der normale Code muss 8 Zeichen lang sein.","error");}
    const btn=$("#submitBloxd");btn.disabled=true;
    try{await signup({registrationCode:code,password:pass});}catch(err){show(err.message||"Fehler","error");btn.disabled=false;}
  });

  webForm.addEventListener("submit",async(e)=>{
    e.preventDefault();show("");
    const pass=$("#webPassword").value,repeat=$("#webPasswordRepeat").value;
    if(pass.length<8)return show("Das Passwort muss mindestens 8 Zeichen lang sein.","error");
    if(pass!==repeat)return show("Die Passwörter stimmen nicht überein.","error");
    const btn=$("#submitWeb");btn.disabled=true;
    try{await signup({mode:"web_first",password:pass});btn.disabled=false;}catch(err){show(err.message||"Fehler","error");btn.disabled=false;}
  });

  async function refreshStatus(){
    show("Prüfe Status…");
    const {data,error}=await db.rpc("get_my_registration_status");
    if(error)return show(error.message,"error");
    if(data?.status==="verified"){
      clearPendingCache();
      show(`Verifiziert als ${data.current_name||"Bloxd-Spieler"}.`,"success");
      setTimeout(()=>location.href="index.html#profile",700);return;
    }
    if(data?.status==="pending")show("Verifizierung steht noch aus. Dein Account bleibt bis dahin Pending.");
    else if(data?.status==="rejected")show(data.failure_reason||"Verifizierung wurde abgelehnt.","error");
    else show(`Status: ${data?.status||"unbekannt"}`);
  }
  $("#checkStatus").onclick=refreshStatus;

  $("#instantVerify").onclick=async()=>{
    show("");
    const token=$("#instantCode").value.trim().replace(/\s+/g,"");
    if(!token.startsWith("SGR1."))return show("Bitte füge den vollständigen Sofort-Code aus /instantcode ein.","error");
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)return show("Bitte melde dich zuerst an.","error");
    const r=await fetch(VERIFY_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({instantCode:token})});
    const result=await r.json().catch(()=>({}));
    if(!r.ok)return show(result.error||"Sofort-Verifizierung fehlgeschlagen.","error");
    clearPendingCache();
    show(`Verifiziert als ${result.username||"Bloxd-Spieler"}.`,"success");
    setTimeout(()=>location.href="index.html#profile",800);
  };

  const preset=new URLSearchParams(location.search).get("code");if(preset)$("#registrationCode").value=preset.trim();
})();
