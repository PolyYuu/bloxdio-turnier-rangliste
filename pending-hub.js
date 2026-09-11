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
    de: {pending:'VERIFIZIERUNG AUSSTEHEND',pendingName:'PENDING',verification:'BLOXD VERIFIZIERUNG',statsHidden:'Statistiken noch nicht sichtbar',statsText:'Deine Statistiken, dein Rating und deine bisherigen Turniere werden sichtbar, sobald du verifiziert wurdest. Bis dahin hat dein HUB-Account noch keinen Spielernamen.',viewStatus:'VERIFIZIERUNGSSTATUS ANSEHEN',yourAccount:'DEIN ACCOUNT',overviewTitle:'Verifizierung ausstehend',overviewStrong:'Stats und Spielername werden nach der Bloxd-Verifizierung sichtbar.',overviewText:'Rangliste, Cups und öffentliche Spielerprofile kannst du bereits ganz normal ansehen.',viewProfile:'MEIN PROFIL ANSEHEN',statusTitle:'Verifizierungsstatus anzeigen',blocked:'Diese Funktion wird nach deiner Bloxd-Verifizierung freigeschaltet.'},
    en: {pending:'VERIFICATION PENDING',pendingName:'PENDING',verification:'BLOXD VERIFICATION',statsHidden:'Statistics are not visible yet',statsText:'Your statistics, rating and previous tournaments become visible after verification. Until then, your HUB account does not have a player name yet.',viewStatus:'VIEW VERIFICATION STATUS',yourAccount:'YOUR ACCOUNT',overviewTitle:'Verification pending',overviewStrong:'Stats and player name become visible after Bloxd verification.',overviewText:'You can already use the ranking, cups and public player profiles normally.',viewProfile:'VIEW MY PROFILE',statusTitle:'View verification status',blocked:'This feature becomes available after your Bloxd verification.'},
    fr: {pending:'VÉRIFICATION EN ATTENTE',pendingName:'EN ATTENTE',verification:'VÉRIFICATION BLOXD',statsHidden:'Statistiques pas encore visibles',statsText:'Tes statistiques, ton classement et tes anciens tournois deviennent visibles après la vérification. Jusque-là, ton compte HUB n’a pas encore de nom de joueur.',viewStatus:'VOIR LE STATUT DE VÉRIFICATION',yourAccount:'TON COMPTE',overviewTitle:'Vérification en attente',overviewStrong:'Les statistiques et le nom du joueur apparaissent après la vérification Bloxd.',overviewText:'Tu peux déjà utiliser normalement le classement, les cups et les profils publics.',viewProfile:'VOIR MON PROFIL',statusTitle:'Voir le statut de vérification',blocked:'Cette fonction sera disponible après ta vérification Bloxd.'}
  };

  function language(){const raw=String(localStorage.getItem('hub_language')||localStorage.getItem('hubLang')||document.documentElement.lang||navigator.language||'de').toLowerCase();if(raw.startsWith('fr'))return'fr';if(raw.startsWith('en'))return'en';return'de';}
  const t=(key)=>COPY[language()]?.[key]||COPY.de[key]||key;

  function storedAuthUserId(){try{for(let i=0;i<localStorage.length;i+=1){const key=localStorage.key(i);if(!key||!key.startsWith('sb-')||!key.endsWith('-auth-token'))continue;const parsed=JSON.parse(localStorage.getItem(key)||'null');const id=parsed?.user?.id||parsed?.currentSession?.user?.id||parsed?.session?.user?.id;if(id)return String(id);}}catch(_){}return'';}
  function readCache(){try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!cached||cached.status!=='pending')return null;const authId=storedAuthUserId();if(!authId)return null;if(cached.auth_user_id&&cached.auth_user_id!==authId)return null;return cached;}catch(_){return null;}}
  function writeCache(data,authUserId){try{const id=authUserId||storedAuthUserId();if(!id)return;localStorage.setItem(CACHE_KEY,JSON.stringify({status:'pending',auth_user_id:id,source:data?.source||data?.verification_source||'',cached_at:Date.now()}));}catch(_){} }
  function clearCache(){try{localStorage.removeItem(CACHE_KEY);}catch(_){} }

  let state=live.registrationState?.status==='pending'?live.registrationState:null;
  let active=!!state;
  function currentPendingState(){const candidate=state?.status==='pending'?state:(live.registrationState?.status==='pending'?live.registrationState:readCache());if(candidate&&candidate!==state)state=candidate;return candidate;}
  function pendingName(){return t('pendingName');}

  function addViewportSafety(){
    if($('#hubViewportSafetyStyles'))return;
    const style=document.createElement('style');style.id='hubViewportSafetyStyles';style.textContent=`:root{--max:calc(100vw - 40px)!important}html{width:100%!important;max-width:none!important;overflow-x:hidden}body{width:100vw!important;max-width:none!important;overflow-x:hidden}.site-header{width:100%!important;max-width:none!important}.app-shell{width:calc(100vw - 40px)!important;max-width:none!important}@media(max-width:760px){:root{--max:calc(100vw - 22px)!important}.app-shell{width:calc(100vw - 22px)!important}}`;document.head.appendChild(style);
  }

  function showPage(page){$$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===page));$$('.primary-nav [data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===page));if(location.hash!==`#${page}`)history.replaceState(null,'',`#${page}`);window.scrollTo({top:0,behavior:'smooth'});}

  function renderPendingProfile(){
    if(!currentPendingState())return false;
    showPage('profile');
    const name=pendingName();
    const title=$('#profilePlayerName');if(title)title.textContent=name;
    const rank=$('#profileGlobalRank');if(rank){rank.hidden=false;rank.textContent=`ⓘ ${t('pending')}`;rank.style.color='#ffc65c';rank.style.cursor='pointer';rank.onclick=()=>{location.href='pending.html';};}
    const avatar=$('#profileAvatar');if(avatar)avatar.hidden=true;
    const mono=$('#profileMonogram');if(mono){mono.hidden=false;mono.textContent='…';}
    $('#editAvatarButton')?.setAttribute('hidden','');$('#renameButton')?.setAttribute('hidden','');$('#profileAdminButton')?.setAttribute('hidden','');
    const rankCard=$('.profile-rank-card');if(rankCard){rankCard.hidden=false;rankCard.innerHTML=`<div class="hub-pending-profile-card"><span class="hub-pending-kicker">${t('verification')}</span><h2>${t('statsHidden')}</h2><p>${t('statsText')}</p><button type="button" class="secondary-button" data-hub-pending-status>${t('viewStatus')}</button></div>`;}
    $('.stats-panel')?.setAttribute('hidden','');$('.history-panel')?.setAttribute('hidden','');$('[data-page="profile"] .recent-updates')?.setAttribute('hidden','');
    document.querySelector('[data-hub-pending-status]')?.addEventListener('click',()=>{location.href='pending.html';});return true;
  }

  function renderOverviewPendingCard(){const card=$('.my-rank-card');if(!card)return;card.dataset.pendingRendered='1';card.innerHTML=`<header class="panel-header tight"><div><span class="eyebrow">${t('yourAccount')}</span><h2>${t('overviewTitle')}</h2></div><button class="hub-pending-info" type="button" data-hub-pending-status aria-label="${t('statusTitle')}" title="${t('statusTitle')}">i</button></header><div class="hub-pending-overview"><strong>${t('overviewStrong')}</strong><p>${t('overviewText')}</p><button class="secondary-button" type="button" data-hub-pending-profile>${t('viewProfile')}</button></div>`;}
  function hideUnverifiedActions(){$$('[data-open-register], .next-cup-cta, [data-register-next-cup], [data-next-cup-register]').forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true');el.style.setProperty('display','none','important');});}
  function installHeader(){
    $('#hubPendingHeaderStatus')?.remove();const account=$('#loginDemoButton');if(!account)return;
    account.removeAttribute('data-i18n');account.textContent=pendingName();account.classList.add('is-account');account.disabled=false;account.removeAttribute('aria-disabled');account.title=t('statusTitle');
    const badge=document.createElement('button');badge.id='hubPendingHeaderStatus';badge.type='button';badge.className='hub-pending-header-status';badge.innerHTML=`<span class="hub-pending-mini-info">i</span> ${t('pending')}`;badge.title=t('statusTitle');badge.onclick=()=>{location.href='pending.html';};account.insertAdjacentElement('afterend',badge);
  }

  function addStyles(){if($('#hubPendingIntegratedStyles'))return;const style=document.createElement('style');style.id='hubPendingIntegratedStyles';style.textContent=`.hub-pending-header-status{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,198,92,.28);background:rgba(255,198,92,.11);color:#ffc65c;border-radius:999px;padding:8px 11px;font:800 9px/1 Montserrat,Arial;letter-spacing:.06em;cursor:pointer;white-space:nowrap}.hub-pending-mini-info,.hub-pending-info{display:inline-grid;place-items:center;border:1px solid currentColor;border-radius:50%;font-family:Georgia,serif;font-style:italic;font-weight:800;line-height:1}.hub-pending-mini-info{width:15px;height:15px;font-size:9px}.hub-pending-info{width:32px;height:32px;color:#ffc65c;background:rgba(255,198,92,.08);font-size:14px;cursor:pointer}.hub-pending-overview{display:grid;gap:12px;padding:8px 2px 4px}.hub-pending-overview strong{font-size:18px}.hub-pending-overview p{margin:0;color:#9892a8;line-height:1.55;font-size:13px}.hub-pending-overview .secondary-button{width:max-content}body.hub-pending-account [data-open-register],body.hub-pending-account .next-cup-cta,body.hub-pending-account [data-register-next-cup],body.hub-pending-account [data-next-cup-register]{display:none!important}body.hub-pending-account [data-page="profile"] .profile-grid{grid-template-columns:1fr!important}body.hub-pending-account [data-page="profile"] .profile-rank-card{width:100%;box-sizing:border-box}.hub-pending-profile-card{display:grid;gap:14px;padding:18px 12px}.hub-pending-profile-card h2{margin:0;font-size:30px}.hub-pending-profile-card p{max-width:760px;margin:0;color:#a29bad;line-height:1.65}.hub-pending-profile-card button{width:max-content}.hub-pending-kicker{color:#ffc65c;font:900 10px/1 Montserrat;letter-spacing:.12em}body.hub-pending-account #editAvatarButton,body.hub-pending-account #renameButton,body.hub-pending-account #profileAdminButton{display:none!important}body.hub-pending-account [data-page="profile"] .stats-panel,body.hub-pending-account [data-page="profile"] .history-panel,body.hub-pending-account [data-page="profile"] .recent-updates{display:none!important}@media(max-width:900px){.hub-pending-header-status{max-width:170px;overflow:hidden;text-overflow:ellipsis}.hub-pending-overview .secondary-button,.hub-pending-profile-card button{width:100%}}`;document.head.appendChild(style);}

  function patchLoginModal(){
    const m=$('#v3AuthModal');if(!m)return;const form=$('#v3AuthForm',m);if(!form)return;
    const first=$('label',form),label=first?.querySelector('span'),intro=$('p',m),l=language();
    if(label)label.textContent=l==='de'?'Ingame-Name oder 8-Zeichen-Code':l==='fr'?'Pseudo ou code à 8 caractères':'Ingame name or 8-character code';
    if(intro)intro.textContent=l==='de'?'Nutze deinen aktuellen Bloxd.io Ingame-Namen oder deinen 8-Zeichen-Code.':l==='fr'?'Utilise ton pseudo Bloxd.io actuel ou ton code à 8 caractères.':'Use your current Bloxd.io ingame name or your 8-character code.';
  }

  function applyUi(){if(!currentPendingState())return;active=true;live.registrationState=state;document.body.classList.add('hub-pending-account');addStyles();hideUnverifiedActions();installHeader();renderOverviewPendingCard();if(location.hash==='#profile')renderPendingProfile();}
  function clearPendingUi(){
    state=null;active=false;live.registrationState=null;document.body.classList.remove('hub-pending-account');$('#hubPendingHeaderStatus')?.remove();
    const account=$('#loginDemoButton');if(account){account.disabled=false;account.removeAttribute('aria-disabled');account.removeAttribute('title');account.classList.remove('is-account');account.textContent=core.copy?.('Log in','Anmelden','Se connecter')||'Log in';}
  }
  async function refresh(){
    try{
      const session=await api.currentSession();
      if(!session){const wasActive=active;clearCache();clearPendingUi();if(wasActive)location.reload();return;}
      const{data,error}=await api.client.rpc('get_my_registration_status');if(error)throw error;
      if(data?.status==='verified'){clearCache();if(active)location.reload();return;}
      if(data?.status!=='pending'){clearCache();clearPendingUi();return;}
      state=data;live.registrationState=data;writeCache(data,session?.user?.id);applyUi();
    }catch(err){console.warn('Pending HUB state could not be refreshed',err);}
  }
  function interceptPendingAction(e){
    if(!currentPendingState())return;
    const account=e.target.closest?.('#loginDemoButton');if(account){e.preventDefault();e.stopImmediatePropagation();location.href='pending.html';return;}
    const profileRoute=e.target.closest?.('[data-route="profile"], [data-hub-pending-profile]');if(profileRoute){e.preventDefault();e.stopImmediatePropagation();renderPendingProfile();return;}
    if(e.target.closest?.('[data-hub-pending-status]')){e.preventDefault();e.stopImmediatePropagation();location.href='pending.html';return;}
    const sensitive=e.target.closest?.('[data-v3-friend-add],[data-friend-add],[data-v3-friend-remove],[data-v3-friend-accept],[data-v3-friend-decline],[data-open-register],.next-cup-cta,[data-register-next-cup],[data-next-cup-register],#editAvatarButton,#renameButton');if(sensitive){e.preventDefault();e.stopImmediatePropagation();core.toast?.(t('blocked'),true);}
  }

  addViewportSafety();
  document.addEventListener('pointerdown',interceptPendingAction,true);document.addEventListener('click',interceptPendingAction,true);
  document.addEventListener('click',e=>{if(e.target.closest?.('#loginDemoButton')&&!currentPendingState())setTimeout(patchLoginModal,0);},true);
  window.addEventListener('hashchange',()=>{if(currentPendingState()&&location.hash==='#profile')renderPendingProfile();});
  document.addEventListener('hub:auth-restored',(e)=>{
    const detail=e.detail||{};
    if(detail.loggedIn===false){const wasActive=active;clearCache();clearPendingUi();if(wasActive)location.reload();return;}
    const incoming=detail.registrationState;
    if(incoming?.status==='pending'){state=incoming;live.registrationState=incoming;writeCache(incoming,detail.session?.user?.id||detail.user?.id);applyUi();return;}
    if(incoming?.status==='verified'){clearCache();if(active)location.reload();return;}
    setTimeout(refresh,30);
  });
  setTimeout(refresh,40);setInterval(refresh,12000);
})();
