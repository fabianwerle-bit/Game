class_name Slime
extends CharacterBody3D

## The player. Owns its own motion model, builds its visual body in code and
## keeps the litter stuck to it in sync.
##
## The body is split into two roots on purpose: `_roll_root` spins as the slime
## travels and carries the collected litter with it, while `_face_root` only
## yaws to face the direction of travel. That is what stops the eyes from
## tumbling round with the body.

signal picked_up(kind: TrashCatalog.Kind, item: TrashItem)
signal banked(items: Array)
signal hit_by_vehicle(speed: float)
signal fell_in_water()

const MAGNET_RADIUS := 1.5
const MAGNET_PULL := 9.0
const HIT_INVULNERABLE := 1.4
const GRAVITY := 24.0

var motion := SlimeMotion.new()
var island: IslandLayout

## Litter currently riding on the body, in slot order.
var carried: Array[TrashItem] = []
var capacity_used: int = 0
var capacity_max: int = TrashCatalog.CAPACITY_MAX

var invulnerable: float = 0.0
var spawn_point: Vector3 = Vector3.ZERO

var _roll_root: Node3D
var _face_root: Node3D
var _body_mesh: MeshInstance3D
var _shader: ShaderMaterial
var _collision: CollisionShape3D
var _sphere: SphereShape3D
var _spray: GPUParticles3D
var _magnet: Area3D
var _magnet_shape: SphereShape3D

var _input: Vector2 = Vector2.ZERO
var _camera_yaw: float = PI
var _vertical: float = 0.0


func _ready() -> void:
	collision_layer = 1 << 1          # slime
	collision_mask = 1                # world
	_build_body()
	_build_face()
	_build_magnet()
	motion.reset(PI)
	_apply_size()


func _build_body() -> void:
	_sphere = SphereShape3D.new()
	_sphere.radius = motion.radius()
	_collision = CollisionShape3D.new()
	_collision.shape = _sphere
	add_child(_collision)

	_roll_root = Node3D.new()
	_roll_root.name = "RollRoot"
	add_child(_roll_root)

	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	mesh.radial_segments = 28
	mesh.rings = 16
	_body_mesh = MeshInstance3D.new()
	_body_mesh.name = "Body"
	_body_mesh.mesh = mesh
	_shader = ShaderMaterial.new()
	_shader.shader = load("res://shaders/slime.gdshader")
	_body_mesh.material_override = _shader
	_body_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	Skins.apply(_shader, GameSettings.skin())
	_roll_root.add_child(_body_mesh)

	_spray = GPUParticles3D.new()
	_spray.name = "Spray"
	_spray.emitting = false
	_spray.amount = 16
	_spray.lifetime = 0.5
	_spray.local_coords = false
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 55.0
	pm.initial_velocity_min = 1.0
	pm.initial_velocity_max = 2.6
	pm.gravity = Vector3(0, -9.0, 0)
	pm.scale_min = 0.3
	pm.scale_max = 0.8
	pm.color = Color(0.45, 0.95, 0.45, 0.9)
	_spray.process_material = pm
	var drop := SphereMesh.new()
	drop.radius = 0.06
	drop.height = 0.12
	drop.radial_segments = 6
	drop.rings = 4
	# The particle material's own colour only reaches the mesh through its
	# vertex colour, so without this the droplets come out grey and the trail
	# reads as grit thrown up rather than as slime flicked off.
	var droplet := StandardMaterial3D.new()
	droplet.albedo_color = Color(0.45, 0.95, 0.48)
	droplet.vertex_color_use_as_albedo = true
	droplet.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	drop.material = droplet
	_spray.draw_pass_1 = drop
	add_child(_spray)


## Eyes and mouth live on a root that yaws but never rolls, so the face always
## reads even while the body is spinning.
func _build_face() -> void:
	_face_root = Node3D.new()
	_face_root.name = "Face"
	add_child(_face_root)

	var white := StandardMaterial3D.new()
	white.albedo_color = Color(0.99, 0.99, 0.97)
	white.roughness = 0.25
	# Shadeless, or the gel body's own lighting washes the face out until the
	# eyes read as two faint smudges.
	white.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var pupil_mat := StandardMaterial3D.new()
	pupil_mat.albedo_color = Color(0.05, 0.06, 0.08)
	pupil_mat.roughness = 0.15
	pupil_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var mouth_mat := StandardMaterial3D.new()
	mouth_mat.albedo_color = Color(0.22, 0.08, 0.12)
	mouth_mat.roughness = 0.5
	mouth_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED

	for side: float in [-1.0, 1.0]:
		var eye := MeshInstance3D.new()
		var eye_mesh := SphereMesh.new()
		eye_mesh.radius = 0.34
		eye_mesh.height = 0.68
		eye_mesh.radial_segments = 14
		eye_mesh.rings = 9
		eye.mesh = eye_mesh
		eye.material_override = white
		# Set wide on the flanks rather than flat on the front. The camera
		# chases from behind, and eyes placed on the nose were never once
		# visible in play - the slime read as a bare ball. Out here they
		# catch the silhouette from three quarters and from behind.
		# The body is a unit sphere at this point, so anything much below
		# 0.9 from the centre is swallowed by the gel.
		eye.position = Vector3(side * 0.56, 0.36, 0.66)
		eye.name = "Eye%s" % ("L" if side < 0.0 else "R")
		_face_root.add_child(eye)

		var pupil := MeshInstance3D.new()
		var pupil_mesh := SphereMesh.new()
		pupil_mesh.radius = 0.19
		pupil_mesh.height = 0.38
		pupil_mesh.radial_segments = 10
		pupil_mesh.rings = 7
		pupil.mesh = pupil_mesh
		pupil.material_override = pupil_mat
		pupil.position = Vector3(side * 0.64, 0.33, 0.78)
		pupil.name = "Pupil%s" % ("L" if side < 0.0 else "R")
		_face_root.add_child(pupil)

	var mouth := MeshInstance3D.new()
	var mouth_mesh := SphereMesh.new()
	mouth_mesh.radius = 0.2
	mouth_mesh.height = 0.4
	mouth_mesh.radial_segments = 12
	mouth_mesh.rings = 7
	mouth.mesh = mouth_mesh
	mouth.material_override = mouth_mat
	mouth.position = Vector3(0, -0.22, 0.99)
	mouth.scale = Vector3(1.5, 0.55, 0.35)
	mouth.name = "Mouth"
	_face_root.add_child(mouth)


func _build_magnet() -> void:
	_magnet = Area3D.new()
	_magnet.name = "Magnet"
	_magnet.collision_layer = 0
	_magnet.collision_mask = 1 << 2   # trash
	_magnet.monitoring = true
	_magnet_shape = SphereShape3D.new()
	_magnet_shape.radius = MAGNET_RADIUS
	var shape := CollisionShape3D.new()
	shape.shape = _magnet_shape
	_magnet.add_child(shape)
	add_child(_magnet)


## Feed the joystick. `input` is (right, forward) with +y away from the player.
func set_input(input: Vector2, camera_yaw: float) -> void:
	_input = input
	_camera_yaw = camera_yaw


func _physics_process(delta: float) -> void:
	if invulnerable > 0.0:
		invulnerable = maxf(invulnerable - delta, 0.0)

	motion.airborne = not is_on_floor()
	motion.step(delta, _input, _camera_yaw)

	if is_on_floor():
		_vertical = -1.0
	else:
		_vertical -= GRAVITY * delta

	velocity = Vector3(motion.velocity.x, _vertical, motion.velocity.y)
	move_and_slide()

	# A wall taken at speed squashes the body and costs momentum.
	if get_slide_collision_count() > 0 and motion.velocity.length() > 2.0:
		var before := motion.velocity.length()
		var actual := Vector2(velocity.x, velocity.z).length()
		if before - actual > 1.2:
			motion.impact(clampf((before - actual) / SlimeMotion.SPEED_EMPTY, 0.0, 1.0))
			motion.velocity = motion.velocity * 0.55

	_apply_size()
	_apply_visuals(delta)
	_update_carried(delta)
	_check_water()


func _apply_size() -> void:
	var r := motion.radius()
	_sphere.radius = r
	_magnet_shape.radius = r + MAGNET_RADIUS
	# The collision sphere's centre sits one radius up, so the body rests on
	# the ground rather than half sunk into it.
	_collision.position = Vector3(0, r, 0)
	_roll_root.position = Vector3(0, r, 0)
	_face_root.position = Vector3(0, r, 0)
	_face_root.scale = Vector3.ONE * r
	_spray.position = Vector3(0, r * 0.3, 0)


func _apply_visuals(delta: float) -> void:
	# Roll about the axis perpendicular to travel.
	var dir := motion.velocity
	if dir.length() > 0.05:
		var axis := Vector3(-dir.y, 0.0, dir.x).normalized()
		_roll_root.global_basis = Basis(axis, motion.roll)
	_body_mesh.scale = motion.deform_scale() * motion.radius()

	_face_root.rotation.y = -motion.heading + PI * 0.5
	# Lean the face into acceleration, so the slime looks like it is leading
	# with its nose.
	_face_root.rotation.x = clampf(-motion.stretch * 0.5, -0.4, 0.4)

	_shader.set_shader_parameter("wobble", motion.wobble())
	_spray.emitting = motion.is_spraying() and is_on_floor()


## Swap the body's appearance, used live by the skin picker.
func apply_skin(index: int) -> void:
	Skins.apply(_shader, index)


func set_fade(alpha: float) -> void:
	_shader.set_shader_parameter("fade", alpha)
	_face_root.visible = alpha > 0.35


func _update_carried(delta: float) -> void:
	var slime_transform := Transform3D(_roll_root.global_basis, _roll_root.global_position)
	var r := motion.radius()
	for item: TrashItem in carried:
		item.step(delta, slime_transform, r)


func _check_water() -> void:
	if island == null:
		return
	var here := Vector2(global_position.x, global_position.z)
	if island.is_walkable(here, 0.0) and global_position.y > IslandLayout.WATER_Y - 1.0:
		return
	var safe := island.nearest_safe_point(here, 7.0)
	global_position = Vector3(safe.x, IslandLayout.GROUND_Y + motion.radius() + 0.2, safe.y)
	motion.velocity = Vector2.ZERO
	_vertical = 0.0
	motion.impact(0.5)
	fell_in_water.emit()


## Pull nearby litter in and swallow whatever reaches the surface. Returns the
## pieces taken this frame.
func collect_nearby(delta: float) -> Array[TrashItem]:
	var taken: Array[TrashItem] = []
	if capacity_used >= capacity_max:
		return taken
	for area in _magnet.get_overlapping_areas():
		var item := area.get_parent() as TrashItem
		if item == null or item.state == TrashItem.State.ATTACHED:
			continue
		if item.state == TrashItem.State.BANKING or item.state == TrashItem.State.POOLED:
			continue
		if capacity_used + item.kind.capacity > capacity_max:
			continue
		var to_slime := global_position + Vector3(0, motion.radius(), 0) - item.global_position
		var distance := to_slime.length()
		if distance <= motion.radius() + item.radius() + 0.12:
			_attach(item)
			taken.append(item)
		else:
			# Magnet: close enough to count, so the player does not have to be
			# millimetre accurate.
			item.global_position += to_slime.normalized() * MAGNET_PULL * delta
	return taken


func _attach(item: TrashItem) -> void:
	carried.append(item)
	capacity_used += item.kind.capacity
	_reslot()
	item.attach(carried.size() - 1, maxi(carried.size(), 6))
	motion.fill = float(capacity_used) / float(capacity_max)
	motion.impact(0.12)
	picked_up.emit(item.kind, item)


func _reslot() -> void:
	var total := maxi(carried.size(), 6)
	for i in range(carried.size()):
		carried[i].reslot(i, total)


## Hand everything over to a station. Returns the pieces that were banked.
func bank_into(station_position: Vector3) -> Array[TrashItem]:
	var handed: Array[TrashItem] = []
	for item: TrashItem in carried:
		item.bank_towards(station_position)
		handed.append(item)
	carried.clear()
	capacity_used = 0
	motion.fill = 0.0
	return handed


## A vehicle hit the slime. Knocks it clear, shakes some litter loose and
## returns the pieces that came off.
func take_hit(from: Vector3, force: float) -> Array[TrashItem]:
	var lost: Array[TrashItem] = []
	if invulnerable > 0.0:
		return lost
	invulnerable = HIT_INVULNERABLE

	var away := global_position - from
	away.y = 0.0
	if away.length() < 0.01:
		away = Vector3(cos(motion.heading), 0.0, sin(motion.heading))
	away = away.normalized()
	motion.velocity = Vector2(away.x, away.z) * force
	_vertical = 6.0
	motion.impact(1.0)

	# Roughly a third of the load shakes off, and at least one piece.
	var drop := maxi(1, carried.size() / 3)
	for i in range(mini(drop, carried.size())):
		var item: TrashItem = carried.pop_back()
		capacity_used = maxi(capacity_used - item.kind.capacity, 0)
		var toss := Vector3(randf_range(-1.0, 1.0), 1.0, randf_range(-1.0, 1.0)).normalized()
		item.toss(item.global_position, toss * 4.5 + away * 2.0, IslandLayout.GROUND_Y)
		lost.append(item)
	_reslot()
	motion.fill = float(capacity_used) / float(capacity_max)
	hit_by_vehicle.emit(force)
	return lost


func reset_at(point: Vector3) -> void:
	spawn_point = point
	global_position = point
	motion.reset(PI)
	carried.clear()
	capacity_used = 0
	invulnerable = 0.0
	_vertical = 0.0
	_apply_size()


func fill_ratio() -> float:
	return float(capacity_used) / float(capacity_max)


func is_full() -> bool:
	return capacity_used >= capacity_max
