/* Render only server-confirmed own notices, including inside the PLAY iframe. */
'use strict';
(()=>{
 const seen=new Set(),inflight=new Map(),done=new Set(),pending=new Map();
 let self='',lastSelfAt=0,sessionEpoch=0,selfQueue=Promise.resolve(),selfScheduled='',checking=false,timer=0,box=null,showing=false;
 const COPY={en:{rename:'Your account name has been updated on The HUB.',verified:'Your account is now verified on The HUB.'},de:{rename:'Dein Spielername wurde auf The HUB aktualisiert.',verified:'Dein Account ist jetzt auf The HUB verifiziert.'},fr:{rename:'Ton nom a été mis à jour sur The HUB.',verified:'Ton compte est maintenant vérifié sur The HUB.'}};
 const send=m=>chrome.runtime.sendMessage(m).catch(()=>({ok:false}));
 function runs(value){const out=[],s=String(value||'');let from=0;while(true){const i=s.indexOf('__SG_EVT__|',from);if(i<0)break;const j=s.indexOf('__SG_EVT__|',i+11),raw=s.slice(i,j<0?undefined:j).split(/\s/)[0];if(raw.length<=4000)out.push(raw);from=i+11;}return out;}
 function accept(r){if(r?.ok)for(const n of r.notifications||[]){if(n&&typeof n.id==='string'&&!done.has(n.id))pending.set(n.id,n);}void display();}
 async function observe(raw){
  const r=await send({type:'HUB_IDENTITY_V2_SELF',raw});if(!r?.ok||r.ignored)return;
  if(raw!==self&&Number(r.issuedAt)>=lastSelfAt){self=raw;lastSelfAt=r.issuedAt;sessionEpoch++;pending.clear();if(box)box.hidden=true;}
  if(raw!==self)return;accept(r);if(!timer)timer=setInterval(check,3000);
 }
 async function check(){if(!self||checking||document.visibilityState==='hidden')return;checking=true;const epoch=sessionEpoch;
  try{const r=await send({type:'HUB_IDENTITY_V2_POLL'});if(epoch===sessionEpoch)accept(r);}finally{checking=false;}
 }
 async function submit(raw){if(seen.has(raw))return;if(inflight.has(raw))return inflight.get(raw);
  const task=(async()=>{const r=await send({type:'HUB_IDENTITY_V2_ASSERT',raw});if(r?.ok){seen.add(raw);if(seen.size>1000)seen.delete(seen.values().next().value);}})().finally(()=>inflight.delete(raw));inflight.set(raw,task);return task;
 }
 async function processText(value){const markers=runs(value);
  for(const raw of markers)if(raw.startsWith('__SG_EVT__|REGASSERT2|'))await submit(raw);
  for(const raw of markers){if(!raw.startsWith('__SG_EVT__|REGSELF2|')||raw===self||raw===selfScheduled)continue;
   selfScheduled=raw;selfQueue=selfQueue.then(()=>observe(raw),()=>observe(raw)).finally(()=>{if(selfScheduled===raw)selfScheduled='';});
  }
  await selfQueue;
 }
 function ensure(){const parent=document.fullscreenElement||document.documentElement;if(!parent)return null;
  if(!box||!box.isConnected){box=document.createElement('div');box.id='hub-identity-v2-notice';box.setAttribute('role','status');box.setAttribute('aria-live','polite');Object.assign(box.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483647',maxWidth:'min(440px, calc(100vw - 28px))',boxSizing:'border-box',padding:'16px 18px',border:'1px solid #55e6b1',borderRadius:'12px',background:'rgba(10,5,22,.97)',color:'#fff',fontFamily:'Arial,sans-serif',boxShadow:'0 12px 35px rgba(0,0,0,.45)',pointerEvents:'none'});}
  if(box.parentNode!==parent)parent.appendChild(box);return box;
 }
 const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 async function display(){if(showing||!pending.size||document.visibilityState==='hidden')return;showing=true;const [id,n]=pending.entries().next().value,epoch=sessionEpoch;
  try{const {hubLanguage='en'}=await chrome.storage.local.get({hubLanguage:'en'}),c=COPY[hubLanguage]||COPY.en,el=ensure();if(!el)return;
   const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=n.type==='rename'?`${n.fromName} → ${n.toName}`:String(n.playerName||'The HUB');detail.textContent=n.type==='rename'?c.rename:c.verified;
   Object.assign(title.style,{display:'block',fontSize:'14px',lineHeight:'1.4',overflowWrap:'anywhere'});Object.assign(detail.style,{display:'block',fontSize:'11px',lineHeight:'1.45',marginTop:'5px',color:'#c7c3d6'});el.replaceChildren(title,detail);el.hidden=false;
   await frame();await frame();if(epoch!==sessionEpoch||document.visibilityState==='hidden'||!el.isConnected||el.getBoundingClientRect().width<=0){el.hidden=true;return;}
   const r=await send({type:'HUB_IDENTITY_V2_DISPLAYED',notificationId:id});if(r?.ok){done.add(id);pending.delete(id);}
   await new Promise(resolve=>setTimeout(resolve,15000));if(el.isConnected)el.hidden=true;
  }finally{showing=false;if(pending.size&&document.visibilityState!=='hidden')setTimeout(display,1000);}
 }
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden'){void check();void display();}});
 document.addEventListener('fullscreenchange',()=>{if(box?.isConnected&&!box.hidden)ensure();});window.addEventListener('pageshow',check);
 globalThis.HubIdentityClient={processText};
})();
