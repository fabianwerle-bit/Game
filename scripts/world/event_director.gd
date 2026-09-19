class_name EventDirector
extends RefCounted

## Schedules the six special events and reports what each one wants done.
##
## The scheduling is pure bookkeeping — which event, when, for how long, never
## the same one twice in a row — so the tests can run a whole round's worth of
## events in milliseconds. The world reacts to the signals.

signal started(id: StringName, district: StringName, duration: float)
signal finished(id: StringName)

const SCHOOL_OUT := &"school_out"
const LORRY_SPILL := &"lorry_spill"
const GUST := &"gust"
const FESTIVAL := &"festival"
const RAIN := &"rain"
const RUSH_HOUR := &"rush_hour"

const ALL: Array[StringName] = [SCHOOL_OUT, LORRY_SPILL, GUST, FESTIVAL, RAIN, RUSH_HOUR]

## How long each event runs, in seconds.
const DURATIONS := {
	SCHOOL_OUT: 16.0,
	LORRY_SPILL: 9.0,
	GUST: 14.0,
	FESTIVAL: 18.0,
	RAIN: 30.0,
	RUSH_HOUR: 20.0,
}

var active: StringName = &""
var active_district: StringName = &""
var time_left: float = 0.0
var next_in: float = 0.0

var _last: StringName = &""
var _rng := RandomNumberGenerator.new()


func _init(seed_value: int = IslandLayout.SEED) -> void:
	_rng.seed = seed_value


func start_round(first_delay: float) -> void:
	active = &""
	active_district = &""
	time_left = 0.0
	next_in = first_delay
	_last = &""


## `interval` comes from the round's phase, so events only begin once the round
## has warmed up and then come round more often.
func tick(delta: float, interval: float) -> void:
	if active != &"":
		time_left -= delta
		if time_left <= 0.0:
			var ending := active
			active = &""
			active_district = &""
			finished.emit(ending)
			next_in = interval * _rng.randf_range(0.7, 1.3)
		return

	next_in -= delta
	if next_in > 0.0:
		return
	if interval > 100.0:
		# Phase 1: no events yet, so the player gets a clean run at learning.
		next_in = 1.0
		return
	_begin(interval)


func _begin(interval: float) -> void:
	var options: Array[StringName] = []
	for id: StringName in ALL:
		if id != _last:
			options.append(id)
	var chosen: StringName = options[_rng.randi_range(0, options.size() - 1)]
	_last = chosen
	active = chosen
	time_left = DURATIONS.get(chosen, 12.0)
	active_district = _district_for(chosen)
	started.emit(chosen, active_district, time_left)


## Events that happen somewhere in particular pick a district; the weather ones
## cover the whole island.
func _district_for(id: StringName) -> StringName:
	match id:
		RAIN, RUSH_HOUR, GUST:
			return &""
		SCHOOL_OUT:
			return [IslandLayout.CENTRE, IslandLayout.SUBURB][_rng.randi_range(0, 1)]
		FESTIVAL:
			return [IslandLayout.PARK, IslandLayout.BEACH, IslandLayout.HARBOUR][_rng.randi_range(0, 2)]
		LORRY_SPILL:
			return IslandLayout.DISTRICTS[_rng.randi_range(0, IslandLayout.DISTRICTS.size() - 1)]
		_:
			return &""


func is_active(id: StringName) -> bool:
	return active == id


func label(id: StringName) -> String:
	match id:
		SCHOOL_OUT: return "Schulschluss"
		LORRY_SPILL: return "Müllwagen verliert Ladung"
		GUST: return "Windböe"
		FESTIVAL: return "Festival zu Ende"
		RAIN: return "Regen"
		RUSH_HOUR: return "Rush Hour"
		_: return ""


## Multipliers the world applies while an event runs.
func litter_rate_scale() -> float:
	match active:
		SCHOOL_OUT: return 2.1
		FESTIVAL: return 2.8
		_: return 1.0


func traffic_scale() -> float:
	return 1.7 if active == RUSH_HOUR else 1.0


func crowd_scale() -> float:
	match active:
		SCHOOL_OUT: return 1.6
		FESTIVAL: return 1.8
		RAIN: return 0.65
		_: return 1.0


func wetness_target() -> float:
	return 1.0 if active == RAIN else 0.0


## Wind vector for the gust event, in world XZ.
func wind() -> Vector3:
	if active != GUST:
		return Vector3.ZERO
	var strength := 2.4 * sin(time_left * 0.6) * 0.5 + 2.6
	var angle := float(_rng.seed % 628) * 0.01
	return Vector3(cos(angle), 0.0, sin(angle)) * strength
