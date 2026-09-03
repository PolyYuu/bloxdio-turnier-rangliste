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

# 1) Subscribe to the sanitized placement notification table.
old="  function subscribeToRatingEvents(onInsert) { return client.channel('hub-rating-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'rating_history'},p=>onInsert(p.new)).subscribe(); }"
new=old+"\n  function subscribeToPlacementEvents(onInsert) { return client.channel('hub-placement-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'placement_update_notifications'},p=>onInsert(p.new)).subscribe(); }"
replace_once(old,new,'placement realtime API')

old_export="heartbeatPresence,clearPresence,adminGetOnlinePlayers,subscribeToRatingEvents,subscribeToSocial,subscribeToCup,subscribeToStats };"
new_export="heartbeatPresence,clearPresence,adminGetOnlinePlayers,subscribeToRatingEvents,subscribeToPlacementEvents,subscribeToSocial,subscribeToCup,subscribeToStats };"
replace_once(old_export,new_export,'export placement realtime API')

# 2) Keep ranked updates on rating_history, but give placement users their own sanitized overlay.
pattern=r"  api\.subscribeToRatingEvents\(evt=>\{.*?\n  \}\);\n\n  restoreAuth\(false\)\.then\(updateRegistrationButton\);"
m=re.search(pattern,s,re.S)
if not m:
    raise SystemExit('rating realtime block not found')
new_block=r'''  api.subscribeToRatingEvents(evt=>{
    if(!live.player||evt.global_player_id!==live.player.id)return;
    const wasRanked=!!live.player.is_ranked;
    // Only already-ranked users can read rating_history; their delta/rank overlay remains unchanged.
    if(wasRanked&&live.player.ranking_experience_enabled!==false&&typeof window.simulateRealtimeRatingEvent==='function'){
      window.simulateRealtimeRatingEvent({rankUp:evt.rank_before&&evt.rank_after&&evt.rank_before!==evt.rank_after});
    }
    setTimeout(async()=>{
      try{
        live.player=await api.getMyProfile();
        live.stats=await api.getCareerStatsFor(live.player.id);
        await syncOwnProfileToUi();
        document.dispatchEvent(new CustomEvent('hub:rating-updated',{detail:{event:evt,player:live.player}}));
      }catch(e){console.error(e);}
    },120);
  });

  api.subscribeToPlacementEvents(evt=>{
    if(!live.player||evt.global_player_id!==live.player.id)return;
    const done=Math.max(1,Math.min(15,Number(evt.placement_game_number||0)));
    setTimeout(async()=>{
      try{
        // The notification and global-player update commit together, but retry briefly to avoid any UI race.
        let refreshed=null;
        for(let i=0;i<5;i++){
          refreshed=await api.getMyProfile();
          if(Number(refreshed?.placement_games||0)>=done)break;
          await new Promise(r=>setTimeout(r,90));
        }
        if(refreshed)live.player=refreshed;
        live.stats=await api.getCareerStatsFor(live.player.id);
        await syncOwnProfileToUi();
        if(live.player.ranking_experience_enabled!==false&&typeof window.simulatePlacementRatingEvent==='function'){
          window.simulatePlacementRatingEvent({done,round:Number(evt.round||0)});
        }
        document.dispatchEvent(new CustomEvent('hub:rating-updated',{detail:{event:evt,player:live.player,placement:true}}));
      }catch(e){console.error('Placement realtime update failed',e);}
    },120);
  });

  restoreAuth(false).then(updateRegistrationButton);'''
s=s[:m.start()]+new_block+s[m.end():]
print('placement overlay hook ok')

# 3) Refresh every visible live surface immediately after the account script has refreshed the player.
needle="  api.subscribeToSocial(scheduleRefresh);api.subscribeToCup(scheduleRefresh);api.subscribeToStats(scheduleRefresh);"
replacement=needle+"\n  document.addEventListener('hub:rating-updated',scheduleRefresh);"
replace_once(needle,replacement,'visible surface rating refresh')

# 4) Make the import toast explicit about the two-step flow.
s=s.replace(
    "Runde importiert. Das Rating wurde NOCH NICHT finalisiert.",
    "Runde importiert. Cup-Stats sind live; Placement und Rating-Overlay folgen erst nach „Rating finalisieren“.",
    1
)

# Guards
for required in [
    "subscribeToPlacementEvents",
    "placement_update_notifications",
    "simulatePlacementRatingEvent({done,round:Number(evt.round||0)})",
    "document.addEventListener('hub:rating-updated',scheduleRefresh)",
]:
    if required not in s:
        raise SystemExit(f'missing required patch: {required}')
if "Placement users never see the hidden delta" in s:
    raise SystemExit('old placement suppression comment still present')

p.write_text(s)
print('all placement realtime assertions passed')
