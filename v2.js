(()=>{
  const addCss=href=>{const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);};
  addCss('v2-overrides.css');
  addCss('v2-wallpaper.css');
  const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Failed to load '+src));document.body.appendChild(s);});
  load('v2-data.js')
    .then(()=>load('v2-icon-fallback.js'))
    .then(()=>load('v2-i18n.js'))
    .then(()=>load('v2-enhanced.js'))
    .catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend','<div style="position:fixed;left:20px;right:20px;bottom:20px;padding:14px;background:#35102b;color:white;z-index:99999;border:1px solid #ff627f">V2 demo failed to load. Please refresh.</div>');});
})();