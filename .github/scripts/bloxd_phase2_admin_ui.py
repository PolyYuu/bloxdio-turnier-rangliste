from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

def rep(old,new,label,count=1):
    global s
    n=s.count(old)
    if n!=count:
        raise SystemExit(f'{label}: expected {count}, got {n}')
    s=s.replace(old,new,count)
    print(label,'ok')

# 1) Hub API wrappers for Phase 2 binding.
api_marker="  async function adminGetBloxdRelayStatus() { const data=await rpc('admin_get_bloxd_relay_status'); return data||[]; }"
api_add=api_marker+"\n  async function adminGetBloxdSyncBinding(tournamentId) { const data=await rpc('admin_get_bloxd_sync_binding',{p_tournament_id:tournamentId}); return data||[]; }\n  async function adminUpsertBloxdSyncBinding(tournamentId,syncKey,relayId=null,enabled=true) { return rpc('admin_upsert_bloxd_sync_binding',{p_tournament_id:tournamentId,p_sync_key:syncKey,p_relay_id:relayId||null,p_enabled:!!enabled}); }\n  async function adminRemoveBloxdSyncBinding(tournamentId) { return rpc('admin_remove_bloxd_sync_binding',{p_tournament_id:tournamentId}); }"
rep(api_marker,api_add,'phase2 binding api')

export_old="adminGetAuditLog,adminGetBloxdRelayEvents,adminGetBloxdRelayStatus,subscribeToBloxdRelay,subscribeToSocial"
export_new="adminGetAuditLog,adminGetBloxdRelayEvents,adminGetBloxdRelayStatus,adminGetBloxdSyncBinding,adminUpsertBloxdSyncBinding,adminRemoveBloxdSyncBinding,subscribeToBloxdRelay,subscribeToSocial"
rep(export_old,export_new,'phase2 binding api export')

# 2) Admin Live Sync configuration modal.
marker="  function ensureAdminSafetyTools(cup){"
if marker not in s: raise SystemExit('ensureAdminSafetyTools marker missing')
block=r'''  async function openBloxdSyncConfig(cup){
    if(!cup)return;
    let binding=null;
    try{const rows=await api.adminGetBloxdSyncBinding(cup.id);binding=(rows||[])[0]||null;}catch(e){return toast(e.message||String(e),true);}
    const suggested=binding?.sync_key||`cup-${String(cup.id).slice(0,8)}`;
    const m=document.createElement('div');m.className='v3-modal-backdrop';
    m.innerHTML=`<section class="v3-modal v3-live-sync-modal"><button class="modal-close" data-v3-close>×</button><span class="eyebrow">BLOXD · LIVE SYNC · PHASE 2</span><h2>${copy('Connect this Cup','Diesen Cup verbinden','Connecter ce Cup')}</h2><p>${copy('Only a ROUND_START carrying this Sync Key may move this Cup to the matching live round. Kills, points, wins and rating are still untouched.','Nur ein ROUND_START mit diesem Sync Key darf diesen Cup auf die passende laufende Runde setzen. Kills, Punkte, Siege und Rating bleiben weiterhin unangetastet.','Seul ROUND_START peut déplacer ce Cup. Les stats restent inchangées.')}</p><div class="v3-live-sync-state ${binding?.is_enabled?'enabled':'disabled'}"><span>${copy('Current state','Aktueller Status','Statut actuel')}</span><strong>${binding?.is_enabled?'SYNC ENABLED':copy('Not connected','Nicht verbunden','Non connecté')}</strong>${binding?.live_match_id?`<small>${copy('Running','Läuft','En cours')}: ${esc(binding.live_match_id)} · ${copy('Round','Runde','Manche')} ${Number(binding.live_round||0)}${binding.live_map_name?` · ${esc(binding.live_map_name)}`:''}</small>`:`<small>${copy('No active Bloxd match is linked to this Cup.','Kein aktives Bloxd-Match ist mit diesem Cup verbunden.','Aucun match actif lié.')}</small>`}</div><form id="v3LiveSyncForm"><label><span>SYNC KEY</span><div class="v3-live-sync-copy"><input name="syncKey" id="v3LiveSyncKey" value="${esc(suggested)}" maxlength="120" pattern="[A-Za-z0-9._:-]{3,120}" required><button class="ghost-button" type="button" id="v3CopySyncKey">${copy('Copy','Kopieren','Copier')}</button></div><small>${copy('Put exactly this value into the World Code / relay configuration. It is not a password.','Genau diesen Wert verwendest du später im World Code / Relay. Er ist kein Passwort.','Utilise exactement cette valeur dans le World Code.')}</small></label><label><span>RELAY ID <small>(${copy('optional','optional','optionnel')})</small></span><input name="relayId" value="${esc(binding?.relay_id||'')}" maxlength="120" placeholder="malik-main-relay"><small>${copy('Leave empty to accept the Sync Key from any authorized relay.','Leer lassen, damit der Sync Key von jedem autorisierten Relay akzeptiert wird.','Laisser vide pour tout relais autorisé.')}</small></label><label class="v3-live-sync-toggle"><input type="checkbox" name="enabled" ${binding?.is_enabled!==false?'checked':''}><span>${copy('Enable automatic ROUND_START for this Cup','Automatischen ROUND_START für diesen Cup aktivieren','Activer ROUND_START automatique')}</span></label><div class="v3-form-error" id="v3LiveSyncErr"></div><div class="v3-live-sync-actions"><button class="cta-button" type="submit">${copy('Save Live Sync','Live Sync speichern','Enregistrer Live Sync')}</button><button class="ghost-button" type="button" id="v3OpenLiveDebug">LIVE DEBUG</button>${binding?`<button class="ghost-button danger" type="button" id="v3RemoveLiveSync">${copy('Disconnect','Verbindung entfernen','Déconnecter')}</button>`:''}</div></form></section>`;
    document.body.appendChild(m);
    const close=()=>m.remove();m.onclick=e=>{if(e.target===m||e.target.closest('[data-v3-close]'))close();};
    $('#v3CopySyncKey',m).onclick=async()=>{const input=$('#v3LiveSyncKey',m);try{await navigator.clipboard.writeText(input.value);toast(copy('Sync Key copied.','Sync Key kopiert.','Sync Key copié.'));}catch(_){input.select();document.execCommand('copy');toast(copy('Sync Key copied.','Sync Key kopiert.','Sync Key copié.'));}};
    $('#v3OpenLiveDebug',m).onclick=()=>{close();location.hash='#live-debug';};
    const remove=$('#v3RemoveLiveSync',m);if(remove)remove.onclick=async()=>{if(!confirm(copy('Disconnect this Cup from Bloxd Live Sync? Incoming events will still be stored, but they will no longer change this Cup.','Diesen Cup wirklich vom Bloxd Live Sync trennen? Events werden weiterhin gespeichert, verändern diesen Cup aber nicht mehr.','Déconnecter ce Cup ?')))return;remove.disabled=true;try{await api.adminRemoveBloxdSyncBinding(cup.id);toast(copy('Live Sync disconnected.','Live Sync getrennt.','Live Sync déconnecté.'));close();}catch(e){toast(e.message||String(e),true);remove.disabled=false;}};
    $('#v3LiveSyncForm',m).onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),key=String(f.get('syncKey')||'').trim(),relay=String(f.get('relayId')||'').trim(),enabled=f.get('enabled')==='on',submit=e.submitter,err=$('#v3LiveSyncErr',m);err.textContent='';submit.disabled=true;try{await api.adminUpsertBloxdSyncBinding(cup.id,key,relay||null,enabled);toast(copy('Live Sync saved.','Live Sync gespeichert.','Live Sync enregistré.'));close();}catch(ex){err.textContent=ex.message||String(ex);submit.disabled=false;}};
  }

'''
s=s.replace(marker,block+marker,1)
print('live sync admin modal inserted')

# 3) Add Live Sync button to existing Safety & Backup bar.
old_buttons="<button class=\"ghost-button\" id=\"v3CupBackupButton\">${copy('Cup backup (.json)','Cup-Backup (.json)','Sauvegarde (.json)')}</button><button class=\"ghost-button\" id=\"v3AuditLogButton\">${copy('Audit log','Audit-Log','Journal audit')}</button>"
new_buttons=old_buttons+"<button class=\"ghost-button v3-live-sync-button\" id=\"v3LiveSyncButton\">LIVE SYNC</button>"
rep(old_buttons,new_buttons,'live sync safety button')

old_handlers="$('#v3CupBackupButton',bar).onclick=()=>downloadCupBackup(cup);$('#v3AuditLogButton',bar).onclick=openAuditLog;"
new_handlers=old_handlers+"$('#v3LiveSyncButton',bar).onclick=()=>openBloxdSyncConfig(cup);"
rep(old_handlers,new_handlers,'live sync safety handler')

# 4) Update debug copy from Phase 1 to Phase 2 reality.
rep("Safe relay diagnostics. Phase 1 never changes rounds, points or rating.","Safe relay diagnostics. Phase 2 may start a bound Cup round; kills, points and rating are still read-only.",'debug phase2 english')
rep("Sichere Relay-Diagnose. Phase 1 verändert niemals Runden, Punkte oder Rating.","Sichere Relay-Diagnose. Phase 2 darf eine gebundene Cup-Runde starten; Kills, Punkte und Rating bleiben weiterhin unangetastet.",'debug phase2 german')
rep("PHASE 1 · READ ONLY","PHASE 2 · ROUND START",'debug phase badge')
rep("Incoming events are only stored and displayed. No tournament result, kill, Deathmatch, win, placement, rating or career stat is modified by this page.","Incoming events are stored and displayed. Only a bound ROUND_START may update Cup status/current round. Kills, Deathmatch, wins, placement, rating and career stats are still untouched.",'debug safety english')
rep("Eingehende Events werden ausschließlich gespeichert und angezeigt. Kein Turnierergebnis, Kill, Deathmatch, Sieg, Placement, Rating oder Karriere-Stat wird durch diese Seite verändert.","Eingehende Events werden gespeichert und angezeigt. Nur ein gebundener ROUND_START darf Cup-Status und aktuelle Runde ändern. Kills, Deathmatch, Siege, Placement, Rating und Karriere-Stats bleiben unangetastet.",'debug safety german')

# 5) Show processing status inside each debug row.
old_meta="<span>${esc(e.player_db_id||'—')}</span></div><details><summary>JSON</summary>"
new_meta="<span>${esc(e.player_db_id||'—')}</span><span class=\"bloxd-processing ${esc(e.processing_status||'stored')}\" title=\"${esc(e.processing_error||'')}\">${esc(String(e.processing_status||'stored').toUpperCase())}</span></div><details><summary>JSON</summary>"
rep(old_meta,new_meta,'debug processing status')

# 6) Styling.
css=r'''
<style id="hub-bloxd-phase2-admin-style">
.v3-live-sync-button{border-color:rgba(60,230,216,.42)!important;color:#7df3e8!important}.v3-live-sync-modal{width:min(680px,calc(100vw - 28px))!important}.v3-live-sync-state{display:grid;gap:4px;margin:16px 0;padding:14px 15px;border:1px solid rgba(126,101,190,.3);border-radius:12px;background:rgba(255,255,255,.025)}.v3-live-sync-state>span{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#8f879f}.v3-live-sync-state strong{font-size:14px}.v3-live-sync-state.enabled{border-color:rgba(65,225,169,.32);background:rgba(65,225,169,.06)}.v3-live-sync-state.enabled strong{color:#62f2ad}.v3-live-sync-state small{color:#938a9f;font-size:10px}.v3-live-sync-copy{display:grid;grid-template-columns:1fr auto;gap:8px}.v3-live-sync-modal form{display:grid;gap:13px}.v3-live-sync-modal label{display:grid;gap:6px}.v3-live-sync-modal label>span{font-size:10px;font-weight:800;color:#c5bdd0}.v3-live-sync-modal label>small{font-size:9px;color:#7e758a;line-height:1.45}.v3-live-sync-toggle{grid-template-columns:auto 1fr!important;align-items:center!important}.v3-live-sync-toggle input{width:16px;height:16px}.v3-live-sync-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:4px}.bloxd-debug-event-meta{grid-template-columns:repeat(4,minmax(0,1fr))!important}.bloxd-processing.processed{color:#62f2ad!important;background:rgba(65,225,169,.08)!important}.bloxd-processing.unbound{color:#ffc65c!important;background:rgba(255,198,92,.08)!important}.bloxd-processing.error{color:#ff7189!important;background:rgba(255,113,137,.08)!important}.bloxd-processing.ignored{color:#a68cff!important;background:rgba(166,140,255,.08)!important}@media(max-width:760px){.v3-live-sync-copy{grid-template-columns:1fr}.v3-live-sync-actions{display:grid}.bloxd-debug-event-meta{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
</style>
'''
if 'id="hub-bloxd-phase2-admin-style"' in s:raise SystemExit('phase2 admin style already exists')
s=s.replace('</head>',css+'\n</head>',1)

for needle in ['admin_get_bloxd_sync_binding','openBloxdSyncConfig','v3LiveSyncButton','PHASE 2 · ROUND START','bloxd-processing','hub-bloxd-phase2-admin-style']:
    if needle not in s: raise SystemExit('missing '+needle)

p.write_text(s,encoding='utf-8')
print('Bloxd Phase 2 admin UI patch complete')
