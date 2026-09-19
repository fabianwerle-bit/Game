extends Node

## Persistent progress and scene flow. Autoloaded as `Game`.

signal record_changed(best_score: int)

const PATH := "user://profile.cfg"

const SCENE_MENU := "res://scenes/main_menu.tscn"
const SCENE_GAME := "res://scenes/game.tscn"

var best_score: int = 0
var best_time: float = 0.0
var total_trash: int = 0
var rounds_played: int = 0

## Filled in when a round ends so the game-over screen can read it.
var last_score: int = 0
var last_time: float = 0.0
var last_trash: int = 0
var last_combo: int = 0
var last_multiplier: int = 1
var last_deliveries: int = 0
var last_reason: StringName = &""
var last_was_record: bool = false


func _ready() -> void:
	load_profile()


func load_profile() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) != OK:
		return
	best_score = int(cfg.get_value("record", "score", 0))
	best_time = float(cfg.get_value("record", "time", 0.0))
	total_trash = int(cfg.get_value("career", "trash", 0))
	rounds_played = int(cfg.get_value("career", "rounds", 0))


func save_profile() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("record", "score", best_score)
	cfg.set_value("record", "time", best_time)
	cfg.set_value("career", "trash", total_trash)
	cfg.set_value("career", "rounds", rounds_played)
	cfg.save(PATH)


## Record the finished round. Returns true when it beat the stored record.
func submit_round(rules: RoundRules) -> bool:
	last_score = rules.score
	last_time = rules.elapsed
	last_trash = rules.stat_collected
	last_combo = rules.stat_best_combo
	last_multiplier = rules.stat_best_multiplier
	last_deliveries = rules.stat_deliveries
	last_reason = rules.end_reason

	rounds_played += 1
	total_trash += rules.stat_collected
	best_time = maxf(best_time, rules.elapsed)

	last_was_record = rules.score > best_score
	if last_was_record:
		best_score = rules.score
		record_changed.emit(best_score)
	save_profile()
	return last_was_record


func reason_text(reason: StringName) -> String:
	match reason:
		RoundRules.REASON_CHAOS:
			return "Die Stadt ist im Müll versunken"
		RoundRules.REASON_TIME:
			return "Die Zeit ist abgelaufen"
		_:
			return "Runde beendet"
