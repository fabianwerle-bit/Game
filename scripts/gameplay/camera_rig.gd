class_name CameraRig
extends RefCounted

## Third-person chase camera maths, kept free of nodes so the smoothing and
## recovery behaviour can be tested headlessly.
##
## The owning node supplies how far the camera may sit back this frame (from a
## shapecast against buildings); everything else — where it wants to be, how
## fast it may swing there, how close it may get before the slime fades — is
## decided here.

const FOV := 64.0

const DISTANCE_BASE := 6.2
const DISTANCE_PER_FILL := 2.0
const DISTANCE_MIN := 1.6

const HEIGHT_BASE := 3.1
const HEIGHT_PER_FILL := 0.9

## Degrees per second the camera may swing to get behind the slime. Low enough
## that a hard turn never whips the view around.
const YAW_RATE := 145.0

## How fast the boom retracts when a wall gets in the way, and the slower rate
## it eases back out once the way is clear.
const PULL_IN_SPEED := 26.0
const PUSH_OUT_SPEED := 3.4

## Below this distance the slime is faded out so the camera never sits inside it.
const FADE_START := 2.6
const FADE_END := 1.7

var yaw: float = PI
var distance: float = DISTANCE_BASE
var height: float = HEIGHT_BASE
var look_height: float = 0.75

## Where the camera ended up this frame, relative to the slime.
var offset: Vector3 = Vector3.ZERO


## `target_heading` is the slime's direction of travel in radians. `speed01` is
## its speed as a fraction of maximum, `fill01` how loaded it is, and
## `allowed_distance` the longest boom a shapecast permits this frame.
func update(delta: float, target_heading: float, speed01: float, fill01: float,
		allowed_distance: float) -> void:
	if delta <= 0.0:
		return

	# Settle behind the direction of travel. The camera lags more at speed so a
	# fast run keeps a sense of direction instead of snapping around.
	var desired_yaw := target_heading
	var rate := deg_to_rad(YAW_RATE) * lerpf(0.55, 1.0, clampf(speed01, 0.0, 1.0))
	var delta_yaw := angle_difference(yaw, desired_yaw)
	yaw = wrapf(yaw + clampf(delta_yaw, -rate * delta, rate * delta), -PI, PI)

	var want := DISTANCE_BASE + DISTANCE_PER_FILL * clampf(fill01, 0.0, 1.0)
	var capped := clampf(minf(want, allowed_distance), DISTANCE_MIN, want)
	# Retract fast so the camera never clips a wall, ease back out slowly.
	var speed := PULL_IN_SPEED if capped < distance else PUSH_OUT_SPEED
	distance = move_toward(distance, capped, speed * delta)

	height = HEIGHT_BASE + HEIGHT_PER_FILL * clampf(fill01, 0.0, 1.0)
	# Duck the camera as the boom shortens so a close shot still frames the slime.
	var closeness := clampf(distance / maxf(want, 0.001), 0.0, 1.0)
	height *= lerpf(0.55, 1.0, closeness)

	offset = boom_offset()


## Camera position relative to the slime, for the current yaw and distance.
func boom_offset() -> Vector3:
	# Behind the slime means opposite its heading, in the XZ plane.
	var back := Vector3(-cos(yaw), 0.0, -sin(yaw)) * distance
	return Vector3(back.x, height, back.z)


## The point the camera aims at: slightly above the slime's centre.
func look_offset() -> Vector3:
	return Vector3(0.0, look_height, 0.0)


## Opacity for the slime body, so the camera can get close without ending up
## inside it.
func slime_alpha() -> float:
	if distance >= FADE_START:
		return 1.0
	if distance <= FADE_END:
		return 0.0
	return (distance - FADE_END) / (FADE_START - FADE_END)


func reset(at_heading: float, fill01: float = 0.0) -> void:
	yaw = at_heading
	distance = DISTANCE_BASE + DISTANCE_PER_FILL * clampf(fill01, 0.0, 1.0)
	height = HEIGHT_BASE + HEIGHT_PER_FILL * clampf(fill01, 0.0, 1.0)
	offset = boom_offset()
