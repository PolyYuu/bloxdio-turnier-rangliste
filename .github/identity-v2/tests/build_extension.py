from pathlib import Path
import zipfile,json,hashlib
R=Path(__file__).resolve().parents[1];e=R/'extension'
with zipfile.ZipFile(R/'source/baseline-extension.zip') as z:
 for n in z.namelist():
  if n.endswith('/'):continue
  p=e/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(n))
worker=(e/'service-worker.js').read_text()
def rep(s,a,b):
 assert s.count(a)==1,a[:90];return s.replace(a,b,1)
worker=rep(worker,'"use strict";','"use strict";\nimportScripts("identity-worker.js");')
worker=rep(worker,"const type=String(message?.type||'');","const type=String(message?.type||'');\n  if(type.startsWith('HUB_IDENTITY_V2_')){sendResponse(await HubIdentityV2.handle(message,sender));return;}")
worker=rep(worker,"if(type==='HUB_EXTENSION_GET_STATE'){sendResponse({ok:true,version:chrome.runtime.getManifest().version,state:await getState()});return;}","if(type==='HUB_EXTENSION_GET_STATE'){sendResponse({ok:true,version:chrome.runtime.getManifest().version,state:await getState(),identity:await HubIdentityV2.diagnostics()});return;}")
(e/'service-worker.js').write_text(worker)
client=(e/'content/bloxd-content.js').read_text()
client=rep(client,"if(!text||text.length>70000)return;const self=", "if(!text||text.length>70000)return;void HubIdentityClient.processText(text).catch(()=>{});const self=")
client=client.replace('if(response?.notifySelf){','if(false&&response?.notifySelf){')
client=rep(client,"for(const pattern of SHORT_CODE_PATTERNS){pattern.lastIndex=0;let match;while((match=pattern.exec(text)))watchOwnCode(String(match[1]||'').toUpperCase());}","// Visible short codes are not sufficient proof for personal notices; v2 owns that path.\n")
(e/'content/bloxd-content.js').write_text(client)
(e/'identity-worker.js').write_bytes((R/'source/identity-worker.js').read_bytes())
(e/'content/identity-client.js').write_bytes((R/'source/identity-client.js').read_bytes())
m=json.loads((e/'manifest.json').read_text());m['version']='1.0.10';m['permissions'].append('alarms');m['content_scripts'][0]['js'].insert(0,'content/identity-client.js');(e/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
h=(e/'popup/popup.html').read_text().replace('v1.0.9','v1.0.10')
h=rep(h,'    <div class="actions">','    <section class="card"><small id="identityKicker">SIGNED IDENTITY V2</small><strong id="identityState">Ready for the new World Code</strong><p id="identityDetail"></p></section>\n    <div class="actions">')
h=rep(h,'  <script src="popup.js"></script>','  <script src="popup.js"></script>\n  <script src="identity-status.js"></script>')
(e/'popup/popup.html').write_text(h)
(e/'popup/identity-status.js').write_text('''"use strict";
(async()=>{const c={en:{head:"SIGNED IDENTITY V2",ready:"Ready for the new World Code",active:"Own identity confirmed",wait:"Pending delivery",error:"Identity check needs attention",detail:(n,q)=>`${n} confirmed events · ${q} queued`},de:{head:"SIGNIERTE IDENTITÄT V2",ready:"Bereit für den neuen World Code",active:"Eigene Identität bestätigt",wait:"Übertragung ausstehend",error:"Identitätsprüfung benötigt Aufmerksamkeit",detail:(n,q)=>`${n} bestätigte Ereignisse · ${q} in Warteschlange`},fr:{head:"IDENTITÉ SIGNÉE V2",ready:"Prêt pour le nouveau World Code",active:"Identité personnelle confirmée",wait:"Transmission en attente",error:"Vérification à contrôler",detail:(n,q)=>`${n} événements confirmés · ${q} en attente`}};async function update(){try{const r=await chrome.runtime.sendMessage({type:"HUB_EXTENSION_GET_STATE"}),s=await chrome.storage.local.get({hubLanguage:"en"}),t=c[s.hubLanguage]||c.en,d=r?.identity||{};document.getElementById("identityKicker").textContent=t.head;document.getElementById("identityState").textContent=d.last?.ok===false?t.error:d.queued?t.wait:d.lastSelf?t.active:t.ready;document.getElementById("identityDetail").textContent=t.detail(d.processed||0,d.queued||0)+(d.last?.error?" · "+d.last.error:"");}catch{}}await update();setInterval(update,1500);})();
''')
with zipfile.ZipFile(R/'source/baseline-extension.zip') as z:
 before=z.read('service-worker.js').decode()
 for start,end in [('async function recordLive(', 'chrome.runtime.onInstalled')]:
  assert before[before.index(start):before.index(end)]==worker[worker.index(start):worker.index(end)]
 assert z.read('assets/hub-logo.png')==(e/'assets/hub-logo.png').read_bytes()
report={'version':'1.0.10','baseline':'85db4f6bafa7f1e45d869052dbdbeb5fbd9e18d6','live_worker_functions_unchanged':True,'original_png_unchanged':True,'files':{str(p.relative_to(e)):hashlib.sha256(p.read_bytes()).hexdigest() for p in e.rglob('*') if p.is_file()}}
(R/'results/extension-build.json').write_text(json.dumps(report,indent=2)+'\n');print('Candidate 1.0.10 built. Original live functions and PNG preserved.')
