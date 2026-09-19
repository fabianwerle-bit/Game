extends SceneTree

## Renders stills of the real game scene to PNG.
##
##   xvfb-run -a godot --rendering-method gl_compatibility \
##       --path . --script tools/screenshot.gd
##
## Exists so the look of the game can be checked rather than assumed. Each shot
## places the chase camera somewhere worth seeing and lets the world settle for
## a few frames first.

const OUT_DIR := "user://shots"
const SETTLE := 45
## Frames spent on each shot: aim, let it draw, then capture.
const FRAMES_PER_SHOT := 14

var _game: Node
var _frames: int = 0
var _shot: int = 0
var _taken: Array[String] = []

## name, camera position, look-at target
var _views: Array = []


func _init() -> void:
	DisplayServer.window_set_size(Vector2i(1080, 1920))
	var packed: PackedScene = load("res://scenes/game.tscn")
	_game = packed.instantiate()
	root.add_child(_game)
	DirAccess.make_dir_recursive_absolute(OUT_DIR)


func _build_views(world: World) -> void:
	var centre := Vector3(0, IslandLayout.GROUND_Y, 0)
	var beach := world.island.district(IslandLayout.BEACH).centre
	var harbour := world.island.district(IslandLayout.HARBOUR).centre
	var park := world.island.district(IslandLayout.PARK).centre
	var suburb := world.island.district(IslandLayout.SUBURB).centre

	_views = [
		["01_town_centre", centre + Vector3(14, 6, 20), centre],
		["02_street_level", Vector3(20, 2.6, 4), Vector3(0, 1.8, 0)],
		["03_suburb", Vector3(suburb.x + 18, 8, suburb.y + 22), Vector3(suburb.x, 2, suburb.y)],
		["04_park", Vector3(park.x + 16, 7, park.y + 20), Vector3(park.x, 2, park.y)],
		["05_harbour", Vector3(harbour.x + 20, 10, harbour.y + 24), Vector3(harbour.x, 2, harbour.y)],
		["06_beach", Vector3(beach.x + 10, 6, beach.y + 24), Vector3(beach.x, 2, beach.y)],
		["07_island_wide", Vector3(60, 95, 150), Vector3(0, 0, 0)],
		["08_slime_close", Vector3.ZERO, Vector3.ZERO],
	]


func _process(_delta: float) -> bool:
	_frames += 1
	var world: World = _game.world
	if world == null:
		push_error("no world")
		quit(1)
		return true

	if _frames == SETTLE:
		_build_views(world)
		_game.start_round()
		return false
	if _frames == SETTLE + 1:
		# The world drives the chase camera every frame, so without this every
		# shot came out as the same over-the-shoulder view.
		world.set_process(false)
		return false
	if _frames < SETTLE:
		return false

	if _shot >= _views.size():
		_report()
		return true

	# Two phases per shot, without awaiting: aim the camera, let the frame be
	# drawn, then grab whatever was last rendered. Awaiting inside a SceneTree
	# _process turns it into a coroutine and the loop stops advancing.
	var step := (_frames - SETTLE) % FRAMES_PER_SHOT
	var view: Array = _views[_shot]

	if step == 0:
		if view[0] == "08_slime_close":
			# Frame the slime from just behind, as the game does.
			var slime := world.slime
			var focus := slime.global_position + Vector3(0, slime.motion.radius(), 0)
			world.camera.global_position = focus + Vector3(2.6, 1.6, 2.6)
			world.camera.look_at(focus, Vector3.UP)
		else:
			world.camera.global_position = view[1]
			world.camera.look_at(view[2], Vector3.UP)
		return false

	if step == FRAMES_PER_SHOT - 1:
		var image := root.get_texture().get_image()
		if image == null:
			push_error("no viewport image for %s" % view[0])
			_shot += 1
			return false
		var path := "%s/%s.png" % [OUT_DIR, view[0]]
		if image.save_png(path) == OK:
			_taken.append(ProjectSettings.globalize_path(path))
		else:
			push_error("could not write %s" % path)
		_shot += 1
	return false


func _report() -> void:
	print("")
	for path: String in _taken:
		print("SHOT ", path)
	print("%d screenshots written" % _taken.size())
	if _game != null:
		_game.free()
	quit(0 if _taken.size() > 0 else 1)
