extends RefCounted

## Loads every script in the project and fails on any that does not compile.
##
## Without this, a broken script only shows up when something happens to touch
## it at runtime — which, for a scene the tests never build, can be never.

const ROOTS := ["res://scripts", "res://tests", "res://shaders"]


static func run(t: TestSupport) -> void:
	t.suite("compiles")
	var scripts: Array[String] = []
	var shaders: Array[String] = []
	for root: String in ROOTS:
		_collect(root, scripts, shaders)

	t.check(scripts.size() >= 12, "found the project's scripts (%d)" % scripts.size())
	for path: String in scripts:
		var res := load(path)
		if res == null:
			t.check(false, "script does not compile: %s" % path)
			continue
		var gd := res as GDScript
		if gd == null:
			t.check(false, "not a GDScript: %s" % path)
			continue
		if not gd.can_instantiate() and not path.ends_with("run_tests.gd"):
			t.check(false, "script cannot be instantiated: %s" % path)
	t.check(true, "every script compiles")

	t.check(shaders.size() >= 1, "found the project's shaders (%d)" % shaders.size())
	for path: String in shaders:
		var shader := load(path) as Shader
		if shader == null:
			t.check(false, "shader does not compile: %s" % path)
			continue
		var code := shader.code
		t.check(code.contains("shader_type"), "%s declares a shader type" % path.get_file())
	t.check(true, "every shader loads")


static func _collect(dir_path: String, scripts: Array[String], shaders: Array[String]) -> void:
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return
	dir.list_dir_begin()
	var entry := dir.get_next()
	while entry != "":
		if entry.begins_with("."):
			entry = dir.get_next()
			continue
		var full := "%s/%s" % [dir_path, entry]
		if dir.current_is_dir():
			_collect(full, scripts, shaders)
		elif entry.ends_with(".gd"):
			scripts.append(full)
		elif entry.ends_with(".gdshader"):
			shaders.append(full)
		entry = dir.get_next()
	dir.list_dir_end()
