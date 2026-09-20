class_name AssetLibrary
extends RefCounted

## Resolves a prop name to a 3D model.
##
## Real artwork under `res://assets/models/<name>.(glb|gltf|tscn)` always wins.
## When a name has no artwork yet, `PropBuilder` supplies composed stand-in
## geometry and the name is recorded as a placeholder. Nothing here pretends a
## stand-in is finished art: `placeholder_report()` lists every one of them and
## the boot log prints the count, so what is still missing stays visible.
##
## The artwork is Kenney's CC0 city, suburban, car and nature kits. Two things
## have to be done to it on the way in, and both are recorded here rather than
## baked into the files:
##
##   Scale. The kits are modelled around one unit per module, not one unit per
##   metre, so a shop arrives about ninety centimetres tall. `SCALES` says what
##   one unit is worth for each model.
##
##   Colour. The kits paint everything from one shared palette texture. Godot
##   drops it when it is embedded in a .glb, leaving every building plain
##   white, so the palette is shipped alongside as a .png and reattached here.

const MODEL_DIR := "res://assets/models"
const TEXTURE_DIR := "res://assets/models/textures"
const EXTENSIONS := [".glb", ".gltf", ".tscn", ".scn", ".res"]

## Metres per model unit, per model. Anything not listed is used as authored.
const SCALES := {
	# Commercial kit: a shop about six metres across, a block three storeys up.
	&"shop0": 5.2, &"shop1": 5.6, &"shop2": 4.4,
	&"block0": 5.4, &"block1": 4.0,
	&"warehouse0": 6.0, &"warehouse1": 6.0,
	# Suburban kit.
	&"house0": 5.6, &"house1": 5.6, &"house2": 5.2, &"house3": 5.4,
	&"beach_hut0": 2.6, &"beach_hut1": 2.6,
	&"planter": 3.0, &"fence": 4.0,
	# Nature kit.
	&"tree": 3.6, &"tree_small": 3.0, &"palm": 4.2,
	&"bush": 2.6, &"rock": 2.8, &"flowers": 3.0,
	# Car kit: a saloon a shade under four metres.
	&"car": 1.5, &"van": 1.5, &"truck": 1.5, &"bin_lorry": 1.45,
}

## Which kit's palette a model is painted from. The material inside the .glb
## is named "colormap"; when its texture is missing, this is what goes back on.
const PALETTES := {
	&"shop0": "colormap_city", &"shop1": "colormap_city", &"shop2": "colormap_city",
	&"block0": "colormap_city", &"block1": "colormap_city",
	&"warehouse0": "colormap_city", &"warehouse1": "colormap_city",
	&"house0": "colormap_suburban", &"house1": "colormap_suburban",
	&"house2": "colormap_suburban", &"house3": "colormap_suburban",
	&"beach_hut0": "colormap_suburban", &"beach_hut1": "colormap_suburban",
	&"planter": "colormap_suburban", &"fence": "colormap_suburban",
	&"car": "colormap_cars", &"van": "colormap_cars",
	&"truck": "colormap_cars", &"bin_lorry": "colormap_cars",
}

static var _palette_cache: Dictionary = {}

static var _cache: Dictionary = {}
static var _placeholders: Dictionary = {}
static var _real: Dictionary = {}


## Returns a fresh instance of `name`, ready to add to the scene.
##
## `tint` washes the model towards one colour. The building kits are painted
## almost entirely in white and grey, which is a sober look for an island
## meant to read as a toy town, so the city gives each building one of the
## palette's candy colours to wear.
static func model(name: StringName, tint: Color = Color.WHITE) -> Node3D:
	var packed := _packed(name)
	if packed != null:
		var node := packed.instantiate()
		if node is Node3D:
			var node3d: Node3D = node
			_scale_to_metres(node3d, name)
			_dress(node3d, name, tint)
			return node3d
		node.queue_free()
	return PropBuilder.build(name)


## Wrap an imported model so one model unit becomes one metre.
##
## The scale goes on a holder rather than on the imported root, so the caller
## still gets a plain Node3D it can position and rotate, and the footprint the
## city measures comes out in metres like every other prop's.
static func _scale_to_metres(node: Node3D, name: StringName) -> void:
	if not SCALES.has(name):
		return
	var metres: float = SCALES[name]
	node.scale = Vector3.ONE * metres


## Put the kit's palette texture back on, and wash the model in `tint`.
##
## Both go on an override material rather than on the imported one, because
## the imported material is shared by every copy of that model in the scene -
## editing it in place would repaint the whole street the same colour.
##
## Nothing else about the imported material is touched. Forcing the flat
## shading the rest of the island uses (lambert diffuse, specular off,
## roughness 1) onto one of these renders it solid black under the GL
## compatibility renderer the mobile builds use. The kits are already matte
## enough that they sit happily beside the hand-built props.
static func _dress(node: Node3D, name: StringName, tint: Color) -> void:
	var texture := _palette(PALETTES[name]) if PALETTES.has(name) else null
	var wash := not tint.is_equal_approx(Color.WHITE)
	if texture == null and not wash:
		return
	for mesh: MeshInstance3D in _mesh_instances(node):
		if mesh.mesh == null:
			continue
		for i: int in range(mesh.mesh.get_surface_count()):
			var mat := mesh.mesh.surface_get_material(i)
			if mat is not StandardMaterial3D:
				continue
			var standard: StandardMaterial3D = mat
			var fixed: StandardMaterial3D = standard.duplicate()
			if texture != null and fixed.albedo_texture == null:
				fixed.albedo_texture = texture
				# The palette is a grid of flat colour patches. Filtering
				# across patch borders smears neighbours into every edge.
				fixed.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
			if wash:
				# Multiplied, not replaced: the kit's own shading, roof
				# colour and window glass survive underneath the wash.
				fixed.albedo_color = fixed.albedo_color * tint
			mesh.set_surface_override_material(i, fixed)


static func _palette(key: String) -> Texture2D:
	if _palette_cache.has(key):
		return _palette_cache[key]
	var path := "%s/%s.png" % [TEXTURE_DIR, key]
	var texture: Texture2D = load(path) if ResourceLoader.exists(path) else null
	if texture == null:
		push_warning("missing kit palette %s" % path)
	_palette_cache[key] = texture
	return texture


static func _mesh_instances(node: Node) -> Array:
	var out: Array = []
	if node is MeshInstance3D:
		out.append(node)
	for child: Node in node.get_children():
		out.append_array(_mesh_instances(child))
	return out


static func _packed(name: StringName) -> PackedScene:
	if _cache.has(name):
		return _cache[name]
	for ext: String in EXTENSIONS:
		var path := "%s/%s%s" % [MODEL_DIR, name, ext]
		if ResourceLoader.exists(path):
			var res := load(path)
			if res is PackedScene:
				_cache[name] = res
				_real[name] = path
				return res
	_cache[name] = null
	_placeholders[name] = true
	return null


static func has_real_model(name: StringName) -> bool:
	_packed(name)
	return _real.has(name)


## Every prop currently drawn with stand-in geometry, sorted for stable output.
static func placeholder_report() -> Array:
	var names := _placeholders.keys()
	names.sort()
	return names


static func real_report() -> Array:
	var names := _real.keys()
	names.sort()
	return names


static func reset() -> void:
	_cache.clear()
	_placeholders.clear()
	_real.clear()
	_palette_cache.clear()
