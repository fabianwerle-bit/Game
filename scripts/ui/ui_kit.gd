class_name UIKit
extends RefCounted

## Shared look for every screen: one place to change the palette, the corner
## radius and the type scale.

const GREEN := Color(0.38, 0.88, 0.45)
const GREEN_DEEP := Color(0.10, 0.34, 0.20)
const INK := Color(0.93, 0.99, 0.95)
const MUTED := Color(0.68, 0.79, 0.73)
const PANEL := Color(0.05, 0.11, 0.10, 0.92)


static func panel_style(colour: Color = PANEL, radius: int = 28) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = colour
	box.corner_radius_top_left = radius
	box.corner_radius_top_right = radius
	box.corner_radius_bottom_left = radius
	box.corner_radius_bottom_right = radius
	box.content_margin_left = 40
	box.content_margin_right = 40
	box.content_margin_top = 34
	box.content_margin_bottom = 34
	return box


static func button(text: String, primary: bool = false) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 108)
	b.add_theme_font_size_override("font_size", 40 if primary else 34)
	b.add_theme_color_override("font_color", GREEN_DEEP if primary else INK)
	b.add_theme_color_override("font_hover_color", GREEN_DEEP if primary else GREEN)
	b.add_theme_color_override("font_pressed_color", GREEN_DEEP)

	# Secondary buttons need a solid dark plate, not a translucent tint: the
	# menu sits over a live, brightly lit 3D scene and a 9% white wash left the
	# labels unreadable.
	var normal := _button_style(GREEN if primary else Color(0.05, 0.11, 0.10, 0.82))
	var hover := _button_style(GREEN.lightened(0.12) if primary else Color(0.09, 0.19, 0.16, 0.9))
	var pressed := _button_style(GREEN.darkened(0.16) if primary else Color(0.13, 0.26, 0.21, 0.95))
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_stylebox_override("focus", hover)
	return b


static func _button_style(colour: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = colour
	box.corner_radius_top_left = 22
	box.corner_radius_top_right = 22
	box.corner_radius_bottom_left = 22
	box.corner_radius_bottom_right = 22
	box.content_margin_left = 28
	box.content_margin_right = 28
	return box


static func title(text: String, size: int = 84) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", INK)
	l.add_theme_color_override("font_outline_color", Color(0.03, 0.09, 0.07))
	l.add_theme_constant_override("outline_size", 10)
	return l


static func body(text: String, size: int = 28, colour: Color = MUTED) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", colour)
	l.add_theme_color_override("font_outline_color", Color(0.02, 0.06, 0.05, 0.85))
	l.add_theme_constant_override("outline_size", 6)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


## A label on the left and its value on the right.
##
## The value must not wrap. Left on the word-wrapping default it had no width
## of its own inside the row, so it broke to one character per line and the
## summary screen came out as a vertical column of letters.
static func row(label_text: String, value_text: String, size: int = 30) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 16)
	var left := body(label_text, size, MUTED)
	left.autowrap_mode = TextServer.AUTOWRAP_OFF
	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(left)
	var right := body(value_text, size, INK)
	right.autowrap_mode = TextServer.AUTOWRAP_OFF
	right.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	right.size_flags_horizontal = Control.SIZE_SHRINK_END
	h.add_child(right)
	return h


static func slider(value: float) -> HSlider:
	var s := HSlider.new()
	s.min_value = 0.0
	s.max_value = 1.0
	s.step = 0.05
	s.value = value
	s.custom_minimum_size = Vector2(0, 56)
	return s
