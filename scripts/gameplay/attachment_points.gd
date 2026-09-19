class_name AttachmentPoints
extends RefCounted

## Where collected litter sits on the slime's surface.
##
## Slots follow a Fibonacci sphere, so any number of attached pieces spreads
## evenly instead of clustering on one flank, and the n-th slot is always the
## same place — a piece never jumps once it has stuck. A deterministic jitter
## per slot keeps the arrangement from looking like a lattice.

## Fraction of a piece's size that sinks into the body, so litter reads as
## pulled into the gel rather than glued on top.
const EMBED := 0.34

## Slots are biased towards the upper half: litter stuck to the underside
## would be scraped along the pavement.
const LOWER_BIAS := 0.32

const GOLDEN_ANGLE := PI * (3.0 - 1.7320508075688772)


## Unit direction from the slime's centre for slot `index` of `total`.
static func direction(index: int, total: int) -> Vector3:
	var count := maxi(total, 1)
	var i := clampi(index, 0, count - 1)

	# Even spacing in height gives even spacing on the sphere.
	var y := 1.0 - 2.0 * (float(i) + 0.5) / float(count)
	# Lift the distribution so fewer pieces end up underneath.
	y = lerpf(y, absf(y), LOWER_BIAS)
	var r := sqrt(maxf(1.0 - y * y, 0.0))
	var theta := GOLDEN_ANGLE * float(i)

	var dir := Vector3(cos(theta) * r, y, sin(theta) * r)
	# Deterministic per-slot wobble so the layout is not visibly regular.
	var jitter := Vector3(
		sin(float(i) * 12.9898) ,
		sin(float(i) * 78.233),
		sin(float(i) * 37.719)) * 0.06
	return (dir + jitter).normalized()


## Position for a piece of litter whose own radius is `item_radius`, on a slime
## of radius `slime_radius`.
static func position(index: int, total: int, slime_radius: float,
		item_radius: float) -> Vector3:
	return direction(index, total) * (slime_radius + item_radius * (1.0 - EMBED * 2.0))


## Orientation that lays the piece against the surface: its local up points
## out along the surface normal, with a deterministic spin around that normal.
static func basis(index: int, total: int) -> Basis:
	var up := direction(index, total)
	var reference := Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT
	var right := reference.cross(up).normalized()
	var forward := up.cross(right).normalized()
	var b := Basis(right, up, forward)
	return b.rotated(up, float(index) * GOLDEN_ANGLE * 3.0)
