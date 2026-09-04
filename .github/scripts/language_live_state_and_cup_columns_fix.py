from pathlib import Path

p=Path('index.html')
s=p.read_text()

def rep(old,new,label,count=1):
    global s
    n=s.count(old)
    if n!=count:
        raise SystemExit(f'{label}: expected {count}, got {n}')
    s=s.replace(old,new,count)
    print(label,'ok')

# 1) Language changes must never execute legacy/demo data renderers.
legacy_tail='  renderRankFilter();renderOverviewRanking();renderFullRanking();renderCupTeams();renderCupIndividual();showRound(Number(document.querySelector("#roundPicker .active")?.dataset.round||1));renderRegistrations();renderProfile();renderOverviewRank();renderAdmin();'
rep(legacy_tail,'  renderRankFilter();', 'remove demo renderers from applyLanguage')

# 2) Make the upcoming Cup columns independent, so only the registered-player list grows.
css='''\n<style id="hub-live-language-cup-column-fix">\n  #upcomingCupView .upcoming-grid{align-items:start!important}\n  #upcomingCupView .v3-upcoming-left{display:grid;gap:16px;align-self:start;min-width:0}\n  #upcomingCupView .v3-upcoming-left>.registration-hero,\n  #upcomingCupView .v3-upcoming-left>.rules-card{width:100%;align-self:start}\n  #upcomingCupView .registered-list-card{align-self:start!important;min-width:0}\n  @media(max-width:1080px){#upcomingCupView .v3-upcoming-left{gap:16px}}\n</style>\n'''
if 'id="hub-live-language-cup-column-fix"' in s:
    raise SystemExit('column style already exists')
s=s.replace('</head>',css+'\n</head>',1)
print('column css ok')

# 3) Re-parent the two left cards into their own column. Safe to call repeatedly.
marker='''  function nextRegistrationCup(){\n    const regs=(real.cups||[]).filter(c=>c.status==='registration');if(!regs.length)return null;\n    const now=Date.now(),dated=regs.map(c=>({c,t:cupStartMs(c)}));\n    return dated.filter(x=>x.t!==null&&x.t>=now).sort((a,b)=>a.t-b.t)[0]?.c||dated.filter(x=>x.t!==null).sort((a,b)=>b.t-a.t)[0]?.c||regs[0];\n  }\n  async function refreshCups(){'''
replacement='''  function nextRegistrationCup(){\n    const regs=(real.cups||[]).filter(c=>c.status==='registration');if(!regs.length)return null;\n    const now=Date.now(),dated=regs.map(c=>({c,t:cupStartMs(c)}));\n    return dated.filter(x=>x.t!==null&&x.t>=now).sort((a,b)=>a.t-b.t)[0]?.c||dated.filter(x=>x.t!==null).sort((a,b)=>b.t-a.t)[0]?.c||regs[0];\n  }\n  function ensureUpcomingColumnLayout(){\n    const grid=$('#upcomingCupView .upcoming-grid');if(!grid)return;\n    const hero=$('.registration-hero',grid),rules=$('.rules-card',grid),registered=$('.registered-list-card',grid);\n    if(!hero||!rules||!registered)return;\n    let left=$('.v3-upcoming-left',grid);\n    if(!left){left=document.createElement('div');left.className='v3-upcoming-left';grid.insertBefore(left,registered);}\n    if(hero.parentElement!==left)left.appendChild(hero);\n    if(rules.parentElement!==left)left.appendChild(rules);\n  }\n  async function refreshCups(){\n    ensureUpcomingColumnLayout();'''
rep(marker,replacement,'independent Cup columns')

# 4) After a language change, re-render the real Supabase-backed surfaces immediately.
refresh_block='''  async function refreshEveryVisibleSurface(){\n    try{\n      if(live.session&&live.player){const latest=await api.getMyProfile();if(latest)live.player=latest;live.stats=await api.getCareerStatsFor(live.player.id);}\n      live.globalPlayers=await api.getGlobalPlayers();await refreshFakeProfiles();renderRealRanking();await renderOwnOverview();await refreshSocial();await refreshCups();\n      if(location.hash==='#profile'&&live.player){const shown=(window.state?.profilePlayer)||live.player.current_name;await renderProfileLive(shown);}\n      if(live.isAdmin&&real.adminSection==='players')await renderAdminAccountPlayers(true);\n    }catch(e){console.error('live surface refresh',e);}\n  }\n  function scheduleRefresh(){clearTimeout(real.refreshTimer);real.refreshTimer=setTimeout(refreshEveryVisibleSurface,180);}'''
live_lang='''  async function refreshEveryVisibleSurface(){\n    try{\n      if(live.session&&live.player){const latest=await api.getMyProfile();if(latest)live.player=latest;live.stats=await api.getCareerStatsFor(live.player.id);}\n      live.globalPlayers=await api.getGlobalPlayers();await refreshFakeProfiles();renderRealRanking();await renderOwnOverview();await refreshSocial();await refreshCups();\n      if(location.hash==='#profile'&&live.player){const shown=(window.state?.profilePlayer)||live.player.current_name;await renderProfileLive(shown);}\n      if(live.isAdmin&&real.adminSection==='players')await renderAdminAccountPlayers(true);\n    }catch(e){console.error('live surface refresh',e);}\n  }\n  const liveApplyLanguage=applyLanguage;\n  applyLanguage=function(lang){\n    liveApplyLanguage(lang);\n    Promise.resolve().then(refreshEveryVisibleSurface).catch(e=>console.error('language live refresh',e));\n  };\n  function scheduleRefresh(){clearTimeout(real.refreshTimer);real.refreshTimer=setTimeout(refreshEveryVisibleSurface,180);}'''
rep(refresh_block,live_lang,'live language refresh wrapper')

# Guards
for needle in [
    'renderRankFilter();\n}',
    'function ensureUpcomingColumnLayout()',
    'className=\'v3-upcoming-left\'',
    'const liveApplyLanguage=applyLanguage;',
    'Promise.resolve().then(refreshEveryVisibleSurface)',
    'hub-live-language-cup-column-fix'
]:
    if needle not in s: raise SystemExit('missing guard '+needle)
if legacy_tail in s: raise SystemExit('legacy language render tail still present')

p.write_text(s)
print('language/live Cup layout patch complete')
