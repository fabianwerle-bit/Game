extends SceneTree

## Headless test entry point.
##
##   tools/test.sh          (or: godot --headless --path . --script tests/run_tests.gd)
##
## Exits non-zero when anything fails so build scripts can gate on it. Every
## path through here reaches `quit()`, including parse failures: a suite that
## does not compile has to report as a failure, not hang the runner.

const SUITES := [
	"res://tests/test_round_rules.gd",
	"res://tests/test_island.gd",
	"res://tests/test_slime.gd",
	"res://tests/test_props.gd",
]


func _init() -> void:
	var t := TestSupport.new()
	for path: String in SUITES:
		_run_suite(t, path)

	print("")
	if t.failures.is_empty():
		print("PASS  %d checks across %d suites" % [t.passed, SUITES.size()])
		quit(0)
	else:
		print("FAIL  %d passed, %d failed" % [t.passed, t.failures.size()])
		for failure: String in t.failures:
			print("  - ", failure)
		quit(1)


func _run_suite(t: TestSupport, path: String) -> void:
	if not ResourceLoader.exists(path):
		t.failures.append("suite missing: %s" % path)
		return
	var script: GDScript = load(path)
	if script == null or not script.can_instantiate():
		t.failures.append("suite failed to compile: %s" % path)
		return
	var suite: Object = script.new()
	if not suite.has_method("run"):
		t.failures.append("suite has no run(): %s" % path)
		return

	# A GDScript runtime error aborts the calling function but not the process,
	# so a suite can die half way through and look like it simply passed.
	# Requiring every suite to record at least one check turns that silence
	# into a failure.
	var before := t.passed + t.failures.size()
	suite.run(t)
	if t.passed + t.failures.size() == before:
		t.failures.append("suite recorded no checks (it errored out early?): %s" % path)
