(() => {
  "use strict";

  const SUPABASE_URL="https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY="sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const ASSERT_URL=`${SUPABASE_URL}/functions/v1/hub-verify-assertion`;
  const SOURCE_EXTENSION="HUB_VERIFY_EXTENSION";
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  let timer=null;

  const cleanCode=(v)=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
  const lang=()=>{const raw=String(localStorage.getItem("hub_language")||localStorage.getItem("hubLang")||document.documentElement.lang||"de").toLowerCase();return raw.startsWith("fr")?"fr":raw.startsWith("en")?"en":"de";};
  const COPY={
    de:{checking:"Frischer Bloxd-Code erkannt. Sichere Identität wird geprüft…",waiting:"Code erkannt. Wir warten kurz auf den sicheren Bloxd-Nachweis…",success:"Verifizierung erfolgreich. Profil wird geöffnet…",error:"Der sichere Bloxd-Nachweis ist noch nicht angekommen."},
    en:{checking:"Fresh Bloxd code detected. Checking secure identity…",waiting:"Code detected. Waiting briefly for the trusted Bloxd proof…",success:"Verification successful. Opening profile…",error:"The trusted Bloxd proof has not arrived yet."},
    fr:{checking:"Nouveau code Bloxd détecté. Vérification sécurisée de l’identité…",waiting:"Code détecté. Attente de la preuve Bloxd sécurisée…",success:"Vérification réussie. Ouverture du profil…",error:"La preuve Bloxd sécurisée n’est pas encore arrivée."}
  };
  const t=(key)=>COPY[lang()]?.[key]||COPY.de[key];

  function note(text,cls=""){
    const el=document.querySelector("#bridgeNote");
    if(!el)return;
    el.textContent=text;
    el.className=`bridge-note ${cls}`.trim();
  }

  async function verify(code){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)return false;
    const response=await fetch(ASSERT_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`,"apikey":SUPABASE_KEY},
      body:JSON.stringify({code})
    });
    let data={};
    try{data=await response.json();}catch(_){ }
    if(response.ok&&data?.status==="verified"){
      if(timer){clearInterval(timer);timer=null;}
      note(t("success"),"success");
      setTimeout(()=>{location.href="index.html#profile";},650);
      return true;
    }
    if(response.status===202||data?.status==="waiting_for_assertion"){
      note(t("waiting"));
      return false;
    }
    note(data?.error||t("error"),"error");
    return false;
  }

  function start(code){
    code=cleanCode(code);
    if(!code)return;
    note(t("checking"));
    if(timer)clearInterval(timer);
    let tries=0;
    verify(code);
    timer=setInterval(async()=>{
      tries+=1;
      const done=await verify(code);
      if(done||tries>=10){clearInterval(timer);timer=null;}
    },1800);
  }

  window.addEventListener("message",(event)=>{
    if(event.source!==window||event.origin!==window.location.origin)return;
    const data=event.data;
    if(!data||data.source!==SOURCE_EXTENSION)return;
    if(data.type==="EXTENSION_REGISTRATION_CODE")start(data.code);
  });
})();
