class_name SlimeMotion
extends RefCounted

## Movement feel and body deformation for the slime, with no node or physics
## dependency so the curves can be driven headlessly.
##
## The owning `Slime` node integrates `velocity` against the world; everything
## about how the body *looks* while doing it lives here: the stretch along the
## direction of travel, the forward lean under braking, the lateral pull
## through a turn and the flatten on impact.

## Radius when empty and when fully loaded. Sized to read as a character on a
## phone screen rather than to a strict height rule: a knee-high blob was
## technically in proportion and visually a pea.
const RADIUS_EMPTY := 0.62
const RADIUS_FULL := 1.05

const SPEED_EMPTY := 7.4
const SPEED_FULL := 6.0
const ACCELERATION := 26.0
const FRICTION := 14.0
const AIR_CONTROL := 0.35

## Rain makes the tarmac slick: less grip, longer stops.
const WET_FRICTION_SCALE := 0.55
const WET_ACCEL_SCALE := 0.8

## Deformation springs. Stiffness sets how fast the body snaps back, damping
## how much it wobbles on the way.
const DEFORM_STIFFNESS := 120.0
const DEFORM_DAMPING := 13.0
const DEFORM_LIMIT := 0.42

## Horizontal velocity in metres per second, y unused.
var velocity: Vector2 = Vector2.ZERO

## Direction the body is travelling, kept through brief stops so the face does
## not snap around when the player lets go.
var heading: float = PI

## Yaw the current joystick push is measured against. Latched from the camera
## when a push starts, so a turning camera cannot drag the slime off course
## mid-push.
var control_yaw: float = PI
var _input_active: bool = false

## Deformation state, each a spring with its own velocity.
var stretch: float = 0.0
var _stretch_vel: float = 0.0
var side: float = 0.0
var _side_vel: float = 0.0
var flatten: float = 0.0
var _flatten_vel: float = 0.0

## Accumulated roll, in radians, applied to the visual body.
var roll: float = 0.0

## 0..1 fill ratio driving the size. Smoothed so the slime never pops.
var fill: float = 0.0
var _fill_display: float = 0.0

var wet: float = 0.0
var airborne: bool = false

var _prev_speed: float = 0.0
var _prev_heading: float = PI


## Feed one frame of input. `input` is the raw joystick vector (already
## deadzoned, length <= 1), `camera_yaw` the camera's current yaw in radians.
func step(delta: float, input: Vector2, camera_yaw: float) -> void:
	if delta <= 0.0:
		return
	var pushing := input.length() > 0.01
	if pushing and not _input_active:
		# A fresh push takes its bearing from where the camera is looking now.
		control_yaw = camera_yaw
	_input_active = pushing

	var wish := Vector2.ZERO
	if pushing:
		var clamped := input if input.length() <= 1.0 else input.normalized()
		wish = stick_to_world(clamped, control_yaw)

	var accel := ACCELERATION * lerpf(1.0, WET_ACCEL_SCALE, wet)
	var friction := FRICTION * lerpf(1.0, WET_FRICTION_SCALE, wet)
	if airborne:
		accel *= AIR_CONTROL
		friction *= 0.15

	if wish.length() > 0.001:
		velocity += wish * accel * delta
	else:
		var drop := friction * delta
		var speed := velocity.length()
		velocity = velocity.normalized() * maxf(speed - drop, 0.0) if speed > 0.0 else Vector2.ZERO

	var limit := max_speed()
	if velocity.length() > limit:
		velocity = velocity.normalized() * limit

	if velocity.length() > 0.12:
		heading = velocity.angle()

	_update_deformation(delta)
	_update_size(delta)
	roll += velocity.length() * delta / maxf(radius(), 0.05)


## Convert a joystick vector into world XZ.
##
## The stick is read as (right, forward) with +y pushed away from the player.
## Forward for a camera at yaw `yaw` is (cos, sin) on the XZ plane and its right
## is (-sin, cos), matching the camera basis in `CameraRig.boom_offset`. Written
## out rather than folded into `Vector2.rotated` so the axis order stays
## obvious.
static func stick_to_world(stick: Vector2, yaw: float) -> Vector2:
	var forward := Vector2(cos(yaw), sin(yaw))
	var right := Vector2(-sin(yaw), cos(yaw))
	return forward * stick.y + right * stick.x


func _update_deformation(delta: float) -> void:
	var speed := velocity.length()
	var accel_along := (speed - _prev_speed) / delta
	_prev_speed = speed

	# Accelerating drags the body out behind; braking pushes it forward.
	var stretch_target := clampf(accel_along * 0.016, -DEFORM_LIMIT, DEFORM_LIMIT)
	_stretch_vel += (stretch_target - stretch) * DEFORM_STIFFNESS * delta
	_stretch_vel -= _stretch_vel * DEFORM_DAMPING * delta
	stretch = clampf(stretch + _stretch_vel * delta, -DEFORM_LIMIT, DEFORM_LIMIT)

	# Turning pulls the body sideways, proportional to how hard the turn is.
	var turn := angle_difference(_prev_heading, heading) / delta
	_prev_heading = heading
	var side_target := clampf(turn * speed * 0.004, -DEFORM_LIMIT, DEFORM_LIMIT)
	_side_vel += (side_target - side) * DEFORM_STIFFNESS * delta
	_side_vel -= _side_vel * DEFORM_DAMPING * delta
	side = clampf(side + _side_vel * delta, -DEFORM_LIMIT, DEFORM_LIMIT)

	# Impact flatten always relaxes back to zero.
	_flatten_vel += (0.0 - flatten) * DEFORM_STIFFNESS * delta
	_flatten_vel -= _flatten_vel * DEFORM_DAMPING * delta
	flatten = clampf(flatten + _flatten_vel * delta, -DEFORM_LIMIT, DEFORM_LIMIT)


func _update_size(delta: float) -> void:
	# Growth is eased rather than stepped, so picking up litter never pops.
	_fill_display = move_toward(_fill_display, clampf(fill, 0.0, 1.0), delta * 0.9)


## Squash the body for an impact of `force` (0..1).
func impact(force: float) -> void:
	var f := clampf(force, 0.0, 1.0)
	_flatten_vel += f * 9.0
	_stretch_vel -= f * 4.0


func max_speed() -> float:
	return lerpf(SPEED_EMPTY, SPEED_FULL, _fill_display)


func radius() -> float:
	return lerpf(RADIUS_EMPTY, RADIUS_FULL, _fill_display)


func display_fill() -> float:
	return _fill_display


## Non-uniform scale for the visual body, in the slime's local frame where -Z
## points along `heading`. Roughly volume preserving, so a stretched slime
## thins out instead of simply growing.
func deform_scale() -> Vector3:
	# A resting blob settles: slightly wider than tall, never a perfect ball.
	const REST_SQUASH := 0.12
	var forward := 1.0 + stretch + REST_SQUASH * 0.5
	var vertical := 1.0 - flatten - stretch * 0.35 - REST_SQUASH
	var lateral := 1.0 + absf(side) * 0.6 - stretch * 0.35 + REST_SQUASH * 0.5
	var volume := maxf(forward * vertical * lateral, 0.001)
	var correction := pow(1.0 / volume, 1.0 / 3.0)
	return Vector3(lateral, vertical, forward) * correction


## How hard the body is wobbling right now, 0..1. Drives the shader's ripple
## and the splash particles.
func wobble() -> float:
	return clampf((absf(stretch) + absf(side) + absf(flatten)) / (DEFORM_LIMIT * 2.0), 0.0, 1.0)


## True when the slime is moving fast enough to throw off slime droplets.
func is_spraying() -> bool:
	return velocity.length() > max_speed() * 0.8


func reset(at_heading: float = PI) -> void:
	velocity = Vector2.ZERO
	heading = at_heading
	control_yaw = at_heading
	_input_active = false
	stretch = 0.0
	_stretch_vel = 0.0
	side = 0.0
	_side_vel = 0.0
	flatten = 0.0
	_flatten_vel = 0.0
	roll = 0.0
	fill = 0.0
	_fill_display = 0.0
	wet = 0.0
	airborne = false
	_prev_speed = 0.0
	_prev_heading = at_heading
