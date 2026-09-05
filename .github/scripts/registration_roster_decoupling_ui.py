from pathlib import Path
import re
p=Path('index.html');s=p.read_text()

def sub1(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{label}: {n}')
    s=s2;print(label,'ok')

def rep1(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: {n}')
    s=s.replace(old,new,1);print(label,'ok')

# Hub API wrapper for public confirmed registration overview.
marker="  async function getMyCupRegistrationState(tournamentId) { const data=await rpc('get_my_cup_registration_state',{p_tournament_id:tournamentId}); return Array.isArray(data)?(data[0]||null):data; }"
rep1(marker,marker+"\n  async function getCupRegistrationOverview(tournamentId) { const data=await rpc('get_cup_registration_overview',{p_tournament_id:tournamentId}); return data||[]; }",'registration overview api')
rep1('sendFriendRequest,respondFriendRequest,removeFriend,createCupRegistration,respondCupInvite,cancelCupRegistration,getMyCupRegistrationState,','sendFriendRequest,respondFriendRequest,removeFriend,createCupRegistration,respondCupInvite,cancelCupRegistration,getMyCupRegistrationState,getCupRegistrationOverview,','export overview api')

new_renderer=r'''  async function renderUpcomingCup(cup,data){
    let registrations=[];try{registrations=await api.getCupRegistrationOverview(cup.id);}catch(e){console.warn('registration overview',e);}
    const registeredPlayers=registrations.reduce((n,r)=>n+(Array.isArray(r.member_names)?r.member_names.length:0),0);
    const hero=$('#upcomingCupView .registration-hero');if(hero){
      let icon=$('.v3-upcoming-icon',hero);if(cup.cup_icon_url){if(!icon){icon=document.createElement('img');icon.className='v3-upcoming-icon';hero.prepend(icon);}icon.src=cup.cup_icon_url;icon.hidden=false;}else if(icon)icon.hidden=true;
      $('h2',hero).textContent=cup.name;$('p',hero).textContent=`${formatDate(cup.starts_at)} · ${MODE[cup.mode]} · ${cup.round_count} ${copy('rounds','Runden','manches')}`;
      const n=$('.registration-meter b',hero);if(n)n.textContent=String(registeredPlayers);const label=$('.registration-meter span',hero);if(label)label.textContent=`${copy('of','von','sur')} ${cup.max_players} ${copy('players','Spielern','joueurs')}`;const meter=$('.registration-meter .meter i',hero);if(meter)meter.style.width=`${Math.min(100,registeredPlayers/cup.max_players*100)}%`;
      await paintRegistrationAction(cup,hero);
    }
    const card=$('#upcomingCupView .registered-list-card');if(card){const h=$('h2',card);if(h)h.textContent=`${registeredPlayers} / ${cup.max_players}`;}
    const list=$('#publicRegistrationList');if(list){
      list.innerHTML=registrations.length?registrations.map(r=>{
        const names=Array.isArray(r.member_names)?r.member_names:[];
        return `<div class="registration-row v3-public-registration-row"><div class="v3-registration-members">${names.map((name,i)=>{const gp=(live.globalPlayers||[]).find(p=>String(p.current_name).toLowerCase()===String(name).toLowerCase());const avatar=gp?avatarImg(gp,'cup-list-avatar pixel-avatar'):`<span class="cup-list-avatar v3-avatar-fallback">${esc(String(name).slice(0,1).toUpperCase())}</span>`;return `${i?'<b class="v3-registration-plus">+</b>':''}<span class="v3-registration-player">${avatar}<strong>${esc(name)}</strong></span>`;}).join('')}</div><i class="v3-registration-check">✓</i></div>`;
      }).join(''):`<p class="v3-empty">${copy('No confirmed registrations yet.','Noch keine bestätigten Anmeldungen.','Aucune inscription confirmée.')}</p>`;
    }
  }'''
sub1(r"  async function renderUpcomingCup\(cup,data\)\{.*?\n  \}\n  async function updateOverviewCupCards",new_renderer+'\n  async function updateOverviewCupCards','registration overview renderer',re.S)

# Confirmation copy no longer implies tournament roster deletion.
s=s.replace("Are you sure you want to leave this tournament registration? The registered team will be removed.","Are you sure you want to withdraw your team registration?")
s=s.replace("Sicher, dass du dich vom Turnier abmelden möchtest? Das angemeldete Team wird entfernt.","Sicher, dass du deine Team-Anmeldung zurückziehen möchtest?")
s=s.replace("Confirmer l’annulation de l’inscription ?","Confirmer le retrait de l’inscription de l’équipe ?")

css='''\n<style id="hub-registration-decoupled-ui">\n  .v3-avatar-fallback{display:grid!important;place-items:center;background:rgba(93,58,155,.45);color:#fff;font-size:11px;font-weight:900}\n</style>\n'''
if 'id="hub-registration-decoupled-ui"' not in s:s=s.replace('</head>',css+'\n</head>',1)

for x in ['get_cup_registration_overview','getCupRegistrationOverview','registeredPlayers=registrations.reduce','hub-registration-decoupled-ui']:
    if x not in s: raise SystemExit('missing '+x)
p.write_text(s);print('registration roster decoupling UI patch complete')
