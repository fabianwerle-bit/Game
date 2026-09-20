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
const SHOT_INTERVAL := 70
const GAMEPLAY_SHOTS := 4

## Fixed vantage points taken after the gameplay shots, with the world frozen.
## Framing the town square and one street from above is what actually shows
## whether the city reads as open, which a chase camera at ground level does
## not.
const VIEWS := [
	{"name": "05_square", "from": Vector3(16, 26, 46), "at": Vector3(16, 0, 12)},
	{"name": "06_street", "from": Vector3(34, 14, 34), "at": Vector3(2, 1, 2)},
	{"name": "07_island", "from": Vector3(0, 108, 112), "at": Vector3(0, 0, 0)},
]

var _game: Node
var _frames: int = 0
var _shot: int = 0
var _taken: Array[String] = []
var _overview_done := false
var _view_frame: int = 0
var _last_at: Vector3 = Vector3.ZERO
var _stuck: int = 0
var _veer: float = 0.0
var _rng := RandomNumberGenerator.new()


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

	# Nose to a shop front and the bot will push at it until the round ends,
	# and every shot comes out a close-up of a wall. Give up on the target
	# and swing away when it has not made ground for a while.
	var here := slime.global_position
	if here.distance_to(_last_at) > 0.6:
		_last_at = here
		_stuck = 0
	else:
		_stuck += 1
	if _stuck > 30:
		_veer = _rng.randf_range(1.6, 2.6) * (1.0 if _rng.randf() < 0.5 else -1.0)
		_stuck = 0
	if absf(_veer) > 0.01:
		var away := slime.global_position - target
		target = slime.global_position + away.normalized().rotated(Vector3.UP, _veer) * 10.0
		_veer = move_toward(_veer, 0.0, 0.06)

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

	# Fixed views, one every few frames so the renderer has settled before
	# each capture.
	if not _overview_done:
		_release()
		# Freeze the world so the camera can be moved without it fighting back.
		world.set_process(false)
		_overview_done = true
		_view_frame = _frames
		return false

	var index := int((_frames - _view_frame) / 8)
	if index >= VIEWS.size():
		_report()
		return true
	var view: Dictionary = VIEWS[index]
	world.camera.global_position = view["from"]
	world.camera.look_at(view["at"], Vector3.UP)
	if (_frames - _view_frame) % 8 == 7:
		_capture(view["name"])
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
