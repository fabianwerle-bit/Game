# Slime Cleanup

A 3D arcade cleanup game for Android and iOS, built with Godot 4.6. You roll a
slime through a small island town, collect the litter its inhabitants keep
dropping, and haul it to a recycling station before the clock or the chaos
meter runs you out.

Portrait only, one joystick, no other buttons. Everything else is automatic.

## State of the project

This is a **playable, technically complete prototype of the game systems**. It
is not a finished, store-ready product, and the art is not final. What follows
is an honest account of both sides.

### What works, end to end

- Rolling movement with a 360° joystick, camera-relative and precise. The
  control frame latches when a push starts, so a turning camera never bends a
  held line.
- A slime that squashes and stretches: dragged out under acceleration, leaning
  forward under braking, pulled sideways through a turn, flattened on impact —
  all roughly volume preserving, so it deforms rather than inflating. It grows
  from knee height to hip height as it fills up, smoothly.
- Litter is picked up by proximity with a magnet assist, sticks **visibly** to
  the body on evenly spread surface slots, and rides along as the slime rolls.
- Thirteen kinds of litter with their own points, capacity cost, mass, chaos
  weight, wind drift and material sound.
- Five districts on one island with a natural, irregular coastline: town
  centre, suburb, park, harbour, beach. Roll into the sea and you are put back
  on dry land.
- Traffic that follows lanes, keeps a gap, waits its turn at junctions, brakes
  for the player, and steers and spins its wheels from the motion it actually
  performed. Cars, vans, lorries, a bin lorry, scooters and bicycles.
- Pedestrians who walk the pavements, pause, react to the slime — and create
  litter only as the end of a visible action: they carry something, use it,
  then throw it away. What lands is what they were holding.
- Recycling stations in every district, two open at a time and rotating, so
  the best route keeps changing.
- Timer, chaos meter (the second way to lose), combo ladder to ×5, four
  difficulty phases, all six special events, five weather conditions that
  drive real lighting rather than a colour filter, and rain that makes the
  roads slick enough to feel.
- Portrait HUD, pause screen with the island map, game-over summary, settings
  with working volume, graphics and control options, six slime skins that
  change the body immediately, and a persistent record.

### What is missing or provisional

- **Some props are still stand-ins.** The buildings, trees, rocks, cars and
  lorries are real artwork — Kenney's CC0 city, suburban, nature and car kits.
  About a dozen props are not: the fountain, benches, bins, lamp posts, signs,
  bollards, the harbour's containers and boat, and the people, dog, bicycle
  and scooter. Those are composed stand-in geometry built from primitives in
  `scripts/core/prop_builder.gd` — recognisable objects with materials, not
  bare cubes, but not finished art. The game says which is which: the boot log
  and the smoke run both print how many props are still placeholders.
  Dropping a real model at `assets/models/<name>.glb` replaces one with no
  code change — see *Replacing the art* below.
- **The art is flat cartoon, not "modern stylized realism".** The design asks
  for PBR and photoscanned materials; what is here is a toy town in flat
  colour. The texture sets are fetched and wired up, but the look the game
  actually ships is the cartoon one, which is a deliberate departure.
- **Characters are not rigged.** Pedestrians are chibi figures built from
  primitives and posed by code through a walk cycle. A skinned, animated
  character would go straight in as `assets/models/pedestrian.glb`.
- **No ambience track.** There is looping music and a full set of effects, but
  no town or seaside atmosphere loop — no CC0 one fit, and the brief rules out
  synthesised filler. `AudioDirector` supports one; the slot is simply empty.
- **Never run on a real phone.** The APK builds, signs and verifies, and the
  exported build boots and renders correctly under software rendering here —
  but no physical Android device has run it. Expect to find device-specific
  problems. There is no iOS build either; that needs a Mac with Xcode.
- **Textures are 1k**, fine for a phone but not for close-ups.

## Installing the APK

A signed, installable release build is committed at
[`dist/SlimeCleanup-0.4.0.apk`](dist/SlimeCleanup-0.4.0.apk) — use the
**Download raw file** button on that page. `dist/SlimeCleanup-0.4.0.apk.sha256`
carries its checksum.

- Android 7.0 (API 24) or newer, arm64, OpenGL ES 3.0
- Portrait only, and it asks for **no permissions at all** — no internet, no
  storage, nothing
- Package `de.fabian.slimecleanup`, version 0.4.0

Copy it to the phone and open it. Android will ask you to allow installing
from whichever app you opened it with, because it does not come from Play.

## Building the APK yourself

```sh
GODOT=/path/to/godot ANDROID_SDK=/path/to/android-sdk tools/build_android.sh
```

It runs the checks first, then exports. Two settings in this project exist
solely to make that export work, and both fail *silently* if they go missing:

- `project.godot` must keep
  `rendering/textures/vram_compression/import_etc2_astc=true`. Android
  requires textures it can import in ETC2/ASTC, and Godot's check for this
  sets the export invalid while printing an empty error list.
- `export_presets.cfg` must keep the `custom_template/debug` and
  `custom_template/release` keys even when empty, or Godot takes the
  custom-template branch, finds nothing and again reports nothing.

### About the signing key

`android/slime-release.keystore` (alias `slime`, password `slimecleanup`) is a
**prototype key, committed in the open**, so that updates you build can install
over this APK. It is not a secret and must not be treated as one. Before any
public release, generate your own key, keep it out of the repository, and
store it somewhere safe — whoever holds it can sign updates to your app.

## Playing it on a desktop

Install Godot 4.6, open the project and run it. The keyboard (WASD) drives the
slime, so the joystick is not needed to try it.

## Running the checks

```sh
GODOT=/path/to/godot tools/test.sh
```

Runs the unit suites (rules, island geometry, movement and camera, props,
compilation of every script and shader) and then an integration smoke run that
builds the real island, plays the loop headlessly and asserts the invariants —
the slime stays on the ground, the pools stay balanced, litter is collected,
banked and scored.

To look at the game rather than trust it:

```sh
xvfb-run -a /path/to/godot --rendering-method gl_compatibility \
    --path . --script tools/screenshot.gd
```

Writes stills of the town centre, a street, each district, the whole island
and the slime to the user data directory.

## Assets

All artwork is CC0 (public domain). Fetch it with:

```sh
python3 tools/fetch_assets.py          # everything missing
python3 tools/fetch_assets.py --report # what is present
```

- **Models**: four kits from [Kenney](https://kenney.nl) — City Kit
  (Commercial), City Kit (Suburban), Car Kit and Nature Kit. The fetcher pulls
  the props the game asks for out of each zip and renames them to the game's
  own prop names.

  Two things are done to them on the way in, both recorded in `AssetLibrary`
  rather than baked into the files. The kits are modelled at one unit per
  module rather than one per metre, so `SCALES` says what a unit is worth for
  each model. And every kit paints from one shared palette texture, which
  Godot drops when it is embedded in a `.glb`; the palettes are therefore
  shipped alongside under `assets/models/textures/` and put back on at load.
- **Textures**: ten PBR sets from [Poly Haven](https://polyhaven.com) — road,
  pavement, concrete, brick, plaster, roof tiles, wood, sand, grass and metal.
  Each is albedo, an OpenGL normal map and an ORM map (ambient occlusion,
  roughness, metallic in R/G/B), at 1k.
- **Sound**: fifteen effects from [Kenney](https://kenney.nl) — pickup, drop-
  off, impacts, footsteps, interface, a per-material sound for each kind of
  litter, and two jingles.
- **Music**: a looping theme from [OpenGameArt](https://opengameart.org).

Provenance and licence for every file is recorded under `assets/licenses/`.

The project runs without any of it: missing textures fall back to flat colour
and missing sounds are skipped with a warning naming the file, so a gap is
always visible rather than silent.

## Replacing the art

`AssetLibrary` resolves a prop name to `assets/models/<name>.(glb|gltf|tscn)`
and only falls back to the stand-in when nothing is there. So replacing the
art is a matter of dropping files in with the right names — `house0`, `shop1`,
`car`, `pedestrian`, `palm`, `can`, and so on; `AssetLibrary.placeholder_report()`
lists every name still waiting for one.

A model is scaled and recoloured on the way in only if it is listed in
`AssetLibrary.SCALES` and `PALETTES`. A model already built at one unit per
metre and carrying its own textures needs neither, and should be left out of
both.

Two contracts the code relies on:

- **Vehicles** need wheels the rig can find, under either of two namings: the
  hand-built cars use `FrontLeft`, `FrontRight`, `RearLeft` and `RearRight`,
  each containing a node called `Spin`, which separates steering from rolling;
  Kenney's kit has plain meshes called `wheel-front-left` and so on, which are
  steered and spun directly. A mesh named `BrakeLight` is lit from its
  material's emission when one is there.
- **Pedestrians** need `Hips`, `Torso`, `Head`, `ArmLeft`, `ArmRight`,
  `LegLeft`, `LegRight` and a `HandSocket` for the item they are about to
  drop. A rigged model with its own animations can ignore the walk cycle;
  `Pedestrian.set_simplified(true)` turns the procedural posing off.

These are asserted by `tests/test_props.gd`, so a rename that breaks them
fails the build rather than quietly stopping the wheels.

Poly Haven also publishes CC0 *models*, and a few are usable here — a bench at
630 triangles, a barrel at 2.7k, a bin at 14k. Most are not: their street lamp
is 30k triangles against perhaps fifty instances, their boulder 124k, and
`island_tree_01` is 3.7 million triangles in a 63 MB download. They are also
photoscanned, which would sit badly next to the stand-ins. A coherent stylized
kit for the whole world is the better answer than a handful of photoreal props.

## Layout

```
project.godot          portrait 1080x1920, mobile renderer, physics layers
scripts/core/          rules, catalogues, island and road geometry, singletons
scripts/gameplay/      slime, camera, litter, stations, pedestrians, vehicles
scripts/world/         terrain, city layout, round orchestration, events, weather
scripts/ui/            HUD, joystick, menus, island map
shaders/               slime gel, sea, ground
tests/                 headless suites and the integration smoke run
tools/                 test runner, asset fetcher, screenshot renderer
legacy/                the original native Android OpenGL ES 2.0 prototype,
                       kept as a gameplay and balance reference
```

## Licence

The CC0 artwork carries its own dedication, recorded in `assets/licenses/`.
