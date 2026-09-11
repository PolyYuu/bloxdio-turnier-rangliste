(() => {
  'use strict';
  const $=(s)=>document.querySelector(s),$$=(s)=>[...document.querySelectorAll(s)];
  const COPY={de:{overview:'OVERVIEW',ranking:'RANKING',cup:'CUP',profile:'PROFILE',pending:'VERIFIZIERUNG AUSSTEHEND',friends:'Freunde und Cup-Einladungen'},en:{overview:'OVERVIEW',ranking:'RANKING',cup:'CUP',profile:'PROFILE',pending:'VERIFICATION PENDING',friends:'Friends and Cup invitations'},fr:{overview:'APERÇU',ranking:'CLASSEMENT',cup:'CUP',profile:'PROFIL',pending:'VÉRIFICATION EN ATTENTE',friends:'Amis et invitations aux Cups'}};
  const META={de:['🇩🇪','DE'],en:['🇬🇧','EN'],fr:['🇫🇷','FR']};
  function norm(v){v=String(v||'').toLowerCase();return v.startsWith('de')?'de':v.startsWith('fr')?'fr':v.startsWith('en')?'en':'';}
  function lang(){const a=norm(localStorage.getItem('hub_language'))||norm(localStorage.getItem('hubLang'))||norm(document.documentElement.lang)||norm(navigator.language)||'en';localStorage.setItem('hub_language',a);localStorage.setItem('hubLang',a);return a;}
  function persist(v){const a=norm(v);if(a){localStorage.setItem('hub_language',a);localStorage.setItem('hubLang',a);}return a;}
  function pendingCode(){try{return String(JSON.parse(localStorage.getItem('hub_pending_registration')||'null')?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);}catch(_){return'';}}
  function sync(){
    const l=lang(),t=COPY[l];document.documentElement.lang=l;
    const routes={overview:t.overview,ranking:t.ranking,cup:t.cup,profile:t.profile};
    $$('.primary-nav [data-route]').forEach(a=>{const key=a.dataset.route;if(!routes[key])return;if(key==='cup'){const n=[...a.childNodes].find(x=>x.nodeType===Node.TEXT_NODE&&x.textContent.trim());if(n)n.textContent=routes[key];}else a.textContent=routes[key];});
    if($('#languageFlag'))$('#languageFlag').textContent=META[l][0];if($('#languageCode'))$('#languageCode').textContent=META[l][1];$$('#languageMenu [data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===l));
    if($('#accountStatusText'))$('#accountStatusText').textContent=t.pending;if($('#communityButton'))$('#communityButton').setAttribute('aria-label',t.friends);
    const account=$('#loginDemoButton');if(account){account.textContent=pendingCode()||'PENDING';account.disabled=false;account.removeAttribute('aria-disabled');account.title=t.pending;account.classList.add('is-account');account.onclick=null;}
  }
  const button=$('#languageButton'),menu=$('#languageMenu');
  if(button&&menu){button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const open=menu.hidden;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));});document.addEventListener('click',e=>{if(!e.target.closest('#languagePicker')){menu.hidden=true;button.setAttribute('aria-expanded','false');}});}
  $$('#languageMenu [data-lang]').forEach(b=>b.addEventListener('click',()=>{persist(b.dataset.lang);setTimeout(()=>{if(menu)menu.hidden=true;if(button)button.setAttribute('aria-expanded','false');sync();},0);}));
  window.addEventListener('storage',sync);sync();
})();
