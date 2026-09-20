/* Signed identity bridge. Gameplay events remain in the existing service worker. */
'use strict';
(() => {
 const ENDPOINT='https://nxzrgbpaxukgjyzwupjp.supabase.co/functions/v1/hub-identity-v2';
 const STORE='hubIdentityV2',SESSIONS='hubIdentityV2Sessions',ALARM='hub-identity-v2-retry';
 let chain=Promise.resolve(),running=null;
 const initial=()=>({queue:[],done:[],shown:[],acks:[],processed:0,last:null});
 const serial=fn=>{const p=chain.then(fn,fn);chain=p.catch(()=>{});return p;};
 async function read(){const x=await chrome.storage.local.get(STORE);return{...initial(),...(x[STORE]||{})};}
 const change=fn=>serial(async()=>{const s=await read(),result=await fn(s);await chrome.storage.local.set({[STORE]:s});return result;});
 function senderOK(s){try{return s.id===chrome.runtime.id&&Number.isInteger(s.tab?.id)&&new URL(s.url).origin==='https://bloxd.io';}catch{return false;}}
 const frame=s=>`${s.tab.id}:${s.frameId||0}:${s.documentId||'doc'}`;
 function parse(raw,type){
  if(typeof raw!=='string'||raw.length>4000)return null;
  const p=raw.split('|');if(p.length!==5||p[0]!=='__SG_EVT__'||p[1]!==type||p[2]!=='sg-hub-identity-20260920'||!/^SIG=[A-Za-z0-9_-]{43}$/.test(p[4]))return null;
  try{const b=p[3].replace(/-/g,'+').replace(/_/g,'/'),a=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b+'='.repeat((4-b.length%4)%4)),c=>c.charCodeAt(0))));return Array.isArray(a)&&a.length===8?a:null;}catch{return null;}
 }
 async function post(body){
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),10000);
  try{const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal}),data=await r.json().catch(()=>null);
   if(!r.ok||data?.ok!==true){const e=new Error(data?.error||`identity_http_${r.status}`);e.terminal=r.status>=400&&r.status<500&&r.status!==429;throw e;}return data;
  }finally{clearTimeout(timeout);}
 }
 const arm=()=>chrome.alarms.create(ALARM,{periodInMinutes:1});
 async function drain(){
  if(running)return running;
  running=(async()=>{
   for(let i=0;i<25;i++){
    const s=await read(),q=s.queue.find(x=>x.next<=Date.now());if(!q)break;
    try{const r=await post({raw:q.raw});if(r.processed!==true&&r.ignored!==true)throw Error('processing_unconfirmed');
     await change(st=>{st.queue=st.queue.filter(x=>x.id!==q.id);st.done=[...st.done.filter(x=>x!==q.id),q.id].slice(-600);if(r.processed&&!r.duplicate)st.processed++;st.last={ok:true,status:r.ignored?'ignored-stale':'processed',at:Date.now()};});
    }catch(e){await change(st=>{const item=st.queue.find(x=>x.id===q.id);if(!item)return;item.attempts++;const expired=Date.now()-Number(item.emittedAt)>600000;
     if(e.terminal||expired||item.attempts>=16)st.queue=st.queue.filter(x=>x.id!==q.id);else item.next=Date.now()+Math.min(60000,1000*2**Math.min(item.attempts,6));
     st.last={ok:false,status:e.terminal||expired?'rejected':'retry',error:String(e.message),at:Date.now()};});}
   }
   const s=await read();for(const a of s.acks.slice(0,10)){
    try{await post({mode:'ack',self:a.self,notificationId:a.id});await change(st=>{st.acks=st.acks.filter(x=>x.id!==a.id);});}
    catch(e){if(e.terminal)await change(st=>{st.acks=st.acks.filter(x=>x.id!==a.id);});}
   }
  })().finally(()=>{running=null;});return running;
 }
 async function enqueue(raw){
  const a=parse(raw,'REGASSERT2');if(!a||typeof a[0]!=='string'||!a[0].startsWith('hub-id2:')||a[0].length>240)return{ok:false,error:'invalid_identity_marker'};
  const r=await change(s=>{if(s.done.includes(a[0]))return{ok:true,duplicate:true};const old=s.queue.find(x=>x.id===a[0]);if(old){if(a[5]>old.emittedAt){old.raw=raw;old.emittedAt=a[5];old.next=0;}return{ok:true,queued:true};}
   if(s.queue.length>=120)return{ok:false,error:'identity_queue_full'};s.queue.push({id:a[0],raw,emittedAt:a[5],attempts:0,next:0});return{ok:true,queued:true};});
  if(r.ok){await arm();void drain();}return r;
 }
 async function getSession(key){const x=await chrome.storage.session.get(SESSIONS);return(x[SESSIONS]||{})[key]||null;}
 const changeSession=(key,fn)=>serial(async()=>{const x=await chrome.storage.session.get(SESSIONS),map=x[SESSIONS]||{};for(const k of Object.keys(map))if(map[k].expiresAt<Date.now())delete map[k];const result=fn(map[key]||null);if(result)map[key]=result;else delete map[key];await chrome.storage.session.set({[SESSIONS]:map});return result;});
 async function consume(key,own,data){
  const latest=await getSession(key);if(latest?.raw!==own.raw)return{ok:true,ignored:true};if(data.playerDbId!==own.dbId)return{ok:false,error:'recipient_mismatch'};
  const s=await read(),notices=(Array.isArray(data.notifications)?data.notifications:[]).map(n=>({type:'rename',id:n.id,fromName:n.fromName,toName:n.toName}));
  if(own.linkedSeen===false&&data.linked===true)notices.push({type:'verified',id:`verified:${own.dbId}:${own.code}`,playerName:data.playerName});
  await changeSession(key,x=>x?.raw===own.raw?{...x,linkedSeen:data.linked===true,lastPoll:Date.now(),offered:[...new Set([...(x.offered||[]),...notices.map(n=>n.id)])].slice(-30)}:x);
  for(const n of notices)if(s.shown.includes(n.id)&&n.type==='rename')await change(st=>{if(!st.acks.some(a=>a.id===n.id))st.acks.push({id:n.id,self:own.raw});});
  return{ok:true,linked:data.linked===true,playerDbId:own.dbId,issuedAt:own.issuedAt,notifications:notices.filter(n=>!s.shown.includes(n.id))};
 }
 async function observe(raw,s){
  const a=parse(raw,'REGSELF2');if(!a)return{ok:false,error:'invalid_self_marker'};
  const key=frame(s),current=await getSession(key);if(current&&current.issuedAt>a[3])return{ok:true,ignored:true};
  let r;try{r=await post({mode:'poll',self:raw});}catch(e){return{ok:false,error:String(e.message),retry:!e.terminal};}if(r.playerDbId!==a[0])return{ok:false,error:'recipient_mismatch'};
  const own=await changeSession(key,old=>old&&old.issuedAt>a[3]?old:{raw,dbId:a[0],code:a[2],issuedAt:a[3],expiresAt:a[4],linkedSeen:old?.dbId===a[0]?old.linkedSeen:null,lastPoll:0,offered:[]});
  if(own.raw!==raw)return{ok:true,ignored:true};
  await change(st=>{st.lastSelf={at:Date.now(),playerName:r.playerName||a[1]};});
  return consume(key,own,r);
 }
 async function poll(s){
  const key=frame(s),own=await getSession(key);if(!own)return{ok:false,error:'self_not_observed'};if(own.expiresAt<=Date.now())return{ok:false,error:'session_expired'};
  if(Date.now()-own.lastPoll<1500)return{ok:true,notifications:[],throttled:true};
  await drain();try{return consume(key,own,await post({mode:'poll',self:own.raw}));}catch(e){return{ok:false,error:String(e.message),retry:!e.terminal};}
 }
 async function shown(m,s){
  const own=await getSession(frame(s));if(!own)return{ok:false,error:'self_not_observed'};const id=m.notificationId;
  if(typeof id!=='string'||id.length>240||!(own.offered||[]).includes(id))return{ok:false,error:'notification_not_offered'};
  const verified=id===`verified:${own.dbId}:${own.code}`;
  await change(st=>{st.shown=[...st.shown.filter(x=>x!==id),id].slice(-600);if(!verified&&!st.acks.some(a=>a.id===id))st.acks.push({id,self:own.raw});});
  await arm();void drain();return{ok:true};
 }
 async function handle(m,s){if(!senderOK(s))return{ok:false,error:'invalid_sender'};switch(m.type){case'HUB_IDENTITY_V2_ASSERT':return enqueue(m.raw);case'HUB_IDENTITY_V2_SELF':return observe(m.raw,s);case'HUB_IDENTITY_V2_POLL':return poll(s);case'HUB_IDENTITY_V2_DISPLAYED':return shown(m,s);default:return{ok:false,error:'unknown_identity_message'};}}
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)void drain();});chrome.runtime.onStartup.addListener(()=>{void arm().then(drain);});chrome.runtime.onInstalled.addListener(()=>{void arm().then(drain);});
 globalThis.HubIdentityV2={handle,diagnostics:async()=>{const s=await read();return{processed:s.processed,queued:s.queue.length,last:s.last,lastSelf:s.lastSelf||null};}};
})();
