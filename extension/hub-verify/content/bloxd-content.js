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

function hash(text){let h=2166136261;for(let i=0;i<text.length;i+=1)h=Math.imul(h^text.charCodeAt(i),16777619);return String(h>>>0);}
function ensureStatus(){if(statusBox||window.top!==window)return;statusBox=document.createElement('div');statusBox.id='hub-verify-extension-status';Object.assign(statusBox.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483647',padding:'11px 14px',border:'1px solid rgba(85,230,177,.62)',borderRadius:'10px',background:'rgba(7,4,13,.94)',color:'#f7ffff',font:'700 11px/1.4 Arial,sans-serif',boxShadow:'0 10px 32px rgba(0,0,0,.35)',pointerEvents:'none',opacity:'0',transform:'translateY(6px)',transition:'opacity .18s ease, transform .18s ease',whiteSpace:'pre-line',maxWidth:'330px'});document.documentElement.appendChild(statusBox);}
function toast(text,accent='#55e6b1',timeout=6500){ensureStatus();if(!statusBox)return;statusBox.textContent=text;statusBox.style.borderColor=accent;statusBox.style.opacity='1';statusBox.style.transform='translateY(0)';if(timeout)setTimeout(()=>{if(statusBox){statusBox.style.opacity='0';statusBox.style.transform='translateY(6px)';}},timeout);}

function hideTechnicalMarker(node){
  try{
    let el=node?.nodeType===Node.TEXT_NODE?node.parentElement:node;
    if(!el||el.nodeType!==Node.ELEMENT_NODE)return;
    for(let depth=0;depth<4&&el;depth++,el=el.parentElement){
      const text=String(el.textContent||'').trim();
      if(text.includes(REGASSERT_START)&&text.length<5000){
        el.style.setProperty('display','none','important');
        el.setAttribute('data-hub-verify-hidden','1');
        return;
      }
      if(text.length>5000)break;
    }
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
  if(text.includes(REGASSERT_START))hideTechnicalMarker(node);

  const textKey=hash(text);if(seenText.has(textKey))return;seenText.add(textKey);if(seenText.size>1800)seenText.clear();

  const assertions=extractRegasserts(text);
  for(const raw of assertions){
    const key=hash(raw);if(seenAssertions.has(key))continue;seenAssertions.add(key);if(seenAssertions.size>800)seenAssertions.clear();
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
  if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  processText(node.textContent||'',node);
}

async function init(){
  await chrome.runtime.sendMessage({type:'BLOXD_EXTENSION_READY',url:location.href}).catch(()=>null);
  const observer=new MutationObserver((mutations)=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData')inspect(mutation.target);
      for(const node of mutation.addedNodes)inspect(node);
    }
  });
  if(document.body)observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
