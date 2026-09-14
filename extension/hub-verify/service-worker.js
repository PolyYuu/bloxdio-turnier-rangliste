"use strict";

const HUB_URL='https://bloxdio-turnier-rangliste.vercel.app/pending.html';
const BLOXD_URL='https://bloxd.io/play/classic_playerSchematic%7CHT_Y95VcEQaUBLbTc24H7?lobby=1';
const REG_INGEST_URL='https://nxzrgbpaxukgjyzwupjp.supabase.co/functions/v1/hub-extension-assertion-ingest';
const LIVE_INGEST_URL='https://nxzrgbpaxukgjyzwupjp.supabase.co/functions/v1/hub-extension-live-ingest';
const MAX_RECENT=80,MAX_LIVE_RECENT=120;
const DEFAULT_STATE={
  bloxdSeenAt:0,
  totalAssertionsObserved:0,
  totalAssertionsUploaded:0,
  recentAssertions:[],
  uploadedKeys:[],
  latestRegistrationCode:null,
  latestUpload:null,
  totalLiveObserved:0,
  totalLiveUploaded:0,
  recentLive:[],
  latestLiveUpload:null,
  relayMode:'hub-verify-full-relay',
  uploadEnabled:true,
  hubLanguage:'en',
  identityNames:{}
};
const snapshotBuffers=new Map();

async function getState(){return{...DEFAULT_STATE,...await chrome.storage.local.get(DEFAULT_STATE)};}
async function setState(patch){await chrome.storage.local.set(patch);return getState();}
function cleanCode(value){const code=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return /^[A-Z0-9]{8}$/.test(code)?code:'';}
function cleanRegRaw(value){const raw=String(value||'').trim();if(!raw.startsWith('__SG_EVT__|REGASSERT|')||raw.length>4000)return'';return raw;}
function cleanLiveRaw(value){const raw=String(value||'').trim();if(!raw.startsWith('__SG_EVT__|')||raw.startsWith('__SG_EVT__|REG')||!raw.includes('|SIG=')||raw.length>7000)return'';return raw;}
function rawKey(raw){let h=2166136261;for(let i=0;i<raw.length;i+=1)h=Math.imul(h^raw.charCodeAt(i),16777619);return String(h>>>0);}
function rawCode(raw){const p=String(raw||'').split('|');return p.length===8?cleanCode(p[5]):'';}
function markerType(raw){return String(raw||'').split('|')[1]||'';}
function markerMatchId(raw){return String(raw||'').split('|')[2]||'';}
function safeDecode(value){try{return decodeURIComponent(String(value||''));}catch(_){return String(value||'');}}
function rawIdentity(raw){
  const p=String(raw||'').split('|');
  if(p.length!==8)return null;
  return{
    eventId:safeDecode(p[2]).trim(),
    dbId:safeDecode(p[3]).trim(),
    playerName:safeDecode(p[4]).trim(),
    code:cleanCode(p[5]),
    issuedAt:String(p[6]||'').trim(),
    direction:safeDecode(p[7]).trim()
  };
}

const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function rot5(x,n){n%=5;return((x<<n)|(x>>>(5-n)))&31;}
function checkChar(first7){
  let c=0;
  for(let i=0;i<7;i++){
    const x=CODE_ALPHABET.indexOf(first7[i]);
    if(x<0)return'';
    c^=rot5(x,i);
  }
  return CODE_ALPHABET[c&31];
}
function renameSyncCode(dbId,playerName,salt=0){
  const input=`HUB-RENAME|${dbId}|${playerName}|${salt}`;
  let h=2166136261;
  for(let i=0;i<input.length;i++)h=Math.imul(h^input.charCodeAt(i),16777619)>>>0;
  let first='';
  for(let i=0;i<7;i++){
    h=Math.imul(h^(i*97+31),16777619)>>>0;
    first+=CODE_ALPHABET[(h>>>((i%5)*5))&31];
  }
  return first+checkChar(first);
}
function buildRenameSyncRaw(identity,code){
  const eventId=`register-short:${code}:${identity.dbId}`;
  return [
    '__SG_EVT__',
    'REGASSERT',
    encodeURIComponent(eventId),
    encodeURIComponent(identity.dbId),
    encodeURIComponent(identity.playerName),
    code,
    identity.issuedAt||String(Date.now()),
    'bloxd_first'
  ].join('|');
}
async function syncExistingLinkedIdentity(raw,known,rememberedName){
  const identity=rawIdentity(raw);
  if(!identity?.dbId||!identity?.playerName)return{ok:false,identity:null,oldName:null,newName:null,uploaded:false};
  const oldName=String(rememberedName||known?.playerName||'').trim();
  if(oldName===identity.playerName)return{ok:true,identity,oldName,newName:identity.playerName,uploaded:false,renamed:false};

  for(let salt=0;salt<12;salt++){
    const code=renameSyncCode(identity.dbId,identity.playerName,salt);
    if(code===identity.code)continue;

    let status=null;
    try{status=await post(REG_INGEST_URL,{mode:'status',code});}catch(_){status=null;}
    if(status?.linked===true){
      if(String(status.playerName||'')===identity.playerName){
        return{ok:true,identity,oldName,newName:identity.playerName,uploaded:false,renamed:Boolean(oldName&&oldName!==identity.playerName),syncCode:code};
      }
      continue;
    }

    try{
      const result=await post(REG_INGEST_URL,{raw:buildRenameSyncRaw(identity,code)});
      const confirmed=await post(REG_INGEST_URL,{mode:'status',code});
      if(confirmed?.linked===true&&String(confirmed.playerName||'')===identity.playerName){
        return{
          ok:true,
          identity,
          oldName,
          newName:identity.playerName,
          uploaded:true,
          renamed:Boolean(oldName&&oldName!==identity.playerName),
          syncCode:code,
          result
        };
      }
    }catch(_){}
  }
  return{ok:false,identity,oldName,newName:identity.playerName,uploaded:false,renamed:false};
}

async function badge(){
  const state=await getState();
  const active=Date.now()-Number(state.bloxdSeenAt||0)<120000;
  const text=active?'ON':'';
  await chrome.action.setBadgeText({text});
  if(text)await chrome.action.setBadgeBackgroundColor({color:'#55e6b1'});
}
async function post(url,body){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data={};
  try{data=await response.json();}catch(_){}
  if(!response.ok||!data?.ok)throw new Error(data?.error||`HTTP ${response.status}`);
  return data;
}
async function recordLive(raw,status,result=null,error=null){
  const state=await getState(),key=rawKey(raw),recent=Array.isArray(state.recentLive)?state.recentLive:[],existing=recent.find(x=>x?.key===key),now=Date.now();
  const totalObserved=Number(state.totalLiveObserved||0)+(existing?0:1),totalUploaded=Number(state.totalLiveUploaded||0)+(status==='uploaded'&&!existing?1:0);
  const item={key,type:markerType(raw),matchId:markerMatchId(raw),seenAt:existing?.seenAt||now,status,uploadedAt:status==='uploaded'?now:null,error:error?String(error):null};
  const next=[item,...recent.filter(x=>x?.key!==key)].slice(0,MAX_LIVE_RECENT);
  return setState({bloxdSeenAt:now,totalLiveObserved:totalObserved,totalLiveUploaded:totalUploaded,recentLive:next,latestLiveUpload:{ok:status==='uploaded',seenAt:now,event:result?.event||item.type,error:error?String(error):null}});
}
async function uploadSingleLive(raw){
  try{const result=await post(LIVE_INGEST_URL,{raw});await recordLive(raw,'uploaded',result);return{ok:true,result};}
  catch(error){await recordLive(raw,'error',null,error);return{ok:false,error:String(error?.message||error)};}
}
async function handleSnapshotMarker(raw){
  const type=markerType(raw),matchId=markerMatchId(raw);
  if(!matchId)return{ok:false,error:'missing_match_id'};
  if(type==='SNAPBEGIN'){
    snapshotBuffers.set(matchId,{markers:[raw],startedAt:Date.now()});
    await recordLive(raw,'buffered');
    return{ok:true,buffered:true};
  }
  const buf=snapshotBuffers.get(matchId);
  if(!buf)return{ok:false,error:'snapshot_buffer_missing'};
  buf.markers.push(raw);
  if(buf.markers.length>102){snapshotBuffers.delete(matchId);return{ok:false,error:'snapshot_too_large'};}
  if(type!=='SNAPEND'){await recordLive(raw,'buffered');return{ok:true,buffered:true};}
  snapshotBuffers.delete(matchId);
  try{
    const result=await post(LIVE_INGEST_URL,{markers:buf.markers});
    for(const marker of buf.markers)await recordLive(marker,'uploaded',result);
    return{ok:true,result};
  }catch(error){
    for(const marker of buf.markers)await recordLive(marker,'error',null,error);
    return{ok:false,error:String(error?.message||error)};
  }
}

chrome.runtime.onInstalled.addListener(async()=>{
  const old=await chrome.storage.local.get(null);
  await chrome.storage.local.set({
    ...DEFAULT_STATE,
    totalAssertionsObserved:Number(old.totalAssertionsObserved||0),
    totalAssertionsUploaded:Number(old.totalAssertionsUploaded||0),
    recentAssertions:Array.isArray(old.recentAssertions)?old.recentAssertions.slice(0,MAX_RECENT):[],
    uploadedKeys:Array.isArray(old.uploadedKeys)?old.uploadedKeys.slice(-500):[],
    totalLiveObserved:Number(old.totalLiveObserved||0),
    totalLiveUploaded:Number(old.totalLiveUploaded||0),
    recentLive:Array.isArray(old.recentLive)?old.recentLive.slice(0,MAX_LIVE_RECENT):[],
    hubLanguage:['en','de','fr'].includes(old.hubLanguage)?old.hubLanguage:'en',
    identityNames:old.identityNames&&typeof old.identityNames==='object'?old.identityNames:{}
  });
  await badge();
});
chrome.runtime.onStartup.addListener(badge);

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  (async()=>{
    const type=String(message?.type||'');

    if(type==='BLOXD_EXTENSION_READY'){
      const state=await setState({bloxdSeenAt:Date.now(),relayMode:'hub-verify-full-relay',uploadEnabled:true});
      await badge();sendResponse({ok:true,state});return;
    }
    if(type==='BLOXD_EXTENSION_HEARTBEAT'){
      const state=await setState({bloxdSeenAt:Date.now(),relayMode:'hub-verify-full-relay',uploadEnabled:true});
      await badge();sendResponse({ok:true,state});return;
    }

    if(type==='BLOXD_GLOBAL_REGASSERT'){
      const raw=cleanRegRaw(message.raw);
      if(!raw){sendResponse({ok:false,error:'invalid_regassert'});return;}

      const state=await getState();
      const key=rawKey(raw),code=rawCode(raw),identity=rawIdentity(raw);
      const recent=Array.isArray(state.recentAssertions)?state.recentAssertions:[];
      const existing=recent.find(x=>x&&x.key===key);
      let total=Number(state.totalAssertionsObserved||0),next=recent;
      if(!existing){
        total+=1;
        next=[{key,seenAt:Date.now(),uploadStatus:'pending'},...recent].slice(0,MAX_RECENT);
      }

      try{
        const uploadedKeys=Array.isArray(state.uploadedKeys)?state.uploadedKeys:[];
        const known=await post(REG_INGEST_URL,{mode:'status',code});
        const selfCode=cleanCode(state.latestRegistrationCode?.code||'');
        const isSelf=Boolean(selfCode&&code===selfCode);

        let result=null;
        let renameSync=null;
        let uploaded=false;
        const identityNames=state.identityNames&&typeof state.identityNames==='object'?{...state.identityNames}:{};
        const rememberedName=identity?.dbId?String(identityNames[identity.dbId]||''):'';

        if(known.linked===true){
          renameSync=await syncExistingLinkedIdentity(raw,known,rememberedName);
          uploaded=Boolean(renameSync?.uploaded);
        }else{
          result=await post(REG_INGEST_URL,{raw});
          uploaded=true;
        }

        const now=Date.now();
        if(identity?.dbId&&identity?.playerName&&(known.linked!==true||renameSync?.ok))identityNames[identity.dbId]=identity.playerName;
        const verified=Boolean(result?.pendingVerification==='verified');
        const renamed=Boolean(known.linked===true&&renameSync?.ok&&renameSync?.renamed);
        const notificationType=renamed?'rename':verified?'verified':'none';
        const notifySelf=Boolean(isSelf&&notificationType!=='none');
        const updatedKeys=uploadedKeys.includes(key)?uploadedKeys:[...uploadedKeys,key].slice(-500);
        const uploadStatus=renamed?'renamed':known.linked===true?(renameSync?.ok?'identity-synced':'identity-sync-error'):'uploaded';
        const updatedRecent=next.map(x=>x?.key===key?{...x,uploadStatus,uploadedAt:now}:x);
        const uploadedCount=Number(state.totalAssertionsUploaded||0)+(uploaded&&!existing?1:0);
        const updated=await setState({
          bloxdSeenAt:now,
          totalAssertionsObserved:total,
          totalAssertionsUploaded:uploadedCount,
          recentAssertions:updatedRecent,
          uploadedKeys:updatedKeys,
          identityNames,
          latestUpload:{ok:known.linked===true?Boolean(renameSync?.ok):true,seenAt:now}
        });

        await badge();
        sendResponse({
          ok:known.linked===true?Boolean(renameSync?.ok):true,
          silent:!notifySelf,
          notifySelf,
          notificationType,
          verifiedPlayerName:verified?String(result?.playerName||identity?.playerName||''):null,
          renameFrom:renamed?renameSync.oldName:null,
          renameTo:renamed?renameSync.newName:null,
          duplicate:Boolean(existing||result?.duplicate),
          totalObserved:updated.totalAssertionsObserved,
          totalUploaded:updated.totalAssertionsUploaded,
          uploaded,
          alreadyLinked:known.linked===true
        });
        return;
      }catch(error){
        const now=Date.now();
        const updatedRecent=next.map(x=>x?.key===key?{...x,uploadStatus:'error',uploadedAt:now}:x);
        const updated=await setState({
          bloxdSeenAt:now,
          totalAssertionsObserved:total,
          recentAssertions:updatedRecent,
          latestUpload:{ok:false,error:String(error?.message||error),seenAt:now}
        });
        await badge();
        sendResponse({ok:false,silent:true,error:String(error?.message||error),totalObserved:updated.totalAssertionsObserved,uploaded:false});
        return;
      }
    }

    if(type==='BLOXD_LIVE_MARKER'){
      const raw=cleanLiveRaw(message.raw);
      if(!raw){sendResponse({ok:false,error:'invalid_live_marker'});return;}
      const mt=markerType(raw);
      const result=(mt==='SNAPBEGIN'||mt==='SNAPPLAYER'||mt==='SNAPEND')?await handleSnapshotMarker(raw):await uploadSingleLive(raw);
      await badge();sendResponse({...result,silent:true});return;
    }

    if(type==='BLOXD_REGISTRATION_CODE'){
      const code=cleanCode(message.code);
      if(!code){sendResponse({ok:false,error:'invalid_code'});return;}
      const now=Date.now(),state=await setState({bloxdSeenAt:now,latestRegistrationCode:{code,seenAt:now}});
      await badge();
      try{
        const status=await post(REG_INGEST_URL,{mode:'status',code});
        sendResponse({ok:true,state,linked:status.linked===true,playerName:status.playerName||null,silent:true});
      }catch(_){
        sendResponse({ok:true,state,linked:false,silent:true});
      }
      return;
    }

    if(type==='HUB_EXTENSION_GET_STATE'){sendResponse({ok:true,version:chrome.runtime.getManifest().version,state:await getState()});return;}
    if(type==='HUB_EXTENSION_CLEAR'){
      snapshotBuffers.clear();
      const state=await setState({
        totalAssertionsObserved:0,totalAssertionsUploaded:0,recentAssertions:[],uploadedKeys:[],
        latestRegistrationCode:null,latestUpload:null,totalLiveObserved:0,totalLiveUploaded:0,
        recentLive:[],latestLiveUpload:null
      });
      sendResponse({ok:true,state});return;
    }
    if(type==='OPEN_HUB'){await chrome.tabs.create({url:HUB_URL});sendResponse({ok:true});return;}
    if(type==='OPEN_BLOXD'){await chrome.tabs.create({url:BLOXD_URL});sendResponse({ok:true});return;}
    sendResponse({ok:false,error:'unknown_message'});
  })().catch(error=>{
    console.error('[HUB Verify Relay]',error);
    try{sendResponse({ok:false,silent:true,error:String(error?.message||error)});}catch(_){}
  });
  return true;
});
