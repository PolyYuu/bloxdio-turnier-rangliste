(() => {
  'use strict';

  const $=(s)=>document.querySelector(s);
  const $$=(s)=>[...document.querySelectorAll(s)];
  const COPY={
    de:{overview:'OVERVIEW',ranking:'RANKING',cup:'CUP',profile:'PROFILE',pending:'VERIFIZIERUNG AUSSTEHEND',friends:'Freunde und Cup-Einladungen'},
    en:{overview:'OVERVIEW',ranking:'RANKING',cup:'CUP',profile:'PROFILE',pending:'VERIFICATION PENDING',friends:'Friends and Cup invitations'},
    fr:{overview:'APERÇU',ranking:'CLASSEMENT',cup:'CUP',profile:'PROFIL',pending:'VÉRIFICATION EN ATTENTE',friends:'Amis et invitations aux Cups'}
  };
  const META={de:['🇩🇪','DE'],en:['🇬🇧','EN'],fr:['🇫🇷','FR']};

  function lang(){const raw=String(localStorage.getItem('hub_language')||localStorage.getItem('hubLang')||document.documentElement.lang||navigator.language||'de').toLowerCase();return raw.startsWith('fr')?'fr':raw.startsWith('en')?'en':'de';}
  function sync(){
    const l=lang(),t=COPY[l];
    document.documentElement.lang=l;
    const routes={overview:t.overview,ranking:t.ranking,cup:t.cup,profile:t.profile};
    $$('.primary-nav [data-route]').forEach(a=>{
      const key=a.dataset.route;if(!routes[key])return;
      if(key==='cup'){
        const span=a.querySelector('span');if(span)span.textContent=routes[key];
      }else a.textContent=routes[key];
    });
    const flag=$('#languageFlag'),code=$('#languageCode');if(flag)flag.textContent=META[l][0];if(code)code.textContent=META[l][1];
    $$('#languageMenu [data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
    const status=$('#accountStatusText');if(status)status.textContent=t.pending;
    const community=$('#communityButton');if(community)community.setAttribute('aria-label',t.friends);
    // Pending is already an authenticated HUB account. Never let the account
    // button fall back into the login modal while verification is pending.
    const account=$('#loginDemoButton');
    if(account){account.textContent='PENDING';account.disabled=true;account.setAttribute('aria-disabled','true');account.title=t.pending;account.classList.add('is-account');}
  }

  const button=$('#languageButton'),menu=$('#languageMenu');
  if(button&&menu){
    button.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();const open=menu.hidden;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',(e)=>{if(!e.target.closest('#languagePicker')){menu.hidden=true;button.setAttribute('aria-expanded','false');}});
  }
  $$('#languageMenu [data-lang]').forEach(b=>b.addEventListener('click',()=>{setTimeout(()=>{if(menu)menu.hidden=true;if(button)button.setAttribute('aria-expanded','false');sync();},0);}));
  $('#communityButton')?.addEventListener('click',()=>{location.href='index.html#overview';});
  $('#hubPendingHeaderStatus')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  window.addEventListener('storage',sync);
  sync();
})();
