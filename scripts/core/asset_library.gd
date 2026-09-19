class_name AssetLibrary
extends RefCounted

## Resolves a prop name to a 3D model.
##
## Real artwork under `res://assets/models/<name>.(glb|gltf|tscn)` always wins.
## When a name has no artwork yet, `PropBuilder` supplies composed stand-in
## geometry and the name is recorded as a placeholder. Nothing here pretends a
## stand-in is finished art: `placeholder_report()` lists every one of them and
## the boot log prints the count, so what is still missing stays visible.

const MODEL_DIR := "res://assets/models"
const EXTENSIONS := [".glb", ".gltf", ".tscn", ".scn", ".res"]

static var _cache: Dictionary = {}
static var _placeholders: Dictionary = {}
static var _real: Dictionary = {}


## Returns a fresh instance of `name`, ready to add to the scene.
static func model(name: StringName) -> Node3D:
	var packed := _packed(name)
	if packed != null:
		var node := packed.instantiate()
		if node is Node3D:
			return node
		node.queue_free()
	return PropBuilder.build(name)


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
