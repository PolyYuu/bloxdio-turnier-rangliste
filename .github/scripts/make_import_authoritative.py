from pathlib import Path
import re

p=Path('index.html')
s=p.read_text()

def replace_once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected exactly 1 occurrence, got {n}')
    s=s.replace(old,new,1)
    print(label,'ok')

# API: name-based authoritative import RPC.
old_api="  async function adminReplaceRound(tournamentId,round,results) { return rpc('replace_round_results',{p_tournament_id:tournamentId,p_round:round,p_results:results}); }"
new_api=old_api+"\n  async function adminImportRoundByName(tournamentId,round,results) { return rpc('import_round_results_by_name',{p_tournament_id:tournamentId,p_round:round,p_results:results}); }"
replace_once(old_api,new_api,'add name-based import API')

old_return="adminAddPlayerToCup,adminStartNextRound,adminDeleteRound,adminAdjustEvent,adminReplaceRound,adminRenamePlayer,adminSetRating,adminSetPeak,"
new_return="adminAddPlayerToCup,adminStartNextRound,adminDeleteRound,adminAdjustEvent,adminReplaceRound,adminImportRoundByName,adminRenamePlayer,adminSetRating,adminSetPeak,"
replace_once(old_return,new_return,'export name-based import API')

# Frontend parser: registration/tournament rows are no longer prerequisites.
# Parse the familiar import format line-by-line instead of resolving against
# already-created tournament teams/players.
pattern=r"  function parseOldImport\(text,cup,data\)\{.*?\n  function openImport\(\)\{"
match=re.search(pattern,s,re.S)
if not match:
    raise SystemExit('parseOldImport block not found')
new_parser=r'''  function parseOldImport(text,cup,data){
    const sections=[];
    let current=null;
    const flush=()=>{
      if(!current)return;
      const body=current.lines.join(' ').trim();
      if(!body)throw new Error(`No players for ${current.name}.`);
      const entries=body.split(',').map(x=>x.trim()).filter(Boolean);
      const players=entries.map(entry=>{
        const colon=entry.indexOf(':');
        if(colon<1)throw new Error(`Invalid player entry at ${current.name}: ${entry}`);
        const name=entry.slice(0,colon).trim();
        const stats=entry.slice(colon+1).trim();
        if(!name)throw new Error(`Missing player name at ${current.name}.`);
        return {name,...parseStats(stats)};
      });
      sections.push({name:current.name,hex:current.hex,players});
      current=null;
    };
    for(const raw of String(text).replace(/\r/g,'').split('\n')){
      const line=raw.trim();
      if(!line)continue;
      if(line.endsWith(':')){
        const label=line.slice(0,-1).trim();
        const color=COLOR_MAP.get(label.toLowerCase());
        if(color){
          flush();
          current={name:color[0],hex:color[1],lines:[]};
          continue;
        }
      }
      if(!current)throw new Error(`Invalid import line: ${line}`);
      current.lines.push(line);
    }
    flush();
    if(!sections.length)throw new Error(copy('No valid team sections found.','Keine gültigen Teamabschnitte gefunden.','Aucune section valide.'));
    const resolved=[];const used=new Set();
    for(const sec of sections){
      for(const input of sec.players){
        const key=input.name.toLowerCase();
        if(used.has(key))throw new Error(`${input.name} duplicated.`);
        used.add(key);
        resolved.push({team_name:sec.name,team_color:sec.hex,player_name:input.name,k:input.k,dm:input.dm,w:input.w});
      }
    }
    if(resolved.filter(x=>x.w===1).length>1)throw new Error('Only one player may have w:1.');
    return resolved;
  }
  function openImport(){'''
s=s[:match.start()]+new_parser+s[match.end():]
print('replace tournament-dependent import parser ok')

replace_once(
    "await api.adminReplaceRound(cup.id,real.adminRound,results);",
    "await api.adminImportRoundByName(cup.id,real.adminRound,results);",
    'use authoritative name-based import'
)

# Explain the intended semantics in the import dialog.
needle="Old names are not accepted.','Der Import gleicht ausschließlich die aktuellen Ingame-Namen ab. Alte Namen werden nicht akzeptiert.','Seuls les pseudos actuels sont acceptés.')}"
replacement="Old names are not accepted. Registrations are optional; missing teams and players are created from this import.','Der Import gleicht ausschließlich die aktuellen Ingame-Namen ab. Alte Namen werden nicht akzeptiert. Registrierungen sind optional; fehlende Teams und Spieler werden durch diesen Import automatisch als Turnierteilnehmer angelegt.','Seuls les pseudos actuels sont acceptés. Les inscriptions sont facultatives ; les équipes et joueurs manquants sont créés par cet import.')}"
replace_once(needle,replacement,'update import help copy')

# Guards.
if "Team not found" in s or "Team nicht gefunden" in s:
    raise SystemExit('old tournament-team prerequisite still present')
if "adminImportRoundByName" not in s or "import_round_results_by_name" not in s:
    raise SystemExit('new import API missing')
if "team_name:sec.name" not in s or "player_name:input.name" not in s:
    raise SystemExit('name-based parser payload missing')
if "await api.adminImportRoundByName(cup.id,real.adminRound,results);" not in s:
    raise SystemExit('import dialog not wired to new RPC')

p.write_text(s)
print('all authoritative-import assertions passed')
