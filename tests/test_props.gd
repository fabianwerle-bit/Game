extends RefCounted

## Every prop name the world builder can ask for must produce real geometry.
## A typo here is otherwise invisible until a magenta marker appears in the
## middle of the city.

const NAMES: Array[StringName] = [
	&"house0", &"house1", &"house2", &"house3",
	&"shop0", &"shop1", &"shop2",
	&"block0", &"block1",
	&"warehouse0", &"warehouse1",
	&"beach_hut0", &"beach_hut1",
	&"tree", &"tree_small", &"palm", &"bush", &"flowers", &"rock",
	&"lamp", &"bench", &"bin", &"sign", &"fountain", &"planter", &"fence", &"bollard",
	&"recycling_station",
	&"parasol", &"deckchair", &"container", &"crane", &"boat",
	&"car", &"van", &"truck", &"bin_lorry", &"scooter", &"bicycle",
	&"pedestrian", &"dog",
]


static func run(t: TestSupport) -> void:
	_test_every_prop_builds(t)
	_test_every_litter_kind_builds(t)
	_test_vehicle_contract(t)
	_test_pedestrian_contract(t)
	_test_determinism(t)
	_test_placeholder_reporting(t)


static func _count_meshes(node: Node) -> int:
	var total := 0
	if node is MeshInstance3D:
		total += 1
	for child in node.get_children():
		total += _count_meshes(child)
	return total


static func _test_every_prop_builds(t: TestSupport) -> void:
	t.suite("props")
	for name: StringName in NAMES:
		var node := PropBuilder.build(name)
		if node == null:
			t.check(false, "prop %s built nothing" % name)
			continue
		if String(node.name).begins_with("Unknown"):
			t.check(false, "prop %s has no builder" % name)
			node.free()
			continue
		var meshes := _count_meshes(node)
		if meshes < 2:
			t.check(false, "prop %s is a single primitive, not a composed object" % name)
			node.free()
			continue
		node.free()
	t.check(true, "all %d props build composed geometry" % NAMES.size())

	# An unknown name must be loud, not silently empty.
	var bogus := PropBuilder.build(&"definitely_not_a_prop")
	t.check(String(bogus.name).begins_with("Unknown"), "an unknown prop is flagged, not skipped")
	bogus.free()


static func _test_every_litter_kind_builds(t: TestSupport) -> void:
	t.suite("litter geometry")
	for id: StringName in TrashCatalog.all_ids():
		var node := PropBuilder.build(id)
		if node == null or String(node.name).begins_with("Unknown"):
			t.check(false, "litter kind %s has no model" % id)
			if node != null:
				node.free()
			continue
		t.check(_count_meshes(node) >= 1, "litter %s has geometry" % id)

		# Litter has to be small enough to read as litter. A bin bag is the
		# largest thing the slime picks up and is still well under a metre.
		var aabb := _bounds(node)
		var size := aabb.size
		if size.x > 0.8 or size.y > 0.8 or size.z > 0.8:
			t.check(false, "litter %s is %.2fm across, too big to be litter" % [id, size.length()])
			node.free()
			continue
		# And it must sit on the ground, not float.
		if aabb.position.y < -0.02:
			t.check(false, "litter %s sinks below the ground" % id)
			node.free()
			continue
		node.free()
	t.check(true, "every litter kind is correctly proportioned and grounded")


## Measured the same way the city measures a prop, so a test cannot pass on a
## size the game never sees.
static func _bounds(node: Node) -> AABB:
	return CityBuilder._local_bounds(node)


static func _all_meshes(node: Node) -> Array:
	var out: Array = []
	if node is MeshInstance3D:
		out.append(node)
	for child in node.get_children():
		out.append_array(_all_meshes(child))
	return out


static func _test_vehicle_contract(t: TestSupport) -> void:
	t.suite("vehicle wheels")
	# Vehicle.gd steers these by name and spins the child. If the names drift,
	# the wheels stop turning and nobody notices until it ships.
	for name: StringName in [&"car", &"van", &"truck", &"bin_lorry", &"scooter", &"bicycle"]:
		var motorised := name != &"bicycle"
		var node := PropBuilder.build(name)
		for wheel: String in ["FrontLeft", "FrontRight", "RearLeft", "RearRight"]:
			var hub := node.find_child(wheel, true, false)
			if hub == null:
				t.check(false, "%s is missing wheel hub %s" % [name, wheel])
				node.free()
				return
			if hub.find_child("Spin", true, false) == null:
				t.check(false, "%s wheel %s has no Spin node" % [name, wheel])
				node.free()
				return
		var rear := "BrakeLight" if motorised else "Reflector"
		if node.find_child(rear, true, false) == null:
			t.check(false, "%s has no %s" % [name, rear])
			node.free()
			return
		node.free()
	t.check(true, "every vehicle has four steerable, spinnable wheels and a rear light")


static func _test_pedestrian_contract(t: TestSupport) -> void:
	t.suite("pedestrian rig")
	var ped := PropBuilder.build(&"pedestrian")
	for joint: String in ["Hips", "Torso", "Head", "ArmLeft", "ArmRight",
			"LegLeft", "LegRight", "HandSocket"]:
		if ped.find_child(joint, true, false) == null:
			t.check(false, "pedestrian is missing joint %s" % joint)
			ped.free()
			return
	t.check(true, "pedestrian exposes every joint the walk cycle drives")

	# The figure has to be person sized, or the slime's knee-height scale breaks.
	var box := _bounds(ped)
	t.between(box.size.y, 1.4, 2.1, "pedestrian is roughly adult height")
	ped.free()


static func _test_determinism(t: TestSupport) -> void:
	t.suite("prop determinism")
	# Two builds from the same starting state must match, or the map screen and
	# the world disagree about what colour a building is.
	PropBuilder.reset_variants()
	var a := PropBuilder.build(&"car")
	var a_meshes := _count_meshes(a)
	a.free()
	PropBuilder.reset_variants()
	var b := PropBuilder.build(&"car")
	var b_meshes := _count_meshes(b)
	b.free()
	t.eq(a_meshes, b_meshes, "rebuilding a prop gives the same geometry")

	# Named variants must differ from each other, or every house looks alike.
	var h0 := PropBuilder.build(&"house0")
	var h1 := PropBuilder.build(&"house1")
	var same := _first_albedo(h0) == _first_albedo(h1)
	h0.free()
	h1.free()
	t.check(not same, "house variants are not all the same colour")


static func _first_albedo(node: Node) -> Color:
	# Textured surfaces are ORMMaterial3D, flat ones StandardMaterial3D; both
	# derive from BaseMaterial3D and both carry the tint in albedo_color.
	for mi: MeshInstance3D in _all_meshes(node):
		if mi.material_override is BaseMaterial3D:
			return (mi.material_override as BaseMaterial3D).albedo_color
	return Color.BLACK


static func _test_placeholder_reporting(t: TestSupport) -> void:
	t.suite("placeholder honesty")
	AssetLibrary.reset()

	# A prop with no artwork must be reported as a stand-in rather than
	# quietly passing as finished art. The bench is still hand-built.
	var stand_in := AssetLibrary.model(&"bench")
	stand_in.free()
	t.check(AssetLibrary.placeholder_report().has(&"bench"),
			"a prop without artwork is reported as a placeholder")
	t.check(not AssetLibrary.has_real_model(&"bench"),
			"and is not claimed to be a real model")

	# And the other way round: a prop that does have artwork must not be
	# counted among the stand-ins, or the report stops meaning anything.
	var real := AssetLibrary.model(&"house0")
	real.free()
	t.check(AssetLibrary.has_real_model(&"house0"),
			"a prop with artwork is reported as a real model")
	t.check(not AssetLibrary.placeholder_report().has(&"house0"),
			"and is not counted as a placeholder")

	AssetLibrary.reset()
	PropBuilder.reset_materials()
	PropBuilder.reset_variants()
