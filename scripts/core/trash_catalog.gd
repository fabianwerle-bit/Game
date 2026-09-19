class_name TrashCatalog
extends RefCounted

## Static data for every kind of litter in the game.
##
## Kept free of node and scene references so the balance numbers can be
## exercised by the headless tests in `tests/`.

## One litter archetype. `capacity` is how much room it takes in the slime,
## `mass` drives the ragdoll toss when it is dropped or knocked loose.
class Kind extends RefCounted:
	var id: StringName
	var label: String
	var points: int
	var capacity: int
	var mass: float
	var chaos: float
	var model: String
	var sound: StringName
	var wind_drift: float

	func _init(p_id: StringName, p_label: String, p_points: int, p_capacity: int,
			p_mass: float, p_chaos: float, p_model: String, p_sound: StringName,
			p_wind_drift: float) -> void:
		id = p_id
		label = p_label
		points = p_points
		capacity = p_capacity
		mass = p_mass
		chaos = p_chaos
		model = p_model
		sound = p_sound
		wind_drift = p_wind_drift


## How much litter the slime can hold before it has to visit a station.
const CAPACITY_MAX := 10

static var _kinds: Dictionary = {}
static var _order: Array[StringName] = []


static func _build() -> void:
	if not _kinds.is_empty():
		return
	# id, label, points, capacity, mass, chaos, model, sound, wind_drift
	var rows := [
		[&"paper", "Papier", 10, 1, 0.05, 0.6, "paper", &"paper", 1.0],
		[&"newspaper", "Zeitung", 10, 1, 0.12, 0.7, "newspaper", &"paper", 0.85],
		[&"crisp_bag", "Chipstüte", 15, 1, 0.06, 0.8, "crisp_bag", &"plastic", 0.95],
		[&"plastic_bag", "Plastikbeutel", 15, 1, 0.07, 0.9, "plastic_bag", &"plastic", 1.0],
		[&"banana_peel", "Bananenschale", 15, 1, 0.14, 0.7, "banana_peel", &"organic", 0.2],
		[&"cup", "Kaffeebecher", 15, 1, 0.10, 0.8, "cup", &"paper", 0.6],
		[&"can", "Getränkedose", 20, 1, 0.18, 1.0, "can", &"metal", 0.45],
		[&"food_wrap", "Essensverpackung", 20, 1, 0.09, 0.9, "food_wrap", &"plastic", 0.8],
		[&"plastic_bottle", "Plastikflasche", 25, 2, 0.24, 1.1, "plastic_bottle", &"plastic", 0.4],
		[&"glass_bottle", "Glasflasche", 25, 2, 0.55, 1.1, "glass_bottle", &"glass", 0.1],
		[&"pizza_box", "Pizzakarton", 30, 2, 0.30, 1.3, "pizza_box", &"cardboard", 0.5],
		[&"box", "Karton", 30, 3, 0.65, 1.4, "box", &"cardboard", 0.25],
		[&"trash_bag", "Müllsack", 50, 4, 2.10, 2.2, "trash_bag", &"bag", 0.0],
	]
	for row: Array in rows:
		var kind := Kind.new(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8])
		_kinds[kind.id] = kind
		_order.append(kind.id)


static func get_kind(id: StringName) -> Kind:
	_build()
	return _kinds.get(id)


static func all_ids() -> Array[StringName]:
	_build()
	return _order.duplicate()


static func count() -> int:
	_build()
	return _order.size()


## Litter that a pedestrian plausibly carries and discards by hand.
static func handheld_ids() -> Array[StringName]:
	return [&"cup", &"can", &"crisp_bag", &"food_wrap", &"paper", &"newspaper",
			&"banana_peel", &"plastic_bottle"]


## Litter typical for a district, used when seeding the world and when a
## district-flavoured event fires.
static func district_ids(district: StringName) -> Array[StringName]:
	match district:
		&"beach":
			return [&"can", &"plastic_bottle", &"food_wrap", &"crisp_bag", &"cup"]
		&"harbour":
			return [&"box", &"trash_bag", &"plastic_bag", &"glass_bottle", &"newspaper"]
		&"park":
			return [&"paper", &"banana_peel", &"food_wrap", &"cup", &"crisp_bag"]
		&"suburb":
			return [&"newspaper", &"plastic_bottle", &"box", &"paper", &"plastic_bag"]
		_:
			return [&"can", &"cup", &"paper", &"pizza_box", &"plastic_bottle", &"food_wrap"]
