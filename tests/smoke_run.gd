extends SceneTree

## Integration smoke run.
##
##   godot --headless --path . --script tests/smoke_run.gd
##
## Builds the real game scene, starts a round and runs it for a few hundred
## frames with a simulated joystick. Compiling proves nothing about whether the
## island actually assembles, the pools hold up or the round can end, so this
## drives the whole thing and checks the invariants that matter.

const WARMUP_FRAMES := 20
const RUN_FRAMES := 2600

var _game: Node
var _frames: int = 0
var _failures: Array[String] = []
var _peak_nodes: int = 0
var _saw_pickup: bool = false
var _saw_litter: bool = false
var _started: bool = false
var _travelled: float = 0.0
var _last_position: Vector3 = Vector3.ZERO
var _floor_frames: int = 0
var _moving_frames: int = 0
var _target_station: RecyclingStation
var _peak_carried: int = 0


func _init() -> void:
	var packed: PackedScene = load("res://scenes/game.tscn")
	if packed == null:
		print("FAIL  could not load res://scenes/game.tscn")
		quit(1)
		return
	_game = packed.instantiate()
	root.add_child(_game)


func _check(condition: bool, what: String) -> void:
	if not condition:
		_failures.append(what)


func _process(_delta: float) -> bool:
	_frames += 1
	if _game == null:
		return true

	var world: World = _game.world
	if world == null:
		_failures.append("world was never created")
		_finish()
		return true

	if _frames == WARMUP_FRAMES:
		_verify_world_built(world)
		_game.start_round()
		_started = true

	if _started:
		# Drive the slime as a player would: push the stick, change direction
		# periodically, so it covers ground rather than sitting still.
		_drive(world)
		if not world.slime.carried.is_empty():
			_saw_pickup = true
		_peak_carried = maxi(_peak_carried, world.slime.carried.size())
		if world.litter_on_ground() > 0:
			_saw_litter = true

		# Measure the path walked, not the displacement: a rotating stick
		# brings the slime back past its own start.
		if _last_position != Vector3.ZERO:
			_travelled += world.slime.global_position.distance_to(_last_position)
		_last_position = world.slime.global_position
		if world.slime.is_on_floor():
			_floor_frames += 1
		if world.slime.motion.velocity.length() > 1.0:
			_moving_frames += 1

	_peak_nodes = maxi(_peak_nodes, root.get_tree().get_node_count())

	if _frames >= RUN_FRAMES:
		_verify_round(world)
		_finish()
		return true
	return false


## Play the game rather than wander: head for the nearest loose litter, and
## once loaded up head for an open station. This is what turns the smoke run
## from "it does not crash" into "the loop actually works".
func _drive(world: World) -> void:
	var slime := world.slime
	var target := Vector3.ZERO
	var have_target := false

	if slime.is_full() or (slime.carried.size() >= 4 and _target_station != null):
		var station := world.nearest_active_station()
		if station != null:
			target = station.global_position
			have_target = true
			_target_station = station
	if not have_target:
		var best := INF
		for item: TrashItem in world._trash_live:
			if item.state != TrashItem.State.LOOSE:
				continue
			var d := item.global_position.distance_to(slime.global_position)
			if d < best:
				best = d
				target = item.global_position
				have_target = true
		if slime.carried.size() >= 4:
			var station := world.nearest_active_station()
			if station != null and station.global_position.distance_to(slime.global_position) < best:
				target = station.global_position
				_target_station = station

	if not have_target:
		return

	# The control frame latches when a push starts, so steering means letting
	# go and pushing again — exactly what a player does.
	if _frames % 12 == 0:
		_release()
		return

	var to_target := target - slime.global_position
	var world_dir := Vector2(to_target.x, to_target.z).normalized()
	# Invert SlimeMotion.stick_to_world for the camera bearing in use.
	var yaw := world.rig.yaw
	var forward := Vector2(cos(yaw), sin(yaw))
	var right := Vector2(-sin(yaw), cos(yaw))
	var stick := Vector2(world_dir.dot(right), world_dir.dot(forward))

	Input.action_press("move_right", maxf(stick.x, 0.0))
	Input.action_press("move_left", maxf(-stick.x, 0.0))
	Input.action_press("move_up", maxf(stick.y, 0.0))
	Input.action_press("move_down", maxf(-stick.y, 0.0))


func _release() -> void:
	for action: String in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(action)


func _verify_world_built(world: World) -> void:
	_check(world.island != null, "island layout missing")
	_check(world.roads != null, "road graph missing")
	_check(world.slime != null, "slime missing")
	_check(world.camera != null, "camera missing")
	_check(world.weather != null, "weather missing")
	_check(world.stations.size() >= 4, "expected a station per district, got %d"
			% world.stations.size())

	var ground := world.find_child("Ground", false, false)
	_check(ground != null, "ground was not built")
	var city := world.find_child("City", false, false)
	_check(city != null, "city was not built")
	if city != null:
		var buildings := city.find_child("Buildings", false, false)
		_check(buildings != null and buildings.get_child_count() >= 20,
				"expected a built-up island, got %d buildings"
				% (buildings.get_child_count() if buildings else 0))

	# The slime has to start on dry land, not in the sea or inside a building.
	var here := Vector2(world.slime.global_position.x, world.slime.global_position.z)
	_check(world.island.is_walkable(here, 2.0), "slime starts in the water")


func _verify_round(world: World) -> void:
	var rules := world.rules
	_check(rules.is_running() or rules.state == RoundRules.ENDED,
			"round never started")
	# A fresh island must not drown in its own starting litter.
	_check(rules.chaos < 0.9, "chaos ran away: %.2f" % rules.chaos)
	_check(rules.elapsed > 1.0, "round clock did not advance")
	_check(rules.time_left < RoundRules.TIME_START + 0.001, "timer went above its ceiling")
	_check(_saw_litter, "no litter ever reached the ground")
	# The whole loop has to work, not just the movement.
	_check(_saw_pickup, "the slime never picked anything up")
	_check(rules.stat_collected > 0, "no pickup was ever scored")
	_check(rules.stat_deliveries > 0, "nothing was ever banked at a station")
	_check(rules.score > 0, "banking never awarded any points")

	# The slime must have actually covered ground.
	_check(_travelled > 30.0, "slime barely moved: %.1fm travelled" % _travelled)
	_check(_moving_frames > RUN_FRAMES / 4, "slime was stationary most of the run")

	# And must have stayed on top of the island. Before the ground collision
	# was made two-sided it fell through and never reported a floor at all.
	_check(world.slime.global_position.y > -5.0, "slime fell through the ground")
	var floor_ratio := float(_floor_frames) / float(maxi(_moving_frames, 1))
	_check(floor_ratio > 0.8,
			"slime was only on the ground %.0f%% of the time" % (floor_ratio * 100.0))

	# Pools must not have grown without bound.
	_check(world._trash_live.size() + world._trash_pool.size() == World.TRASH_POOL,
			"litter pool leaked: %d live + %d pooled != %d"
			% [world._trash_live.size(), world._trash_pool.size(), World.TRASH_POOL])

	# Vehicles must be on the move and still on the island.
	var moving := 0
	for vehicle: Vehicle in world._vehicles:
		if vehicle.speed > 0.5:
			moving += 1
		var at := Vector2(vehicle.global_position.x, vehicle.global_position.z)
		if not world.island.is_walkable(at, -2.0):
			_failures.append("a vehicle drove into the sea")
			break
	_check(moving > 0, "no vehicle ever moved")

	# Pedestrians likewise.
	for person: Pedestrian in world._pedestrians:
		var at := Vector2(person.global_position.x, person.global_position.z)
		if not world.island.is_walkable(at, -2.0):
			_failures.append("a pedestrian walked into the sea")
			break

	print("  frames run:        %d" % _frames)
	print("  round elapsed:     %.1fs" % rules.elapsed)
	print("  time left:         %.1fs" % rules.time_left)
	print("  litter on ground:  %d" % world.litter_on_ground())
	print("  litter carried:    %d (peak %d)" % [world.slime.carried.size(), _peak_carried])
	print("  collected total:   %d" % rules.stat_collected)
	print("  deliveries:        %d (%d items)" % [rules.stat_deliveries, rules.stat_banked_items])
	print("  score:             %d" % rules.score)
	print("  best combo:        %d (x%d)" % [rules.stat_best_combo, rules.stat_best_multiplier])
	print("  chaos:             %.3f" % rules.chaos)
	print("  distance covered:  %.1fm" % _travelled)
	print("  on the ground:     %.0f%%" % (float(_floor_frames) / float(maxi(_moving_frames, 1)) * 100.0))
	print("  nodes in tree:     %d" % _peak_nodes)
	print("  placeholder props: %d" % AssetLibrary.placeholder_report().size())


func _finish() -> void:
	_release()
	if _game != null:
		_game.free()
		_game = null
	print("")
	if _failures.is_empty():
		print("SMOKE PASS  the island builds, the round runs and the pools hold")
		quit(0)
	else:
		print("SMOKE FAIL  %d problem(s)" % _failures.size())
		for f: String in _failures:
			print("  - ", f)
		quit(1)
