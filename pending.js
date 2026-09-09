(() => {
  "use strict";
  const SUPABASE_URL="https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY="sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=(s)=>document.querySelector(s);
  const initials=(name)=>String(name||"?").replace(/[^A-Za-z0-9]/g," ").split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"?";

  async function status(){
    const {data:{session}}=await db.auth.getSession();
    if(!session){location.href="index.html#overview";return;}
    const {data,error}=await db.rpc("get_my_registration_status");
    if(error){$("#statusText").textContent=error.message;return;}
    if(data?.status==="verified"){location.href="index.html#profile";return;}
    if(!data||data.status==="unlinked"||data.status==="logged_out"){location.href="register.html";return;}
    const name=data.claimed_name||data.verified_name||"Account Preview";
    $("#playerName").textContent=name;
    $("#avatar").textContent=initials(name);
    if(data.status==="pending"){
      $("#statusBadge").textContent="● VERIFIZIERUNG AUSSTEHEND";
      $("#statusText").textContent=data.source==="web_first"
        ? `Gib deinen Code ${data.code||""} in Bloxd mit /verify DEINCODE ein. Danach wird die Zuordnung beim nächsten Bridge-Kontakt bestätigt.`
        : "Deine Bloxd-Registrierung ist gespeichert. Beim nächsten Bridge-Kontakt wird deine permanente PlayerDbId übernommen – du musst dafür nicht gleichzeitig online sein.";
      if(data.code){$("#codeValue").textContent=data.code;$("#codeBox").classList.remove("hidden");}
    }else{
      $("#statusBadge").textContent=`● ${String(data.status).toUpperCase()}`;
      $("#statusText").textContent=data.failure_reason||"Die Verifizierung konnte nicht abgeschlossen werden.";
    }
  }

  $("#statusBadge").onclick=()=>$("#statusModal").classList.remove("hidden");
  $("#closeModal").onclick=()=>$("#statusModal").classList.add("hidden");
  $("#refreshStatus").onclick=status;
  $("#statusModal").addEventListener("click",e=>{if(e.target===$("#statusModal"))$("#statusModal").classList.add("hidden");});
  status();
  setInterval(status,15000);
})();
