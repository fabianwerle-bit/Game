class_name RecyclingStation
extends Node3D

## A drop-off point. Banking is automatic: roll in with a load and it empties.
##
## Several stations exist across the island and only some are active at a time,
## so the best route keeps changing instead of settling into one short loop.

signal slime_arrived(station: RecyclingStation)

const INTAKE_RADIUS := 3.2

var district: StringName = &""
var active: bool = true

var _area: Area3D
var _model: Node3D
var _glow: OmniLight3D
var _pulse: float = 0.0
var _cooldown: float = 0.0


func _ready() -> void:
	_model = AssetLibrary.model(&"recycling_station")
	add_child(_model)
	_glow = _model.find_child("Glow", true, false) as OmniLight3D

	_area = Area3D.new()
	_area.name = "Intake"
	_area.collision_layer = 1 << 5     # station
	_area.collision_mask = 1 << 1      # slime
	var shape := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = INTAKE_RADIUS
	shape.shape = sphere
	shape.position = Vector3(0, 1.0, 0)
	_area.add_child(shape)
	add_child(_area)


func _process(delta: float) -> void:
	_pulse += delta * (3.4 if active else 0.8)
	if _glow != null:
		var base := 2.2 if active else 0.35
		_glow.light_energy = base + sin(_pulse) * (0.7 if active else 0.1)
	if _model != null:
		# The emblem turns, faster while the station is taking deliveries.
		_model.rotation.y += delta * (0.9 if active else 0.2)
	if _cooldown > 0.0:
		_cooldown = maxf(_cooldown - delta, 0.0)


func set_active(value: bool) -> void:
	active = value


## Where litter should fly to when it is handed in.
func intake_point() -> Vector3:
	return global_position + Vector3(0, 1.1, 0)


func slime_in_range(slime: Slime) -> bool:
	if not active or _cooldown > 0.0:
		return false
	for body in _area.get_overlapping_bodies():
		if body == slime:
			return true
	return false


## Called after a delivery so a slime parked on the station does not bank an
## empty load every frame.
func begin_cooldown() -> void:
	_cooldown = 0.35
