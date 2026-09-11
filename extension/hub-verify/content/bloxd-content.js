'use strict';

const SHORT_CODE_PATTERNS=[
  /HUB\s*Registrierungscode\s*:\s*([A-Z0-9]{8})/ig,
  /HUB\s*Registration\s*code\s*:\s*([A-Z0-9]{8})/ig,
  /HUB\s*Code\s*:\s*([A-Z0-9]{8})/ig
];
const REGASSERT_START='__SG_EVT__|REGASSERT|';
const seenText=new Set();
const seenAssertions=new Set();
let statusBox=null;
let observer=null;
let scanTimer=null;

function hash(text){let h=2166136261;for(let i=0;i<text.length;i+=1)h=Math.imul(h^text.charCodeAt(i),16777619);return String(h>>>0);}
function ensureStatus(){if(statusBox||window.top!==window||!document.documentElement)return;statusBox=document.createElement('div');statusBox.id='hub-verify-extension-status';Object.assign(statusBox.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483647',padding:'11px 14px',border:'1px solid rgba(85,230,177,.62)',borderRadius:'10px',background:'rgba(7,4,13,.94)',color:'#f7ffff',font:'700 11px/1.4 Arial,sans-serif',boxShadow:'0 10px 32px rgba(0,0,0,.35)',pointerEvents:'none',opacity:'0',transform:'translateY(6px)',transition:'opacity .18s ease, transform .18s ease',whiteSpace:'pre-line',maxWidth:'330px'});document.documentElement.appendChild(statusBox);}
function toast(text,accent='#55e6b1',timeout=6500){ensureStatus();if(!statusBox)return;statusBox.textContent=text;statusBox.style.borderColor=accent;statusBox.style.opacity='1';statusBox.style.transform='translateY(0)';if(timeout)setTimeout(()=>{if(statusBox){statusBox.style.opacity='0';statusBox.style.transform='translateY(6px)';}},timeout);}

function collapseTechnicalRow(node){
  try{
    let el=node?.nodeType===Node.TEXT_NODE?node.parentElement:node;
    if(!el||el.nodeType!==Node.ELEMENT_NODE)return;
    let best=null;
    for(let depth=0;depth<7&&el;depth++,el=el.parentElement){
      const text=String(el.textContent||'').trim();
      if(text.includes(REGASSERT_START)&&text.length<5500){
        best=el;
        const r=el.getBoundingClientRect?.();
        if(r&&r.width>120&&r.height>=8&&r.height<180) break;
      }
      if(text.length>5500)break;
    }
    if(!best)return;
    best.setAttribute('data-hub-verify-hidden','1');
    best.style.setProperty('display','none','important');
    best.style.setProperty('height','0','important');
    best.style.setProperty('min-height','0','important');
    best.style.setProperty('max-height','0','important');
    best.style.setProperty('margin','0','important');
    best.style.setProperty('padding','0','important');
    best.style.setProperty('border','0','important');
    best.style.setProperty('overflow','hidden','important');
  }catch(_){ }
}

function extractRegasserts(text){
  const out=[];let from=0;
  while(true){
    const start=text.indexOf(REGASSERT_START,from);if(start<0)break;
    let end=text.length;
    const next=text.indexOf('__SG_EVT__|',start+REGASSERT_START.length);if(next>=0)end=Math.min(end,next);
    const newline=text.indexOf('\n',start);if(newline>=0)end=Math.min(end,newline);
    let raw=text.slice(start,end).trim();
    const ws=raw.search(/\s/);if(ws>0)raw=raw.slice(0,ws);
    if(raw.length>=REGASSERT_START.length+10&&raw.length<=4000)out.push(raw);
    from=start+REGASSERT_START.length;
  }
  return out;
}

async function processText(value,node){
  const text=String(value||'');if(!text||text.length>50000)return;
  if(text.includes(REGASSERT_START))collapseTechnicalRow(node);

  const textKey=hash(text);if(seenText.has(textKey))return;seenText.add(textKey);if(seenText.size>2400)seenText.clear();

  const assertions=extractRegasserts(text);
  for(const raw of assertions){
    const key=hash(raw);if(seenAssertions.has(key))continue;seenAssertions.add(key);if(seenAssertions.size>1200)seenAssertions.clear();
    const response=await chrome.runtime.sendMessage({type:'BLOXD_GLOBAL_REGASSERT',raw}).catch(()=>null);
    if(response?.notifySelf){
      const name=String(response.verifiedPlayerName||'Dein Spieler');
      toast(`Spieler ${name} ist nun verifiziert\nKehre zurück zur Website, um dein Profil zu sehen.`,'#55e6b1',7000);
    }
  }

  for(const pattern of SHORT_CODE_PATTERNS){
    pattern.lastIndex=0;let match;
    while((match=pattern.exec(text))){
      const code=String(match[1]||'').toUpperCase();
      const response=await chrome.runtime.sendMessage({type:'BLOXD_REGISTRATION_CODE',code}).catch(()=>null);
      if(response?.notifySelf){
        const name=String(response.verifiedPlayerName||'Dein Spieler');
        toast(`Spieler ${name} ist nun verifiziert\nKehre zurück zur Website, um dein Profil zu sehen.`,'#55e6b1',7000);
      }
    }
  }
}

function inspect(node){
  if(!node)return;
  if(node.nodeType===Node.TEXT_NODE){processText(node.textContent||'',node);return;}
  if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE&&node.nodeType!==Node.DOCUMENT_NODE)return;
  const text=String(node.textContent||'');
  if(text.includes(REGASSERT_START)||/HUB\s*(Registrierungscode|Registration\s*code|Code)\s*:/i.test(text))processText(text,node);
}

function scanExisting(){
  try{
    if(!document.body)return;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n,count=0;
    while((n=walker.nextNode())&&count<12000){
      const text=String(n.textContent||'');
      if(text.includes(REGASSERT_START)||/HUB\s*(Registrierungscode|Registration\s*code|Code)\s*:/i.test(text))inspect(n);
      count++;
    }
  }catch(_){ }
}

function attachObserver(){
  if(observer||!document.documentElement)return;
  observer=new MutationObserver((mutations)=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData')inspect(mutation.target);
      for(const node of mutation.addedNodes)inspect(node);
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
}

async function boot(){
  attachObserver();
  await chrome.runtime.sendMessage({type:'BLOXD_EXTENSION_READY',url:location.href}).catch(()=>null);
  scanExisting();
  let scans=0;
  scanTimer=setInterval(()=>{
    scanExisting();
    scans++;
    if(scans>=12){clearInterval(scanTimer);scanTimer=null;}
  },750);
}

if(document.documentElement)boot();
else document.addEventListener('readystatechange',()=>{if(document.documentElement&&!observer)boot();});
