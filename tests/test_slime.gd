extends RefCounted

## Movement feel, deformation and camera behaviour. These cover the parts of
## the spec that are easy to get subtly wrong and hard to notice: the control
## frame latching to the camera, growth staying smooth, the body keeping its
## volume while it squashes, and the camera never snapping.


static func run(t: TestSupport) -> void:
	_test_stick_mapping(t)
	_test_acceleration(t)
	_test_control_frame(t)
	_test_growth(t)
	_test_deformation(t)
	_test_wet_surface(t)
	_test_camera_follow(t)
	_test_camera_obstruction(t)


static func _drive(m: SlimeMotion, input: Vector2, yaw: float, seconds: float,
		step: float = 1.0 / 60.0) -> void:
	var steps := int(seconds / step)
	for i in range(steps):
		m.step(step, input, yaw)


static func _test_stick_mapping(t: TestSupport) -> void:
	t.suite("stick mapping")
	# With the camera looking along +X, pushing forward must move along +X.
	var fwd := SlimeMotion.stick_to_world(Vector2(0, 1), 0.0)
	t.near(fwd.x, 1.0, 0.001, "forward follows the camera bearing")
	t.near(fwd.y, 0.0, 0.001, "forward has no sideways component")

	# Pushing right must be 90 degrees clockwise of forward, matching the
	# camera's own right vector.
	var right := SlimeMotion.stick_to_world(Vector2(1, 0), 0.0)
	t.near(right.x, 0.0, 0.001, "right has no forward component")
	t.near(right.y, 1.0, 0.001, "right is the camera's right")
	t.near(fwd.dot(right), 0.0, 0.001, "forward and right are perpendicular")

	# The mapping has to rotate with the camera.
	var turned := SlimeMotion.stick_to_world(Vector2(0, 1), PI * 0.5)
	t.near(turned.x, 0.0, 0.001, "forward rotates with the camera (x)")
	t.near(turned.y, 1.0, 0.001, "forward rotates with the camera (y)")

	# Diagonals must have the same magnitude as the cardinals, so a diagonal
	# push is exactly as strong as a straight one.
	var diag := SlimeMotion.stick_to_world(Vector2(1, 1).normalized(), 0.9)
	t.near(diag.length(), 1.0, 0.001, "diagonal input keeps full magnitude")


static func _test_acceleration(t: TestSupport) -> void:
	t.suite("acceleration")
	var m := SlimeMotion.new()
	m.reset(0.0)
	t.near(m.velocity.length(), 0.0, 0.001, "starts at rest")

	_drive(m, Vector2(0, 1), 0.0, 2.0)
	t.near(m.velocity.length(), m.max_speed(), 0.05, "reaches top speed and holds it")
	t.check(m.velocity.x > 0.0, "travels along the camera bearing")
	t.near(m.velocity.y, 0.0, 0.001, "no sideways drift")
	t.near(m.heading, 0.0, 0.01, "heading matches the direction of travel")

	# Releasing the stick has to bring it to a stop, not coast forever.
	_drive(m, Vector2.ZERO, 0.0, 1.5)
	t.near(m.velocity.length(), 0.0, 0.001, "friction brings the slime to rest")

	# An over-long stick vector must not grant extra speed.
	var m2 := SlimeMotion.new()
	m2.reset(0.0)
	_drive(m2, Vector2(4, 4), 0.0, 2.0)
	t.near(m2.velocity.length(), m2.max_speed(), 0.05, "oversized input is clamped")

	# 360 degree control: every bearing has to be reachable at full speed.
	for i in range(16):
		var a := TAU * float(i) / 16.0
		var m3 := SlimeMotion.new()
		m3.reset(0.0)
		_drive(m3, Vector2(cos(a), sin(a)), 0.0, 2.0)
		if absf(m3.velocity.length() - m3.max_speed()) > 0.06:
			t.check(false, "bearing %.2f rad does not reach full speed" % a)
			return
	t.check(true, "all 16 tested bearings reach full speed")


static func _test_control_frame(t: TestSupport) -> void:
	t.suite("control frame")
	var m := SlimeMotion.new()
	m.reset(0.0)
	# A push latches the camera bearing; the camera turning mid-push must not
	# drag the slime off its line.
	_drive(m, Vector2(0, 1), 0.0, 0.5)
	var heading_before := m.heading
	_drive(m, Vector2(0, 1), PI * 0.5, 0.5)
	t.near(m.heading, heading_before, 0.02, "a turning camera does not bend a held push")
	t.near(m.control_yaw, 0.0, 0.001, "control frame stays latched while held")

	# Letting go and pushing again adopts the new camera bearing.
	_drive(m, Vector2.ZERO, PI * 0.5, 0.6)
	_drive(m, Vector2(0, 1), PI * 0.5, 0.8)
	t.near(m.control_yaw, PI * 0.5, 0.001, "a fresh push re-latches to the camera")
	t.near(m.heading, PI * 0.5, 0.05, "and the slime follows the new bearing")


static func _test_growth(t: TestSupport) -> void:
	t.suite("growth")
	var m := SlimeMotion.new()
	m.reset(0.0)
	t.near(m.radius(), SlimeMotion.RADIUS_EMPTY, 0.001, "an empty slime is at its base size")
	t.check(SlimeMotion.RADIUS_FULL < 1.4, "a full slime stays smaller than a car")
	t.check(SlimeMotion.RADIUS_FULL > SlimeMotion.RADIUS_EMPTY, "loading up makes it bigger")

	# Filling up must ease, never pop: cap the growth in any single frame.
	m.fill = 1.0
	var previous := m.radius()
	var biggest_step := 0.0
	for i in range(240):
		m.step(1.0 / 60.0, Vector2.ZERO, 0.0)
		biggest_step = maxf(biggest_step, absf(m.radius() - previous))
		previous = m.radius()
	t.check(biggest_step < 0.02, "growth is smoothed, not stepped")
	t.near(m.radius(), SlimeMotion.RADIUS_FULL, 0.01, "reaches full size eventually")
	t.near(m.max_speed(), SlimeMotion.SPEED_FULL, 0.05, "a full slime is slower")

	# Emptying at a station shrinks it back down.
	m.fill = 0.0
	for i in range(240):
		m.step(1.0 / 60.0, Vector2.ZERO, 0.0)
	t.near(m.radius(), SlimeMotion.RADIUS_EMPTY, 0.01, "banking shrinks the slime again")


static func _test_deformation(t: TestSupport) -> void:
	t.suite("deformation")
	var m := SlimeMotion.new()
	m.reset(0.0)

	# Volume is roughly preserved through every deformation state, so the body
	# squashes instead of simply inflating.
	for state: Array in [[0.3, 0.0, 0.0], [-0.3, 0.0, 0.0], [0.0, 0.3, 0.0],
			[0.0, 0.0, 0.3], [0.25, -0.2, 0.15]]:
		m.stretch = state[0]
		m.side = state[1]
		m.flatten = state[2]
		var s := m.deform_scale()
		t.near(s.x * s.y * s.z, 1.0, 0.02, "volume preserved at %s" % [state])
		t.check(s.x > 0.4 and s.y > 0.4 and s.z > 0.4, "no axis collapses at %s" % [state])

	# An impact squashes the body and then settles back.
	var m2 := SlimeMotion.new()
	m2.reset(0.0)
	m2.impact(1.0)
	m2.step(1.0 / 60.0, Vector2.ZERO, 0.0)
	t.check(m2.flatten > 0.02, "an impact visibly flattens the slime")
	t.check(m2.wobble() > 0.0, "the impact registers as wobble")
	for i in range(180):
		m2.step(1.0 / 60.0, Vector2.ZERO, 0.0)
	t.near(m2.flatten, 0.0, 0.02, "the body returns to its resting shape")
	t.near(m2.wobble(), 0.0, 0.05, "wobble dies away")

	# Accelerating from rest stretches the body along its direction of travel.
	var m3 := SlimeMotion.new()
	m3.reset(0.0)
	_drive(m3, Vector2(0, 1), 0.0, 0.12)
	t.check(m3.stretch > 0.01, "accelerating drags the body out behind")

	# Rolling must actually turn the body, and faster when it is moving faster.
	var m4 := SlimeMotion.new()
	m4.reset(0.0)
	_drive(m4, Vector2(0, 1), 0.0, 1.0)
	var roll_before := m4.roll
	_drive(m4, Vector2(0, 1), 0.0, 0.5)
	t.check(m4.roll - roll_before > 1.0, "the body rolls as it travels")


static func _test_wet_surface(t: TestSupport) -> void:
	t.suite("wet roads")
	# Rain makes the slime slide further after the stick is released.
	var dry := SlimeMotion.new()
	dry.reset(0.0)
	_drive(dry, Vector2(0, 1), 0.0, 2.0)
	dry.wet = 0.0
	_drive(dry, Vector2.ZERO, 0.0, 0.25)
	var dry_speed := dry.velocity.length()

	var wet := SlimeMotion.new()
	wet.reset(0.0)
	_drive(wet, Vector2(0, 1), 0.0, 2.0)
	wet.wet = 1.0
	_drive(wet, Vector2.ZERO, 0.0, 0.25)
	t.check(wet.velocity.length() > dry_speed, "a wet road makes the slime slide further")


static func _test_camera_follow(t: TestSupport) -> void:
	t.suite("camera follow")
	var rig := CameraRig.new()
	rig.reset(0.0)
	t.near(rig.yaw, 0.0, 0.001, "starts behind the slime")

	# The camera must sit behind the direction of travel.
	var offset := rig.boom_offset()
	t.check(offset.x < 0.0, "camera sits behind a slime heading along +X")
	t.check(offset.y > 0.0, "camera sits above the ground")
	t.between(offset.y, 0.5, CameraRig.HEIGHT_BASE + CameraRig.HEIGHT_PER_FILL + 0.5,
			"camera stays low enough to read as street level")

	# A hard reversal must be swung through, not snapped.
	var biggest := 0.0
	var previous := rig.yaw
	for i in range(240):
		rig.update(1.0 / 60.0, PI, 1.0, 0.0, 99.0)
		biggest = maxf(biggest, absf(angle_difference(previous, rig.yaw)))
		previous = rig.yaw
	t.check(biggest < deg_to_rad(CameraRig.YAW_RATE) / 55.0, "camera never snaps round")
	t.near(absf(angle_difference(rig.yaw, PI)), 0.0, 0.02, "camera does get behind eventually")

	# Shortest arc across the +/-pi wrap, rather than the long way round.
	var wrap := CameraRig.new()
	wrap.reset(deg_to_rad(179.0))
	wrap.update(1.0 / 60.0, deg_to_rad(-179.0), 1.0, 0.0, 99.0)
	t.check(absf(angle_difference(wrap.yaw, deg_to_rad(179.0))) < deg_to_rad(5.0),
			"camera takes the short way across the wrap")

	# A loaded slime is framed from slightly further back and higher.
	var loaded := CameraRig.new()
	loaded.reset(0.0, 1.0)
	var empty := CameraRig.new()
	empty.reset(0.0, 0.0)
	t.check(loaded.distance > empty.distance, "a full slime is framed from further back")
	t.check(loaded.height > empty.height, "and from slightly higher")


static func _test_camera_obstruction(t: TestSupport) -> void:
	t.suite("camera obstruction")
	var rig := CameraRig.new()
	rig.reset(0.0)
	var open := rig.distance

	# A wall behind the slime pulls the boom in quickly. The wall is placed
	# relative to the minimum boom so this keeps meaning something if the
	# camera framing is retuned.
	var wall := CameraRig.DISTANCE_MIN + 0.4
	for i in range(30):
		rig.update(1.0 / 60.0, 0.0, 0.0, 0.0, wall)
	t.check(rig.distance < open, "camera pulls in at a wall")
	t.between(rig.distance, CameraRig.DISTANCE_MIN, wall + 0.05,
			"camera stops short of the wall")
	t.check(rig.height > CameraRig.HEIGHT_BASE, "camera climbs as it closes in")

	# And eases back out once the way is clear, without a jump.
	var previous := rig.distance
	var biggest := 0.0
	for i in range(240):
		rig.update(1.0 / 60.0, 0.0, 0.0, 0.0, 99.0)
		biggest = maxf(biggest, absf(rig.distance - previous))
		previous = rig.distance
	t.check(biggest < 0.12, "the boom eases back out instead of popping")
	t.near(rig.distance, open, 0.05, "and recovers its full length")

	# Very close in, the slime fades so the camera is never inside it.
	rig.distance = CameraRig.FADE_END - 0.01
	t.near(rig.slime_alpha(), 0.0, 0.001, "slime is hidden when the camera is inside it")
	rig.distance = CameraRig.FADE_START + 0.01
	t.near(rig.slime_alpha(), 1.0, 0.001, "slime is solid at normal range")
	rig.distance = (CameraRig.FADE_START + CameraRig.FADE_END) * 0.5
	t.between(rig.slime_alpha(), 0.3, 0.7, "slime fades gradually in between")
