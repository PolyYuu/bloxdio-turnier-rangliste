(() => {
  'use strict';

  const api = window.HubAPI;
  const core = window.HubV3;
  if (!api || !core) return;

  const live = core.live;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CACHE_KEY = 'hub_pending_registration';

  const COPY = {
    de: {
      pending:'VERIFIZIERUNG AUSSTEHEND', account:'ACCOUNT', myProfile:'MEIN PROFIL', changePassword:'PASSWORT ÄNDERN', logout:'LOG OUT',
      verification:'BLOXD VERIFIZIERUNG', statsHidden:'STATISTIKEN NOCH NICHT SICHTBAR',
      statsText:'Deine Statistiken, dein Rating und deine bisherigen Turniere werden sichtbar, sobald du verifiziert wurdest. Bis dahin ist dein 8-Zeichen-Code deine HUB-Kennung.',
      viewStatus:'VERIFIZIERUNGSSTATUS ANSEHEN', yourAccount:'DEIN ACCOUNT', overviewTitle:'VERIFIZIERUNG AUSSTEHEND',
      overviewStrong:'Stats und Spielername werden nach der Bloxd-Verifizierung sichtbar.', overviewText:'Rangliste, Cups und öffentliche Spielerprofile kannst du bereits normal ansehen.',
      viewProfile:'MEIN PROFIL ANSEHEN', blocked:'Diese Funktion wird nach deiner Bloxd-Verifizierung freigeschaltet.',
      passwordTitle:'Passwort ändern', newPassword:'Neues Passwort', confirmPassword:'Passwort wiederholen', savePassword:'PASSWORT SPEICHERN', cancel:'ABBRECHEN',
      passwordShort:'Das Passwort muss mindestens 8 Zeichen lang sein.', passwordMismatch:'Die Passwörter stimmen nicht überein.', passwordSaved:'Passwort wurde geändert.', passwordError:'Passwort konnte nicht geändert werden.',
      loginIntro:'Nutze deinen aktuellen Bloxd.io Ingame-Namen oder deinen 8-Zeichen-Code.', loginLabel:'Ingame-Name oder 8-Zeichen-Code',
      live:'LIVE', register:'ANMELDUNG', finished:'BEENDET', heroTagline:'Deine Cups. Dein Rang. Deine Wettkampfhistorie.', viewAll:'ALLE ANZEIGEN →',
      player:'SPIELER', rank:'RANG', rating:'RATING', trend:'TREND', noRanked:'Noch keine gerankten Spieler. Spieler erscheinen nach 15 Einrankungsmatches.',
      registrationOpen:'ANMELDUNG OFFEN', nextCup:'NÄCHSTER CUP', rounds:'RUNDEN', players:'SPIELER', mode:'MODUS'
    },
    en: {
      pending:'VERIFICATION PENDING', account:'ACCOUNT', myProfile:'MY PROFILE', changePassword:'CHANGE PASSWORD', logout:'LOG OUT',
      verification:'BLOXD VERIFICATION', statsHidden:'STATISTICS NOT VISIBLE YET',
      statsText:'Your statistics, rating and previous tournaments become visible after verification. Until then your 8-character code is your HUB identifier.',
      viewStatus:'VIEW VERIFICATION STATUS', yourAccount:'YOUR ACCOUNT', overviewTitle:'VERIFICATION PENDING',
      overviewStrong:'Stats and player name become visible after Bloxd verification.', overviewText:'You can already browse rankings, cups and public player profiles normally.',
      viewProfile:'VIEW MY PROFILE', blocked:'This feature becomes available after your Bloxd verification.',
      passwordTitle:'Change Password', newPassword:'New password', confirmPassword:'Repeat password', savePassword:'SAVE PASSWORD', cancel:'CANCEL',
      passwordShort:'Password must be at least 8 characters long.', passwordMismatch:'Passwords do not match.', passwordSaved:'Password changed.', passwordError:'Password could not be changed.',
      loginIntro:'Use your current Bloxd.io ingame name or your 8-character code.', loginLabel:'Ingame name or 8-character code',
      live:'LIVE', register:'REGISTER', finished:'FINISHED', heroTagline:'Your Cups. Your rank. Your competitive history.', viewAll:'VIEW ALL →',
      player:'PLAYER', rank:'RANK', rating:'RATING', trend:'TREND', noRanked:'No ranked players yet. Players appear after 15 placement games.',
      registrationOpen:'REGISTRATION OPEN', nextCup:'NEXT CUP', rounds:'ROUNDS', players:'PLAYERS', mode:'MODE'
    },
    fr: {
      pending:'VÉRIFICATION EN ATTENTE', account:'COMPTE', myProfile:'MON PROFIL', changePassword:'CHANGER LE MOT DE PASSE', logout:'SE DÉCONNECTER',
      verification:'VÉRIFICATION BLOXD', statsHidden:'STATISTIQUES PAS ENCORE VISIBLES',
      statsText:'Tes statistiques, ton classement et tes anciens tournois deviennent visibles après la vérification. Jusque-là, ton code à 8 caractères est ton identifiant HUB.',
      viewStatus:'VOIR LE STATUT DE VÉRIFICATION', yourAccount:'TON COMPTE', overviewTitle:'VÉRIFICATION EN ATTENTE',
      overviewStrong:'Les statistiques et le nom du joueur apparaissent après la vérification Bloxd.', overviewText:'Tu peux déjà consulter normalement le classement, les Cups et les profils publics.',
      viewProfile:'VOIR MON PROFIL', blocked:'Cette fonction sera disponible après ta vérification Bloxd.',
      passwordTitle:'Changer le mot de passe', newPassword:'Nouveau mot de passe', confirmPassword:'Répéter le mot de passe', savePassword:'ENREGISTRER', cancel:'ANNULER',
      passwordShort:'Le mot de passe doit contenir au moins 8 caractères.', passwordMismatch:'Les mots de passe ne correspondent pas.', passwordSaved:'Mot de passe modifié.', passwordError:'Impossible de modifier le mot de passe.',
      loginIntro:'Utilise ton pseudo Bloxd.io actuel ou ton code à 8 caractères.', loginLabel:'Pseudo ou code à 8 caractères',
      live:'LIVE', register:'INSCRIPTION', finished:'TERMINÉ', heroTagline:'Tes Cups. Ton rang. Ton historique compétitif.', viewAll:'TOUT VOIR →',
      player:'JOUEUR', rank:'RANG', rating:'RATING', trend:'TENDANCE', noRanked:'Aucun joueur classé pour le moment. Les joueurs apparaissent après 15 matchs de placement.',
      registrationOpen:'INSCRIPTIONS OUVERTES', nextCup:'PROCHAINE CUP', rounds:'MANCHES', players:'JOUEURS', mode:'MODE'
    }
  };

  function language(){
    const raw=String(localStorage.getItem('hub_language')||localStorage.getItem('hubLang')||document.documentElement.lang||navigator.language||'en').toLowerCase();
    return raw.startsWith('de')?'de':raw.startsWith('fr')?'fr':'en';
  }
  const t=(key)=>COPY[language()]?.[key]||COPY.en[key]||key;
  const codeOf=(v)=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

  function authUserId(){
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);if(!k||!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;
        const x=JSON.parse(localStorage.getItem(k)||'null');
        const id=x?.user?.id||x?.currentSession?.user?.id||x?.session?.user?.id;if(id)return String(id);
      }
    }catch(_){}
    return '';
  }
  function readCache(){
    try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!x||x.status!=='pending'||!authUserId())return null;if(x.auth_user_id&&x.auth_user_id!==authUserId())return null;return x;}catch(_){return null;}
  }
  function writeCache(x,id){try{localStorage.setItem(CACHE_KEY,JSON.stringify({status:'pending',auth_user_id:id||authUserId(),code:codeOf(x?.code),cached_at:Date.now()}));}catch(_){} }
  function clearCache(){try{localStorage.removeItem(CACHE_KEY);}catch(_){} }

  let state=live.registrationState?.status==='pending'?live.registrationState:readCache();
  let active=!!state, applying=false, repairTimer=0, cupState=null, cupBusy=false;
  const pending=()=>state?.status==='pending'||live.registrationState?.status==='pending'||readCache();
  const accountCode=()=>codeOf(state?.code||live.registrationState?.code||readCache()?.code)||'PENDING';

  function addStyles(){
    if($('#hubPendingAuthoritativeStyles'))return;
    const s=document.createElement('style');s.id='hubPendingAuthoritativeStyles';s.textContent=`
      body.hub-pending-account #communityButton,body.hub-pending-account #friendsButton,body.hub-pending-account [data-open-friends],body.hub-pending-account [data-friends-button],
      body.hub-pending-account .site-header [aria-label*="friend" i],body.hub-pending-account .site-header [title*="friend" i],body.hub-pending-account .site-header [aria-label*="freund" i],body.hub-pending-account .site-header [title*="freund" i],body.hub-pending-account .site-header [aria-label*="ami" i],body.hub-pending-account .site-header [title*="ami" i],
      body.hub-pending-account [data-open-register],body.hub-pending-account .next-cup-cta,body.hub-pending-account [data-register-next-cup],body.hub-pending-account [data-next-cup-register],
      body.hub-pending-account #editAvatarButton,body.hub-pending-account #renameButton,body.hub-pending-account #profileAdminButton{display:none!important}
      body.hub-pending-account [data-page="profile"] .profile-grid{grid-template-columns:1fr!important}
      body.hub-pending-account [data-page="profile"] .stats-panel,body.hub-pending-account [data-page="profile"] .history-panel,body.hub-pending-account [data-page="profile"] .recent-updates{display:none!important}
      .hub-pending-header-status{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,198,92,.28);background:rgba(255,198,92,.11);color:#ffc65c;border-radius:999px;padding:8px 11px;font:800 9px/1 Montserrat,Arial;letter-spacing:.06em;white-space:nowrap}
      .hub-pending-header-status i{display:grid;place-items:center;width:15px;height:15px;border:1px solid currentColor;border-radius:50%;font:italic 800 9px Georgia}
      .hub-pending-overview{display:grid;gap:12px;padding:8px 2px 4px}.hub-pending-overview strong{font-size:18px}.hub-pending-overview p{margin:0;color:#9892a8;line-height:1.55;font-size:13px}.hub-pending-overview .secondary-button{width:max-content}
      .hub-pending-profile-card{display:grid;gap:14px;padding:18px 12px}.hub-pending-profile-card h2{margin:0;font-size:30px}.hub-pending-profile-card p{max-width:780px;margin:0;color:#a29bad;line-height:1.65}.hub-pending-profile-card button{width:max-content}.hub-pending-kicker{color:#ffc65c;font:900 10px/1 Montserrat;letter-spacing:.12em}
      #hubPendingAccountModal,#hubPendingPasswordModal{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(3,1,8,.72);backdrop-filter:blur(8px);padding:20px}#hubPendingAccountModal[hidden],#hubPendingPasswordModal[hidden]{display:none!important}
      .hub-pending-account-card,.hub-pending-password-card{position:relative;width:min(460px,100%);border:1px solid #6038a3;border-radius:16px;background:linear-gradient(180deg,#1a0c2d,#10071c);padding:26px;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.62)}
      .hub-pending-account-card .eyebrow{color:#4de5dc}.hub-pending-account-card h2{font-size:28px;margin:5px 0 20px}.hub-pending-modal-close{position:absolute;right:14px;top:14px;width:34px;height:34px;border:1px solid #53327e;border-radius:8px;background:#170c26;color:#b9adc8;cursor:pointer}
      .hub-pending-account-actions{display:grid;gap:10px}.hub-pending-account-actions button{min-height:44px;border:1px solid #56358b;border-radius:7px;background:#1a0d2d;color:#fff;font:900 11px Montserrat,Arial;cursor:pointer}.hub-pending-account-actions button:hover{border-color:#4de5dc}.hub-pending-account-actions .danger{color:#ff8292;border-color:#6b2442}
      .hub-pending-password-card h2{margin:0 0 18px}.hub-pending-password-card label{display:grid;gap:7px;margin:12px 0;color:#c7bed2;font:700 12px Montserrat,Arial}.hub-pending-password-card input{width:100%;box-sizing:border-box;border:1px solid #553582;background:#09040f;color:#fff;border-radius:9px;padding:12px;font:600 14px Arial}.hub-pending-password-actions{display:flex;gap:8px;margin-top:18px}.hub-pending-password-actions button{flex:1}.hub-pending-password-message{min-height:20px;margin:10px 0 0;color:#ffb2bd;font-size:12px}.hub-pending-password-message.ok{color:#67e9b8}
    `;document.head.appendChild(s);
  }

  function patchLoginModal(){
    const m=$('#v3AuthModal');if(!m)return;const f=$('#v3AuthForm',m);if(!f)return;const labels=$$('label',f),label=labels[0]?.querySelector('span')||labels[0],intro=$('p',m);if(label)label.textContent=t('loginLabel');if(intro)intro.textContent=t('loginIntro');
  }
  function suppressNativeAuth(){if(!active)return;const m=$('#v3AuthModal');if(m&&!m.hidden)m.hidden=true;$$('#v3AccountMenu,#accountMenu,.v3-account-menu,.account-menu-popover').forEach(x=>x.hidden=true);}

  function installHeader(){
    const b=$('#loginDemoButton');if(!b)return;b.removeAttribute('data-i18n');b.textContent=accountCode();b.disabled=false;b.removeAttribute('aria-disabled');b.classList.add('is-account');b.title=t('account');
    let status=$('#hubPendingHeaderStatus');if(!status){status=document.createElement('span');status.id='hubPendingHeaderStatus';status.className='hub-pending-header-status';b.insertAdjacentElement('afterend',status);}status.innerHTML=`<i>i</i>${t('pending')}`;
  }
  function hideRestricted(){
    $$('[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register]').forEach(x=>{x.hidden=true;x.style.setProperty('display','none','important');});
    const h=$('.site-header')||document;$$('#communityButton,#friendsButton,[data-open-friends],[data-friends-button],[aria-label*="friend" i],[title*="friend" i],[aria-label*="freund" i],[title*="freund" i],[aria-label*="ami" i],[title*="ami" i]',h).forEach(x=>{x.hidden=true;x.style.setProperty('display','none','important');});
  }

  function showPage(name){$$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===name));$$('.primary-nav [data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===name));history.replaceState(null,'',`#${name}`);window.scrollTo({top:0,behavior:'smooth'});}
  function renderProfile(navigate=false){
    if(!active)return;if(navigate)showPage('profile');if(location.hash!=='#profile')return;if(window.state&&typeof window.state==='object')window.state.profilePlayer=null;
    const title=$('#profilePlayerName');if(title)title.textContent=accountCode();const rank=$('#profileGlobalRank');if(rank){rank.hidden=false;rank.textContent=`ⓘ ${t('pending')}`;rank.style.color='#ffc65c';rank.onclick=()=>location.href='pending.html';}
    const av=$('#profileAvatar');if(av)av.hidden=true;const mono=$('#profileMonogram');if(mono){mono.hidden=false;mono.textContent='…';}
    const card=$('.profile-rank-card');if(card&&!card.querySelector('[data-hub-pending-profile]')){card.hidden=false;card.innerHTML=`<div class="hub-pending-profile-card" data-hub-pending-profile><span class="hub-pending-kicker">${t('verification')}</span><h2>${t('statsHidden')}</h2><p>${t('statsText')}</p><button class="secondary-button" type="button" data-hub-status>${t('viewStatus')}</button></div>`;}
    $('.stats-panel')?.setAttribute('hidden','');$('.history-panel')?.setAttribute('hidden','');$('[data-page="profile"] .recent-updates')?.setAttribute('hidden','');
  }
  function renderOverview(){
    const card=$('.my-rank-card');if(!card)return;if(card.querySelector('[data-hub-pending-overview]'))return;
    card.innerHTML=`<div data-hub-pending-overview><header class="panel-header tight"><div><span class="eyebrow">${t('yourAccount')}</span><h2>${t('overviewTitle')}</h2></div></header><div class="hub-pending-overview"><strong>${t('overviewStrong')}</strong><p>${t('overviewText')}</p><button class="secondary-button" type="button" data-hub-profile>${t('viewProfile')}</button></div></div>`;
  }

  function accountModal(){let m=$('#hubPendingAccountModal');if(!m){m=document.createElement('div');m.id='hubPendingAccountModal';m.hidden=true;document.body.appendChild(m);}m.innerHTML=`<section class="hub-pending-account-card"><button class="hub-pending-modal-close" data-hub-close>×</button><span class="eyebrow">${t('account')}</span><h2>${accountCode()}</h2><div class="hub-pending-account-actions"><button data-hub-profile>${t('myProfile')}</button><button data-hub-password>${t('changePassword')}</button><button class="danger" data-hub-logout>${t('logout')}</button></div></section>`;m.hidden=false;}
  function closeAccount(){const m=$('#hubPendingAccountModal');if(m)m.hidden=true;}
  function passwordModal(){let m=$('#hubPendingPasswordModal');if(!m){m=document.createElement('div');m.id='hubPendingPasswordModal';m.innerHTML=`<section class="hub-pending-password-card"><h2 data-pass-title></h2><label><span data-pass-new></span><input data-pass-one type="password" autocomplete="new-password"></label><label><span data-pass-confirm></span><input data-pass-two type="password" autocomplete="new-password"></label><p class="hub-pending-password-message" data-pass-msg></p><div class="hub-pending-password-actions"><button class="secondary-button" data-pass-cancel></button><button class="primary-button" data-pass-save></button></div></section>`;document.body.appendChild(m);}m.hidden=false;$('[data-pass-title]',m).textContent=t('passwordTitle');$('[data-pass-new]',m).textContent=t('newPassword');$('[data-pass-confirm]',m).textContent=t('confirmPassword');$('[data-pass-cancel]',m).textContent=t('cancel');$('[data-pass-save]',m).textContent=t('savePassword');$('[data-pass-one]',m).value='';$('[data-pass-two]',m).value='';$('[data-pass-msg]',m).textContent='';setTimeout(()=>$('[data-pass-one]',m)?.focus(),30);}
  async function savePassword(){const m=$('#hubPendingPasswordModal'),one=$('[data-pass-one]',m)?.value||'',two=$('[data-pass-two]',m)?.value||'',msg=$('[data-pass-msg]',m);msg.classList.remove('ok');if(one.length<8){msg.textContent=t('passwordShort');return;}if(one!==two){msg.textContent=t('passwordMismatch');return;}try{const{error}=await api.client.auth.updateUser({password:one});if(error)throw error;msg.textContent=t('passwordSaved');msg.classList.add('ok');setTimeout(()=>m.hidden=true,900);}catch(e){console.error(e);msg.textContent=t('passwordError');}}
  async function logout(){try{await api.client.auth.signOut();}catch(e){console.warn(e);}clearCache();state=null;active=false;live.registrationState=null;location.href='index.html#overview';location.reload();}

  function translateVisible(){
    if(!active)return;const map={
      'Your Cups. Your rank. Your competitive history.':t('heroTagline'),'Deine Cups. Dein Rang. Deine Wettkampfhistorie.':t('heroTagline'),'Tes Cups. Ton rang. Ton historique compétitif.':t('heroTagline'),
      'VIEW ALL →':t('viewAll'),'ALLE ANZEIGEN →':t('viewAll'),'TOUT VOIR →':t('viewAll'),'PLAYER':t('player'),'SPIELER':t('player'),'JOUEUR':t('player'),'RANK':t('rank'),'RANG':t('rank'),'RATING':t('rating'),'TREND':t('trend'),'TENDANCE':t('trend'),
      'No ranked players yet. Players appear after 15 placement games.':t('noRanked'),'Noch keine gerankten Spieler. Spieler erscheinen nach 15 Einrankungsmatches.':t('noRanked'),'Aucun joueur classé pour le moment. Les joueurs apparaissent après 15 matchs de placement.':t('noRanked'),
      'REGISTRATION OPEN':t('registrationOpen'),'ANMELDUNG OFFEN':t('registrationOpen'),'INSCRIPTIONS OUVERTES':t('registrationOpen'),'NEXT CUP':t('nextCup'),'NÄCHSTER CUP':t('nextCup'),'PROCHAINE CUP':t('nextCup'),'ROUNDS':t('rounds'),'RUNDEN':t('rounds'),'MANCHES':t('rounds'),'PLAYERS':t('players'),'JOUEURS':t('players'),'MODE':t('mode'),'MODUS':t('mode')
    };$$('main p,main span,main strong,main th,main h2,main h3,main button').forEach(el=>{if(el.children.length)return;const v=el.textContent.trim();if(map[v]&&map[v]!==v)el.textContent=map[v];});
  }

  async function refreshCup(){
    if(cupBusy)return;cupBusy=true;try{const{data,error}=await api.client.from('tournaments').select('id,name,status,created_at,updated_at');if(error)throw error;const cups=(data||[]).filter(c=>!/\btest\b/i.test(String(c.name||''))).sort((a,b)=>Date.parse(b.created_at||b.updated_at||0)-Date.parse(a.created_at||a.updated_at||0));cupState=cups.find(c=>c.status==='live')||cups.find(c=>c.status==='registration')||cups.find(c=>c.status==='finished')||null;}catch(e){console.warn('Cup state',e);}finally{cupBusy=false;}syncCup();
  }
  function syncCup(){
    if(!active||!cupState)return;const nav=$('.primary-nav [data-route="cup"]');if(!nav)return;const status=String(cupState.status||'').toLowerCase(),label=status==='live'?t('live'):status==='registration'?t('register'):t('finished'),known=/^(LIVE|REGISTER|REGISTRIEREN|ANMELDUNG|ANMELDEN|INSCRIPTIONS?|INSCRIPTION|REGISTRATION|FINISHED|BEENDET|TERMINÉ)$/i;
    let badge=[...nav.querySelectorAll('span,small,b,i')].find(x=>known.test(x.textContent.trim()));if(!badge){badge=document.createElement('span');badge.id='hubPendingCupBadge';badge.style.cssText='margin-left:6px;padding:3px 6px;border-radius:999px;font-size:7px;font-weight:900;line-height:1;vertical-align:middle';nav.appendChild(badge);}badge.textContent=label;badge.style.background=status==='live'?'#30e3d2':status==='registration'?'#ffc64d':'#635777';badge.style.color=status==='registration'?'#281700':'#07100f';[...nav.querySelectorAll('span,small,b,i')].filter(x=>x!==badge&&known.test(x.textContent.trim())).forEach(x=>x.style.display='none');
  }

  function apply(){
    if(!pending()||applying)return;state=state?.status==='pending'?state:(live.registrationState?.status==='pending'?live.registrationState:readCache());if(!state)return;applying=true;active=true;try{document.body.classList.add('hub-pending-account');document.body.dataset.hubAccountState='pending';addStyles();suppressNativeAuth();installHeader();hideRestricted();renderOverview();if(location.hash==='#profile')renderProfile();translateVisible();syncCup();}finally{applying=false;}
  }
  function needsRepair(){if(!active)return false;const b=$('#loginDemoButton');if(b&&b.textContent.trim()!==accountCode())return true;const a=$('#v3AuthModal');if(a&&!a.hidden)return true;const o=$('.my-rank-card');if(o&&!o.querySelector('[data-hub-pending-overview]'))return true;if(location.hash==='#profile'){if($('#profilePlayerName')?.textContent.trim()!==accountCode())return true;if($('.profile-rank-card')&&!$('.profile-rank-card').querySelector('[data-hub-pending-profile]'))return true;}return false;}
  function schedule(force=false){if(!active||repairTimer||(!force&&!needsRepair()))return;repairTimer=setTimeout(()=>{repairTimer=0;apply();},40);}
  function clearPending(){active=false;state=null;live.registrationState=null;document.body.classList.remove('hub-pending-account');if(document.body.dataset.hubAccountState==='pending')delete document.body.dataset.hubAccountState;$('#hubPendingHeaderStatus')?.remove();$('#hubPendingAccountModal')?.remove();$('#hubPendingPasswordModal')?.remove();}
  async function refresh(){try{const session=await api.currentSession();if(!session){clearCache();clearPending();patchLoginModal();return;}const{data,error}=await api.client.rpc('get_my_registration_status');if(error)throw error;if(data?.status==='pending'){state=data;live.registrationState=data;writeCache(data,session.user?.id);active=true;apply();return;}clearCache();const was=active;clearPending();if(was)location.reload();}catch(e){console.warn('Pending state',e);if(pending()){active=true;apply();}}}

  function intercept(e){
    const x=e.target;if(x.closest?.('[data-hub-close]')){e.preventDefault();e.stopImmediatePropagation();closeAccount();return;}if(x.closest?.('[data-hub-profile]')){e.preventDefault();e.stopImmediatePropagation();closeAccount();if(active)renderProfile(true);return;}if(x.closest?.('[data-hub-password]')){e.preventDefault();e.stopImmediatePropagation();passwordModal();return;}if(x.closest?.('[data-hub-logout]')){e.preventDefault();e.stopImmediatePropagation();logout();return;}if(x.closest?.('[data-pass-cancel]')){e.preventDefault();$('#hubPendingPasswordModal').hidden=true;return;}if(x.closest?.('[data-pass-save]')){e.preventDefault();savePassword();return;}
    if(!active)return;const account=x.closest?.('#loginDemoButton');if(account){e.preventDefault();e.stopImmediatePropagation();if(e.type==='click')accountModal();return;}const profile=x.closest?.('[data-route="profile"],[data-hub-profile]');if(profile){e.preventDefault();e.stopImmediatePropagation();if(e.type==='click')renderProfile(true);return;}if(x.closest?.('[data-hub-status],#hubPendingHeaderStatus')){e.preventDefault();e.stopImmediatePropagation();if(e.type==='click')location.href='pending.html';return;}if(x.closest?.('#communityButton,#friendsButton,[data-open-friends],[data-friends-button]')){e.preventDefault();e.stopImmediatePropagation();return;}if(x.closest?.('[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register],[data-v3-friend-add],[data-friend-add]')){e.preventDefault();e.stopImmediatePropagation();if(e.type==='click')core.toast?.(t('blocked'),true);}
  }

  addStyles();patchLoginModal();
  document.addEventListener('pointerdown',intercept,true);document.addEventListener('click',intercept,true);
  document.addEventListener('click',e=>{if(e.target===$('#hubPendingAccountModal'))closeAccount();if(e.target===$('#hubPendingPasswordModal'))$('#hubPendingPasswordModal').hidden=true;if(e.target.closest?.('[data-lang],#languageButton'))setTimeout(()=>{patchLoginModal();if(active){refreshCup();schedule(true);}},120);if(e.target.closest?.('#loginDemoButton')&&!active)setTimeout(patchLoginModal,0);},true);
  window.addEventListener('hashchange',()=>{if(active)schedule(true);});
  document.addEventListener('hub:auth-restored',e=>{const d=e.detail||{};if(d.loggedIn===false){clearCache();clearPending();return;}if(d.registrationState?.status==='pending'){state=d.registrationState;live.registrationState=state;writeCache(state,d.session?.user?.id||d.user?.id);active=true;apply();refreshCup();return;}if(d.registrationState?.status==='verified'){clearCache();const was=active;clearPending();if(was)location.reload();return;}setTimeout(refresh,20);});
  new MutationObserver(()=>schedule(false)).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setTimeout(()=>{refresh();refreshCup();},20);setInterval(refresh,10000);setInterval(()=>{if(active)refreshCup();},30000);
})();
