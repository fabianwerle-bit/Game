class_name HUD
extends Control

## Portrait head-up display.
##
## Top band carries the four things the player has to read at a glance: score,
## time, how full the slime is and how badly the city is going under. Bottom
## holds the joystick and the pause button and nothing else. Built in code so
## the layout stays in one readable place.

signal pause_pressed()
signal stick_moved(value: Vector2)

const WARN_TIME := 10.0

var joystick: Joystick

var _score_label: Label
var _best_label: Label
var _time_label: Label
var _time_bar: ProgressBar
var _capacity_bar: ProgressBar
var _capacity_label: Label
var _chaos_bar: ProgressBar
var _chaos_label: Label
var _combo_label: Label
var _toast_label: Label
var _phase_label: Label
var _weather_label: Label
var _arrow: Control

var _toast_time: float = 0.0
var _combo_scale: float = 1.0
var _warn_pulse: float = 0.0
var _last_warn_beep: float = 0.0
var _arrow_angle: float = 0.0

var _world: World


func setup(world: World) -> void:
	_world = world
	world.toast.connect(show_toast)


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_top()
	_build_bottom()
	_build_arrow()


func _panel(colour: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = colour
	box.corner_radius_top_left = 18
	box.corner_radius_top_right = 18
	box.corner_radius_bottom_left = 18
	box.corner_radius_bottom_right = 18
	box.content_margin_left = 18
	box.content_margin_right = 18
	box.content_margin_top = 12
	box.content_margin_bottom = 12
	return box


func _bar_style(fill: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.corner_radius_top_left = 9
	box.corner_radius_top_right = 9
	box.corner_radius_bottom_left = 9
	box.corner_radius_bottom_right = 9
	return box


func _make_bar(fill: Color) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.min_value = 0.0
	bar.max_value = 1.0
	bar.custom_minimum_size = Vector2(0, 18)
	bar.add_theme_stylebox_override("background", _bar_style(Color(0, 0, 0, 0.35)))
	bar.add_theme_stylebox_override("fill", _bar_style(fill))
	return bar


func _build_top() -> void:
	var panel := PanelContainer.new()
	panel.name = "TopPanel"
	panel.set_anchors_preset(Control.PRESET_TOP_WIDE)
	panel.offset_left = 24
	panel.offset_right = -24
	panel.offset_top = 28
	panel.offset_bottom = 250
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_theme_stylebox_override("panel", _panel(Color(0.05, 0.10, 0.09, 0.62)))
	add_child(panel)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 8)
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(column)

	# Score on the left, record on the right.
	var score_row := HBoxContainer.new()
	score_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(score_row)

	_score_label = Label.new()
	_score_label.text = "0"
	_score_label.add_theme_font_size_override("font_size", 64)
	_score_label.add_theme_color_override("font_color", Color(0.85, 1.0, 0.86))
	_score_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	score_row.add_child(_score_label)

	_best_label = Label.new()
	_best_label.text = "Rekord 0"
	_best_label.add_theme_font_size_override("font_size", 26)
	_best_label.add_theme_color_override("font_color", Color(0.72, 0.82, 0.76))
	_best_label.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	score_row.add_child(_best_label)

	# Timer.
	var time_row := HBoxContainer.new()
	time_row.add_theme_constant_override("separation", 12)
	time_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(time_row)

	_time_label = Label.new()
	_time_label.text = "60.0"
	_time_label.add_theme_font_size_override("font_size", 40)
	_time_label.custom_minimum_size = Vector2(130, 0)
	time_row.add_child(_time_label)

	_time_bar = _make_bar(Color(0.45, 0.90, 0.52))
	_time_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_time_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	time_row.add_child(_time_bar)

	# Capacity and chaos, the two gauges that decide the round.
	_capacity_label = Label.new()
	_capacity_label.text = "Ladung 0 / 20"
	_capacity_label.add_theme_font_size_override("font_size", 22)
	_capacity_label.add_theme_color_override("font_color", Color(0.80, 0.92, 0.84))
	column.add_child(_capacity_label)
	_capacity_bar = _make_bar(Color(0.40, 0.78, 0.95))
	column.add_child(_capacity_bar)

	_chaos_label = Label.new()
	_chaos_label.text = "Chaos"
	_chaos_label.add_theme_font_size_override("font_size", 22)
	_chaos_label.add_theme_color_override("font_color", Color(0.95, 0.82, 0.70))
	column.add_child(_chaos_label)
	_chaos_bar = _make_bar(Color(0.92, 0.55, 0.30))
	column.add_child(_chaos_bar)

	# Phase and weather, small, off to the side.
	var info_row := HBoxContainer.new()
	info_row.add_theme_constant_override("separation", 16)
	info_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(info_row)
	_phase_label = Label.new()
	_phase_label.add_theme_font_size_override("font_size", 20)
	_phase_label.add_theme_color_override("font_color", Color(0.66, 0.76, 0.72))
	info_row.add_child(_phase_label)
	_weather_label = Label.new()
	_weather_label.add_theme_font_size_override("font_size", 20)
	_weather_label.add_theme_color_override("font_color", Color(0.66, 0.76, 0.72))
	info_row.add_child(_weather_label)

	# Combo, centred under the panel where it cannot be missed.
	_combo_label = Label.new()
	_combo_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_combo_label.offset_top = 268
	_combo_label.offset_left = -300
	_combo_label.offset_right = 300
	_combo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_combo_label.add_theme_font_size_override("font_size", 46)
	_combo_label.add_theme_color_override("font_color", Color(1.0, 0.92, 0.45))
	_combo_label.add_theme_color_override("font_outline_color", Color(0.1, 0.15, 0.1))
	_combo_label.add_theme_constant_override("outline_size", 8)
	_combo_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_combo_label.pivot_offset = Vector2(300, 28)
	_combo_label.visible = false
	add_child(_combo_label)

	_toast_label = Label.new()
	_toast_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_toast_label.offset_top = 340
	_toast_label.offset_left = -360
	_toast_label.offset_right = 360
	_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast_label.add_theme_font_size_override("font_size", 34)
	_toast_label.add_theme_color_override("font_color", Color(0.92, 0.98, 0.94))
	_toast_label.add_theme_color_override("font_outline_color", Color(0.08, 0.12, 0.10))
	_toast_label.add_theme_constant_override("outline_size", 7)
	_toast_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast_label.modulate.a = 0.0
	add_child(_toast_label)


func _build_bottom() -> void:
	joystick = Joystick.new()
	joystick.name = "Joystick"
	joystick.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	joystick.offset_top = -620
	joystick.offset_bottom = 0
	joystick.moved.connect(func(v: Vector2): stick_moved.emit(v))
	add_child(joystick)

	var pause := Button.new()
	pause.name = "Pause"
	pause.text = "II"
	pause.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	pause.offset_left = -116
	pause.offset_right = -28
	pause.offset_top = 268
	pause.offset_bottom = 356
	pause.add_theme_font_size_override("font_size", 34)
	pause.pressed.connect(func(): pause_pressed.emit())
	add_child(pause)


## Arrow pointing at the nearest open station, drawn just under the top panel.
func _build_arrow() -> void:
	_arrow = Control.new()
	_arrow.name = "StationArrow"
	_arrow.set_anchors_preset(Control.PRESET_CENTER)
	_arrow.offset_top = -80
	_arrow.offset_bottom = 80
	_arrow.offset_left = -80
	_arrow.offset_right = 80
	_arrow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_arrow.draw.connect(_draw_arrow)
	add_child(_arrow)


func _draw_arrow() -> void:
	if _world == null or _world.slime == null or _world.slime.carried.is_empty():
		return
	var centre := _arrow.size * 0.5
	var points := PackedVector2Array([
		Vector2(0, -46), Vector2(28, 22), Vector2(0, 6), Vector2(-28, 22)])
	var rotated := PackedVector2Array()
	for p: Vector2 in points:
		rotated.append(centre + p.rotated(_arrow_angle))
	var urgency := clampf(_world.slime.fill_ratio(), 0.3, 1.0)
	_arrow.draw_colored_polygon(rotated, Color(0.45, 0.95, 0.55, 0.55 * urgency))


func _process(delta: float) -> void:
	if _world == null:
		return
	var rules := _world.rules
	_score_label.text = str(rules.score)
	if rules.pending_score > 0:
		_score_label.text += "  +%d" % rules.pending_score
	_best_label.text = "Rekord %d" % (GameProfile.instance.best_score if GameProfile.instance else 0)

	_time_label.text = "%.1f" % rules.time_left
	_time_bar.value = rules.time_left / RoundRules.TIME_MAX
	_update_time_warning(delta, rules)

	_capacity_bar.value = rules.fill_ratio()
	_capacity_label.text = "Ladung %d / %d" % [rules.carried_capacity, TrashCatalog.CAPACITY_MAX]
	if rules.is_full():
		_capacity_label.text += "  —  voll, abliefern!"

	_chaos_bar.value = rules.chaos
	_chaos_label.text = "Chaos %d%%  (%d Teile auf der Straße)" % [
			int(rules.chaos * 100.0), _world.litter_on_ground()]

	_phase_label.text = "Phase %d" % rules.phase
	_weather_label.text = _world.weather.label() if _world.weather else ""

	_update_combo(delta, rules)
	_update_toast(delta)
	_update_arrow()


## Under ten seconds the timer pulses red and beeps once a second.
func _update_time_warning(delta: float, rules: RoundRules) -> void:
	if not rules.is_time_critical():
		_time_label.add_theme_color_override("font_color", Color(0.92, 0.98, 0.94))
		_time_label.scale = Vector2.ONE
		_warn_pulse = 0.0
		_last_warn_beep = 0.0
		return

	_warn_pulse += delta * 7.0
	var beat := 0.5 + 0.5 * sin(_warn_pulse)
	_time_label.add_theme_color_override("font_color",
			Color(1.0, 0.35, 0.30).lerp(Color(1.0, 0.85, 0.80), beat))
	_time_label.pivot_offset = _time_label.size * 0.5
	_time_label.scale = Vector2.ONE * (1.0 + beat * 0.12)
	_time_bar.add_theme_stylebox_override("fill", _bar_style(Color(0.95, 0.30, 0.26)))

	_last_warn_beep -= delta
	if _last_warn_beep <= 0.0:
		_last_warn_beep = 1.0
		GameAudio.ui(&"warning")


func _update_combo(delta: float, rules: RoundRules) -> void:
	if rules.combo_count >= 3:
		if not _combo_label.visible:
			_combo_scale = 1.6
		_combo_label.visible = true
		_combo_label.text = "CLEAN COMBO x%d" % rules.multiplier
	else:
		_combo_label.visible = false
	_combo_scale = move_toward(_combo_scale, 1.0, delta * 2.4)
	_combo_label.scale = Vector2.ONE * _combo_scale


func show_toast(text: String) -> void:
	_toast_label.text = text
	_toast_time = 1.8


func _update_toast(delta: float) -> void:
	_toast_time = maxf(_toast_time - delta, 0.0)
	_toast_label.modulate.a = clampf(_toast_time / 0.5, 0.0, 1.0)


func _update_arrow() -> void:
	var station := _world.nearest_active_station()
	if station == null or _world.camera == null:
		return
	# Angle from where the camera is looking to where the station is.
	var to_station := station.global_position - _world.slime.global_position
	var camera_forward := -_world.camera.global_transform.basis.z
	var a := atan2(to_station.x, to_station.z)
	var b := atan2(camera_forward.x, camera_forward.z)
	_arrow_angle = wrapf(b - a, -PI, PI)
	_arrow.queue_redraw()
