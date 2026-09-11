'use strict';
const $=(s)=>document.querySelector(s);
function recent(ts,maxAge=120000){return Number(ts||0)>Date.now()-maxAge;}
function ago(ts){const s=Math.max(0,Math.round((Date.now()-Number(ts||0))/1000));if(s<60)return`vor ${s}s`;return`vor ${Math.round(s/60)}min`;}
function render(state,version){
  $('#version').textContent=`v${version||'0.6.0'}`;
  const online=recent(state.bloxdSeenAt);
  const bridge=recent(state.bridgeConnectedAt,180000);
  $('#bloxdDot').classList.toggle('on',online);
  $('#bloxdStatus').textContent=online?ago(state.bloxdSeenAt):'nicht erkannt';
  $('#bridgeDot').classList.toggle('on',bridge);
  $('#bridgeStatus').textContent=bridge?'verbunden':'wird verbunden';
  $('#relayTitle').textContent=online?(bridge?'GLOBAL BRIDGE AKTIV':'BRIDGE WIRD EINGERICHTET'):'Wartet auf Bloxd';
  $('#relayText').textContent=online?(bridge?'Diese Bloxd-Sitzung empfängt gespeicherte Registrierungen und synchronisiert sie still zum HUB.':'HUB Verify meldet diesen Bloxd-Spieler automatisch beim World Code als Bridge an.'): 'Öffne die HUB-/Turnierlobby in Bloxd. Die Bridge ist nicht an einen einzelnen HUB-Account gekoppelt.';
  const uploaded=Number(state.totalAssertionsUploaded||0);
  $('#assertionCount').textContent=String(uploaded);
  const latest=Array.isArray(state.recentAssertions)&&state.recentAssertions[0];
  $('#latestAssertion').textContent=latest?`Letzte Hintergrund-Verarbeitung ${ago(latest.seenAt)}.`:'Noch keine neuen Verifizierungsdaten verarbeitet.';
  const up=state.latestUpload;
  if(up?.ok){$('#uploadStatus').textContent='VERBUNDEN';$('#uploadText').textContent='Die letzte Hintergrund-Verarbeitung wurde erfolgreich an den HUB übertragen.';}
  else if(up){$('#uploadStatus').textContent='VERBINDUNGSFEHLER';$('#uploadText').textContent='Die Bridge versucht den Nachweis beim nächsten Replay erneut.';}
  else{$('#uploadStatus').textContent=online?'BEREIT':'OFFLINE';$('#uploadText').textContent='Andere Spieler werden still im Hintergrund verarbeitet.';}
}
async function refresh(){const r=await chrome.runtime.sendMessage({type:'HUB_EXTENSION_GET_STATE'});if(r?.ok)render(r.state||{},r.version);}
$('#openHub').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_HUB'}));
$('#openBloxd').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_BLOXD'}));
$('#clear').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'HUB_EXTENSION_CLEAR'});await refresh();});
refresh();
setInterval(refresh,2500);
