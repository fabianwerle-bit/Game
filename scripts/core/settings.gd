class_name GameSettings
extends Node

## Persisted player settings: volumes, graphics tier, control feel.
##
## Autoloaded as `Settings`. Game code goes through the static helpers rather
## than the autoload name, because an autoload is not a compile-time identifier
## outside the editor — the headless test run cannot see it. The helpers fall
## back to sensible defaults when no instance exists, so the budgets can be
## asked for from a test.

static var instance: GameSettings

signal changed

const PATH := "user://settings.cfg"

const TIER_LOW := 0
const TIER_MEDIUM := 1
const TIER_HIGH := 2

var music_volume: float = 0.7
var sfx_volume: float = 0.9
var muted: bool = false
var graphics_tier: int = TIER_HIGH
var joystick_left_handed: bool = false
var haptics: bool = true
var slime_skin: int = 0

## Set once at boot when the device is too weak for the chosen tier.
var auto_downgraded: bool = false


func _ready() -> void:
	instance = self
	load_settings()
	apply_audio()


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) != OK:
		return
	music_volume = clampf(cfg.get_value("audio", "music", music_volume), 0.0, 1.0)
	sfx_volume = clampf(cfg.get_value("audio", "sfx", sfx_volume), 0.0, 1.0)
	muted = bool(cfg.get_value("audio", "muted", muted))
	graphics_tier = clampi(int(cfg.get_value("video", "tier", graphics_tier)), TIER_LOW, TIER_HIGH)
	joystick_left_handed = bool(cfg.get_value("input", "left_handed", joystick_left_handed))
	haptics = bool(cfg.get_value("input", "haptics", haptics))
	slime_skin = int(cfg.get_value("player", "skin", slime_skin))


func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("audio", "music", music_volume)
	cfg.set_value("audio", "sfx", sfx_volume)
	cfg.set_value("audio", "muted", muted)
	cfg.set_value("video", "tier", graphics_tier)
	cfg.set_value("input", "left_handed", joystick_left_handed)
	cfg.set_value("input", "haptics", haptics)
	cfg.set_value("player", "skin", slime_skin)
	cfg.save(PATH)


func set_music_volume(value: float) -> void:
	music_volume = clampf(value, 0.0, 1.0)
	apply_audio()
	save_settings()
	changed.emit()


func set_sfx_volume(value: float) -> void:
	sfx_volume = clampf(value, 0.0, 1.0)
	apply_audio()
	save_settings()
	changed.emit()


func set_muted(value: bool) -> void:
	muted = value
	apply_audio()
	save_settings()
	changed.emit()


func set_graphics_tier(tier: int) -> void:
	graphics_tier = clampi(tier, TIER_LOW, TIER_HIGH)
	save_settings()
	changed.emit()


func apply_audio() -> void:
	_apply_bus(&"Music", music_volume)
	_apply_bus(&"SFX", sfx_volume)


func _apply_bus(bus_name: StringName, volume: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx < 0:
		return
	AudioServer.set_bus_mute(idx, muted or volume <= 0.001)
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(volume, 0.0001)))


## Caps used by the world streamer so a weak phone gets a smaller, but still
## complete, city rather than a stuttering one.
func set_skin(index: int) -> void:
	slime_skin = index
	save_settings()
	changed.emit()


static func skin() -> int:
	return instance.slime_skin if instance != null else 0


static func tier() -> int:
	return instance.graphics_tier if instance != null else TIER_HIGH


static func crowd_budget() -> int:
	return [14, 24, 34][tier()]


static func traffic_budget() -> int:
	return [8, 13, 18][tier()]


static func shadows_enabled() -> bool:
	return tier() >= TIER_MEDIUM


static func particle_scale() -> float:
	return [0.45, 0.75, 1.0][tier()]


static func draw_distance() -> float:
	return [95.0, 140.0, 190.0][tier()]
