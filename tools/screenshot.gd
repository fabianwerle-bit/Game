extends SceneTree

## Renders stills of the game to PNG.
##
##   xvfb-run -a godot --rendering-method gl_compatibility \
##       --path . --script tools/screenshot.gd
##
## Shoots through the real chase camera while the slime drives itself around
## collecting litter, because that is the view a player actually gets. Hand
## placed vantage points kept ending up inside a building every time the map
## changed size, and none of them showed the game as it is played.
##
## One overview shot at the end, with the world frozen, for the whole island.

const OUT_DIR := "user://shots"

## Frames before the round starts, and between gameplay shots.
const SETTLE := 40
const SHOT_INTERVAL := 90
const GAMEPLAY_SHOTS := 6

var _game: Node
var _frames: int = 0
var _shot: int = 0
var _taken: Array[String] = []
var _overview_done := false


func _init() -> void:
	DisplayServer.window_set_size(Vector2i(1080, 1920))
	var packed: PackedScene = load("res://scenes/game.tscn")
	if packed == null:
		push_error("could not load res://scenes/game.tscn")
		quit(1)
		return
	_game = packed.instantiate()
	root.add_child(_game)
	DirAccess.make_dir_recursive_absolute(OUT_DIR)


## Steer towards the nearest loose litter, or to an open station once loaded.
## The control frame latches per push, so let go every so often to turn.
func _drive(world: World) -> void:
	var slime := world.slime
	var target := Vector3.ZERO
	var have := false

	if slime.is_full():
		var station := world.nearest_active_station()
		if station != null:
			target = station.global_position
			have = true
	if not have:
		var best := INF
		for item: TrashItem in world._trash_live:
			if item.state != TrashItem.State.LOOSE:
				continue
			var d := item.global_position.distance_to(slime.global_position)
			if d < best:
				best = d
				target = item.global_position
				have = true
	if not have:
		return

	if _frames % 14 == 0:
		_release()
		return

	var to_target := target - slime.global_position
	var dir := Vector2(to_target.x, to_target.z).normalized()
	var yaw := world.rig.yaw
	var forward := Vector2(cos(yaw), sin(yaw))
	var right := Vector2(-sin(yaw), cos(yaw))
	var stick := Vector2(dir.dot(right), dir.dot(forward))

	Input.action_press("move_right", maxf(stick.x, 0.0))
	Input.action_press("move_left", maxf(-stick.x, 0.0))
	Input.action_press("move_up", maxf(stick.y, 0.0))
	Input.action_press("move_down", maxf(-stick.y, 0.0))


func _release() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)


func _capture(name: String) -> void:
	var image := root.get_texture().get_image()
	if image == null:
		push_error("no viewport image for %s" % name)
		return
	var path := "%s/%s.png" % [OUT_DIR, name]
	if image.save_png(path) == OK:
		_taken.append(ProjectSettings.globalize_path(path))
	else:
		push_error("could not write %s" % path)


func _process(_delta: float) -> bool:
	_frames += 1
	if _game == null:
		quit(1)
		return true
	var world: World = _game.world
	if world == null:
		push_error("no world")
		quit(1)
		return true

	if _frames == SETTLE:
		_game.start_round()
		return false
	if _frames < SETTLE:
		return false

	if _shot < GAMEPLAY_SHOTS:
		_drive(world)
		if (_frames - SETTLE) % SHOT_INTERVAL == SHOT_INTERVAL - 1:
			_shot += 1
			_capture("%02d_gameplay" % _shot)
		return false

	if not _overview_done:
		_release()
		# Freeze the world so the camera can be moved without it fighting back.
		world.set_process(false)
		world.camera.global_position = Vector3(0, 95, 98)
		world.camera.look_at(Vector3.ZERO, Vector3.UP)
		_overview_done = true
		return false

	if _frames % 8 == 0:
		_capture("07_island")
		_report()
		return true
	return false


func _report() -> void:
	_release()
	print("")
	for path: String in _taken:
		print("SHOT ", path)
	print("%d screenshots written" % _taken.size())
	if _game != null:
		_game.free()
		_game = null
	quit(0 if _taken.size() > 0 else 1)
