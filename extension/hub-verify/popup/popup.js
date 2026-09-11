'use strict';
const $=(s)=>document.querySelector(s);
function recent(ts,maxAge=120000){return Number(ts||0)>Date.now()-maxAge;}
function ago(ts){const s=Math.max(0,Math.round((Date.now()-Number(ts||0))/1000));if(s<60)return`vor ${s}s`;return`vor ${Math.round(s/60)}min`;}
function render(state,version){
  $('#version').textContent=`v${version||'0.7.0'}`;
  const online=recent(state.bloxdSeenAt);
  $('#bloxdDot').classList.toggle('on',online);
  $('#bloxdStatus').textContent=online?ago(state.bloxdSeenAt):'nicht erkannt';
  $('#relayTitle').textContent=online?'PASSIVE BRIDGE AKTIV':'Wartet auf Bloxd';
  $('#relayText').textContent=online?'Verifizierungsdaten werden automatisch im Hintergrund verarbeitet. HUB Verify schreibt nichts in den Bloxd-Chat und übernimmt niemals den Eingabefokus.':'Öffne die HUB-/Turnierlobby in Bloxd. Die Extension arbeitet danach vollständig passiv.';
  const uploaded=Number(state.totalAssertionsUploaded||0);
  $('#assertionCount').textContent=String(uploaded);
  const latest=Array.isArray(state.recentAssertions)&&state.recentAssertions[0];
  $('#latestAssertion').textContent=latest?`Letzte Hintergrund-Verarbeitung ${ago(latest.seenAt)}.`:'Noch keine neuen Verifizierungsdaten verarbeitet.';
  const up=state.latestUpload;
  if(up?.ok){$('#uploadStatus').textContent='VERBUNDEN';$('#uploadText').textContent='Die letzte neue Registrierung wurde erfolgreich an den HUB übertragen.';}
  else if(up){$('#uploadStatus').textContent='VERBINDUNGSFEHLER';$('#uploadText').textContent='Die Bridge versucht es bei einem späteren Replay erneut.';}
  else{$('#uploadStatus').textContent=online?'BEREIT':'OFFLINE';$('#uploadText').textContent='Bereits verifizierte Spieler werden automatisch übersprungen.';}
}
async function refresh(){const r=await chrome.runtime.sendMessage({type:'HUB_EXTENSION_GET_STATE'});if(r?.ok)render(r.state||{},r.version);}
$('#openHub').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_HUB'}));
$('#openBloxd').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_BLOXD'}));
$('#clear').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'HUB_EXTENSION_CLEAR'});await refresh();});
refresh();setInterval(refresh,2500);
