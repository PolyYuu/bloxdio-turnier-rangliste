'use strict';

const HUB_URL = 'https://bloxdio-turnier-rangliste.vercel.app/pending.html';
const BLOXD_URL = 'https://bloxd.io/play/classic_playerSchematic%7CHT_Y95VcEQaUBLbTc24H7?lobby=1';
const MAX_PAIR_AGE_MS = 15 * 60 * 1000;
const DEFAULT_STATE = {hubSeenAt:0,bloxdSeenAt:0,pairing:null,latestRegistrationCode:null,latestIdentity:null,latestSignedProof:null,latestDiagnostic:null};

async function getState(){const stored=await chrome.storage.local.get(DEFAULT_STATE);const state={...DEFAULT_STATE,...stored};if(state.pairing&&Date.now()-Number(state.pairing.startedAt||0)>MAX_PAIR_AGE_MS){state.pairing=null;await chrome.storage.local.set({pairing:null});}return state;}
async function setState(patch){await chrome.storage.local.set(patch);return getState();}
function cleanShortCode(value){const code=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-Z0-9]{8}$/.test(code)?code:'';}
function cleanPairId(value){const pairId=String(value||'').trim();return /^[A-Za-z0-9_-]{12,96}$/.test(pairId)?pairId:'';}
function cleanIdentity(identity){if(!identity||typeof identity!=='object')return null;const dbId=String(identity.dbId||'').trim().slice(0,180);const name=String(identity.name||'').trim().slice(0,64);const code=cleanShortCode(identity.code);const ts=Number(identity.ts||Date.now());if(!dbId||!name||!Number.isFinite(ts))return null;return{dbId,name,code:code||null,ts};}
function cleanSignedProof(token){const value=String(token||'').trim();return /^SGR1\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/.test(value)?value:'';}
async function broadcastToHub(message){const tabs=await chrome.tabs.query({url:'https://bloxdio-turnier-rangliste.vercel.app/*'});await Promise.allSettled(tabs.map((tab)=>tab.id?chrome.tabs.sendMessage(tab.id,message):Promise.resolve()));}
async function updateBadge(){const state=await getState();let text='';if(state.latestSignedProof||state.latestIdentity)text='ID';else if(state.pairing)text='ON';await chrome.action.setBadgeText({text});if(text)await chrome.action.setBadgeBackgroundColor({color:'#36dbe1'});}
chrome.runtime.onInstalled.addListener(async()=>{await chrome.storage.local.set(DEFAULT_STATE);await updateBadge();});

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  (async()=>{
    const type=String(message?.type||'');
    if(type==='HUB_EXTENSION_PING'){const state=await setState({hubSeenAt:Date.now()});sendResponse({ok:true,version:chrome.runtime.getManifest().version,state});return;}
    if(type==='HUB_EXTENSION_START'){const pendingCode=cleanShortCode(message.pendingCode);const pairId=cleanPairId(message.pairId)||crypto.randomUUID().replace(/-/g,'');const pairing={pairId,pendingCode:pendingCode||null,startedAt:Date.now()};const state=await setState({pairing,latestIdentity:null,latestSignedProof:null,latestDiagnostic:null});await updateBadge();if(message.openBloxd!==false)await chrome.tabs.create({url:BLOXD_URL});sendResponse({ok:true,pairing,state});return;}
    if(type==='HUB_EXTENSION_CLEAR'){const state=await setState({pairing:null,latestRegistrationCode:null,latestIdentity:null,latestSignedProof:null,latestDiagnostic:null});await updateBadge();sendResponse({ok:true,state});return;}
    if(type==='HUB_EXTENSION_GET_STATE'){sendResponse({ok:true,version:chrome.runtime.getManifest().version,state:await getState()});return;}
    if(type==='BLOXD_EXTENSION_READY'){const state=await setState({bloxdSeenAt:Date.now()});sendResponse({ok:true,state});return;}
    if(type==='BLOXD_REGISTRATION_CODE'){const code=cleanShortCode(message.code);if(!code){sendResponse({ok:false,error:'invalid_code'});return;}const state=await setState({latestRegistrationCode:{code,seenAt:Date.now()}});await broadcastToHub({type:'EXTENSION_REGISTRATION_CODE',code,seenAt:Date.now()});sendResponse({ok:true,state});return;}
    if(type==='BLOXD_SIGNED_PROOF'){const token=cleanSignedProof(message.token);if(!token){sendResponse({ok:false,error:'invalid_signed_proof'});return;}const payload={token,seenAt:Date.now()};const state=await setState({latestSignedProof:payload});await updateBadge();await broadcastToHub({type:'EXTENSION_SIGNED_PROOF',token,seenAt:payload.seenAt});sendResponse({ok:true,state});return;}
    if(type==='BLOXD_IDENTITY_MARKER'){const identity=cleanIdentity(message.identity);if(!identity){sendResponse({ok:false,error:'invalid_identity'});return;}const state=await getState();if(state.pairing?.pendingCode&&identity.code&&state.pairing.pendingCode!==identity.code){sendResponse({ok:false,error:'code_mismatch'});return;}const payload={...identity,pairId:state.pairing?.pairId||null,source:'world-code-marker',seenAt:Date.now()};const next=await setState({latestIdentity:payload});await updateBadge();await broadcastToHub({type:'EXTENSION_IDENTITY',identity:payload});sendResponse({ok:true,state:next});return;}
    if(type==='BLOXD_DIAGNOSTIC'){const diagnostic={foundMarker:Boolean(message.foundMarker),foundRegistrationCode:Boolean(message.foundRegistrationCode),candidateKeys:Array.isArray(message.candidateKeys)?message.candidateKeys.slice(0,30):[],frameUrl:String(sender?.url||'').slice(0,500),seenAt:Date.now()};const state=await setState({latestDiagnostic:diagnostic});await broadcastToHub({type:'EXTENSION_DIAGNOSTIC',diagnostic});sendResponse({ok:true,state});return;}
    if(type==='OPEN_HUB'){await chrome.tabs.create({url:HUB_URL});sendResponse({ok:true});return;}
    if(type==='OPEN_BLOXD'){await chrome.tabs.create({url:BLOXD_URL});sendResponse({ok:true});return;}
    sendResponse({ok:false,error:'unknown_message'});
  })().catch((error)=>{console.error('[HUB Verify]',error);try{sendResponse({ok:false,error:String(error?.message||error)});}catch(_){}});
  return true;
});
