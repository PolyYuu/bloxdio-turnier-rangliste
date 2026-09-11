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
      pending:'VERIFIZIERUNG AUSSTEHEND',verification:'BLOXD VERIFIZIERUNG',statsHidden:'Statistiken noch nicht sichtbar',
      statsText:'Deine Statistiken, dein Rating und deine bisherigen Turniere werden sichtbar, sobald du verifiziert wurdest. Bis dahin ist dein 8-Zeichen-Code deine HUB-Kennung.',
      viewStatus:'VERIFIZIERUNGSSTATUS ANSEHEN',yourAccount:'DEIN ACCOUNT',overviewTitle:'Verifizierung ausstehend',
      overviewStrong:'Stats und Spielername werden nach der Bloxd-Verifizierung sichtbar.',overviewText:'Rangliste, Cups und öffentliche Spielerprofile kannst du bereits ganz normal ansehen.',
      viewProfile:'MEIN PROFIL ANSEHEN',statusTitle:'Verifizierungsstatus anzeigen',blocked:'Diese Funktion wird nach deiner Bloxd-Verifizierung freigeschaltet.',
      myProfile:'Mein Profil',changePassword:'Passwort ändern',logout:'Log out',passwordTitle:'Passwort ändern',newPassword:'Neues Passwort',confirmPassword:'Passwort wiederholen',
      savePassword:'PASSWORT SPEICHERN',cancel:'ABBRECHEN',passwordShort:'Das Passwort muss mindestens 8 Zeichen lang sein.',passwordMismatch:'Die Passwörter stimmen nicht überein.',
      passwordSaved:'Passwort wurde geändert.',passwordError:'Passwort konnte nicht geändert werden.',loginIntro:'Nutze deinen aktuellen Bloxd.io Ingame-Namen oder deinen 8-Zeichen-Code.',
      loginLabel:'Ingame-Name oder 8-Zeichen-Code'
    },
    en: {
      pending:'VERIFICATION PENDING',verification:'BLOXD VERIFICATION',statsHidden:'Statistics are not visible yet',
      statsText:'Your statistics, rating and previous tournaments become visible after verification. Until then your 8-character code is your HUB identifier.',
      viewStatus:'VIEW VERIFICATION STATUS',yourAccount:'YOUR ACCOUNT',overviewTitle:'Verification pending',overviewStrong:'Stats and player name become visible after Bloxd verification.',
      overviewText:'You can already use rankings, cups and public player profiles normally.',viewProfile:'VIEW MY PROFILE',statusTitle:'View verification status',
      blocked:'This feature becomes available after your Bloxd verification.',myProfile:'My Profile',changePassword:'Change Password',logout:'Log out',passwordTitle:'Change Password',
      newPassword:'New password',confirmPassword:'Repeat password',savePassword:'SAVE PASSWORD',cancel:'CANCEL',passwordShort:'Password must be at least 8 characters long.',
      passwordMismatch:'Passwords do not match.',passwordSaved:'Password changed.',passwordError:'Password could not be changed.',loginIntro:'Use your current Bloxd.io ingame name or your 8-character code.',
      loginLabel:'Ingame name or 8-character code'
    },
    fr: {
      pending:'VÉRIFICATION EN ATTENTE',verification:'VÉRIFICATION BLOXD',statsHidden:'Statistiques pas encore visibles',
      statsText:'Tes statistiques, ton classement et tes anciens tournois deviennent visibles après la vérification. Jusque-là, ton code à 8 caractères est ton identifiant HUB.',
      viewStatus:'VOIR LE STATUT DE VÉRIFICATION',yourAccount:'TON COMPTE',overviewTitle:'Vérification en attente',overviewStrong:'Les statistiques et le nom du joueur apparaissent après la vérification Bloxd.',
      overviewText:'Tu peux déjà utiliser normalement le classement, les cups et les profils publics.',viewProfile:'VOIR MON PROFIL',statusTitle:'Voir le statut de vérification',
      blocked:'Cette fonction sera disponible après ta vérification Bloxd.',myProfile:'Mon profil',changePassword:'Changer le mot de passe',logout:'Se déconnecter',passwordTitle:'Changer le mot de passe',
      newPassword:'Nouveau mot de passe',confirmPassword:'Répéter le mot de passe',savePassword:'ENREGISTRER',cancel:'ANNULER',passwordShort:'Le mot de passe doit contenir au moins 8 caractères.',
      passwordMismatch:'Les mots de passe ne correspondent pas.',passwordSaved:'Mot de passe modifié.',passwordError:'Impossible de modifier le mot de passe.',
      loginIntro:'Utilise ton pseudo Bloxd.io actuel ou ton code à 8 caractères.',loginLabel:'Pseudo ou code à 8 caractères'
    }
  };

  function language(){
    const raw=String(localStorage.getItem('hub_language')||localStorage.getItem('hubLang')||document.documentElement.lang||navigator.language||'en').toLowerCase();
    if(raw.startsWith('fr'))return'fr';if(raw.startsWith('de'))return'de';return'en';
  }
  const t=(key)=>COPY[language()]?.[key]||COPY.en[key]||key;
  const normalizeCode=(v)=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);

  function storedAuthUserId(){
    try{for(let i=0;i<localStorage.length;i+=1){const key=localStorage.key(i);if(!key||!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;const parsed=JSON.parse(localStorage.getItem(key)||'null');const id=parsed?.user?.id||parsed?.currentSession?.user?.id||parsed?.session?.user?.id;if(id)return String(id);}}catch(_){}
    return'';
  }
  function readCache(){
    try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!cached||cached.status!=='pending')return null;const authId=storedAuthUserId();if(!authId)return null;if(cached.auth_user_id&&cached.auth_user_id!==authId)return null;return cached;}catch(_){return null;}
  }
  function writeCache(data,authUserId){
    try{const id=authUserId||storedAuthUserId();if(!id)return;localStorage.setItem(CACHE_KEY,JSON.stringify({status:'pending',auth_user_id:id,code:normalizeCode(data?.code),source:data?.source||'',cached_at:Date.now()}));}catch(_){}
  }
  function clearCache(){try{localStorage.removeItem(CACHE_KEY);}catch(_){} }

  let state=live.registrationState?.status==='pending'?live.registrationState:readCache();
  let active=!!state;
  let applying=false;
  let reapplyQueued=false;
  let observer=null;

  function currentPendingState(){
    const candidate=state?.status==='pending'?state:(live.registrationState?.status==='pending'?live.registrationState:readCache());
    if(candidate&&candidate!==state)state=candidate;
    return candidate;
  }
  function accountCode(){return normalizeCode(currentPendingState()?.code)||'PENDING';}
  function setAccountStateClass(name){
    document.body.classList.remove('hub-state-logged-out','hub-state-pending','hub-state-verified','hub-state-admin');
    document.body.classList.add(`hub-state-${name}`);
    document.body.dataset.hubAccountState=name;
  }

  function addViewportSafety(){
    if($('#hubViewportSafetyStyles'))return;
    const style=document.createElement('style');style.id='hubViewportSafetyStyles';
    style.textContent=`:root{--max:calc(100vw - 40px)!important}html,body{width:100%!important;max-width:none!important}body{overflow-x:hidden}.site-header{width:100%!important;max-width:none!important}.app-shell{width:calc(100vw - 40px)!important;max-width:none!important}@media(max-width:760px){:root{--max:calc(100vw - 22px)!important}.app-shell{width:calc(100vw - 22px)!important}}`;
    document.head.appendChild(style);
  }

  function addStyles(){
    if($('#hubPendingIntegratedStyles'))return;
    const style=document.createElement('style');style.id='hubPendingIntegratedStyles';
    style.textContent=`
      body.hub-pending-account [data-open-register],body.hub-pending-account .next-cup-cta,body.hub-pending-account [data-register-next-cup],body.hub-pending-account [data-next-cup-register],body.hub-pending-account #editAvatarButton,body.hub-pending-account #renameButton,body.hub-pending-account #profileAdminButton{display:none!important}
      body.hub-pending-account #communityButton,body.hub-pending-account #friendsButton,body.hub-pending-account [data-open-friends],body.hub-pending-account [data-friends-button],body.hub-pending-account .site-header [aria-label*="friend" i],body.hub-pending-account .site-header [title*="friend" i],body.hub-pending-account .site-header [aria-label*="freund" i],body.hub-pending-account .site-header [title*="freund" i]{display:none!important}
      body.hub-pending-account [data-page="profile"] .profile-grid{grid-template-columns:1fr!important}body.hub-pending-account [data-page="profile"] .profile-rank-card{width:100%;box-sizing:border-box}body.hub-pending-account [data-page="profile"] .stats-panel,body.hub-pending-account [data-page="profile"] .history-panel,body.hub-pending-account [data-page="profile"] .recent-updates{display:none!important}
      .hub-pending-header-status{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,198,92,.28);background:rgba(255,198,92,.11);color:#ffc65c;border-radius:999px;padding:8px 11px;font:800 9px/1 Montserrat,Arial;letter-spacing:.06em;white-space:nowrap}.hub-pending-mini-info,.hub-pending-info{display:inline-grid;place-items:center;border:1px solid currentColor;border-radius:50%;font-family:Georgia,serif;font-style:italic;font-weight:800;line-height:1}.hub-pending-mini-info{width:15px;height:15px;font-size:9px}.hub-pending-info{width:32px;height:32px;color:#ffc65c;background:rgba(255,198,92,.08);font-size:14px}
      .hub-pending-overview{display:grid;gap:12px;padding:8px 2px 4px}.hub-pending-overview strong{font-size:18px}.hub-pending-overview p{margin:0;color:#9892a8;line-height:1.55;font-size:13px}.hub-pending-overview .secondary-button{width:max-content}.hub-pending-profile-card{display:grid;gap:14px;padding:18px 12px}.hub-pending-profile-card h2{margin:0;font-size:30px}.hub-pending-profile-card p{max-width:760px;margin:0;color:#a29bad;line-height:1.65}.hub-pending-profile-card button{width:max-content}.hub-pending-kicker{color:#ffc65c;font:900 10px/1 Montserrat;letter-spacing:.12em}
      #hubPendingAccountMenu{position:fixed;z-index:2147483000;min-width:205px;padding:7px;border:1px solid rgba(112,66,184,.7);border-radius:12px;background:#10081d;box-shadow:0 18px 48px rgba(0,0,0,.48)}#hubPendingAccountMenu[hidden]{display:none!important}#hubPendingAccountMenu button{display:block;width:100%;border:0;background:transparent;color:#fff;text-align:left;padding:10px 11px;border-radius:8px;font:800 11px/1.2 Montserrat,Arial;cursor:pointer}#hubPendingAccountMenu button:hover{background:rgba(68,224,214,.1);color:#4de5dc}#hubPendingAccountMenu .danger{color:#ff8f9d}
      #hubPendingPasswordModal{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:center;background:rgba(3,1,8,.72);backdrop-filter:blur(8px);padding:20px}#hubPendingPasswordModal[hidden]{display:none!important}.hub-pending-password-card{width:min(430px,100%);border:1px solid #5b2fa1;border-radius:16px;background:linear-gradient(180deg,#1a0c2c,#10071c);padding:24px;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.6)}.hub-pending-password-card h2{margin:0 0 18px}.hub-pending-password-card label{display:grid;gap:7px;margin:12px 0;color:#c7bed2;font:700 12px Montserrat,Arial}.hub-pending-password-card input{width:100%;box-sizing:border-box;border:1px solid #553582;background:#09040f;color:#fff;border-radius:9px;padding:12px;font:600 14px Arial}.hub-pending-password-actions{display:flex;gap:8px;margin-top:18px}.hub-pending-password-actions button{flex:1}.hub-pending-password-message{min-height:20px;margin:10px 0 0;color:#ffb2bd;font-size:12px}.hub-pending-password-message.ok{color:#67e9b8}
      @media(max-width:900px){.hub-pending-header-status{max-width:170px;overflow:hidden;text-overflow:ellipsis}.hub-pending-overview .secondary-button,.hub-pending-profile-card button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function showPage(page){
    $$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));
    $$('.primary-nav [data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===page));
    if(location.hash!==`#${page}`)history.replaceState(null,'',`#${page}`);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderPendingProfile(navigate=false){
    if(!currentPendingState())return false;if(navigate)showPage('profile');if(location.hash!=='#profile'&&!navigate)return false;
    const code=accountCode();const title=$('#profilePlayerName');if(title)title.textContent=code;
    const rank=$('#profileGlobalRank');if(rank){rank.hidden=false;rank.textContent=`ⓘ ${t('pending')}`;rank.style.color='#ffc65c';rank.style.cursor='pointer';rank.onclick=()=>{location.href='pending.html';};}
    const avatar=$('#profileAvatar');if(avatar)avatar.hidden=true;const mono=$('#profileMonogram');if(mono){mono.hidden=false;mono.textContent='…';}
    const rankCard=$('.profile-rank-card');if(rankCard){rankCard.hidden=false;rankCard.innerHTML=`<div class="hub-pending-profile-card"><span class="hub-pending-kicker">${t('verification')}</span><h2>${t('statsHidden')}</h2><p>${t('statsText')}</p><button type="button" class="secondary-button" data-hub-pending-status>${t('viewStatus')}</button></div>`;}
    $('.stats-panel')?.setAttribute('hidden','');$('.history-panel')?.setAttribute('hidden','');$('[data-page="profile"] .recent-updates')?.setAttribute('hidden','');
    $('[data-hub-pending-status]')?.addEventListener('click',()=>{location.href='pending.html';},{once:true});return true;
  }

  function renderOverviewPendingCard(){
    const card=$('.my-rank-card');if(!card)return;const marker=`${accountCode()}:${language()}`;if(card.dataset.pendingRendered===marker)return;
    card.dataset.pendingRendered=marker;card.innerHTML=`<header class="panel-header tight"><div><span class="eyebrow">${t('yourAccount')}</span><h2>${t('overviewTitle')}</h2></div><button class="hub-pending-info" type="button" data-hub-pending-status aria-label="${t('statusTitle')}" title="${t('statusTitle')}">i</button></header><div class="hub-pending-overview"><strong>${t('overviewStrong')}</strong><p>${t('overviewText')}</p><button class="secondary-button" type="button" data-hub-pending-profile>${t('viewProfile')}</button></div>`;
  }

  function hidePendingOnlyControls(){
    $$('[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register]').forEach(el=>{if(el.style.display!=='none')el.style.setProperty('display','none','important');el.hidden=true;el.setAttribute('aria-hidden','true');});
    const header=$('.site-header')||document;$$('#communityButton,#friendsButton,[data-open-friends],[data-friends-button],[aria-label*="friend" i],[title*="friend" i],[aria-label*="freund" i],[title*="freund" i]',header).forEach(el=>{if(el.style.display!=='none')el.style.setProperty('display','none','important');el.hidden=true;el.setAttribute('aria-hidden','true');});
  }

  function ensureAccountMenu(){let menu=$('#hubPendingAccountMenu');if(menu)return menu;menu=document.createElement('div');menu.id='hubPendingAccountMenu';menu.hidden=true;document.body.appendChild(menu);return menu;}
  function positionAccountMenu(){const account=$('#loginDemoButton'),menu=$('#hubPendingAccountMenu');if(!account||!menu||menu.hidden)return;const r=account.getBoundingClientRect(),w=Math.max(205,menu.offsetWidth||205);const left=Math.min(window.innerWidth-w-12,Math.max(12,r.right-w)),top=Math.min(window.innerHeight-(menu.offsetHeight||150)-12,r.bottom+8);menu.style.left=`${left}px`;menu.style.top=`${Math.max(12,top)}px`;}
  function closeAccountMenu(){const menu=$('#hubPendingAccountMenu');if(menu)menu.hidden=true;}
  function openAccountMenu(){if(!currentPendingState())return;const menu=ensureAccountMenu();menu.innerHTML=`<button type="button" data-hub-account-profile>${t('myProfile')}</button><button type="button" data-hub-account-password>${t('changePassword')}</button><button type="button" class="danger" data-hub-account-logout>${t('logout')}</button>`;menu.hidden=!menu.hidden;if(!menu.hidden)positionAccountMenu();}

  function ensurePasswordModal(){let modal=$('#hubPendingPasswordModal');if(modal)return modal;modal=document.createElement('div');modal.id='hubPendingPasswordModal';modal.hidden=true;modal.innerHTML=`<div class="hub-pending-password-card"><h2 data-hub-password-title></h2><label><span data-hub-password-new></span><input type="password" autocomplete="new-password" data-hub-password-one></label><label><span data-hub-password-confirm></span><input type="password" autocomplete="new-password" data-hub-password-two></label><p class="hub-pending-password-message" data-hub-password-message></p><div class="hub-pending-password-actions"><button type="button" class="secondary-button" data-hub-password-cancel></button><button type="button" class="primary-button" data-hub-password-save></button></div></div>`;document.body.appendChild(modal);return modal;}
  function openPasswordModal(){closeAccountMenu();const modal=ensurePasswordModal();modal.hidden=false;$('[data-hub-password-title]',modal).textContent=t('passwordTitle');$('[data-hub-password-new]',modal).textContent=t('newPassword');$('[data-hub-password-confirm]',modal).textContent=t('confirmPassword');$('[data-hub-password-cancel]',modal).textContent=t('cancel');$('[data-hub-password-save]',modal).textContent=t('savePassword');$('[data-hub-password-one]',modal).value='';$('[data-hub-password-two]',modal).value='';const msg=$('[data-hub-password-message]',modal);msg.textContent='';msg.classList.remove('ok');setTimeout(()=>$('[data-hub-password-one]',modal)?.focus(),50);}
  async function savePassword(){const modal=ensurePasswordModal(),one=$('[data-hub-password-one]',modal)?.value||'',two=$('[data-hub-password-two]',modal)?.value||'',msg=$('[data-hub-password-message]',modal);msg.classList.remove('ok');if(one.length<8){msg.textContent=t('passwordShort');return;}if(one!==two){msg.textContent=t('passwordMismatch');return;}try{const{error}=await api.client.auth.updateUser({password:one});if(error)throw error;msg.textContent=t('passwordSaved');msg.classList.add('ok');setTimeout(()=>{modal.hidden=true;},900);}catch(err){console.error(err);msg.textContent=t('passwordError');}}
  async function logoutPending(){closeAccountMenu();try{await api.client.auth.signOut();}catch(err){console.warn(err);}clearCache();state=null;active=false;live.registrationState=null;location.replace('index.html#overview');}

  function installHeader(){
    const account=$('#loginDemoButton');if(!account)return;const code=accountCode();account.removeAttribute('data-i18n');if(account.textContent!==code)account.textContent=code;account.classList.add('is-account');account.disabled=false;account.removeAttribute('aria-disabled');account.title=t('yourAccount');
    let badge=$('#hubPendingHeaderStatus');if(!badge){badge=document.createElement('span');badge.id='hubPendingHeaderStatus';badge.className='hub-pending-header-status';account.insertAdjacentElement('afterend',badge);}const html=`<span class="hub-pending-mini-info">i</span> ${t('pending')}`;if(badge.innerHTML!==html)badge.innerHTML=html;
  }

  function patchLoginModal(){const m=$('#v3AuthModal');if(!m)return;const form=$('#v3AuthForm',m);if(!form)return;const labels=$$('label',form),first=labels[0],label=first?.querySelector('span')||first,intro=$('p',m);if(label&&label.textContent!==t('loginLabel'))label.textContent=t('loginLabel');if(intro&&intro.textContent!==t('loginIntro'))intro.textContent=t('loginIntro');}

  function pendingUiNeedsRepair(){
    if(!active||!currentPendingState())return false;const account=$('#loginDemoButton');if(!account||account.textContent.trim()!==accountCode()||account.disabled)return true;
    const friendVisible=$('.site-header #communityButton:not([hidden]),.site-header #friendsButton:not([hidden]),.site-header [data-open-friends]:not([hidden]),.site-header [data-friends-button]:not([hidden])');if(friendVisible)return true;
    const card=$('.my-rank-card');if(card&&card.dataset.pendingRendered!==`${accountCode()}:${language()}`)return true;
    if(location.hash==='#profile'){const title=$('#profilePlayerName');if(title&&title.textContent.trim()!==accountCode())return true;const rankCard=$('.profile-rank-card');if(rankCard&&!rankCard.querySelector('.hub-pending-profile-card'))return true;}
    return false;
  }
  function applyUi(force=false){
    if(!currentPendingState()||applying)return;if(!force&&!pendingUiNeedsRepair()&&active)return;applying=true;
    try{active=true;live.registrationState=state;setAccountStateClass('pending');document.body.classList.add('hub-pending-account');addStyles();hidePendingOnlyControls();installHeader();renderOverviewPendingCard();if(location.hash==='#profile')renderPendingProfile(false);patchLoginModal();}finally{applying=false;}
  }
  function queueReapply(){if(!active||reapplyQueued)return;reapplyQueued=true;requestAnimationFrame(()=>{reapplyQueued=false;if(pendingUiNeedsRepair())applyUi(true);});}
  function clearPendingUi(){state=null;active=false;live.registrationState=null;document.body.classList.remove('hub-pending-account');$('#hubPendingHeaderStatus')?.remove();closeAccountMenu();$('#hubPendingPasswordModal')?.remove();const account=$('#loginDemoButton');if(account){account.disabled=false;account.removeAttribute('aria-disabled');account.removeAttribute('title');account.classList.remove('is-account');}}

  async function refresh(){
    try{const session=await api.currentSession();if(!session){clearCache();clearPendingUi();setAccountStateClass('logged-out');patchLoginModal();return;}const{data,error}=await api.client.rpc('get_my_registration_status');if(error)throw error;if(data?.status==='pending'){state=data;live.registrationState=data;writeCache(data,session?.user?.id);applyUi(true);return;}clearCache();const wasPending=active;clearPendingUi();if(wasPending)location.reload();}
    catch(err){console.warn('HUB account state could not be refreshed',err);if(currentPendingState())applyUi(true);}
  }

  function intercept(e){
    const target=e.target;
    if(target.closest?.('[data-hub-account-profile]')){e.preventDefault();e.stopImmediatePropagation();closeAccountMenu();renderPendingProfile(true);return;}
    if(target.closest?.('[data-hub-account-password]')){e.preventDefault();e.stopImmediatePropagation();openPasswordModal();return;}
    if(target.closest?.('[data-hub-account-logout]')){e.preventDefault();e.stopImmediatePropagation();logoutPending();return;}
    if(target.closest?.('[data-hub-password-cancel]')){e.preventDefault();const modal=$('#hubPendingPasswordModal');if(modal)modal.hidden=true;return;}
    if(target.closest?.('[data-hub-password-save]')){e.preventDefault();savePassword();return;}
    const modal=$('#hubPendingPasswordModal');if(modal&&!modal.hidden&&target===modal){modal.hidden=true;return;}

    if(!currentPendingState())return;
    const account=target.closest?.('#loginDemoButton');if(account){e.preventDefault();e.stopImmediatePropagation();openAccountMenu();return;}
    const profileRoute=target.closest?.('[data-route="profile"],[data-hub-pending-profile]');if(profileRoute){e.preventDefault();e.stopImmediatePropagation();closeAccountMenu();renderPendingProfile(true);return;}
    if(target.closest?.('[data-hub-pending-status],#hubPendingHeaderStatus')){e.preventDefault();e.stopImmediatePropagation();location.href='pending.html';return;}
    const friend=target.closest?.('#communityButton,#friendsButton,[data-open-friends],[data-friends-button],[aria-label*="friend" i],[title*="friend" i],[aria-label*="freund" i],[title*="freund" i]');if(friend){e.preventDefault();e.stopImmediatePropagation();return;}
    const sensitive=target.closest?.('[data-v3-friend-add],[data-friend-add],[data-v3-friend-remove],[data-v3-friend-accept],[data-v3-friend-decline],[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register],#editAvatarButton,#renameButton');if(sensitive){e.preventDefault();e.stopImmediatePropagation();core.toast?.(t('blocked'),true);}
  }

  addViewportSafety();addStyles();patchLoginModal();
  document.addEventListener('pointerdown',intercept,true);document.addEventListener('click',intercept,true);
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-lang],#languageButton,#loginDemoButton'))setTimeout(()=>{patchLoginModal();if(active)applyUi(true);},0);},true);
  document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('#loginDemoButton,#hubPendingAccountMenu'))closeAccountMenu();},false);
  window.addEventListener('resize',positionAccountMenu);
  window.addEventListener('hashchange',()=>{if(currentPendingState()){if(location.hash==='#profile')renderPendingProfile(false);else applyUi(true);}});
  window.addEventListener('storage',()=>{if(active)applyUi(true);});
  document.addEventListener('hub:auth-restored',(e)=>{const detail=e.detail||{};if(detail.loggedIn===false){clearCache();clearPendingUi();setAccountStateClass('logged-out');return;}const incoming=detail.registrationState;if(incoming?.status==='pending'){state=incoming;live.registrationState=incoming;writeCache(incoming,detail.session?.user?.id||detail.user?.id);applyUi(true);return;}if(incoming?.status==='verified'){clearCache();const wasPending=active;clearPendingUi();if(wasPending)location.reload();return;}setTimeout(refresh,30);});

  observer=new MutationObserver(()=>queueReapply());observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setTimeout(refresh,20);setInterval(refresh,10000);
})();
