from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

GUARD_ID = 'hub-live-debug-route-guard'
if GUARD_ID in s:
    raise SystemExit('live debug route guard already present')

head = '<head>'
if s.count(head) != 1:
    raise SystemExit(f'expected exactly one <head>, got {s.count(head)}')

guard = r'''<head>
<script id="hub-live-debug-route-guard">
(function(){
  'use strict';
  const DEBUG_HASH='#live-debug';
  const SAFE_HASH='#admin';
  function captureLiveDebugRequest(){
    if(location.hash!==DEBUG_HASH)return;
    window.__hubLiveDebugRequested=true;
    history.replaceState(null,'',location.pathname+location.search+SAFE_HASH);
    window.dispatchEvent(new CustomEvent('hub:live-debug-requested'));
  }
  captureLiveDebugRequest();
  window.addEventListener('hashchange',captureLiveDebugRequest);
})();
</script>'''
s = s.replace(head, guard, 1)

old = r'''  async function syncBloxdDebugRoute(){
    const root=ensureBloxdDebugShell();
    if(location.hash==='#live-debug'){
      if(!live.session){root.hidden=true;return;}
      if(!live.isAdmin){root.hidden=true;location.hash='#overview';toast(copy('Admin access required.','Admin-Zugriff erforderlich.','Accès admin requis.'),true);return;}
      root.hidden=false;await renderBloxdLiveDebug(true);stopBloxdDebugPoll();bloxdDebugPoll=setInterval(()=>{if(document.visibilityState==='visible'&&location.hash==='#live-debug')renderBloxdLiveDebug();},5000);
    }else{root.hidden=true;stopBloxdDebugPoll();}
  }
  window.addEventListener('hashchange',syncBloxdDebugRoute);
  document.addEventListener('hub:auth-restored',()=>setTimeout(syncBloxdDebugRoute,50));'''

new = r'''  function wantsBloxdLiveDebug(){return location.hash==='#live-debug'||window.__hubLiveDebugRequested===true;}
  async function syncBloxdDebugRoute(){
    const root=ensureBloxdDebugShell();
    if(wantsBloxdLiveDebug()){
      if(!live.session){root.hidden=true;return;}
      if(!live.isAdmin){window.__hubLiveDebugRequested=false;root.hidden=true;location.hash='#overview';toast(copy('Admin access required.','Admin-Zugriff erforderlich.','Accès admin requis.'),true);return;}
      window.__hubLiveDebugRequested=false;
      if(location.hash!=='#live-debug')history.replaceState(null,'',location.pathname+location.search+'#live-debug');
      root.hidden=false;await renderBloxdLiveDebug(true);stopBloxdDebugPoll();bloxdDebugPoll=setInterval(()=>{if(document.visibilityState==='visible'&&location.hash==='#live-debug')renderBloxdLiveDebug();},5000);
    }else{root.hidden=true;stopBloxdDebugPoll();}
  }
  window.addEventListener('hashchange',syncBloxdDebugRoute);
  window.addEventListener('hub:live-debug-requested',()=>setTimeout(syncBloxdDebugRoute,0));
  document.addEventListener('hub:auth-restored',()=>setTimeout(syncBloxdDebugRoute,50));'''

count = s.count(old)
if count != 1:
    raise SystemExit(f'expected one existing live debug router block, got {count}')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('live debug route guard inserted')
print('existing app router left untouched')
