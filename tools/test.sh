#!/usr/bin/env bash
# Run the unit suites and the integration smoke run.
# GODOT may point at any Godot 4.6+ binary.
#
# The import pass refreshes Godot's global class cache. Without it a newly
# added `class_name` script is invisible to the suites and every reference to
# it fails to parse.
set -euo pipefail
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"

"$GODOT" --headless --path . --import >/dev/null 2>&1 || true

echo "== unit suites =="
"$GODOT" --headless --path . --script tests/run_tests.gd

if [ "${SKIP_SMOKE:-0}" != "1" ]; then
	echo
	echo "== integration smoke run =="
	# Warnings about missing audio files are expected until the sound bank
	# lands; the run itself must still pass.
	"$GODOT" --headless --path . --script tests/smoke_run.gd 2>&1 \
		| grep -vE "AudioDirector: no audio file|push_warning|GDScript backtrace|^ *\[[0-9]\]|^ *at: " \
		|| { echo "smoke run failed"; exit 1; }
fi
