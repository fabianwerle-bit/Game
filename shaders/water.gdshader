shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// Sea around the island.
//
// Two crossing wave trains displace the surface and drive the normal, so the
// water moves and catches the light rather than sitting there as a blue plane.
// Shallow water near the shore is lighter and more transparent.

uniform vec3 deep_colour : source_color = vec3(0.05, 0.20, 0.34);
uniform vec3 shallow_colour : source_color = vec3(0.16, 0.48, 0.58);
uniform vec3 foam_colour : source_color = vec3(0.85, 0.94, 0.96);

uniform float wave_height = 0.16;
uniform float wave_scale = 0.09;
uniform float wave_speed = 0.55;

// Raised by the weather system while it is raining.
uniform float choppiness : hint_range(0.0, 2.0) = 1.0;

varying vec3 v_world;
varying float v_crest;

float wave(vec2 p, float t) {
	float a = sin(p.x * 0.7 + t * 1.10) * 0.55;
	float b = sin(p.y * 0.9 - t * 0.85) * 0.35;
	float c = sin((p.x + p.y) * 0.45 + t * 1.40) * 0.30;
	return a + b + c;
}

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec2 p = v_world.xz * wave_scale;
	float t = TIME * wave_speed;
	float h = wave(p, t);
	v_crest = h;
	VERTEX.y += h * wave_height * choppiness;

	// Normal from the analytic wave slope, sampled either side.
	float eps = 0.35;
	float hx = wave(p + vec2(eps, 0.0), t) - wave(p - vec2(eps, 0.0), t);
	float hz = wave(p + vec2(0.0, eps), t) - wave(p - vec2(0.0, eps), t);
	NORMAL = normalize(vec3(-hx * wave_height * choppiness, 1.0, -hz * wave_height * choppiness));
}

void fragment() {
	float ndv = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
	float fresnel = pow(1.0 - ndv, 3.0);

	vec3 colour = mix(deep_colour, shallow_colour, clamp(v_crest * 0.5 + 0.5, 0.0, 1.0));
	// Foam on the wave crests.
	float foam = smoothstep(0.75, 1.15, v_crest);
	colour = mix(colour, foam_colour, foam * 0.55);

	ALBEDO = colour;
	ROUGHNESS = mix(0.04, 0.22, foam);
	METALLIC = 0.0;
	SPECULAR = 0.9;
	ALPHA = mix(0.82, 1.0, 1.0 - fresnel);
	RIM = 0.3;
}
