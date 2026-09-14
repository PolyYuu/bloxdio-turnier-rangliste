"use strict";

const SHORT_CODE_PATTERNS=[
  /HUB\s*Registrierungscode\s*:\s*([A-Z0-9]{8})/ig,
  /HUB\s*Registration\s*code\s*:\s*([A-Z0-9]{8})/ig,
  /HUB\s*Code\s*:\s*([A-Z0-9]{8})/ig
];
const REGASSERT_START='__SG_EVT__|REGASSERT|',REGSELF_START='__SG_EVT__|REGSELF|',TECH_START='__SG_EVT__|',TECH_CARRIER='HUBSYNC',DEFAULT_LANGUAGE='en';
const LIVE_TYPES=new Set(['BEGIN','PLAYER','KILL','DM','WIN','SNAPBEGIN','SNAPPLAYER','SNAPEND','END','CANCEL']);
const COPY={
  en:{
    title:n=>`${n||'Your player'} is now verified`,
    subtitle:'All features on The HUB are now available to you.',
    renameTitle:(a,b)=>`${a} → ${b}`,
    renameSubtitle:'Your player name was successfully changed on “The HUB”.'
  },
  de:{
    title:n=>`${n||'Dein Spieler'} ist jetzt verifiziert`,
    subtitle:'Alle Funktionen auf The HUB stehen dir jetzt zur Verfügung.',
    renameTitle:(a,b)=>`${a} → ${b}`,
    renameSubtitle:'Dein Spielername wurde erfolgreich auf „The Hub“ geändert.'
  },
  fr:{
    title:n=>`${n||'Ton joueur'} est maintenant vérifié`,
    subtitle:'Toutes les fonctionnalités de The HUB sont maintenant disponibles.',
    renameTitle:(a,b)=>`${a} → ${b}`,
    renameSubtitle:'Ton nom de joueur a été modifié avec succès sur « The HUB ».'
  }
};
const seenText=new Set(),seenAssertions=new Set(),seenLive=new Set(),ownWatchers=new Map();
let uiLanguage=DEFAULT_LANGUAGE,statusBox=null,observer=null,scanTimer=null,heartbeatTimer=null;

function hash(text){let h=2166136261;for(let i=0;i<text.length;i+=1)h=Math.imul(h^text.charCodeAt(i),16777619);return String(h>>>0);}
async function loadLanguage(){
  try{
    const data=await chrome.storage.local.get({hubLanguage:DEFAULT_LANGUAGE});
    uiLanguage=['en','de','fr'].includes(data.hubLanguage)?data.hubLanguage:DEFAULT_LANGUAGE;
  }catch(_){uiLanguage=DEFAULT_LANGUAGE;}
}
function ensureStatus(){
  if(statusBox||window.top!==window||!document.documentElement)return;
  statusBox=document.createElement('div');
  statusBox.id='hub-verify-extension-status';
  Object.assign(statusBox.style,{
    position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483647',
    minWidth:'260px',maxWidth:'420px',padding:'14px 16px',
    border:'1px solid rgba(85,230,177,.68)',borderRadius:'11px',
    background:'rgba(7,4,13,.95)',color:'#f7ffff',fontFamily:'Arial,sans-serif',
    boxShadow:'0 12px 34px rgba(0,0,0,.38)',pointerEvents:'none',
    opacity:'0',transform:'translateY(8px)',
    transition:'opacity .2s ease, transform .2s ease'
  });
  document.documentElement.appendChild(statusBox);
}
function toast(title,subtitle,accent='#55e6b1',timeout=15000){
  ensureStatus();
  if(!statusBox)return;
  statusBox.textContent='';
  const heading=document.createElement('strong');
  heading.textContent=String(title||'');
  Object.assign(heading.style,{display:'block',fontSize:'14px',lineHeight:'1.35',fontWeight:'800',color:'#fff'});
  const detail=document.createElement('span');
  detail.textContent=String(subtitle||'');
  Object.assign(detail.style,{display:'block',marginTop:'5px',fontSize:'10px',lineHeight:'1.45',fontWeight:'600',color:'rgba(247,255,255,.72)'});
  statusBox.append(heading,detail);
  statusBox.style.borderColor=accent;
  statusBox.style.opacity='1';
  statusBox.style.transform='translateY(0)';
  if(statusBox._hubTimer)clearTimeout(statusBox._hubTimer);
  if(timeout)statusBox._hubTimer=setTimeout(()=>{
    if(statusBox){
      statusBox.style.opacity='0';
      statusBox.style.transform='translateY(8px)';
    }
  },timeout);
}

async function getNotifiedKeys(){
  try{
    const data=await chrome.storage.local.get({ownHubNotifications:[]});
    return Array.isArray(data.ownHubNotifications)?data.ownHubNotifications:[];
  }catch(_){return[];}
}
async function setNotifiedKey(key){
  try{
    const list=await getNotifiedKeys();
    const next=[...new Set([...list,key])];
    await chrome.storage.local.set({ownHubNotifications:next.slice(-60)});
  }catch(_){}
}
async function showOwnVerified(code,name){
  const key=`verify:${code}`;
  const notified=await getNotifiedKeys();
  if(notified.includes(key))return;
  await setNotifiedKey(key);
  const copy=COPY[uiLanguage]||COPY.en;
  toast(copy.title(String(name||'')),copy.subtitle,'#55e6b1',15000);
}
async function showOwnRename(code,fromName,toName){
  const from=String(fromName||'').trim(),to=String(toName||'').trim();
  if(!from||!to||from===to)return;
  const key=`rename:${code}:${from}>${to}`;
  const notified=await getNotifiedKeys();
  if(notified.includes(key))return;
  await setNotifiedKey(key);
  const copy=COPY[uiLanguage]||COPY.en;
  toast(copy.renameTitle(from,to),copy.renameSubtitle,'#f4bd4f',15000);
}
async function checkOwnCode(code){
  const watcher=ownWatchers.get(code);
  const response=await chrome.runtime.sendMessage({type:'BLOXD_REGISTRATION_CODE',code}).catch(()=>null);
  if(!watcher||!response?.ok)return false;
  if(watcher.initialLinked===null)watcher.initialLinked=Boolean(response.linked);
  if(response.linked===true){
    if(watcher.initialLinked===false)await showOwnVerified(code,response.playerName||null);
    return true;
  }
  return false;
}
async function watchOwnCode(code){
  if(!code)return false;
  if(ownWatchers.has(code))return false;
  const watcher={timer:null,initialLinked:null};
  ownWatchers.set(code,watcher);
  const firstDone=await checkOwnCode(code);
  if(firstDone){ownWatchers.delete(code);return true;}
  let attempts=1;
  watcher.timer=setInterval(async()=>{
    attempts+=1;
    const done=await checkOwnCode(code);
    if(done||attempts>=180){
      const current=ownWatchers.get(code);
      if(current?.timer)clearInterval(current.timer);
      ownWatchers.delete(code);
    }
  },2000);
  return false;
}

function extractMarkerRuns(text){
  const out=[];
  let from=0;
  const source=String(text||'');
  while(true){
    const start=source.indexOf(TECH_START,from);
    if(start<0)break;
    let end=source.length;
    const next=source.indexOf(TECH_START,start+TECH_START.length);
    if(next>=0)end=Math.min(end,next);
    const newline=source.indexOf('\n',start);
    if(newline>=0)end=Math.min(end,newline);
    let raw=source.slice(start,end).trim();
    const ws=raw.search(/\s/);
    if(ws>0)raw=raw.slice(0,ws);
    if(raw.length>=12&&raw.length<=7000)out.push(raw);
    from=start+TECH_START.length;
  }
  return out;
}
function extractRegself(text){
  for(const raw of extractMarkerRuns(text)){
    if(!raw.startsWith(REGSELF_START))continue;
    const parts=raw.split('|');
    if(parts.length!==5)continue;
    const code=String(parts[4]||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(/^[A-Z0-9]{8}$/.test(code))return{code};
  }
  return null;
}
function extractRegasserts(text){return extractMarkerRuns(text).filter(raw=>raw.startsWith(REGASSERT_START));}
function extractLiveMarkers(text){
  const out=[];
  for(const raw of extractMarkerRuns(text)){
    const p=raw.split('|');
    if(p[0]==='__SG_EVT__'&&LIVE_TYPES.has(String(p[1]||''))&&raw.includes('|SIG='))out.push(raw);
  }
  return out;
}
function hasTechnicalMarker(text){return String(text||'').includes(TECH_START);}
function withoutTechnicalMarkers(text){
  return String(text||'').replace(/__SG_EVT__\|[^\s]+/g,'').replaceAll(TECH_CARRIER,'').replace(/[\u200b-\u200d\ufeff]/g,'').trim();
}
function hideTechnicalTextNode(textNode){
  if(!textNode||textNode.nodeType!==Node.TEXT_NODE||!hasTechnicalMarker(textNode.textContent))return;
  let el=textNode.parentElement,best=el,depth=0;
  while(el&&depth<10&&el!==document.body&&el!==document.documentElement){
    const own=String(el.textContent||'');
    if(!hasTechnicalMarker(own)||withoutTechnicalMarkers(own)!=='')break;
    best=el;el=el.parentElement;depth+=1;
  }
  if(best&&best.style){
    best.style.setProperty('display','none','important');
    best.style.setProperty('visibility','hidden','important');
    best.style.setProperty('height','0','important');
    best.style.setProperty('min-height','0','important');
    best.style.setProperty('margin','0','important');
    best.style.setProperty('padding','0','important');
    best.setAttribute('data-hub-verify-technical','1');
  }
}
function hideTechnicalMessages(root){
  try{
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){hideTechnicalTextNode(root);return;}
    if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let n,count=0;
    while((n=walker.nextNode())&&count<5000){
      if(hasTechnicalMarker(n.textContent))hideTechnicalTextNode(n);
      count+=1;
    }
  }catch(_){}
}

async function processText(value){
  const text=String(value||'');
  if(!text||text.length>70000)return;

  const self=extractRegself(text);
  if(self?.code)await watchOwnCode(self.code);
  for(const pattern of SHORT_CODE_PATTERNS){
    pattern.lastIndex=0;
    let match;
    while((match=pattern.exec(text)))await watchOwnCode(String(match[1]||'').toUpperCase());
  }

  const textKey=hash(text);
  if(seenText.has(textKey))return;
  seenText.add(textKey);
  if(seenText.size>2400)seenText.clear();

  for(const raw of extractRegasserts(text)){
    const key=hash(raw);
    if(seenAssertions.has(key))continue;
    seenAssertions.add(key);
    if(seenAssertions.size>1200)seenAssertions.clear();

    const response=await chrome.runtime.sendMessage({type:'BLOXD_GLOBAL_REGASSERT',raw}).catch(()=>null);
    if(response?.notifySelf){
      const parts=String(raw).split('|');
      const code=parts.length===8?String(parts[5]||'').toUpperCase():'';
      if(response.notificationType==='rename'){
        await showOwnRename(code,response.renameFrom,response.renameTo);
      }else if(response.notificationType==='verified'){
        await showOwnVerified(code,response.verifiedPlayerName||null);
      }
      const watcher=ownWatchers.get(code);
      if(watcher?.timer)clearInterval(watcher.timer);
      ownWatchers.delete(code);
    }
  }

  for(const raw of extractLiveMarkers(text)){
    const key=hash(raw);
    if(seenLive.has(key))continue;
    seenLive.add(key);
    if(seenLive.size>3000)seenLive.clear();
    chrome.runtime.sendMessage({type:'BLOXD_LIVE_MARKER',raw}).catch(()=>null);
  }
}
function inspect(node){
  if(!node)return;
  if(node.nodeType===Node.TEXT_NODE){
    const text=String(node.textContent||'');
    if(hasTechnicalMarker(text)){processText(text);hideTechnicalMessages(node);}
    else if(/HUB\s*(Registrierungscode|Registration\s*code|Code)\s*:/i.test(text))processText(text);
    return;
  }
  if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE&&node.nodeType!==Node.DOCUMENT_NODE)return;
  const text=String(node.textContent||'');
  if(hasTechnicalMarker(text)){processText(text);hideTechnicalMessages(node);}
  else if(/HUB\s*(Registrierungscode|Registration\s*code|Code)\s*:/i.test(text))processText(text);
}
function scanExisting(){
  try{
    if(!document.body)return;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n,count=0;
    while((n=walker.nextNode())&&count<12000){
      const text=String(n.textContent||'');
      if(hasTechnicalMarker(text)){processText(text);hideTechnicalTextNode(n);}
      else if(/HUB\s*(Registrierungscode|Registration\s*code|Code)\s*:/i.test(text))processText(text);
      count++;
    }
  }catch(_){}
}
function attachObserver(){
  if(observer||!document.documentElement)return;
  observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData')inspect(mutation.target);
      for(const node of mutation.addedNodes)inspect(node);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
}
async function boot(){
  await loadLanguage();
  attachObserver();
  await chrome.runtime.sendMessage({type:'BLOXD_EXTENSION_READY',url:location.href}).catch(()=>null);
  if(window.top===window&&!heartbeatTimer){
    heartbeatTimer=setInterval(()=>{
      chrome.runtime.sendMessage({type:'BLOXD_EXTENSION_HEARTBEAT',url:location.href}).catch(()=>null);
    },30000);
  }
  scanExisting();
  let scans=0;
  scanTimer=setInterval(()=>{
    scanExisting();
    scans++;
    if(scans>=12){clearInterval(scanTimer);scanTimer=null;}
  },750);
}
chrome.storage?.onChanged?.addListener((changes,area)=>{
  if(area==='local'&&changes.hubLanguage){
    const next=changes.hubLanguage.newValue;
    uiLanguage=['en','de','fr'].includes(next)?next:DEFAULT_LANGUAGE;
  }
});
if(document.documentElement)boot();
else document.addEventListener('readystatechange',()=>{if(document.documentElement&&!observer)boot();});
