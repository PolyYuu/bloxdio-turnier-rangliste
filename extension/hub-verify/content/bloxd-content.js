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
function ensureStatus(){if(statusBox||window.top!==window)return;statusBox=document.createElement('div');statusBox.id='hub-verify-extension-status';Object.assign(statusBox.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483647',padding:'9px 12px',border:'1px solid rgba(54,219,225,.55)',borderRadius:'10px',background:'rgba(7,4,13,.92)',color:'#eaffff',font:'700 11px/1.35 Arial,sans-serif',boxShadow:'0 10px 32px rgba(0,0,0,.35)',pointerEvents:'none',opacity:'0',transform:'translateY(6px)',transition:'opacity .18s ease, transform .18s ease'});document.documentElement.appendChild(statusBox);}
function toast(text,accent='#36dbe1',timeout=3800){ensureStatus();if(!statusBox)return;statusBox.textContent=text;statusBox.style.borderColor=accent;statusBox.style.opacity='1';statusBox.style.transform='translateY(0)';if(timeout)setTimeout(()=>{if(statusBox){statusBox.style.opacity='0';statusBox.style.transform='translateY(6px)';}},timeout);}

function extractRegasserts(text){
  const out=[];
  let from=0;
  while(true){
    const start=text.indexOf(REGASSERT_START,from);
    if(start<0)break;
    let end=text.length;
    const next=text.indexOf('__SG_EVT__|',start+REGASSERT_START.length);
    if(next>=0)end=Math.min(end,next);
    const newline=text.indexOf('\n',start);
    if(newline>=0)end=Math.min(end,newline);
    let raw=text.slice(start,end).trim();
    const ws=raw.search(/\s/);
    if(ws>0)raw=raw.slice(0,ws);
    if(raw.length>=REGASSERT_START.length+10&&raw.length<=4000)out.push(raw);
    from=start+REGASSERT_START.length;
  }
  return out;
}

async function processText(value){
  const text=String(value||'');
  if(!text||text.length>50000)return;
  const textKey=hash(text);
  if(seenText.has(textKey))return;
  seenText.add(textKey);
  if(seenText.size>1800)seenText.clear();

  const assertions=extractRegasserts(text);
  for(const raw of assertions){
    const key=hash(raw);
    if(seenAssertions.has(key))continue;
    seenAssertions.add(key);
    if(seenAssertions.size>800)seenAssertions.clear();
    const response=await chrome.runtime.sendMessage({type:'BLOXD_GLOBAL_REGASSERT',raw}).catch(()=>null);
    if(response?.ok)toast(`HUB RELAY · REGASSERT #${response.totalObserved} hochgeladen`,'#55e6b1',3000);
    else if(response?.error)toast(`HUB RELAY · Uploadfehler: ${response.error}`,'#ff6b6b',5000);
  }

  for(const pattern of SHORT_CODE_PATTERNS){
    pattern.lastIndex=0;
    let match;
    while((match=pattern.exec(text))){
      const code=String(match[1]||'').toUpperCase();
      const response=await chrome.runtime.sendMessage({type:'BLOXD_REGISTRATION_CODE',code}).catch(()=>null);
      if(response?.ok)toast(`HUB RELAY · Code ${code} erkannt`,'#36dbe1',3000);
    }
  }
}

function inspect(node){
  if(!node)return;
  if(node.nodeType===Node.TEXT_NODE){processText(node.textContent||'');return;}
  if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  processText(node.textContent||'');
}

async function init(){
  await chrome.runtime.sendMessage({type:'BLOXD_EXTENSION_READY',url:location.href}).catch(()=>null);
  if(window.top===window)toast('HUB RELAY · GLOBAL BRIDGE AKTIV','#55e6b1',4500);
  inspect(document.body);
  const observer=new MutationObserver((mutations)=>{
    for(const mutation of mutations){
      if(mutation.type==='characterData')inspect(mutation.target);
      for(const node of mutation.addedNodes)inspect(node);
    }
  });
  if(document.body)observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
