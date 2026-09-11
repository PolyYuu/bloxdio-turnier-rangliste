'use strict';

const HUB_URL='https://bloxdio-turnier-rangliste.vercel.app/pending.html';
const BLOXD_URL='https://bloxd.io/play/classic_playerSchematic%7CHT_Y95VcEQaUBLbTc24H7?lobby=1';
const INGEST_URL='https://nxzrgbpaxukgjyzwupjp.supabase.co/functions/v1/hub-extension-assertion-ingest';
const MAX_RECENT=80;
const DEFAULT_STATE={bloxdSeenAt:0,totalAssertionsObserved:0,totalAssertionsUploaded:0,recentAssertions:[],uploadedKeys:[],latestRegistrationCode:null,latestUpload:null,relayMode:'passive-global-relay',uploadEnabled:true,hubLanguage:'en'};

async function getState(){return{...DEFAULT_STATE,...await chrome.storage.local.get(DEFAULT_STATE)};}
async function setState(patch){await chrome.storage.local.set(patch);return getState();}
function cleanCode(value){const code=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-Z0-9]{8}$/.test(code)?code:'';}
function cleanRaw(value){const raw=String(value||'').trim();if(!raw.startsWith('__SG_EVT__|REGASSERT|')||raw.length>4000)return'';return raw;}
function rawKey(raw){let h=2166136261;for(let i=0;i<raw.length;i+=1)h=Math.imul(h^raw.charCodeAt(i),16777619);return String(h>>>0);}
function rawCode(raw){const p=String(raw||'').split('|');return p.length===8?cleanCode(p[5]):'';}
async function badge(){const state=await getState();const active=Date.now()-Number(state.bloxdSeenAt||0)<120000;const text=active?'ON':'';await chrome.action.setBadgeText({text});if(text)await chrome.action.setBadgeBackgroundColor({color:'#55e6b1'});}
async function post(body){const response=await fetch(INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let data={};try{data=await response.json();}catch(_){}if(!response.ok||!data?.ok)throw new Error(data?.error||`HTTP ${response.status}`);return data;}

chrome.runtime.onInstalled.addListener(async()=>{const old=await chrome.storage.local.get(null);await chrome.storage.local.set({...DEFAULT_STATE,totalAssertionsObserved:Number(old.totalAssertionsObserved||0),totalAssertionsUploaded:Number(old.totalAssertionsUploaded||0),recentAssertions:Array.isArray(old.recentAssertions)?old.recentAssertions.slice(0,MAX_RECENT):[],uploadedKeys:Array.isArray(old.uploadedKeys)?old.uploadedKeys.slice(-500):[],hubLanguage:['en','de','fr'].includes(old.hubLanguage)?old.hubLanguage:'en'});await badge();});
chrome.runtime.onStartup.addListener(badge);

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{(async()=>{const type=String(message?.type||'');
  if(type==='BLOXD_EXTENSION_READY'){const state=await setState({bloxdSeenAt:Date.now(),relayMode:'passive-global-relay',uploadEnabled:true});await badge();sendResponse({ok:true,state});return;}
  if(type==='BLOXD_GLOBAL_REGASSERT'){
    const raw=cleanRaw(message.raw);if(!raw){sendResponse({ok:false,error:'invalid_regassert'});return;}
    const state=await getState(),key=rawKey(raw),code=rawCode(raw),recent=Array.isArray(state.recentAssertions)?state.recentAssertions:[],existing=recent.find(x=>x&&x.key===key);let total=Number(state.totalAssertionsObserved||0),next=recent;if(!existing){total+=1;next=[{key,seenAt:Date.now(),uploadStatus:'pending'},...recent].slice(0,MAX_RECENT);}
    try{const uploadedKeys=Array.isArray(state.uploadedKeys)?state.uploadedKeys:[],known=await post({mode:'status',code});
      if(known.linked===true){const now=Date.now(),updatedKeys=uploadedKeys.includes(key)?uploadedKeys:[...uploadedKeys,key].slice(-500),updatedRecent=next.map(x=>x?.key===key?{...x,uploadStatus:'already-linked',uploadedAt:now}:x),selfCode=cleanCode(state.latestRegistrationCode?.code||''),notifySelf=Boolean(selfCode&&code===selfCode),updated=await setState({bloxdSeenAt:now,totalAssertionsObserved:total,recentAssertions:updatedRecent,uploadedKeys:updatedKeys});await badge();sendResponse({ok:true,silent:!notifySelf,notifySelf,verifiedPlayerName:notifySelf?(known.playerName||null):null,duplicate:true,uploaded:false,totalObserved:updated.totalAssertionsObserved,totalUploaded:Number(updated.totalAssertionsUploaded||0)});return;}
      const result=await post({raw}),now=Date.now(),updatedKeys=uploadedKeys.includes(key)?uploadedKeys:[...uploadedKeys,key].slice(-500),updatedRecent=next.map(x=>x?.key===key?{...x,uploadStatus:'uploaded',uploadedAt:now}:x),uploadedCount=Number(state.totalAssertionsUploaded||0)+1,selfCode=cleanCode(state.latestRegistrationCode?.code||''),notifySelf=Boolean(selfCode&&code===selfCode&&result.playerLinked===true),updated=await setState({bloxdSeenAt:now,totalAssertionsObserved:total,totalAssertionsUploaded:uploadedCount,recentAssertions:updatedRecent,uploadedKeys:updatedKeys,latestUpload:{ok:true,seenAt:now}});await badge();sendResponse({ok:true,silent:!notifySelf,notifySelf,verifiedPlayerName:notifySelf?(result.playerName||null):null,duplicate:Boolean(existing||result.duplicate),totalObserved:updated.totalAssertionsObserved,totalUploaded:updated.totalAssertionsUploaded,uploaded:true});return;
    }catch(error){const now=Date.now(),updatedRecent=next.map(x=>x?.key===key?{...x,uploadStatus:'error',uploadedAt:now}:x),updated=await setState({bloxdSeenAt:now,totalAssertionsObserved:total,recentAssertions:updatedRecent,latestUpload:{ok:false,error:String(error?.message||error),seenAt:now}});await badge();sendResponse({ok:false,silent:true,error:String(error?.message||error),totalObserved:updated.totalAssertionsObserved,uploaded:false});return;}
  }
  if(type==='BLOXD_REGISTRATION_CODE'){const code=cleanCode(message.code);if(!code){sendResponse({ok:false,error:'invalid_code'});return;}const now=Date.now(),state=await setState({bloxdSeenAt:now,latestRegistrationCode:{code,seenAt:now}});await badge();try{const status=await post({mode:'status',code});if(status.linked===true)sendResponse({ok:true,state,notifySelf:true,verifiedPlayerName:status.playerName||null});else sendResponse({ok:true,state,silent:true});}catch(_){sendResponse({ok:true,state,silent:true});}return;}
  if(type==='HUB_EXTENSION_GET_STATE'){sendResponse({ok:true,version:chrome.runtime.getManifest().version,state:await getState()});return;}
  if(type==='HUB_EXTENSION_CLEAR'){const state=await setState({totalAssertionsObserved:0,totalAssertionsUploaded:0,recentAssertions:[],uploadedKeys:[],latestRegistrationCode:null,latestUpload:null});sendResponse({ok:true,state});return;}
  if(type==='OPEN_HUB'){await chrome.tabs.create({url:HUB_URL});sendResponse({ok:true});return;}
  if(type==='OPEN_BLOXD'){await chrome.tabs.create({url:BLOXD_URL});sendResponse({ok:true});return;}
  sendResponse({ok:false,error:'unknown_message'});
})().catch(error=>{console.error('[HUB Verify Passive Relay]',error);try{sendResponse({ok:false,silent:true,error:String(error?.message||error)});}catch(_){}});return true;});
