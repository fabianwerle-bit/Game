extends SceneTree

## Reproduces playing with a finger: real InputEventScreenTouch / ScreenDrag
## events pushed through the engine, exactly as Android delivers them.

var _game: Node
var _f := 0
var _start := Vector3.ZERO
var _press := Vector2.ZERO


func _init() -> void:
	DisplayServer.window_set_size(Vector2i(1080, 1920))
	_game = (load("res://scenes/game.tscn") as PackedScene).instantiate()
	root.add_child(_game)


func _touch(pos: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = 0
	e.position = pos
	e.pressed = pressed
	Input.parse_input_event(e)


func _drag(from: Vector2, to: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.index = 0
	e.position = to
	e.relative = to - from
	Input.parse_input_event(e)


func _process(_d: float) -> bool:
	_f += 1
	var w: World = _game.world
	if w == null:
		return false

	if _f == 30:
		_game.start_round()
		return false
	if _f == 40:
		_start = w.slime.global_position
		var js: Control = _game.hud.joystick
		var rect := js.get_global_rect()
		print("viewport size : ", root.size)
		print("window size   : ", DisplayServer.window_get_size())
		print("joystick rect : ", rect)
		print("joystick vis  : ", js.is_visible_in_tree(), " filter=", js.mouse_filter)
		var hud: Control = _game.hud
		print("HUD rect      : ", hud.get_global_rect())
		print("HUD anchors   : ", hud.anchor_left, " ", hud.anchor_top, " ", hud.anchor_right, " ", hud.anchor_bottom)
		print("HUD offsets   : ", hud.offset_left, " ", hud.offset_top, " ", hud.offset_right, " ", hud.offset_bottom)
		print("JS  anchors   : ", js.anchor_left, " ", js.anchor_top, " ", js.anchor_right, " ", js.anchor_bottom)
		print("JS  offsets   : ", js.offset_left, " ", js.offset_top, " ", js.offset_right, " ", js.offset_bottom)
		_press = rect.get_center()
		print("touch at      : ", _press)
		_touch(_press, true)
		return false
	if _f > 40 and _f < 200:
		_drag(_press, _press + Vector2(0, -120))
		return false
	if _f == 200:
		var moved := w.slime.global_position.distance_to(_start)
		print("joystick active      : ", _game.hud.joystick._active)
		print("joystick value       : ", _game.hud.joystick.value)
		print("slime input velocity : ", w.slime.motion.velocity)
		print("slime moved          : %.2f m" % moved)
		print("game state           : ", _game.state, " (2 == PLAYING is 1)")
		if moved > 1.0:
			print("RESULT: touch control WORKS")
		else:
			print("RESULT: touch control BROKEN")
		_touch(_press + Vector2(0, -120), false)
		_game.free()
		quit(0 if moved > 1.0 else 1)
		return true
	return false
