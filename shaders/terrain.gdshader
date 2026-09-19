shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_lambert, specular_disabled;

// Island ground, flat and bright.
//
// No photo textures: the look is toy-town, and a photoscanned lawn fights it.
// Colour comes from the vertex colour the mesh was built with - RGB is the
// ground tint, alpha is how sandy the spot is - plus a gentle large-scale
// variation so a wide lawn is not one dead flat fill.
//
// Lambert diffuse with specular off keeps the shading poster-like rather than
// glossy, which is what makes the palette read as cartoon.

uniform vec3 sand_colour : source_color = vec3(0.98, 0.88, 0.62);
uniform float variation : hint_range(0.0, 0.5) = 0.06;
uniform float variation_scale = 0.035;

// Raised by the weather system when it rains.
uniform float wetness : hint_range(0.0, 1.0) = 0.0;

varying vec3 v_world;
varying vec4 v_colour;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_colour = COLOR;
}

// Cheap value noise, enough to break up a flat field.
float wobble(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453);
	float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
	float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
	float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void fragment() {
	float sandiness = clamp(v_colour.a, 0.0, 1.0);
	vec3 base = mix(v_colour.rgb, sand_colour, sandiness);

	// Soft patches, so the ground has life without pattern or detail noise.
	float n = wobble(v_world.xz * variation_scale);
	base *= 1.0 - variation * 0.5 + n * variation;

	ALBEDO = base * mix(1.0, 0.82, wetness);
	ROUGHNESS = mix(1.0, 0.35, wetness);
	METALLIC = 0.0;
	SPECULAR = wetness * 0.6;
}
