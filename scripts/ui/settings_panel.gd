class_name SettingsPanel
extends PanelContainer

## Volume, graphics tier and control preferences. Every control here changes a
## real setting and saves it immediately; nothing on this screen is decorative.

signal closed()

var _music: HSlider
var _sfx: HSlider
var _tier: OptionButton
var _mute: CheckButton
var _left_handed: CheckButton


func _ready() -> void:
	add_theme_stylebox_override("panel", UIKit.panel_style())
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 20)
	add_child(column)

	column.add_child(UIKit.title("Einstellungen", 56))

	column.add_child(UIKit.body("Musik", 30, UIKit.INK))
	_music = UIKit.slider(GameSettings.instance.music_volume if GameSettings.instance else 0.7)
	_music.value_changed.connect(func(v: float):
		if GameSettings.instance:
			GameSettings.instance.set_music_volume(v))
	column.add_child(_music)

	column.add_child(UIKit.body("Soundeffekte", 30, UIKit.INK))
	_sfx = UIKit.slider(GameSettings.instance.sfx_volume if GameSettings.instance else 0.9)
	_sfx.value_changed.connect(func(v: float):
		if GameSettings.instance:
			GameSettings.instance.set_sfx_volume(v))
	column.add_child(_sfx)

	_mute = CheckButton.new()
	_mute.text = "Ton aus"
	_mute.add_theme_font_size_override("font_size", 30)
	_mute.button_pressed = GameSettings.instance.muted if GameSettings.instance else false
	_mute.toggled.connect(func(on: bool):
		if GameSettings.instance:
			GameSettings.instance.set_muted(on))
	column.add_child(_mute)

	column.add_child(UIKit.body("Grafikqualität", 30, UIKit.INK))
	_tier = OptionButton.new()
	_tier.add_theme_font_size_override("font_size", 30)
	_tier.custom_minimum_size = Vector2(0, 72)
	_tier.add_item("Niedrig — kleinere Menge, keine Schatten", GameSettings.TIER_LOW)
	_tier.add_item("Mittel — Schatten an", GameSettings.TIER_MEDIUM)
	_tier.add_item("Hoch — volle Distanz, SSAO, Bloom", GameSettings.TIER_HIGH)
	_tier.selected = GameSettings.tier()
	_tier.item_selected.connect(func(index: int):
		if GameSettings.instance:
			GameSettings.instance.set_graphics_tier(index))
	column.add_child(_tier)
	column.add_child(UIKit.body(
			"Die Grafikstufe wirkt ab der nächsten Runde: sie bestimmt, wie viele "
			+ "Passanten und Fahrzeuge die Insel bevölkern.", 22))

	_left_handed = CheckButton.new()
	_left_handed.text = "Joystick für Linkshänder"
	_left_handed.add_theme_font_size_override("font_size", 30)
	_left_handed.button_pressed = (GameSettings.instance.joystick_left_handed
			if GameSettings.instance else false)
	_left_handed.toggled.connect(func(on: bool):
		if GameSettings.instance:
			GameSettings.instance.joystick_left_handed = on
			GameSettings.instance.save_settings())
	column.add_child(_left_handed)

	var back := UIKit.button("Zurück", true)
	back.pressed.connect(func():
		GameAudio.ui(&"tap")
		closed.emit())
	column.add_child(back)
