#!/usr/bin/env python3
"""Fetch the CC0 artwork the game uses.

Downloads PBR texture sets from Poly Haven and sound effects from Kenney,
writes them into `assets/`, and records the licence and provenance of every
file in `assets/licenses/`.

Everything fetched here is CC0 (public domain). Nothing is bundled into the
repository by this script that is not free to redistribute.

Usage:
    python3 tools/fetch_assets.py            # fetch everything missing
    python3 tools/fetch_assets.py --force    # re-fetch even if present
    python3 tools/fetch_assets.py --report   # just say what is present
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEX_DIR = ROOT / "assets" / "textures"
AUDIO_DIR = ROOT / "assets" / "audio"
LICENSE_DIR = ROOT / "assets" / "licenses"

POLYHAVEN_API = "https://api.polyhaven.com"
RESOLUTION = "1k"
FORMAT = "jpg"

# Material slot -> candidate Poly Haven slugs, best first. Several candidates
# because a slug can be renamed upstream; the first one the API confirms wins.
TEXTURE_SLOTS: dict[str, list[str]] = {
    "road":      ["asphalt_02", "asphalt_04", "asphalt_01"],
    "pavement":  ["cobblestone_01", "brick_pavement", "cobblestone_02"],
    "concrete":  ["concrete_wall_008", "anti_slip_concrete", "concrete_floor_02"],
    "brick":     ["brick_wall_006", "brick_wall_005", "red_brick_03"],
    "plaster":   ["beige_wall_001", "blue_plaster_wall", "beige_wall_002"],
    "roof":      ["clay_roof_tiles_02", "ceramic_roof_01", "clay_roof_tiles"],
    "wood":      ["wood_planks_dirt", "plywood_01", "wood_table_001"],
    "sand":      ["aerial_beach_02", "aerial_sand", "coast_sand_rocks_02"],
    "grass":     ["aerial_grass_rock", "forrest_ground_01", "brown_mud_leaves_01"],
    "metal":     ["container_side", "blue_metal_plate", "corrugated_iron"],
}

# Poly Haven map name -> the suffix we save it under. `arm` packs
# ambient occlusion, roughness and metallic into R/G/B, which is exactly
# Godot's ORM layout.
MAP_KEYS = {"Diffuse": "albedo", "nor_gl": "normal", "arm": "orm"}

KENNEY_PACKS = {
    "impact": "https://kenney.nl/media/pages/assets/impact-sounds/"
              "87b4ddecda-1677589768/kenney_impact-sounds.zip",
    "interface": "https://kenney.nl/media/pages/assets/interface-sounds/"
                 "fa43c1dd4d-1677589452/kenney_interface-sounds.zip",
    "jingles": "https://kenney.nl/media/pages/assets/music-jingles/"
               "f37e530b9e-1677590399/kenney_music-jingles.zip",
}

# Game sound name -> (pack, path inside the zip). The game looks these up by
# name through AudioDirector.
SOUND_MAP: dict[str, tuple[str, str]] = {
    # The slime absorbing a piece of litter, and emptying at a station.
    "plop":            ("impact", "Audio/impactSoft_medium_000.ogg"),
    "slurp":           ("interface", "Audio/confirmation_002.ogg"),
    # Bouncing off a wall or being clipped by a car.
    "bounce":          ("impact", "Audio/impactSoft_heavy_001.ogg"),
    # End of round, and the menu tap.
    # Light and cheerful rather than a fanfare, per the brief.
    "finish":          ("jingles", "Audio/Pizzicato jingles/jingles_PIZZI04.ogg"),
    "record":          ("jingles", "Audio/Pizzicato jingles/jingles_PIZZI06.ogg"),
    "tap":             ("interface", "Audio/click_002.ogg"),
    "warning":         ("interface", "Audio/tick_004.ogg"),
    # Per-material sounds for litter hitting the ground.
    "litter_metal":    ("impact", "Audio/impactMetal_light_000.ogg"),
    "litter_glass":    ("impact", "Audio/impactGlass_light_000.ogg"),
    "litter_plastic":  ("impact", "Audio/impactPlate_light_000.ogg"),
    "litter_paper":    ("impact", "Audio/impactGeneric_light_000.ogg"),
    "litter_cardboard":("impact", "Audio/impactWood_light_000.ogg"),
    "litter_organic":  ("impact", "Audio/impactSoft_medium_001.ogg"),
    "litter_bag":      ("impact", "Audio/impactSoft_heavy_000.ogg"),
    # Footsteps for the crowd.
    "footstep":        ("impact", "Audio/footstep_concrete_000.ogg"),
}


def fetch(url: str, timeout: int = 180) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "slime-cleanup-asset-fetch"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def api(path: str) -> dict:
    return json.loads(fetch(f"{POLYHAVEN_API}{path}", timeout=60).decode("utf-8"))


def fetch_textures(force: bool) -> tuple[list[str], list[str]]:
    """Download one texture set per slot. Returns (fetched, failed)."""
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    fetched: list[str] = []
    failed: list[str] = []
    credits: list[str] = []

    for slot, candidates in TEXTURE_SLOTS.items():
        target_dir = TEX_DIR / slot
        if target_dir.exists() and not force and any(target_dir.iterdir()):
            print(f"  {slot:9} already present, skipping")
            continue

        chosen = None
        files = None
        for slug in candidates:
            try:
                files = api(f"/files/{slug}")
                chosen = slug
                break
            except Exception:
                continue
        if chosen is None:
            failed.append(f"{slot}: none of {candidates} resolved")
            print(f"  {slot:9} FAILED - no candidate slug resolved")
            continue

        target_dir.mkdir(parents=True, exist_ok=True)
        got = []
        for key, suffix in MAP_KEYS.items():
            entry = files.get(key, {}).get(RESOLUTION, {}).get(FORMAT)
            if not entry or "url" not in entry:
                continue
            data = fetch(entry["url"])
            (target_dir / f"{suffix}.{FORMAT}").write_bytes(data)
            got.append(suffix)
        if "albedo" not in got:
            failed.append(f"{slot}: {chosen} had no albedo map")
            print(f"  {slot:9} FAILED - {chosen} has no albedo")
            continue

        info = api(f"/info/{chosen}")
        authors = ", ".join(info.get("authors", {}).keys()) or "Poly Haven"
        credits.append(f"{slot:10} {chosen:26} by {authors}  ({'+'.join(got)})")
        fetched.append(slot)
        print(f"  {slot:9} {chosen} [{'+'.join(got)}]")

    if credits:
        _write_license("polyhaven-textures.txt", POLYHAVEN_LICENCE, credits)
    return fetched, failed


def fetch_audio(force: bool) -> tuple[list[str], list[str]]:
    """Extract the mapped sounds out of the Kenney packs."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    fetched: list[str] = []
    failed: list[str] = []
    credits: list[str] = []

    needed_packs = sorted({pack for pack, _ in SOUND_MAP.values()})
    missing = [name for name in SOUND_MAP if not (AUDIO_DIR / f"{name}.ogg").exists()]
    if not missing and not force:
        print("  all sounds already present, skipping")
        return fetched, failed

    archives: dict[str, zipfile.ZipFile] = {}
    for pack in needed_packs:
        print(f"  downloading {pack} pack...")
        try:
            archives[pack] = zipfile.ZipFile(io.BytesIO(fetch(KENNEY_PACKS[pack])))
        except Exception as error:
            failed.append(f"pack {pack}: {error}")

    for name, (pack, member) in SOUND_MAP.items():
        out = AUDIO_DIR / f"{name}.ogg"
        if out.exists() and not force:
            continue
        archive = archives.get(pack)
        if archive is None:
            failed.append(f"{name}: pack {pack} unavailable")
            continue
        try:
            out.write_bytes(archive.read(member))
        except KeyError:
            # Report the closest names so a renamed file is easy to fix.
            stem = Path(member).stem.rstrip("0123456789_")
            near = [n for n in archive.namelist() if stem in n][:3]
            failed.append(f"{name}: {member} not in {pack} pack; near matches: {near}")
            print(f"  {name:18} FAILED - {member} missing")
            continue
        credits.append(f"{name:18} {pack:10} {member}")
        fetched.append(name)
        print(f"  {name:18} {member}")

    if credits:
        _write_license("kenney-audio.txt", KENNEY_LICENCE, credits)
    return fetched, failed


POLYHAVEN_LICENCE = """Poly Haven — PBR texture sets
Source:  https://polyhaven.com/textures
Licence: CC0 1.0 Universal (public domain dedication)
         https://creativecommons.org/publicdomain/zero/1.0/

CC0 places these works in the public domain: they may be used, modified and
redistributed for any purpose, including commercially, with no attribution
required. The credits below are given because it is the decent thing to do,
not because the licence demands it.

Each set is stored as albedo.jpg, normal.jpg (OpenGL convention) and orm.jpg
(ambient occlusion in red, roughness in green, metallic in blue), at 1k.

Sets used:
"""

KENNEY_LICENCE = """Kenney — sound effects
Source:  https://kenney.nl/assets
Licence: CC0 1.0 Universal (public domain dedication)
         https://creativecommons.org/publicdomain/zero/1.0/

CC0 places these works in the public domain: they may be used, modified and
redistributed for any purpose, including commercially, with no attribution
required. The credits below are given voluntarily.

Game sound name, source pack and original file:
"""


def _write_license(filename: str, header: str, lines: list[str]) -> None:
    LICENSE_DIR.mkdir(parents=True, exist_ok=True)
    (LICENSE_DIR / filename).write_text(header + "\n".join(f"  {line}" for line in lines) + "\n")


def report() -> None:
    print("Textures:")
    for slot in TEXTURE_SLOTS:
        directory = TEX_DIR / slot
        maps = sorted(p.stem for p in directory.glob("*.jpg")) if directory.exists() else []
        print(f"  {slot:9} {'+'.join(maps) if maps else 'MISSING'}")
    print("Sounds:")
    for name in SOUND_MAP:
        print(f"  {name:18} {'ok' if (AUDIO_DIR / f'{name}.ogg').exists() else 'MISSING'}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-fetch files that already exist")
    parser.add_argument("--report", action="store_true", help="only report what is present")
    parser.add_argument("--skip-textures", action="store_true")
    parser.add_argument("--skip-audio", action="store_true")
    args = parser.parse_args()

    if args.report:
        report()
        return 0

    failures: list[str] = []
    if not args.skip_textures:
        print("Poly Haven textures (CC0):")
        _, failed = fetch_textures(args.force)
        failures += failed
    if not args.skip_audio:
        print("Kenney audio (CC0):")
        _, failed = fetch_audio(args.force)
        failures += failed

    print()
    if failures:
        print(f"{len(failures)} item(s) could not be fetched:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("All assets fetched.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
