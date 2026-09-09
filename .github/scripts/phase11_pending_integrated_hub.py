from pathlib import Path

p=Path('index.html')
s=p.read_text()

old="""      const id=await api.currentPlayerId();
      if(!id){
        try{
          const {data:registrationState}=await api.client.rpc('get_my_registration_status');
          if(registrationState?.status==='pending'){
            location.href='pending.html';
            return;
          }
        }catch(_pendingRouteError){}
      }
      live.player=id?await api.getMyProfile():null;
      live.stats=id?await api.getCareerStatsFor(id):null;"""
new="""      const id=await api.currentPlayerId();
      let registrationState=null;
      if(!id){
        try{
          const {data}=await api.client.rpc('get_my_registration_status');
          registrationState=data||null;
        }catch(_pendingStateError){}
      }
      live.registrationState=registrationState;
      live.player=id?await api.getMyProfile():null;
      live.stats=id?await api.getCareerStatsFor(id):null;"""
if old not in s:
    raise SystemExit('pending redirect anchor not found')
s=s.replace(old,new,1)

old_event="""      document.dispatchEvent(new CustomEvent('hub:auth-restored',{detail:{loggedIn:!!live.player,player:live.player}}));"""
new_event="""      document.dispatchEvent(new CustomEvent('hub:auth-restored',{detail:{loggedIn:!!live.session,player:live.player,pending:registrationState?.status==='pending',registrationState}}));"""
if old_event not in s:
    raise SystemExit('auth restored event anchor not found')
s=s.replace(old_event,new_event,1)

# Pending accounts should be able to browse normal public HUB pages.
# Profile route is handled by pending-hub.js; do not force a fake linked player.
marker='</body>'
script='<script src="pending-hub.js"></script>\n'
if script not in s:
    if marker not in s: raise SystemExit('body closing tag not found')
    s=s.replace(marker,script+marker,1)

p.write_text(s)
print('Pending accounts integrated into normal HUB')
