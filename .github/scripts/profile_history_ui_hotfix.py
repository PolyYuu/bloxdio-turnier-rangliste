from pathlib import Path
import re

p = Path('index.html')
s = p.read_text()

def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'{label}: expected text not found')
    s = s.replace(old, new, 1)
    print(f'{label}: patched')

# Loading logo ~25% larger.
count = s.count('width:248px!important')
if count == 2:
    s = s.replace('width:248px!important', 'width:310px!important')
elif s.count('width:310px!important') < 2:
    raise SystemExit(f'loader logo: unexpected state (248={count}, 310={s.count("width:310px!important")})')

# One canonical placement sentence.
s = s.replace('Das Rating bleibt bis Placement 15 unsichtbar.', 'Dein verstecktes Rating wird erst nach Einrankungsrunde 15 angezeigt.')
s = s.replace('Rating is hidden until placement 15.', 'Your hidden rating is not shown until placement 15.')
s = s.replace('Rating caché jusqu’à la 15e manche.', 'Ton rating caché reste invisible jusqu’à la 15e manche.')

# Own profile: freshest account object wins over stale directory copy.
old_gp = "const gp=live.globalPlayers.find(p=>p.current_name===name)||(name===live.player.current_name?live.player:null);"
new_gp = "const gp=(name===live.player.current_name?live.player:null)||live.globalPlayers.find(p=>p.current_name===name);"
if old_gp in s:
    s = s.replace(old_gp, new_gp, 1)
elif new_gp not in s:
    raise SystemExit('own profile data resolver not found')

# Remove legacy/demo renderer from own-profile opening.
old_open = """async function openOwnProfile(){
    if(!live.session)return openAuth('login');
    try { state.profilePlayer=state.ownPlayer; renderProfile(); } catch(_){}
    setPage('profile'); await syncOwnProfileToUi();
  }"""
new_open = """async function openOwnProfile(){
    if(!live.session)return openAuth('login');
    const name=live.player?.current_name||state.ownPlayer;
    if(!name)return;
    state.ownPlayer=name;state.profilePlayer=name;
    await renderProfileLive(name);
    setPage('profile');
  }"""
if old_open in s:
    s = s.replace(old_open, new_open, 1)
elif new_open not in s:
    raise SystemExit('openOwnProfile target not found')

old_sync = "try { state.ownPlayer=live.player.current_name; state.profilePlayer=live.player.current_name; renderProfile(); } catch(_){}"
new_sync = "state.ownPlayer=live.player.current_name; state.profilePlayer=live.player.current_name;"
if old_sync in s:
    s = s.replace(old_sync, new_sync, 1)
elif new_sync not in s:
    raise SystemExit('syncOwnProfileToUi legacy renderer target not found')

# Keep the global directory copy synchronized immediately after avatar save.
old_avatar = "live.player.avatar_pixels=pixels;cacheAvatar(live.player);const av=$('#profileAvatar');if(av)av.src=pixelDataUrl(pixels);"
new_avatar = "live.player.avatar_pixels=pixels;const ownGp=(live.globalPlayers||[]).find(p=>p.id===live.player.id);if(ownGp)ownGp.avatar_pixels=pixels;cacheAvatar(live.player);const av=$('#profileAvatar');if(av)av.src=pixelDataUrl(pixels);"
if old_avatar in s:
    s = s.replace(old_avatar, new_avatar, 1)
elif new_avatar not in s:
    raise SystemExit('avatar save target not found')

# Replace late profile routing with one live-only capture listener.
old_click = """document.addEventListener('click',e=>{
    if(e.target.closest('[data-route=\"profile\"]')&&live.session)setTimeout(()=>openOwnProfile(),0);
    const foreign=e.target.closest('[data-profile-player]');if(foreign&&live.session)setTimeout(()=>refreshForeignProfile(foreign.dataset.profilePlayer),0);
  });"""
new_click = """document.addEventListener('click',e=>{
    const ownRoute=e.target.closest('[data-route=\"profile\"]');
    if(ownRoute){
      e.preventDefault();e.stopImmediatePropagation();
      if(!live.session){openAuth('login');return;}
      openOwnProfile().catch(err=>toast(err?.message||String(err),true));
      return;
    }
    const foreign=e.target.closest('[data-profile-player]');
    if(foreign){
      e.preventDefault();e.stopImmediatePropagation();
      if(!live.session){openAuth('login');return;}
      const name=foreign.dataset.profilePlayer;
      state.profilePlayer=name;
      Promise.resolve(renderProfileLive(name)).then(()=>setPage('profile')).catch(err=>toast(err?.message||String(err),true));
    }
  },true);"""
if old_click in s:
    s = s.replace(old_click, new_click, 1)
elif new_click not in s:
    raise SystemExit('profile click routing target not found')

# Restore beta-style live rating graph. The graph exists only when Game 16+ is public.
if 'function renderHistoryGraphV4(history)' not in s:
    graph_impl = r'''
  function renderHistoryGraphV4(history){
    const panel=$('.history-panel'),recent=$('[data-page="profile"] .recent-updates');if(!panel||!recent)return;
    const h=(history||[]).slice(-40),chart=$('.chart',panel),updates=$('.update-list',recent);if(!chart||!updates)return;
    if(!h.length){chart.innerHTML=`<p class="v3-empty">${copy('No competitive games yet.','Noch keine Competitive-Games gespielt.','Aucune partie compétitive.')}</p>`;updates.innerHTML='';recent.hidden=true;return;}
    const rows=`<div class="v3-history-list">${h.map((x,idx)=>{
      const game=Number(x.game_number||idx+1),hidden=x.final_delta===null||x.final_delta===undefined||game<=15;
      const delta=hidden?copy('HIDDEN','VERDECKT','CACHÉ'):`${Number(x.final_delta)>=0?'+':''}${Math.round(Number(x.final_delta))}`;
      return `<div class="v3-history-row"><div class="v3-history-game"><strong>Game ${game}</strong><small>${copy('Round','Runde','Manche')} ${Number(x.round||0)}</small></div><div class="v3-history-cup"><strong>${esc(x.tournament_name||copy('Competitive Cup','Competitive Cup','Cup compétitif'))}</strong><small>${x.created_at?new Date(x.created_at).toLocaleDateString():''}</small></div><div class="v3-history-stats"><i>K ${Number(x.round_kills||0)}</i><i>DM ${Number(x.round_deathmatches||0)}</i><i>W ${Number(x.round_wins||0)}</i><i>PTS ${Number(x.individual_points||0)}</i></div><div class="v3-history-delta ${hidden?'hidden-rating':Number(x.final_delta)>=0?'positive':'negative'}">${delta}</div></div>`;
    }).join('')}</div>`;
    const ranked=h.filter((x,idx)=>Number(x.game_number||idx+1)>=16&&x.rating_after!==null&&x.rating_after!==undefined&&Number.isFinite(Number(x.rating_after)));
    let graph='';
    if(ranked.length){
      const first=ranked[0],firstGame=Number(first.game_number||16),firstAfter=Number(first.rating_after),firstDelta=Number(first.final_delta||0);
      const points=[{game:Math.max(15,firstGame-1),rating:firstAfter-firstDelta,start:true},...ranked.map((x,idx)=>({game:Number(x.game_number||firstGame+idx),rating:Number(x.rating_after)}))];
      const vals=points.map(x=>x.rating);let lo=Math.min(...vals),hi=Math.max(...vals),span=Math.max(100,hi-lo),pad=Math.max(25,span*.18);
      lo=Math.floor((lo-pad)/25)*25;hi=Math.ceil((hi+pad)/25)*25;
      if(hi-lo<100){const mid=(hi+lo)/2;lo=Math.floor((mid-50)/25)*25;hi=lo+100;}
      const W=720,H=236,L=12,R=12,T=12,B=24,plotW=W-L-R,plotH=H-T-B;
      const xAt=i=>L+(points.length===1?plotW/2:(i/(points.length-1))*plotW),yAt=v=>T+((hi-v)/(hi-lo))*plotH;
      const coords=points.map((pt,i)=>[xAt(i),yAt(pt.rating)]),line=coords.map((c,i)=>`${i?'L':'M'} ${c[0].toFixed(2)} ${c[1].toFixed(2)}`).join(' ');
      const area=`${line} L ${coords[coords.length-1][0].toFixed(2)} ${(T+plotH).toFixed(2)} L ${coords[0][0].toFixed(2)} ${(T+plotH).toFixed(2)} Z`;
      const ticks=Array.from({length:5},(_,i)=>hi-(hi-lo)*(i/4));
      graph=`<div class="v3-rating-graph"><div class="v3-rating-ylabels">${ticks.map(v=>`<span>${Math.round(v)}</span>`).join('')}</div><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Rating Verlauf"><defs><linearGradient id="v3RatingFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38ead8" stop-opacity=".30"/><stop offset="100%" stop-color="#38ead8" stop-opacity=".025"/></linearGradient></defs>${ticks.map(v=>`<line class="v3-rating-grid" x1="${L}" y1="${yAt(v)}" x2="${W-R}" y2="${yAt(v)}"/>`).join('')}<path class="v3-rating-area" d="${area}"/><path class="v3-rating-line" d="${line}"/>${coords.map((c,i)=>`<circle class="v3-rating-point" cx="${c[0]}" cy="${c[1]}" r="3"><title>${points[i].start?copy('Starting rating','Start-Rating','Rating initial'):`Game ${points[i].game}`}: ${Math.round(points[i].rating)}</title></circle>`).join('')}</svg><div class="v3-rating-xlabels"><span>${copy('START','START','DÉBUT')}</span><span>Game ${points[points.length-1].game}</span></div></div>`;
    }
    chart.innerHTML=graph+rows;
    const visible=h.filter((x,idx)=>Number(x.game_number||idx+1)>=16&&x.final_delta!==null&&x.final_delta!==undefined).slice(-5).reverse();
    recent.hidden=!visible.length;updates.innerHTML=visible.map(x=>`<div><span>Game ${Number(x.game_number||0)}</span><strong class="${Number(x.final_delta)>=0?'positive':'negative'}">${Number(x.final_delta)>=0?'+':''}${Math.round(Number(x.final_delta))}</strong></div>`).join('');
  }
  renderHistoryGraph=renderHistoryGraphV4;
'''
    marker = '  async function renderProfileLive(name){'
    if marker not in s:
        raise SystemExit('renderProfileLive marker not found')
    s = s.replace(marker, graph_impl + '\n' + marker, 1)

if 'id="v3-rating-graph-v4"' not in s:
    css = r'''
  <style id="v3-rating-graph-v4">
    .v3-rating-graph{position:relative;height:270px;margin:2px 0 18px;padding:8px 12px 28px 46px;border-bottom:1px solid rgba(121,78,210,.18);box-sizing:border-box}
    .v3-rating-graph svg{display:block;width:100%;height:100%;overflow:visible}
    .v3-rating-grid{stroke:rgba(128,102,182,.12);stroke-width:1;vector-effect:non-scaling-stroke}.v3-rating-area{fill:url(#v3RatingFill)}
    .v3-rating-line{fill:none;stroke:#38ead8;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 6px rgba(56,234,216,.24))}
    .v3-rating-point{fill:#38ead8;stroke:#0b071c;stroke-width:1.5;vector-effect:non-scaling-stroke}
    .v3-rating-ylabels{position:absolute;left:4px;top:17px;bottom:37px;width:38px;display:flex;flex-direction:column;justify-content:space-between;color:#706486;font:700 8px/1 Montserrat,sans-serif;text-align:right}
    .v3-rating-xlabels{position:absolute;left:52px;right:13px;bottom:8px;display:flex;justify-content:space-between;color:#706486;font:800 7px/1 Montserrat,sans-serif;letter-spacing:.04em}
    @media(max-width:700px){.v3-rating-graph{height:220px;padding-left:38px}.v3-rating-ylabels{width:31px;font-size:7px}.v3-rating-xlabels{left:44px}}
  </style>
'''
    s = s.replace('</head>', css + '\n</head>', 1)

p.write_text(s)

assert s.count('width:310px!important') >= 2
assert 'function renderHistoryGraphV4(history)' in s
assert 'id="v3-rating-graph-v4"' in s
assert 'Dein verstecktes Rating wird erst nach Einrankungsrunde 15 angezeigt.' in s
assert new_gp in s
assert 'try { state.profilePlayer=state.ownPlayer; renderProfile(); } catch(_){}' not in s
print('profile/history UI patch complete')
