from pathlib import Path

p=Path('index.html')
s=p.read_text()

old_switch="$('#v3AuthSwitch',m).onclick=()=>openAuth(isLogin?'register':'login');"
new_switch="$('#v3AuthSwitch',m).onclick=()=>{if(isLogin){location.href='register.html';return;}openAuth('login');};"
if old_switch not in s:
    raise SystemExit('auth switch anchor not found')
s=s.replace(old_switch,new_switch,1)

old_restore="""      const id=await api.currentPlayerId();
      live.player=id?await api.getMyProfile():null;
      live.stats=id?await api.getCareerStatsFor(id):null;"""
new_restore="""      const id=await api.currentPlayerId();
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
if old_restore not in s:
    raise SystemExit('restoreAuth anchor not found')
s=s.replace(old_restore,new_restore,1)

# Disable any remaining old inline registration entry points that explicitly open the legacy modal.
s=s.replace("openAuth('register')","location.href='register.html'")
s=s.replace('openAuth("register")','location.href="register.html"')

p.write_text(s)
print('Phase 11 registration routing patched')
