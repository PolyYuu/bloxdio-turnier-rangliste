(() => {
  "use strict";

  const SUPABASE_URL="https://nxzrgbpaxukgjyzwupjp.supabase.co";
  const SUPABASE_KEY="sb_publishable_TawTg_9H-hw2TDWFyHH3ow_PTPPfoND";
  const VERIFY_URL=`${SUPABASE_URL}/functions/v1/hub-verify-registration`;
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=(s)=>document.querySelector(s);
  const initials=(name)=>String(name||"?").replace(/[^A-Za-z0-9]/g," ").split(/\s+/).filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"?";

  let current=null;

  function setStatusText(text,type=""){
    const el=$("#statusText");
    if(!el)return;
    el.textContent=text;
    el.className=`status-text ${type}`.trim();
  }

  function render(data){
    current=data;
    const name=data.claimed_name||data.verified_name||"Account Preview";
    $("#playerName").textContent=name;
    $("#avatar").textContent=initials(name);

    const code=String(data.code||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
    $("#codeValue").textContent=code||"NICHT VERFÜGBAR";

    const isWebFirst=data.source==="web_first";
    if(isWebFirst){
      $("#normalInstruction").textContent="Du hast auf der Website gestartet. Öffne jetzt dein Survival-Games-Minigame und bestätige den Account mit dem 8-Zeichen-Code.";
      $("#commandValue").textContent=code?`/verify ${code}`:"/verify DEINCODE";
      setStatusText("Nach /verify wird die Zuordnung gespeichert. Die endgültige Bestätigung erfolgt beim nächsten HUB-Bridge-Kontakt.");
    }else{
      $("#normalInstruction").textContent="Du hast die Registrierung in Bloxd gestartet. Dein 8-Zeichen-Code bleibt hier sichtbar, falls du ihn später noch einmal brauchst.";
      $("#commandValue").textContent="/register";
      setStatusText("Deine Registrierung ist gespeichert. Die endgültige Bestätigung erfolgt automatisch beim nächsten HUB-Bridge-Kontakt.");
    }
  }

  async function status(){
    const {data:{session}}=await db.auth.getSession();
    if(!session){location.href="index.html#overview";return;}
    const {data,error}=await db.rpc("get_my_registration_status");
    if(error){setStatusText(error.message,"error");return;}
    if(data?.status==="verified"){location.href="index.html#profile";return;}
    if(!data||data.status==="unlinked"||data.status==="logged_out"){location.href="register.html";return;}
    render(data);
    if(data.status!=="pending")setStatusText(data.failure_reason||`Status: ${data.status}`,"error");
  }

  $("#showCode").onclick=()=>{
    const code=String(current?.code||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
    $("#codeValue").textContent=code||"NICHT VERFÜGBAR";
    $("#codeBox").scrollIntoView({behavior:"smooth",block:"center"});
  };

  $("#copyCode").onclick=async()=>{
    const code=String(current?.code||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
    if(!code){setStatusText("Für diesen Account ist kein kurzer Code gespeichert.","error");return;}
    try{
      await navigator.clipboard.writeText(code);
      setStatusText(`Code ${code} wurde kopiert.`,"success");
    }catch(_){
      setStatusText(`Kopieren war nicht möglich. Dein Code ist ${code}.`,"error");
    }
  };

  $("#refreshStatus").onclick=status;

  $("#instantVerify").onclick=async()=>{
    const output=$("#instantMessage");
    output.textContent="";
    output.className="status-text";
    const token=$("#instantCode").value.trim().replace(/\s+/g,"");
    if(!token.startsWith("SGR1.")){
      output.textContent="Bitte füge den vollständigen Code aus /instantcode ein.";
      output.classList.add("error");
      return;
    }
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token){output.textContent="Bitte melde dich erneut an.";output.classList.add("error");return;}
    output.textContent="Instant-Code wird geprüft…";
    try{
      const r=await fetch(VERIFY_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({instantCode:token})});
      const result=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(result.error||"Sofort-Verifizierung fehlgeschlagen.");
      output.textContent=`Verifiziert als ${result.username||"Bloxd-Spieler"}.`;
      output.classList.add("success");
      setTimeout(()=>location.href="index.html#profile",700);
    }catch(err){
      output.textContent=err.message||"Sofort-Verifizierung fehlgeschlagen.";
      output.classList.add("error");
    }
  };

  $("#whyButton").onclick=()=>$("#whyModal").classList.remove("hidden");
  $("#closeWhy").onclick=()=>$("#whyModal").classList.add("hidden");
  $("#whyModal").addEventListener("click",e=>{if(e.target===$("#whyModal"))$("#whyModal").classList.add("hidden");});

  status();
  setInterval(status,15000);
})();
