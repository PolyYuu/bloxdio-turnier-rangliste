'use strict';

const HUB_URL='https://bloxdio-turnier-rangliste.vercel.app/pending.html';
const BLOXD_URL='https://bloxd.io/play/classic_playerSchematic%7CHT_Y95VcEQaUBLbTc24H7?lobby=1';
const MAX_RECENT=40;
const DEFAULT_STATE={
  bloxdSeenAt:0,
  totalAssertionsObserved:0,
  recentAssertions:[],
  latestRegistrationCode:null,
  relayMode:'global-observer',
  uploadEnabled:false
};

async function getState(){return{...DEFAULT_STATE,...await chrome.storage.local.get(DEFAULT_STATE)};}
async function setState(patch){await chrome.storage.local.set(patch);return getState();}
function cleanCode(value){const code=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-Z0-9]{8}$/.test(code)?code:'';}
function cleanRaw(value){const raw=String(value||'').trim();if(!raw.startsWith('__SG_EVT__|REGASSERT|')||raw.length>4000)return'';return raw;}
function rawKey(raw){let h=2166136261;for(let i=0;i<raw.length;i+=1)h=Math.imul(h^raw.charCodeAt(i),16777619);return String(h>>>0);}
async function badge(){const state=await getState();const active=Date.now()-Number(state.bloxdSeenAt||0)<120000;const text=active?'ON':'';await chrome.action.setBadgeText({text});if(text)await chrome.action.setBadgeBackgroundColor({color:'#55e6b1'});}

chrome.runtime.onInstalled.addListener(async()=>{const old=await chrome.storage.local.get(null);await chrome.storage.local.set({...DEFAULT_STATE,totalAssertionsObserved:Number(old.totalAssertionsObserved||0),recentAssertions:Array.isArray(old.recentAssertions)?old.recentAssertions.slice(0,MAX_RECENT):[]});await badge();});
chrome.runtime.onStartup.addListener(badge);

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  (async()=>{
    const type=String(message?.type||'');
    if(type==='BLOXD_EXTENSION_READY'){
      const state=await setState({bloxdSeenAt:Date.now(),relayMode:'global-observer'});await badge();sendResponse({ok:true,state});return;
    }
    if(type==='BLOXD_GLOBAL_REGASSERT'){
      const raw=cleanRaw(message.raw);if(!raw){sendResponse({ok:false,error:'invalid_regassert'});return;}
      const state=await getState();const key=rawKey(raw);const recent=Array.isArray(state.recentAssertions)?state.recentAssertions:[];
      const already=recent.some((x)=>x&&x.key===key);
      let total=Number(state.totalAssertionsObserved||0);
      let next=recent;
      if(!already){total+=1;next=[{key,raw,seenAt:Date.now(),frameUrl:String(sender?.url||'').slice(0,500)},...recent].slice(0,MAX_RECENT);}
      const updated=await setState({bloxdSeenAt:Date.now(),totalAssertionsObserved:total,recentAssertions:next});await badge();
      // v0.3 intentionally observes only. Publicly distributed extensions must
      // never contain the production x-sg-relay-key.
      sendResponse({ok:true,duplicate:already,totalObserved:updated.totalAssertionsObserved,uploadEnabled:false});return;
    }
    if(type==='BLOXD_REGISTRATION_CODE'){
      const code=cleanCode(message.code);if(!code){sendResponse({ok:false,error:'invalid_code'});return;}
      const state=await setState({bloxdSeenAt:Date.now(),latestRegistrationCode:{code,seenAt:Date.now()}});await badge();sendResponse({ok:true,state});return;
    }
    if(type==='HUB_EXTENSION_GET_STATE'){sendResponse({ok:true,version:chrome.runtime.getManifest().version,state:await getState()});return;}
    if(type==='HUB_EXTENSION_CLEAR'){const state=await setState({totalAssertionsObserved:0,recentAssertions:[],latestRegistrationCode:null});sendResponse({ok:true,state});return;}
    if(type==='OPEN_HUB'){await chrome.tabs.create({url:HUB_URL});sendResponse({ok:true});return;}
    if(type==='OPEN_BLOXD'){await chrome.tabs.create({url:BLOXD_URL});sendResponse({ok:true});return;}
    sendResponse({ok:false,error:'unknown_message'});
  })().catch((error)=>{console.error('[HUB Verify Global Relay]',error);try{sendResponse({ok:false,error:String(error?.message||error)});}catch(_){}});
  return true;
});
