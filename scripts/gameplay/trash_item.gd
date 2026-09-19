class_name TrashItem
extends Node3D

## One piece of litter in the world.
##
## Lives in one of four states. Pooled items are hidden and idle; loose items
## lie on the ground waiting to be found; falling items are mid-toss after
## somebody discarded them; attached items ride on the slime. The world pools
## these rather than freeing them, so a long round does not grow an unbounded
## pile of nodes.

enum State { POOLED, LOOSE, FALLING, ATTACHED, BANKING }

signal wants_return(item: TrashItem)

var kind: TrashCatalog.Kind
var state: int = State.POOLED

## Set while FALLING: simple ballistic toss with a bounce, which is cheaper and
## more predictable than a rigid body for something this small.
var _velocity: Vector3 = Vector3.ZERO
var _spin: Vector3 = Vector3.ZERO
var _ground_y: float = 0.0
var _bounces: int = 0

## Set while ATTACHED or BANKING.
var _slot: int = 0
var _slot_total: int = 1
var _blend: float = 0.0
var _from: Transform3D = Transform3D.IDENTITY

## Wind push applied to light litter during a gust event.
var wind: Vector3 = Vector3.ZERO

var _model: Node3D
var _radius: float = 0.08
var _age: float = 0.0

const GRAVITY := 18.0
const BOUNCE := 0.34
const MAX_BOUNCES := 3
const ATTACH_TIME := 0.16


func setup(p_kind: TrashCatalog.Kind) -> void:
	kind = p_kind
	if _model != null:
		_model.queue_free()
	_model = AssetLibrary.model(kind.model)
	add_child(_model)
	_radius = _estimate_radius()


func _estimate_radius() -> float:
	var box := AABB()
	var first := true
	for mi: MeshInstance3D in _meshes(_model):
		if mi.mesh == null:
			continue
		var local := mi.mesh.get_aabb()
		local.position *= mi.scale
		local.size *= mi.scale
		local.position += mi.position
		if first:
			box = local
			first = false
		else:
			box = box.merge(local)
	return maxf(box.size.length() * 0.35, 0.04)


func _meshes(node: Node) -> Array:
	var out: Array = []
	if node == null:
		return out
	if node is MeshInstance3D:
		out.append(node)
	for child in node.get_children():
		out.append_array(_meshes(child))
	return out


func radius() -> float:
	return _radius


## Drop this piece from `at` with an initial toss. Used when a pedestrian
## discards something or a lorry sheds a sack.
func toss(at: Vector3, impulse: Vector3, ground_y: float) -> void:
	state = State.FALLING
	global_position = at
	_velocity = impulse
	_ground_y = ground_y
	_bounces = 0
	_age = 0.0
	_spin = Vector3(randf_range(-6.0, 6.0), randf_range(-6.0, 6.0), randf_range(-6.0, 6.0))
	visible = true


## Place this piece straight onto the ground, for world seeding.
func place(at: Vector3) -> void:
	state = State.LOOSE
	global_position = at
	rotation = Vector3(0.0, randf() * TAU, 0.0)
	_velocity = Vector3.ZERO
	_age = 0.0
	visible = true


## Begin riding on the slime in slot `slot` of `total`.
func attach(slot: int, total: int) -> void:
	state = State.ATTACHED
	_slot = slot
	_slot_total = total
	_blend = 0.0
	_from = global_transform


func reslot(slot: int, total: int) -> void:
	_slot = slot
	_slot_total = total


## Start the pull into a recycling station.
func bank_towards(target: Vector3) -> void:
	state = State.BANKING
	_from = global_transform
	_velocity = (target - global_position)
	_blend = 0.0


func release() -> void:
	state = State.POOLED
	visible = false
	wind = Vector3.ZERO


func step(delta: float, slime_transform: Transform3D, slime_radius: float) -> void:
	_age += delta
	match state:
		State.FALLING:
			_step_falling(delta)
		State.LOOSE:
			_step_loose(delta)
		State.ATTACHED:
			_step_attached(delta, slime_transform, slime_radius)
		State.BANKING:
			_step_banking(delta)


func _step_falling(delta: float) -> void:
	_velocity.y -= GRAVITY * delta
	_velocity += wind * kind.wind_drift * delta
	global_position += _velocity * delta
	rotation += _spin * delta
	if global_position.y <= _ground_y:
		global_position.y = _ground_y
		if _bounces >= MAX_BOUNCES or _velocity.length() < 0.6:
			# Settle: lie flat on the ground and stop.
			state = State.LOOSE
			_velocity = Vector3.ZERO
			rotation = Vector3(0.0, rotation.y, 0.0)
			_play_landing(0.7)
			return
		_bounces += 1
		_play_landing(1.0)
		_velocity.y = absf(_velocity.y) * BOUNCE
		_velocity.x *= 0.7
		_velocity.z *= 0.7
		_spin *= 0.5


## Glass rings, cans rattle, paper barely registers. The catalog names the
## material; the sound bank is keyed on it.
func _play_landing(strength: float) -> void:
	var volume := linear_to_db(clampf(strength * minf(_velocity.length() / 5.0, 1.0), 0.05, 1.0))
	GameAudio.sfx(StringName("litter_%s" % kind.sound), global_position,
			randf_range(0.9, 1.15), volume)


func _step_loose(delta: float) -> void:
	# Only light litter is moved by wind, and only while a gust is blowing.
	if wind.length_squared() < 0.01 or kind.wind_drift <= 0.01:
		return
	var drift := wind * kind.wind_drift * delta
	drift.y = 0.0
	global_position += drift
	rotation.y += drift.length() * 2.2


func _step_attached(delta: float, slime_transform: Transform3D, slime_radius: float) -> void:
	var local_pos := AttachmentPoints.position(_slot, _slot_total, slime_radius, _radius)
	var local_basis := AttachmentPoints.basis(_slot, _slot_total)
	var target := Transform3D(slime_transform.basis * local_basis,
			slime_transform.origin + slime_transform.basis * local_pos)
	if _blend < 1.0:
		# Short suck-in from wherever the piece was when it was caught.
		_blend = minf(_blend + delta / ATTACH_TIME, 1.0)
		var eased := 1.0 - pow(1.0 - _blend, 3.0)
		global_transform = _from.interpolate_with(target, eased)
	else:
		global_transform = target


func _step_banking(delta: float) -> void:
	_blend = minf(_blend + delta * 3.4, 1.0)
	var eased := _blend * _blend
	global_position = _from.origin + _velocity * eased
	rotation += Vector3(7.0, 9.0, 5.0) * delta
	scale = Vector3.ONE * (1.0 - eased * 0.85)
	if _blend >= 1.0:
		scale = Vector3.ONE
		wants_return.emit(self)
