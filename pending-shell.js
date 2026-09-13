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
  const VERIFY_COPY={
    de:{
      eyebrow:'SOFORT VERIFIZIEREN',
      title:'Jetzt sofort verifizieren?',
      badge:'GOOGLE CHROME',
      text:'Wenn du nicht auf die Freigabe durch einen Admin warten möchtest, kannst du deinen Account sofort selbst verifizieren. Installiere dafür HUB Verify und öffne Bloxd.io einmal in Google Chrome. Nach wenigen Sekunden erkennt die Extension deine Verifizierungsdaten und bestätigt deinen Account automatisch. HUB Verify dient dabei als sichere Brücke zwischen Bloxd.io und dem HUB, damit wir bestätigen können, dass der Bloxd-Account wirklich zu dir gehört.',
      browser:'Aktuell empfehlen wir Google Chrome. Microsoft Edge und Brave basieren ebenfalls auf Chromium und können Chrome-Erweiterungen grundsätzlich verwenden. HUB Verify wurde dort bisher allerdings noch nicht offiziell getestet.',
      tutorial:'TUTORIAL ANSEHEN',
      download:'EXTENSION HERUNTERLADEN',
      bloxd:'BLOXD.IO ÖFFNEN',
      note:'Nach erfolgreicher Verifizierung wird dein Pending-Account automatisch freigeschaltet.'
    },
    en:{
      eyebrow:'INSTANT VERIFICATION',
      title:'Verify your account right now?',
      badge:'GOOGLE CHROME',
      text:'If you do not want to wait for an admin to unlock your account, you can verify it yourself immediately. Install HUB Verify and open Bloxd.io once in Google Chrome. After a few seconds, the extension detects your verification data and confirms your account automatically. HUB Verify acts as a secure bridge between Bloxd.io and the HUB so we can confirm that the Bloxd account really belongs to you.',
      browser:'Google Chrome is currently recommended. Microsoft Edge and Brave are also Chromium-based and can generally use Chrome extensions, but HUB Verify has not yet been officially tested there.',
      tutorial:'VIEW TUTORIAL',
      download:'DOWNLOAD EXTENSION',
      bloxd:'OPEN BLOXD.IO',
      note:'After successful verification, your Pending account is unlocked automatically.'
    },
    fr:{
      eyebrow:'VÉRIFICATION IMMÉDIATE',
      title:'Te vérifier maintenant ?',
      badge:'GOOGLE CHROME',
      text:'Si tu ne veux pas attendre la validation par un administrateur, tu peux vérifier ton compte immédiatement. Installe HUB Verify puis ouvre Bloxd.io une fois dans Google Chrome. Après quelques secondes, l’extension détecte les données de vérification et confirme automatiquement ton compte. HUB Verify sert de pont sécurisé entre Bloxd.io et le HUB afin de confirmer que le compte Bloxd t’appartient vraiment.',
      browser:'Google Chrome est actuellement recommandé. Microsoft Edge et Brave utilisent aussi Chromium et peuvent généralement utiliser les extensions Chrome, mais HUB Verify n’y a pas encore été testé officiellement.',
      tutorial:'VOIR LE TUTORIEL',
      download:'TÉLÉCHARGER L’EXTENSION',
      bloxd:'OUVRIR BLOXD.IO',
      note:'Après la vérification, ton compte Pending est débloqué automatiquement.'
    }
  };

  function normalizeLang(value){const raw=String(value||'').toLowerCase();if(raw.startsWith('de'))return'de';if(raw.startsWith('fr'))return'fr';if(raw.startsWith('en'))return'en';return'';}
  function persistLang(value){
    const next=normalizeLang(value);if(!next)return'';
    localStorage.setItem('sg-lang',next);
    localStorage.setItem('hub_language',next);
    localStorage.setItem('hubLang',next);
    return next;
  }
  function lang(){
    const resolved=normalizeLang(localStorage.getItem('sg-lang'))||normalizeLang(localStorage.getItem('hub_language'))||normalizeLang(localStorage.getItem('hubLang'))||normalizeLang(document.documentElement.lang)||normalizeLang(navigator.language)||'en';
    return persistLang(resolved);
  }

  function injectVerifyStyles(){
    if($('#hubPendingInstantVerifyStyles'))return;
    const style=document.createElement('style');
    style.id='hubPendingInstantVerifyStyles';
    style.textContent=`
      .hub-pending-instant-card .hub-pending-instant-badge{display:inline-flex;width:max-content;margin:4px 0 13px;padding:7px 10px;border:1px solid rgba(56,240,219,.28);border-radius:999px;background:rgba(56,240,219,.08);color:#59ead9;font-size:8px;font-weight:900;letter-spacing:.08em}
      .hub-pending-instant-card .hub-pending-instant-browser{margin:15px 0 0!important;padding:11px 13px;border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(255,255,255,.025);color:#9087a5!important;font-size:10.5px!important;line-height:1.55!important}
      .hub-pending-instant-actions{display:grid;grid-template-columns:.9fr 1.3fr 1fr;gap:9px;margin:19px 0 2px}
      .hub-pending-instant-button{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:45px;padding:0 13px;border:1px solid rgba(126,79,241,.48);border-radius:10px;background:rgba(126,79,241,.08);color:#f7f4ff!important;font:900 9px/1.18 Montserrat,Arial;letter-spacing:.045em;text-align:center;text-decoration:none!important;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}
      .hub-pending-instant-button:hover{transform:translateY(-1px);border-color:rgba(151,108,255,.9);background:rgba(126,79,241,.15)}
      .hub-pending-instant-button.primary{border-color:rgba(56,240,219,.48);background:linear-gradient(135deg,rgba(56,240,219,.20),rgba(71,186,255,.15));color:#e6fffc!important;box-shadow:0 10px 28px rgba(20,207,190,.08)}
      .hub-pending-instant-button.primary:hover{border-color:rgba(56,240,219,.82);background:linear-gradient(135deg,rgba(56,240,219,.28),rgba(71,186,255,.20));box-shadow:0 12px 32px rgba(20,207,190,.13)}
      .hub-pending-instant-button.bloxd{border-color:rgba(255,255,255,.11);background:rgba(255,255,255,.045)}
      .hub-pending-instant-button.tutorial{border-color:rgba(126,79,241,.35);background:rgba(126,79,241,.07)}
      .hub-pending-instant-card .hub-pending-instant-note{margin-top:15px!important;padding-top:15px;border-top:1px solid rgba(255,255,255,.06);color:#8f86a4!important;font-size:11px!important}
      @media(max-width:1100px){.hub-pending-instant-actions{grid-template-columns:1fr 1fr}.hub-pending-instant-button.bloxd{grid-column:1/-1}}
      @media(max-width:480px){.hub-pending-instant-actions{grid-template-columns:1fr}.hub-pending-instant-button.bloxd{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function renderInstantVerification(){
    injectVerifyStyles();
    const grid=$('#hubPendingPage .hub-pending-route-grid');
    if(!grid)return;
    const cards=[...grid.querySelectorAll(':scope > .hub-pending-route-card')];
    const card=cards[1];
    if(!card)return;
    const l=lang(),t=VERIFY_COPY[l]||VERIFY_COPY.en;
    if(card.dataset.instantVerifyLang===l)return;
    card.dataset.instantVerifyLang=l;
    card.classList.add('hub-pending-instant-card');
    card.innerHTML=`
      <span class="eyebrow teal">${t.eyebrow}</span>
      <h2>${t.title}</h2>
      <span class="hub-pending-instant-badge">${t.badge}</span>
      <p>${t.text}</p>
      <p class="hub-pending-instant-browser">${t.browser}</p>
      <div class="hub-pending-instant-actions">
        <button type="button" class="hub-pending-instant-button tutorial" data-hub-pending-tutorial>${t.tutorial}</button>
        <a class="hub-pending-instant-button primary" href="downloads/HUB-Verify-v1.0.1.zip" download>${t.download}</a>
        <a class="hub-pending-instant-button bloxd" href="https://bloxd.io/" target="_blank" rel="noopener noreferrer">${t.bloxd}</a>
      </div>
      <p class="hub-pending-instant-note">${t.note}</p>`;
  }

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
    const arrow=$('#languageButton > i');
    if(arrow){
      arrow.style.display='inline-flex';
      arrow.style.alignItems='center';
      arrow.style.justifyContent='center';
      arrow.style.lineHeight='1';
      arrow.style.paddingBottom='8px';
      arrow.style.boxSizing='border-box';
      arrow.style.transform='none';
      arrow.style.margin='0';
    }
    renderInstantVerification();
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
  document.addEventListener('click',(event)=>{
    if(event.target.closest('[data-hub-pending-tutorial]'))event.preventDefault();
  });
  window.addEventListener('storage',sync);
  new MutationObserver(()=>renderInstantVerification()).observe(document.documentElement,{childList:true,subtree:true});
  sync();
})();
