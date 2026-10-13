"""Focused browser regression: actual HUB functions and input handlers, synthetic RPCs.

All page requests are blocked. Uses an isolated headless profile, never the installed
HUB Verify extension or real login. This is not a full production/Bloxd acceptance test.
Requires playwright==1.55.0; CHROMIUM_EXECUTABLE may select a local Chrome binary.
"""
import argparse
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--output', type=Path)
args = parser.parse_args()
source = (args.root / 'index.html').read_text()


def between(start, end):
    left = source.index(start)
    return source[left:source.index(end, left)]


api_source = between('window.HubAPI = (() => {', '</script>')
social_source = between('  let socialRequest=0;', '  function openSocial()')
admin_source = between('  function adminAccountRow(p)', '\nfunction ensureAdminSelector()')
binding_source = next(line for line in source.splitlines()
                      if line.startswith("  $('#friendSearchInput')?.addEventListener"))
invalidate_source = between('  function invalidateAccountViews()', "  $('#cupSelect')?")
legacy_manage_source = between('  async function openManageGlobalPlayer(', '  function openAdminAvatarEditor(')
participant_source = between('  function renderAdminParticipants(', '  async function renderAdminRegistrations(')
manage_binding = next(line for line in source.splitlines() if line.startswith("    const manage=e.target.closest('[data-v3-manage-player]');"))
escape_source = next(line for line in source.splitlines() if line.startswith('  const esc=s=>'))
legacy_search = between('  function renderFriendSearch(query="")', '  function acceptCupInvite(')
legacy_search = legacy_search.replace('function renderFriendSearch(', 'function legacyRenderFriendSearch(')
legacy_binding = next(line for line in source.splitlines()
                      if 'document.querySelector("#friendSearchInput")?.addEventListener("input"' in line)
legacy_binding = legacy_binding.replace('renderFriendSearch(', 'legacyRenderFriendSearch(')
HTML = '''<input id="friendSearchInput"><button id="friendSearchButton">Search</button>
<div id="friendSearchResults"></div><div id="friendList"></div><span id="friendCount"></span>
<div id="friendRequestList"></div><div id="cupInviteList"></div>
<input id="v3AdminAccountSearch"><span id="v3AdminOnlineBadge"></span>
<span id="v3AdminAccountOnlineCount"></span><span id="v3AdminAccountOfflineCount"></span>
<div id="v3AdminAccountOnline"></div><div id="v3AdminAccountOffline"></div>
<div id="adminParticipantRows"></div>'''
SETUP = r'''const $=(s,r=document)=>r.querySelector(s);
const live={session:{user:{id:'auth-self'}},player:{id:'self'},isAdmin:true};
const real={social:null,adminAccounts:[],adminRound:1,cupCache:new Map()};
const copy=(en,de,fr)=>({en,de,fr}[window.__language]||en);
const avatarImg=()=>''; const rankName=()=> 'Gold'; const viewerCanSeeRank=()=>true;
const MODE={1:'Solo'}; const core={rankLabel:()=> 'Gold',rankKey:()=> 'gold'};
const relativeSeen=()=> 'fixture'; const ensureAdminPrimaryNav=()=>{};
const renderMateHint=()=>{};
const toast=()=>{};const adminCup=()=>({id:'fixture-cup'});
const eventCounts=()=>({points:0,dm:0,w:0});
window.__rpcCalls=[];window.__legacyCalls=0;window.__hold=false;window.__pending=[];
window.__rows=[
 {id:'self',current_name:'MyAccount',active:true,is_ranked:true,rating:1600},
 {id:'active',current_name:'TestAccount5',active:true,is_ranked:true,rating:1621,is_online:false},
 {id:'online',current_name:'OnlineFriend',active:true,is_ranked:true,rating:1700,is_online:true},
 {id:'literal',current_name:'Literal_%_"<tag>',active:true,is_ranked:false,placement_games:3,rating:null},
 {id:'import',current_name:'ImportTestB',active:false,is_ranked:true,rating:1800},
 {id:'deleted',current_name:'DeletedAccount',active:true,deleted:true,is_ranked:true,rating:1800}];
const client={auth:{getSession:async()=>({data:{session:live.session},error:null})},
 rpc:async(name,params)=>{
   __rpcCalls.push({name,params});
   if(__hold)return new Promise(resolve=>__pending.push(resolve));
   if(name==='search_hub_friend_candidates')return {data:__rows.filter(p=>
     p.active&&!p.deleted&&p.id!==live.player?.id&&p.current_name.toLowerCase().includes(params.p_query.toLowerCase())),error:null};
   if(name==='admin_get_account_players')return {data:__rows.filter(p=>p.active&&!p.deleted),error:null};
   if(name==='admin_get_global_players')return {data:__rows.filter(p=>!p.deleted),error:null};
   throw new Error('Unexpected RPC: '+name);
 },from:table=>{
   if(table!=='player_career_stats')throw new Error('Unexpected public directory access');
   const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{},error:null})};return chain;
 }};
window.supabase={createClient:()=>client};
const PLAYERS=[{name:'ImportTestB'},{name:'DemoPlayer'}],friends=[],sentFriendRequests=[];
const state={ownPlayer:'MyAccount'};const t=x=>x;
const playerSocialRow=(name,actions)=>{__legacyCalls++;return '<div>'+name+actions+'</div>';};
'''
checks = []


def require(condition, detail):
    if not condition:
        raise AssertionError(detail)


with sync_playwright() as p:
    options = {'headless': True, 'timeout': 20000}
    executable = os.environ.get('CHROMIUM_EXECUTABLE')
    if executable:
        options['executable_path'] = executable
    browser = p.chromium.launch(**options)
    for viewport in [{'width': 1280, 'height': 900}, {'width': 390, 'height': 844}]:
        for language in ['de', 'en', 'fr']:
            context = browser.new_context(viewport=viewport, service_workers='block')
            blocked = []

            def block(route):
                blocked.append(route.request.url)
                route.abort()

            context.route('**/*', block)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.set_content(HTML)
            page.evaluate('(lang)=>window.__language=lang', language)
            page.add_script_tag(content='\n'.join([SETUP, legacy_search, legacy_binding,
                escape_source, api_source, 'const api=window.HubAPI;', social_source,
                admin_source, binding_source, invalidate_source, legacy_manage_source, participant_source,
                "document.addEventListener('click',e=>{"+manage_binding+"},true);"]))
            label = f'{viewport["width"]}px/{language}'
            assertions = 0
            try:
                # Actual legacy bubble handler is installed before the live capture handler.
                page.locator('#friendSearchInput').fill('ImportTestB')
                require(page.locator('#friendSearchResults').inner_text() == '', 'Stale/demo result on input')
                page.wait_for_timeout(250)
                require(page.locator('[data-v3-friend-add]').count() == 0, 'Import profile appeared')
                require(page.evaluate('__legacyCalls') == 0, 'Legacy bubble handler ran')
                assertions += 3
                page.locator('#friendSearchInput').fill('TestAccount5')
                page.locator('#friendSearchButton').click()
                require(page.locator('[data-v3-friend-add="active"]').count() == 1, 'Active account absent')
                before = page.evaluate('__rpcCalls.length')
                page.wait_for_timeout(250)
                require(page.evaluate('__rpcCalls.length') == before, 'Button left debounce request alive')
                assertions += 2
                page.locator('#friendSearchInput').fill('MyAccount')
                page.wait_for_timeout(250)
                require(page.locator('[data-v3-friend-add]').count() == 0, 'Self match appeared')
                page.locator('#friendSearchInput').fill('DeletedAccount')
                page.wait_for_timeout(250)
                require(page.locator('[data-v3-friend-add]').count() == 0, 'Deleted account appeared')
                assertions += 2
                page.locator('#friendSearchInput').fill('_%_')
                page.wait_for_timeout(250)
                require(page.locator('[data-v3-friend-add="literal"]').count() == 1, 'Literal query was escaped incorrectly')
                require(page.locator('#friendSearchResults tag').count() == 0, 'Name HTML executed')
                require('null' not in page.locator('#friendSearchResults').inner_text(), 'Hidden rating rendered')
                assertions += 3
                page.evaluate('real.social={friends:[],outgoing_friend_requests:[{receiver_id:"active"}]}')
                page.locator('#friendSearchInput').fill('TestAccount5')
                page.wait_for_timeout(250)
                require(page.locator('[data-v3-friend-add="active"]').is_disabled(), 'Pending request add enabled')
                require(page.locator('[data-v3-friend-add="active"]').inner_text() ==
                        {'de': 'Anfrage gesendet', 'en': 'Request sent', 'fr': 'Demande envoyée'}[language], 'Translation incorrect')
                assertions += 2
                page.evaluate('renderAdminAccountPlayers(true)')
                require('TestAccount5' in page.locator('#v3AdminAccountOffline').inner_text(), 'TestAccount5 absent in admin')
                require('ImportTestB' not in page.locator('#v3AdminAccountOffline').inner_text(), 'Admin imported profile leak')
                require(page.locator('#v3AdminAccountOnlineCount').inner_text() == '1', 'Online count incorrect')
                require(page.locator('#v3AdminAccountOfflineCount').inner_text() == '3', 'Offline count incorrect')
                require(all(call['name'] in ['search_hub_friend_candidates', 'admin_get_account_players']
                            for call in page.evaluate('__rpcCalls')), 'Wrong RPC path')
                assertions += 5
                # The imported profile is reached only by deliberately managing a Cup participant.
                page.evaluate('''() => {
                  const data={teams:[],players:[{id:'cup-import',global_player_id:'import',name:'ImportTestB'}]};
                  real.cupCache.set('fixture-cup',data);renderAdminParticipants(adminCup(),data);
                }''')
                page.locator('[data-v3-manage-player="cup-import"]').click()
                page.wait_for_selector('[data-v3-create-account]')
                require('ImportTestB' in page.locator('.v3-player-admin-modal h2').inner_text(), 'Explicit legacy management absent')
                require(page.locator('[data-v3-create-account]').count() == 1, 'Explicit account creation removed')
                require(page.locator('#v3AdminNewPassword').get_attribute('minlength') == '8', 'Password control missing')
                page.locator('.v3-player-admin-modal [data-v3-close]').click()
                assertions += 3
                # Older outstanding response cannot revive cleared search after logout.
                page.evaluate('__hold=true;void renderFriendSearch("TestAccount5")')
                page.wait_for_function('__pending.length===1')
                page.evaluate('live.session=null;live.player=null;live.isAdmin=false;document.dispatchEvent(new Event("hub:auth-restored"))')
                page.evaluate('__pending.shift()({data:[__rows[1]],error:null})')
                page.wait_for_timeout(30)
                require(page.locator('#friendSearchResults').inner_text() == '', 'Late logged-out search rendered')
                require(page.locator('#v3AdminAccountOffline').inner_text() == '', 'Admin rows survived logout')
                before = page.evaluate('__rpcCalls.length')
                page.locator('#friendSearchInput').fill('TestAccount5')
                page.wait_for_timeout(250)
                require(page.evaluate('__rpcCalls.length') == before, 'Logged-out search sent RPC')
                require(not errors, f'Browser errors: {errors}')
                require(not blocked, f'Unexpected network requests: {blocked}')
                assertions += 5
                checks.append({'case': label, 'passed': True, 'assertions': assertions})
                print(f'PASS {label}: {assertions} assertions', flush=True)
            except Exception as error:
                checks.append({'case': label, 'passed': False, 'error': str(error)})
                print(f'FAIL {label}: {error}', flush=True)
            finally:
                context.close()
    report = {'browser': browser.version, 'scope': 'isolated actual function/input-handler fixtures; synthetic RPCs',
              'production_requests': 0, 'checks': checks}
    browser.close()
if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
if not all(check['passed'] for check in checks):
    raise SystemExit(1)
