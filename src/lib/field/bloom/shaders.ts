/**
 * Vertex + fragment shader for the bloom's filament ribbons (SPEC §3.9).
 *
 * One ribbon per active filament. Geometry is a triangle strip of
 * 2 × RIBBON_SAMPLES vertices, with per-vertex attributes `aT`
 * (path parameter 0..1) and `aSide` (-1 left edge, +1 right edge).
 * Bezier control points + animation phase + cooling state come in via
 * uniforms — same shape can be reused for every filament; we just bind
 * different uniforms per draw call.
 *
 * The geometry is shared across all ribbons (built once, dimensioned by
 * RIBBON_SAMPLES), so creating a new filament is "instantiate Mesh,
 * point at shared geometry, give it a fresh ShaderMaterial uniforms
 * block."
 */

export const ribbonVertexShader = /* glsl */ `
	attribute float aT;
	attribute float aSide;

	uniform vec2 uP0;
	uniform vec2 uP1;
	uniform vec2 uP2;
	uniform vec2 uP3;
	uniform float uHalfWidth;
	uniform float uTwistFreq;
	uniform float uTwistAmp;
	uniform float uPhase;
	uniform float uExtent;

	varying float vT;
	varying float vSide;
	varying float vAlive;

	vec2 bezier(float t) {
		float mt = 1.0 - t;
		float mt2 = mt * mt;
		float mt3 = mt2 * mt;
		float t2 = t * t;
		float t3 = t2 * t;
		return mt3 * uP0 + 3.0 * mt2 * t * uP1 + 3.0 * mt * t2 * uP2 + t3 * uP3;
	}

	vec2 bezierTangent(float t) {
		float mt = 1.0 - t;
		return 3.0 * mt * mt * (uP1 - uP0) + 6.0 * mt * t * (uP2 - uP1) + 3.0 * t * t * (uP3 - uP2);
	}

	void main() {
		vT = aT;
		vSide = aSide;
		vAlive = step(aT, uExtent + 0.001);

		vec2 pos = bezier(aT);
		vec2 tan = bezierTangent(aT);
		float len = length(tan);
		vec2 nrm = len > 1e-6 ? vec2(-tan.y, tan.x) / len : vec2(0.0, 1.0);

		// Helical-style 2D wobble of the centerline.
		float wobble = sin(aT * uTwistFreq * 6.2831853 + uPhase) * uTwistAmp;
		pos += nrm * wobble;

		// Ribbon edge offset.
		pos += nrm * (uHalfWidth * aSide);

		gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
	}
`;

export const ribbonFragmentShader = /* glsl */ `
	precision highp float;

	uniform float uFront;
	uniform float uCooling;
	uniform float uBrightness;
	uniform float uExtent;
	uniform float uCleanCool;
	uniform float uNoiseFloor;
	uniform float uNoiseAmpMax;
	uniform float uTime;

	varying float vT;
	varying float vSide;
	varying float vAlive;

	const vec3 C_WHITE = vec3(1.0, 0.95, 0.9);
	const vec3 C_CYAN  = vec3(0.55, 0.92, 1.0);
	const vec3 C_AMBER = vec3(1.0, 0.65, 0.25);
	const vec3 C_RED   = vec3(0.55, 0.1, 0.05);

	vec3 plasmaColor(float c) {
		if (c < 0.25) {
			return mix(C_WHITE, C_CYAN, c / 0.25);
		} else if (c < 0.6) {
			return mix(C_CYAN, C_AMBER, (c - 0.25) / 0.35);
		}
		return mix(C_AMBER, C_RED, (c - 0.6) / 0.4);
	}

	float hash(vec2 p) {
		return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
	}

	void main() {
		if (vAlive < 0.5) discard;

		// Moving front: bright cyan-white maximum that travels along the
		// path during eruption. Width tightens at higher resolution-times
		// so the leading edge reads as a sharp plasma front.
		float frontDist = vT - uFront;
		float front = exp(-frontDist * frontDist * 200.0);

		// Edge alpha — ribbon has soft polygon-edge falloff so the strip
		// reads as a glowing tube rather than a flat band.
		float edge = 1.0 - vSide * vSide;
		edge = pow(edge, 0.7);

		// Base plasma colour from the cooling phase.
		vec3 base = plasmaColor(uCooling);

		// Front pushes colour toward white-cyan during eruption (when
		// cooling is still 0).
		vec3 hotPush = mix(C_WHITE, C_CYAN, 0.35);
		vec3 color = mix(base, hotPush, front * (1.0 - uCooling) * 0.85);

		// Honesty noise — low signal (cleanCool near 0) makes the plasma
		// flicker; high signal (cleanCool near 1) makes it steady.
		float noiseAmp = mix(uNoiseAmpMax, uNoiseFloor, uCleanCool);
		float n = hash(vec2(vT * 64.0, floor(uTime * 30.0)));
		float flicker = 1.0 + (n - 0.5) * 2.0 * noiseAmp;

		float brightness = uBrightness * (0.7 + 0.6 * front) * flicker;

		float alpha = edge * brightness;
		gl_FragColor = vec4(color * brightness, alpha);
	}
`;
