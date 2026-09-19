class_name Joystick
extends Control

## The one control the game has.
##
## Touching anywhere in the lower band plants the stick under the finger rather
## than forcing the player to find a fixed circle, which is what makes it
## usable without looking. Output is a full 360-degree vector: no snapping to
## eight directions, and a diagonal push is exactly as strong as a straight one.

signal moved(value: Vector2)

const RADIUS := 130.0
const KNOB_RADIUS := 56.0
const DEADZONE := 0.14

## Stick output as (right, forward), +y away from the player, length <= 1.
var value: Vector2 = Vector2.ZERO

var _touch_index: int = -1
var _origin: Vector2 = Vector2.ZERO
var _knob: Vector2 = Vector2.ZERO
var _active: bool = false
var _fade: float = 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_process(true)


func _process(delta: float) -> void:
	var target := 1.0 if _active else 0.0
	_fade = move_toward(_fade, target, delta * 6.0)
	queue_redraw()
	# Keyboard fallback, so the game is playable on a desktop build too.
	if not _active:
		var keys := Vector2(
			Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
			Input.get_action_strength("move_up") - Input.get_action_strength("move_down"))
		if keys.length() > 0.01:
			_emit(keys.limit_length(1.0))
		elif value != Vector2.ZERO:
			_emit(Vector2.ZERO)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed and _touch_index == -1:
			_begin(touch.index, touch.position)
		elif not touch.pressed and touch.index == _touch_index:
			_end()
		accept_event()
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if drag.index == _touch_index:
			_drag(drag.position)
			accept_event()
	elif event is InputEventMouseButton:
		var click := event as InputEventMouseButton
		if click.button_index == MOUSE_BUTTON_LEFT:
			if click.pressed and _touch_index == -1:
				_begin(-2, click.position)
			elif not click.pressed and _touch_index == -2:
				_end()
			accept_event()
	elif event is InputEventMouseMotion and _touch_index == -2:
		_drag((event as InputEventMouseMotion).position)
		accept_event()


func _begin(index: int, at: Vector2) -> void:
	_touch_index = index
	_origin = at
	_knob = at
	_active = true
	_emit(Vector2.ZERO)


func _drag(at: Vector2) -> void:
	var offset := at - _origin
	if offset.length() > RADIUS:
		# Drag the base along so the stick never runs out of travel.
		_origin = at - offset.normalized() * RADIUS
		offset = offset.normalized() * RADIUS
	_knob = _origin + offset

	var raw := offset / RADIUS
	var magnitude := raw.length()
	if magnitude < DEADZONE:
		_emit(Vector2.ZERO)
		return
	# Rescale past the deadzone so the first usable input is not a jump.
	var scaled := (magnitude - DEADZONE) / (1.0 - DEADZONE)
	# Screen y grows downwards; the stick reports +y as away from the player.
	var direction := Vector2(raw.x, -raw.y).normalized()
	_emit(direction * clampf(scaled, 0.0, 1.0))


func _end() -> void:
	_touch_index = -1
	_active = false
	_emit(Vector2.ZERO)


func _emit(next: Vector2) -> void:
	if next.is_equal_approx(value):
		return
	value = next
	moved.emit(value)


func _draw() -> void:
	if _fade <= 0.01:
		return
	var ring := Color(1, 1, 1, 0.16 * _fade)
	var edge := Color(0.55, 0.95, 0.60, 0.42 * _fade)
	var knob := Color(0.45, 0.92, 0.50, 0.72 * _fade)

	draw_circle(_origin, RADIUS, ring)
	draw_arc(_origin, RADIUS, 0.0, TAU, 48, edge, 3.0, true)
	draw_circle(_knob, KNOB_RADIUS, knob)
	draw_arc(_knob, KNOB_RADIUS, 0.0, TAU, 32, Color(1, 1, 1, 0.5 * _fade), 2.0, true)
