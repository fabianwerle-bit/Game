class_name CityBuilder
extends RefCounted

## Places every building and prop on the island.
##
## Buildings line the roads: the builder walks each road edge, steps along it
## and sets plots back beyond the pavement, turned to face the carriageway.
## Everything is checked against the water, the roads and whatever has already
## been placed, so nothing ends up in the sea, on the tarmac or inside its
## neighbour. Deterministic for a given seed.

## Nominal setback, used only to decide which district a plot belongs to. The
## real distance is computed per building from its own depth, so the front face
## clears the pavement instead of the centre point clearing it.
const SETBACK := 8.0

## Forecourt between the back of the pavement and the front wall. Wide enough
## to walk along and to read as a front garden; buildings hard against the
## kerb turn every street into a canyon.
const FRONT_MARGIN := 1.6

## Step between plots along a street. The plot itself is only as wide as the
## building, so this sets how far apart their centres start out, and the
## footprint test decides whether the pair actually fits.
const PLOT_SPACING := 8.2

## Clear ground either side of a building, so a street is a row of houses
## rather than one long wall.
const MIN_GAP := 0.9

## Clear ground behind a building, so two rows facing opposite streets keep
## their back yards to themselves.
const BACK_GAP := 0.8

## How far a plot stays back from a junction, beyond the cross street's own
## kerb. Corners want open pavement, not a building wedged into them.
const CORNER_CLEARANCE := 2.0

## How often a plot is left empty, which is what turns a solid frontage into
## a street with air in it.
const GAP_CHANCE := 0.12

## The block north-east of the central crossroads, kept clear as a square.
const SQUARE_CENTRE := Vector2(16.0, 16.0)
const SQUARE_RADIUS := 11.0


## One claimed piece of ground. Either a circle (props, trees, stations) or an
## oriented rectangle (buildings, which stand square to their street).
##
## Buildings used to claim a circle around the whole footprint, and that circle
## is far larger than the building. Two houses facing each other across a block
## rejected one another although their walls were metres apart, so every street
## came out built up on one side only. The rectangle is what the building
## actually occupies.
class Placement extends RefCounted:
	var position: Vector2
	## Bounding radius, used to reject distant pairs before the real test.
	var radius: float
	## Half extents along `right` and `forward`; zero for a circle.
	var half: Vector2 = Vector2.ZERO
	var right: Vector2 = Vector2.RIGHT
	var forward: Vector2 = Vector2.UP

	func _init(p: Vector2, r: float) -> void:
		position = p
		radius = r

	static func box(p: Vector2, p_half: Vector2, p_forward: Vector2) -> Placement:
		var made := Placement.new(p, p_half.length())
		made.half = p_half
		made.forward = p_forward.normalized()
		made.right = Vector2(made.forward.y, -made.forward.x)
		return made

	func is_box() -> bool:
		return half != Vector2.ZERO

	## Half the width of this shape's shadow on `axis`, measured from centre.
	func extent_on(axis: Vector2) -> float:
		if not is_box():
			return radius
		return absf(right.dot(axis)) * half.x + absf(forward.dot(axis)) * half.y


## Separating-axis test. Two shapes overlap unless some axis exists on which
## their shadows come apart.
static func _overlaps(a: Placement, b: Placement) -> bool:
	var between := b.position - a.position
	var gap := between.length()
	if gap > a.radius + b.radius:
		return false
	if not a.is_box() and not b.is_box():
		return true
	var axes: Array[Vector2] = []
	if a.is_box():
		axes.append(a.right)
		axes.append(a.forward)
	if b.is_box():
		axes.append(b.right)
		axes.append(b.forward)
	# A circle's worst case against a box is the line between the two centres.
	if not a.is_box() or not b.is_box():
		if gap > 0.0001:
			axes.append(between / gap)
	for axis: Vector2 in axes:
		if absf(between.dot(axis)) > a.extent_on(axis) + b.extent_on(axis):
			return false
	return true


var island: IslandLayout
var roads: RoadGraph
var _taken: Array[Placement] = []
var _rng := RandomNumberGenerator.new()

## Where the recycling stations ended up, for the world to instance.
var station_points: Array = []


func _init(p_island: IslandLayout, p_roads: RoadGraph) -> void:
	island = p_island
	roads = p_roads
	_rng.seed = IslandLayout.SEED


func build() -> Node3D:
	var root := Node3D.new()
	root.name = "City"
	_taken.clear()
	station_points.clear()
	PropBuilder.reset_variants()

	# Order matters: everything with a fixed place claims its ground before
	# the scatter passes fill in around it. Nature used to run first and take
	# the whole beach, leaving the parasols and deckchairs nowhere to stand.
	_reserve_stations()
	_place_square(root)
	_place_buildings(root)
	_place_harbour(root)
	_place_beach(root)
	_place_street_furniture(root)
	_place_nature(root)
	return root



## Wrap a prop in a box collider sized to its own geometry.
##
## Buildings were being added as bare meshes, so the slime drove straight
## through walls and the chase camera's obstruction probe had nothing to hit -
## which is why the view kept ending up inside a shop.
static func _add_collision(node: Node3D, layer: int = 1, shrink: float = 0.94) -> void:
	var box := _local_bounds(node)
	if box.size.x <= 0.01 or box.size.z <= 0.01:
		return
	var body := StaticBody3D.new()
	body.name = "Body"
	body.collision_layer = layer
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var form := BoxShape3D.new()
	form.size = Vector3(box.size.x * shrink, maxf(box.size.y, 0.5), box.size.z * shrink)
	shape.shape = form
	shape.position = box.get_center()
	body.add_child(shape)
	node.add_child(body)


## The space a prop occupies, in its own root's coordinates.
##
## Every transform between the root and a mesh is accumulated, not just the
## mesh's own. Imported models carry their metres-per-unit scale on the root
## and hang their geometry several nodes down, and a rigged figure is a chain
## of joints; measuring only the leaf gave a building its size in model units
## and a person the height of their own head.
static func _local_bounds(node: Node) -> AABB:
	var box := AABB()
	var first := true
	for entry: Array in _meshes_with_transform(node, Transform3D.IDENTITY):
		var mesh: MeshInstance3D = entry[0]
		var at: Transform3D = entry[1]
		if mesh.mesh == null:
			continue
		var local := at * mesh.mesh.get_aabb()
		if first:
			box = local
			first = false
		else:
			box = box.merge(local)
	return box


## Every mesh under `node`, each with the transform that places it there.
static func _meshes_with_transform(node: Node, at: Transform3D) -> Array:
	var here := at
	if node is Node3D:
		here = at * (node as Node3D).transform
	var out: Array = []
	if node is MeshInstance3D:
		out.append([node, here])
	for child: Node in node.get_children():
		out.append_array(_meshes_with_transform(child, here))
	return out


## A building's walls on the ground, as (width, depth).
##
## Models record their own; anything else falls back to its bounding box,
## which for a prop with an overhang is a little generous.
static func _footprint(node: Node3D) -> Vector2:
	if node.has_meta(&"footprint"):
		return node.get_meta(&"footprint")
	var box := _local_bounds(node)
	return Vector2(box.size.x, box.size.z)


static func _meshes(node: Node) -> Array:
	var out: Array = []
	if node is MeshInstance3D:
		out.append(node)
	for child in node.get_children():
		out.append_array(_meshes(child))
	return out


func _fits(p: Vector2, radius: float, road_clearance: float) -> bool:
	return _fits_shape(Placement.new(p, radius), road_clearance)


## As `_fits`, for a rectangle standing square to its street.
func _fits_box(p: Vector2, half: Vector2, forward: Vector2, road_clearance: float) -> bool:
	return _fits_shape(Placement.box(p, half, forward), road_clearance)


func _fits_shape(shape: Placement, road_clearance: float) -> bool:
	if not island.is_walkable(shape.position, 5.0):
		return false
	if roads.distance_to_road(shape.position) < road_clearance:
		return false
	for other: Placement in _taken:
		if _overlaps(shape, other):
			return false
	return true


func _claim(p: Vector2, radius: float) -> void:
	_taken.append(Placement.new(p, radius))


func _claim_box(p: Vector2, half: Vector2, forward: Vector2) -> void:
	_taken.append(Placement.box(p, half, forward))


## Stations are claimed first so a building never takes their spot. One per
## district, set just off a road so the player can roll straight in.
func _reserve_stations() -> void:
	var wanted := {
		IslandLayout.CENTRE: Vector2(0, 0),
		IslandLayout.SUBURB: Vector2(-64, 6),
		IslandLayout.PARK: Vector2(58, 26),
		IslandLayout.HARBOUR: Vector2(-22, -58),
		IslandLayout.BEACH: Vector2(20, 76),
	}
	for district: StringName in wanted:
		var anchor: Vector2 = wanted[district]
		var node := roads.nearest_node(anchor)
		var neighbours := roads.neighbours(node)
		if neighbours.is_empty():
			continue
		# Just off the kerb on the first road out of that node.
		var other: int = neighbours[0]
		var dir := (roads.nodes[other] - roads.nodes[node]).normalized()
		var right := Vector2(-dir.y, dir.x)
		var spot := roads.nodes[node] + dir * 9.0 + right * 9.5
		if not island.is_walkable(spot, 6.0):
			spot = roads.nodes[node] + dir * 9.0 - right * 9.5
		if not island.is_walkable(spot, 6.0):
			spot = anchor
		_claim(spot, 6.0)
		station_points.append({"district": district, "position": spot})


## What gets built where. The park is left to its trees.
##
## The belt outside the ring road belongs to no district, and used to be given
## the town centre's shops and apartment blocks - a parade of shopfronts facing
## open fields. It gets outskirts housing instead, with the occasional corner
## shop.
## One of the palette's candy colours, softened so the kit's own shading and
## roof still show through the wash.
func _wall_tint() -> Color:
	var candy := Palette.WALLS[_rng.randi_range(0, Palette.WALLS.size() - 1)]
	return Color.WHITE.lerp(candy, 0.62)


func _building_names(district: StringName) -> Array[StringName]:
	match district:
		IslandLayout.CENTRE:
			return [&"shop0", &"shop1", &"shop2", &"block0", &"block1"]
		IslandLayout.SUBURB:
			return [&"house0", &"house1", &"house2", &"house3"]
		IslandLayout.HARBOUR:
			return [&"warehouse0", &"warehouse1"]
		IslandLayout.BEACH:
			return [&"beach_hut0", &"beach_hut1"]
		IslandLayout.PARK:
			return []
		_:
			return [&"house0", &"house1", &"house2", &"house3", &"shop1"]


## Buildings line the streets, set back by their own front face.
##
## Two earlier attempts are worth remembering. Measuring the setback to a
## building's centre put the front of every deep shop out on the carriageway.
## Scattering them through the blocks instead left the island looking like
## empty fields, because on a grid this tight almost no ground is far enough
## from a road. Rows along the frontage, with real gaps and whole blocks left
## clear, is what gives streets that read as streets and still feel open.
func _place_buildings(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "Buildings"
	root.add_child(holder)

	for e: RoadGraph.Edge in roads.edges:
		var a := roads.nodes[e.a]
		var b := roads.nodes[e.b]
		var length := a.distance_to(b)
		var dir := (b - a).normalized()
		var right := Vector2(-dir.y, dir.x)
		var kerb := roads.road_half_width(e.kind) + TerrainBuilder.PAVEMENT_WIDTH

		# Stay off the corners: a building wedged into a junction blocks the
		# view down both streets and gets rejected for being too near the
		# cross road anyway.
		var corner := kerb + CORNER_CLEARANCE
		var usable := length - 2.0 * corner
		if usable < PLOT_SPACING * 0.6:
			continue
		var plots := maxi(int(usable / PLOT_SPACING), 1)

		for i in range(plots):
			var along := corner + usable * (float(i) + 0.5) / float(plots)
			for side: float in [1.0, -1.0]:
				var district := island.district_at(
						a + dir * along + right * side * SETBACK)
				var names := _building_names(district)
				if names.is_empty():
					continue
				# Gaps, and the occasional whole frontage left open as a square.
				if _rng.randf() < GAP_CHANCE:
					continue

				var name: StringName = names[_rng.randi_range(0, names.size() - 1)]
				# Every building on a street wears a different colour, and the
				# same plot always gets the same one for a given seed.
				var node := AssetLibrary.model(name, _wall_tint())
				var foot := _footprint(node)
				var setback := kerb + FRONT_MARGIN + foot.y * 0.5
				# Face the road: the model's front is +Z.
				var facing := -right * side
				# The claimed rectangle is the building's own footprint plus a
				# gap, turned to match it. Half along the frontage, half in
				# depth - not one circle around the lot, which used to swallow
				# the whole block.
				var half := foot * 0.5 + Vector2(MIN_GAP, BACK_GAP)

				var found: Variant = _slide_to_fit(a, dir, right * side, along,
						setback, half, facing, kerb + 0.5, corner, length - corner)
				if found == null:
					node.queue_free()
					continue
				var spot: Vector2 = found

				node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
				node.rotation.y = atan2(facing.x, facing.y)
				_add_collision(node)
				holder.add_child(node)
				_claim_box(spot, half, facing)


## Find room for one plot, shuffling it up and down its own street.
##
## A plot pinned to the middle of its edge fails wherever two streets meet:
## the building on this frontage and the one round the corner want the same
## ground, and on a junction-heavy grid that rejected a third of the town. A
## few metres either way is enough to settle it, and the small irregularity
## reads better than a row of buildings all pinned to their mid-points.
## Returns the world position, or null when nothing along the edge fits.
func _slide_to_fit(a: Vector2, dir: Vector2, out: Vector2, along: float,
		setback: float, half: Vector2, facing: Vector2, road_clearance: float,
		low: float, high: float) -> Variant:
	for step: float in [0.0, 2.5, -2.5, 5.0, -5.0, 7.5, -7.5, 10.0, -10.0]:
		var at := along + step
		if at < low or at > high:
			continue
		var spot := a + dir * at + out * setback
		if _fits_box(spot, half, facing, road_clearance):
			return spot
	return null


func _place_street_furniture(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "StreetFurniture"
	root.add_child(holder)

	for e: RoadGraph.Edge in roads.edges:
		var a := roads.nodes[e.a]
		var b := roads.nodes[e.b]
		var length := a.distance_to(b)
		var dir := (b - a).normalized()
		var right := Vector2(-dir.y, dir.x)
		var half := roads.road_half_width(e.kind)
		var count := int(length / 16.0)

		for i in range(count):
			var t := (float(i) + 0.5) / float(maxi(count, 1))
			var side: float = 1.0 if (i % 2 == 0) else -1.0
			var spot := a.lerp(b, t) + right * side * (half + 2.0)
			if not island.is_walkable(spot, 4.0):
				continue
			var what := &"lamp"
			var roll := _rng.randf()
			if roll < 0.18:
				what = &"bin"
			elif roll < 0.32:
				what = &"bench"
			elif roll < 0.40:
				what = &"sign"
			elif roll < 0.50:
				what = &"planter"
			var node := AssetLibrary.model(what)
			node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
			node.rotation.y = atan2(-right.x * side, -right.y * side)
			holder.add_child(node)


## How much ground each kind of greenery takes, and how far it keeps off the
## carriageway. A tree overhangs; a clump of flowers does not.
const GREENERY := {
	&"tree": [2.2, 7.6],
	&"tree_small": [1.5, 7.0],
	&"palm": [2.6, 7.6],
	&"bush": [1.1, 6.8],
	&"flowers": [0.7, 6.6],
	&"rock": [1.4, 7.0],
	&"fence": [1.0, 6.8],
	&"planter": [1.0, 6.6],
	&"bollard": [0.8, 6.4],
	&"bench": [1.4, 7.0],
}


## Trees, hedges and flowers, in the districts and in the blocks between them.
##
## The claimed radius follows the prop rather than one figure for all of them.
## With a single generous radius a clump of flowers reserved as much ground as
## an oak, and the blocks came out as bare lawns with a couple of buildings
## standing on them.
func _place_nature(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "Nature"
	root.add_child(holder)

	var plan := {
		IslandLayout.PARK: [[&"tree", 26], [&"tree_small", 14], [&"bush", 22],
				[&"flowers", 26], [&"bench", 8]],
		IslandLayout.SUBURB: [[&"tree", 16], [&"bush", 20], [&"flowers", 20], [&"fence", 12]],
		IslandLayout.CENTRE: [[&"tree_small", 14], [&"planter", 10], [&"bollard", 12],
				[&"bush", 14], [&"flowers", 16]],
		IslandLayout.HARBOUR: [[&"rock", 10], [&"bollard", 10], [&"bush", 8]],
		IslandLayout.BEACH: [[&"palm", 16], [&"rock", 8], [&"bush", 6]],
	}

	for district: StringName in plan:
		for entry: Array in plan[district]:
			var what: StringName = entry[0]
			var count: int = entry[1]
			var spots := island.scatter_in_district(district, count * 8, int(what.hash()), 5.0)
			_sow(holder, what, spots, count)

	# The belt outside the ring road belongs to no district, and was coming out
	# as bare grass between the outskirts housing.
	for entry: Array in [[&"tree", 20], [&"bush", 22], [&"flowers", 24]]:
		var what: StringName = entry[0]
		var count: int = entry[1]
		_sow(holder, what, island.scatter(count * 8, int(what.hash()) + 7, 6.0), count)


## Plant up to `count` of `what` on the first spots with room for them.
func _sow(holder: Node3D, what: StringName, spots: PackedVector2Array, count: int) -> void:
	var shape: Array = GREENERY.get(what, [2.2, 7.6])
	var radius: float = shape[0]
	var clearance: float = shape[1]
	var placed := 0
	for spot: Vector2 in spots:
		if placed >= count:
			return
		if not _fits(spot, radius, clearance):
			continue
		var node := AssetLibrary.model(what)
		node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
		node.rotation.y = _rng.randf() * TAU
		holder.add_child(node)
		_claim(spot, radius)
		placed += 1


func _place_harbour(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "Harbour"
	root.add_child(holder)
	var quay := island.district(IslandLayout.HARBOUR)
	if quay == null:
		return

	# Containers stacked along the quay.
	for i in range(10):
		var ring := Vector2(cos(float(i) * 1.1), sin(float(i) * 1.1)) \
				* quay.radius * Vector2(0.62, 0.50)
		var spot := quay.centre + ring
		if not _fits(spot, 4.0, 6.0):
			continue
		var node := AssetLibrary.model(&"container")
		node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
		node.rotation.y = _rng.randf_range(-0.3, 0.3) + (0.0 if i % 2 == 0 else PI * 0.5)
		_add_collision(node)
		holder.add_child(node)
		_claim(spot, 4.5)
		# Occasionally a second one on top.
		if _rng.randf() < 0.4:
			var stacked := AssetLibrary.model(&"container")
			stacked.position = Vector3(spot.x, IslandLayout.GROUND_Y + 2.6, spot.y)
			stacked.rotation.y = node.rotation.y
			holder.add_child(stacked)

	var crane_spot := quay.centre + Vector2(0.24, -0.46) * quay.radius
	if _fits(crane_spot, 6.0, 7.0):
		var crane := AssetLibrary.model(&"crane")
		crane.position = Vector3(crane_spot.x, IslandLayout.GROUND_Y, crane_spot.y)
		crane.rotation.y = 2.2
		_add_collision(crane)
		holder.add_child(crane)
		_claim(crane_spot, 6.0)

	# Boats moored in the inlet, sitting on the water rather than the ground.
	for i in range(5):
		var a := -PI * 0.5 + _rng.randf_range(-0.12, 0.12)
		var r := 66.0 + float(i) * 3.0
		var spot := Vector2(cos(a), sin(a)) * r
		var boat := AssetLibrary.model(&"boat")
		boat.position = Vector3(spot.x, IslandLayout.WATER_Y + 0.15, spot.y)
		boat.rotation.y = _rng.randf_range(-0.4, 0.4)
		holder.add_child(boat)


func _place_beach(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "Beach"
	root.add_child(holder)
	var beach := island.district(IslandLayout.BEACH)
	if beach == null:
		return

	# Spread across the district rather than by a figure in metres, so the
	# beach stays furnished whatever size the island is built at.
	var spread := beach.radius * 0.8
	for i in range(44):
		var spot := beach.centre + Vector2(
			_rng.randf_range(-spread, spread),
			_rng.randf_range(-spread * 0.3, spread * 0.8))
		if not island.is_walkable(spot, 2.0):
			continue
		if not _fits(spot, 2.0, 4.5):
			continue
		var what := &"parasol" if _rng.randf() < 0.5 else &"deckchair"
		var node := AssetLibrary.model(what)
		node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
		node.rotation.y = _rng.randf() * TAU
		holder.add_child(node)
		_claim(spot, 2.0)


## The town square, laid out before any building so it stays open.
##
## It sits in the block north-east of the central crossroads and claims the
## whole block, which is the one piece of the plan that stops the centre
## closing in on itself. A fountain in the middle, benches looking at it,
## planters and lamps round the edge, trees at the back.
func _place_square(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "TownSquare"
	root.add_child(holder)

	var centre := SQUARE_CENTRE
	if not island.is_walkable(centre, 8.0):
		return
	# Claim the block first: everything below is dressing inside it.
	_claim(centre, SQUARE_RADIUS)

	var fountain := AssetLibrary.model(&"fountain")
	fountain.position = Vector3(centre.x, IslandLayout.GROUND_Y, centre.y)
	_add_collision(fountain)
	holder.add_child(fountain)

	# Benches on all four sides, turned to face the water.
	for i: int in range(4):
		var angle := TAU * float(i) / 4.0 + PI * 0.25
		var out := Vector2(cos(angle), sin(angle))
		var bench := AssetLibrary.model(&"bench")
		var at := centre + out * 5.4
		bench.position = Vector3(at.x, IslandLayout.GROUND_Y, at.y)
		# The bench seat faces +Z, so point it back at the fountain.
		bench.rotation.y = atan2(-out.x, -out.y)
		holder.add_child(bench)

	# Planters and lamps alternating round the rim, and a bin by one of them.
	for i: int in range(8):
		var angle := TAU * float(i) / 8.0
		var out := Vector2(cos(angle), sin(angle))
		var at := centre + out * 8.6
		if not island.is_walkable(at, 4.0):
			continue
		var what: StringName = &"planter" if i % 2 == 0 else &"lamp"
		var node := AssetLibrary.model(what)
		node.position = Vector3(at.x, IslandLayout.GROUND_Y, at.y)
		node.rotation.y = angle
		holder.add_child(node)

	var bin := AssetLibrary.model(&"bin")
	var bin_at := centre + Vector2(6.8, -6.8)
	bin.position = Vector3(bin_at.x, IslandLayout.GROUND_Y, bin_at.y)
	holder.add_child(bin)

	# A pair of trees behind the fountain for some height on the square.
	for offset: Vector2 in [Vector2(-7.4, 7.4), Vector2(7.4, 7.4)]:
		var tree := AssetLibrary.model(&"tree")
		var at := centre + offset
		if not island.is_walkable(at, 4.0):
			continue
		tree.position = Vector3(at.x, IslandLayout.GROUND_Y, at.y)
		tree.rotation.y = _rng.randf() * TAU
		holder.add_child(tree)
