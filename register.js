(() => {
  "use strict";

  const SUPABASE_URL = "https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const SIGNUP_URL = `${SUPABASE_URL}/functions/v1/hub-signup`;
  const VERIFY_URL = `${SUPABASE_URL}/functions/v1/hub-verify-registration`;
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (s) => document.querySelector(s);

  const tabBloxd=$("#tabBloxd"), tabWeb=$("#tabWeb"), bloxdForm=$("#bloxdForm"), webForm=$("#webForm");
  const message=$("#message"), pendingPanel=$("#pendingPanel"), pendingText=$("#pendingText"), pendingCodeWrap=$("#pendingCodeWrap"), pendingCode=$("#pendingCode");

  function show(text,type=""){message.textContent=text;message.className=`message ${type}`.trim();}
  function cleanShort(v){return String(v||"").toUpperCase().replace(/[\s-]+/g,"");}
  function setTab(mode){const b=mode==="bloxd";tabBloxd.classList.toggle("active",b);tabWeb.classList.toggle("active",!b);bloxdForm.classList.toggle("hidden",!b);webForm.classList.toggle("hidden",b);show("");}
  tabBloxd.onclick=()=>setTab("bloxd"); tabWeb.onclick=()=>setTab("web");

  async function setSession(result){const s=result.session;if(!s?.access_token||!s?.refresh_token)throw new Error("Account erstellt, aber Sitzung konnte nicht gestartet werden.");const {error}=await db.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});if(error)throw error;}

  function showPending(result){bloxdForm.classList.add("hidden");webForm.classList.add("hidden");document.querySelector(".tabs").classList.add("hidden");pendingPanel.classList.remove("hidden");pendingText.textContent=result.verification_source==="web_first"?"Gib den Code jetzt in Bloxd mit /verify DEINCODE ein. Falls keine HUB-Bridge online ist, wird die Bestätigung beim nächsten Bridge-Kontakt nachgeholt.":"Dein Account ist angelegt, aber noch nicht mit einer permanenten Bloxd-ID verifiziert. Sobald eine HUB-Bridge die gespeicherte Registrierung abholt, wird dein echter Bloxd-Name automatisch übernommen.";if(result.verification_code){pendingCode.textContent=result.verification_code;pendingCodeWrap.classList.remove("hidden");}else pendingCodeWrap.classList.add("hidden");}

  async function signup(payload){const r=await fetch(SIGNUP_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify(payload)});const result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(result.error||"Account konnte nicht erstellt werden.");await setSession(result);if(result.pending){showPending(result);setTimeout(()=>location.href="pending.html",650);return result;}show(`Profil ${result.username||""} erfolgreich verifiziert.`,"success");setTimeout(()=>location.href="index.html#profile",900);return result;}

  bloxdForm.addEventListener("submit",async(e)=>{e.preventDefault();show("");let code=$("#registrationCode").value.trim().replace(/\s+/g,"");const name=$("#bloxdName").value.trim(),pass=$("#password").value,repeat=$("#passwordRepeat").value;if(!code) return show("Bitte gib deinen Registrierungscode ein.","error");if(pass.length<8)return show("Das Passwort muss mindestens 8 Zeichen lang sein.","error");if(pass!==repeat)return show("Die Passwörter stimmen nicht überein.","error");if(!code.startsWith("SGR1.")){code=cleanShort(code);if(code.length!==8)return show("Der normale Code muss 8 Zeichen lang sein.","error");if(name.length<2)return show("Bitte gib deinen aktuellen Bloxd-Namen ein.","error");}const btn=$("#submitBloxd");btn.disabled=true;try{await signup({registrationCode:code,username:name,password:pass});}catch(err){show(err.message||"Fehler","error");btn.disabled=false;}});

  webForm.addEventListener("submit",async(e)=>{e.preventDefault();show("");const name=$("#webBloxdName").value.trim(),pass=$("#webPassword").value,repeat=$("#webPasswordRepeat").value;if(name.length<2)return show("Bitte gib deinen aktuellen Bloxd-Namen ein.","error");if(pass.length<8)return show("Das Passwort muss mindestens 8 Zeichen lang sein.","error");if(pass!==repeat)return show("Die Passwörter stimmen nicht überein.","error");const btn=$("#submitWeb");btn.disabled=true;try{await signup({mode:"web_first",username:name,password:pass});}catch(err){show(err.message||"Fehler","error");btn.disabled=false;}});

  async function refreshStatus(){show("Prüfe Status…");const {data,error}=await db.rpc("get_my_registration_status");if(error)return show(error.message,"error");if(data?.status==="verified"){show(`Verifiziert als ${data.current_name||"Bloxd-Spieler"}.`,"success");setTimeout(()=>location.href="index.html#profile",700);return;}if(data?.status==="pending")show("Verifizierung steht noch aus.");else if(data?.status==="rejected")show(data.failure_reason||"Verifizierung wurde abgelehnt.","error");else show(`Status: ${data?.status||"unbekannt"}`);}
  $("#checkStatus").onclick=refreshStatus;

  $("#instantVerify").onclick=async()=>{show("");const token=$("#instantCode").value.trim().replace(/\s+/g,"");if(!token.startsWith("SGR1."))return show("Bitte füge den vollständigen Sofort-Code aus /instantcode ein.","error");const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return show("Bitte melde dich zuerst an.","error");const r=await fetch(VERIFY_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({instantCode:token})});const result=await r.json().catch(()=>({}));if(!r.ok)return show(result.error||"Sofort-Verifizierung fehlgeschlagen.","error");show(`Verifiziert als ${result.username||"Bloxd-Spieler"}.`,"success");setTimeout(()=>location.href="index.html#profile",800);};

  const preset=new URLSearchParams(location.search).get("code");if(preset)$("#registrationCode").value=preset.trim();
})();
