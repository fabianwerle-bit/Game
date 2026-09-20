class_name PropBuilder
extends RefCounted

## Composed stand-in geometry for props that have no artwork yet.
##
## These are assembled from several shaped parts with proper materials — a
## house has walls, a pitched roof, a door and windows; a car has a cabin,
## glazing, bumpers and four wheels on hubs that the vehicle code steers and
## spins. They are honest stand-ins, not finished art: `AssetLibrary` records
## every name that lands here and the boot log prints the tally.
##
## Everything is built from primitive meshes on purpose. They cost almost
## nothing to instance, they share materials, and they are trivially replaced:
## drop `assets/models/<name>.glb` in and `AssetLibrary` picks it up instead,
## no code change.

static var _materials: Dictionary = {}

## Deterministic variant counter. Colour and build variety has to be
## repeatable: the map screen, a replay and the tests must all describe the
## same city, which a wall-clock seed would break.
static var _variant: int = 0


static func _next_variant() -> int:
	_variant += 1
	return _variant


static func reset_variants() -> void:
	_variant = 0


## Drops the shared material cache. The game never needs this — the materials
## are meant to live for the session — but tests clear it so nothing outlives
## the run.
static func reset_materials() -> void:
	_materials.clear()


## Shared PBR material. Cached by name so a whole street of houses is one
## material and a handful of draw calls.
static func material(name: StringName, colour: Color, roughness: float = 0.85,
		metallic: float = 0.0) -> StandardMaterial3D:
	if _materials.has(name):
		return _materials[name]
	var m := StandardMaterial3D.new()
	m.albedo_color = colour
	m.roughness = clampf(roughness, 0.55, 1.0)
	m.metallic = metallic * 0.3
	m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_LAMBERT
	_materials[name] = m
	return m


## A building surface. Deliberately a flat tint rather than a photo texture:
## the art direction is poster-flat cartoon, and photoscanned brick made the
## town look like a grey field survey. `slot` and `uv_scale` are kept so the
## PBR path in `MaterialLibrary` can be switched back on from this one place.
static func clad(slot: StringName, tint: Color, _uv_scale: float = 3.0) -> Material:
	return material(StringName("clad_%s_%s" % [slot, tint.to_html(false)]), tint, 0.95)


## Opaque, flat window panes. Transparent glass on a cartoon building reads as
## a hole, and costs a transparency pass per window besides.
static func glass_material() -> StandardMaterial3D:
	return material(&"glass", Palette.WINDOW, 0.7)


static func _box(size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = mat
	return mi


static func _cylinder(radius: float, height: float, pos: Vector3, mat: Material,
		sides: int = 12) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = sides
	mesh.rings = 1
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = mat
	return mi


static func _cone(radius: float, height: float, pos: Vector3, mat: Material,
		sides: int = 10) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.0
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = sides
	mesh.rings = 1
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = mat
	return mi


static func _sphere(radius: float, pos: Vector3, mat: Material, rings: int = 6,
		segments: int = 10) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = segments
	mesh.rings = rings
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = mat
	return mi


## Pitched roof: a prism laid along X so the ridge runs across the building.
static func _roof(size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mesh := PrismMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.material_override = mat
	return mi


static func build(name: StringName) -> Node3D:
	var text := String(name)
	if text.begins_with("house"):
		return _house(name)
	if text.begins_with("shop"):
		return _shop(name)
	if text.begins_with("block"):
		return _apartment(name)
	if text.begins_with("warehouse"):
		return _warehouse(name)
	if text.begins_with("beach_hut"):
		return _beach_hut(name)
	match name:
		&"tree": return _tree()
		&"tree_small": return _tree(0.7)
		&"palm": return _palm()
		&"bush": return _bush()
		&"flowers": return _flowers()
		&"rock": return _rock()
		&"lamp": return _street_lamp()
		&"bench": return _bench()
		&"bin": return _bin()
		&"sign": return _sign()
		&"fountain": return _fountain()
		&"planter": return _planter()
		&"recycling_station": return _recycling_station()
		&"parasol": return _parasol()
		&"deckchair": return _deckchair()
		&"container": return _container()
		&"crane": return _crane()
		&"boat": return _boat()
		&"bollard": return _bollard()
		&"fence": return _fence()
		&"car": return _car()
		&"van": return _van()
		&"truck": return _truck()
		&"bin_lorry": return _bin_lorry()
		&"scooter": return _scooter()
		&"bicycle": return _bicycle()
		&"pedestrian": return _pedestrian()
		&"dog": return _dog()
	var trash := _trash(name)
	if trash != null:
		return trash
	# Unknown name: a visibly wrong magenta marker rather than a silent nothing.
	var unknown := Node3D.new()
	unknown.name = "Unknown_%s" % name
	unknown.add_child(_box(Vector3(0.6, 0.6, 0.6), Vector3(0, 0.3, 0),
			material(&"unknown", Color(1.0, 0.0, 0.8), 0.6)))
	return unknown


# --- buildings -------------------------------------------------------------

static func _palette(name: StringName, options: Array) -> Color:
	var h := absi(String(name).hash())
	return options[h % options.size()]


## Record the footprint of a building's walls, ignoring awnings and roof
## overhangs.
##
## The city sets buildings back from the kerb by this, not by their bounding
## box: a shop's awning reaches almost a metre and a half past its wall, and
## setting the wall back that far as well left the blocks too shallow to build
## on from both sides.
static func set_footprint(node: Node3D, width: float, depth: float) -> void:
	node.set_meta(&"footprint", Vector2(width, depth))


static func _house(name: StringName) -> Node3D:
	var root := Node3D.new()
	root.name = "House"
	var wall_colour := Palette.wall(name)
	var roof_colour := Palette.roof(name)
	# Alternate brick and rendered walls so a street is not all one material.
	var wall_slot := MaterialLibrary.BRICK if absi(String(name).hash()) % 2 == 0 \
			else MaterialLibrary.PLASTER
	var wall := clad(wall_slot, wall_colour, 3.2)
	var roof := clad(MaterialLibrary.ROOF, roof_colour, 4.5)
	var trim := material(&"trim", Palette.TRIM, 0.9)
	var door_mat := clad(MaterialLibrary.WOOD, Color(0.62, 0.40, 0.26), 1.6)

	# Narrow enough that two fit side by side along one block frontage, which
	# is what turns the suburb into a row of houses instead of one per street.
	var w := 5.8
	var d := 5.4
	var h := 3.4
	set_footprint(root, w, d)
	root.add_child(_box(Vector3(w, h, d), Vector3(0, h * 0.5, 0), wall))
	root.add_child(_roof(Vector3(w + 0.5, 2.0, d + 0.5), Vector3(0, h + 1.0, 0), roof))
	# Door and a step.
	root.add_child(_box(Vector3(1.0, 2.0, 0.14), Vector3(0, 1.0, d * 0.5 + 0.02), door_mat))
	root.add_child(_box(Vector3(1.4, 0.16, 0.6), Vector3(0, 0.08, d * 0.5 + 0.3), trim))
	# Windows on the front and both sides.
	var glass := glass_material()
	for x: float in [-1.7, 1.7]:
		root.add_child(_box(Vector3(1.0, 1.1, 0.1), Vector3(x, 2.1, d * 0.5 + 0.02), glass))
		root.add_child(_box(Vector3(1.2, 1.3, 0.06), Vector3(x, 2.1, d * 0.5 - 0.01), trim))
	for side: float in [-1.0, 1.0]:
		root.add_child(_box(Vector3(0.1, 1.0, 1.2), Vector3(side * w * 0.5, 2.0, 0), glass))
	# Chimney.
	root.add_child(_box(Vector3(0.6, 1.2, 0.6), Vector3(w * 0.28, h + 1.6, -d * 0.2), roof))
	return root


static func _shop(name: StringName) -> Node3D:
	var root := Node3D.new()
	root.name = "Shop"
	var wall_colour := Palette.wall(name)
	var wall := clad(MaterialLibrary.PLASTER, wall_colour, 3.6)
	var awning_colour: Color = _palette(StringName(String(name) + "a"), [
		Color(0.85, 0.25, 0.22), Color(0.20, 0.45, 0.72), Color(0.95, 0.72, 0.20)])
	var awning := material(StringName("awning_%s" % awning_colour.to_html(false)), awning_colour, 0.7)
	var glass := glass_material()
	var trim := material(&"shoptrim", Palette.TRIM, 0.9)

	var w := 8.0
	var d := 6.2
	var h := 5.6
	set_footprint(root, w, d)
	root.add_child(_box(Vector3(w, h, d), Vector3(0, h * 0.5, 0), wall))
	# Flat roof, in a dark roof colour so the silhouette reads from above.
	root.add_child(_box(Vector3(w + 0.4, 0.5, d + 0.4), Vector3(0, h + 0.25, 0),
			clad(&"roof", Palette.roof(name))))
	# Full-width shopfront glazing at street level.
	root.add_child(_box(Vector3(w - 1.2, 2.6, 0.12), Vector3(0, 1.6, d * 0.5 + 0.02), glass))
	# Awning over the front.
	var a := _box(Vector3(w - 0.6, 0.12, 1.6), Vector3(0, 3.3, d * 0.5 + 0.7), awning)
	a.rotation.x = deg_to_rad(-12.0)
	root.add_child(a)
	# Upper-floor windows.
	for y: float in [4.4, 5.9]:
		for x: float in [-2.4, 0.0, 2.4]:
			root.add_child(_box(Vector3(1.2, 1.0, 0.1), Vector3(x, y, d * 0.5 + 0.02), glass))
	return root


static func _apartment(name: StringName) -> Node3D:
	var root := Node3D.new()
	root.name = "Block"
	var wall_colour := Palette.wall(name)
	var wall := clad(MaterialLibrary.CONCRETE, wall_colour, 3.4)
	var trim := material(&"blocktrim", Palette.TRIM, 0.9)
	var glass := glass_material()
	# Two to three storeys. Taller blocks turned every street into a canyon.
	var floors := 2 + absi(String(name).hash()) % 2
	var w := 7.5
	var d := 6.4
	var fh := 3.0
	var h := fh * float(floors)
	set_footprint(root, w, d)
	root.add_child(_box(Vector3(w, h, d), Vector3(0, h * 0.5, 0), wall))
	root.add_child(_box(Vector3(w + 0.5, 0.5, d + 0.5), Vector3(0, h + 0.25, 0),
			clad(&"roof", Palette.roof(name))))
	for f in range(floors):
		var y := 1.4 + fh * float(f)
		for x: float in [-2.3, 0.0, 2.3]:
			root.add_child(_box(Vector3(1.3, 1.2, 0.1), Vector3(x, y, d * 0.5 + 0.02), glass))
			root.add_child(_box(Vector3(1.5, 1.4, 0.05), Vector3(x, y, d * 0.5 - 0.01), trim))
		# Balcony slab on the upper floors.
		if f > 0:
			root.add_child(_box(Vector3(w - 1.0, 0.12, 1.1), Vector3(0, y - 0.7, d * 0.5 + 0.5), trim))
	root.add_child(_box(Vector3(1.4, 2.4, 0.14), Vector3(0, 1.2, d * 0.5 + 0.03),
			material(&"blockdoor", Color(0.30, 0.34, 0.38), 0.5)))
	return root


static func _warehouse(name: StringName) -> Node3D:
	var root := Node3D.new()
	root.name = "Warehouse"
	var wall_colour := Palette.wall(name)
	var wall := clad(MaterialLibrary.CONCRETE, wall_colour, 4.0)
	var roof := clad(MaterialLibrary.METAL, Color(0.62, 0.64, 0.68), 3.0)
	var door := clad(MaterialLibrary.METAL, Color(0.45, 0.50, 0.56), 2.0)
	var w := 11.0
	var d := 8.0
	var h := 5.0
	set_footprint(root, w, d)
	root.add_child(_box(Vector3(w, h, d), Vector3(0, h * 0.5, 0), wall))
	root.add_child(_roof(Vector3(w + 0.4, 1.4, d + 0.4), Vector3(0, h + 0.7, 0), roof))
	# Roller shutter.
	root.add_child(_box(Vector3(4.0, 3.6, 0.16), Vector3(0, 1.8, d * 0.5 + 0.02), door))
	# Ribbed cladding.
	for i in range(6):
		var x := -w * 0.5 + 1.0 + float(i) * 1.8
		root.add_child(_box(Vector3(0.12, h, 0.1), Vector3(x, h * 0.5, -d * 0.5 - 0.02), roof))
	return root


static func _beach_hut(name: StringName) -> Node3D:
	var root := Node3D.new()
	root.name = "BeachHut"
	var colour := Palette.wall(name)
	var wall := clad(MaterialLibrary.WOOD, colour, 2.2)
	var roof := clad(MaterialLibrary.WOOD, Color(0.93, 0.93, 0.90), 2.4)
	set_footprint(root, 2.6, 2.4)
	root.add_child(_box(Vector3(2.6, 2.4, 2.4), Vector3(0, 1.2, 0), wall))
	root.add_child(_roof(Vector3(3.0, 0.9, 2.8), Vector3(0, 2.75, 0), roof))
	root.add_child(_box(Vector3(1.0, 1.7, 0.1), Vector3(0, 0.85, 1.22),
			material(&"hutdoor", Color(0.35, 0.30, 0.26), 0.7)))
	return root


# --- nature ----------------------------------------------------------------

static func _tree(scale: float = 1.0) -> Node3D:
	var root := Node3D.new()
	root.name = "Tree"
	var bark := material(&"bark", Palette.BARK, 0.95)
	var leaf := material(&"leaf", Palette.LEAF, 0.95)
	root.add_child(_cylinder(0.22 * scale, 2.4 * scale, Vector3(0, 1.2 * scale, 0), bark, 8))
	# Three offset canopy lobes so it does not read as a single ball on a stick.
	root.add_child(_sphere(1.35 * scale, Vector3(0, 3.2 * scale, 0), leaf))
	root.add_child(_sphere(0.95 * scale, Vector3(0.75 * scale, 2.7 * scale, 0.35 * scale), leaf))
	root.add_child(_sphere(0.85 * scale, Vector3(-0.6 * scale, 2.9 * scale, -0.45 * scale), leaf))
	return root


static func _palm() -> Node3D:
	var root := Node3D.new()
	root.name = "Palm"
	var bark := material(&"palmbark", Palette.BARK, 0.95)
	var leaf := material(&"palmleaf", Palette.LEAF, 0.95)
	var leaf_dark := material(&"palmleafdark", Palette.LEAF_DARK, 0.95)

	# Trunk: short stacked segments leaning a little further with every one, so
	# it curves instead of tapering like a pipe.
	var segments := 7
	var height := 0.0
	var lean := 0.0
	var offset := 0.0
	for i in range(segments):
		var t := float(i) / float(segments - 1)
		var seg_height := 0.62
		var seg := _cylinder(0.19 - 0.06 * t, seg_height + 0.04,
				Vector3(offset, height + seg_height * 0.5, 0.0), bark, 8)
		seg.rotation.z = deg_to_rad(-lean)
		root.add_child(seg)
		height += seg_height
		lean += 1.8
		offset += t * 0.09

	var crown := Vector3(offset, height + 0.1, 0.0)
	root.add_child(_sphere(0.2, crown, bark, 5, 8))

	# Fronds: each is a run of shrinking blades that droops as it goes out, so
	# it reads as a frond rather than a plank.
	var fronds := 9
	for i in range(fronds):
		var a := TAU * float(i) / float(fronds) + 0.35
		var pivot := Node3D.new()
		pivot.position = crown
		pivot.rotation.y = a
		root.add_child(pivot)

		var blades := 5
		var reach := 0.0
		var droop := 8.0
		for b in range(blades):
			var k := float(b) / float(blades - 1)
			var length := 0.46 - 0.07 * k
			reach += length * 0.94
			var blade := _box(Vector3(length, 0.018, 0.17 - 0.09 * k),
					Vector3(reach, -reach * reach * 0.16, 0.0),
					leaf if i % 2 == 0 else leaf_dark)
			blade.rotation.z = deg_to_rad(-droop)
			pivot.add_child(blade)
			droop += 7.0
	return root


static func _bush() -> Node3D:
	var root := Node3D.new()
	root.name = "Bush"
	var leaf := material(&"bushleaf", Palette.LEAF_DARK, 0.95)
	root.add_child(_sphere(0.62, Vector3(0, 0.5, 0), leaf, 5, 8))
	root.add_child(_sphere(0.46, Vector3(0.48, 0.38, 0.2), leaf, 5, 8))
	root.add_child(_sphere(0.42, Vector3(-0.42, 0.34, -0.22), leaf, 5, 8))
	return root


static func _flowers() -> Node3D:
	var root := Node3D.new()
	root.name = "Flowers"
	var stem := material(&"stem", Color(0.28, 0.50, 0.24), 0.9)
	var petals := [
		material(&"petal_r", Color(0.90, 0.30, 0.35), 0.75),
		material(&"petal_y", Color(0.96, 0.82, 0.28), 0.75),
		material(&"petal_p", Color(0.72, 0.45, 0.85), 0.75),
	]
	for i in range(7):
		var a := TAU * float(i) / 7.0 + 0.4
		var r := 0.22 + 0.16 * float(i % 3)
		var base := Vector3(cos(a) * r, 0, sin(a) * r)
		root.add_child(_cylinder(0.02, 0.34, base + Vector3(0, 0.17, 0), stem, 5))
		root.add_child(_sphere(0.075, base + Vector3(0, 0.37, 0), petals[i % 3], 4, 6))
	return root


static func _rock() -> Node3D:
	var root := Node3D.new()
	root.name = "Rock"
	var stone := material(&"stone", Palette.ROCK, 0.95)
	var a := _sphere(0.55, Vector3(0, 0.3, 0), stone, 4, 7)
	a.scale = Vector3(1.3, 0.75, 1.0)
	root.add_child(a)
	var b := _sphere(0.32, Vector3(0.45, 0.16, 0.2), stone, 4, 6)
	b.scale = Vector3(1.1, 0.8, 1.2)
	root.add_child(b)
	return root


# --- street furniture ------------------------------------------------------

static func _street_lamp() -> Node3D:
	var root := Node3D.new()
	root.name = "Lamp"
	var metal := material(&"lampmetal", Color(0.24, 0.26, 0.28), 0.5, 0.7)
	root.add_child(_cylinder(0.10, 4.6, Vector3(0, 2.3, 0), metal, 8))
	var arm := _cylinder(0.07, 1.1, Vector3(0.45, 4.6, 0), metal, 6)
	arm.rotation.z = deg_to_rad(72.0)
	root.add_child(arm)
	var head := _box(Vector3(0.5, 0.16, 0.3), Vector3(0.92, 4.5, 0),
			material(&"lampglass", Color(1.0, 0.94, 0.72), 0.2))
	root.add_child(head)
	# The light itself; the world dims or kills these by graphics tier.
	var light := OmniLight3D.new()
	light.position = Vector3(0.92, 4.35, 0)
	light.omni_range = 13.0
	light.light_energy = 1.5
	light.light_color = Color(1.0, 0.90, 0.70)
	light.shadow_enabled = false
	light.name = "Light"
	root.add_child(light)
	return root


static func _bench() -> Node3D:
	var root := Node3D.new()
	root.name = "Bench"
	var wood := clad(MaterialLibrary.WOOD, Color(0.72, 0.48, 0.26), 3.0)
	var metal := material(&"benchmetal", Color(0.22, 0.24, 0.24), 0.5, 0.6)
	for i in range(3):
		root.add_child(_box(Vector3(1.8, 0.07, 0.16), Vector3(0, 0.46, -0.22 + float(i) * 0.2), wood))
	for i in range(3):
		var slat := _box(Vector3(1.8, 0.07, 0.16), Vector3(0, 0.72 + float(i) * 0.18, -0.34), wood)
		slat.rotation.x = deg_to_rad(-16.0)
		root.add_child(slat)
	for x: float in [-0.78, 0.78]:
		root.add_child(_box(Vector3(0.09, 0.46, 0.5), Vector3(x, 0.23, -0.05), metal))
	return root


static func _bin() -> Node3D:
	var root := Node3D.new()
	root.name = "Bin"
	var metal := material(&"binmetal", Color(0.26, 0.30, 0.30), 0.55, 0.5)
	root.add_child(_cylinder(0.30, 0.86, Vector3(0, 0.43, 0), metal, 10))
	root.add_child(_cylinder(0.33, 0.07, Vector3(0, 0.90, 0), material(&"binlid",
			Color(0.18, 0.22, 0.22), 0.5, 0.4), 10))
	return root


static func _sign() -> Node3D:
	var root := Node3D.new()
	root.name = "Sign"
	var pole := material(&"signpole", Color(0.55, 0.56, 0.58), 0.4, 0.8)
	root.add_child(_cylinder(0.05, 2.4, Vector3(0, 1.2, 0), pole, 6))
	var face := _cylinder(0.32, 0.06, Vector3(0, 2.3, 0.04),
			material(&"signface", Color(0.88, 0.20, 0.18), 0.4), 10)
	face.rotation.x = deg_to_rad(90.0)
	root.add_child(face)
	return root


static func _fountain() -> Node3D:
	var root := Node3D.new()
	root.name = "Fountain"
	var stone := material(&"fountainstone", Color(0.78, 0.76, 0.70), 0.85)
	var water := material(&"fountainwater", Color(0.35, 0.62, 0.78, 0.8), 0.1)
	water.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	root.add_child(_cylinder(2.4, 0.5, Vector3(0, 0.25, 0), stone, 18))
	root.add_child(_cylinder(2.15, 0.12, Vector3(0, 0.46, 0), water, 18))
	root.add_child(_cylinder(0.32, 1.5, Vector3(0, 0.9, 0), stone, 10))
	root.add_child(_cylinder(0.9, 0.16, Vector3(0, 1.62, 0), stone, 12))
	return root


static func _planter() -> Node3D:
	var root := Node3D.new()
	root.name = "Planter"
	root.add_child(_box(Vector3(1.5, 0.55, 0.7), Vector3(0, 0.27, 0),
			material(&"planterbox", Color(0.66, 0.50, 0.38), 0.9)))
	root.add_child(_box(Vector3(1.35, 0.1, 0.56), Vector3(0, 0.56, 0),
			material(&"soil", Color(0.25, 0.19, 0.14), 1.0)))
	var flowers := _flowers()
	flowers.position = Vector3(0, 0.6, 0)
	flowers.scale = Vector3(1.4, 1.0, 0.7)
	root.add_child(flowers)
	return root


static func _fence() -> Node3D:
	var root := Node3D.new()
	root.name = "Fence"
	var wood := clad(MaterialLibrary.WOOD, Color(0.92, 0.86, 0.74), 3.0)
	for i in range(6):
		root.add_child(_box(Vector3(0.09, 0.95, 0.09), Vector3(-1.25 + float(i) * 0.5, 0.48, 0), wood))
	for y: float in [0.35, 0.78]:
		root.add_child(_box(Vector3(2.7, 0.08, 0.05), Vector3(0, y, 0), wood))
	return root


static func _bollard() -> Node3D:
	var root := Node3D.new()
	root.name = "Bollard"
	root.add_child(_cylinder(0.14, 0.75, Vector3(0, 0.37, 0),
			material(&"bollard", Color(0.30, 0.32, 0.34), 0.6, 0.4), 8))
	root.add_child(_sphere(0.15, Vector3(0, 0.76, 0),
			material(&"bollardtop", Color(0.85, 0.72, 0.25), 0.5, 0.3), 4, 8))
	return root


# --- harbour and beach -----------------------------------------------------

static func _container() -> Node3D:
	var root := Node3D.new()
	root.name = "Container"
	var colours := [Color(0.75, 0.32, 0.25), Color(0.25, 0.45, 0.62),
			Color(0.82, 0.68, 0.25), Color(0.35, 0.55, 0.40)]
	var c: Color = colours[_next_variant() % colours.size()]
	var shell := clad(MaterialLibrary.METAL, c, 2.6)
	root.add_child(_box(Vector3(6.0, 2.6, 2.4), Vector3(0, 1.3, 0), shell))
	# Corrugation.
	for i in range(11):
		root.add_child(_box(Vector3(0.09, 2.5, 0.08), Vector3(-2.7 + float(i) * 0.54, 1.3, 1.22), shell))
	return root


static func _crane() -> Node3D:
	var root := Node3D.new()
	root.name = "Crane"
	var steel := material(&"cranesteel", Color(0.86, 0.56, 0.16), 0.6, 0.6)
	root.add_child(_box(Vector3(2.4, 0.5, 2.4), Vector3(0, 0.25, 0), steel))
	for x: float in [-0.9, 0.9]:
		for z: float in [-0.9, 0.9]:
			root.add_child(_cylinder(0.12, 8.0, Vector3(x, 4.2, z), steel, 6))
	root.add_child(_box(Vector3(2.6, 0.6, 2.6), Vector3(0, 8.4, 0), steel))
	root.add_child(_box(Vector3(9.0, 0.4, 0.5), Vector3(3.2, 8.9, 0), steel))
	root.add_child(_cylinder(0.04, 3.4, Vector3(7.0, 7.2, 0),
			material(&"cranecable", Color(0.2, 0.2, 0.2), 0.7, 0.5), 5))
	root.add_child(_box(Vector3(0.9, 0.5, 0.9), Vector3(7.0, 5.4, 0), steel))
	return root


static func _boat() -> Node3D:
	var root := Node3D.new()
	root.name = "Boat"
	var hull := material(&"hull", Color(0.88, 0.88, 0.86), 0.55)
	var deck := clad(MaterialLibrary.WOOD, Color(0.78, 0.58, 0.36), 2.6)
	var body := _sphere(1.0, Vector3(0, 0.45, 0), hull, 5, 10)
	body.scale = Vector3(1.35, 0.5, 3.4)
	root.add_child(body)
	root.add_child(_box(Vector3(2.0, 0.1, 5.2), Vector3(0, 0.72, 0), deck))
	root.add_child(_box(Vector3(1.4, 1.0, 1.6), Vector3(0, 1.25, -0.9), hull))
	root.add_child(_box(Vector3(1.2, 0.5, 0.1), Vector3(0, 1.45, -0.12), glass_material()))
	root.add_child(_cylinder(0.05, 2.6, Vector3(0, 2.3, -0.9),
			material(&"mast", Color(0.7, 0.7, 0.72), 0.4, 0.7), 6))
	return root


static func _parasol() -> Node3D:
	var root := Node3D.new()
	root.name = "Parasol"
	root.add_child(_cylinder(0.04, 2.2, Vector3(0, 1.1, 0),
			material(&"parasolpole", Color(0.75, 0.72, 0.68), 0.5, 0.3), 6))
	var canopy := _cone(1.5, 0.55, Vector3(0, 2.3, 0),
			material(&"parasolcanopy", Color(0.95, 0.45, 0.35), 0.8), 12)
	root.add_child(canopy)
	return root


static func _deckchair() -> Node3D:
	var root := Node3D.new()
	root.name = "Deckchair"
	var frame := material(&"chairframe", Color(0.72, 0.60, 0.42), 0.85)
	var cloth := material(&"chaircloth", Color(0.30, 0.60, 0.78), 0.9)
	var seat := _box(Vector3(0.62, 0.06, 1.15), Vector3(0, 0.34, 0), cloth)
	seat.rotation.x = deg_to_rad(-14.0)
	root.add_child(seat)
	for x: float in [-0.3, 0.3]:
		root.add_child(_box(Vector3(0.05, 0.05, 1.2), Vector3(x, 0.36, 0), frame))
		root.add_child(_box(Vector3(0.05, 0.42, 0.05), Vector3(x, 0.21, 0.5), frame))
		root.add_child(_box(Vector3(0.05, 0.42, 0.05), Vector3(x, 0.21, -0.45), frame))
	return root


# --- vehicles --------------------------------------------------------------

## Wheels are parented to named nodes so `Vehicle` can spin them and steer the
## front pair. Names are part of the contract with that script.
static func _wheel(radius: float, width: float) -> Node3D:
	var hub := Node3D.new()
	var tyre := _cylinder(radius, width, Vector3.ZERO,
			material(&"tyre", Color(0.10, 0.10, 0.11), 0.95), 12)
	tyre.rotation.z = deg_to_rad(90.0)
	hub.add_child(tyre)
	var rim := _cylinder(radius * 0.55, width + 0.02, Vector3.ZERO,
			material(&"rim", Color(0.78, 0.79, 0.82), 0.25, 0.9), 10)
	rim.rotation.z = deg_to_rad(90.0)
	hub.add_child(rim)
	# Spokes, so a spinning wheel actually reads as spinning.
	for i in range(4):
		var spoke := _box(Vector3(radius * 0.9, width + 0.03, 0.045), Vector3.ZERO,
				material(&"rim", Color(0.78, 0.79, 0.82), 0.25, 0.9))
		spoke.rotation.x = TAU * float(i) / 8.0
		hub.add_child(spoke)
	return hub


static func _add_wheels(root: Node3D, half_track: float, front_z: float, rear_z: float,
		radius: float, width: float, y: float) -> void:
	for spec: Array in [["FrontLeft", -half_track, front_z], ["FrontRight", half_track, front_z]]:
		var steer := Node3D.new()
		steer.name = spec[0]
		steer.position = Vector3(spec[1], y, spec[2])
		var spin := _wheel(radius, width)
		spin.name = "Spin"
		steer.add_child(spin)
		root.add_child(steer)
	for spec: Array in [["RearLeft", -half_track, rear_z], ["RearRight", half_track, rear_z]]:
		var hub := Node3D.new()
		hub.name = spec[0]
		hub.position = Vector3(spec[1], y, spec[2])
		var spin := _wheel(radius, width)
		spin.name = "Spin"
		hub.add_child(spin)
		root.add_child(hub)


static func _brake_light(pos: Vector3) -> MeshInstance3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.55, 0.06, 0.05)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.12, 0.06)
	mat.emission_energy_multiplier = 0.0
	var light := _box(Vector3(0.26, 0.12, 0.08), pos, mat)
	light.name = "BrakeLight"
	return light


## A toy car: short, tall and round-roofed, on wheels a size too big.
##
## Scale-model proportions read as a grey wedge from the chase camera. Pulling
## the length in, raising the cabin and rounding the roof is what makes it a
## toy rather than a saloon, and it matches the rest of the island.
static func _car() -> Node3D:
	var root := Node3D.new()
	root.name = "Car"
	var colours := [Color(0.95, 0.28, 0.26), Color(0.22, 0.52, 0.92), Color(1.0, 0.82, 0.24),
			Color(0.97, 0.97, 0.95), Color(0.26, 0.76, 0.56), Color(0.78, 0.46, 0.90),
			Color(1.0, 0.58, 0.26), Color(0.30, 0.78, 0.82)]
	var c: Color = colours[_next_variant() % colours.size()]
	var paint := material(StringName("paint_%s" % c.to_html(false)), c, 0.28, 0.35)
	var trim := material(&"cartrim", Color(0.16, 0.16, 0.19), 0.6, 0.3)
	var glass := glass_material()

	# Body, with the corners knocked off by a squashed sphere over the top.
	root.add_child(_box(Vector3(1.86, 0.74, 3.60), Vector3(0, 0.70, 0), paint))
	var nose := _sphere(0.93, Vector3(0, 0.72, 1.46), paint, 6, 12)
	nose.scale = Vector3(1.0, 0.80, 0.42)
	root.add_child(nose)
	var tail := _sphere(0.93, Vector3(0, 0.72, -1.46), paint, 6, 12)
	tail.scale = Vector3(1.0, 0.80, 0.42)
	root.add_child(tail)

	# Cabin: a dome rather than a second box.
	var cabin := _sphere(0.86, Vector3(0, 1.12, -0.20), paint, 8, 14)
	cabin.scale = Vector3(0.92, 0.62, 1.20)
	root.add_child(cabin)
	# Glazing wrapped round the cabin.
	root.add_child(_box(Vector3(1.40, 0.44, 0.08), Vector3(0, 1.22, 0.80), glass))
	root.add_child(_box(Vector3(1.40, 0.44, 0.08), Vector3(0, 1.22, -1.16), glass))
	for x: float in [-0.76, 0.76]:
		root.add_child(_box(Vector3(0.06, 0.40, 1.72), Vector3(x, 1.22, -0.18), glass))

	# Bumpers and lights.
	root.add_child(_box(Vector3(1.80, 0.20, 0.18), Vector3(0, 0.44, 1.76), trim))
	root.add_child(_box(Vector3(1.80, 0.20, 0.18), Vector3(0, 0.44, -1.76), trim))
	for x: float in [-0.60, 0.60]:
		root.add_child(_sphere(0.15, Vector3(x, 0.80, 1.72),
				material(&"headlight", Color(0.99, 0.97, 0.88), 0.15), 5, 8))
		root.add_child(_brake_light(Vector3(x, 0.80, -1.76)))
	_add_wheels(root, 0.88, 1.16, -1.16, 0.42, 0.26, 0.42)
	return root


static func _van() -> Node3D:
	var root := Node3D.new()
	root.name = "Van"
	var paint := material(&"vanpaint", Color(0.92, 0.92, 0.90), 0.35, 0.2)
	var trim := material(&"cartrim", Color(0.15, 0.15, 0.17), 0.6, 0.3)
	var glass := glass_material()
	root.add_child(_box(Vector3(1.95, 1.9, 4.6), Vector3(0, 1.25, -0.5), paint))
	root.add_child(_box(Vector3(1.9, 0.95, 1.5), Vector3(0, 1.0, 1.95), paint))
	root.add_child(_box(Vector3(1.75, 0.62, 0.08), Vector3(0, 1.42, 2.62), glass))
	for x: float in [-0.9, 0.9]:
		root.add_child(_box(Vector3(0.06, 0.5, 1.0), Vector3(x, 1.4, 2.1), glass))
	root.add_child(_box(Vector3(1.98, 0.18, 0.16), Vector3(0, 0.5, 2.68), trim))
	for x: float in [-0.7, 0.7]:
		root.add_child(_brake_light(Vector3(x, 1.0, -2.82)))
	_add_wheels(root, 0.92, 1.72, -1.7, 0.38, 0.26, 0.38)
	return root


static func _truck() -> Node3D:
	var root := Node3D.new()
	root.name = "Truck"
	var cab := material(&"truckcab", Color(0.24, 0.50, 0.70), 0.35, 0.3)
	var body := material(&"truckbody", Color(0.80, 0.80, 0.78), 0.7)
	var trim := material(&"cartrim", Color(0.15, 0.15, 0.17), 0.6, 0.3)
	root.add_child(_box(Vector3(2.2, 2.1, 1.9), Vector3(0, 1.5, 2.1), cab))
	root.add_child(_box(Vector3(2.0, 0.8, 0.1), Vector3(0, 2.1, 3.0), glass_material()))
	root.add_child(_box(Vector3(2.3, 2.4, 4.6), Vector3(0, 1.85, -1.4), body))
	root.add_child(_box(Vector3(2.35, 0.2, 0.2), Vector3(0, 0.55, 3.06), trim))
	for x: float in [-0.85, 0.85]:
		root.add_child(_brake_light(Vector3(x, 1.0, -3.72)))
	_add_wheels(root, 1.02, 2.05, -1.9, 0.46, 0.30, 0.46)
	return root


static func _bin_lorry() -> Node3D:
	var root := Node3D.new()
	root.name = "BinLorry"
	var cab := material(&"lorrycab", Color(0.25, 0.55, 0.32), 0.35, 0.3)
	var body := material(&"lorrybody", Color(0.30, 0.62, 0.36), 0.7, 0.2)
	var trim := material(&"cartrim", Color(0.15, 0.15, 0.17), 0.6, 0.3)
	root.add_child(_box(Vector3(2.2, 2.0, 1.8), Vector3(0, 1.45, 2.3), cab))
	root.add_child(_box(Vector3(2.0, 0.75, 0.1), Vector3(0, 2.0, 3.15), glass_material()))
	root.add_child(_box(Vector3(2.35, 2.5, 5.0), Vector3(0, 1.9, -1.2), body))
	# Hopper at the back, where the sacks fall out of.
	var hopper := _box(Vector3(2.2, 1.5, 1.2), Vector3(0, 1.3, -3.95), body)
	hopper.rotation.x = deg_to_rad(-12.0)
	root.add_child(hopper)
	root.add_child(_box(Vector3(2.4, 0.2, 0.2), Vector3(0, 0.55, 3.2), trim))
	for x: float in [-0.9, 0.9]:
		root.add_child(_brake_light(Vector3(x, 1.0, -4.5)))
	_add_wheels(root, 1.05, 2.25, -2.1, 0.48, 0.32, 0.48)
	return root


static func _scooter() -> Node3D:
	var root := Node3D.new()
	root.name = "Scooter"
	var paint := material(&"scooterpaint", Color(0.90, 0.75, 0.25), 0.3, 0.4)
	var trim := material(&"cartrim", Color(0.15, 0.15, 0.17), 0.6, 0.3)
	root.add_child(_box(Vector3(0.42, 0.34, 1.25), Vector3(0, 0.62, -0.1), paint))
	root.add_child(_box(Vector3(0.38, 0.14, 0.55), Vector3(0, 0.86, -0.42), trim))
	root.add_child(_cylinder(0.04, 0.9, Vector3(0, 0.95, 0.5), trim, 6))
	root.add_child(_box(Vector3(0.62, 0.05, 0.06), Vector3(0, 1.36, 0.5), trim))
	root.add_child(_brake_light(Vector3(0, 0.78, -0.76)))
	_add_wheels(root, 0.0, 0.62, -0.62, 0.26, 0.12, 0.26)
	return root


static func _bicycle() -> Node3D:
	var root := Node3D.new()
	root.name = "Bicycle"
	var frame := material(&"bikeframe", Color(0.25, 0.60, 0.70), 0.35, 0.5)
	root.add_child(_box(Vector3(0.06, 0.06, 1.0), Vector3(0, 0.66, 0), frame))
	var down := _box(Vector3(0.05, 0.62, 0.05), Vector3(0, 0.52, -0.2), frame)
	down.rotation.x = deg_to_rad(22.0)
	root.add_child(down)
	root.add_child(_box(Vector3(0.22, 0.06, 0.1), Vector3(0, 0.95, -0.42), frame))
	root.add_child(_cylinder(0.03, 0.8, Vector3(0, 0.88, 0.48), frame, 6))
	root.add_child(_box(Vector3(0.5, 0.04, 0.05), Vector3(0, 1.22, 0.48), frame))
	var reflector := _box(Vector3(0.09, 0.05, 0.02), Vector3(0, 0.72, -0.6),
			material(&"reflector", Color(0.85, 0.15, 0.12), 0.3))
	reflector.name = "Reflector"
	root.add_child(reflector)
	_add_wheels(root, 0.0, 0.56, -0.56, 0.34, 0.06, 0.34)
	return root


# --- characters ------------------------------------------------------------

## Articulated figure with named joints. `Pedestrian` drives the limbs through
## a walk cycle, so this is a posable body rather than a static silhouette.
## It is still stand-in geometry: a rigged, skinned character is the intended
## replacement and drops straight in as `assets/models/pedestrian.glb`.
## A townsperson, built chibi rather than to scale.
##
## Real proportions made a crowd of grey matchsticks at the distance the chase
## camera sits at. Big head, short stubby limbs and a strong shirt colour is
## what makes a person readable from ten metres up a street - and it is the
## look the rest of the island is drawn in.
##
## The rig keeps the node names the pedestrian AI animates: Hips, Torso, Head,
## ArmLeft, ArmRight, LegLeft, LegRight and HandSocket.
static func _pedestrian() -> Node3D:
	var root := Node3D.new()
	root.name = "Pedestrian"
	var skins := [Color(0.98, 0.80, 0.66), Color(0.86, 0.64, 0.48),
			Color(0.64, 0.44, 0.31), Color(0.42, 0.29, 0.21), Color(1.0, 0.87, 0.76)]
	var shirts := [Color(0.94, 0.34, 0.32), Color(0.24, 0.52, 0.88), Color(1.0, 0.82, 0.26),
			Color(0.32, 0.74, 0.48), Color(0.76, 0.46, 0.90), Color(0.99, 0.99, 0.96),
			Color(1.0, 0.56, 0.28), Color(0.26, 0.80, 0.78)]
	var trousers := [Color(0.28, 0.34, 0.52), Color(0.52, 0.42, 0.32), Color(0.20, 0.22, 0.28),
			Color(0.66, 0.60, 0.54)]
	var hairs := [Color(0.14, 0.11, 0.09), Color(0.52, 0.34, 0.16), Color(0.72, 0.66, 0.58),
			Color(0.80, 0.42, 0.20)]
	var t := _next_variant()
	var skin := material(StringName("skin%d" % (t % skins.size())), skins[t % skins.size()], 0.85)
	var shirt := material(StringName("shirt%d" % (t % shirts.size())), shirts[t % shirts.size()], 0.9)
	var trouser := material(StringName("trouser%d" % (t % trousers.size())),
			trousers[t % trousers.size()], 0.9)
	var hair := material(StringName("hair%d" % (t % hairs.size())), hairs[t % hairs.size()], 0.95)
	var shoe := material(&"shoe", Color(0.18, 0.16, 0.15), 0.8)
	var eye := material(&"pedeye", Color(0.09, 0.09, 0.12), 0.3)

	# Built at about two thirds life size, then scaled to it. Working in these
	# numbers keeps the chibi proportions readable while the finished figure
	# still stands as tall as a person beside a car or a doorway.
	# A little variety in build so a crowd is not one silhouette repeated.
	root.scale = Vector3.ONE * 1.66 * (0.95 + 0.12 * float(t % 5) / 4.0)

	var hips := Node3D.new()
	hips.name = "Hips"
	hips.position = Vector3(0, 0.42, 0)
	root.add_child(hips)

	var torso := Node3D.new()
	torso.name = "Torso"
	hips.add_child(torso)
	# A rounded body: a short barrel with a sphere capping each end.
	torso.add_child(_cylinder(0.18, 0.30, Vector3(0, 0.17, 0), shirt, 10))
	torso.add_child(_sphere(0.18, Vector3(0, 0.32, 0), shirt, 6, 10))
	torso.add_child(_sphere(0.175, Vector3(0, 0.03, 0), trouser, 5, 10))

	var head := Node3D.new()
	head.name = "Head"
	head.position = Vector3(0, 0.44, 0)
	torso.add_child(head)
	# Head is deliberately oversized; that is most of what reads as cartoon.
	head.add_child(_sphere(0.23, Vector3(0, 0.20, 0), skin, 8, 12))
	# Hair as a cap sitting over the crown and down the back.
	var cap := _sphere(0.235, Vector3(0, 0.235, -0.015), hair, 8, 12)
	cap.scale = Vector3(1.0, 0.72, 1.0)
	head.add_child(cap)
	for side: float in [-1.0, 1.0]:
		head.add_child(_sphere(0.036, Vector3(side * 0.085, 0.20, 0.205), eye, 4, 8))

	for side: Array in [["ArmLeft", -1.0], ["ArmRight", 1.0]]:
		var arm := Node3D.new()
		arm.name = side[0]
		arm.position = Vector3(float(side[1]) * 0.185, 0.28, 0)
		torso.add_child(arm)
		arm.add_child(_cylinder(0.055, 0.24, Vector3(0, -0.12, 0), shirt, 8))
		arm.add_child(_sphere(0.068, Vector3(0, -0.25, 0), skin, 5, 8))

	for side: Array in [["LegLeft", -1.0], ["LegRight", 1.0]]:
		var leg := Node3D.new()
		leg.name = side[0]
		leg.position = Vector3(float(side[1]) * 0.085, 0.0, 0)
		hips.add_child(leg)
		leg.add_child(_cylinder(0.062, 0.32, Vector3(0, -0.16, 0), trouser, 8))
		# Big round shoes, which is what stops stubby legs looking cut off.
		var boot := _sphere(0.085, Vector3(0, -0.345, 0.03), shoe, 5, 8)
		boot.scale = Vector3(1.0, 0.72, 1.35)
		leg.add_child(boot)

	# Empty hand socket: whatever the pedestrian is about to drop is parented here.
	var hand := Node3D.new()
	hand.name = "HandSocket"
	hand.position = Vector3(0.20, 0.16, 0.14)
	torso.add_child(hand)
	return root


static func _dog() -> Node3D:
	var root := Node3D.new()
	root.name = "Dog"
	var pick := _next_variant() % 3
	var coat := material(StringName("coat%d" % pick),
			[Color(0.55, 0.42, 0.26), Color(0.20, 0.18, 0.17), Color(0.90, 0.88, 0.84)][pick], 0.9)
	root.add_child(_box(Vector3(0.22, 0.24, 0.58), Vector3(0, 0.38, 0), coat))
	root.add_child(_box(Vector3(0.18, 0.18, 0.2), Vector3(0, 0.5, 0.36), coat))
	root.add_child(_box(Vector3(0.09, 0.08, 0.12), Vector3(0, 0.45, 0.5), coat))
	for x: float in [-0.08, 0.08]:
		for z: float in [-0.2, 0.22]:
			root.add_child(_box(Vector3(0.07, 0.28, 0.07), Vector3(x, 0.14, z), coat))
	var tail := _box(Vector3(0.05, 0.05, 0.24), Vector3(0, 0.46, -0.36), coat)
	tail.rotation.x = deg_to_rad(-35.0)
	root.add_child(tail)
	return root


# --- recycling station -----------------------------------------------------

static func _recycling_station() -> Node3D:
	var root := Node3D.new()
	root.name = "RecyclingStation"
	var shell := material(&"stationshell", Color(0.16, 0.55, 0.30), 0.55, 0.2)
	var panel := material(&"stationpanel", Color(0.92, 0.94, 0.90), 0.7)
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color(0.45, 1.0, 0.55)
	glow.emission_enabled = true
	glow.emission = Color(0.35, 1.0, 0.45)
	glow.emission_energy_multiplier = 2.4

	root.add_child(_cylinder(2.1, 0.22, Vector3(0, 0.11, 0),
			clad(MaterialLibrary.PAVEMENT, Color(0.88, 0.92, 0.88), 3.0), 16))
	root.add_child(_box(Vector3(2.4, 2.2, 1.5), Vector3(0, 1.2, 0), shell))
	# Intake mouth the litter is pulled into.
	root.add_child(_box(Vector3(1.5, 0.9, 0.18), Vector3(0, 1.1, 0.78),
			material(&"stationmouth", Color(0.08, 0.14, 0.10), 0.9)))
	# Sorting bins along the back.
	for i in range(3):
		var c: Color = [Color(0.85, 0.72, 0.20), Color(0.25, 0.45, 0.75), Color(0.30, 0.65, 0.35)][i]
		root.add_child(_cylinder(0.34, 0.95, Vector3(-0.8 + float(i) * 0.8, 0.48, -1.05),
				material(StringName("sortbin%d" % i), c, 0.7), 10))
	# Lit recycling emblem on the roof, visible from across the district.
	var mast := _cylinder(0.09, 1.6, Vector3(0, 3.1, 0), shell, 8)
	root.add_child(mast)
	for i in range(3):
		var a := TAU * float(i) / 3.0
		var arrow := _box(Vector3(0.62, 0.12, 0.2),
				Vector3(cos(a) * 0.5, 4.0, sin(a) * 0.5), glow)
		arrow.rotation.y = -a
		root.add_child(arrow)
	var light := OmniLight3D.new()
	light.position = Vector3(0, 3.4, 0)
	light.omni_range = 16.0
	light.light_energy = 2.2
	light.light_color = Color(0.45, 1.0, 0.55)
	light.shadow_enabled = false
	light.name = "Glow"
	root.add_child(light)
	return root


# --- litter ----------------------------------------------------------------

static func _trash(name: StringName) -> Node3D:
	var root := Node3D.new()
	root.name = "Trash_%s" % name
	match name:
		&"can":
			root.add_child(_cylinder(0.035, 0.12, Vector3(0, 0.06, 0),
					material(&"canmetal", Color(0.80, 0.30, 0.25), 0.25, 0.85), 10))
			root.add_child(_cylinder(0.036, 0.012, Vector3(0, 0.126, 0),
					material(&"canrim", Color(0.85, 0.86, 0.88), 0.2, 0.95), 10))
		&"plastic_bottle":
			var pet := material(&"pet", Color(0.62, 0.82, 0.88, 0.75), 0.1)
			pet.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			root.add_child(_cylinder(0.034, 0.16, Vector3(0, 0.08, 0), pet, 10))
			root.add_child(_cylinder(0.018, 0.05, Vector3(0, 0.185, 0), pet, 8))
			root.add_child(_cylinder(0.021, 0.022, Vector3(0, 0.215, 0),
					material(&"cap", Color(0.25, 0.55, 0.35), 0.4), 8))
		&"glass_bottle":
			var glass := material(&"bottleglass", Color(0.24, 0.42, 0.26, 0.72), 0.06)
			glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			root.add_child(_cylinder(0.036, 0.17, Vector3(0, 0.085, 0), glass, 10))
			root.add_child(_cylinder(0.014, 0.09, Vector3(0, 0.21, 0), glass, 8))
		&"cup":
			var cup := CylinderMesh.new()
			cup.top_radius = 0.042
			cup.bottom_radius = 0.028
			cup.height = 0.105
			cup.radial_segments = 10
			var mi := MeshInstance3D.new()
			mi.mesh = cup
			mi.position = Vector3(0, 0.052, 0)
			mi.material_override = material(&"cuppaper", Color(0.94, 0.92, 0.88), 0.85)
			root.add_child(mi)
			root.add_child(_cylinder(0.044, 0.012, Vector3(0, 0.108, 0),
					material(&"cuplid", Color(0.55, 0.30, 0.18), 0.6), 10))
		&"pizza_box":
			root.add_child(_box(Vector3(0.34, 0.045, 0.34), Vector3(0, 0.023, 0),
					material(&"cardboard", Color(0.78, 0.63, 0.42), 0.95)))
		&"box":
			root.add_child(_box(Vector3(0.30, 0.26, 0.24), Vector3(0, 0.13, 0),
					material(&"cardboard", Color(0.78, 0.63, 0.42), 0.95)))
			root.add_child(_box(Vector3(0.31, 0.012, 0.05), Vector3(0, 0.262, 0),
					material(&"tape", Color(0.86, 0.80, 0.62), 0.6)))
		&"trash_bag":
			var bag := _sphere(0.26, Vector3(0, 0.247, 0),
					material(&"bagplastic", Color(0.16, 0.17, 0.20), 0.45), 6, 10)
			bag.scale = Vector3(1.0, 0.95, 1.0)
			root.add_child(bag)
			root.add_child(_cone(0.09, 0.14, Vector3(0, 0.5, 0),
					material(&"bagplastic", Color(0.16, 0.17, 0.20), 0.45), 8))
		&"paper", &"newspaper":
			var sheet := _box(Vector3(0.21, 0.008, 0.28), Vector3(0, 0.004, 0),
					material(&"newsprint", Color(0.90, 0.88, 0.82), 0.95))
			sheet.rotation.z = deg_to_rad(4.0)
			root.add_child(sheet)
			if name == &"newspaper":
				var second := _box(Vector3(0.20, 0.008, 0.26), Vector3(0.02, 0.012, 0.01),
						material(&"newsprint", Color(0.90, 0.88, 0.82), 0.95))
				second.rotation.z = deg_to_rad(-6.0)
				root.add_child(second)
		&"crisp_bag":
			var crisps := _box(Vector3(0.14, 0.05, 0.21), Vector3(0, 0.026, 0),
					material(&"foil", Color(0.85, 0.55, 0.20), 0.3, 0.6))
			crisps.rotation.y = deg_to_rad(12.0)
			root.add_child(crisps)
		&"plastic_bag":
			var pb := _sphere(0.15, Vector3(0, 0.105, 0),
					material(&"bagthin", Color(0.90, 0.92, 0.94, 0.8), 0.35), 5, 8)
			pb.scale = Vector3(1.1, 0.7, 0.9)
			root.add_child(pb)
		&"food_wrap":
			root.add_child(_box(Vector3(0.16, 0.035, 0.12), Vector3(0, 0.018, 0),
					material(&"wrap", Color(0.92, 0.86, 0.70), 0.7)))
		&"banana_peel":
			var peel := material(&"peel", Color(0.92, 0.84, 0.28), 0.8)
			for i in range(3):
				var a := TAU * float(i) / 3.0 + 0.5
				var strip := _box(Vector3(0.05, 0.02, 0.17), Vector3(cos(a) * 0.05, 0.02, sin(a) * 0.05), peel)
				strip.rotation.y = a
				strip.rotation.x = deg_to_rad(16.0)
				root.add_child(strip)
		_:
			# Not a litter kind: discard the root we speculatively made so an
			# unknown name does not leak a node.
			root.free()
			return null
	return root
