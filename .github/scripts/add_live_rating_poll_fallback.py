from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

# Prevent duplicate placement overlay when polling wins the race before realtime.
old="""  api.subscribeToPlacementEvents(evt=>{
    if(!live.player||evt.global_player_id!==live.player.id)return;
    const done=Math.max(1,Math.min(15,Number(evt.placement_game_number||0)));
    setTimeout(async()=>{"""
new="""  api.subscribeToPlacementEvents(evt=>{
    if(!live.player||evt.global_player_id!==live.player.id)return;
    const done=Math.max(1,Math.min(15,Number(evt.placement_game_number||0)));
    const beforePlacement=Number(live.player.placement_games||0);
    setTimeout(async()=>{"""
count=s.count(old)
if count!=1:
    raise SystemExit(f'placement subscription header expected once, got {count}')
s=s.replace(old,new,1)

old_anim="""        if(live.player.ranking_experience_enabled!==false&&typeof window.simulatePlacementRatingEvent==='function'){
          window.simulatePlacementRatingEvent({done,round:Number(evt.round||0)});
        }"""
new_anim="""        if(done>beforePlacement&&live.player.ranking_experience_enabled!==false&&typeof window.simulatePlacementRatingEvent==='function'){
          window.simulatePlacementRatingEvent({done,round:Number(evt.round||0)});
        }"""
count=s.count(old_anim)
if count!=1:
    raise SystemExit(f'placement animation block expected once, got {count}')
s=s.replace(old_anim,new_anim,1)

# Add a lightweight fallback poll. Realtime remains primary. This catches missed
# events and also silently reflects rating/placement decreases after edits/deletes.
marker="  restoreAuth(false).then(updateRegistrationButton);"
if s.count(marker)!=1:
    raise SystemExit(f'restoreAuth marker expected once, got {s.count(marker)}')

poll=r'''
  let liveProgressPollBusy=false;
  setInterval(async()=>{
    if(liveProgressPollBusy||document.hidden||!live.session||!live.player)return;
    liveProgressPollBusy=true;
    try{
      const beforePlacement=Number(live.player.placement_games||0);
      const beforeRating=Number(live.player.rating||0);
      const beforeRanked=!!live.player.is_ranked;
      const refreshed=await api.getMyProfile();
      if(!refreshed)return;
      const afterPlacement=Number(refreshed.placement_games||0);
      const afterRating=Number(refreshed.rating||0);
      const afterRanked=!!refreshed.is_ranked;
      const changed=afterPlacement!==beforePlacement||afterRanked!==beforeRanked||Math.abs(afterRating-beforeRating)>.001;
      if(!changed)return;

      live.player=refreshed;
      try{live.stats=await api.getCareerStatsFor(live.player.id);}catch(_){}
      await syncOwnProfileToUi();

      // Only an increase in placement count represents a newly finalized placement.
      // Deletions/recalculations can only update silently.
      if(afterPlacement>beforePlacement&&afterPlacement<=15&&live.player.ranking_experience_enabled!==false&&typeof window.simulatePlacementRatingEvent==='function'){
        window.simulatePlacementRatingEvent({done:afterPlacement});
      }
      document.dispatchEvent(new CustomEvent('hub:rating-updated',{detail:{player:live.player,pollFallback:true,placementChanged:afterPlacement!==beforePlacement}}));
    }catch(e){console.warn('Live progress fallback failed',e);}
    finally{liveProgressPollBusy=false;}
  },2000);

'''
s=s.replace(marker,poll+marker,1)

for required in [
    'let liveProgressPollBusy=false;',
    'afterPlacement>beforePlacement',
    'pollFallback:true',
    'done>beforePlacement&&live.player.ranking_experience_enabled!==false'
]:
    if required not in s:
        raise SystemExit(f'missing required live fallback code: {required}')

p.write_text(s)
print('live rating fallback patch applied')
