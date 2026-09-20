class_name Palette
extends RefCounted

## The game's colours, in one place.
##
## Flat and saturated on purpose. An earlier pass dressed the island in
## photoscanned PBR sets, which made a cartoon game look like a drab field
## survey. The look this targets is bright toy-town: meadow green, candy
## buildings, dark slate roofs, strong sun and almost no fog.
##
## The greens are warm - yellow-green rather than mint. An earlier pass used
## mint, and under a blue sky's bounce light the whole island came out
## glowing turquoise: grass, pavements and all. Keeping the ground on the
## warm side of green is what makes it read as a lawn.

# Ground
const GRASS := Color(0.45, 0.74, 0.32)
const GRASS_TOWN := Color(0.49, 0.71, 0.33)
const GRASS_PARK := Color(0.42, 0.78, 0.30)
const SAND := Color(0.92, 0.83, 0.58)
const ROCK := Color(0.58, 0.58, 0.56)

# Streets
const TARMAC := Color(0.33, 0.34, 0.36)
const PAVEMENT := Color(0.74, 0.73, 0.69)
const MARKING := Color(0.93, 0.93, 0.88)

# Water
const WATER_DEEP := Color(0.09, 0.45, 0.66)
const WATER_SHALLOW := Color(0.28, 0.76, 0.85)
const FOAM := Color(0.92, 0.98, 1.0)

# Sky
const SKY_TOP := Color(0.25, 0.62, 0.92)
const SKY_HORIZON := Color(0.70, 0.90, 0.98)

## Building walls: candy colours, deliberately loud.
const WALLS: Array[Color] = [
	Color(0.95, 0.55, 0.25),   # orange
	Color(0.97, 0.78, 0.25),   # yellow
	Color(0.90, 0.36, 0.44),   # raspberry
	Color(0.26, 0.72, 0.68),   # teal
	Color(0.55, 0.45, 0.82),   # violet
	Color(0.96, 0.62, 0.72),   # pink
	Color(0.42, 0.70, 0.35),   # leaf
	Color(0.98, 0.93, 0.84),   # cream
]

## Roofs stay dark so the silhouettes read against a bright sky.
const ROOFS: Array[Color] = [
	Color(0.24, 0.29, 0.36),
	Color(0.32, 0.24, 0.30),
	Color(0.20, 0.33, 0.38),
	Color(0.38, 0.26, 0.22),
]

const WINDOW := Color(0.42, 0.62, 0.76)
const WINDOW_FRAME := Color(0.22, 0.27, 0.33)
const TRIM := Color(0.96, 0.97, 0.94)
const WOOD := Color(0.76, 0.52, 0.30)
const METAL := Color(0.62, 0.68, 0.74)
const LEAF := Color(0.36, 0.74, 0.30)
const LEAF_DARK := Color(0.24, 0.57, 0.24)
const BARK := Color(0.55, 0.37, 0.24)

## Deterministic pick from a palette, keyed on a name.
static func pick(options: Array[Color], key: StringName) -> Color:
	return options[absi(String(key).hash()) % options.size()]


static func wall(key: StringName) -> Color:
	return pick(WALLS, key)


static func roof(key: StringName) -> Color:
	return pick(ROOFS, StringName(String(key) + "_roof"))
