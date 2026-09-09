'use strict';

const SHORT_CODE_PATTERNS = [
  /HUB\s*Registrierungscode\s*:\s*([A-Z0-9]{8})/i,
  /HUB\s*Registration\s*code\s*:\s*([A-Z0-9]{8})/i,
  /HUB\s*Code\s*:\s*([A-Z0-9]{8})/i
];
const IDENTITY_PATTERNS = [
  /__HUB_VERIFY__\|db=([^|\s]+)\|name=([^|\n]+)\|code=([A-Z0-9]{8})\|ts=(\d+)/i,
  /__HUB_VERIFY__\|code=([A-Z0-9]{8})\|db=([^|\s]+)\|name=([^|\n]+)\|ts=(\d+)/i
];
const SGR1_PATTERN = /SGR1\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const seen = new Set();
let statusBox = null;
let lastDiagnosticAt = 0;

function textHash(text){let h=2166136261;for(let i=0;i<text.length;i+=1)h=Math.imul(h^text.charCodeAt(i),16777619);return String(h>>>0);}
function ensureStatusBox(){if(statusBox||window.top!==window)return;statusBox=document.createElement('div');statusBox.id='hub-verify-extension-status';Object.assign(statusBox.style,{position:'fixed',right:'14px',bottom:'14px',zIndex:'2147483647',padding:'9px 12px',border:'1px solid rgba(54,219,225,.55)',borderRadius:'10px',background:'rgba(7,4,13,.92)',color:'#eaffff',font:'700 11px/1.35 Arial,sans-serif',boxShadow:'0 10px 32px rgba(0,0,0,.35)',pointerEvents:'none',opacity:'0',transform:'translateY(6px)',transition:'opacity .18s ease, transform .18s ease'});document.documentElement.appendChild(statusBox);}
function showStatus(text,accent='#36dbe1',timeout=4000){ensureStatusBox();if(!statusBox)return;statusBox.textContent=text;statusBox.style.borderColor=accent;statusBox.style.opacity='1';statusBox.style.transform='translateY(0)';if(timeout)setTimeout(()=>{if(!statusBox)return;statusBox.style.opacity='0';statusBox.style.transform='translateY(6px)';},timeout);}
function parseIdentity(text){const first=text.match(IDENTITY_PATTERNS[0]);if(first)return{dbId:first[1],name:first[2].trim(),code:first[3].toUpperCase(),ts:Number(first[4])};const second=text.match(IDENTITY_PATTERNS[1]);if(second)return{code:second[1].toUpperCase(),dbId:second[2],name:second[3].trim(),ts:Number(second[4])};return null;}
function parseRegistrationCode(text){for(const pattern of SHORT_CODE_PATTERNS){const match=text.match(pattern);if(match)return match[1].toUpperCase();}return'';}
function parseSignedProof(text){SGR1_PATTERN.lastIndex=0;const match=SGR1_PATTERN.exec(text);return match?match[0]:'';}

async function processText(text){
  const compact=String(text||'').trim();
  if(!compact||compact.length>20000)return;
  const key=textHash(compact);
  if(seen.has(key))return;
  seen.add(key);
  if(seen.size>1000)seen.clear();

  const signedProof=parseSignedProof(compact);
  if(signedProof){
    const response=await chrome.runtime.sendMessage({type:'BLOXD_SIGNED_PROOF',token:signedProof}).catch(()=>null);
    if(response?.ok)showStatus('HUB VERIFY · Sicherer Nachweis erkannt','#55e6b1',6500);
  }

  const identity=parseIdentity(compact);
  if(identity){
    const response=await chrome.runtime.sendMessage({type:'BLOXD_IDENTITY_MARKER',identity}).catch(()=>null);
    if(response?.ok)showStatus(`HUB VERIFY · ${identity.name} erkannt`,'#55e6b1',6500);
    return;
  }

  const code=parseRegistrationCode(compact);
  if(code){
    const response=await chrome.runtime.sendMessage({type:'BLOXD_REGISTRATION_CODE',code}).catch(()=>null);
    if(response?.ok)showStatus(`HUB VERIFY · Code ${code} erkannt`,'#36dbe1',5500);
  }
}

function inspectNode(node){if(!node)return;if(node.nodeType===Node.TEXT_NODE){processText(node.textContent||'');return;}if(node.nodeType!==Node.ELEMENT_NODE&&node.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;processText(node.textContent||'');}
function collectSafeCandidateKeys(){const keys=new Set();const add=(storage,prefix)=>{try{for(let i=0;i<storage.length;i+=1){const key=String(storage.key(i)||'');if(/player.*db|db.*id|player.*id|username|player.*name/i.test(key))keys.add(`${prefix}:${key}`.slice(0,120));}}catch(_){}};add(localStorage,'local');add(sessionStorage,'session');return[...keys].slice(0,30);}
async function sendDiagnostic(){if(Date.now()-lastDiagnosticAt<4000)return;lastDiagnosticAt=Date.now();await chrome.runtime.sendMessage({type:'BLOXD_DIAGNOSTIC',foundMarker:false,foundRegistrationCode:false,candidateKeys:collectSafeCandidateKeys()}).catch(()=>null);}
async function init(){const response=await chrome.runtime.sendMessage({type:'BLOXD_EXTENSION_READY'}).catch(()=>null);if(response?.state?.pairing)showStatus('HUB VERIFY · Bloxd verbunden','#36dbe1',5000);inspectNode(document.body);const observer=new MutationObserver((mutations)=>{for(const mutation of mutations){for(const node of mutation.addedNodes)inspectNode(node);if(mutation.type==='characterData')inspectNode(mutation.target);}});if(document.body)observer.observe(document.body,{childList:true,subtree:true,characterData:true});sendDiagnostic();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
