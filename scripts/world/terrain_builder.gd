class_name TerrainBuilder
extends RefCounted

## Builds the island surface, the sea, the road surfaces and the pavements.
##
## The ground is a radial mesh laid out from the same coastline the rest of the
## game uses, so what the player drives on and what the map draws are the same
## shape. Inland it is a flat plateau; near the coast it ramps down through a
## beach into the water.

## Rings from the middle of the island out to the coast.
const RINGS := 22

## Where the plateau starts dropping away, as a fraction of the way to the coast.
const SHORE_START := 0.80
const BEACH_START := 0.62

const ROAD_LIFT := 0.05
const PAVEMENT_LIFT := 0.13
const PAVEMENT_WIDTH := 2.0


static func build_ground(island: IslandLayout) -> Node3D:
	var root := Node3D.new()
	root.name = "Ground"

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	var segments := island.coastline.size()
	# Vertex grid: ring 0 is the centre point, ring RINGS is the coastline.
	for ring in range(RINGS):
		for seg in range(segments):
			var next_seg := (seg + 1) % segments
			var t0 := float(ring) / float(RINGS)
			var t1 := float(ring + 1) / float(RINGS)
			var a := _vertex(island, seg, t0)
			var b := _vertex(island, next_seg, t0)
			var c := _vertex(island, next_seg, t1)
			var d := _vertex(island, seg, t1)
			# Wound so the faces point up. Getting this backwards makes the
			# whole island invisible under cull_back and turns its normals
			# upside down, while still looking fine in a wireframe.
			if ring == 0:
				# Innermost ring closes to a single centre vertex.
				_tri(st, island, Vector3(0, IslandLayout.GROUND_Y, 0), d, c)
			else:
				_tri(st, island, a, c, b)
				_tri(st, island, a, d, c)

	st.generate_normals()
	st.generate_tangents()
	var mesh := st.commit()

	var mi := MeshInstance3D.new()
	mi.name = "Surface"
	mi.mesh = mesh
	mi.material_override = _ground_material()
	root.add_child(mi)

	var body := StaticBody3D.new()
	body.name = "GroundBody"
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var trimesh := mesh.create_trimesh_shape()
	# Kept on as a belt-and-braces guard: a one-sided ground lets a fast body
	# tunnel through it, and the failure is silent.
	trimesh.backface_collision = true
	shape.shape = trimesh
	body.add_child(shape)
	root.add_child(body)
	return root


static func _vertex(island: IslandLayout, segment: int, t: float) -> Vector3:
	var coast := island.coastline[segment]
	var flat := coast * t
	return Vector3(flat.x, height_at(t), flat.y)


## Height profile from the middle of the island out to the water.
static func height_at(t: float) -> float:
	if t <= SHORE_START:
		return IslandLayout.GROUND_Y
	var k := (t - SHORE_START) / (1.0 - SHORE_START)
	# Smooth ramp down, carrying on below the waterline so the shore is not a cliff.
	var eased := k * k * (3.0 - 2.0 * k)
	return lerpf(IslandLayout.GROUND_Y, IslandLayout.WATER_Y - 1.1, eased)


static func _tri(st: SurfaceTool, island: IslandLayout, a: Vector3, b: Vector3, c: Vector3) -> void:
	for v: Vector3 in [a, b, c]:
		st.set_color(_ground_colour(island, v))
		st.set_uv(Vector2(v.x, v.z) * 0.08)
		st.add_vertex(v)


## Vertex colour drives the ground shader: RGB is a tint, alpha is how sandy
## the spot is. The shader blends the grass and sand texture sets by that
## alpha, so the shoreline changes material and not merely colour.
static func _ground_colour(island: IslandLayout, v: Vector3) -> Color:
	var here := Vector2(v.x, v.z)
	var district := island.district_at(here)
	var tint := Palette.GRASS
	match district:
		IslandLayout.CENTRE, IslandLayout.HARBOUR:
			tint = Palette.GRASS_TOWN
		IslandLayout.PARK:
			tint = Palette.GRASS_PARK

	# How far out towards the coast this point is, 0 in the middle and 1 at the
	# waterline. Derived from the coastline itself rather than from height, so
	# the sand band follows the shore across the flat plateau too — going by
	# height alone left the beach covered in grass.
	var coast_radius := maxf(island._coast_point(here.angle()).length(), 0.001)
	var out := clampf(here.length() / coast_radius, 0.0, 1.0)
	var sandiness := smoothstep(SHORE_START - 0.06, 0.99, out)
	# The beach district is sand well inland, not just at the water's edge.
	if district == IslandLayout.BEACH:
		sandiness = maxf(sandiness, smoothstep(BEACH_START - 0.22, BEACH_START + 0.1, out))
	# And the ground turns sandy as it drops away anywhere.
	var drop := clampf((IslandLayout.GROUND_Y - v.y) / (IslandLayout.GROUND_Y + 1.1), 0.0, 1.0)
	sandiness = maxf(sandiness, smoothstep(0.02, 0.4, drop))

	# The north-west headland is rock rather than sand.
	var bearing := here.angle()
	if bearing < -1.9 and bearing > -2.8 and here.length() > 70.0 * IslandLayout.SCALE:
		tint = tint.lerp(Palette.ROCK, 0.6)

	tint.a = sandiness
	return tint


## Ground material. Uses the grass and sand PBR sets when they are present,
## and falls back to the plain vertex-coloured surface when they are not, so
## the island still builds on a checkout that has not run the asset fetch.
## Flat, bright ground. The vertex colours carry the tint and the sand blend;
## the shader only adds a little large-scale variation.
static func _ground_material() -> Material:
	var shader := ShaderMaterial.new()
	shader.shader = load("res://shaders/terrain.gdshader")
	shader.set_shader_parameter("sand_colour", Palette.SAND)
	return shader


## The sea: a large plane with a scrolling normal ripple.
static func build_water(island: IslandLayout) -> Node3D:
	var root := Node3D.new()
	root.name = "Water"
	var extent := island.bounds().size.length() * 1.4

	var plane := PlaneMesh.new()
	plane.size = Vector2(extent, extent)
	plane.subdivide_width = 24
	plane.subdivide_depth = 24

	var mi := MeshInstance3D.new()
	mi.name = "Surface"
	mi.mesh = plane
	mi.position = Vector3(0, IslandLayout.WATER_Y, 0)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/water.gdshader")
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
	return root


## Road surface and pavements, drawn as flat ribbons over the terrain.
static func build_roads(roads: RoadGraph) -> Node3D:
	var root := Node3D.new()
	root.name = "Roads"

	var tarmac := SurfaceTool.new()
	tarmac.begin(Mesh.PRIMITIVE_TRIANGLES)
	var paving := SurfaceTool.new()
	paving.begin(Mesh.PRIMITIVE_TRIANGLES)
	var markings := SurfaceTool.new()
	markings.begin(Mesh.PRIMITIVE_TRIANGLES)

	for e: RoadGraph.Edge in roads.edges:
		var a := roads.nodes[e.a]
		var b := roads.nodes[e.b]
		var dir := (b - a).normalized()
		var right := Vector2(-dir.y, dir.x)
		var half := roads.road_half_width(e.kind)

		_ribbon(tarmac, a, b, right, -half, half, IslandLayout.GROUND_Y + ROAD_LIFT)
		# Pavements down both sides, raised above the carriageway.
		_ribbon(paving, a, b, right, half, half + PAVEMENT_WIDTH,
				IslandLayout.GROUND_Y + PAVEMENT_LIFT)
		_ribbon(paving, a, b, right, -half - PAVEMENT_WIDTH, -half,
				IslandLayout.GROUND_Y + PAVEMENT_LIFT)

		# Dashed centre line, skipped on the narrow lanes.
		if e.kind != RoadGraph.ROAD_LANE:
			var length := a.distance_to(b)
			var dashes := maxi(int(length / 4.0), 1)
			for i in range(dashes):
				var t0 := (float(i) + 0.25) / float(dashes)
				var t1 := (float(i) + 0.75) / float(dashes)
				_ribbon(markings, a.lerp(b, t0), a.lerp(b, t1), right, -0.16, 0.16,
						IslandLayout.GROUND_Y + ROAD_LIFT + 0.01)

	root.add_child(_surface("Tarmac", tarmac, _flat(Palette.TARMAC)))
	root.add_child(_surface("Pavement", paving, _flat(Palette.PAVEMENT)))
	root.add_child(_surface("Markings", markings, _flat(Palette.MARKING)))

	# Kerbs are collidable so the slime and the crowd stay off the carriageway
	# edges in a way the player can feel.
	return root


static func _ribbon(st: SurfaceTool, a: Vector2, b: Vector2, right: Vector2,
		from_offset: float, to_offset: float, y: float) -> void:
	var p0 := a + right * from_offset
	var p1 := a + right * to_offset
	var p2 := b + right * to_offset
	var p3 := b + right * from_offset
	var quad := [
		Vector3(p0.x, y, p0.y), Vector3(p1.x, y, p1.y),
		Vector3(p2.x, y, p2.y), Vector3(p3.x, y, p3.y),
	]
	for idx: int in [0, 1, 2, 0, 2, 3]:
		var v: Vector3 = quad[idx]
		st.set_uv(Vector2(v.x, v.z) * 0.15)
		st.add_vertex(v)


## Flat, unglossy surface material - the shading style the whole island uses.
##
## Culling is off: the road, pavement and marking ribbons are single-sided
## quads, and getting their winding backwards makes them vanish entirely
## rather than look wrong. That already cost the island itself once, and a
## flat overlay has no depth complexity to pay for the extra faces.
static func _flat(colour: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = colour
	m.roughness = 1.0
	m.metallic = 0.0
	m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_LAMBERT
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m


static func _surface(name: String, st: SurfaceTool, material: Material) -> MeshInstance3D:
	# Normals first: tangents are derived from them, and asking the other way
	# round fails with an ARRAY_FORMAT_NORMAL error.
	st.generate_normals()
	st.generate_tangents()
	var mi := MeshInstance3D.new()
	mi.name = name
	mi.mesh = st.commit()
	mi.material_override = material
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi
