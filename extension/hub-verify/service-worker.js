'use strict';

const HUB_URL='https://bloxdio-turnier-rangliste.vercel.app/pending.html';
const BLOXD_URL='https://bloxd.io/play/classic_playerSchematic%7CHT_Y95VcEQaUBLbTc24H7?lobby=1';
const INGEST_URL='https://nxzrgbpaxukgjyzwupjp.supabase.co/functions/v1/hub-extension-assertion-ingest';
const MAX_RECENT=80;
const DEFAULT_STATE={
  bloxdSeenAt:0,
  bridgeConnectedAt:0,
  totalAssertionsObserved:0,
  totalAssertionsUploaded:0,
  recentAssertions:[],
  uploadedKeys:[],
  ackedDbIds:[],
  latestRegistrationCode:null,
  latestUpload:null,
  relayMode:'global-relay-silent',
  uploadEnabled:true
};

async function getState(){return{...DEFAULT_STATE,...await chrome.storage.local.get(DEFAULT_STATE)};}
async function setState(patch){await chrome.storage.local.set(patch);return getState();}
function cleanCode(value){const code=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-Z0-9]{8}$/.test(code)?code:'';}
function cleanRaw(value){const raw=String(value||'').trim();if(!raw.startsWith('__SG_EVT__|REGASSERT|')||raw.length>4000)return'';return raw;}
function rawKey(raw){let h=2166136261;for(let i=0;i<raw.length;i+=1)h=Math.imul(h^raw.charCodeAt(i),16777619);return String(h>>>0);}
function rawParts(raw){const p=String(raw||'').split('|');return{code:p.length===8?cleanCode(p[5]):'',dbId:p.length===8?decodeURIComponentSafe(p[3]):''};}
function decodeURIComponentSafe(value){try{return decodeURIComponent(String(value||''));}catch(_){return String(value||'');}}
async function badge(){const state=await getState();const active=Date.now()-Number(state.bloxdSeenAt||0)<120000;const text=active?'ON':'';await chrome.action.setBadgeText({text});if(text)await chrome.action.setBadgeBackgroundColor({color:'#55e6b1'});}
async function uploadAssertion(raw){
  const response=await fetch(INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw})});
  let data={};try{data=await response.json();}catch(_){ }
  if(!response.ok||!data?.ok)throw new Error(data?.error||`HTTP ${response.status}`);
  return data;
}

chrome.runtime.onInstalled.addListener(async()=>{
  const old=await chrome.storage.local.get(null);
  await chrome.storage.local.set({
    ...DEFAULT_STATE,
    totalAssertionsObserved:Number(old.totalAssertionsObserved||0),
    totalAssertionsUploaded:Number(old.totalAssertionsUploaded||0),
    recentAssertions:Array.isArray(old.recentAssertions)?old.recentAssertions.slice(0,MAX_RECENT):[],
    uploadedKeys:Array.isArray(old.uploadedKeys)?old.uploadedKeys.slice(-500):[],
    ackedDbIds:Array.isArray(old.ackedDbIds)?old.ackedDbIds.slice(-500):[]
  });
  await badge();
});
chrome.runtime.onStartup.addListener(badge);

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  (async()=>{
    const type=String(message?.type||'');
    if(type==='BLOXD_EXTENSION_READY'){
      const state=await setState({bloxdSeenAt:Date.now(),relayMode:'global-relay-silent',uploadEnabled:true});await badge();sendResponse({ok:true,state});return;
    }
    if(type==='BLOXD_BRIDGE_ACK'){
      const state=await setState({bloxdSeenAt:Date.now(),bridgeConnectedAt:Date.now()});await badge();sendResponse({ok:true,state});return;
    }
    if(type==='BLOXD_GLOBAL_REGASSERT'){
      const raw=cleanRaw(message.raw);if(!raw){sendResponse({ok:false,error:'invalid_regassert'});return;}
      const state=await getState();
      const key=rawKey(raw),parts=rawParts(raw),code=parts.code,dbId=parts.dbId;
      const uploadedKeys=Array.isArray(state.uploadedKeys)?state.uploadedKeys:[];
      const ackedDbIds=Array.isArray(state.ackedDbIds)?state.ackedDbIds:[];
      const recent=Array.isArray(state.recentAssertions)?state.recentAssertions:[];
      const existing=recent.find((x)=>x&&x.key===key);
      let total=Number(state.totalAssertionsObserved||0);
      let next=recent;
      if(!existing){total+=1;next=[{key,seenAt:Date.now(),uploadStatus:'pending'},...recent].slice(0,MAX_RECENT);}

      if(dbId&&ackedDbIds.includes(dbId)){
        sendResponse({ok:true,silent:true,duplicate:true,uploaded:true,totalObserved:total,totalUploaded:Number(state.totalAssertionsUploaded||0)});
        return;
      }

      try{
        const result=await uploadAssertion(raw);
        const now=Date.now();
        const wasUploaded=uploadedKeys.includes(key);
        const updatedKeys=wasUploaded?uploadedKeys:[...uploadedKeys,key].slice(-500);
        let updatedAcked=ackedDbIds;
        const shouldAck=Boolean(result.playerLinked&&dbId&&!ackedDbIds.includes(dbId));
        if(shouldAck)updatedAcked=[...ackedDbIds,dbId].slice(-500);
        const updatedRecent=next.map((x)=>x?.key===key?{...x,uploadStatus:'uploaded',uploadedAt:now,pendingVerification:result.pendingVerification||null}:x);
        const uploadedCount=Number(state.totalAssertionsUploaded||0)+(wasUploaded?0:1);
        const latestRegistration=state.latestRegistrationCode;
        const selfCode=cleanCode(latestRegistration?.code||'');
        const selfFresh=Number(latestRegistration?.seenAt||0)>now-120000;
        const notifySelf=Boolean(selfFresh&&selfCode&&code===selfCode&&result.pendingVerification==='verified');
        const updated=await setState({
          bloxdSeenAt:now,
          totalAssertionsObserved:total,
          totalAssertionsUploaded:uploadedCount,
          recentAssertions:updatedRecent,
          uploadedKeys:updatedKeys,
          ackedDbIds:updatedAcked,
          latestUpload:{ok:true,pendingVerification:result.pendingVerification||null,seenAt:now}
        });
        await badge();
        sendResponse({
          ok:true,
          silent:!notifySelf,
          notifySelf,
          verifiedPlayerName:notifySelf?(result.playerName||null):null,
          ackDbId:shouldAck?dbId:null,
          duplicate:Boolean(existing||result.duplicate),
          totalObserved:updated.totalAssertionsObserved,
          totalUploaded:updated.totalAssertionsUploaded,
          uploaded:true,
          pendingVerification:result.pendingVerification||null
        });
        return;
      }catch(error){
        const now=Date.now();
        const updatedRecent=next.map((x)=>x?.key===key?{...x,uploadStatus:'error',uploadError:String(error?.message||error),uploadedAt:now}:x);
        const updated=await setState({bloxdSeenAt:now,totalAssertionsObserved:total,recentAssertions:updatedRecent,latestUpload:{ok:false,error:String(error?.message||error),seenAt:now}});await badge();
        sendResponse({ok:false,silent:true,error:String(error?.message||error),totalObserved:updated.totalAssertionsObserved,uploaded:false});return;
      }
    }
    if(type==='BLOXD_REGISTRATION_CODE'){
      const code=cleanCode(message.code);if(!code){sendResponse({ok:false,error:'invalid_code'});return;}
      const state=await setState({bloxdSeenAt:Date.now(),latestRegistrationCode:{code,seenAt:Date.now()}});await badge();sendResponse({ok:true,state,silent:true});return;
    }
    if(type==='HUB_EXTENSION_GET_STATE'){sendResponse({ok:true,version:chrome.runtime.getManifest().version,state:await getState()});return;}
    if(type==='HUB_EXTENSION_CLEAR'){const state=await setState({totalAssertionsObserved:0,totalAssertionsUploaded:0,recentAssertions:[],uploadedKeys:[],ackedDbIds:[],latestRegistrationCode:null,latestUpload:null,bridgeConnectedAt:0});sendResponse({ok:true,state});return;}
    if(type==='OPEN_HUB'){await chrome.tabs.create({url:HUB_URL});sendResponse({ok:true});return;}
    if(type==='OPEN_BLOXD'){await chrome.tabs.create({url:BLOXD_URL});sendResponse({ok:true});return;}
    sendResponse({ok:false,error:'unknown_message'});
  })().catch((error)=>{console.error('[HUB Verify Global Relay]',error);try{sendResponse({ok:false,silent:true,error:String(error?.message||error)});}catch(_){}});
  return true;
});
