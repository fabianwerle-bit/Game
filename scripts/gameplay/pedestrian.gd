class_name Pedestrian
extends Node3D

## A person going about their day who occasionally creates the litter the
## player has to clear.
##
## Litter is always the result of a visible action: they carry something in
## their hand, they drink or eat from it, and only then do they toss it. The
## item that lands is the item they were holding. Nothing is conjured out of
## thin air on a timer.

signal discarded(kind: StringName, at: Vector3, impulse: Vector3)

enum State { WALK, WAIT, SIT, CONSUME, TOSS, ENTER, REACT }

const WALK_SPEED := 1.35
const CROSS_SPEED := 2.1
const TURN_RATE := 6.0
const AVOID_RADIUS := 1.1
const REACT_RADIUS := 3.2

var roads: RoadGraph
var island: IslandLayout

var state: int = State.WALK
var state_timer: float = 0.0

## Current leg of the walk along the pavement.
var _from_node: int = 0
var _to_node: int = 0
var _side: int = 1
var _progress: float = 0.0

var _heading: float = 0.0
var _speed: float = WALK_SPEED
var _bob: float = 0.0

## What they are holding, if anything, and how much of it is left.
var carrying: StringName = &""
var _consume_left: float = 0.0
var _litter_chance: float = 0.55

var _model: Node3D
var _hips: Node3D
var _torso: Node3D
var _head: Node3D
var _arm_l: Node3D
var _arm_r: Node3D
var _leg_l: Node3D
var _leg_r: Node3D
var _hand: Node3D
var _held_model: Node3D

var _rng := RandomNumberGenerator.new()
var _simplified: bool = false


func _ready() -> void:
	_model = AssetLibrary.model(&"pedestrian")
	add_child(_model)
	_hips = _model.find_child("Hips", true, false)
	_torso = _model.find_child("Torso", true, false)
	_head = _model.find_child("Head", true, false)
	_arm_l = _model.find_child("ArmLeft", true, false)
	_arm_r = _model.find_child("ArmRight", true, false)
	_leg_l = _model.find_child("LegLeft", true, false)
	_leg_r = _model.find_child("LegRight", true, false)
	_hand = _model.find_child("HandSocket", true, false)


func setup(p_roads: RoadGraph, p_island: IslandLayout, seed_value: int) -> void:
	roads = p_roads
	island = p_island
	_rng.seed = seed_value
	_litter_chance = _rng.randf_range(0.25, 0.8)
	_side = 1 if _rng.randf() < 0.5 else -1
	_from_node = _rng.randi_range(0, roads.nodes.size() - 1)
	_to_node = _pick_next(_from_node, -1)
	_progress = _rng.randf()
	_place()
	if _rng.randf() < 0.55:
		_take_item()


func _pick_next(at: int, avoid: int) -> int:
	var options := roads.neighbours(at)
	if options.is_empty():
		return at
	var choices: Array[int] = []
	for n: int in options:
		if n != avoid:
			choices.append(n)
	if choices.is_empty():
		choices = options
	return choices[_rng.randi_range(0, choices.size() - 1)]


func _place() -> void:
	var p := roads.pavement_point(_from_node, _to_node, _progress, _side)
	global_position = Vector3(p.x, IslandLayout.GROUND_Y, p.y)


## Give them something to carry. They will use it, then get rid of it.
func _take_item() -> void:
	var options := TrashCatalog.handheld_ids()
	carrying = options[_rng.randi_range(0, options.size() - 1)]
	_consume_left = _rng.randf_range(6.0, 16.0)
	if _hand != null:
		if _held_model != null:
			_held_model.queue_free()
		_held_model = AssetLibrary.model(carrying)
		_held_model.scale = Vector3.ONE * 0.9
		_hand.add_child(_held_model)


## Distant pedestrians skip their limb animation. They still walk, so the city
## keeps moving, but they stop costing anything to pose.
func set_simplified(value: bool) -> void:
	_simplified = value


func step(delta: float, slime_position: Vector3, slime_speed: float) -> void:
	state_timer -= delta
	match state:
		State.WALK:
			_step_walk(delta)
		State.WAIT, State.SIT:
			_step_idle(delta)
		State.CONSUME:
			_step_consume(delta)
		State.TOSS:
			_step_toss()
		State.ENTER:
			_step_idle(delta)
		State.REACT:
			_step_react(delta, slime_position)

	_react_to_slime(slime_position, slime_speed)
	if not _simplified:
		_animate(delta)


func _step_walk(delta: float) -> void:
	var a := roads.nodes[_from_node]
	var b := roads.nodes[_to_node]
	var leg_length := a.distance_to(b)
	if leg_length < 0.01:
		_to_node = _pick_next(_from_node, -1)
		return

	_progress += _speed * delta / leg_length
	if _progress >= 1.0:
		_progress = 0.0
		var previous := _from_node
		_from_node = _to_node
		_to_node = _pick_next(_from_node, previous)
		# At a junction there is a chance of stopping for a moment, which is
		# what makes a crowd look like people rather than traffic.
		if _rng.randf() < 0.22:
			state = State.WAIT
			state_timer = _rng.randf_range(1.5, 4.0)
			return

	var p := roads.pavement_point(_from_node, _to_node, _progress, _side)
	var target := Vector3(p.x, IslandLayout.GROUND_Y, p.y)
	var to_target := target - global_position
	to_target.y = 0.0
	if to_target.length() > 0.001:
		_heading = lerp_angle(_heading, atan2(to_target.z, to_target.x), TURN_RATE * delta)
	global_position = global_position.move_toward(target, _speed * delta)
	rotation.y = -_heading + PI * 0.5

	if carrying != &"":
		_consume_left -= delta
		if _consume_left <= 0.0:
			state = State.CONSUME
			state_timer = _rng.randf_range(0.8, 1.6)


func _step_idle(delta: float) -> void:
	if state_timer <= 0.0:
		state = State.WALK
		_speed = WALK_SPEED * _rng.randf_range(0.85, 1.15)


## The last swig or bite before they are done with it.
func _step_consume(delta: float) -> void:
	if _arm_r != null:
		# Raise the hand to the mouth.
		var t := 1.0 - clampf(state_timer / 1.2, 0.0, 1.0)
		_arm_r.rotation.x = -sin(t * PI) * 2.2
	if state_timer <= 0.0:
		if _arm_r != null:
			_arm_r.rotation.x = 0.0
		state = State.TOSS


func _step_toss() -> void:
	if carrying == &"":
		state = State.WALK
		return
	var at := global_position + Vector3(0, 1.0, 0)
	if _hand != null:
		at = _hand.global_position
	if _held_model != null:
		_held_model.queue_free()
		_held_model = null

	if _rng.randf() < _litter_chance:
		# Tossed over the shoulder, roughly away from where they are walking.
		var away := Vector3(cos(_heading + PI * 0.6), 0.0, sin(_heading + PI * 0.6))
		var impulse := away * _rng.randf_range(1.2, 2.6) + Vector3(0, _rng.randf_range(1.4, 2.6), 0)
		discarded.emit(carrying, at, impulse)
	# Otherwise they were a tidy one and it went in a bin; nothing spawns.

	carrying = &""
	state = State.WALK
	state_timer = 0.0
	# They will pick something up again later.
	if _rng.randf() < 0.7:
		_consume_left = _rng.randf_range(14.0, 30.0)
		await get_tree().create_timer(_rng.randf_range(6.0, 14.0)).timeout
		if is_inside_tree() and carrying == &"":
			_take_item()


func _react_to_slime(slime_position: Vector3, slime_speed: float) -> void:
	if state == State.REACT or state == State.TOSS:
		return
	var distance := global_position.distance_to(slime_position)
	if distance < REACT_RADIUS and slime_speed > 3.0:
		state = State.REACT
		state_timer = _rng.randf_range(0.6, 1.4)


## Startled: they turn to look and step aside.
func _step_react(delta: float, slime_position: Vector3) -> void:
	var away := global_position - slime_position
	away.y = 0.0
	if away.length() > 0.01:
		global_position += away.normalized() * delta * 1.8
		_heading = lerp_angle(_heading, atan2(-away.z, -away.x), 8.0 * delta)
		rotation.y = -_heading + PI * 0.5
	if _head != null:
		_head.rotation.x = -0.25
	if state_timer <= 0.0:
		if _head != null:
			_head.rotation.x = 0.0
		state = State.WALK


func _animate(delta: float) -> void:
	var moving := state == State.WALK or state == State.REACT
	var target_swing := 1.0 if moving else 0.0
	_bob += delta * _speed * 4.6 * target_swing

	var swing := sin(_bob) * 0.55 * target_swing
	if _leg_l != null:
		_leg_l.rotation.x = swing
	if _leg_r != null:
		_leg_r.rotation.x = -swing
	if _arm_l != null:
		_arm_l.rotation.x = -swing * 0.8
	if _arm_r != null and state != State.CONSUME:
		_arm_r.rotation.x = swing * 0.8
	if _hips != null:
		_hips.position.y = 0.92 + absf(sin(_bob)) * 0.035 * target_swing
	if _torso != null:
		_torso.rotation.z = sin(_bob) * 0.04 * target_swing
