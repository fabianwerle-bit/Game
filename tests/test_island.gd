extends RefCounted

## Geometry checks on the island shape and the road network. These guard the
## things that are invisible until they break a whole playthrough: a road node
## out at sea, a district no car can reach, a coastline that turned into a
## circle.


static func run(t: TestSupport) -> void:
	var island := IslandLayout.new()
	var roads := RoadGraph.new()
	_test_coastline(t, island)
	_test_containment(t, island)
	_test_districts(t, island)
	_test_respawn(t, island)
	_test_roads_on_land(t, island, roads)
	_test_graph(t, island, roads)
	_test_lanes(t, roads)
	_test_junction_tokens(t, roads)


static func _test_coastline(t: TestSupport, island: IslandLayout) -> void:
	t.suite("coastline")
	t.eq(island.coastline.size(), IslandLayout.COAST_SEGMENTS, "coastline fully sampled")

	var min_r := INF
	var max_r := 0.0
	for p: Vector2 in island.coastline:
		var r := p.length()
		min_r = minf(min_r, r)
		max_r = maxf(max_r, r)
	# A circle would have min == max. Demand a genuinely irregular outline.
	t.check(max_r - min_r > 40.0 * IslandLayout.SCALE, "coastline is not a circle")
	t.between(max_r, 100.0 * IslandLayout.SCALE, 140.0 * IslandLayout.SCALE,
			"island stays compact enough to cross quickly")
	t.check(min_r > 35.0 * IslandLayout.SCALE, "no part of the coast collapses into the middle")

	# The harbour inlet is a notch in the north (-Z), the beach a bulge south.
	var north := island._coast_point(-PI * 0.5).length()
	var south := island._coast_point(PI * 0.5).length()
	var east := island._coast_point(0.0).length()
	t.check(north < east, "harbour inlet cuts into the north coast")
	t.check(south > north, "beach shelf pushes out to the south")

	# No self-intersection artefacts: consecutive points stay close together.
	var n := island.coastline.size()
	for i in range(n):
		var step := island.coastline[i].distance_to(island.coastline[(i + 1) % n])
		if step > 14.0 * IslandLayout.SCALE:
			t.check(false, "coastline step %d jumps %.1fm" % [i, step])
			return
	t.check(true, "coastline has no jagged jumps")


static func _test_containment(t: TestSupport, island: IslandLayout) -> void:
	t.suite("containment")
	t.check(island.contains_point(Vector2.ZERO), "the town centre is on the island")
	t.check(not island.contains_point(Vector2(400, 0)), "open sea is not on the island")
	t.check(not island.contains_point(Vector2(0, 400)), "open sea to the south is not either")
	t.check(island.signed_shore_distance(Vector2.ZERO) > 0.0, "inland distance is positive")
	t.check(island.signed_shore_distance(Vector2(400, 0)) < 0.0, "offshore distance is negative")
	t.check(island.is_walkable(Vector2.ZERO), "centre is walkable")
	t.check(not island.is_walkable(Vector2(400, 400)), "the sea is not walkable")


static func _test_districts(t: TestSupport, island: IslandLayout) -> void:
	t.suite("districts")
	t.eq(island.districts.size(), 5, "five districts")
	for id: StringName in IslandLayout.DISTRICTS:
		var d := island.district(id)
		t.check(d != null, "district %s exists" % id)
		if d == null:
			continue
		t.check(island.is_walkable(d.centre, 3.0), "district %s sits on dry land" % id)
		t.eq(island.district_at(d.centre), id, "district %s claims its own centre" % id)

	# Districts must not all collapse onto each other.
	for i in range(island.districts.size()):
		for j in range(i + 1, island.districts.size()):
			var a: IslandLayout.District = island.districts[i]
			var b: IslandLayout.District = island.districts[j]
			if a.centre.distance_to(b.centre) <= 30.0 * IslandLayout.SCALE:
				t.check(false, "%s and %s overlap" % [a.id, b.id])
				return
	t.check(true, "districts are spread across the island")

	# Scattered spawn points land inside the district and on dry ground.
	for id: StringName in IslandLayout.DISTRICTS:
		var pts := island.scatter_in_district(id, 25, 7)
		t.eq(pts.size(), 25, "scatter filled %s" % id)
		for p: Vector2 in pts:
			if not island.is_walkable(p, 3.0):
				t.check(false, "scatter put a point in the sea near %s" % id)
				return
	t.check(true, "scattered points are all on dry land")


static func _test_respawn(t: TestSupport, island: IslandLayout) -> void:
	t.suite("water respawn")
	for p: Vector2 in [Vector2(300, 0), Vector2(0, -300), Vector2(-250, 250), Vector2(140, 60)]:
		var safe := island.nearest_safe_point(p)
		t.check(island.is_walkable(safe, 5.0), "respawn from %s lands on dry ground" % p)
	var inland := Vector2(10, 10)
	t.eq(island.nearest_safe_point(inland), inland, "a safe point is left alone")


static func _test_roads_on_land(t: TestSupport, island: IslandLayout, roads: RoadGraph) -> void:
	t.suite("roads on land")
	for i in range(roads.nodes.size()):
		var p := roads.nodes[i]
		if not island.is_walkable(p, 6.0):
			t.check(false, "road node %d at %s is in the water" % [i, p])
			return
	t.check(true, "every road node is safely inland")

	# Sample along each edge too, so no road crosses a bay.
	for e: RoadGraph.Edge in roads.edges:
		for s in range(1, 8):
			var p := roads.nodes[e.a].lerp(roads.nodes[e.b], float(s) / 8.0)
			if not island.is_walkable(p, 4.0):
				t.check(false, "road %d-%d crosses water" % [e.a, e.b])
				return
	t.check(true, "no road crosses open water")


static func _test_graph(t: TestSupport, island: IslandLayout, roads: RoadGraph) -> void:
	t.suite("road graph")
	t.check(roads.is_fully_connected(), "every road node is reachable")

	# More edges than nodes means the network contains loops, so there is more
	# than one way between two places. That is the property that matters; a raw
	# edge count just describes whichever layout happened to be current.
	t.check(roads.edges.size() > roads.nodes.size(),
			"network loops back on itself rather than being a tree")

	var junctions := 0
	for i in range(roads.nodes.size()):
		if roads.is_junction(i):
			junctions += 1
	t.check(junctions >= 6, "network has real junctions, not just a ring")

	for i in range(roads.nodes.size()):
		t.check(roads.degree(i) >= 2, "node %d is not a dead end" % i)

	# Look the endpoints up by district rather than by index: hard-coded node
	# numbers silently stop meaning what they used to the moment the layout
	# changes.
	var from_node := roads.nearest_node(island.district(IslandLayout.HARBOUR).centre)
	var to_node := roads.nearest_node(island.district(IslandLayout.BEACH).centre)
	var path := roads.find_path(from_node, to_node)
	t.check(path.size() > 2, "harbour connects to the beach by road")
	t.eq(path[0], from_node, "path starts at the harbour")
	t.eq(path[path.size() - 1], to_node, "path ends at the beach")

	# Consecutive path nodes must really be joined by an edge.
	for i in range(path.size() - 1):
		if roads.edge_between(path[i], path[i + 1]) == null:
			t.check(false, "path jumps between unconnected nodes")
			return
	t.check(true, "path only uses real edges")


static func _test_lanes(t: TestSupport, roads: RoadGraph) -> void:
	t.suite("lanes")
	# Opposing lanes on the same road must be on opposite sides.
	var forward := roads.lane_point(0, 1, 0.5)
	var backward := roads.lane_point(1, 0, 0.5)
	var offset := roads.lane_offset(0, 1)
	t.check(forward.distance_to(backward) > offset,
			"oncoming traffic uses the other side of the road")
	var centre := roads.nodes[0].lerp(roads.nodes[1], 0.5)
	t.near(forward.distance_to(centre), offset, 0.01,
			"lane sits half a carriageway off the centreline")

	# Lanes and pavements scale with the road, so a car on a narrow lane is
	# not half over the kerb and nobody walks in the gutter of a main road.
	for edge: RoadGraph.Edge in roads.edges:
		var half := roads.road_half_width(edge.kind)
		var lane := roads.lane_offset(edge.a, edge.b)
		var walk := roads.pavement_offset(edge.a, edge.b)
		if lane <= 0.0 or lane >= half:
			t.check(false, "lane on edge %d-%d is off the carriageway" % [edge.a, edge.b])
			return
		if walk <= half:
			t.check(false, "pavement on edge %d-%d is on the road" % [edge.a, edge.b])
			return
	t.check(true, "every lane stays on its road and every pavement stays off it")

	# Pavements are further out than the traffic lanes.
	var pave := roads.pavement_point(0, 1, 0.5, 1)
	t.check(pave.distance_to(centre) > forward.distance_to(centre),
			"the pavement is outside the traffic lane")

	t.check(roads.is_on_road(roads.nodes[0]), "a junction counts as road")
	# Find real open ground rather than assuming a hand-picked point is clear.
	var open_ground := Vector2.ZERO
	var found := false
	var reach := int(90.0 * IslandLayout.SCALE)
	for gx in range(-reach, reach + 1, 2):
		for gz in range(-reach, reach + 1, 2):
			var p := Vector2(float(gx), float(gz))
			if roads.distance_to_road(p) > 15.0 * IslandLayout.SCALE:
				open_ground = p
				found = true
				break
		if found:
			break
	t.check(found, "the island has ground away from the roads")
	t.check(not roads.is_on_road(open_ground), "open ground away from a road is not road")

	# The routing prefers straight on over a hard turn.
	var rng := RandomNumberGenerator.new()
	rng.seed = 4
	var straight := 0
	for i in range(200):
		if roads.next_node(1, 0, rng) == 3:
			straight += 1
	t.check(straight > 80, "traffic mostly carries straight through a crossroads")
	t.check(straight < 200, "traffic still turns sometimes")


static func _test_junction_tokens(t: TestSupport, roads: RoadGraph) -> void:
	t.suite("junction tokens")
	var junction := -1
	for i in range(roads.nodes.size()):
		if roads.is_junction(i):
			junction = i
			break
	t.check(junction >= 0, "found a junction to test")
	t.check(roads.request_junction(junction, 1), "first car claims the junction")
	t.check(not roads.request_junction(junction, 2), "second car has to wait")
	t.check(roads.request_junction(junction, 1), "the holder keeps its claim")
	roads.release_junction(junction, 1)
	t.check(roads.request_junction(junction, 2), "the junction frees up again")
	roads.release_all(2)
	t.check(roads.request_junction(junction, 3), "release_all clears the token")
	roads.release_all(3)
