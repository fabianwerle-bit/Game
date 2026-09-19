class_name RoadGraph
extends RefCounted

## The island's road network: a centre grid, a ring road and spurs out to the
## harbour, the beach, the suburb and the park.
##
## Vehicles follow right-hand lanes derived from the edges, pedestrians follow
## pavements offset further out. Junctions are simply nodes with three or more
## edges, and each one hands out a single crossing token so cars take turns.

const LANE_HALF_WIDTH := 1.9
## Where pedestrians walk. Must clear the carriageway, or the crowd strolls
## down the middle of the kerb line.
const PAVEMENT_OFFSET := 4.8

enum { ROAD_MAIN, ROAD_STREET, ROAD_LANE }

class Edge extends RefCounted:
	var a: int
	var b: int
	var kind: int
	var length: float

	func _init(p_a: int, p_b: int, p_kind: int) -> void:
		a = p_a
		b = p_b
		kind = p_kind


var nodes: PackedVector2Array = PackedVector2Array()
var edges: Array[Edge] = []
var adjacency: Dictionary = {}

## node index -> owner id currently crossing, or -1 when free.
var _junction_token: Dictionary = {}


func _init() -> void:
	_build()


func _build() -> void:
	# A compact grid. Written in final metres rather than scaled from a larger
	# layout: the point of the smaller island is tighter blocks, and uniformly
	# shrinking a wide-street plan just leaves streets too narrow to build
	# along. Twenty metres between parallel streets leaves room for a building
	# set back from each side without the two overlapping.
	nodes = PackedVector2Array([
		Vector2(0, 0),        # 0  centre plaza
		Vector2(0, -26),      # 1
		Vector2(26, 0),       # 2
		Vector2(0, 26),       # 3
		Vector2(-26, 0),      # 4
		Vector2(26, -26),     # 5
		Vector2(26, 26),      # 6
		Vector2(-26, 26),     # 7
		Vector2(-26, -26),    # 8
		Vector2(0, -42),      # 9  ring north, clear of the harbour inlet
		Vector2(33, -33),     # 10
		Vector2(47, 0),       # 11 ring east
		Vector2(33, 33),      # 12
		Vector2(0, 47),       # 13 ring south
		Vector2(-33, 33),     # 14
		Vector2(-47, 0),      # 15 ring west
		Vector2(-33, -33),    # 16
		Vector2(-16, -48),    # 17 harbour quay, beside the inlet
		Vector2(-36, -40),    # 18 harbour west
		Vector2(16, 58),      # 19 beach promenade east
		Vector2(-5, 56),      # 20 beach promenade west
		Vector2(-57, 5),      # 21 suburb centre
		Vector2(-60, -16),    # 22 suburb north
		Vector2(-54, 26),     # 23 suburb south
		Vector2(51, 22),      # 24 park entrance
		Vector2(56, 7),       # 25 park east
	])

	var main := [
		[9, 10], [10, 11], [11, 12], [12, 13],
		[13, 14], [14, 15], [15, 16], [16, 9],
	]
	var street := [
		[0, 1], [0, 2], [0, 3], [0, 4],
		[1, 5], [5, 2], [2, 6], [6, 3], [3, 7], [7, 4], [4, 8], [8, 1],
		[1, 9], [2, 11], [3, 13], [4, 15],
		[5, 10], [6, 12], [7, 14], [8, 16],
	]
	var lane := [
		[9, 17], [17, 18], [18, 16],
		[13, 19], [19, 20], [20, 13],
		[15, 21], [21, 22], [22, 16], [21, 23], [23, 14],
		[11, 24], [24, 25], [25, 12],
	]

	for pair: Array in main:
		_add_edge(pair[0], pair[1], ROAD_MAIN)
	for pair: Array in street:
		_add_edge(pair[0], pair[1], ROAD_STREET)
	for pair: Array in lane:
		_add_edge(pair[0], pair[1], ROAD_LANE)

	for i in range(nodes.size()):
		_junction_token[i] = -1


func _add_edge(a: int, b: int, kind: int) -> void:
	var e := Edge.new(a, b, kind)
	e.length = nodes[a].distance_to(nodes[b])
	edges.append(e)
	if not adjacency.has(a):
		adjacency[a] = [] as Array[int]
	if not adjacency.has(b):
		adjacency[b] = [] as Array[int]
	adjacency[a].append(b)
	adjacency[b].append(a)


func neighbours(node: int) -> Array[int]:
	var out: Array[int] = []
	out.assign(adjacency.get(node, []))
	return out


func degree(node: int) -> int:
	return adjacency.get(node, []).size()


func is_junction(node: int) -> bool:
	return degree(node) >= 3


func road_half_width(kind: int) -> float:
	match kind:
		ROAD_MAIN:
			return 4.4
		ROAD_STREET:
			return 3.6
		_:
			return 3.0


func edge_between(a: int, b: int) -> Edge:
	for e: Edge in edges:
		if (e.a == a and e.b == b) or (e.a == b and e.b == a):
			return e
	return null


## Centre of the right-hand lane for someone travelling from `a` to `b`.
func lane_point(a: int, b: int, t: float) -> Vector2:
	var pa := nodes[a]
	var pb := nodes[b]
	var dir := (pb - pa).normalized()
	var right := Vector2(-dir.y, dir.x)
	return pa.lerp(pb, clampf(t, 0.0, 1.0)) + right * LANE_HALF_WIDTH


## Pavement line alongside an edge. `side` is +1 or -1.
func pavement_point(a: int, b: int, t: float, side: int) -> Vector2:
	var pa := nodes[a]
	var pb := nodes[b]
	var dir := (pb - pa).normalized()
	var right := Vector2(-dir.y, dir.x)
	return pa.lerp(pb, clampf(t, 0.0, 1.0)) + right * PAVEMENT_OFFSET * signf(float(side))


func nearest_node(p: Vector2) -> int:
	var best := -1
	var best_d := INF
	for i in range(nodes.size()):
		var d := p.distance_squared_to(nodes[i])
		if d < best_d:
			best_d = d
			best = i
	return best


## Distance from a point to the nearest road centreline, and the edge it belongs
## to. Used to keep buildings off the tarmac and to tell the slime when it is on
## a road.
func distance_to_road(p: Vector2) -> float:
	var best := INF
	for e: Edge in edges:
		best = minf(best, _point_segment_distance(p, nodes[e.a], nodes[e.b]))
	return best


func is_on_road(p: Vector2) -> bool:
	for e: Edge in edges:
		if _point_segment_distance(p, nodes[e.a], nodes[e.b]) <= road_half_width(e.kind):
			return true
	return false


func _point_segment_distance(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var len_sq := ab.length_squared()
	if len_sq < 0.000001:
		return p.distance_to(a)
	var t := clampf((p - a).dot(ab) / len_sq, 0.0, 1.0)
	return p.distance_to(a + ab * t)


## Pick the next node for a vehicle arriving at `at` from `came_from`.
## Prefers going straight on and only doubles back at a dead end.
func next_node(came_from: int, at: int, rng: RandomNumberGenerator) -> int:
	var options := neighbours(at)
	if options.is_empty():
		return came_from
	var forward: Array[int] = []
	for n: int in options:
		if n != came_from:
			forward.append(n)
	if forward.is_empty():
		return came_from

	var incoming := (nodes[at] - nodes[came_from]).normalized()
	var weights: Array[float] = []
	var total := 0.0
	for n: int in forward:
		var outgoing := (nodes[n] - nodes[at]).normalized()
		# 1.0 straight ahead, down to ~0.15 for a hard turn.
		var w := 0.15 + 0.85 * maxf(incoming.dot(outgoing), 0.0)
		weights.append(w)
		total += w
	var roll := rng.randf() * total
	for i in range(forward.size()):
		roll -= weights[i]
		if roll <= 0.0:
			return forward[i]
	return forward[forward.size() - 1]


## Shortest node path with A*. Used by pedestrians heading somewhere specific
## and by the map screen's route hints.
func find_path(from: int, to: int) -> Array[int]:
	if from == to:
		return [from] as Array[int]
	var open: Array[int] = [from]
	var came: Dictionary = {}
	var g: Dictionary = {from: 0.0}
	var f: Dictionary = {from: nodes[from].distance_to(nodes[to])}

	while not open.is_empty():
		var current := open[0]
		var best_f: float = f.get(current, INF)
		for n: int in open:
			var nf: float = f.get(n, INF)
			if nf < best_f:
				best_f = nf
				current = n
		if current == to:
			var path: Array[int] = [current]
			while came.has(current):
				current = came[current]
				path.push_front(current)
			return path
		open.erase(current)
		for n: int in neighbours(current):
			var tentative: float = float(g.get(current, INF)) + nodes[current].distance_to(nodes[n])
			if tentative < float(g.get(n, INF)):
				came[n] = current
				g[n] = tentative
				f[n] = tentative + nodes[n].distance_to(nodes[to])
				if not open.has(n):
					open.append(n)
	return [] as Array[int]


## True when every node can be reached from node 0. Asserted by the tests so a
## typo in the edge table cannot strand a district.
func is_fully_connected() -> bool:
	if nodes.is_empty():
		return false
	var seen := {0: true}
	var stack: Array[int] = [0]
	while not stack.is_empty():
		var n: int = stack.pop_back()
		for m: int in neighbours(n):
			if not seen.has(m):
				seen[m] = true
				stack.append(m)
	return seen.size() == nodes.size()


## Junction reservation. A vehicle asks before entering and releases on the far
## side; everyone else waits. Cheap, and enough to stop cars driving through
## each other at crossings.
func request_junction(node: int, owner_id: int) -> bool:
	if not is_junction(node):
		return true
	var holder: int = _junction_token.get(node, -1)
	if holder == -1 or holder == owner_id:
		_junction_token[node] = owner_id
		return true
	return false


func release_junction(node: int, owner_id: int) -> void:
	if _junction_token.get(node, -1) == owner_id:
		_junction_token[node] = -1


func release_all(owner_id: int) -> void:
	for node: int in _junction_token.keys():
		if _junction_token[node] == owner_id:
			_junction_token[node] = -1
