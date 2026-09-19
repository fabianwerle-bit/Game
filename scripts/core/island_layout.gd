class_name IslandLayout
extends RefCounted

## Shape of the island and the five districts on it.
##
## Pure geometry on the XZ plane (Y is up in the 3D scene). Deterministic for a
## given seed, so the map screen, the world builder, the crowd director and the
## tests all describe the same island.

const SEED := 20260917

## Overall size of the island. Everything - the coastline, the districts and
## the road graph - is multiplied by this, so the whole place shrinks or grows
## as one piece and the geometry tests keep checking a consistent world.
## At 0.75 the island is roughly 160 m across: about fifteen seconds of rolling
## from coast to coast, which keeps the districts on top of each other instead
## of separated by empty ground.
const SCALE := 0.75

## Districts, in the order the map legend lists them.
const CENTRE := &"centre"
const SUBURB := &"suburb"
const PARK := &"park"
const HARBOUR := &"harbour"
const BEACH := &"beach"
const SHORE := &"shore"

const DISTRICTS: Array[StringName] = [CENTRE, SUBURB, PARK, HARBOUR, BEACH]

## Coastline resolution. 128 segments is smooth at map scale and still cheap to
## test point containment against.
const COAST_SEGMENTS := 128

## Water sits at y = 0, the island plateau at this height.
const GROUND_Y := 1.6
const WATER_Y := 0.0

## A district: where it is, how far its influence reaches, and how it looks on
## the map.
class District extends RefCounted:
	var id: StringName
	var label: String
	var centre: Vector2
	var radius: float
	var colour: Color

	func _init(p_id: StringName, p_label: String, p_centre: Vector2, p_radius: float,
			p_colour: Color) -> void:
		id = p_id
		label = p_label
		centre = p_centre
		radius = p_radius
		colour = p_colour


var coastline: PackedVector2Array = PackedVector2Array()
var districts: Array[District] = []
var _bounds: Rect2 = Rect2()


func _init() -> void:
	_build_districts()
	_build_coastline()


func _build_districts() -> void:
	districts = [
		District.new(CENTRE, "Stadtzentrum", Vector2(0, 0) * SCALE, 40.0 * SCALE, Color(0.85, 0.72, 0.45)),
		District.new(SUBURB, "Wohngebiet", Vector2(-64, 6) * SCALE, 38.0 * SCALE, Color(0.74, 0.82, 0.55)),
		District.new(PARK, "Stadtpark", Vector2(58, 26) * SCALE, 36.0 * SCALE, Color(0.46, 0.74, 0.44)),
		District.new(HARBOUR, "Hafen", Vector2(-22, -58) * SCALE, 32.0 * SCALE, Color(0.55, 0.66, 0.78)),
		District.new(BEACH, "Strand", Vector2(20, 76) * SCALE, 34.0 * SCALE, Color(0.95, 0.88, 0.66)),
	]


## The coastline is a closed loop whose radius is driven by several harmonics
## plus explicit features: a harbour inlet in the north, a wide shallow beach in
## the south and a bay biting into the east. Never a circle, never a square.
func _build_coastline() -> void:
	coastline = PackedVector2Array()
	for i in range(COAST_SEGMENTS):
		var a := TAU * float(i) / float(COAST_SEGMENTS)
		coastline.append(_coast_point(a))
	_bounds = Rect2(coastline[0], Vector2.ZERO)
	for p: Vector2 in coastline:
		_bounds = _bounds.expand(p)


func _coast_point(angle: float) -> Vector2:
	var r := 96.0
	# Broad, irregular outline.
	r += 13.0 * sin(angle * 2.0 + 0.7)
	r += 7.5 * sin(angle * 3.0 - 1.9)
	r += 4.0 * sin(angle * 5.0 + 2.4)
	r += 2.0 * sin(angle * 8.0 - 0.4)

	# Harbour inlet: a narrow notch cutting in from the north (-Z).
	r -= 17.0 * _bump(angle, -PI * 0.5, 0.16)
	# Sheltering mole on the west side of that inlet.
	r += 14.0 * _bump(angle, -PI * 0.5 - 0.34, 0.09)

	# Beach: the south (+Z) pushes out into a broad, flat sand shelf.
	r += 16.0 * _bump(angle, PI * 0.5, 0.42)

	# Bay biting into the east coast.
	r -= 19.0 * _bump(angle, 0.28, 0.20)

	# Rocky headland in the north west.
	r += 11.0 * _bump(angle, -2.35, 0.14)

	return Vector2(cos(angle), sin(angle)) * r * SCALE


## Smooth 0..1 bump centred on `centre_angle`, `width` in radians.
func _bump(angle: float, centre_angle: float, width: float) -> float:
	var d := angle_difference(angle, centre_angle)
	var x := absf(d) / maxf(width * PI, 0.0001)
	if x >= 1.0:
		return 0.0
	return 0.5 + 0.5 * cos(x * PI)


func bounds() -> Rect2:
	return _bounds


## Even-odd point-in-polygon test against the coastline.
func contains_point(p: Vector2) -> bool:
	var inside := false
	var n := coastline.size()
	var j := n - 1
	for i in range(n):
		var a := coastline[i]
		var b := coastline[j]
		if (a.y > p.y) != (b.y > p.y):
			var t := (p.y - a.y) / (b.y - a.y)
			if p.x < a.x + t * (b.x - a.x):
				inside = not inside
		j = i
	return inside


## Distance from `p` to the nearest point of the coastline. Positive inland,
## negative out at sea.
func signed_shore_distance(p: Vector2) -> float:
	var best := INF
	var n := coastline.size()
	for i in range(n):
		var a := coastline[i]
		var b := coastline[(i + 1) % n]
		var d := _point_segment_distance(p, a, b)
		best = minf(best, d)
	return best if contains_point(p) else -best


func _point_segment_distance(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var len_sq := ab.length_squared()
	if len_sq < 0.000001:
		return p.distance_to(a)
	var t := clampf((p - a).dot(ab) / len_sq, 0.0, 1.0)
	return p.distance_to(a + ab * t)


## True where the slime can safely stand: inland and clear of the waterline.
func is_walkable(p: Vector2, margin: float = 2.0) -> bool:
	return signed_shore_distance(p) >= margin


## Pull a point back onto dry land. Used when the slime rolls into the sea.
func nearest_safe_point(p: Vector2, margin: float = 6.0) -> Vector2:
	if is_walkable(p, margin):
		return p
	# Walk toward the island centroid until the point is comfortably inland.
	var target := Vector2.ZERO
	var from := p
	for i in range(48):
		from = from.lerp(target, 0.12)
		if is_walkable(from, margin):
			return from
	return target


func district(id: StringName) -> District:
	for d: District in districts:
		if d.id == id:
			return d
	return null


## Which district a point belongs to, by nearest weighted centre. Points beyond
## every district's reach are plain shoreline.
func district_at(p: Vector2) -> StringName:
	var best_id := SHORE
	var best := INF
	for d: District in districts:
		var dist := p.distance_to(d.centre)
		if dist > d.radius:
			continue
		var score := dist / d.radius
		if score < best:
			best = score
			best_id = d.id
	return best_id


## Deterministic scatter of candidate positions inside a district, already
## filtered to dry land. Used to seed litter, props and crowds.
func scatter_in_district(id: StringName, count: int, rng_seed: int,
		min_shore_margin: float = 4.0) -> PackedVector2Array:
	var out := PackedVector2Array()
	var d := district(id)
	if d == null:
		return out
	var rng := RandomNumberGenerator.new()
	rng.seed = SEED + rng_seed
	var attempts := 0
	while out.size() < count and attempts < count * 40:
		attempts += 1
		var a := rng.randf() * TAU
		var r := d.radius * sqrt(rng.randf())
		var p := d.centre + Vector2(cos(a), sin(a)) * r
		if is_walkable(p, min_shore_margin):
			out.append(p)
	return out
