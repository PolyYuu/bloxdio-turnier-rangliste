"""Apply the narrow September audit fixes, only to the reviewed source blobs.
No network requests, database mutations, dependency changes or game-code changes.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re

EXPECTED = {
    "play-ui-runtime.js": "3944d3112c25cf434be4d8c2673d893cdc4e2632",
    "profile-live-guard.js": "76464564888a60271f44fc6536151be50927d901",
    "play-presence.js": "4263e7d9f9bbfb5c81d3ee284d5178a0dde9248d",
    "play.js": "65f4c615458b7754d291d80bea36a8cfa10309f2",
    "play.html": "910395b838b17a145ac8296cc293bf655f421601",
    "pending-hub.js": "3d68970ab7e67ea363c21e6912540c2a65f0c020",
    "index.html": "6a141eb8d8e5eb1479644bcf553f68658c8527d6",
}
VERSION = "20260920audit1"


def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def replace_once(text: str, old: str, new: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one patch anchor; got {count}: {old[:110]!r}")
    return text.replace(old, new, 1)


def patch(root: Path, backup: Path, output: Path) -> None:
    originals = {}
    for name, expected in EXPECTED.items():
        data = (root / name).read_bytes()
        actual = blob_sha(data)
        if actual != expected:
            raise RuntimeError(f"Source changed; review {name} before proceeding: {actual}")
        originals[name] = data.decode("utf-8")
    changed = dict(originals)

    # Synchronous rendering must not schedule another translation of itself.
    name = "play-ui-runtime.js"
    text = changed[name]
    start = text.index("  function applyLanguage() {\n")
    end = text.index("\n  let translateFrame = 0;", start)
    old = text[start:end]
    if not old.endswith("  }\n"):
        raise RuntimeError("Unexpected applyLanguage function boundary")
    body = old[len("  function applyLanguage() {\n"):-len("  }\n")]
    new = ("  function applyLanguage() {\n"
           "    // Observe external UI updates, not this synchronous translation pass.\n"
           "    observer.disconnect();\n"
           "    try {\n" + "".join("  " + line if line.strip() else line for line in body.splitlines(True)) +
           "    } finally {\n"
           "      observer.observe(document.documentElement, translationObserverOptions);\n"
           "    }\n"
           "  }\n")
    text = replace_once(text, old, new)
    text = replace_once(text,
        "    fullscreenButton.textContent = document.fullscreenElement === gameStage ? c.exitFullscreen : c.fullscreen;",
        "    setText('#fullscreenButton', document.fullscreenElement === gameStage ? c.exitFullscreen : c.fullscreen);")
    text = replace_once(text,
        "  const observer = new MutationObserver(scheduleTranslation);\n  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-label','alt']});",
        "  const translationObserverOptions = {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-label','alt']};\n  const observer = new MutationObserver(scheduleTranslation);\n  observer.observe(document.documentElement, translationObserverOptions);")
    changed[name] = text

    # Only the error/loading card is changed. Preserve all profile/Duo routing.
    name = "profile-live-guard.js"
    changed[name] = replace_once(changed[name],
        '    gate.innerHTML = `<div class="hub-profile-gate-card"><strong>${title}</strong><span>${text}</span></div>`;',
        '    const card = document.createElement(\'div\');\n'
        '    card.className = \'hub-profile-gate-card\';\n'
        '    const heading = document.createElement(\'strong\');\n'
        '    const detail = document.createElement(\'span\');\n'
        '    heading.textContent = String(title ?? \'\');\n'
        '    detail.textContent = String(text ?? \'\');\n'
        '    card.append(heading, detail);\n'
        '    gate.replaceChildren(card);')

    # Preserve the existing cadence and session key; resume restored documents.
    name = "play-presence.js"
    text = replace_once(changed[name], "      if (!session) return;", "      if (!session || stopped) return;")
    text = replace_once(text, "  function start() {\n    clearInterval(timer);", "  function start() {\n    if (timer && !stopped) return;\n    clearInterval(timer);")
    text = replace_once(text, "  window.addEventListener('pagehide', stop, { once: true });",
        "  window.addEventListener('pagehide', stop);\n"
        "  window.addEventListener('pageshow', () => {\n"
        "    if (stopped) start();\n"
        "  });")
    changed[name] = text

    # Own profile via existing authenticated RPC, other profiles via safe view.
    name = "play.js"
    text = replace_once(changed[name],
        '      const res = await db.from("global_players")\n'
        '        .select("id,current_name,rating,placement_games,is_ranked,peak_rating,avatar_pixels")\n'
        '        .eq("id",myGlobalPlayerId)\n'
        '        .maybeSingle();\n'
        '      if (!res.error) myGlobalPlayer = res.data || null;',
        '      const res = await db.rpc("get_my_profile");\n'
        '      if (res.error) {\n'
        '        console.warn("Play profile unavailable", res.error);\n'
        '      } else {\n'
        '        const profile = Array.isArray(res.data) ? res.data[0] : res.data;\n'
        '        if (profile && String(profile.id) === String(myGlobalPlayerId)) myGlobalPlayer = profile;\n'
        '      }')
    text = replace_once(text, 'const gpRes = await db.from("global_players")', 'const gpRes = await db.from("player_directory")')
    if 'db.from("global_players")' in text:
        raise RuntimeError("Unexpected direct global_players query remains")
    changed[name] = text

    # Cache bust only the modified entry points; do not alter layout or media.
    for name, scripts in {
        "play.html": ["play.js", "play-presence.js", "play-ui-runtime.js"],
        "pending-hub.js": ["profile-live-guard.js"],
        "index.html": ["pending-hub.js"],
    }.items():
        text = changed[name]
        for script in scripts:
            pattern = re.escape(script) + r"\?v=[^\s\"'<>]+"
            text, count = re.subn(pattern, script + "?v=" + VERSION, text)
            if count != 1:
                raise RuntimeError(f"Expected one cache URL for {script} in {name}; got {count}")
        changed[name] = text

    # Validate everything before the first write. Backups never enter web root.
    if backup.resolve() == root.resolve() or root.resolve() in backup.resolve().parents:
        raise RuntimeError("Backup directory must be outside checkout")
    manifest = {}
    for name in EXPECTED:
        if originals[name] == changed[name]:
            raise RuntimeError(f"No change produced for {name}")
        manifest[name] = {"before": EXPECTED[name], "after": blob_sha(changed[name].encode())}
    backup.mkdir(parents=True, exist_ok=True)
    for name in EXPECTED:
        (backup / name).write_bytes(originals[name].encode())
        (root / name).write_bytes(changed[name].encode())
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--backup-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    patch(args.root, args.backup_dir, args.output)
