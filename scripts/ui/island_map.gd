class_name IslandMap
extends Control

## Overview of the island, drawn from the same `IslandLayout` and `RoadGraph`
## the world is built from. Nothing here is hand-drawn, so the map cannot drift
## out of step with the place it describes.
##
## Slightly isometric: the whole plan is squashed vertically and sheared, which
## reads as a map of a place rather than a flat diagram.

const SQUASH := 0.62
const SHEAR := 0.16

var island: IslandLayout
var roads: RoadGraph

## Optional live markers, set by the pause screen while a round is running.
var player_position: Vector2 = Vector2.ZERO
var show_player: bool = false
var station_markers: Array = []

var _scale: float = 1.0
var _centre: Vector2 = Vector2.ZERO


func _ready() -> void:
	if island == null:
		island = IslandLayout.new()
	if roads == null:
		roads = RoadGraph.new()
	resized.connect(queue_redraw)


## World XZ to screen, with the isometric squash applied.
func project(world: Vector2) -> Vector2:
	var p := Vector2(world.x + world.y * SHEAR, world.y * SQUASH)
	return _centre + p * _scale


func _recompute_transform() -> void:
	var bounds := island.bounds()
	var corners := [
		Vector2(bounds.position.x, bounds.position.y),
		Vector2(bounds.end.x, bounds.position.y),
		Vector2(bounds.position.x, bounds.end.y),
		Vector2(bounds.end.x, bounds.end.y),
	]
	var min_p := Vector2(INF, INF)
	var max_p := Vector2(-INF, -INF)
	for c: Vector2 in corners:
		var p := Vector2(c.x + c.y * SHEAR, c.y * SQUASH)
		min_p = min_p.min(p)
		max_p = max_p.max(p)
	var span := max_p - min_p
	var room := size - Vector2(48, 48)
	_scale = minf(room.x / maxf(span.x, 1.0), room.y / maxf(span.y, 1.0))
	_centre = size * 0.5 - (min_p + max_p) * 0.5 * _scale


func _draw() -> void:
	if island == null:
		return
	_recompute_transform()

	# Sea.
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.13, 0.28, 0.40))

	# Island body, with a soft surf ring just outside it.
	var shore := PackedVector2Array()
	var body := PackedVector2Array()
	for p: Vector2 in island.coastline:
		shore.append(project(p * 1.035))
		body.append(project(p))
	draw_colored_polygon(shore, Color(0.32, 0.55, 0.62, 0.55))
	draw_colored_polygon(body, Color(0.52, 0.66, 0.42))

	# District tints, so the five areas read apart at a glance.
	for d: IslandLayout.District in island.districts:
		var ring := PackedVector2Array()
		for i in range(28):
			var a := TAU * float(i) / 28.0
			var p := d.centre + Vector2(cos(a), sin(a)) * d.radius
			# Keep the tint inside the coastline.
			if not island.contains_point(p):
				p = d.centre + (p - d.centre) * 0.72
			ring.append(project(p))
		draw_colored_polygon(ring, Color(d.colour.r, d.colour.g, d.colour.b, 0.5))

	# Roads.
	for e: RoadGraph.Edge in roads.edges:
		var a := project(roads.nodes[e.a])
		var b := project(roads.nodes[e.b])
		var width := 5.0 if e.kind == RoadGraph.ROAD_MAIN else 3.4
		draw_line(a, b, Color(0.30, 0.29, 0.30, 0.85), width * _scale * 0.6, true)

	# District labels.
	var font := ThemeDB.fallback_font
	for d: IslandLayout.District in island.districts:
		var at := project(d.centre)
		var text_size := font.get_string_size(d.label, HORIZONTAL_ALIGNMENT_LEFT, -1, 26)
		draw_string_outline(font, at - Vector2(text_size.x * 0.5, -8), d.label,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 26, 6, Color(0.05, 0.12, 0.10))
		draw_string(font, at - Vector2(text_size.x * 0.5, -8), d.label,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color(0.98, 0.99, 0.96))

	# Stations: filled when open, hollow when closed.
	for marker: Dictionary in station_markers:
		var at := project(marker["position"])
		var open: bool = marker["active"]
		if open:
			draw_circle(at, 11.0, Color(0.35, 0.95, 0.45))
			draw_arc(at, 15.0, 0.0, TAU, 20, Color(0.35, 0.95, 0.45, 0.6), 2.5, true)
		else:
			draw_arc(at, 10.0, 0.0, TAU, 20, Color(0.55, 0.70, 0.58, 0.7), 2.5, true)

	if show_player:
		var at := project(player_position)
		draw_circle(at, 9.0, Color(0.40, 0.95, 0.45))
		draw_arc(at, 13.0, 0.0, TAU, 20, Color(1, 1, 1, 0.9), 2.5, true)
