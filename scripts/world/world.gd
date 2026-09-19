class_name World
extends Node3D

## Builds the island and runs the round on it.
##
## Owns the pools. Litter, pedestrians and vehicles are all created once at
## load and recycled, so a fifteen minute round costs the same as the first
## minute — nothing here grows an unbounded pile of nodes.

signal round_state_changed()
signal toast(text: String)

const TRASH_POOL := 220
const GROUND_LITTER_TARGET := 25

var rules := RoundRules.new()
var island := IslandLayout.new()
var roads := RoadGraph.new()
var events := EventDirector.new()

var slime: Slime
var rig := CameraRig.new()
var camera: Camera3D
var weather: Weather

var stations: Array[RecyclingStation] = []
var active_station: RecyclingStation

var _trash_pool: Array[TrashItem] = []
var _trash_live: Array[TrashItem] = []
var _trash_root: Node3D

var _pedestrians: Array[Pedestrian] = []
var _vehicles: Array[Vehicle] = []

var _spawn_clock: float = 0.0
var _station_clock: float = 0.0
var _rng := RandomNumberGenerator.new()
var _camera_probe: PhysicsRayQueryParameters3D

## Summed chaos weight of every piece of litter lying about. Fed to the rules.
var ground_chaos: float = 0.0

var _attract_angle: float = 0.0


func _ready() -> void:
	_rng.seed = IslandLayout.SEED
	_build_scene()
	_build_pools()
	events.started.connect(_on_event_started)
	events.finished.connect(_on_event_finished)
	enter_attract_mode()


## Idle state behind the main menu: the city runs, the slime sits and looks
## around, and the camera drifts. It is the real world, not a backdrop, so
## pressing play only has to start the clock.
func enter_attract_mode() -> void:
	rules.state = RoundRules.IDLE
	var start := roads.nodes[0] + Vector2(7.0, 7.0)
	slime.reset_at(Vector3(start.x, IslandLayout.GROUND_Y + 0.4, start.y))
	rig.reset(PI)
	_attract_angle = 0.0
	for station: RecyclingStation in stations:
		station.set_active(true)
	if _trash_live.is_empty():
		_seed_litter()


func _build_scene() -> void:
	add_child(TerrainBuilder.build_ground(island))

	var water := TerrainBuilder.build_water(island)
	add_child(water)

	var road_node := TerrainBuilder.build_roads(roads)
	add_child(road_node)

	var city_builder := CityBuilder.new(island, roads)
	var city := city_builder.build()
	add_child(city)

	for entry: Dictionary in city_builder.station_points:
		var station := RecyclingStation.new()
		station.district = entry["district"]
		stations.append(station)
		add_child(station)
		var p: Vector2 = entry["position"]
		station.global_position = Vector3(p.x, IslandLayout.GROUND_Y, p.y)

	# Sun and sky.
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-50, 38, 0)
	sun.light_energy = 1.4
	sun.shadow_enabled = GameSettings.shadows_enabled()
	sun.directional_shadow_max_distance = GameSettings.draw_distance() * 0.6
	add_child(sun)

	var env_node := WorldEnvironment.new()
	env_node.name = "Environment"
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.32, 0.54, 0.86)
	sky_mat.sky_horizon_color = Color(0.76, 0.86, 0.94)
	sky_mat.ground_bottom_color = Color(0.22, 0.28, 0.30)
	sky_mat.ground_horizon_color = Color(0.76, 0.86, 0.94)
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 1.0
	env.fog_enabled = true
	env.fog_density = 0.0016
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_white = 6.0
	if GameSettings.tier() >= GameSettings.TIER_MEDIUM:
		env.ssao_enabled = true
		env.ssao_radius = 1.4
		env.ssao_intensity = 1.6
		env.glow_enabled = true
		env.glow_intensity = 0.5
		env.glow_bloom = 0.12
	env_node.environment = env
	add_child(env_node)

	weather = Weather.new()
	weather.name = "Weather"
	add_child(weather)
	weather.setup(sun, env_node)
	var tarmac := road_node.find_child("Tarmac", true, false) as MeshInstance3D
	if tarmac != null and tarmac.material_override is StandardMaterial3D:
		weather.register_road_material(tarmac.material_override)
	var water_surface := water.find_child("Surface", true, false) as MeshInstance3D
	if water_surface != null and water_surface.material_override is ShaderMaterial:
		weather.register_water_material(water_surface.material_override)

	# The player and the camera.
	slime = Slime.new()
	slime.name = "Slime"
	slime.island = island
	add_child(slime)

	camera = Camera3D.new()
	camera.name = "ChaseCamera"
	camera.fov = CameraRig.FOV
	camera.far = GameSettings.draw_distance()
	add_child(camera)
	camera.current = true

	_camera_probe = PhysicsRayQueryParameters3D.new()
	_camera_probe.collision_mask = 1
	_camera_probe.collide_with_areas = false

	_trash_root = Node3D.new()
	_trash_root.name = "Litter"
	add_child(_trash_root)


func _build_pools() -> void:
	for i in range(TRASH_POOL):
		var item := TrashItem.new()
		item.setup(TrashCatalog.get_kind(&"paper"))
		item.visible = false
		item.wants_return.connect(_return_trash)
		# Each piece carries a small area so the slime's magnet can find it.
		var area := Area3D.new()
		area.collision_layer = 1 << 2
		area.collision_mask = 0
		var shape := CollisionShape3D.new()
		var sphere := SphereShape3D.new()
		sphere.radius = 0.3
		shape.shape = sphere
		area.add_child(shape)
		item.add_child(area)
		_trash_root.add_child(item)
		_trash_pool.append(item)

	var crowd := GameSettings.crowd_budget()
	for i in range(crowd):
		var person := Pedestrian.new()
		add_child(person)
		person.setup(roads, island, IslandLayout.SEED + i * 17)
		person.discarded.connect(_on_pedestrian_discarded)
		_pedestrians.append(person)

	var kinds: Array[StringName] = [&"car", &"car", &"car", &"van", &"truck",
			&"bin_lorry", &"scooter", &"bicycle"]
	for i in range(GameSettings.traffic_budget()):
		var vehicle := Vehicle.new()
		add_child(vehicle)
		vehicle.setup(roads, kinds[i % kinds.size()], 1000 + i,
				_rng.randi_range(0, roads.nodes.size() - 1))
		vehicle.shed_litter.connect(_on_vehicle_shed)
		vehicle.struck_slime.connect(_on_vehicle_hit)
		_vehicles.append(vehicle)


func start_round() -> void:
	rules.start()
	events.start_round(24.0)
	for item: TrashItem in _trash_live.duplicate():
		_return_trash(item)
	_trash_live.clear()

	var start := roads.nodes[0] + Vector2(6.0, 6.0)
	slime.reset_at(Vector3(start.x, IslandLayout.GROUND_Y + 0.4, start.y))
	rig.reset(PI)
	_pick_active_station(true)
	_station_clock = 45.0
	_seed_litter()
	round_state_changed.emit()


## Seed the island so the first seconds already have something to do, weighted
## towards each district's own kind of rubbish.
func _seed_litter() -> void:
	for district: StringName in IslandLayout.DISTRICTS:
		var ids := TrashCatalog.district_ids(district)
		var spots := island.scatter_in_district(district, GROUND_LITTER_TARGET / 5, 3, 5.0)
		for spot: Vector2 in spots:
			var kind := TrashCatalog.get_kind(ids[_rng.randi_range(0, ids.size() - 1)])
			_spawn_trash(kind, Vector3(spot.x, IslandLayout.GROUND_Y, spot.y), Vector3.ZERO)


func _process(delta: float) -> void:
	# The city lives whether or not a round is running, so the menu sits in
	# front of a working world rather than a still frame.
	_update_litter(delta)
	weather.step(delta, events.is_active(EventDirector.RAIN))
	weather.follow(slime.global_position)
	slime.motion.wet = weather.wetness
	_update_crowd(delta)
	_update_traffic(delta)

	if not rules.is_running():
		_update_attract_camera(delta)
		return

	rules.tick(delta, ground_chaos)
	events.tick(delta, rules.event_interval())
	_update_pickups(delta)
	_update_stations(delta)
	_update_spawning(delta)
	_update_camera(delta)

	GameAudio.tension(1.0 - clampf(rules.time_left / 20.0, 0.0, 1.0))
	round_state_changed.emit()


## Slow orbit around the idle slime for the menu.
func _update_attract_camera(delta: float) -> void:
	_attract_angle += delta * 0.22
	var focus := slime.global_position + Vector3(0, slime.motion.radius() + 0.3, 0)
	var offset := Vector3(cos(_attract_angle), 0.0, sin(_attract_angle)) * 6.4
	camera.global_position = focus + offset + Vector3(0, 2.4, 0)
	camera.look_at(focus, Vector3.UP)
	slime.set_fade(1.0)
	# A small idle bob so the slime is alive while the player reads the menu.
	slime.motion.impact(0.0)


func _update_camera(delta: float) -> void:
	var focus := slime.global_position + Vector3(0, slime.motion.radius(), 0)
	var speed01 := slime.motion.velocity.length() / maxf(slime.motion.max_speed(), 0.01)

	# Probe backwards along the boom so buildings pull the camera in.
	var want := rig.boom_offset().normalized() * (CameraRig.DISTANCE_BASE
			+ CameraRig.DISTANCE_PER_FILL * slime.fill_ratio())
	var allowed := want.length()
	var space := get_world_3d().direct_space_state
	_camera_probe.from = focus
	_camera_probe.to = focus + want
	var hit := space.intersect_ray(_camera_probe)
	if not hit.is_empty():
		allowed = focus.distance_to(hit["position"]) - 0.35

	rig.update(delta, slime.motion.heading, speed01, slime.fill_ratio(), allowed)
	camera.global_position = focus + rig.boom_offset()
	camera.look_at(focus + rig.look_offset(), Vector3.UP)
	slime.set_fade(rig.slime_alpha())


func _update_litter(delta: float) -> void:
	var wind := events.wind()
	ground_chaos = 0.0
	var slime_transform := slime.global_transform
	for item: TrashItem in _trash_live:
		item.wind = wind
		item.step(delta, slime_transform, slime.motion.radius())
		if item.state == TrashItem.State.LOOSE or item.state == TrashItem.State.FALLING:
			ground_chaos += item.kind.chaos


func _update_crowd(delta: float) -> void:
	var here := slime.global_position
	var speed := slime.motion.velocity.length()
	var cutoff := GameSettings.draw_distance() * 0.55
	for person: Pedestrian in _pedestrians:
		var distance := person.global_position.distance_to(here)
		# Distant people keep walking but stop being posed limb by limb.
		person.set_simplified(distance > cutoff)
		person.visible = distance < GameSettings.draw_distance()
		person.step(delta, here, speed)


func _update_traffic(delta: float) -> void:
	var scale := rules.traffic_density() * events.traffic_scale()
	for vehicle: Vehicle in _vehicles:
		vehicle.step(delta, _vehicles, slime.global_position, scale)
		vehicle.check_slime_hit(slime)


func _update_pickups(delta: float) -> void:
	var taken := slime.collect_nearby(delta)
	for item: TrashItem in taken:
		rules.on_pickup(item.kind)
		GameAudio.sfx(&"plop", item.global_position,
				randf_range(0.92, 1.12))


func _update_stations(delta: float) -> void:
	_station_clock -= delta
	if _station_clock <= 0.0:
		_pick_active_station(false)
		_station_clock = _rng.randf_range(40.0, 70.0)

	if slime.carried.is_empty():
		return
	for station: RecyclingStation in stations:
		if not station.slime_in_range(slime):
			continue
		var handed := slime.bank_into(station.intake_point())
		var gained := rules.on_bank()
		station.begin_cooldown()
		GameAudio.sfx(&"slurp", station.global_position)
		toast.emit("+%d" % gained)
		return


func _pick_active_station(initial: bool) -> void:
	if stations.is_empty():
		return
	# Two stations open at a time, and never the same pair twice running, so
	# the best route keeps moving.
	for station: RecyclingStation in stations:
		station.set_active(false)
	var first := _rng.randi_range(0, stations.size() - 1)
	var second := (first + 1 + _rng.randi_range(0, stations.size() - 2)) % stations.size()
	stations[first].set_active(true)
	stations[second].set_active(true)
	active_station = stations[first]
	if not initial:
		toast.emit("Neue Station: %s" % island.district(stations[first].district).label)


func _update_spawning(delta: float) -> void:
	_spawn_clock -= delta
	if _spawn_clock > 0.0:
		return
	var base := 2.6 * rules.spawn_interval_scale() / maxf(events.litter_rate_scale(), 0.01)
	_spawn_clock = base * _rng.randf_range(0.7, 1.3)

	# Background litter only tops the island up; most of it comes from people.
	if _trash_live.size() >= TRASH_POOL - 30:
		return
	var district := IslandLayout.DISTRICTS[_rng.randi_range(0, IslandLayout.DISTRICTS.size() - 1)]
	if events.active_district != &"":
		district = events.active_district
	var spots := island.scatter_in_district(district, 1, _rng.randi_range(0, 9999), 5.0)
	if spots.is_empty():
		return
	var ids := TrashCatalog.district_ids(district)
	var kind := TrashCatalog.get_kind(ids[_rng.randi_range(0, ids.size() - 1)])
	_spawn_trash(kind, Vector3(spots[0].x, IslandLayout.GROUND_Y, spots[0].y), Vector3.ZERO)


func _spawn_trash(kind: TrashCatalog.Kind, at: Vector3, impulse: Vector3) -> TrashItem:
	if _trash_pool.is_empty():
		return null
	var item: TrashItem = _trash_pool.pop_back()
	item.setup(kind)
	if impulse.length() > 0.01:
		item.toss(at, impulse, IslandLayout.GROUND_Y)
	else:
		item.place(at)
	_trash_live.append(item)
	return item


func _return_trash(item: TrashItem) -> void:
	item.release()
	_trash_live.erase(item)
	if not _trash_pool.has(item):
		_trash_pool.append(item)


func _on_pedestrian_discarded(kind: StringName, at: Vector3, impulse: Vector3) -> void:
	_spawn_trash(TrashCatalog.get_kind(kind), at, impulse)


func _on_vehicle_shed(kind: StringName, at: Vector3, impulse: Vector3) -> void:
	_spawn_trash(TrashCatalog.get_kind(kind), at, impulse)


func _on_vehicle_hit(vehicle: Vehicle, speed: float) -> void:
	var lost := slime.take_hit(vehicle.global_position, clampf(speed * 0.8, 4.0, 11.0))
	for item: TrashItem in lost:
		if not _trash_live.has(item):
			_trash_live.append(item)
	var capacity := 0
	for item: TrashItem in lost:
		capacity += item.kind.capacity
	rules.on_hit(lost.size(), capacity, 4.0)
	GameAudio.sfx(&"bounce", slime.global_position)
	toast.emit("Autsch! -4s")


func _on_event_started(id: StringName, district: StringName, duration: float) -> void:
	toast.emit(events.label(id))
	match id:
		EventDirector.LORRY_SPILL:
			_spill_sacks(district)
		EventDirector.FESTIVAL, EventDirector.SCHOOL_OUT:
			_dump_district_litter(district, 14 if id == EventDirector.FESTIVAL else 9)


func _on_event_finished(id: StringName) -> void:
	pass


## A lorry loses its load: sacks land in a line along the road and scatter.
func _spill_sacks(district: StringName) -> void:
	var lorry: Vehicle
	for vehicle: Vehicle in _vehicles:
		if vehicle.kind == &"bin_lorry":
			lorry = vehicle
			break
	var origin := Vector3.ZERO
	if lorry != null:
		origin = lorry.global_position
	else:
		var d := island.district(district)
		origin = Vector3(d.centre.x, IslandLayout.GROUND_Y, d.centre.y) if d != null else Vector3.ZERO
	for i in range(6):
		var spread := Vector3(_rng.randf_range(-1.0, 1.0), 0.0, _rng.randf_range(-1.0, 1.0))
		_spawn_trash(TrashCatalog.get_kind(&"trash_bag"),
				origin + Vector3(0, 1.4, 0) + spread,
				spread * 3.0 + Vector3(0, 2.4, 0))


func _dump_district_litter(district: StringName, count: int) -> void:
	var ids := TrashCatalog.district_ids(district)
	var spots := island.scatter_in_district(district, count, _rng.randi_range(0, 9999), 5.0)
	for spot: Vector2 in spots:
		var kind := TrashCatalog.get_kind(ids[_rng.randi_range(0, ids.size() - 1)])
		_spawn_trash(kind, Vector3(spot.x, IslandLayout.GROUND_Y + 1.2, spot.y),
				Vector3(_rng.randf_range(-1.0, 1.0), 1.5, _rng.randf_range(-1.0, 1.0)))


## Nearest active station, for the HUD's direction arrow.
func nearest_active_station() -> RecyclingStation:
	var best: RecyclingStation
	var best_d := INF
	for station: RecyclingStation in stations:
		if not station.active:
			continue
		var d := station.global_position.distance_to(slime.global_position)
		if d < best_d:
			best_d = d
			best = station
	return best


func litter_on_ground() -> int:
	var count := 0
	for item: TrashItem in _trash_live:
		if item.state == TrashItem.State.LOOSE or item.state == TrashItem.State.FALLING:
			count += 1
	return count
