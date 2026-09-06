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

def sub(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    s=s2
    print(label,'ok')

# ---------------------------------------------------------------------------
# 1) Hub API wrappers for preview, preflight, audit and backup.
# ---------------------------------------------------------------------------
api_marker="  async function adminGetCupRegistrations(tournamentId) { const data=await rpc('admin_get_cup_registrations',{p_tournament_id:tournamentId}); return data||[]; }"
api_add=api_marker+"\n  async function adminPreviewRoundImport(tournamentId,round,results) { return rpc('admin_preview_round_import',{p_tournament_id:tournamentId,p_round:round,p_results:results}); }\n  async function adminGetRoundPreflight(tournamentId,round) { return rpc('admin_get_round_preflight',{p_tournament_id:tournamentId,p_round:round}); }\n  async function adminGetCupBackup(tournamentId) { return rpc('admin_get_cup_backup',{p_tournament_id:tournamentId}); }\n  async function adminWriteAuditLog(action,tournamentId=null,round=null,details={}) { return rpc('admin_write_audit_log',{p_action:action,p_tournament_id:tournamentId,p_round:round,p_details:details||{}}); }\n  async function adminGetAuditLog(tournamentId=null,limit=100) { const data=await rpc('admin_get_audit_log',{p_tournament_id:tournamentId,p_limit:limit}); return data||[]; }"
rep(api_marker,api_add,'admin safety API wrappers')

export_marker="getMyAnimationState,ackMyAnimationState,adminGetCupRegistrations,subscribeToSocial"
export_new="getMyAnimationState,ackMyAnimationState,adminGetCupRegistrations,adminPreviewRoundImport,adminGetRoundPreflight,adminGetCupBackup,adminWriteAuditLog,adminGetAuditLog,subscribeToSocial"
rep(export_marker,export_new,'export admin safety APIs')

# ---------------------------------------------------------------------------
# 2) Shared admin safety helpers, backup and audit UI.
# ---------------------------------------------------------------------------
insert_before="  function openImport(){"
if insert_before not in s:
    raise SystemExit('openImport marker missing')
helpers=r'''  async function auditAction(action,tournamentId=null,round=null,details={}){
    try{return await api.adminWriteAuditLog(action,tournamentId,round,details);}catch(e){console.warn('admin audit log failed',e);return null;}
  }
  function adminIssueText(issue,data={}){
    const code=String(issue?.code||'');
    const map={
      no_winner:copy('No winner is stored. You can still continue if this is intentional.','Kein Gewinner gespeichert. Du kannst trotzdem fortfahren, wenn das beabsichtigt ist.','Aucun vainqueur enregistré.'),
      below_capacity:copy(`${data.players??data.participants??0} of ${data.max_players??'—'} configured slots are present.`,`${data.players??data.participants??0} von ${data.max_players??'—'} konfigurierten Slots sind in dieser Runde vorhanden.`,`${data.players??data.participants??0} / ${data.max_players??'—'} places sont présentes.`),
      above_capacity:copy('More players are present than the Cup maximum.','Es sind mehr Spieler vorhanden als das konfigurierte Cup-Maximum.','Plus de joueurs que le maximum du Cup.'),
      team_size:copy('At least one team is incomplete for the selected Cup mode.','Mindestens ein Team ist für den gewählten Cup-Modus unvollständig.','Au moins une équipe est incomplète.'),
      new_players:copy(`${data.new_global_players??0} new global player profile(s) will be created.`,`${data.new_global_players??0} neue globale Spielerprofile würden erstellt.`,`${data.new_global_players??0} nouveaux profils seront créés.`),
      overwrite:copy('Existing results for this round will be replaced.','Vorhandene Ergebnisse dieser Runde werden überschrieben.','Les résultats existants seront remplacés.'),
      finalized:copy('This round is already finalized. Importing will recalculate rating from this point.','Diese Runde ist bereits finalisiert. Der Import berechnet das Rating ab hier neu.','Cette manche est déjà finalisée.'),
      already_finalized:copy('This round is already finalized. Continuing will recalculate rating.','Diese Runde ist bereits finalisiert. Fortfahren berechnet das Rating neu.','Cette manche est déjà finalisée.'),
      no_participants:copy('No participating players are stored for this round.','Für diese Runde sind keine teilnehmenden Spieler gespeichert.','Aucun joueur participant.'),
      multiple_winners:copy('More than one winner event exists. Fix the round before finalizing.','Es gibt mehr als einen Gewinner. Korrigiere die Runde vor dem Finalisieren.','Plusieurs vainqueurs existent.'),
      duplicate_dm:copy('A player has more than one Deathmatch result in this round.','Ein Spieler hat mehr als eine Deathmatch-Wertung in dieser Runde.','Un joueur a plusieurs résultats Deathmatch.'),
      event_without_participation:copy('At least one event belongs to a player who did not participate.','Mindestens ein Event gehört zu einem Spieler, der nicht teilgenommen hat.','Un événement appartient à un joueur absent.'),
      invalid_points:copy('At least one event has an invalid point value.','Mindestens ein Event besitzt einen ungültigen Punktewert.','Un événement utilise une valeur invalide.')
    };
    return map[code]||String(issue?.message||code||copy('Unknown check result.','Unbekanntes Prüfergebnis.','Résultat inconnu.'));
  }
  function adminMetric(label,value,sub=''){
    return `<div class="v3-safety-metric"><span>${esc(label)}</span><strong>${esc(String(value??'—'))}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  }
  function adminIssueList(errors=[],warnings=[],data={}){
    const e=(errors||[]).map(x=>`<div class="v3-safety-issue error"><b>×</b><span>${esc(adminIssueText(x,data))}</span></div>`).join('');
    const w=(warnings||[]).map(x=>`<div class="v3-safety-issue warning"><b>!</b><span>${esc(adminIssueText(x,data))}</span></div>`).join('');
    return e+w||`<div class="v3-safety-issue ok"><b>✓</b><span>${copy('No issues detected.','Keine Auffälligkeiten erkannt.','Aucun problème détecté.')}</span></div>`;
  }
  function safeFileName(name){return String(name||'cup').normalize('NFKD').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80)||'cup';}
  async function downloadCupBackup(cup){
    if(!cup)return;
    const btn=$('#v3CupBackupButton');if(btn)btn.disabled=true;
    try{
      const backup=await api.adminGetCupBackup(cup.id);
      const blob=new Blob([JSON.stringify(backup,null,2)+'\n'],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`${safeFileName(cup.name)}-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
      await auditAction('cup_backup_export',cup.id,null,{cup_name:cup.name});
      toast(copy('Cup backup downloaded.','Cup-Backup heruntergeladen.','Sauvegarde téléchargée.'));
    }catch(e){toast(e.message||String(e),true);}finally{if(btn)btn.disabled=false;}
  }
  function auditActionLabel(action){
    const labels={round_import:copy('Round imported','Runde importiert','Manche importée'),round_finalize:copy('Rating finalized','Rating finalisiert','Rating finalisé'),round_recalculate:copy('Rating recalculated','Rating neu berechnet','Rating recalculé'),rating_cascade_recalculate:copy('Rating cascade recalculated','Rating-Kaskade neu berechnet','Cascade recalculée'),round_deleted:copy('Round deleted','Runde gelöscht','Manche supprimée'),round_event_adjusted:copy('Round event edited','Runden-Event bearbeitet','Événement modifié'),round_started:copy('Next round started','Nächste Runde gestartet','Manche démarrée'),cup_created:copy('Cup created','Cup erstellt','Cup créé'),cup_updated:copy('Cup updated','Cup bearbeitet','Cup modifié'),cup_deleted:copy('Cup deleted','Cup gelöscht','Cup supprimé'),cup_status_changed:copy('Cup status changed','Cup-Status geändert','Statut modifié'),cup_backup_export:copy('Cup backup exported','Cup-Backup exportiert','Sauvegarde exportée')};
    return labels[action]||String(action||'').replace(/_/g,' ');
  }
  async function openAuditLog(){
    let rows=[];try{rows=await api.adminGetAuditLog(null,120);}catch(e){return toast(e.message||String(e),true);}
    const m=document.createElement('div');m.className='v3-modal-backdrop';m.innerHTML=`<section class="v3-modal v3-audit-modal"><button class="modal-close" data-v3-close>×</button><span class="eyebrow">ADMIN · AUDIT LOG</span><h2>${copy('Recent admin activity','Letzte Admin-Aktivitäten','Activité admin récente')}</h2><p>${copy('Important tournament changes are recorded here with administrator, time and context.','Wichtige Turnieränderungen werden hier mit Admin, Zeitpunkt und Kontext protokolliert.','Les changements importants sont enregistrés ici.')}</p><div class="v3-audit-list">${rows.length?rows.map(r=>{const d=r.details||{};const cup=r.tournament_name||d.cup_name||'—';return `<article><div><strong>${esc(auditActionLabel(r.action))}</strong><small>${esc(new Date(r.created_at).toLocaleString())}</small></div><span>${esc(r.actor_name||'Admin')}</span><span>${esc(cup)}${r.round?` · ${copy('Round','Runde','Manche')} ${Number(r.round)}`:''}</span></article>`;}).join(''):`<div class="v3-empty">${copy('No audit entries yet.','Noch keine Audit-Einträge.','Aucune entrée.')}</div>`}</div></section>`;document.body.appendChild(m);m.onclick=e=>{if(e.target===m||e.target.closest('[data-v3-close]'))m.remove();};
  }
  function ensureAdminSafetyTools(cup){
    let bar=$('#v3AdminSafetyTools');if(!bar){bar=document.createElement('div');bar.id='v3AdminSafetyTools';bar.className='v3-admin-safety-tools';const work=$('.admin-workbench');const life=$('#v3AdminLifecycle');if(work)work.insertBefore(bar,life?.nextSibling||work.firstChild);}
    if(!bar)return;
    bar.innerHTML=`<div><span class="eyebrow">SAFETY & BACKUP</span><strong>${copy('Tournament protection','Turnier-Sicherheit','Sécurité tournoi')}</strong><small>${copy('Preview imports, verify finalize state and keep backups.','Imports vorprüfen, Finalize kontrollieren und Backups sichern.','Prévisualiser, vérifier et sauvegarder.')}</small></div><div><button class="ghost-button" id="v3CupBackupButton">${copy('Cup backup (.json)','Cup-Backup (.json)','Sauvegarde (.json)')}</button><button class="ghost-button" id="v3AuditLogButton">${copy('Audit log','Audit-Log','Journal audit')}</button></div>`;
    $('#v3CupBackupButton',bar).onclick=()=>downloadCupBackup(cup);$('#v3AuditLogButton',bar).onclick=openAuditLog;
  }

'''
s=s.replace(insert_before,helpers+insert_before,1)
print('admin helpers inserted')

# ---------------------------------------------------------------------------
# 3) Two-step import preview. No DB write occurs until explicit confirmation.
# ---------------------------------------------------------------------------
new_import_finalize=r'''  function openImport(){
    const cup=adminCup();if(!cup)return;
    cupData(cup.id,true).then(data=>{
      const m=document.createElement('div');m.className='v3-modal-backdrop';
      m.innerHTML=`<section class="v3-modal v3-import-modal"><button class="modal-close" data-v3-close>×</button><span class="eyebrow">${esc(cup.name)} · ${copy('Round','Runde','Manche')} ${real.adminRound}</span><h2>${copy('Import results','Ergebnisse importieren','Importer résultats')}</h2><p>k = Kill (+1), dm = Deathmatch (+3), w = Win (+2). ${copy('First run the preview. Nothing is written to the database until you confirm the checked result.','Prüfe zuerst die Vorschau. Erst nach der ausdrücklichen Bestätigung werden Daten in die Datenbank geschrieben.','Prévisualise d’abord. Rien n’est écrit avant confirmation.')}</p><textarea id="v3ImportText" rows="14" placeholder="Orange:\nPlayer1: k:3 dm:1 w:0, Player2: /\n\nDark Green:\nPlayer3: k:1 dm:0 w:1, Player4: k:2 dm:1 w:0"></textarea><div class="v3-form-error"></div><div id="v3ImportPreview" class="v3-safety-preview" hidden></div><div class="v3-import-actions"><button class="secondary-button" id="v3PreviewImport">${copy('Check preview','Vorschau prüfen','Vérifier l’aperçu')}</button><button class="cta-button" id="v3ConfirmImport" hidden>${copy('Confirm import','Import bestätigen','Confirmer import')}</button></div></section>`;
      document.body.appendChild(m);m.onclick=e=>{if(e.target===m||e.target.closest('[data-v3-close]'))m.remove();};
      let checkedText='',checkedResults=null,checkedPreview=null;
      const ta=$('#v3ImportText',m),previewEl=$('#v3ImportPreview',m),confirmBtn=$('#v3ConfirmImport',m),previewBtn=$('#v3PreviewImport',m),errEl=$('.v3-form-error',m);
      const invalidate=()=>{if(ta.value!==checkedText){confirmBtn.hidden=true;previewEl.hidden=true;checkedResults=null;checkedPreview=null;}};ta.addEventListener('input',invalidate);
      previewBtn.onclick=async()=>{
        previewBtn.disabled=true;errEl.textContent='';
        try{
          const results=parseOldImport(ta.value,cup,data),pv=await api.adminPreviewRoundImport(cup.id,real.adminRound,results);checkedText=ta.value;checkedResults=results;checkedPreview=pv;
          previewEl.innerHTML=`<div class="v3-safety-metrics">${adminMetric(copy('Teams','Teams','Équipes'),pv.teams)}${adminMetric(copy('Players','Spieler','Joueurs'),pv.players,`${pv.max_players} max`)}${adminMetric('Kills',pv.kills)}${adminMetric('Deathmatch',pv.deathmatches)}${adminMetric(copy('Winner','Gewinner','Vainqueur'),pv.winner_name||'—')}${adminMetric(copy('New profiles','Neue Profile','Nouveaux profils'),pv.new_global_players)}</div>${pv.new_global_player_names?.length?`<div class="v3-preview-new"><b>${copy('New global profiles:','Neue globale Profile:','Nouveaux profils :')}</b> ${pv.new_global_player_names.map(esc).join(', ')}</div>`:''}<div class="v3-safety-issues">${adminIssueList([],pv.warnings||[],pv)}</div>`;
          previewEl.hidden=false;confirmBtn.hidden=false;previewBtn.textContent=copy('Refresh preview','Vorschau aktualisieren','Actualiser l’aperçu');
        }catch(err){errEl.textContent=err.message||String(err);confirmBtn.hidden=true;previewEl.hidden=true;}finally{previewBtn.disabled=false;}
      };
      confirmBtn.onclick=async()=>{
        if(!checkedResults||ta.value!==checkedText){errEl.textContent=copy('The import text changed. Run the preview again.','Der Importtext wurde verändert. Bitte die Vorschau erneut prüfen.','Le texte a changé. Relance la prévisualisation.');confirmBtn.hidden=true;return;}
        confirmBtn.disabled=true;previewBtn.disabled=true;errEl.textContent='';
        try{
          const r=real.adminRound;await api.adminImportRoundByName(cup.id,r,checkedResults);
          await auditAction('round_import',cup.id,r,{teams:checkedPreview?.teams,players:checkedPreview?.players,kills:checkedPreview?.kills,deathmatches:checkedPreview?.deathmatches,wins:checkedPreview?.wins,winner:checkedPreview?.winner_name,overwrite:!!checkedPreview?.overwrite_existing_round,was_finalized:!!checkedPreview?.already_finalized});
          m.remove();real.cupCache.delete(cup.id);toast(copy('Round imported. Rating has NOT been finalized yet.','Runde importiert. Cup-Stats sind live; Placement und Rating-Overlay folgen erst nach „Rating finalisieren“.','Manche importée. Rating non finalisé.'));await refreshCups();
        }catch(err){errEl.textContent=err.message||String(err);confirmBtn.disabled=false;previewBtn.disabled=false;}
      };
    });
  }
  async function confirmFinalize(){
    const cup=adminCup();if(!cup)return;
    let pre;try{pre=await api.adminGetRoundPreflight(cup.id,real.adminRound);}catch(e){return toast(e.message||String(e),true);}
    const m=document.createElement('div');m.className='v3-modal-backdrop';const hasErrors=(pre.errors||[]).length>0;
    m.innerHTML=`<section class="v3-modal v3-preflight-modal"><button class="modal-close" data-v3-close>×</button><span class="eyebrow">FINALIZE PREFLIGHT · ${esc(cup.name)}</span><h2>${copy(`Check round ${real.adminRound}`,`Runde ${real.adminRound} prüfen`,`Vérifier la manche ${real.adminRound}`)}</h2><p>${copy('The database state is checked before rating is changed. Warnings are allowed; errors must be fixed first.','Vor der Rating-Berechnung wird der echte Datenbankzustand geprüft. Warnungen sind erlaubt; Fehler müssen zuerst behoben werden.','La base de données est vérifiée avant le rating.')}</p><div class="v3-safety-metrics">${adminMetric(copy('Participants','Teilnehmer','Participants'),pre.participants,`${pre.max_players} max`)}${adminMetric(copy('Teams','Teams','Équipes'),pre.teams)}${adminMetric('Kills',pre.kills)}${adminMetric('Deathmatch',pre.deathmatches)}${adminMetric(copy('Winner','Gewinner','Vainqueur'),pre.winner_name||'—')}${adminMetric(copy('Points','Punkte','Points'),pre.points)}</div><div class="v3-safety-issues">${adminIssueList(pre.errors||[],pre.warnings||[],pre)}</div><button class="cta-button wide" id="v3PreflightConfirm" ${hasErrors?'disabled':''}>${hasErrors?copy('Fix errors first','Erst Fehler beheben','Corriger les erreurs'):pre.already_finalized?copy('Recalculate rating','Rating neu berechnen','Recalculer rating'):copy('Finalize rating','Rating finalisieren','Finaliser rating')}</button></section>`;
    document.body.appendChild(m);m.onclick=e=>{if(e.target===m||e.target.closest('[data-v3-close]'))m.remove();};
    const btn=$('#v3PreflightConfirm',m);if(hasErrors)return;
    btn.onclick=async()=>{
      btn.disabled=true;
      try{
        if(!pre.already_finalized){
          await api.finalizeRoundRating(cup.id,real.adminRound);await auditAction('round_finalize',cup.id,real.adminRound,{participants:pre.participants,kills:pre.kills,deathmatches:pre.deathmatches,wins:pre.wins,winner:pre.winner_name});toast(copy('Round rating finalized.','Runden-Rating finalisiert.','Rating finalisé.'));
        }else{
          try{await api.recalculateRoundRating(cup.id,real.adminRound);await auditAction('round_recalculate',cup.id,real.adminRound,{participants:pre.participants});toast(copy('Rating recalculated.','Rating neu berechnet.','Rating recalculé.'));}
          catch(e){
            if(/Later rounds are finalized/i.test(e.message)&&confirm(copy('Later rounds are already finalized. Recalculate this round and every later finalized round in order?','Spätere Runden sind bereits finalisiert. Diese Runde und alle späteren finalisierten Runden der Reihe nach neu berechnen?','Recalculer cette manche et toutes les suivantes ?'))){await api.recalculateRatingFromRound(cup.id,real.adminRound);await auditAction('rating_cascade_recalculate',cup.id,real.adminRound,{});toast(copy('Rating cascade recalculated.','Rating ab dieser Runde vollständig neu berechnet.','Recalcul complet effectué.'));}else throw e;
          }
        }
        m.remove();real.cupCache.delete(cup.id);await refreshEveryVisibleSurface();
      }catch(e){toast(e.message||String(e),true);btn.disabled=false;}
    };
  }
'''
sub(r"  function openImport\(\)\{.*?\n  async function confirmFinalize\(\)\{.*?\n\n  async function openManageGlobalPlayer",new_import_finalize+"\n  async function openManageGlobalPlayer",'import preview + finalize preflight',re.S)

# ---------------------------------------------------------------------------
# 4) Show safety tools in Cup admin.
# ---------------------------------------------------------------------------
rep("renderAdminParticipants(cup,data);renderAdminRegistrations(cup);injectAdminLifecycleReal(cup);","renderAdminParticipants(cup,data);renderAdminRegistrations(cup);injectAdminLifecycleReal(cup);ensureAdminSafetyTools(cup);",'show safety tools')

# ---------------------------------------------------------------------------
# 5) Audit important existing admin actions.
# ---------------------------------------------------------------------------
old="if(cup)api.adminStartNextRound(cup.id).then(async n=>{real.adminRound=n;real.cupCache.delete(cup.id);toast(copy('Next round started.','Nächste Runde gestartet.','Manche suivante démarrée.'));await refreshCups();})"
new="if(cup)api.adminStartNextRound(cup.id).then(async n=>{real.adminRound=n;real.cupCache.delete(cup.id);await auditAction('round_started',cup.id,n,{});toast(copy('Next round started.','Nächste Runde gestartet.','Manche suivante démarrée.'));await refreshCups();})"
rep(old,new,'audit next round')

old="api.adminDeleteRound(cup.id,round).then(async()=>{real.adminRound=Math.max(1,Math.min(real.adminRound,cup.current_round-1));real.cupCache.delete(cup.id);toast(copy('Round deleted.','Runde gelöscht.','Manche supprimée.'));await refreshCups();})"
new="api.adminDeleteRound(cup.id,round).then(async()=>{real.adminRound=Math.max(1,Math.min(real.adminRound,cup.current_round-1));real.cupCache.delete(cup.id);await auditAction('round_deleted',cup.id,round,{later_rounds_renumbered:true});toast(copy('Round deleted.','Runde gelöscht.','Manche supprimée.'));await refreshCups();})"
rep(old,new,'audit delete round')

old="api.adminAdjustEvent(ev.dataset.playerId,real.adminRound,type,Number(d)).then(async()=>{real.cupCache.delete(adminCup().id);await renderAdminLive();})"
new="api.adminAdjustEvent(ev.dataset.playerId,real.adminRound,type,Number(d)).then(async()=>{const c=adminCup();await auditAction('round_event_adjusted',c?.id||null,real.adminRound,{player_id:ev.dataset.playerId,type,delta:Number(d)});if(c)real.cupCache.delete(c.id);await renderAdminLive();})"
rep(old,new,'audit event edit')

old="api.adminSetCupStatus(cup.id,st.dataset.v3CupStatus).then(async()=>{toast(copy('Cup status changed.','Cup-Status geändert.','Statut modifié.'));await refreshCups();})"
new="api.adminSetCupStatus(cup.id,st.dataset.v3CupStatus).then(async()=>{await auditAction('cup_status_changed',cup.id,null,{from:cup.status,to:st.dataset.v3CupStatus,cup_name:cup.name});toast(copy('Cup status changed.','Cup-Status geändert.','Statut modifié.'));await refreshCups();})"
rep(old,new,'audit cup status')

old="api.adminDeleteCup(cup.id).then(async()=>{real.adminCupId=null;real.cupCache.delete(cup.id);await refreshCups();})"
new="api.adminDeleteCup(cup.id).then(async()=>{await auditAction('cup_deleted',cup.id,null,{cup_name:cup.name});real.adminCupId=null;real.cupCache.delete(cup.id);await refreshCups();})"
rep(old,new,'audit cup delete')

# Cup create/update are inside modal submit handlers.
old="const id=await api.adminCreateCup({name:f.get('name'),mode:Number(f.get('mode')),maxPlayers:Number(f.get('max')),roundCount:Number(f.get('rounds')),startsAt:f.get('start')?new Date(f.get('start')).toISOString():null,status:f.get('status'),iconUrl});m.remove();real.adminCupId=id;toast(copy('Cup created.','Cup erstellt.','Cup créé.'));await refreshCups();"
new="const id=await api.adminCreateCup({name:f.get('name'),mode:Number(f.get('mode')),maxPlayers:Number(f.get('max')),roundCount:Number(f.get('rounds')),startsAt:f.get('start')?new Date(f.get('start')).toISOString():null,status:f.get('status'),iconUrl});await auditAction('cup_created',id,null,{cup_name:String(f.get('name')),mode:Number(f.get('mode')),max_players:Number(f.get('max')),rounds:Number(f.get('rounds')),status:String(f.get('status'))});m.remove();real.adminCupId=id;toast(copy('Cup created.','Cup erstellt.','Cup créé.'));await refreshCups();"
rep(old,new,'audit cup create')

old="await api.adminUpdateCup({id:cup.id,name:f.get('name'),mode:Number(f.get('mode')),maxPlayers:Number(f.get('max')),roundCount:Number(f.get('rounds')),startsAt:f.get('start')?new Date(f.get('start')).toISOString():null,status:f.get('status'),iconUrl});m.remove();real.cupCache.delete(cup.id);toast(copy('Cup updated.','Cup aktualisiert.','Cup mis à jour.'));await refreshCups();"
new="await api.adminUpdateCup({id:cup.id,name:f.get('name'),mode:Number(f.get('mode')),maxPlayers:Number(f.get('max')),roundCount:Number(f.get('rounds')),startsAt:f.get('start')?new Date(f.get('start')).toISOString():null,status:f.get('status'),iconUrl});await auditAction('cup_updated',cup.id,null,{cup_name:String(f.get('name')),previous_name:cup.name,mode:Number(f.get('mode')),max_players:Number(f.get('max')),rounds:Number(f.get('rounds')),status:String(f.get('status'))});m.remove();real.cupCache.delete(cup.id);toast(copy('Cup updated.','Cup aktualisiert.','Cup mis à jour.'));await refreshCups();"
rep(old,new,'audit cup update')

# ---------------------------------------------------------------------------
# 6) Styling.
# ---------------------------------------------------------------------------
css=r'''
<style id="hub-admin-safety-qol">
  .v3-admin-safety-tools{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 18px;padding:17px 19px;border:1px solid rgba(126,101,190,.34);border-radius:14px;background:linear-gradient(135deg,rgba(36,29,58,.82),rgba(24,20,39,.92))}
  .v3-admin-safety-tools>div:first-child{display:grid;gap:3px}.v3-admin-safety-tools strong{font-size:14px;color:#fff}.v3-admin-safety-tools small{color:#9b93ad;font-size:11px}.v3-admin-safety-tools>div:last-child{display:flex;gap:9px;flex-wrap:wrap}
  .v3-import-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.v3-import-actions button[hidden]{display:none!important}
  .v3-safety-preview{margin-top:14px;padding:14px;border:1px solid rgba(116,92,180,.35);border-radius:12px;background:rgba(13,10,22,.55)}
  .v3-safety-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0}.v3-safety-metric{padding:11px 12px;border:1px solid rgba(118,101,158,.25);border-radius:10px;background:rgba(255,255,255,.025);display:grid;gap:2px}.v3-safety-metric span{color:#8e879f;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.v3-safety-metric strong{color:#fff;font-size:18px}.v3-safety-metric small{color:#6f687c;font-size:9px}
  .v3-safety-issues{display:grid;gap:7px;margin:12px 0}.v3-safety-issue{display:grid;grid-template-columns:24px 1fr;align-items:start;gap:8px;padding:10px 11px;border-radius:9px;font-size:11px;line-height:1.45}.v3-safety-issue b{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:11px}.v3-safety-issue.warning{background:rgba(237,161,58,.1);border:1px solid rgba(237,161,58,.3);color:#f5d8a5}.v3-safety-issue.warning b{background:rgba(237,161,58,.22);color:#ffc15c}.v3-safety-issue.error{background:rgba(236,72,96,.11);border:1px solid rgba(236,72,96,.32);color:#ffc4cd}.v3-safety-issue.error b{background:rgba(236,72,96,.22);color:#ff7388}.v3-safety-issue.ok{background:rgba(68,190,133,.1);border:1px solid rgba(68,190,133,.26);color:#b6f0d3}.v3-safety-issue.ok b{background:rgba(68,190,133,.2);color:#67dfa8}.v3-preview-new{font-size:10px;color:#bbb3ca;padding:8px 2px 2px}.v3-preview-new b{color:#fff}
  .v3-audit-modal{width:min(760px,calc(100vw - 30px))!important}.v3-audit-list{display:grid;gap:7px;max-height:55vh;overflow:auto;margin-top:15px;padding-right:4px}.v3-audit-list article{display:grid;grid-template-columns:minmax(210px,1.3fr) .7fr 1fr;gap:12px;align-items:center;padding:11px 12px;border:1px solid rgba(118,101,158,.2);border-radius:10px;background:rgba(255,255,255,.025)}.v3-audit-list article>div{display:grid;gap:2px}.v3-audit-list strong{font-size:11px;color:#fff}.v3-audit-list small,.v3-audit-list span{font-size:9px;color:#8f879e}.v3-audit-list span:last-child{text-align:right}
  @media(max-width:760px){.v3-admin-safety-tools{align-items:flex-start;flex-direction:column}.v3-safety-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.v3-import-actions{grid-template-columns:1fr}.v3-audit-list article{grid-template-columns:1fr}.v3-audit-list span:last-child{text-align:left}}
</style>
'''
if 'id="hub-admin-safety-qol"' in s:
    raise SystemExit('safety css already exists')
s=s.replace('</head>',css+'\n</head>',1)
print('safety CSS inserted')

# Guards
for needle in [
  'admin_preview_round_import','admin_get_round_preflight','admin_get_cup_backup','admin_write_audit_log','admin_get_audit_log',
  'function ensureAdminSafetyTools','Vorschau prüfen','FINALIZE PREFLIGHT','cup_backup_export','v3-audit-list','hub-admin-safety-qol'
]:
    if needle not in s:raise SystemExit('missing guard '+needle)

p.write_text(s)
print('admin safety QoL patch complete')
