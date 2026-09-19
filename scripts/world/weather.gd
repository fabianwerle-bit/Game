class_name Weather
extends Node

## Sky, sun and rain.
##
## Moves between five conditions by driving the real light and environment
## rather than tinting the finished frame: the sun changes colour, angle and
## energy, the sky and fog follow it, shadows soften under cloud, and rain adds
## particles plus a wet sheen the slime's handling actually reads.

const CLEAR := &"clear"
const FAIR := &"fair"
const OVERCAST := &"overcast"
const RAIN := &"rain"
const SUNSET := &"sunset"

const ORDER: Array[StringName] = [CLEAR, FAIR, OVERCAST, SUNSET, RAIN]

## Per condition: sun colour, sun energy, sky top, sky horizon, fog density,
## shadow softness, ambient energy.
const PRESETS := {
	CLEAR: {
		"sun": Color(1.0, 0.96, 0.86), "energy": 1.5,
		"top": Color(0.28, 0.52, 0.86), "horizon": Color(0.72, 0.85, 0.95),
		"fog": 0.0008, "blur": 0.6, "ambient": 1.0, "angle": -52.0,
	},
	FAIR: {
		"sun": Color(1.0, 0.95, 0.88), "energy": 1.25,
		"top": Color(0.35, 0.55, 0.82), "horizon": Color(0.78, 0.86, 0.92),
		"fog": 0.0016, "blur": 1.1, "ambient": 1.1, "angle": -48.0,
	},
	OVERCAST: {
		"sun": Color(0.88, 0.90, 0.94), "energy": 0.75,
		"top": Color(0.55, 0.58, 0.63), "horizon": Color(0.74, 0.76, 0.78),
		"fog": 0.0035, "blur": 2.6, "ambient": 1.35, "angle": -60.0,
	},
	RAIN: {
		"sun": Color(0.74, 0.79, 0.88), "energy": 0.5,
		"top": Color(0.38, 0.42, 0.48), "horizon": Color(0.58, 0.61, 0.65),
		"fog": 0.0075, "blur": 3.0, "ambient": 1.25, "angle": -65.0,
	},
	SUNSET: {
		"sun": Color(1.0, 0.62, 0.34), "energy": 1.35,
		"top": Color(0.22, 0.30, 0.55), "horizon": Color(0.96, 0.60, 0.34),
		"fog": 0.0042, "blur": 1.4, "ambient": 0.85, "angle": -12.0,
	},
}

## How wet the roads are, 0..1. Drives the slime's grip and the road sheen.
var wetness: float = 0.0

var condition: StringName = FAIR
var _target: StringName = FAIR
var _blend: float = 1.0

var sun: DirectionalLight3D
var environment: WorldEnvironment
var _rain: GPUParticles3D
var _road_materials: Array[StandardMaterial3D] = []
var _water_material: ShaderMaterial

var _rng := RandomNumberGenerator.new()
var _until_change: float = 0.0


func _ready() -> void:
	_rng.seed = IslandLayout.SEED + 91
	_until_change = _rng.randf_range(60.0, 110.0)


func setup(p_sun: DirectionalLight3D, p_env: WorldEnvironment) -> void:
	sun = p_sun
	environment = p_env
	_apply(PRESETS[condition], PRESETS[condition], 1.0)
	_build_rain()


func register_road_material(mat: StandardMaterial3D) -> void:
	if mat != null and not _road_materials.has(mat):
		_road_materials.append(mat)


func register_water_material(mat: ShaderMaterial) -> void:
	_water_material = mat


func _build_rain() -> void:
	_rain = GPUParticles3D.new()
	_rain.name = "Rain"
	_rain.emitting = false
	_rain.amount = 900
	_rain.lifetime = 1.1
	_rain.local_coords = false
	_rain.visibility_aabb = AABB(Vector3(-24, -6, -24), Vector3(48, 30, 48))

	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(22, 0.4, 22)
	pm.direction = Vector3(0.1, -1, 0.05)
	pm.spread = 3.0
	pm.initial_velocity_min = 16.0
	pm.initial_velocity_max = 20.0
	pm.gravity = Vector3(0, -6, 0)
	pm.scale_min = 0.5
	pm.scale_max = 1.0
	pm.color = Color(0.72, 0.80, 0.90, 0.5)
	_rain.process_material = pm

	var drop := BoxMesh.new()
	drop.size = Vector3(0.015, 0.34, 0.015)
	var drop_mat := StandardMaterial3D.new()
	drop_mat.albedo_color = Color(0.78, 0.85, 0.95, 0.55)
	drop_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	drop_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	drop.material = drop_mat
	_rain.draw_pass_1 = drop
	add_child(_rain)


## Keep the rain volume over the camera; it only needs to exist where it is seen.
func follow(point: Vector3) -> void:
	if _rain != null:
		_rain.global_position = point + Vector3(0, 14.0, 0)


func request(next: StringName) -> void:
	if next == _target or not PRESETS.has(next):
		return
	_target = next
	_blend = 0.0


## Forced on while the rain event runs, otherwise drifting on its own schedule.
func step(delta: float, forced_rain: bool) -> void:
	if forced_rain and _target != RAIN:
		request(RAIN)
	elif not forced_rain and _target == RAIN:
		request(FAIR)
	else:
		_until_change -= delta
		if _until_change <= 0.0 and not forced_rain:
			_until_change = _rng.randf_range(70.0, 130.0)
			var options: Array[StringName] = []
			for c: StringName in ORDER:
				if c != _target and c != RAIN:
					options.append(c)
			request(options[_rng.randi_range(0, options.size() - 1)])

	if _blend < 1.0:
		_blend = minf(_blend + delta * 0.25, 1.0)
		_apply(PRESETS[condition], PRESETS[_target], _blend)
		if _blend >= 1.0:
			condition = _target

	var wet_target := 1.0 if _target == RAIN else 0.0
	# Roads dry out more slowly than they soak.
	var rate := 0.25 if wet_target > wetness else 0.055
	wetness = move_toward(wetness, wet_target, rate * delta)
	_apply_wetness()

	if _rain != null:
		_rain.emitting = _target == RAIN or _blend < 0.5 and condition == RAIN


func _apply(from: Dictionary, to: Dictionary, t: float) -> void:
	if sun == null or environment == null:
		return
	sun.light_color = Color(from["sun"]).lerp(to["sun"], t)
	sun.light_energy = lerpf(from["energy"], to["energy"], t)
	sun.rotation_degrees.x = lerpf(from["angle"], to["angle"], t)
	sun.light_angular_distance = lerpf(from["blur"], to["blur"], t)

	var env := environment.environment
	if env == null:
		return
	var sky := env.sky
	if sky != null and sky.sky_material is ProceduralSkyMaterial:
		var mat: ProceduralSkyMaterial = sky.sky_material
		mat.sky_top_color = Color(from["top"]).lerp(to["top"], t)
		mat.sky_horizon_color = Color(from["horizon"]).lerp(to["horizon"], t)
		mat.ground_horizon_color = mat.sky_horizon_color
	env.fog_density = lerpf(from["fog"], to["fog"], t)
	env.fog_light_color = Color(from["horizon"]).lerp(to["horizon"], t)
	env.ambient_light_energy = lerpf(from["ambient"], to["ambient"], t)


## Wet tarmac is darker, smoother and far more reflective than dry tarmac.
func _apply_wetness() -> void:
	for mat: StandardMaterial3D in _road_materials:
		mat.roughness = lerpf(0.88, 0.16, wetness)
		mat.metallic = lerpf(0.0, 0.35, wetness)
	if _water_material != null:
		_water_material.set_shader_parameter("choppiness", lerpf(1.0, 1.8, wetness))


func label() -> String:
	match _target:
		CLEAR: return "Sonnenschein"
		FAIR: return "Leicht bewölkt"
		OVERCAST: return "Bewölkt"
		RAIN: return "Regen"
		SUNSET: return "Sonnenuntergang"
		_: return ""
