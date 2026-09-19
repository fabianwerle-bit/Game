extends SceneTree

## Headless test entry point.
##
##   godot --headless --path . --script tests/run_tests.gd
##
## Exits non-zero when anything fails so build scripts can gate on it.

const SUITES := [
	"res://tests/test_round_rules.gd",
]


func _init() -> void:
	var t := TestSupport.new()
	for path: String in SUITES:
		if not ResourceLoader.exists(path):
			t.failures.append("suite missing: %s" % path)
			continue
		var script: GDScript = load(path)
		if script == null:
			t.failures.append("suite failed to parse: %s" % path)
			continue
		script.new().run(t)

	print("")
	if t.failures.is_empty():
		print("PASS  %d checks across %d suites" % [t.passed, SUITES.size()])
		quit(0)
	else:
		print("FAIL  %d passed, %d failed" % [t.passed, t.failures.size()])
		for failure: String in t.failures:
			print("  - ", failure)
		quit(1)
