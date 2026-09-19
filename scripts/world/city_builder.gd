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

## Gap between the back of the pavement and the front wall.
const FRONT_MARGIN := 0.9
const PLOT_SPACING := 8.5
## Half the minimum distance between two buildings. Must stay below half
## PLOT_SPACING or neighbouring plots on the same street reject each other.
const MIN_GAP := 0.8


class Placement extends RefCounted:
	var position: Vector2
	var radius: float

	func _init(p: Vector2, r: float) -> void:
		position = p
		radius = r


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

	_reserve_stations()
	_place_buildings(root)
	_place_street_furniture(root)
	_place_nature(root)
	_place_harbour(root)
	_place_beach(root)
	_place_centre_features(root)
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


static func _local_bounds(node: Node) -> AABB:
	var box := AABB()
	var first := true
	for mesh: MeshInstance3D in _meshes(node):
		if mesh.mesh == null:
			continue
		var local := mesh.mesh.get_aabb()
		local.position *= mesh.scale
		local.size *= mesh.scale
		local.position += mesh.position
		if first:
			box = local
			first = false
		else:
			box = box.merge(local)
	return box


static func _meshes(node: Node) -> Array:
	var out: Array = []
	if node is MeshInstance3D:
		out.append(node)
	for child in node.get_children():
		out.append_array(_meshes(child))
	return out


func _fits(p: Vector2, radius: float, road_clearance: float) -> bool:
	if not island.is_walkable(p, 5.0):
		return false
	if roads.distance_to_road(p) < road_clearance:
		return false
	for other: Placement in _taken:
		if p.distance_to(other.position) < radius + other.radius:
			return false
	return true


func _claim(p: Vector2, radius: float) -> void:
	_taken.append(Placement.new(p, radius))


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


func _building_names(district: StringName) -> Array[StringName]:
	match district:
		IslandLayout.SUBURB:
			return [&"house0", &"house1", &"house2", &"house3"]
		IslandLayout.HARBOUR:
			return [&"warehouse0", &"warehouse1"]
		IslandLayout.BEACH:
			return [&"beach_hut0", &"beach_hut1"]
		IslandLayout.PARK:
			return []
		_:
			return [&"shop0", &"shop1", &"shop2", &"block0", &"block1"]


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
		var plots := int(length / PLOT_SPACING)

		for i in range(plots):
			var t := (float(i) + 0.5) / float(maxi(plots, 1))
			var centre := a.lerp(b, t)
			for side: float in [1.0, -1.0]:
				var district := island.district_at(centre + right * side * SETBACK)
				var names := _building_names(district)
				if names.is_empty():
					continue
				# Leave gaps: a solid wall of houses reads as a corridor.
				if _rng.randf() < 0.08:
					continue

				var name: StringName = names[_rng.randi_range(0, names.size() - 1)]
				var node := AssetLibrary.model(name)

				# Set back by the building's own front face, not its centre.
				# Measuring to the centre put the front of every deep shop out
				# on the carriageway, which the player then drove into.
				var bounds := _local_bounds(node)
				var front := maxf(bounds.position.z + bounds.size.z, 0.0)
				var kerb := roads.road_half_width(e.kind) + TerrainBuilder.PAVEMENT_WIDTH
				var setback := kerb + FRONT_MARGIN + front
				var spot := centre + right * side * setback

				var footprint := maxf(bounds.size.x, bounds.size.z) * 0.5 + MIN_GAP
				if not _fits(spot, footprint, kerb + 0.5):
					node.queue_free()
					continue

				node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
				# Face the road: the model's front is +Z.
				var facing := -right * side
				node.rotation.y = atan2(facing.x, facing.y)
				_add_collision(node)
				holder.add_child(node)
				_claim(spot, footprint)


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


func _place_nature(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "Nature"
	root.add_child(holder)

	var plan := {
		IslandLayout.PARK: [[&"tree", 26], [&"tree_small", 14], [&"bush", 22],
				[&"flowers", 26], [&"bench", 8]],
		IslandLayout.SUBURB: [[&"tree", 14], [&"bush", 16], [&"flowers", 14], [&"fence", 10]],
		IslandLayout.CENTRE: [[&"tree_small", 10], [&"planter", 8], [&"bollard", 12]],
		IslandLayout.HARBOUR: [[&"rock", 10], [&"bollard", 10], [&"bush", 6]],
		IslandLayout.BEACH: [[&"palm", 16], [&"rock", 8], [&"bush", 6]],
	}

	for district: StringName in plan:
		for entry: Array in plan[district]:
			var what: StringName = entry[0]
			var count: int = entry[1]
			var spots := island.scatter_in_district(district, count * 3, int(what.hash()), 5.0)
			var placed := 0
			for spot: Vector2 in spots:
				if placed >= count:
					break
				if not _fits(spot, 2.2, 9.0):
					continue
				var node := AssetLibrary.model(what)
				node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
				node.rotation.y = _rng.randf() * TAU
				holder.add_child(node)
				_claim(spot, 2.2)
				placed += 1


func _place_harbour(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "Harbour"
	root.add_child(holder)
	var quay := island.district(IslandLayout.HARBOUR)
	if quay == null:
		return

	# Containers stacked along the quay.
	for i in range(8):
		var spot := quay.centre + Vector2(cos(float(i) * 1.1) * 16.0, sin(float(i) * 1.1) * 13.0)
		if not _fits(spot, 4.5, 10.0):
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

	var crane_spot := quay.centre + Vector2(6.0, -12.0)
	if _fits(crane_spot, 6.0, 10.0):
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

	for i in range(14):
		var spot := beach.centre + Vector2(
			_rng.randf_range(-26.0, 26.0), _rng.randf_range(-6.0, 20.0))
		if not island.is_walkable(spot, 2.5):
			continue
		if not _fits(spot, 2.4, 8.0):
			continue
		var what := &"parasol" if _rng.randf() < 0.5 else &"deckchair"
		var node := AssetLibrary.model(what)
		node.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
		node.rotation.y = _rng.randf() * TAU
		holder.add_child(node)
		_claim(spot, 2.4)


func _place_centre_features(root: Node3D) -> void:
	var holder := Node3D.new()
	holder.name = "CentreFeatures"
	root.add_child(holder)
	# A fountain on the plaza, set back from the crossroads at the origin.
	var spot := Vector2(11.0, 11.0)
	if _fits(spot, 4.0, 8.0):
		var fountain := AssetLibrary.model(&"fountain")
		fountain.position = Vector3(spot.x, IslandLayout.GROUND_Y, spot.y)
		holder.add_child(fountain)
		_claim(spot, 4.0)
