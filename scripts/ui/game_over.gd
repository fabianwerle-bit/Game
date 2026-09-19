class_name GameOverScreen
extends Control

## End-of-round summary. Shows why the round ended and everything worth
## bragging about, then gets the player straight back in.

signal restart_pressed()
signal menu_pressed()


func setup(rules: RoundRules, was_record: bool) -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.05, 0.04, 0.86)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT, false)
	panel.offset_left = 60
	panel.offset_right = -60
	panel.offset_top = 200
	panel.offset_bottom = -200
	panel.add_theme_stylebox_override("panel", UIKit.panel_style())
	add_child(panel)

	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 18)
	panel.add_child(column)

	column.add_child(UIKit.title("Runde vorbei", 64))

	var reason := UIKit.body(
			GameProfile.instance.reason_text(rules.end_reason) if GameProfile.instance else "",
			30, Color(0.95, 0.72, 0.55))
	reason.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(reason)

	var score := UIKit.title(str(rules.score), 96)
	score.add_theme_color_override("font_color", UIKit.GREEN)
	column.add_child(score)

	if was_record:
		var record := UIKit.body("Neuer Rekord!", 36, Color(1.0, 0.90, 0.45))
		record.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(record)
	elif GameProfile.instance != null:
		var best := UIKit.body("Rekord: %d" % GameProfile.instance.best_score, 28)
		best.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(best)

	column.add_child(HSeparator.new())
	column.add_child(UIKit.row("Überlebte Zeit", "%d:%02d"
			% [int(rules.elapsed) / 60, int(rules.elapsed) % 60]))
	column.add_child(UIKit.row("Eingesammelter Müll", "%d Teile" % rules.stat_collected))
	column.add_child(UIKit.row("Abgeliefert", "%d Teile in %d Lieferungen"
			% [rules.stat_banked_items, rules.stat_deliveries]))
	column.add_child(UIKit.row("Beste Combo", "%d Teile (x%d)"
			% [rules.stat_best_combo, rules.stat_best_multiplier]))
	column.add_child(UIKit.row("Erreichte Phase", "Phase %d" % rules.phase))
	column.add_child(UIKit.row("Treffer von Fahrzeugen", str(rules.stat_hits)))
	column.add_child(HSeparator.new())

	var again := UIKit.button("Nochmal", true)
	again.pressed.connect(func():
		GameAudio.ui(&"tap")
		restart_pressed.emit())
	column.add_child(again)

	var menu := UIKit.button("Hauptmenü")
	menu.pressed.connect(func():
		GameAudio.ui(&"tap")
		menu_pressed.emit())
	column.add_child(menu)
