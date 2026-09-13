from pathlib import Path

p = Path("index.html")
s = p.read_text()

old = """      if(line.endsWith(':')){
        const label=line.slice(0,-1).trim();
        const color=COLOR_MAP.get(label.toLowerCase());
        if(color){
          flush();
          current={name:color[0],hex:color[1],lines:[]};
          continue;
        }
      }
"""

new = """      const teamLine=line.match(/^([^:]+)\\s*:\\s*(.*)$/);
      if(teamLine){
        const color=COLOR_MAP.get(teamLine[1].trim().toLowerCase());
        if(color){
          flush();
          current={name:color[0],hex:color[1],lines:[]};
          const inlineBody=teamLine[2].trim();
          if(inlineBody)current.lines.push(inlineBody);
          continue;
        }
      }
"""

if "const teamLine=line.match(/^([^:]+)\\s*:\\s*(.*)$/);" in s:
    raise SystemExit("inline team-header compatibility is already present")

count = s.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one legacy team-header parser block, got {count}")

s = s.replace(old, new, 1)

# Guards: keep the authoritative name-based import path intact.
required = [
    "adminImportRoundByName",
    "import_round_results_by_name",
    "team_name:sec.name",
    "player_name:input.name",
    "if(inlineBody)current.lines.push(inlineBody);",
]
for needle in required:
    if needle not in s:
        raise SystemExit(f"required import guard missing: {needle}")

p.write_text(s)
print("patched import parser: standalone and inline team headers are now accepted")
