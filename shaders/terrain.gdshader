shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// Island ground.
//
// Blends two PBR sets — grass inland, sand along the shore — using the vertex
// colour the mesh was built with: RGB carries a tint (rock on the headland,
// worn grey through the town), alpha carries how sandy the spot is. Blending
// albedo, normal and ORM together means the beach actually changes how the
// surface catches light, rather than just going a different colour.

uniform sampler2D grass_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_orm : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;

uniform sampler2D sand_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D sand_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D sand_orm : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;

uniform float texture_scale = 0.34;
// A second, much larger sample breaks up the obvious tiling on open ground.
uniform float macro_scale = 0.037;
uniform float macro_strength : hint_range(0.0, 1.0) = 0.35;

// Raised by the weather system when it rains.
uniform float wetness : hint_range(0.0, 1.0) = 0.0;

varying vec3 v_world;
varying vec4 v_colour;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_colour = COLOR;
}

void fragment() {
	vec2 uv = v_world.xz * texture_scale;
	vec2 macro_uv = v_world.xz * macro_scale;
	float sandiness = clamp(v_colour.a, 0.0, 1.0);

	vec3 grass_c = texture(grass_albedo, uv).rgb;
	vec3 sand_c = texture(sand_albedo, uv).rgb;
	vec3 albedo = mix(grass_c, sand_c, sandiness);

	// Large-scale variation so a wide lawn does not read as wallpaper.
	vec3 macro = mix(texture(grass_albedo, macro_uv).rgb, texture(sand_albedo, macro_uv).rgb, sandiness);
	albedo = mix(albedo, albedo * (0.5 + macro), macro_strength);

	vec3 grass_orm_s = texture(grass_orm, uv).rgb;
	vec3 sand_orm_s = texture(sand_orm, uv).rgb;
	vec3 orm = mix(grass_orm_s, sand_orm_s, sandiness);

	vec3 n = mix(texture(grass_normal, uv).rgb, texture(sand_normal, uv).rgb, sandiness);

	ALBEDO = albedo * v_colour.rgb;
	NORMAL_MAP = n;
	NORMAL_MAP_DEPTH = 0.8;
	AO = orm.r;
	AO_LIGHT_AFFECT = 0.6;
	// Wet ground is smoother and darker.
	ROUGHNESS = mix(orm.g, 0.18, wetness * 0.8);
	METALLIC = orm.b;
	ALBEDO *= mix(1.0, 0.72, wetness);
	SPECULAR = mix(0.5, 0.85, wetness);
}
