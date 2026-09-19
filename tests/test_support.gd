class_name TestSupport
extends RefCounted

## Minimal assertion helper for the headless suites in `tests/`.
## Collects failures instead of aborting so one run reports every problem.

var passed: int = 0
var failures: Array[String] = []
var _suite: String = ""


func suite(name: String) -> void:
	_suite = name


func check(condition: bool, what: String) -> void:
	if condition:
		passed += 1
	else:
		failures.append("%s: %s" % [_suite, what])


func eq(actual: Variant, expected: Variant, what: String) -> void:
	if actual == expected:
		passed += 1
	else:
		failures.append("%s: %s (expected %s, got %s)" % [_suite, what, expected, actual])


func near(actual: float, expected: float, tolerance: float, what: String) -> void:
	if absf(actual - expected) <= tolerance:
		passed += 1
	else:
		failures.append("%s: %s (expected %.4f +/- %.4f, got %.4f)"
				% [_suite, what, expected, tolerance, actual])


func between(actual: float, low: float, high: float, what: String) -> void:
	if actual >= low and actual <= high:
		passed += 1
	else:
		failures.append("%s: %s (expected %.4f..%.4f, got %.4f)"
				% [_suite, what, low, high, actual])
