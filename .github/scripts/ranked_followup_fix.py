from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

def replace_once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)
    print(label,'ok')

# 1) Public ranked-player history RPC in HubAPI.
replace_once(
"  async function getMyCompetitiveHistory() { const data=await rpc('get_my_competitive_history'); return data||[]; }",
"  async function getMyCompetitiveHistory() { const data=await rpc('get_my_competitive_history'); return data||[]; }\n  async function getCompetitiveHistoryForPlayer(playerId) { const data=await rpc('get_competitive_history_for_player',{p_player_id:playerId}); return data||[]; }",
'add public player history API')

replace_once(
"return { client,signUp,login,logout,currentSession,currentPlayerId,getPlayer,getMyProfile,getCareerStatsFor,getRatingHistory,getMyCompetitiveHistory,getGlobalPlayers,adminGetGlobalPlayers,adminGetAccountPlayers,searchPlayers,",
"return { client,signUp,login,logout,currentSession,currentPlayerId,getPlayer,getMyProfile,getCareerStatsFor,getRatingHistory,getMyCompetitiveHistory,getCompetitiveHistoryForPlayer,getGlobalPlayers,adminGetGlobalPlayers,adminGetAccountPlayers,searchPlayers,",
'export public player history API')

# 2) Foreign ranked profiles use the same shaped history as own profile.
old_hist="try{let hist=own?await api.getMyCompetitiveHistory():await api.getRatingHistory(gp.id);if(!own)hist=(hist||[]).map((x,i)=>({...x,game_number:i+1,final_delta:i<15?null:x.final_delta,rating_after:i<15?null:x.rating_after}));renderHistoryGraph(hist);}catch(_){renderHistoryGraph([]);}"
new_hist="try{const hist=own?await api.getMyCompetitiveHistory():await api.getCompetitiveHistoryForPlayer(gp.id);renderHistoryGraph(hist);}catch(err){console.error('profile history',err);renderHistoryGraph([]);}"
replace_once(old_hist,new_hist,'foreign profile history RPC')

# 3) History control belongs below the rows, not in the header.
old_toggle="""    let toggle=panel.querySelector('.v3-history-toggle');const oldTag=panel.querySelector('.panel-header .mode-tag');if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='mode-tag v3-history-toggle';oldTag?.replaceWith(toggle);toggle.onclick=()=>{renderHistoryGraphV4.expanded=!renderHistoryGraphV4.expanded;renderHistoryGraphV4(renderHistoryGraphV4._history||[]);};}
    const maxRows=renderHistoryGraphV4.expanded?40:10;toggle.textContent=renderHistoryGraphV4.expanded?copy('Show latest 10','Nur letzte 10','Afficher les 10 dernières'):copy('Show up to 40','Bis zu 40 anzeigen','Afficher jusqu’à 40');toggle.disabled=h.length<=10;
"""
new_toggle="""    const headerTag=panel.querySelector('.panel-header .mode-tag');
    const maxRows=renderHistoryGraphV4.expanded?40:10;
    if(headerTag)headerTag.textContent=renderHistoryGraphV4.expanded?copy('Latest 40 games','Letzte 40 Games','40 dernières parties'):copy('Latest 10 games','Letzte 10 Games','10 dernières parties');
"""
replace_once(old_toggle,new_toggle,'move history toggle out of header')

replace_once(
"    chart.innerHTML=graph+rows;",
"    const more=h.length>10?`<div class=\"v3-history-more\"><button type=\"button\" class=\"ghost-button v3-history-more-button\">${renderHistoryGraphV4.expanded?copy('Show less','Weniger anzeigen','Afficher moins'):copy('Show more','Mehr anzeigen','Afficher plus')}</button></div>`:'';\n    chart.innerHTML=graph+rows+more;\n    chart.querySelector('.v3-history-more-button')?.addEventListener('click',()=>{renderHistoryGraphV4.expanded=!renderHistoryGraphV4.expanded;renderHistoryGraphV4(renderHistoryGraphV4._history||[]);});",
'history bottom show-more button')

# 4) Fix the overview ranking grid. An older V3.1 rule still defines only four
# columns for .compact-list .v3-real-ranking-row while the live row has five.
fix_css='''\n<style id="hub-ranked-followup-fixes">\n  #overviewRankingRows.compact-list .v3-real-ranking-row{grid-template-columns:50px 1.55fr 1fr .8fr .7fr!important}\n  #overviewRankingRows.compact-list .v3-real-ranking-row>.placement{text-align:center}\n  #overviewRankingRows.compact-list .v3-real-ranking-row>.player-name{min-width:0}\n  #overviewRankingRows.compact-list .v3-real-ranking-row>.rank-cell{min-width:0;justify-content:flex-start}\n  #overviewRankingRows.compact-list .v3-real-ranking-row>.rating{text-align:left}\n  #overviewRankingRows.compact-list .v3-real-ranking-row>.trend{text-align:left!important;display:block!important}\n  .v3-history-more{display:flex;justify-content:center;padding:14px 0 2px}\n  .v3-history-more-button{min-width:190px}\n  .history-panel .panel-header .mode-tag{pointer-events:none}\n  @media(max-width:760px){\n    #overviewRankingRows.compact-list .v3-real-ranking-row{grid-template-columns:44px minmax(150px,1fr) 120px 70px!important}\n    #overviewRankingRows.compact-list .v3-real-ranking-row>.trend{display:none!important}\n  }\n</style>\n'''
if 'id="hub-ranked-followup-fixes"' in s:
    raise SystemExit('follow-up style already exists')
s=s.replace('</head>',fix_css+'\n</head>',1)

# Sanity checks.
checks=[
 "get_competitive_history_for_player",
 "getCompetitiveHistoryForPlayer",
 "Mehr anzeigen",
 "v3-history-more-button",
 "grid-template-columns:50px 1.55fr 1fr .8fr .7fr!important",
]
for x in checks:
    if x not in s: raise SystemExit('missing expected patch: '+x)
if old_hist in s: raise SystemExit('old foreign history path still present')
if "oldTag?.replaceWith(toggle)" in s: raise SystemExit('old header toggle still present')

p.write_text(s)
print('ranked follow-up assertions passed')
