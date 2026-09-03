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
pattern=r"  function parseOldImport\(text,cup,data\)\{.*?\n  function openImport\(\)\{"
match=re.search(pattern,s,re.S)
if not match:
    raise SystemExit('parseOldImport block not found')
new_parser=r'''  function parseOldImport(text,cup,data){
    const colorPattern=COLORS.map(c=>c[0].replace(' ','\\s+')).join('|');
    const sectionRegex=new RegExp(`(?:^|\\n)\\s*(${colorPattern})\\s*:\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:${colorPattern})\\s*:)|$)`,'gi');
    const sections=[];let match;
    while((match=sectionRegex.exec(String(text).replace(/\\r/g,'')))){
      const color=COLOR_MAP.get(match[1].replace(/\\s+/g,' ').toLowerCase());
      const players=[];
      const playerRegex=/(?:^|,)\\s*([^,:\\n]+?)\\s*:\\s*(\\/|(?:(?:k|dm|w)\\s*:\\s*-?\\d+\\s*)+)\\s*(?=,|$)/gi;
      let pm;const sectionText=match[2].trim().replace(/,+\\s*$/,'');const covered=Array(sectionText.length).fill(false);
      while((pm=playerRegex.exec(sectionText))){players.push({name:pm[1].trim(),...parseStats(pm[2])});for(let i=pm.index;i<playerRegex.lastIndex;i++)covered[i]=true;}
      const unparsed=[...sectionText].filter((ch,i)=>!covered[i]&&!/[\\s,]/.test(ch)).join('');
      if(unparsed)throw new Error(`Invalid import content at ${color[0]}.`);
      if(!players.length)throw new Error(`No players for ${color[0]}.`);
      sections.push({name:color[0],hex:color[1],players});
    }
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
