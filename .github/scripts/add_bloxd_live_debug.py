from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

def rep(old,new,label,count=1):
    global s
    n=s.count(old)
    if n!=count:
        raise SystemExit(f'{label}: expected {count}, got {n}')
    s=s.replace(old,new,count)
    print(label,'ok')

# HubAPI wrappers
marker="  async function adminGetCupRegistrations(tournamentId) { const data=await rpc('admin_get_cup_registrations',{p_tournament_id:tournamentId}); return data||[]; }"
insert=marker+"\n  async function adminGetBloxdRelayEvents(limit=100) { const data=await rpc('admin_get_bloxd_relay_events',{p_limit:Math.max(1,Math.min(Number(limit)||100,500))}); return data||[]; }\n  async function adminGetBloxdRelayStatus() { const data=await rpc('admin_get_bloxd_relay_status'); return data||[]; }\n  function subscribeToBloxdRelay(onChange) { return client.channel('hub-bloxd-relay-debug')\n    .on('postgres_changes',{event:'*',schema:'public',table:'bloxd_relay_events'},onChange)\n    .on('postgres_changes',{event:'*',schema:'public',table:'bloxd_relay_status'},onChange).subscribe(); }"
rep(marker,insert,'relay api wrappers')

export_old="adminGetAuditLog,subscribeToSocial"
export_new="adminGetAuditLog,adminGetBloxdRelayEvents,adminGetBloxdRelayStatus,subscribeToBloxdRelay,subscribeToSocial"
rep(export_old,export_new,'relay api exports')

# Add hidden admin debug implementation before presence section.
anchor="  function startPresence(){"
if anchor not in s: raise SystemExit('presence anchor missing')
block=r'''  // ---------------------------------------------------------------------
  // BLOXD LIVE SYNC — hidden Phase 1 diagnostics (admin only, read only)
  // ---------------------------------------------------------------------
  let bloxdDebugPoll=null,bloxdDebugBusy=false,bloxdDebugChannel=null;
  function ensureBloxdDebugShell(){
    let root=$('#hub-bloxd-live-debug');if(root)return root;
    root=document.createElement('div');root.id='hub-bloxd-live-debug';root.hidden=true;
    root.innerHTML=`<div class="bloxd-debug-bg"></div><main class="bloxd-debug-shell"><header class="bloxd-debug-head"><div><span class="eyebrow">HUB · BLOXD LIVE SYNC</span><h1>LIVE DEBUG</h1><p>${copy('Safe relay diagnostics. Phase 1 never changes rounds, points or rating.','Sichere Relay-Diagnose. Phase 1 verändert niemals Runden, Punkte oder Rating.','Diagnostic du relais. La phase 1 ne modifie aucune donnée compétitive.')}</p></div><div class="bloxd-debug-head-actions"><span class="bloxd-debug-readonly">PHASE 1 · READ ONLY</span><button class="ghost-button" id="bloxdDebugBack">← ${copy('Back to admin','Zurück zum Admin','Retour admin')}</button></div></header><section class="bloxd-debug-status-grid" id="bloxdDebugStatus"></section><section class="bloxd-debug-panel"><div class="bloxd-debug-panel-head"><div><span class="eyebrow">EVENT STREAM</span><h2>${copy('Recent relay events','Letzte Relay-Events','Événements récents')}</h2></div><div class="bloxd-debug-tools"><span id="bloxdDebugUpdated">—</span><button class="ghost-button" id="bloxdDebugRefresh">${copy('Refresh','Aktualisieren','Actualiser')}</button></div></div><div id="bloxdDebugEvents"><div class="v3-empty">${copy('Loading…','Lädt…','Chargement…')}</div></div></section><section class="bloxd-debug-note"><strong>${copy('Safety mode','Sicherheitsmodus','Mode sécurité')}</strong><span>${copy('Incoming events are only stored and displayed. No tournament result, kill, Deathmatch, win, placement, rating or career stat is modified by this page.','Eingehende Events werden ausschließlich gespeichert und angezeigt. Kein Turnierergebnis, Kill, Deathmatch, Sieg, Placement, Rating oder Karriere-Stat wird durch diese Seite verändert.','Les événements sont uniquement stockés et affichés.')}</span></section></main>`;
    document.body.appendChild(root);
    $('#bloxdDebugBack',root).onclick=()=>{location.hash='#admin';};
    $('#bloxdDebugRefresh',root).onclick=()=>renderBloxdLiveDebug(true);
    return root;
  }
  function relayAgeText(ts){
    if(!ts)return copy('Never','Noch nie','Jamais');const ms=Math.max(0,Date.now()-new Date(ts).getTime()),sec=Math.floor(ms/1000);
    if(sec<5)return copy('just now','gerade eben','à l’instant');if(sec<60)return `${sec}s`;
    const min=Math.floor(sec/60);if(min<60)return `${min} min`;
    const hr=Math.floor(min/60);if(hr<24)return `${hr} h`;
    return `${Math.floor(hr/24)} d`;
  }
  function relayEventLabel(type){
    const map={relay_heartbeat:'HEARTBEAT',round_start:'ROUND START',kill:'KILL',deathmatch_start:'DEATHMATCH',win:'WIN',round_end:'ROUND END',round_cancel:'ROUND CANCEL',round_snapshot:'SNAPSHOT',player_seen:'PLAYER SEEN',registration_code_created:'REGISTER CODE'};
    return map[String(type||'')]||String(type||'EVENT').replace(/_/g,' ').toUpperCase();
  }
  function relayJson(value){try{return JSON.stringify(value,null,2);}catch(_){return String(value||'');}}
  async function renderBloxdLiveDebug(force=false){
    if(location.hash!=='#live-debug'||!live.isAdmin)return;
    const root=ensureBloxdDebugShell();root.hidden=false;if(bloxdDebugBusy&&!force)return;bloxdDebugBusy=true;
    try{
      const [statuses,events]=await Promise.all([api.adminGetBloxdRelayStatus(),api.adminGetBloxdRelayEvents(100)]);
      const status=(statuses||[])[0]||null,online=!!status?.is_online,lastSeen=status?.last_seen_at||null;
      const statusWrap=$('#bloxdDebugStatus',root);
      statusWrap.innerHTML=`<article class="bloxd-debug-stat ${online?'online':'offline'}"><span>${copy('Relay status','Relay-Status','Statut relais')}</span><strong><i></i>${online?'ONLINE':'OFFLINE'}</strong><small>${lastSeen?`${copy('Last heartbeat','Letzter Kontakt','Dernier contact')}: ${relayAgeText(lastSeen)}`:copy('No relay has contacted the HUB yet.','Noch kein Relay hat den HUB kontaktiert.','Aucun relais connecté.')}</small></article><article class="bloxd-debug-stat"><span>${copy('Last event','Letztes Event','Dernier événement')}</span><strong>${esc(relayEventLabel(status?.last_event_type||'—'))}</strong><small>${esc(status?.last_event_id||'—')}</small></article><article class="bloxd-debug-stat"><span>MATCH ID</span><strong>${esc(status?.last_match_id||'—')}</strong><small>${status?.meta?.round?`${copy('Round','Runde','Manche')} ${Number(status.meta.round)}`:'—'}${status?.meta?.map?` · ${esc(String(status.meta.map))}`:''}</small></article><article class="bloxd-debug-stat"><span>${copy('Stored events','Gespeicherte Events','Événements stockés')}</span><strong>${Number((events||[]).length)}</strong><small>${copy('Showing latest 100','Anzeige der letzten 100','100 derniers affichés')}</small></article>`;
      const list=$('#bloxdDebugEvents',root);
      list.innerHTML=(events||[]).length?(events||[]).map(e=>`<article class="bloxd-debug-event"><div class="bloxd-debug-event-main"><span class="bloxd-debug-event-type">${esc(relayEventLabel(e.event_type))}</span><strong>${esc(e.match_id||'No match')}</strong><small>${new Date(e.received_at).toLocaleString()} · ${esc(e.event_id)}</small></div><div class="bloxd-debug-event-meta"><span>${e.round?`${copy('Round','Runde','Manche')} ${Number(e.round)}`:'—'}</span><span>${esc(e.map_name||'—')}</span><span>${esc(e.player_db_id||'—')}</span></div><details><summary>JSON</summary><pre>${esc(relayJson(e.payload))}</pre></details></article>`).join(''):`<div class="bloxd-debug-zero"><strong>${copy('Waiting for the first Bloxd event…','Warte auf das erste Bloxd-Event…','En attente du premier événement Bloxd…')}</strong><span>${copy('When Tampermonkey sends a heartbeat or ROUND_START, it appears here immediately.','Sobald Tampermonkey einen Heartbeat oder ROUND_START sendet, erscheint er hier sofort.','Le premier événement apparaîtra ici.')}</span></div>`;
      $('#bloxdDebugUpdated',root).textContent=`${copy('Updated','Aktualisiert','Actualisé')}: ${new Date().toLocaleTimeString()}`;
    }catch(e){
      const list=$('#bloxdDebugEvents',root);if(list)list.innerHTML=`<div class="bloxd-debug-zero error"><strong>${copy('Live Debug could not be loaded.','Live Debug konnte nicht geladen werden.','Impossible de charger le debug.')}</strong><span>${esc(e.message||String(e))}</span></div>`;
    }finally{bloxdDebugBusy=false;}
  }
  function stopBloxdDebugPoll(){if(bloxdDebugPoll){clearInterval(bloxdDebugPoll);bloxdDebugPoll=null;}}
  async function syncBloxdDebugRoute(){
    const root=ensureBloxdDebugShell();
    if(location.hash==='#live-debug'){
      if(!live.session){root.hidden=true;return;}
      if(!live.isAdmin){root.hidden=true;location.hash='#overview';toast(copy('Admin access required.','Admin-Zugriff erforderlich.','Accès admin requis.'),true);return;}
      root.hidden=false;await renderBloxdLiveDebug(true);stopBloxdDebugPoll();bloxdDebugPoll=setInterval(()=>{if(document.visibilityState==='visible'&&location.hash==='#live-debug')renderBloxdLiveDebug();},5000);
    }else{root.hidden=true;stopBloxdDebugPoll();}
  }
  window.addEventListener('hashchange',syncBloxdDebugRoute);
  document.addEventListener('hub:auth-restored',()=>setTimeout(syncBloxdDebugRoute,50));
  if(api.subscribeToBloxdRelay)bloxdDebugChannel=api.subscribeToBloxdRelay(()=>{if(location.hash==='#live-debug')setTimeout(()=>renderBloxdLiveDebug(true),80);});
  setTimeout(syncBloxdDebugRoute,250);

'''
s=s.replace(anchor,block+anchor,1)
print('relay debug implementation inserted')

# Add CSS before head close
css=r'''
<style id="hub-bloxd-live-debug-style">
#hub-bloxd-live-debug[hidden]{display:none!important}#hub-bloxd-live-debug{position:fixed;inset:0;z-index:2147480000;overflow:auto;background:#070411;color:#fff}.bloxd-debug-bg{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 12% 12%,rgba(58,236,224,.09),transparent 26%),radial-gradient(circle at 82% 20%,rgba(123,75,255,.12),transparent 30%),linear-gradient(180deg,#090516,#05030d)}.bloxd-debug-shell{position:relative;width:min(1320px,calc(100% - 40px));margin:0 auto;padding:44px 0 70px}.bloxd-debug-head{display:flex;justify-content:space-between;align-items:flex-end;gap:30px;padding:0 6px 28px;border-bottom:1px solid rgba(126,95,198,.25)}.bloxd-debug-head h1{margin:5px 0 4px;font-family:var(--font-display,'Arial Black',sans-serif);font-size:clamp(36px,6vw,72px);line-height:.95;letter-spacing:-.03em}.bloxd-debug-head p{margin:0;color:#a79eb8;font-size:13px}.bloxd-debug-head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}.bloxd-debug-readonly{padding:10px 13px;border:1px solid rgba(57,229,215,.38);border-radius:9px;background:rgba(57,229,215,.08);color:#43e9dc;font-size:10px;font-weight:900;letter-spacing:.08em}.bloxd-debug-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0}.bloxd-debug-stat{min-height:128px;padding:17px 18px;border:1px solid rgba(112,82,177,.3);border-radius:14px;background:linear-gradient(145deg,rgba(31,18,64,.92),rgba(16,10,35,.94));display:grid;align-content:center;gap:7px;overflow:hidden}.bloxd-debug-stat>span{color:#43e9dc;font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.bloxd-debug-stat strong{font-size:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bloxd-debug-stat small{color:#91879f;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bloxd-debug-stat.online strong{color:#62f2ad}.bloxd-debug-stat.offline strong{color:#ff7189}.bloxd-debug-stat strong i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:currentColor;box-shadow:0 0 14px currentColor}.bloxd-debug-panel{border:1px solid rgba(112,82,177,.32);border-radius:16px;background:linear-gradient(180deg,rgba(26,14,55,.94),rgba(11,7,25,.97));overflow:hidden}.bloxd-debug-panel-head{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:19px 21px;border-bottom:1px solid rgba(117,86,181,.24)}.bloxd-debug-panel-head h2{margin:3px 0 0;font-size:21px}.bloxd-debug-tools{display:flex;align-items:center;gap:10px}.bloxd-debug-tools>span{color:#837a91;font-size:9px}.bloxd-debug-event{display:grid;grid-template-columns:minmax(270px,1.6fr) minmax(250px,.9fr) auto;align-items:center;gap:16px;padding:13px 20px;border-bottom:1px solid rgba(113,86,163,.16)}.bloxd-debug-event:last-child{border-bottom:0}.bloxd-debug-event-main{display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:10px;row-gap:3px;min-width:0}.bloxd-debug-event-type{grid-row:1/3;display:inline-grid;place-items:center;min-width:105px;padding:8px 9px;border:1px solid rgba(60,230,216,.25);border-radius:8px;background:rgba(60,230,216,.06);color:#43e9dc;font-size:9px;font-weight:900}.bloxd-debug-event-main strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bloxd-debug-event-main small{font-size:9px;color:#776f84;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bloxd-debug-event-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.bloxd-debug-event-meta span{padding:6px 7px;border-radius:6px;background:rgba(255,255,255,.025);color:#a99fb5;font-size:9px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bloxd-debug-event details{position:relative}.bloxd-debug-event summary{cursor:pointer;list-style:none;padding:7px 9px;border:1px solid rgba(126,102,172,.3);border-radius:7px;color:#b4a8c1;font-size:9px;font-weight:800}.bloxd-debug-event details[open] pre{position:absolute;right:0;top:30px;z-index:5;width:min(620px,75vw);max-height:430px;overflow:auto;margin:0;padding:14px;border:1px solid rgba(73,219,208,.28);border-radius:10px;background:#080512;color:#bfc9ca;font:10px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 18px 55px rgba(0,0,0,.55)}.bloxd-debug-zero{min-height:260px;display:grid;place-content:center;text-align:center;gap:8px;padding:35px}.bloxd-debug-zero strong{font-size:17px}.bloxd-debug-zero span{color:#81778d;font-size:11px}.bloxd-debug-zero.error strong{color:#ff7189}.bloxd-debug-note{display:grid;grid-template-columns:auto 1fr;gap:13px;margin-top:13px;padding:14px 16px;border:1px solid rgba(57,229,215,.18);border-radius:12px;background:rgba(57,229,215,.035)}.bloxd-debug-note strong{color:#43e9dc;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.bloxd-debug-note span{color:#82798f;font-size:10px;line-height:1.5}@media(max-width:900px){.bloxd-debug-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bloxd-debug-event{grid-template-columns:1fr}.bloxd-debug-event details[open] pre{position:relative;top:7px;right:auto;width:100%}.bloxd-debug-head{align-items:flex-start;flex-direction:column}.bloxd-debug-head-actions{justify-content:flex-start}.bloxd-debug-shell{width:min(100% - 22px,1320px)}}@media(max-width:540px){.bloxd-debug-status-grid{grid-template-columns:1fr}.bloxd-debug-panel-head{align-items:flex-start;flex-direction:column}.bloxd-debug-event-meta{grid-template-columns:1fr 1fr 1fr}.bloxd-debug-shell{padding-top:24px}}
</style>
'''
if 'id="hub-bloxd-live-debug-style"' in s: raise SystemExit('debug css already exists')
s=s.replace('</head>',css+'\n</head>',1)
print('relay debug css inserted')

for needle in ['admin_get_bloxd_relay_events','admin_get_bloxd_relay_status','function renderBloxdLiveDebug','hub-bloxd-live-debug-style','PHASE 1 · READ ONLY']:
    if needle not in s: raise SystemExit('missing guard '+needle)

p.write_text(s)
print('Bloxd live debug patch complete')
