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

  function normalizeLang(value){const raw=String(value||'').toLowerCase();if(raw.startsWith('de'))return'de';if(raw.startsWith('fr'))return'fr';if(raw.startsWith('en'))return'en';return'';}
  function lang(){
    const canonical=normalizeLang(localStorage.getItem('hub_language'));
    if(canonical)return canonical;
    const legacy=normalizeLang(localStorage.getItem('hubLang'));
    if(legacy){localStorage.setItem('hub_language',legacy);localStorage.removeItem('hubLang');return legacy;}
    const fallback=normalizeLang(document.documentElement.lang)||normalizeLang(navigator.language)||'en';
    localStorage.setItem('hub_language',fallback);
    return fallback;
  }
  function persistLang(value){const next=normalizeLang(value);if(!next)return'';localStorage.setItem('hub_language',next);localStorage.removeItem('hubLang');return next;}
  function sync(){
    const l=lang(),t=COPY[l];
    document.documentElement.lang=l;
    const routes={overview:t.overview,ranking:t.ranking,cup:t.cup,profile:t.profile};
    $$('.primary-nav [data-route]').forEach(a=>{
      const key=a.dataset.route;if(!routes[key])return;
      if(key==='cup'){
        const textNode=[...a.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
        if(textNode)textNode.textContent=routes[key];
      }else a.textContent=routes[key];
    });
    const flag=$('#languageFlag'),code=$('#languageCode');if(flag)flag.textContent=META[l][0];if(code)code.textContent=META[l][1];
    $$('#languageMenu [data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
    const status=$('#accountStatusText');if(status)status.textContent=t.pending;
    const community=$('#communityButton');if(community)community.setAttribute('aria-label',t.friends);
    const account=$('#loginDemoButton');
    if(account){account.textContent='PENDING';account.disabled=false;account.removeAttribute('aria-disabled');account.title=t.pending;account.classList.add('is-account');account.onclick=()=>{location.href='index.html#profile';};}
    const arrow=$('#languageButton i');if(arrow){arrow.style.display='inline-flex';arrow.style.alignItems='center';arrow.style.justifyContent='center';arrow.style.lineHeight='1';arrow.style.transform='translateY(-1px)';}
  }

  const button=$('#languageButton'),menu=$('#languageMenu');
  if(button&&menu){
    button.addEventListener('click',(e)=>{e.preventDefault();e.stopPropagation();const open=menu.hidden;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',(e)=>{if(!e.target.closest('#languagePicker')){menu.hidden=true;button.setAttribute('aria-expanded','false');}});
  }
  $$('#languageMenu [data-lang]').forEach(b=>b.addEventListener('click',()=>{
    persistLang(b.dataset.lang);
    setTimeout(()=>{if(menu)menu.hidden=true;if(button)button.setAttribute('aria-expanded','false');sync();},0);
  }));
  $('#communityButton')?.addEventListener('click',()=>{location.href='index.html#overview';});
  $('#hubPendingHeaderStatus')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  window.addEventListener('storage',sync);
  sync();
})();
