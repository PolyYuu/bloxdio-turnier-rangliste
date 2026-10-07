"""Isolated Chromium tests. Routes return fixtures, never production data."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, subprocess, tempfile, zipfile, shutil
BASE=Path(__file__).resolve().parent
OUT=Path(os.environ['RUNNER_TEMP'])/'identity-v2-results';OUT.mkdir(parents=True,exist_ok=True)
WORK=Path(tempfile.mkdtemp(prefix='identity-v2-'))
shutil.copytree(BASE,WORK,dirs_exist_ok=True)
(WORK/'results').mkdir(exist_ok=True)
with zipfile.ZipFile(WORK/'source/baseline-extension.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in Path('extension/hub-verify').rglob('*'):
  if f.is_file():z.write(f,str(f.relative_to('extension/hub-verify')))
subprocess.run(['python',str(WORK/'tests/build_extension.py')],check=True)
subprocess.run(['node',str(WORK/'tests/worker-tests.cjs')],check=True)
EXT=WORK/'extension';CLIENT=(EXT/'content/identity-client.js').read_text();OLD=(EXT/'content/bloxd-content.js').read_text()
results=[]
def record(name,detail):results.append({'name':name,'passed':True,'detail':detail})
MOCK=r'''() => {
 window.calls=[];window.notices=[{type:'rename',id:'hub-id2:AliceDb111111:'+('n'.repeat(43)),fromName:'OldAlice',toName:'Alice'}];window.delays=[];window.hiddenForTest=false;window.failNext=false;
 const timeout=window.setTimeout.bind(window);window.setTimeout=(f,ms,...args)=>{window.delays.push(ms);return timeout(f,ms===15000?120:ms,...args);};
 Object.defineProperty(document,'visibilityState',{get:()=>window.hiddenForTest?'hidden':'visible',configurable:true});
 window.chrome={runtime:{sendMessage:async m=>{window.calls.push(m);if(m.type==='HUB_IDENTITY_V2_ASSERT'&&window.failNext){window.failNext=false;return{ok:false};}if(m.type==='HUB_IDENTITY_V2_SELF'||m.type==='HUB_IDENTITY_V2_POLL')return{ok:true,issuedAt:1000,linked:true,notifications:window.notices};return{ok:true};}},storage:{local:{get:async()=>({hubLanguage:'en'})},onChanged:{addListener:()=>{}}}};
 window.selfMarker='__SG_EVT__|REGSELF2|sg-hub-identity-20260920|fixture|SIG='+('x'.repeat(43));
}'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1024,'height':720})
 network=[]
 def intercept(route):
  network.append(route.request.url)
  body='<html><body><input id="game-input"><div id="log"></div></body></html>'
  if route.request.url=='https://hub.invalid/play':body='<html><body><iframe style="width:850px;height:550px" src="https://bloxd.io/fixture"></iframe></body></html>'
  route.fulfill(status=200,content_type='text/html',body=body)
 context.route('**/*',intercept)
 def setup(embedded=False,legacy=False):
  page=context.new_page();page.goto('https://hub.invalid/play' if embedded else 'https://bloxd.io/fixture')
  f=page.frame(url='https://bloxd.io/fixture') if embedded else page.main_frame
  if f is None:page.wait_for_timeout(150);f=page.frame(url='https://bloxd.io/fixture')
  f.evaluate(MOCK);f.add_script_tag(content=CLIENT)
  if legacy:f.add_script_tag(content=OLD)
  return page,f
 for embedded in [False,True]:
  page,f=setup(embedded)
  f.locator('#game-input').focus();f.evaluate('() => HubIdentityClient.processText(selfMarker)')
  f.wait_for_function("calls.some(x=>x.type==='HUB_IDENTITY_V2_DISPLAYED')")
  text=f.locator('#hub-identity-v2-notice').inner_text();assert 'OldAlice → Alice' in text
  assert f.evaluate("document.activeElement.id")=='game-input'
  assert f.evaluate('delays.includes(15000)')
  record('Own rename renders '+('inside PLAY iframe' if embedded else 'in direct Bloxd document'),{'text':text,'focus_preserved':True,'scheduled_duration_ms':15000})
  if embedded:page.screenshot(path=str(OUT/'iframe-notice.png'))
  page.close()
 page,f=setup();f.evaluate('hiddenForTest=true');f.evaluate('() => HubIdentityClient.processText(selfMarker)');page.wait_for_timeout(150)
 assert f.evaluate("calls.filter(x=>x.type==='HUB_IDENTITY_V2_DISPLAYED').length")==0
 f.evaluate("hiddenForTest=false;document.dispatchEvent(new Event('visibilitychange'))");f.wait_for_function("calls.some(x=>x.type==='HUB_IDENTITY_V2_DISPLAYED')")
 record('Hidden document does not acknowledge an invisible notice; resumes on visible',{});page.close()
 page,f=setup();f.evaluate('() => HubIdentityClient.processText(selfMarker)');f.wait_for_function("calls.some(x=>x.type==='HUB_IDENTITY_V2_DISPLAYED')");page.wait_for_timeout(170)
 f.evaluate("document.getElementById('hub-identity-v2-notice').remove();notices=[{type:'rename',id:'hub-id2:AliceDb111111:'+('m'.repeat(43)),fromName:'Alice',toName:'NextAlice'}];document.dispatchEvent(new Event('visibilitychange'))")
 f.wait_for_function("calls.filter(x=>x.type==='HUB_IDENTITY_V2_DISPLAYED').length===2")
 assert 'NextAlice' in f.locator('#hub-identity-v2-notice').inner_text();record('Removed notification DOM is rebuilt for next confirmed event',{});page.close()
 page,f=setup();f.evaluate("notices[0].fromName='<img id=unsafe-marker src=x>'");f.evaluate('() => HubIdentityClient.processText(selfMarker)');f.wait_for_function("calls.some(x=>x.type==='HUB_IDENTITY_V2_DISPLAYED')")
 assert f.locator('#unsafe-marker').count()==0;assert '<img' in f.locator('#hub-identity-v2-notice').inner_text();record('Names render as text, not HTML',{});page.close()
 page,f=setup();f.evaluate("() => HubIdentityClient.processText('__SG_EVT__|REGASSERT2|sg-hub-identity-20260920|fixture|SIG='+('x'.repeat(43)))");page.wait_for_timeout(100)
 assert f.locator('#hub-identity-v2-notice').count()==0;assert not f.evaluate("calls.some(x=>x.type==='HUB_IDENTITY_V2_SELF')");record('Public third-party observation never becomes own notification',{});page.close()
 page,f=setup();f.evaluate('failNext=true');raw='__SG_EVT__|REGASSERT2|sg-hub-identity-20260920|fixture|SIG='+'x'*43
 f.evaluate('(r)=>HubIdentityClient.processText(r)',raw);f.evaluate('(r)=>HubIdentityClient.processText(r)',raw)
 assert f.evaluate("calls.filter(x=>x.type==='HUB_IDENTITY_V2_ASSERT').length")==2;record('Failed enqueue can be retried instead of marked seen',{});page.close()
 page,f=setup(legacy=True);f.evaluate("document.getElementById('log').innerHTML='<div><span>Alice joined</span><span id=technical>'+selfMarker+'</span></div>'")
 f.wait_for_function("calls.some(x=>x.type==='HUB_IDENTITY_V2_DISPLAYED')");assert 'Alice joined' in f.locator('#log').inner_text();assert not f.locator('#technical').is_visible();record('Existing DOM observer finds v2 markers without hiding normal join text',{});page.close()
 for f in EXT.rglob('*.js'):subprocess.run(['node','--check',str(f)],check=True)
 manifest=json.loads((EXT/'manifest.json').read_text());assert manifest['version']=='1.0.10';assert 'alarms' in manifest['permissions']
 for cs in manifest['content_scripts']:
  for name in cs['js']:assert (EXT/name).is_file()
 for name in manifest['icons'].values():assert (EXT/name).is_file()
 record('All packaged JS syntax parses and manifest references exist',{})
 browser.close()
report={'isolated':True,'production_requests':0,'network_routes_fulfilled_with_fixtures':len(network),'notice_timeout_accelerated_in_test':True,'results':results}
(OUT/'browser-tests.json').write_text(json.dumps(report,indent=2)+'\n')
for name in ['extension-build.json','worker-tests.json']:shutil.copyfile(WORK/'results'/name,OUT/name)
with zipfile.ZipFile(OUT/'HUB-Verify-v1.0.10.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in EXT.rglob('*'):
  if f.is_file():z.write(f,str(f.relative_to(EXT)))
print(json.dumps({'browser_checks_passed':len(results),'production_requests':0}))
