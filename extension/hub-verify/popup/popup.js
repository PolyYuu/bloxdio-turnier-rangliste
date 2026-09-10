'use strict';
const $=(s)=>document.querySelector(s);
function recent(ts,maxAge=120000){return Number(ts||0)>Date.now()-maxAge;}
function ago(ts){const s=Math.max(0,Math.round((Date.now()-Number(ts||0))/1000));if(s<60)return`vor ${s}s`;return`vor ${Math.round(s/60)}min`;}
function render(state,version){
  $('#version').textContent=`v${version||'0.4.0'}`;
  const online=recent(state.bloxdSeenAt);
  $('#bloxdDot').classList.toggle('on',online);
  $('#bloxdStatus').textContent=online?ago(state.bloxdSeenAt):'nicht erkannt';
  $('#relayTitle').textContent=online?'GLOBAL RELAY AKTIV':'Wartet auf Bloxd';
  $('#relayText').textContent=online?'Diese Bloxd-Sitzung beobachtet lobbyweit REGASSERT-Events und lädt neue Nachweise automatisch zum HUB hoch.':'Öffne die HUB-/Turnierlobby in Bloxd. Die Extension muss nicht mit einem persönlichen HUB-Account gekoppelt werden.';
  const observed=Number(state.totalAssertionsObserved||0),uploaded=Number(state.totalAssertionsUploaded||0);
  $('#assertionCount').textContent=`${uploaded} / ${observed}`;
  const latest=Array.isArray(state.recentAssertions)&&state.recentAssertions[0];
  $('#latestAssertion').textContent=latest?`Letztes Event ${ago(latest.seenAt)} · ${latest.uploadStatus==='uploaded'?'hochgeladen':latest.uploadStatus==='error'?'Uploadfehler':'erkannt'}`:'Noch kein REGASSERT-Event erkannt.';
  const up=state.latestUpload;
  if(up?.ok){$('#uploadStatus').textContent='ERFOLGREICH';$('#uploadText').textContent=`${up.code||'Code'}${up.playerName?` · ${up.playerName}`:''}${up.pendingVerification?` · Pending: ${up.pendingVerification}`:''}`;}
  else if(up){$('#uploadStatus').textContent='FEHLER';$('#uploadText').textContent=String(up.error||'Unbekannter Uploadfehler');}
  else{$('#uploadStatus').textContent='Noch keiner';$('#uploadText').textContent='Wartet auf ein neues REGASSERT-Event.';}
  if(state.latestRegistrationCode?.code){$('#codeCard').hidden=false;$('#registrationCode').textContent=state.latestRegistrationCode.code;}else $('#codeCard').hidden=true;
}
async function refresh(){const r=await chrome.runtime.sendMessage({type:'HUB_EXTENSION_GET_STATE'});if(r?.ok)render(r.state||{},r.version);}
$('#openHub').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_HUB'}));
$('#openBloxd').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_BLOXD'}));
$('#clear').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'HUB_EXTENSION_CLEAR'});await refresh();});
refresh();
setInterval(refresh,2500);
