class_name RoundRules
extends RefCounted

## Every rule that decides whether a round continues, and what it is worth.
##
## Deliberately free of nodes, scenes and rendering so the whole ruleset can be
## driven at arbitrary time steps by `tests/test_round_rules.gd`. The 3D game
## feeds it events (`on_pickup`, `on_bank`, `on_hit`) and reads state back out.

signal combo_changed(count: int, multiplier: int)
signal combo_broken(at_count: int)
signal phase_changed(phase: int)
signal banked(points: int, seconds: float, items: int)
signal round_ended(reason: StringName)

## Round length in seconds. Also the hard ceiling for time bonuses, so a good
## run never banks an unbounded timer (spec: "maximale verbleibende Zeit").
const TIME_START := 60.0
const TIME_MAX := 60.0

const TIME_PER_PICKUP := 0.2
const TIME_PER_CAPACITY_BANKED := 0.8
const TIME_FULL_LOAD_BONUS := 3.0
const TIME_COMBO_BONUS := 0.15

## Seconds without a pickup before the combo lapses.
const COMBO_WINDOW := 4.0

## Pickups needed for each multiplier step, highest first.
const COMBO_STEPS := [[15, 5], [10, 4], [6, 3], [3, 2]]

## Banking bonus per capacity unit handed in, before the multiplier.
const BANK_POINTS_PER_CAPACITY := 8

## Phase boundaries in seconds of round time survived.
const PHASE_BOUNDS := [60.0, 120.0, 180.0]

## How fast chaos moves when the street is exactly at / far past its budget.
const CHAOS_RISE := 0.055
const CHAOS_FALL := 0.09

## Ground litter weight a phase tolerates before chaos starts climbing.
const CHAOS_BUDGET := [14.0, 20.0, 26.0, 32.0]

const REASON_TIME := &"time"
const REASON_CHAOS := &"chaos"

enum { IDLE, RUNNING, ENDED }

var state: int = IDLE
var time_left: float = TIME_START
var elapsed: float = 0.0
var phase: int = 1

## Points already safe in the bank, and points riding on the litter the slime
## is still carrying. Getting hit by a car costs the pending points of whatever
## shakes loose, which is what makes a full slime worth protecting.
var score: int = 0
var pending_score: int = 0

var combo_count: int = 0
var combo_timer: float = 0.0
var multiplier: int = 1

var chaos: float = 0.0

var carried_items: int = 0
var carried_capacity: int = 0

var stat_collected: int = 0
var stat_banked_items: int = 0
var stat_best_combo: int = 0
var stat_best_multiplier: int = 1
var stat_deliveries: int = 0
var stat_hits: int = 0

var end_reason: StringName = &""


func start() -> void:
	state = RUNNING
	time_left = TIME_START
	elapsed = 0.0
	phase = 1
	score = 0
	pending_score = 0
	combo_count = 0
	combo_timer = 0.0
	multiplier = 1
	chaos = 0.0
	carried_items = 0
	carried_capacity = 0
	stat_collected = 0
	stat_banked_items = 0
	stat_best_combo = 0
	stat_best_multiplier = 1
	stat_deliveries = 0
	stat_hits = 0
	end_reason = &""


## Advance the round. `ground_chaos_weight` is the summed `chaos` value of all
## litter currently lying in the world; the world layer computes it.
func tick(delta: float, ground_chaos_weight: float) -> void:
	if state != RUNNING:
		return
	elapsed += delta
	time_left -= delta * drain_rate()
	_update_phase()
	_update_combo(delta)
	_update_chaos(delta, ground_chaos_weight)
	if time_left <= 0.0:
		time_left = 0.0
		_end(REASON_TIME)
	elif chaos >= 1.0:
		chaos = 1.0
		_end(REASON_CHAOS)


## Time drains slightly faster in the late phases so a long run keeps tightening
## even while the player is banking well.
func drain_rate() -> float:
	return 1.0 + 0.08 * float(phase - 1)


func _update_phase() -> void:
	var next := 1
	for bound: float in PHASE_BOUNDS:
		if elapsed >= bound:
			next += 1
	if next != phase:
		phase = next
		phase_changed.emit(phase)


func _update_combo(delta: float) -> void:
	if combo_count <= 0:
		return
	combo_timer -= delta
	if combo_timer <= 0.0:
		var at := combo_count
		combo_count = 0
		multiplier = 1
		combo_timer = 0.0
		combo_broken.emit(at)
		combo_changed.emit(0, 1)


func _update_chaos(delta: float, ground_chaos_weight: float) -> void:
	var budget: float = CHAOS_BUDGET[clampi(phase - 1, 0, CHAOS_BUDGET.size() - 1)]
	var pressure := ground_chaos_weight / maxf(budget, 0.001)
	if pressure > 1.0:
		chaos += (pressure - 1.0) * CHAOS_RISE * delta
	else:
		chaos -= (1.0 - pressure) * CHAOS_FALL * delta
	chaos = clampf(chaos, 0.0, 1.0)


func _multiplier_for(count: int) -> int:
	for step: Array in COMBO_STEPS:
		if count >= int(step[0]):
			return int(step[1])
	return 1


## The slime absorbed one piece of litter. Returns the points it put at stake.
func on_pickup(kind: TrashCatalog.Kind) -> int:
	if state != RUNNING or kind == null:
		return 0
	combo_count += 1
	combo_timer = COMBO_WINDOW
	var next_multiplier := _multiplier_for(combo_count)
	if next_multiplier != multiplier:
		multiplier = next_multiplier
		stat_best_multiplier = maxi(stat_best_multiplier, multiplier)
		add_time(TIME_COMBO_BONUS * float(multiplier))
	stat_best_combo = maxi(stat_best_combo, combo_count)
	combo_changed.emit(combo_count, multiplier)

	var value := kind.points * multiplier
	pending_score += value
	carried_items += 1
	carried_capacity += kind.capacity
	stat_collected += 1
	add_time(TIME_PER_PICKUP)
	return value


## The slime reached a station and handed everything over.
func on_bank() -> int:
	if state != RUNNING or carried_items <= 0:
		return 0
	var was_full := carried_capacity >= TrashCatalog.CAPACITY_MAX
	var bonus := BANK_POINTS_PER_CAPACITY * carried_capacity * multiplier
	var gained := pending_score + bonus
	score += gained

	var seconds := TIME_PER_CAPACITY_BANKED * float(carried_capacity)
	if was_full:
		seconds += TIME_FULL_LOAD_BONUS
	add_time(seconds)

	var items := carried_items
	stat_banked_items += items
	stat_deliveries += 1
	pending_score = 0
	carried_items = 0
	carried_capacity = 0
	banked.emit(gained, seconds, items)
	return gained


## A vehicle hit the slime and knocked `lost_items` pieces loose, worth
## `lost_capacity` between them. The combo breaks and the pending points that
## rode on those pieces are gone.
func on_hit(lost_items: int, lost_capacity: int, time_penalty: float) -> void:
	if state != RUNNING:
		return
	stat_hits += 1
	lost_items = clampi(lost_items, 0, carried_items)
	lost_capacity = clampi(lost_capacity, 0, carried_capacity)
	if carried_items > 0 and lost_items > 0:
		var share := float(lost_items) / float(carried_items)
		pending_score -= int(round(float(pending_score) * share))
		pending_score = maxi(pending_score, 0)
	carried_items -= lost_items
	carried_capacity -= lost_capacity
	if combo_count > 0:
		var at := combo_count
		combo_count = 0
		multiplier = 1
		combo_timer = 0.0
		combo_broken.emit(at)
		combo_changed.emit(0, 1)
	time_left = maxf(time_left - time_penalty, 0.0)
	if time_left <= 0.0:
		_end(REASON_TIME)


## Litter left the world without the slime collecting it (despawned, blown into
## the sea). Keeps the chaos bookkeeping honest without awarding anything.
func on_litter_lost() -> void:
	pass


func add_time(seconds: float) -> void:
	time_left = clampf(time_left + seconds, 0.0, TIME_MAX)


func capacity_left() -> int:
	return maxi(TrashCatalog.CAPACITY_MAX - carried_capacity, 0)


func is_full() -> bool:
	return carried_capacity >= TrashCatalog.CAPACITY_MAX


func fill_ratio() -> float:
	return clampf(float(carried_capacity) / float(TrashCatalog.CAPACITY_MAX), 0.0, 1.0)


func is_running() -> bool:
	return state == RUNNING


## True once the HUD should start its red pulse and warning beep.
func is_time_critical() -> bool:
	return state == RUNNING and time_left < 10.0


func _end(reason: StringName) -> void:
	if state == ENDED:
		return
	state = ENDED
	end_reason = reason
	round_ended.emit(reason)


## Difficulty knobs the world layer reads every frame. One place to tune, so the
## curve stays playable instead of just piling on objects.
func spawn_interval_scale() -> float:
	return [1.0, 0.72, 0.55, 0.42][clampi(phase - 1, 0, 3)]


func traffic_density() -> float:
	return [0.55, 0.75, 0.9, 1.0][clampi(phase - 1, 0, 3)]


func pedestrian_density() -> float:
	return [0.6, 0.8, 0.95, 1.0][clampi(phase - 1, 0, 3)]


func event_interval() -> float:
	return [999.0, 34.0, 26.0, 19.0][clampi(phase - 1, 0, 3)]
