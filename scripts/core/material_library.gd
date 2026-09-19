class_name MaterialLibrary
extends RefCounted

## Builds PBR materials from the CC0 texture sets in `assets/textures/`.
##
## Each set is three 1k maps: `albedo.jpg`, `normal.jpg` (OpenGL convention)
## and `orm.jpg`, which packs ambient occlusion, roughness and metallic into
## red, green and blue — exactly Godot's ORM layout. Fetch them with
## `tools/fetch_assets.py`.
##
## A tint multiplies the albedo, so one asphalt or plaster set dresses a whole
## street of differently coloured buildings from a single pair of textures.
## When a set is absent the material still works as a plain coloured surface,
## and the slot is recorded so `missing_slots()` can report it rather than
## letting the world quietly look flat.

const DIR := "res://assets/textures"

const ROAD := &"road"
const PAVEMENT := &"pavement"
const CONCRETE := &"concrete"
const BRICK := &"brick"
const PLASTER := &"plaster"
const ROOF := &"roof"
const WOOD := &"wood"
const SAND := &"sand"
const GRASS := &"grass"
const METAL := &"metal"

const SLOTS: Array[StringName] = [ROAD, PAVEMENT, CONCRETE, BRICK, PLASTER,
		ROOF, WOOD, SAND, GRASS, METAL]

static var _textures: Dictionary = {}
static var _materials: Dictionary = {}
static var _missing: Dictionary = {}


## The three maps for a slot, or an empty dictionary when the set is absent.
static func maps(slot: StringName) -> Dictionary:
	if _textures.has(slot):
		return _textures[slot]
	var found := {}
	for map_name: String in ["albedo", "normal", "orm"]:
		var path := "%s/%s/%s.jpg" % [DIR, slot, map_name]
		if ResourceLoader.exists(path):
			found[map_name] = load(path)
	if not found.has("albedo"):
		_missing[slot] = true
		found = {}
	_textures[slot] = found
	return found


static func has_set(slot: StringName) -> bool:
	return not maps(slot).is_empty()


static func missing_slots() -> Array:
	for slot: StringName in SLOTS:
		maps(slot)
	var names := _missing.keys()
	names.sort()
	return names


## A textured material for `slot`, tinted and with the texture repeating every
## `uv_scale` world units.
static func surface(slot: StringName, tint: Color = Color.WHITE,
		uv_scale: float = 1.0) -> BaseMaterial3D:
	var key := "%s|%s|%.3f" % [slot, tint.to_html(true), uv_scale]
	if _materials.has(key):
		return _materials[key]

	var set := maps(slot)
	var material: BaseMaterial3D
	if set.is_empty():
		# No artwork for this slot: a plain tinted surface, and `missing_slots`
		# will say so.
		var plain := StandardMaterial3D.new()
		plain.albedo_color = tint
		plain.roughness = 0.9
		material = plain
	else:
		var orm := ORMMaterial3D.new()
		orm.albedo_texture = set["albedo"]
		orm.albedo_color = tint
		if set.has("normal"):
			orm.normal_enabled = true
			orm.normal_texture = set["normal"]
			orm.normal_scale = 1.0
		if set.has("orm"):
			orm.orm_texture = set["orm"]
		orm.uv1_scale = Vector3(uv_scale, uv_scale, uv_scale)
		orm.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
		material = orm

	_materials[key] = material
	return material


## Triplanar variant, for surfaces whose UVs are not laid out — the terrain
## skirt and rocks, where a planar projection would smear.
static func triplanar(slot: StringName, tint: Color = Color.WHITE,
		world_scale: float = 0.12) -> BaseMaterial3D:
	var key := "tri|%s|%s|%.3f" % [slot, tint.to_html(true), world_scale]
	if _materials.has(key):
		return _materials[key]
	var material := surface(slot, tint, 1.0)
	if material is ORMMaterial3D:
		var copy: ORMMaterial3D = material.duplicate()
		copy.uv1_triplanar = true
		copy.uv1_world_triplanar = true
		copy.uv1_scale = Vector3(world_scale, world_scale, world_scale)
		_materials[key] = copy
		return copy
	_materials[key] = material
	return material


static func reset() -> void:
	_textures.clear()
	_materials.clear()
	_missing.clear()
