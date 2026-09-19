class_name MainMenu
extends Control

## Start screen. The 3D world behind it is the real island, already running
## with its traffic and its crowd, so pressing play only has to start the
## clock.

signal play_pressed()

enum Page { ROOT, SKINS, SCORES, SETTINGS, MAP }

var _world: World
var _page: int = Page.ROOT
var _body: Control


func setup(world: World) -> void:
	_world = world


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS
	_build()


func _build() -> void:
	for child in get_children():
		child.queue_free()

	# A soft gradient so the title reads over a bright sky without hiding the
	# world behind it.
	var shade := ColorRect.new()
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.color = Color(0.02, 0.06, 0.05, 0.52 if _page == Page.ROOT else 0.78)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)

	_body = VBoxContainer.new()
	_body.set_anchors_preset(Control.PRESET_FULL_RECT, false)
	_body.offset_left = 62
	_body.offset_right = -62
	_body.offset_top = 120
	_body.offset_bottom = -120
	_body.add_theme_constant_override("separation", 20)
	add_child(_body)

	match _page:
		Page.ROOT: _build_root()
		Page.SKINS: _build_skins()
		Page.SCORES: _build_scores()
		Page.SETTINGS: _build_settings()
		Page.MAP: _build_map()


func _go(page: int) -> void:
	GameAudio.ui(&"tap")
	_page = page
	_build()


func _build_root() -> void:
	var title := UIKit.title("SLIME", 120)
	title.add_theme_color_override("font_color", UIKit.GREEN)
	_body.add_child(title)
	var subtitle := UIKit.title("CLEANUP", 96)
	_body.add_child(subtitle)

	var tagline := UIKit.body(
			"Rolle durch die Stadt, sammle den Müll ein und bring ihn zur "
			+ "Recyclingstation, bevor die Zeit abläuft.", 28)
	tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_body.add_child(tagline)

	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_child(spacer)

	if GameProfile.instance != null and GameProfile.instance.best_score > 0:
		var best := UIKit.body("Rekord: %d" % GameProfile.instance.best_score, 34, UIKit.INK)
		best.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_body.add_child(best)

	var play := UIKit.button("SPIELEN", true)
	play.pressed.connect(func():
		GameAudio.ui(&"tap")
		play_pressed.emit())
	_body.add_child(play)

	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 18)
	grid.add_theme_constant_override("v_separation", 18)
	_body.add_child(grid)
	for entry: Array in [["Skins", Page.SKINS], ["Highscore", Page.SCORES],
			["Inselkarte", Page.MAP], ["Einstellungen", Page.SETTINGS]]:
		var b := UIKit.button(entry[0])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var target: int = entry[1]
		b.pressed.connect(func(): _go(target))
		grid.add_child(b)


func _back_button() -> void:
	var back := UIKit.button("Zurück", true)
	back.pressed.connect(func(): _go(Page.ROOT))
	_body.add_child(back)


func _build_skins() -> void:
	_body.add_child(UIKit.title("Skins", 64))
	_body.add_child(UIKit.body(
			"Die Auswahl ändert den Körper sofort — schau hinter das Menü.", 24))

	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 18)
	grid.add_theme_constant_override("v_separation", 18)
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_child(grid)

	var current := GameSettings.skin()
	for i in range(Skins.count()):
		var skin: Skins.SlimeSkin = Skins.get_skin(i)
		var b := UIKit.button(skin.label, i == current)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if i != current:
			b.add_theme_color_override("font_color", skin.base)
		var index := i
		b.pressed.connect(func():
			GameAudio.ui(&"tap")
			if GameSettings.instance != null:
				GameSettings.instance.set_skin(index)
			if _world != null and _world.slime != null:
				_world.slime.apply_skin(index)
			_build())
		grid.add_child(b)
	_back_button()


func _build_scores() -> void:
	_body.add_child(UIKit.title("Highscore", 64))
	var profile := GameProfile.instance
	if profile == null or profile.rounds_played == 0:
		_body.add_child(UIKit.body("Noch keine Runde gespielt.", 30))
	else:
		_body.add_child(UIKit.row("Bester Punktestand", str(profile.best_score), 34))
		_body.add_child(UIKit.row("Längste Runde", "%d:%02d"
				% [int(profile.best_time) / 60, int(profile.best_time) % 60], 34))
		_body.add_child(UIKit.row("Müll insgesamt", "%d Teile" % profile.total_trash, 34))
		_body.add_child(UIKit.row("Gespielte Runden", str(profile.rounds_played), 34))
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_child(spacer)
	_back_button()


func _build_map() -> void:
	_body.add_child(UIKit.title("Inselkarte", 64))
	var map := IslandMap.new()
	map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	if _world != null:
		map.island = _world.island
		map.roads = _world.roads
		var markers: Array = []
		for station: RecyclingStation in _world.stations:
			markers.append({
				"position": Vector2(station.global_position.x, station.global_position.z),
				"active": station.active,
			})
		map.station_markers = markers
	_body.add_child(map)
	_body.add_child(UIKit.body(
			"Die ganze Insel ist von Anfang an befahrbar. Grüne Kreise sind "
			+ "Recyclingstationen.", 24))
	_back_button()


func _build_settings() -> void:
	var panel := SettingsPanel.new()
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.closed.connect(func(): _go(Page.ROOT))
	_body.add_child(panel)
