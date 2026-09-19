class_name GameAudio
extends Node

## Sound effect pool, ambience and adaptive music. Autoloaded as
## `AudioDirector`; called through the static wrappers at the bottom so game
## code compiles and runs with or without the autoload present.

static var instance: GameAudio
##
## Streams are looked up by name under `res://assets/audio/`. Anything missing is
## reported once and then silently skipped, so a missing file is visible in the
## log instead of masquerading as a working sound.

const SFX_VOICES := 16
const BANK_DIR := "res://assets/audio"

var _pool_3d: Array[AudioStreamPlayer3D] = []
var _pool_2d: Array[AudioStreamPlayer] = []
var _cache: Dictionary = {}
var _missing: Dictionary = {}

var _music: AudioStreamPlayer
var _ambience: AudioStreamPlayer
var _music_tension: float = 0.0


func _ready() -> void:
	instance = self
	process_mode = Node.PROCESS_MODE_ALWAYS
	_ensure_buses()
	for i in range(SFX_VOICES):
		var p3 := AudioStreamPlayer3D.new()
		p3.bus = &"SFX"
		p3.max_distance = 45.0
		p3.unit_size = 6.0
		add_child(p3)
		_pool_3d.append(p3)
	for i in range(6):
		var p2 := AudioStreamPlayer.new()
		p2.bus = &"SFX"
		add_child(p2)
		_pool_2d.append(p2)
	_music = AudioStreamPlayer.new()
	_music.bus = &"Music"
	add_child(_music)
	_ambience = AudioStreamPlayer.new()
	_ambience.bus = &"Music"
	add_child(_ambience)


## Creates the Music and SFX buses at runtime so the project works without a
## checked-in default_bus_layout.tres.
func _ensure_buses() -> void:
	for bus_name: StringName in [&"Music", &"SFX"]:
		if AudioServer.get_bus_index(bus_name) >= 0:
			continue
		var idx := AudioServer.bus_count
		AudioServer.add_bus(idx)
		AudioServer.set_bus_name(idx, bus_name)
		AudioServer.set_bus_send(idx, &"Master")


func _stream(sound: StringName) -> AudioStream:
	if _cache.has(sound):
		return _cache[sound]
	for ext: String in [".ogg", ".wav", ".mp3"]:
		var path := "%s/%s%s" % [BANK_DIR, sound, ext]
		if ResourceLoader.exists(path):
			var stream: AudioStream = load(path)
			_cache[sound] = stream
			return stream
	if not _missing.has(sound):
		_missing[sound] = true
		push_warning("AudioDirector: no audio file for '%s' in %s" % [sound, BANK_DIR])
	_cache[sound] = null
	return null


func play_3d(sound: StringName, position: Vector3, pitch: float = 1.0, volume_db: float = 0.0) -> void:
	var stream := _stream(sound)
	if stream == null:
		return
	for player: AudioStreamPlayer3D in _pool_3d:
		if player.playing:
			continue
		player.stream = stream
		player.global_position = position
		player.pitch_scale = pitch
		player.volume_db = volume_db
		player.play()
		return


func play_ui(sound: StringName, pitch: float = 1.0) -> void:
	var stream := _stream(sound)
	if stream == null:
		return
	for player: AudioStreamPlayer in _pool_2d:
		if player.playing:
			continue
		player.stream = stream
		player.pitch_scale = pitch
		player.play()
		return


func play_music(sound: StringName) -> void:
	var stream := _stream(sound)
	if stream == null:
		return
	if _music.stream == stream and _music.playing:
		return
	_music.stream = stream
	_music.play()


func stop_music() -> void:
	_music.stop()


func play_ambience(sound: StringName) -> void:
	var stream := _stream(sound)
	if stream == null:
		return
	if _ambience.stream == stream and _ambience.playing:
		return
	_ambience.stream = stream
	_ambience.play()


## Drives the music slightly faster and brighter as the round timer gets tight.
func set_tension(value: float) -> void:
	_music_tension = clampf(value, 0.0, 1.0)
	_music.pitch_scale = lerpf(1.0, 1.08, _music_tension)


func missing_sounds() -> Array:
	return _missing.keys()


# --- static wrappers -------------------------------------------------------
# Null-safe: with no autoload (a headless test) these do nothing rather than
# crashing the caller.

static func sfx(sound: StringName, position: Vector3, pitch: float = 1.0,
		volume_db: float = 0.0) -> void:
	if instance != null:
		instance.play_3d(sound, position, pitch, volume_db)


static func ui(sound: StringName, pitch: float = 1.0) -> void:
	if instance != null:
		instance.play_ui(sound, pitch)


static func music(sound: StringName) -> void:
	if instance != null:
		instance.play_music(sound)


static func ambience(sound: StringName) -> void:
	if instance != null:
		instance.play_ambience(sound)


static func tension(value: float) -> void:
	if instance != null:
		instance.set_tension(value)
