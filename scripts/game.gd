class_name GameRoot
extends Node

## Scene root. Owns the world and drives the screens around it.
##
## There is only ever one world: the menu, the round, the pause screen and the
## summary all sit in front of the same living island, so starting a round is a
## camera move rather than a scene load.

enum State { MENU, PLAYING, PAUSED, OVER }

var state: int = State.MENU

var world: World
var hud: HUD
var menu: MainMenu
var pause_menu: PauseMenu
var game_over: GameOverScreen

var _ui_layer: CanvasLayer


func _ready() -> void:
	world = World.new()
	world.name = "World"
	add_child(world)
	world.rules.round_ended.connect(_on_round_ended)

	_ui_layer = CanvasLayer.new()
	_ui_layer.name = "UI"
	add_child(_ui_layer)

	hud = HUD.new()
	hud.name = "HUD"
	hud.setup(world)
	hud.stick_moved.connect(_on_stick_moved)
	hud.pause_pressed.connect(_pause)
	hud.visible = false
	_ui_layer.add_child(hud)

	menu = MainMenu.new()
	menu.name = "MainMenu"
	menu.setup(world)
	menu.play_pressed.connect(start_round)
	_ui_layer.add_child(menu)

	GameAudio.music(&"theme")
	# No ambience track yet: AudioDirector supports one, but there is no CC0
	# town or seaside loop in the asset set, so nothing is asked for rather
	# than warning about a missing file on every boot.


func _on_stick_moved(value: Vector2) -> void:
	if state != State.PLAYING:
		world.slime.set_input(Vector2.ZERO, world.rig.yaw)
		return
	world.slime.set_input(value, world.rig.yaw)


func _process(_delta: float) -> void:
	# Keep feeding the current stick value: the camera yaw changes every frame,
	# and a held push has to keep meaning the same world direction.
	if state == State.PLAYING and hud.joystick != null:
		world.slime.set_input(hud.joystick.value, world.rig.yaw)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause_round"):
		if state == State.PLAYING:
			_pause()
		elif state == State.PAUSED:
			_resume()
		get_viewport().set_input_as_handled()


func start_round() -> void:
	menu.visible = false
	hud.visible = true
	state = State.PLAYING
	world.start_round()


func _pause() -> void:
	if state != State.PLAYING:
		return
	state = State.PAUSED
	get_tree().paused = true
	GameAudio.ui(&"tap")

	pause_menu = PauseMenu.new()
	pause_menu.name = "PauseMenu"
	pause_menu.setup(world)
	pause_menu.process_mode = Node.PROCESS_MODE_ALWAYS
	pause_menu.resumed.connect(_resume)
	pause_menu.quit_to_menu.connect(_abandon_round)
	_ui_layer.add_child(pause_menu)


func _resume() -> void:
	if state != State.PAUSED:
		return
	state = State.PLAYING
	get_tree().paused = false
	if pause_menu != null:
		pause_menu.queue_free()
		pause_menu = null


func _abandon_round() -> void:
	get_tree().paused = false
	if pause_menu != null:
		pause_menu.queue_free()
		pause_menu = null
	_return_to_menu()


func _on_round_ended(_reason: StringName) -> void:
	state = State.OVER
	hud.visible = false
	world.slime.set_input(Vector2.ZERO, world.rig.yaw)
	GameAudio.sfx(&"finish", world.slime.global_position)

	var was_record := false
	if GameProfile.instance != null:
		was_record = GameProfile.instance.submit_round(world.rules)
	if was_record:
		GameAudio.ui(&"record")

	game_over = GameOverScreen.new()
	game_over.name = "GameOver"
	game_over.setup(world.rules, was_record)
	game_over.restart_pressed.connect(_restart)
	game_over.menu_pressed.connect(_return_to_menu)
	_ui_layer.add_child(game_over)


func _restart() -> void:
	if game_over != null:
		game_over.queue_free()
		game_over = null
	start_round()


func _return_to_menu() -> void:
	if game_over != null:
		game_over.queue_free()
		game_over = null
	state = State.MENU
	hud.visible = false
	menu.visible = true
	menu._page = MainMenu.Page.ROOT
	menu._build()
	world.enter_attract_mode()
