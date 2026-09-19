class_name Skins
extends RefCounted

## Slime appearances. Each one is a real set of shader colours, not a swatch on
## a menu: picking one changes the body the player rolls around.

class SlimeSkin extends RefCounted:
	var id: StringName
	var label: String
	var base: Color
	var deep: Color
	var rim: Color
	var opacity: float

	func _init(p_id: StringName, p_label: String, p_base: Color, p_deep: Color,
			p_rim: Color, p_opacity: float) -> void:
		id = p_id
		label = p_label
		base = p_base
		deep = p_deep
		rim = p_rim
		opacity = p_opacity


static var _all: Array[SlimeSkin] = []


static func all() -> Array[SlimeSkin]:
	if _all.is_empty():
		_all = [
			SlimeSkin.new(&"lime", "Limette", Color(0.24, 0.86, 0.34),
					Color(0.05, 0.33, 0.14), Color(0.62, 1.0, 0.58), 0.88),
			SlimeSkin.new(&"lagoon", "Lagune", Color(0.20, 0.72, 0.82),
					Color(0.04, 0.24, 0.32), Color(0.58, 0.96, 1.0), 0.86),
			SlimeSkin.new(&"bubblegum", "Kaugummi", Color(0.95, 0.46, 0.72),
					Color(0.36, 0.08, 0.22), Color(1.0, 0.76, 0.90), 0.88),
			SlimeSkin.new(&"amber", "Bernstein", Color(0.97, 0.70, 0.22),
					Color(0.38, 0.20, 0.02), Color(1.0, 0.92, 0.62), 0.84),
			SlimeSkin.new(&"midnight", "Mitternacht", Color(0.38, 0.32, 0.78),
					Color(0.08, 0.05, 0.28), Color(0.74, 0.70, 1.0), 0.90),
			SlimeSkin.new(&"frost", "Frost", Color(0.82, 0.92, 0.96),
					Color(0.32, 0.48, 0.58), Color(1.0, 1.0, 1.0), 0.72),
		]
	return _all


static func count() -> int:
	return all().size()


static func get_skin(index: int) -> SlimeSkin:
	var list := all()
	return list[clampi(index, 0, list.size() - 1)]


## Push a skin's colours into a slime shader material.
static func apply(material: ShaderMaterial, index: int) -> void:
	if material == null:
		return
	var skin := get_skin(index)
	material.set_shader_parameter("base_colour", skin.base)
	material.set_shader_parameter("deep_colour", skin.deep)
	material.set_shader_parameter("rim_colour", skin.rim)
	material.set_shader_parameter("opacity", skin.opacity)
