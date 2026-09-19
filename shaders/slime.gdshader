shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// Gel body for the slime.
//
// Reads as a soft translucent blob rather than a plastic ball: light carries
// through the thin edges, the surface keeps a wet highlight, and a travelling
// ripple runs over it while the body is wobbling. Depth is faked with a
// fresnel-weighted interior tint, which is far cheaper on a phone than real
// refraction and holds up at the distance the chase camera sits at.

uniform vec3 base_colour : source_color = vec3(0.24, 0.86, 0.34);
uniform vec3 deep_colour : source_color = vec3(0.05, 0.33, 0.14);
uniform vec3 rim_colour : source_color = vec3(0.62, 1.0, 0.58);
uniform float opacity : hint_range(0.0, 1.0) = 0.88;

uniform float roughness_value : hint_range(0.0, 1.0) = 0.12;
uniform float rim_power : hint_range(0.5, 8.0) = 2.6;
uniform float rim_strength : hint_range(0.0, 3.0) = 1.35;

// Fed from SlimeMotion.wobble(): scales the surface ripple.
uniform float wobble : hint_range(0.0, 1.0) = 0.0;
uniform float wobble_scale = 5.5;
uniform float wobble_speed = 7.0;

// Thin bright band where the body meets the ground, so it reads as wet.
uniform float sheen_height : hint_range(0.0, 1.0) = 0.35;

// Global fade used when the camera has to come very close.
uniform float fade : hint_range(0.0, 1.0) = 1.0;

varying float v_ripple;

void vertex() {
	// Two crossed sine waves travelling over the surface. Amplitude is tied to
	// the wobble so a resting slime is perfectly smooth.
	float phase = TIME * wobble_speed;
	float ripple =
		sin(VERTEX.y * wobble_scale + phase) *
		cos(VERTEX.x * wobble_scale * 0.8 - phase * 0.7);
	v_ripple = ripple;
	VERTEX += NORMAL * ripple * 0.035 * wobble;
}

void fragment() {
	float ndv = clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
	float fresnel = pow(1.0 - ndv, rim_power);

	// Looking straight through the body shows the darker interior; grazing
	// angles pick up the bright rim. That difference is what sells thickness.
	vec3 interior = mix(deep_colour, base_colour, ndv);
	vec3 colour = mix(interior, rim_colour, fresnel * rim_strength * 0.5);

	// Wet band around the bottom of the body.
	float sheen = smoothstep(sheen_height, sheen_height - 0.22, UV.y);
	colour += vec3(0.16, 0.22, 0.16) * sheen * 0.5;

	// The ripple brightens the crests slightly, so the wobble is visible even
	// on a flat-lit surface.
	colour += vec3(0.06, 0.12, 0.06) * v_ripple * wobble;

	ALBEDO = colour;
	ROUGHNESS = mix(roughness_value, roughness_value * 2.2, sheen);
	METALLIC = 0.0;
	SPECULAR = 0.65;

	// Thin at the edges, solid through the middle.
	float edge_alpha = mix(opacity, 1.0, fresnel * 0.6);
	ALPHA = clamp(edge_alpha * fade, 0.0, 1.0);

	// A little light bleeding through keeps it from looking like painted glass.
	BACKLIGHT = vec3(0.25, 0.45, 0.28) * (1.0 - ndv);
	RIM = 0.4;
	RIM_TINT = 0.5;
}
