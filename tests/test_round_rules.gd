extends RefCounted

## Exercises the timer, chaos meter, combo ladder, scoring and phase curve.



static func run(t: TestSupport) -> void:
	_test_start_state(t)
	_test_pickup_and_combo(t)
	_test_banking(t)
	_test_time_ceiling(t)
	_test_car_hit(t)
	_test_chaos_meter(t)
	_test_phases(t)
	_test_game_over_paths(t)


static func _kind(id: StringName) -> TrashCatalog.Kind:
	return TrashCatalog.get_kind(id)


## Pick up `count` pieces, emptying at a station whenever the slime fills up.
## The slime only holds ten, so any combo past that has to survive a delivery.
static func _collect(r: RoundRules, count: int) -> void:
	for i in range(count):
		if r.is_full():
			r.on_bank()
		r.on_pickup(TrashCatalog.get_kind(&"paper"))


static func _test_start_state(t: TestSupport) -> void:
	t.suite("start")
	var r := RoundRules.new()
	t.eq(r.state, RoundRules.IDLE, "starts idle")
	r.start()
	t.eq(r.state, RoundRules.RUNNING, "running after start")
	t.near(r.time_left, 60.0, 0.001, "round opens on 60 seconds")
	t.eq(r.phase, 1, "opens in phase 1")
	t.eq(r.multiplier, 1, "no multiplier yet")
	t.near(r.chaos, 0.0, 0.001, "city starts clean")
	t.eq(r.capacity_left(), TrashCatalog.CAPACITY_MAX, "full capacity available")


static func _test_pickup_and_combo(t: TestSupport) -> void:
	t.suite("combo ladder")
	var r := RoundRules.new()
	r.start()
	# Two pickups stay at x1, the third reaches x2 (spec: 3 items -> x2).
	_collect(r, 2)
	t.eq(r.multiplier, 1, "x1 below three pickups")
	_collect(r, 1)
	t.eq(r.multiplier, 2, "x2 at three pickups")
	_collect(r, 3)
	t.eq(r.multiplier, 3, "x3 at six pickups")
	_collect(r, 4)
	t.eq(r.multiplier, 4, "x4 at ten pickups")
	_collect(r, 5)
	t.eq(r.multiplier, 5, "x5 at fifteen pickups, carried across a delivery")
	t.eq(r.stat_best_combo, 15, "best combo tracked")

	# Points ride on the multiplier that was active at pickup time.
	var r2 := RoundRules.new()
	r2.start()
	t.eq(r2.on_pickup(_kind(&"can")), 20, "can is worth 20 at x1")
	r2.on_pickup(_kind(&"paper"))
	t.eq(r2.on_pickup(_kind(&"can")), 40, "can is worth 40 at x2")

	t.suite("combo lapse")
	var r3 := RoundRules.new()
	r3.start()
	for i in range(3):
		r3.on_pickup(_kind(&"paper"))
	t.eq(r3.multiplier, 2, "combo built")
	r3.tick(RoundRules.COMBO_WINDOW - 0.5, 0.0)
	t.eq(r3.multiplier, 2, "combo holds inside the window")
	r3.tick(1.0, 0.0)
	t.eq(r3.multiplier, 1, "combo lapses after the window")
	t.eq(r3.combo_count, 0, "combo counter reset")


static func _test_banking(t: TestSupport) -> void:
	t.suite("banking")
	var r := RoundRules.new()
	r.start()
	r.time_left = 20.0
	var staked := 0
	for i in range(3):
		staked += r.on_pickup(_kind(&"can"))
	t.eq(r.pending_score, staked, "pending points accumulate")
	t.eq(r.score, 0, "nothing banked yet")
	t.eq(r.carried_capacity, 3, "three single-capacity cans")

	var before := r.time_left
	var gained := r.on_bank()
	t.eq(r.score, gained, "bank credits the round score")
	t.eq(r.pending_score, 0, "pending pool cleared")
	t.eq(r.carried_items, 0, "slime emptied")
	t.eq(r.stat_deliveries, 1, "delivery counted")
	# 3 capacity * 0.8s, no full-load bonus at 3/20.
	t.near(r.time_left - before, 2.4, 0.001, "0.8 seconds per capacity unit")

	t.suite("full load bonus")
	var r2 := RoundRules.new()
	r2.start()
	r2.time_left = 10.0
	# Fill exactly to the cap with single-capacity litter.
	for i in range(TrashCatalog.CAPACITY_MAX):
		r2.on_pickup(_kind(&"can"))
	t.check(r2.is_full(), "slime reports full at the capacity cap")
	t.eq(r2.capacity_left(), 0, "no capacity left")
	t.eq(r2.on_pickup(_kind(&"can")), 0, "a full slime takes nothing more")
	t.eq(r2.carried_capacity, TrashCatalog.CAPACITY_MAX, "and does not overfill")
	var before2 := r2.time_left
	r2.on_bank()
	var expected := RoundRules.TIME_PER_CAPACITY_BANKED * float(TrashCatalog.CAPACITY_MAX) \
			+ RoundRules.TIME_FULL_LOAD_BONUS
	t.near(r2.time_left - before2, expected, 0.001, "full load pays per unit plus the bonus")

	t.suite("empty bank")
	var r3 := RoundRules.new()
	r3.start()
	t.eq(r3.on_bank(), 0, "banking nothing scores nothing")
	t.eq(r3.stat_deliveries, 0, "empty bank is not a delivery")


static func _test_time_ceiling(t: TestSupport) -> void:
	t.suite("time ceiling")
	var r := RoundRules.new()
	r.start()
	r.time_left = 58.0
	for i in range(TrashCatalog.CAPACITY_MAX):
		r.on_pickup(_kind(&"can"))
	r.on_bank()
	t.near(r.time_left, 60.0, 0.001, "timer never exceeds 60 seconds")
	r.add_time(100.0)
	t.near(r.time_left, 60.0, 0.001, "bonuses cannot charge the timer past the cap")


static func _test_car_hit(t: TestSupport) -> void:
	t.suite("car hit")
	var r := RoundRules.new()
	r.start()
	r.time_left = 30.0
	for i in range(4):
		r.on_pickup(_kind(&"can"))
	var pending_before := r.pending_score
	# Pickups already paid their own time bonuses, so measure the delta.
	var time_before := r.time_left
	t.eq(r.multiplier, 2, "combo up before the hit")
	r.on_hit(2, 2, 4.0)
	t.eq(r.multiplier, 1, "hit breaks the combo")
	t.eq(r.combo_count, 0, "combo counter cleared")
	t.eq(r.carried_items, 2, "half the load shaken loose")
	t.eq(r.carried_capacity, 2, "capacity freed with it")
	t.check(r.pending_score < pending_before, "pending points lost with the litter")
	t.near(time_before - r.time_left, 4.0, 0.001, "hit costs four seconds")
	t.eq(r.stat_hits, 1, "hit counted")

	# A hit cannot take more than the slime is carrying.
	var r2 := RoundRules.new()
	r2.start()
	r2.on_pickup(_kind(&"can"))
	r2.on_hit(9, 9, 1.0)
	t.eq(r2.carried_items, 0, "cannot lose more litter than carried")
	t.eq(r2.carried_capacity, 0, "capacity cannot go negative")


static func _test_chaos_meter(t: TestSupport) -> void:
	t.suite("chaos meter")
	var r := RoundRules.new()
	r.start()
	# Ground litter well past what phase 1 tolerates drives chaos up.
	var budget: float = RoundRules.CHAOS_BUDGET[0]
	for i in range(60):
		r.tick(0.1, budget * 2.5)
	t.check(r.chaos > 0.0, "a filthy street raises chaos")
	var peak := r.chaos
	# Cleaning up below the budget brings it back down.
	for i in range(60):
		r.tick(0.1, 0.0)
	t.check(r.chaos < peak, "clearing litter lowers chaos")

	var r2 := RoundRules.new()
	r2.start()
	for i in range(120):
		r2.tick(0.1, budget * 0.1)
	t.near(r2.chaos, 0.0, 0.001, "chaos never goes below zero")


static func _test_phases(t: TestSupport) -> void:
	t.suite("difficulty phases")
	var r := RoundRules.new()
	r.start()
	t.eq(r.phase, 1, "phase 1 at the start")
	r.elapsed = 65.0
	r._update_phase()
	t.eq(r.phase, 2, "phase 2 past 60 seconds")
	r.elapsed = 125.0
	r._update_phase()
	t.eq(r.phase, 3, "phase 3 past 120 seconds")
	r.elapsed = 200.0
	r._update_phase()
	t.eq(r.phase, 4, "phase 4 past 180 seconds")

	# The curve has to move in the right direction, and stay finite.
	var r2 := RoundRules.new()
	r2.start()
	var prev_spawn := 99.0
	var prev_traffic := -1.0
	for p in range(1, 5):
		r2.phase = p
		t.check(r2.spawn_interval_scale() < prev_spawn, "phase %d spawns faster" % p)
		t.check(r2.traffic_density() > prev_traffic, "phase %d has denser traffic" % p)
		t.check(r2.drain_rate() >= 1.0, "phase %d drains at least real time" % p)
		prev_spawn = r2.spawn_interval_scale()
		prev_traffic = r2.traffic_density()
	t.check(r2.drain_rate() < 1.5, "late drain stays playable")
	r2.phase = 1
	t.check(r2.event_interval() > 100.0, "no special events in the tutorial phase")
	r2.phase = 4
	t.between(r2.event_interval(), 10.0, 30.0, "late events fire regularly")


static func _test_game_over_paths(t: TestSupport) -> void:
	t.suite("game over")
	var r := RoundRules.new()
	r.start()
	var reasons: Array = []
	r.round_ended.connect(func(reason: StringName): reasons.append(reason))
	r.time_left = 0.5
	r.tick(1.0, 0.0)
	t.eq(r.state, RoundRules.ENDED, "round ends when the clock runs out")
	t.eq(r.end_reason, RoundRules.REASON_TIME, "reported as a time out")
	t.eq(reasons.size(), 1, "round_ended fired once")
	r.tick(1.0, 0.0)
	t.eq(reasons.size(), 1, "no further signals after the end")
	t.eq(r.on_pickup(_kind(&"can")), 0, "no scoring after the end")

	var r2 := RoundRules.new()
	r2.start()
	r2.chaos = 0.995
	r2.tick(1.0, 200.0)
	t.eq(r2.state, RoundRules.ENDED, "round ends when the city drowns in litter")
	t.eq(r2.end_reason, RoundRules.REASON_CHAOS, "reported as a chaos loss")
	t.near(r2.chaos, 1.0, 0.001, "chaos clamped at one")
