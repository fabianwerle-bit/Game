class_name Vehicle
extends Node3D

## A car, van, lorry or scooter driving the road network.
##
## It follows right-hand lanes between nodes, slows for the vehicle ahead,
## takes its turn at junctions through the graph's crossing tokens, and steers
## and spins its wheels from the motion it actually performed — so what the
## wheels do always matches where the vehicle went.

signal shed_litter(kind: StringName, at: Vector3, impulse: Vector3)
signal struck_slime(vehicle: Vehicle, speed: float)

const ARRIVE_EPSILON := 0.6
const BRAKE_DISTANCE := 9.0
const SLIME_BRAKE_DISTANCE := 7.0
const MAX_STEER := 0.55

var roads: RoadGraph
var kind: StringName = &"car"

var speed: float = 0.0
var top_speed: float = 11.0
var acceleration: float = 6.5
var braking: float = 14.0
var wheel_radius: float = 0.34
var body_half_length: float = 2.1
var hit_radius: float = 1.5

var id: int = 0
var braking_now: bool = false

var _from_node: int = 0
var _to_node: int = 0
var _progress: float = 0.0
var _heading: float = 0.0
var _claimed_junction: int = -1

var _model: Node3D
var _wheels: Array[Node3D] = []
var _steer_hubs: Array[Node3D] = []
var _brake_lights: Array[StandardMaterial3D] = []
var _wheel_spin: float = 0.0
var _steer_angle: float = 0.0

var _litter_timer: float = 0.0
var _rng := RandomNumberGenerator.new()


func setup(p_roads: RoadGraph, p_kind: StringName, seed_value: int, start_node: int) -> void:
	roads = p_roads
	kind = p_kind
	id = seed_value
	_rng.seed = seed_value

	match kind:
		&"van":
			top_speed = 9.5
			acceleration = 5.0
			wheel_radius = 0.38
			body_half_length = 2.7
			hit_radius = 1.8
		&"truck", &"bin_lorry":
			top_speed = 8.0
			acceleration = 3.6
			braking = 10.0
			wheel_radius = 0.47
			body_half_length = 3.6
			hit_radius = 2.1
		&"scooter":
			top_speed = 10.0
			acceleration = 7.5
			wheel_radius = 0.26
			body_half_length = 0.9
			hit_radius = 1.0
		&"bicycle":
			top_speed = 5.5
			acceleration = 4.0
			wheel_radius = 0.34
			body_half_length = 0.9
			hit_radius = 0.9
		_:
			top_speed = 11.0 * _rng.randf_range(0.88, 1.12)

	_model = AssetLibrary.model(kind)
	add_child(_model)
	_rig_wheels()
	for light in _find_all(_model, "BrakeLight"):
		var mi := light as MeshInstance3D
		if mi != null and mi.material_override is StandardMaterial3D:
			_brake_lights.append(mi.material_override)

	_from_node = start_node
	_to_node = roads.next_node(start_node, start_node, _rng)
	_progress = _rng.randf() * 0.6
	_litter_timer = _rng.randf_range(20.0, 55.0)
	_place()


func _find_all(node: Node, match_name: String) -> Array:
	var out: Array = []
	if node.name == match_name:
		out.append(node)
	for child in node.get_children():
		out.append_array(_find_all(child, match_name))
	return out


func _place() -> void:
	var p := roads.lane_point(_from_node, _to_node, _progress)
	global_position = Vector3(p.x, IslandLayout.GROUND_Y, p.y)
	var a := roads.nodes[_from_node]
	var b := roads.nodes[_to_node]
	_heading = (b - a).angle()
	rotation.y = -_heading + PI * 0.5


## `others` are the vehicles to keep clear of; `slime_position` lets a driver
## brake rather than plough straight through the player.
func step(delta: float, others: Array, slime_position: Vector3, traffic_scale: float) -> void:
	var a := roads.nodes[_from_node]
	var b := roads.nodes[_to_node]
	var leg := a.distance_to(b)
	if leg < 0.01:
		_advance()
		return

	var target_speed := top_speed * clampf(traffic_scale, 0.35, 1.0)
	var remaining := leg * (1.0 - _progress)

	# Slow into junctions, and stop outright if somebody else holds the token.
	if roads.is_junction(_to_node) and remaining < BRAKE_DISTANCE:
		if roads.request_junction(_to_node, id):
			_claimed_junction = _to_node
		else:
			target_speed = minf(target_speed, remaining * 0.6)

	# Keep a gap to the vehicle in front on the same leg.
	for other in others:
		var v := other as Vehicle
		if v == null or v == self:
			continue
		if v._from_node != _from_node or v._to_node != _to_node:
			continue
		if v._progress <= _progress:
			continue
		var gap := (v._progress - _progress) * leg - body_half_length - v.body_half_length
		if gap < BRAKE_DISTANCE:
			target_speed = minf(target_speed, maxf(gap * 1.3, 0.0))

	# And brake for the slime if it is on the road ahead.
	var to_slime := slime_position - global_position
	to_slime.y = 0.0
	var forward := Vector3(cos(_heading), 0.0, sin(_heading))
	if to_slime.length() < SLIME_BRAKE_DISTANCE and forward.dot(to_slime.normalized()) > 0.65:
		target_speed = minf(target_speed, maxf(to_slime.length() - 2.5, 0.0) * 1.6)

	braking_now = target_speed < speed - 0.4
	if speed < target_speed:
		speed = minf(speed + acceleration * delta, target_speed)
	else:
		speed = maxf(speed - braking * delta, target_speed)

	_progress += speed * delta / leg
	if _progress >= 1.0:
		_advance()
	else:
		_follow_lane(delta)

	_update_wheels(delta)
	_update_lights()
	_maybe_shed_litter(delta)


func _advance() -> void:
	if _claimed_junction >= 0:
		roads.release_junction(_claimed_junction, id)
		_claimed_junction = -1
	var previous := _from_node
	_from_node = _to_node
	_to_node = roads.next_node(previous, _from_node, _rng)
	_progress = 0.0


func _follow_lane(delta: float) -> void:
	var p := roads.lane_point(_from_node, _to_node, _progress)
	var target := Vector3(p.x, IslandLayout.GROUND_Y, p.y)
	var to_target := target - global_position
	to_target.y = 0.0
	if to_target.length() > 0.001:
		var want := atan2(to_target.z, to_target.x)
		var turn := angle_difference(_heading, want)
		# Remember how hard we turned so the front wheels can show it.
		_steer_angle = clampf(turn * 2.2, -MAX_STEER, MAX_STEER)
		_heading = lerp_angle(_heading, want, minf(6.0 * delta, 1.0))
	global_position = global_position.move_toward(target, speed * delta)
	global_position.y = IslandLayout.GROUND_Y
	rotation.y = -_heading + PI * 0.5


func _update_wheels(delta: float) -> void:
	# Spin follows the distance actually travelled, so wheels never skate.
	_wheel_spin += (speed * delta) / maxf(wheel_radius, 0.05)
	for wheel: Node3D in _wheels:
		wheel.rotation.x = _wheel_spin
	for hub: Node3D in _steer_hubs:
		hub.rotation.y = -_steer_angle


func _update_lights() -> void:
	var energy := 3.0 if braking_now else 0.0
	for mat: StandardMaterial3D in _brake_lights:
		mat.emission_energy_multiplier = energy


## Occasionally something goes out of a window, or off the back of a lorry.
func _maybe_shed_litter(delta: float) -> void:
	_litter_timer -= delta
	if _litter_timer > 0.0:
		return
	_litter_timer = _rng.randf_range(22.0, 60.0)

	var what := &"can"
	match kind:
		&"van", &"truck":
			what = &"box"
		&"bin_lorry":
			what = &"trash_bag"
		_:
			what = [&"can", &"cup", &"crisp_bag", &"food_wrap"][_rng.randi_range(0, 3)]

	# Out of the side window, or off the tail of a lorry.
	var side := Vector3(-sin(_heading), 0.0, cos(_heading)) * (1.0 if _rng.randf() < 0.5 else -1.0)
	var at := global_position + Vector3(0, 1.1, 0) + side * 1.0
	if kind == &"bin_lorry" or kind == &"truck":
		at = global_position - Vector3(cos(_heading), -1.0, sin(_heading)) * body_half_length
		side = Vector3.ZERO
	var impulse := side * 2.0 + Vector3(0, 2.2, 0)
	shed_litter.emit(what, at, impulse)


## Did this vehicle just run into the slime?
func check_slime_hit(slime: Slime) -> bool:
	if slime.invulnerable > 0.0 or speed < 1.5:
		return false
	var to_slime := slime.global_position - global_position
	to_slime.y = 0.0
	if to_slime.length() > hit_radius + slime.motion.radius():
		return false
	struck_slime.emit(self, speed)
	# The driver stands on the brakes afterwards.
	speed *= 0.25
	braking_now = true
	return true


func release_claims() -> void:
	if _claimed_junction >= 0 and roads != null:
		roads.release_junction(_claimed_junction, id)
		_claimed_junction = -1
## Find the wheels, whichever naming the model uses.
##
## The hand-built cars hang a "Spin" node inside a named hub, so steering and
## rolling are separate rotations. Kenney's car kit has no hubs at all: the
## wheels are plain meshes called wheel-front-left and so on. Supporting both
## keeps the wheels turning whether a vehicle is a real model or a stand-in.
func _rig_wheels() -> void:
	for side: String in ["FrontLeft", "FrontRight"]:
		var hub := _model.find_child(side, true, false) as Node3D
		if hub != null:
			_steer_hubs.append(hub)
	for side: String in ["FrontLeft", "FrontRight", "RearLeft", "RearRight"]:
		var hub := _model.find_child(side, true, false)
		if hub == null:
			continue
		var spin := hub.find_child("Spin", true, false) as Node3D
		if spin != null:
			_wheels.append(spin)
	if not _wheels.is_empty():
		return

	for side: String in ["wheel-front-left", "wheel-front-right"]:
		var wheel := _model.find_child(side, true, false) as Node3D
		if wheel != null:
			_steer_hubs.append(wheel)
	for side: String in ["wheel-front-left", "wheel-front-right",
			"wheel-back-left", "wheel-back-right"]:
		var wheel := _model.find_child(side, true, false) as Node3D
		if wheel != null:
			_wheels.append(wheel)
