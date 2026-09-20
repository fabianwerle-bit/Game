class_name PauseMenu
extends Control

## Pause overlay. Carries the island map, because the most useful thing to do
## while paused is work out where the open stations are.

signal resumed()
signal quit_to_menu()

var _map: IslandMap
var _world: World
var _stack: VBoxContainer
var _settings: SettingsPanel


func setup(world: World) -> void:
	_world = world


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.05, 0.04, 0.78)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	_stack = VBoxContainer.new()
	_stack.set_anchors_preset(Control.PRESET_FULL_RECT, false)
	_stack.offset_left = 60
	_stack.offset_right = -60
	_stack.offset_top = 90
	_stack.offset_bottom = -90
	_stack.add_theme_constant_override("separation", 22)
	add_child(_stack)

	_stack.add_child(UIKit.title("Pause", 68))

	_map = IslandMap.new()
	_map.custom_minimum_size = Vector2(0, 620)
	_map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	if _world != null:
		_map.island = _world.island
		_map.roads = _world.roads
	_stack.add_child(_map)

	var hint := UIKit.body(
			"Gefüllte Kreise sind geöffnete Recyclingstationen. Sie wechseln "
			+ "während der Runde.", 24)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_stack.add_child(hint)

	var resume := UIKit.button("Weiter", true)
	resume.pressed.connect(func():
		GameAudio.ui(&"tap")
		resumed.emit())
	_stack.add_child(resume)

	var settings_button := UIKit.button("Einstellungen")
	settings_button.pressed.connect(_open_settings)
	_stack.add_child(settings_button)

	var quit := UIKit.button("Runde beenden")
	quit.pressed.connect(func():
		GameAudio.ui(&"tap")
		quit_to_menu.emit())
	_stack.add_child(quit)


func _open_settings() -> void:
	GameAudio.ui(&"tap")
	if _settings != null:
		return
	_stack.visible = false
	_settings = SettingsPanel.new()
	_settings.set_anchors_preset(Control.PRESET_FULL_RECT, false)
	_settings.offset_left = 60
	_settings.offset_right = -60
	_settings.offset_top = 140
	_settings.offset_bottom = -140
	_settings.closed.connect(func():
		_settings.queue_free()
		_settings = null
		_stack.visible = true)
	add_child(_settings)


func _process(_delta: float) -> void:
	if _world == null or _map == null or not visible:
		return
	_map.show_player = true
	_map.player_position = Vector2(_world.slime.global_position.x, _world.slime.global_position.z)
	var facing := -_world.slime.global_transform.basis.z
	_map.player_heading = Vector2(facing.x, facing.z)
	_map.station_markers = _world.station_markers()
	_map.queue_redraw()
