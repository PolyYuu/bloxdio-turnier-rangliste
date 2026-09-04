from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

def replace_once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)
    print(label,'ok')

def sub_once(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    s=s2
    print(label,'ok')

# 1) Fix the admin scope regression: the admin IIFE cannot call syncOwnProfileToUi.
scope_old="if(live.player?.id===gp.id){live.player=await api.getMyProfile();try{live.stats=await api.getCareerStatsFor(gp.id);}catch(_){}await syncOwnProfileToUi();}"
if s.count(scope_old)!=2:
    raise SystemExit(f'admin scope fix: expected 2 occurrences, got {s.count(scope_old)}')
s=s.replace(scope_old,"if(live.player?.id===gp.id){live.player=await api.getMyProfile();try{live.stats=await api.getCareerStatsFor(gp.id);}catch(_){}}")
print('admin scope fix ok')

# 2) HubAPI wrapper for the logged-in player registration state.
api_marker="  async function cancelCupRegistration(registrationId) { await rpc('cancel_my_cup_registration',{p_registration_id:registrationId}); }"
api_add=api_marker+"\n  async function getMyCupRegistrationState(tournamentId) { const data=await rpc('get_my_cup_registration_state',{p_tournament_id:tournamentId}); return Array.isArray(data)?(data[0]||null):data; }"
replace_once(api_marker,api_add,'registration state API')

export_old="createCupRegistration,respondCupInvite,cancelCupRegistration,getSocialState"
export_new="createCupRegistration,respondCupInvite,cancelCupRegistration,getMyCupRegistrationState,getSocialState"
replace_once(export_old,export_new,'export registration state API')

# 3) Date-based default Cup selection.
refresh_marker="  // ---------- Cups ----------\n  async function refreshCups(){"
helpers=r'''  // ---------- Cups ----------
  function cupStartMs(c){const t=Date.parse(c?.starts_at||'');return Number.isFinite(t)?t:null;}
  function defaultPublicCup(){
    const cups=real.cups||[];if(!cups.length)return null;
    const liveCup=cups.find(c=>c.status==='live');if(liveCup)return liveCup;
    const now=Date.now();
    const dated=cups.map(c=>({c,t:cupStartMs(c)})).filter(x=>x.t!==null);
    const future=dated.filter(x=>x.t>=now&&x.c.status!=='finished').sort((a,b)=>a.t-b.t)[0]?.c;
    if(future)return future;
    const past=dated.filter(x=>x.t<now).sort((a,b)=>b.t-a.t)[0]?.c;
    return past||cups[0]||null;
  }
  function nextRegistrationCup(){
    const regs=(real.cups||[]).filter(c=>c.status==='registration');if(!regs.length)return null;
    const now=Date.now();
    const dated=regs.map(c=>({c,t:cupStartMs(c)}));
    return dated.filter(x=>x.t!==null&&x.t>=now).sort((a,b)=>a.t-b.t)[0]?.c||dated.filter(x=>x.t!==null).sort((a,b)=>b.t-a.t)[0]?.c||regs[0];
  }
  async function resetToDefaultPublicCup(){
    const cup=defaultPublicCup();if(!cup)return;
    real.selectedCupId=cup.id;renderCupNav();await renderSelectedCup();
  }
  async function refreshCups(){'''
replace_once(refresh_marker,helpers,'Cup date helpers')

old_select="if(!real.selectedCupId||!real.cups.some(c=>c.id===real.selectedCupId))real.selectedCupId=(real.cups.find(c=>c.status==='live')||real.cups.find(c=>c.status==='registration')||real.cups[0])?.id||null;"
new_select="if(!real.selectedCupId||!real.cups.some(c=>c.id===real.selectedCupId))real.selectedCupId=defaultPublicCup()?.id||null;"
replace_once(old_select,new_select,'default Cup selection')

replace_once("    if(upcoming)renderUpcomingCup(cup,data); else renderPastCup(cup,data);","    if(upcoming)await renderUpcomingCup(cup,data); else renderPastCup(cup,data);",'await upcoming Cup renderer')

# 4) Public registration state, cancellation/withdrawal, and cleaner confirmed-team layout.
new_upcoming=r'''  async function registrationStateForCup(cup){
    if(!live.session||!cup)return null;
    try{return await api.getMyCupRegistrationState(cup.id);}catch(e){console.warn('registration state',e);return null;}
  }
  function registrationActionLabel(st){
    if(!st)return copy('Register team','Team anmelden','Inscrire l’équipe');
    if(st.registration_status==='confirmed')return copy('Leave team registration','Team abmelden','Annuler l’inscription');
    if(st.is_creator)return copy('Withdraw request','Anfrage zurückziehen','Retirer la demande');
    if(st.member_status==='pending')return copy('Decline request','Anfrage ablehnen','Refuser la demande');
    return copy('Withdraw registration','Anmeldung zurückziehen','Retirer l’inscription');
  }
  async function paintRegistrationAction(cup,hero){
    const btn=$('[data-open-register]',hero);if(!btn)return;
    btn.hidden=cup.status!=='registration';if(btn.hidden)return;
    const st=await registrationStateForCup(cup),label=registrationActionLabel(st);
    btn.dataset.registrationId=st?.registration_id||'';
    btn.dataset.registrationStatus=st?.registration_status||'';
    btn.classList.toggle('registration-cancel',!!st);
    btn.innerHTML=`<span>${label}</span>${st?'':' →'}`;
  }
  async function renderUpcomingCup(cup,data){
    const hero=$('#upcomingCupView .registration-hero');if(hero){let icon=$('.v3-upcoming-icon',hero);if(cup.cup_icon_url){if(!icon){icon=document.createElement('img');icon.className='v3-upcoming-icon';hero.prepend(icon);}icon.src=cup.cup_icon_url;icon.hidden=false;}else if(icon)icon.hidden=true;$('h2',hero).textContent=cup.name;$('p',hero).textContent=`${formatDate(cup.starts_at)} · ${MODE[cup.mode]} · ${cup.round_count} ${copy('rounds','Runden','manches')}`;const n=$('.registration-meter b',hero);if(n)n.textContent=String(data.players.length);const label=$('.registration-meter span',hero);if(label)label.textContent=`${copy('of','von','sur')} ${cup.max_players} ${copy('players','Spielern','joueurs')}`;const meter=$('.registration-meter .meter i',hero);if(meter)meter.style.width=`${Math.min(100,data.players.length/cup.max_players*100)}%`;await paintRegistrationAction(cup,hero);}
    const card=$('#upcomingCupView .registered-list-card');if(card){const h=$('h2',card);if(h)h.textContent=`${data.players.length} / ${cup.max_players}`;}
    const list=$('#publicRegistrationList');if(list){const teams=data.teams.map(t=>data.players.filter(p=>p.team_id===t.id)).filter(x=>x.length);list.innerHTML=teams.length?teams.map(players=>`<div class="registration-row v3-public-registration-row"><div class="v3-registration-members">${players.map((p,i)=>`${i?'<b class="v3-registration-plus">+</b>':''}<span class="v3-registration-player">${playerAvatarFromCup(p)}<strong>${esc(p.name)}</strong></span>`).join('')}</div><i class="v3-registration-check">✓</i></div>`).join(''):`<p class="v3-empty">${copy('No confirmed registrations yet.','Noch keine bestätigten Anmeldungen.','Aucune inscription confirmée.')}</p>`;}
  }'''
sub_once(r"  function renderUpcomingCup\(cup,data\)\{.*?\n  \}\n  async function updateOverviewCupCards",new_upcoming+'\n  async function updateOverviewCupCards','replace upcoming Cup registration UX',re.S)

new_open=r'''  async function openRegister(){
    if(!ensureLogin())return;
    const cup=real.cups.find(c=>c.id===real.selectedCupId&&c.status==='registration')||nextRegistrationCup();
    if(!cup)return toast(copy('Registration is currently closed.','Die Anmeldung ist aktuell geschlossen.','Les inscriptions sont fermées.'),true);
    const current=await registrationStateForCup(cup);
    if(current){
      const confirmed=current.registration_status==='confirmed';
      const message=confirmed
        ?copy('Are you sure you want to leave this tournament registration? The registered team will be removed.','Sicher, dass du dich vom Turnier abmelden möchtest? Das angemeldete Team wird entfernt.','Confirmer l’annulation de l’inscription ?')
        :current.is_creator
          ?copy('Are you sure you want to withdraw the team request?','Sicher, dass du die Team-Anfrage zurückziehen möchtest?','Retirer la demande d’équipe ?')
          :current.member_status==='pending'
            ?copy('Are you sure you want to decline this team request?','Sicher, dass du diese Team-Anfrage ablehnen möchtest?','Refuser cette demande ?')
            :copy('Are you sure you want to withdraw from this registration?','Sicher, dass du deine Anmeldung zurückziehen möchtest?','Retirer ton inscription ?');
      if(!confirm(message))return;
      try{await api.cancelCupRegistration(current.registration_id);real.cupCache.delete(cup.id);await refreshSocial();await refreshCups();toast(confirmed?copy('Team registration removed.','Team-Anmeldung entfernt.','Inscription supprimée.'):copy('Request withdrawn.','Anfrage zurückgezogen.','Demande retirée.'));}catch(e){toast(e.message||String(e),true);}return;
    }
    await refreshSocial();const needed=Math.max(0,Number(cup.mode)-1);if(needed===0){try{await api.createCupRegistration(cup.id,[]);real.cupCache.delete(cup.id);toast(copy('Registration confirmed.','Anmeldung bestätigt.','Inscription confirmée.'));await refreshSocial();await refreshCups();}catch(e){toast(e.message,true);}return;}
    const friends=real.social?.friends||[];const others=(live.globalPlayers||[]).filter(p=>p.id!==live.player.id&&!friends.some(f=>f.id===p.id));
    const opts=(arr)=>arr.map(p=>`<option value="${p.id}">${esc(p.current_name)}</option>`).join('');
    const m=document.createElement('div');m.id='v3RegisterLive';m.className='v3-modal-backdrop';m.innerHTML=`<section class="v3-modal"><button class="modal-close" data-v3-reg-close>×</button><span class="eyebrow">${esc(cup.name)} · ${MODE[cup.mode]}</span><h2>${copy('Register team','Team anmelden','Inscrire l’équipe')}</h2><p>${copy('Your team is only registered after every invited player accepts.','Euer Team ist erst angemeldet, wenn alle eingeladenen Spieler angenommen haben.','L’équipe est confirmée seulement après acceptation de tous les invités.')}</p><form id="v3RegForm">${Array.from({length:needed},(_,i)=>`<label><span>${copy('Player','Spieler','Joueur')} ${i+2}</span><select class="v3-reg-mate" required><option value="">${copy('Select player …','Spieler auswählen …','Choisir un joueur …')}</option>${friends.length?`<optgroup label="${copy('Friends','Freunde','Amis')}">${opts(friends)}</optgroup>`:''}<optgroup label="${copy('Other players','Andere Spieler','Autres joueurs')}">${opts(others)}</optgroup></select></label>`).join('')}<div class="v3-form-error" id="v3RegErr"></div><button class="cta-button wide">${copy('Send invitation','Einladung senden','Envoyer l’invitation')}</button></form></section>`;document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-v3-reg-close]'))m.remove();});
    $('#v3RegForm',m).onsubmit=async e=>{e.preventDefault();const ids=$$('.v3-reg-mate',m).map(s=>s.value);if(new Set(ids).size!==ids.length){$('#v3RegErr',m).textContent=copy('Choose different players.','Wähle unterschiedliche Spieler.','Choisis des joueurs différents.');return;}e.submitter.disabled=true;try{await api.createCupRegistration(cup.id,ids);m.remove();real.cupCache.delete(cup.id);toast(copy('Invitation sent. Registration is pending until everyone accepts.','Einladung gesendet. Die Anmeldung ist ausstehend, bis alle angenommen haben.','Invitation envoyée.'));await refreshSocial();await refreshCups();}catch(err){$('#v3RegErr',m).textContent=err.message;e.submitter.disabled=false;}};
  }'''
sub_once(r"  async function openRegister\(\)\{.*?\n  \}\n\n  function openCupTeamProfile",new_open+'\n\n  function openCupTeamProfile','registration cancel/withdraw flow',re.S)

# 5) Clicking the top-nav Cup item always reselects the most relevant Cup.
click_marker="    if(e.target.closest('[data-v3-overview-login]')){e.preventDefault();e.stopImmediatePropagation();$('#loginDemoButton')?.click();return;}"
click_add=click_marker+"\n    const cupNav=e.target.closest('.primary-nav [data-route=\"cup\"]');if(cupNav){const preferred=defaultPublicCup();if(preferred){real.selectedCupId=preferred.id;setTimeout(()=>{renderCupNav();renderSelectedCup();},0);}}"
replace_once(click_marker,click_add,'Cup nav resets to date default')

# 6) Larger Cup selector + fixed registration card spacing/alignment.
css=r'''
<style id="hub-cup-registration-ux-fixes">
  .cup-selector{min-width:267px!important;padding:18px 21px!important;border-radius:11px!important}
  .cup-selector>span{font-size:10px!important}
  .cup-selector select{margin-top:9px!important;padding:12px!important;font-size:13px!important;border-radius:7px!important}
  .registered-list-card{padding:24px 0 18px!important}
  .registered-list-card>.eyebrow,.registered-list-card>h2{margin-left:22px!important;margin-right:22px!important}
  .registered-list-card .registration-list{padding:12px 18px 0!important}
  .v3-public-registration-row{display:flex!important;align-items:center!important;gap:14px!important;padding:11px 13px!important}
  .v3-registration-members{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
  .v3-registration-player{display:grid!important;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:9px;flex:1;min-width:0;color:#fff!important}
  .v3-registration-player .cup-list-avatar{width:34px!important;height:34px!important;margin:0!important}
  .v3-registration-player strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .v3-registration-plus{flex:0 0 20px;text-align:center;color:#8d81a7!important}
  .v3-registration-check{flex:0 0 18px;color:var(--green);font-style:normal;font-weight:900;text-align:center}
  .registration-hero .cta-button.registration-cancel{border:1px solid rgba(255,104,126,.55)!important;color:#ffdce3!important;background:linear-gradient(90deg,rgba(117,32,62,.72),rgba(85,28,68,.8))!important}
  @media(max-width:760px){.cup-selector{min-width:220px!important}.v3-registration-members{gap:6px}.v3-registration-player{grid-template-columns:30px minmax(0,1fr);gap:6px}.v3-registration-player .cup-list-avatar{width:30px!important;height:30px!important}.v3-registration-plus{flex-basis:14px}}
</style>
'''
if 'id="hub-cup-registration-ux-fixes"' in s:raise SystemExit('Cup UX style already exists')
s=s.replace('</head>',css+'\n</head>',1)

# Guards.
required=[
  "get_my_cup_registration_state",
  "defaultPublicCup()",
  "nextRegistrationCup()",
  "Team abmelden",
  "Anfrage zurückziehen",
  "v3-registration-members",
  "min-width:267px!important",
  "real.selectedCupId=defaultPublicCup()?.id||null",
]
for needle in required:
    if needle not in s:raise SystemExit('missing expected patch: '+needle)
if 'await syncOwnProfileToUi();' in s[s.find('async function openManageGlobalPlayer'):s.find('async function openManagePlayer')]:
    raise SystemExit('admin scope call still present')

p.write_text(s)
print('all Cup registration/admin-scope assertions passed')
