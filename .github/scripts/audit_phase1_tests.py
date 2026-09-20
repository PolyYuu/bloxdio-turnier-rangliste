"""Isolated regression tests. All browser network traffic is intercepted.
Backend and lifecycle APIs are mocks; this is not a real Bloxd match or login.
Run both --mode baseline and --mode fixed to demonstrate the repaired defects.
"""
from pathlib import Path
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--root", type=Path, required=True)
parser.add_argument("--mode", choices=["baseline", "fixed"], required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
fixed = args.mode == "fixed"
results = []


def code(name):
    return (args.root / name).read_text()


def record(name, fn):
    try:
        detail = fn()
        results.append({"test": name, "passed": True, "detail": detail})
        print("PASS", name, flush=True)
    except Exception as error:
        results.append({"test": name, "passed": False, "error": str(error)})
        print("FAIL", name, str(error), flush=True)


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def syntax():
    checked = []
    for name in ["play-ui-runtime.js", "play-presence.js", "profile-live-guard.js", "play.js", "pending-hub.js"]:
        run = subprocess.run(["node", "--check", str(args.root / name)], capture_output=True, text=True)
        require(run.returncode == 0, f"{name}: {run.stderr}")
        checked.append(name)
    return checked


record("JavaScript syntax", syntax)

PLAY_HTML = re.sub(r"<script\b[^>]*>[\s\S]*?</script>", "", code("play.html"), flags=re.I)
PLAY_HTML = re.sub(r"<link\b[^>]*>", "", PLAY_HTML, flags=re.I)
PLAY_HTML = re.sub(r'(<iframe\b[^>]*\bsrc=)["\'][^"\']*["\']', r'\1"about:blank"', PLAY_HTML, flags=re.I)

with sync_playwright() as p:
    options = {"headless": True, "args": ["--no-sandbox"]}
    executable = os.environ.get("CHROMIUM_EXECUTABLE")
    if executable:
        options["executable_path"] = executable
    elif not Path(p.chromium.executable_path).exists() and shutil.which("chromium"):
        options["executable_path"] = shutil.which("chromium")
    browser = p.chromium.launch(**options)

    def page_for(html=PLAY_HTML):
        context = browser.new_context()
        # No production API, remote script, game or external page is ever loaded.
        context.route("**/*", lambda route: route.fulfill(status=200, content_type="text/html", body=html if route.request.resource_type == "document" else ""))
        page = context.new_page()
        page.goto("https://hub-fixture.invalid/")
        page.evaluate("window.__pageErrors=[]")
        page.on("pageerror", lambda error: page.evaluate("e => window.__pageErrors.push(e)", str(error)))
        return context, page

    def translation_idle():
        context, page = page_for()
        try:
            page.evaluate("""() => {
              window.__raf=0;
              const native=requestAnimationFrame.bind(window);
              window.requestAnimationFrame=fn=>native(time=>{window.__raf++;fn(time)});
              localStorage.setItem('sg-lang','en');
            }""")
            page.add_script_tag(content=code("play-ui-runtime.js"))
            page.wait_for_timeout(300)
            first = page.evaluate("window.__raf")
            page.wait_for_timeout(350)
            later = page.evaluate("window.__raf")
            difference = later - first
            require(difference <= 1 if fixed else difference >= 3, f"Unexpected idle RAF delta: {difference}")
            require(page.locator("#fullscreenButton").inner_text() == "⛶ FULLSCREEN", "Initial English translation missing")
            require(page.evaluate("window.__pageErrors.length") == 0, "Browser error")
            return {"idle_translation_frames": difference, "expected_defect_on_baseline": not fixed}
        finally:
            context.close()

    record("Translation reaches idle rather than self-triggering", translation_idle)

    def translation_updates():
        context, page = page_for()
        try:
            page.evaluate("localStorage.setItem('sg-lang','en')")
            page.add_script_tag(content=code("play-ui-runtime.js"))
            page.evaluate("document.querySelector('#roundLabel').textContent='RUNDE 4'")
            page.wait_for_timeout(130)
            require(page.locator("#roundLabel").inner_text() == "ROUND 4", "External round change not translated")
            page.evaluate("""() => {localStorage.setItem('sg-lang','fr');window.dispatchEvent(new StorageEvent('storage',{key:'sg-lang',newValue:'fr'}));}""")
            page.wait_for_timeout(130)
            require(page.locator("#roundLabel").inner_text() == "MANCHE 4", "French change missing")
            require(page.locator("#fullscreenButton").inner_text() == "⛶ PLEIN ÉCRAN", "French fullscreen label missing")
            require(page.evaluate("window.__pageErrors.length") == 0, "Browser error")
            return {"english_round": "ROUND 4", "french_round": "MANCHE 4"}
        finally:
            context.close()

    record("External UI changes and language switching still translate", translation_updates)

    def fullscreen_controls():
        context, page = page_for()
        try:
            page.evaluate("""() => {
              let current=null;window.__fullscreenCalls=[];
              Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>current});
              const stage=document.querySelector('#gameStage');
              stage.requestFullscreen=()=>{current=stage;__fullscreenCalls.push('enter');document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve()};
              document.exitFullscreen=()=>{current=null;__fullscreenCalls.push('exit');document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve()};
            }""")
            page.add_script_tag(content=code("play-ui-runtime.js"))
            for _ in range(2):
                page.evaluate("""() => {const b=document.querySelector('#fullscreenButton');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,button:0}));b.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}));}""")
            calls = page.evaluate("window.__fullscreenCalls")
            require(calls == ["enter", "exit"], f"Double toggle or missing fullscreen gesture: {calls}")
            return calls
        finally:
            context.close()

    record("Fullscreen pointer gesture does not toggle twice", fullscreen_controls)

    def presence_restore():
        context, page = page_for()
        try:
            page.evaluate("""() => {
              window.__beats=0;window.__clears=0;window.__intervals=new Map();let next=0;
              window.setInterval=(fn,ms)=>{__intervals.set(++next,{fn,ms});return next};
              window.clearInterval=id=>__intervals.delete(id);
              window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'test'}}}})},rpc:async name=>{if(name==='heartbeat_presence')__beats++;if(name==='clear_presence')__clears++;return {error:null}}})};
            }""")
            page.add_script_tag(content=code("play-presence.js"))
            page.wait_for_timeout(30)
            first = page.evaluate("window.__beats")
            require(first == 1, f"Expected initial heartbeat, got {first}")
            for _ in range(2):
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
                page.wait_for_timeout(20)
                require(page.evaluate("window.__intervals.size") == 0, "Timer not stopped")
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
                page.wait_for_timeout(20)
                page.evaluate("window.dispatchEvent(new Event('focus'))")
                page.wait_for_timeout(20)
            result = page.evaluate("({beats:__beats,clears:__clears,timers:__intervals.size})")
            if fixed:
                require(result["beats"] >= 3 and result["timers"] == 1 and result["clears"] == 2, f"Lifecycle not restored: {result}")
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
                require(page.evaluate("window.__intervals.size") == 1, "Duplicate pageshow created a second timer")
            else:
                require(result["beats"] == 1 and result["timers"] == 0, f"Baseline defect not reproduced: {result}")
            return result
        finally:
            context.close()

    record("Presence resumes after repeated back-forward lifecycle", presence_restore)

    def presence_stale_auth():
        context, page = page_for()
        try:
            page.evaluate("""() => {
              window.__beats=0;window.__resolveAuth=null;
              window.supabase={createClient:()=>({auth:{getSession:()=>new Promise(r=>window.__resolveAuth=r)},rpc:async name=>{if(name==='heartbeat_presence')__beats++;return {error:null}}})};
            }""")
            page.add_script_tag(content=code("play-presence.js"))
            page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
            page.evaluate("window.__resolveAuth({data:{session:{user:{id:'test'}}}})")
            page.wait_for_timeout(30)
            beats = page.evaluate("window.__beats")
            require(beats == (0 if fixed else 1), f"Late auth result wrote a heartbeat: {beats}")
            return {"heartbeats_after_stop": beats}
        finally:
            context.close()

    record("Presence does not write after a delayed session resolves on a stopped page", presence_stale_auth)

    def profile_safety(success=False):
        html = '<html><head></head><body><section class="page" data-page="profile"><h2 id="profilePlayerName"></h2></section></body></html>'
        context, page = page_for(html)
        try:
            page.evaluate("""success => {
              const person={id:'g-test',current_name:'AuditPlayer'};
              window.HubV3={live:{globalPlayers:success?[person]:[],player:null},renderProfileLive:async name=>{document.querySelector('#profilePlayerName').textContent=name}};
            }""", success)
            page.add_script_tag(content=code("profile-live-guard.js"))
            name = "AuditPlayer" if success else '<span id="audit-canary">NAME</span>'
            page.evaluate("""name => {const button=document.createElement('button');button.dataset.profilePlayer=name;button.textContent='Open';document.body.appendChild(button);button.click();}""", name)
            if success:
                page.wait_for_timeout(100)
                require(page.locator("#profilePlayerName").inner_text() == "AuditPlayer", "Successful profile stopped rendering")
                require(page.locator('[data-page="profile"]').get_attribute("class").find("hub-profile-live-error") == -1, "Successful profile got error gate")
                require(page.evaluate("window.HubV3.live.player") is None, "Public viewer placeholder leaked")
                return {"name": "AuditPlayer", "public_viewer_restored": True}
            page.wait_for_timeout(2800)
            count = page.locator("#hubProfileLiveGate #audit-canary").count()
            require(count == (0 if fixed else 1), f"Canary HTML count: {count}")
            if fixed:
                require(name in page.locator("#hubProfileLiveGate").inner_text(), "Error should preserve literal input text")
            return {"HTML_elements_from_player_name": count}
        finally:
            context.close()

    record("Profile error renders names as text, not HTML", profile_safety)
    record("Public profile success and temporary viewer restoration preserved", lambda: profile_safety(True))

    def play_read_paths(mode):
        context, page = page_for()
        try:
            page.evaluate("""mode => {
              window.__tables=[];window.__rpcs=[];window.__intervals=[];
              window.setInterval=(fn,ms)=>{__intervals.push(ms);return __intervals.length};
              const mine={id:'g-test',current_name:'AuditPlayer',avatar_pixels:null,is_ranked:mode!=='unranked',placement_games:mode==='unranked'?7:15,rating:mode==='unranked'?null:1777,peak_rating:mode==='unranked'?null:1815};
              const cup={id:'cup-test',name:'Audit Cup',status:'live',mode:2,current_round:1};
              const members=[{id:'p-one',global_player_id:'g-test',team_id:'team-test',tournament_id:cup.id,name:'AuditPlayer'},{id:'p-two',global_player_id:'g-two',team_id:'team-test',tournament_id:cup.id,name:'Partner'}];
              const fixtures={tournaments:mode==='cup'?[cup]:[],teams:[{id:'team-test',name:'Test Duo',color:'#ffffff'}],players:members,events:[{id:'e-one',player_id:'p-one',round:1,type:'kill',points:1,created_at:'2026-09-20'}],rating_rounds:[],player_directory:[mine,{...mine,id:'g-two',current_name:'Partner'}]};
              const client={auth:{getSession:async()=>({data:{session:{user:{id:'auth-test'}}}})},rpc:async name=>{__rpcs.push(name);return {data:name==='my_global_player_id'?'g-test':name==='get_my_profile'?mine:[],error:null}},from(table){__tables.push(table);let single=false;const chain=new Proxy({}, {get(_,key){if(key==='then')return (resolve,reject)=>Promise.resolve(table==='global_players'?{data:null,error:{message:'Permission denied (fixture)'}}:{data:single?(fixtures[table]||[])[0]:(fixtures[table]||[]),error:null}).then(resolve,reject);return (...args)=>{if(key==='single'||key==='maybeSingle')single=true;return chain}}});return chain},channel:()=>({on(){return this},subscribe(){return this}})};
              window.supabase={createClient:()=>client};
            }""", mode)
            page.add_script_tag(content=code("play.js"))
            page.wait_for_timeout(180)
            value = page.locator("#sidePanelContent").inner_text()
            tables = page.evaluate("window.__tables")
            rpcs = page.evaluate("window.__rpcs")
            if fixed:
                require("global_players" not in tables, "Protected table still queried")
                require("get_my_profile" in rpcs, "Own profile RPC not called")
                require("AuditPlayer" in value, "Own name missing")
                if mode == "rated":
                    require("1777" in value, "Rated profile value missing")
                if mode == "unranked":
                    require("UNRANKED" in value and "7" in value and "1777" not in value, "Unranked profile leaked or missing")
                if mode == "cup":
                    require("player_directory" in tables, "Cup avatars/profiles not loaded from safe view")
                    require("Partner" in value and "PTS" in value, "Duo standings missing")
            else:
                require("global_players" in tables and "get_my_profile" not in rpcs, "Baseline direct-query defect not reproduced")
                if mode != "cup":
                    require("konnte" in value, "Expected unavailable profile in baseline")
            require(page.evaluate("window.__pageErrors.length") == 0, "Uncaught PLAY browser error")
            return {"mode": mode, "tables": tables, "RPCs": rpcs, "side_text": value[:250]}
        finally:
            context.close()

    for mode in ["rated", "unranked", "cup"]:
        record("PLAY safe profile access: " + mode, lambda mode=mode: play_read_paths(mode))

    def cache_versions():
        expected = "20260920audit1"
        counts = {}
        for name, scripts in {"play.html":["play.js","play-presence.js","play-ui-runtime.js"],"pending-hub.js":["profile-live-guard.js"],"index.html":["pending-hub.js"]}.items():
            for script in scripts:
                count = code(name).count(script + "?v=" + expected)
                require(count == (1 if fixed else 0), f"Cache version mismatch for {script}: {count}")
                counts[script] = count
        return counts

    record("Only modified script entry points receive new cache versions", cache_versions)
    browser.close()

args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({"mode": args.mode, "isolated": True, "production_requests": 0, "results": results}, indent=2, ensure_ascii=False) + "\n")
print(f"{sum(result['passed'] for result in results)}/{len(results)} checks passed ({args.mode})", flush=True)
sys.exit(0 if all(result["passed"] for result in results) else 1)
