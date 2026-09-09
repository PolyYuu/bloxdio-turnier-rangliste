'use strict';
const $=(s)=>document.querySelector(s);
function recent(ts,maxAge=120000){return Number(ts||0)>Date.now()-maxAge;}
function ago(ts){const s=Math.max(0,Math.round((Date.now()-Number(ts||0))/1000));if(s<60)return`vor ${s}s`;return`vor ${Math.round(s/60)}min`;}
function render(state,version){
  $('#version').textContent=`v${version||'0.3.0'}`;
  const online=recent(state.bloxdSeenAt);
  $('#bloxdDot').classList.toggle('on',online);
  $('#bloxdStatus').textContent=online?ago(state.bloxdSeenAt):'nicht erkannt';
  $('#relayTitle').textContent=online?'GLOBAL RELAY AKTIV':'Wartet auf Bloxd';
  $('#relayText').textContent=online?'Diese Bloxd-Sitzung beobachtet lobbyweit Verifizierungs-Events. Der produktive Upload ist in v0.3 aus Sicherheitsgründen noch deaktiviert.':'Öffne die HUB-/Turnierlobby in Bloxd. Die Extension muss nicht mit einem persönlichen HUB-Account gekoppelt werden.';
  const count=Number(state.totalAssertionsObserved||0);$('#assertionCount').textContent=String(count);
  const latest=Array.isArray(state.recentAssertions)&&state.recentAssertions[0];
  $('#latestAssertion').textContent=latest?`Letztes Event ${ago(latest.seenAt)} · ${String(latest.raw||'').slice(0,86)}${String(latest.raw||'').length>86?'…':''}`:'Noch kein REGASSERT-Event erkannt.';
  if(state.latestRegistrationCode?.code){$('#codeCard').hidden=false;$('#registrationCode').textContent=state.latestRegistrationCode.code;}else $('#codeCard').hidden=true;
}
async function refresh(){const r=await chrome.runtime.sendMessage({type:'HUB_EXTENSION_GET_STATE'});if(r?.ok)render(r.state||{},r.version);}
$('#openHub').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_HUB'}));
$('#openBloxd').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_BLOXD'}));
$('#clear').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'HUB_EXTENSION_CLEAR'});await refresh();});
refresh();
setInterval(refresh,2500);
