/**
 * Cell shaders — soft-disc + halo, additive blackbody-style glow, two
 * separated channels (intensity and colour-temperature). Reuses the BWI
 * Pu-238 principle (intensity and temperature scale independently); the
 * ladder here is a 3-stop perceptual gradient cold→mid→warm rather than a
 * Planckian curve. The warm endpoint matches the Stage 1/3 radial pulse.
 *
 * Stage 4 pins `aTemperature` to a constant warm baseline. Stage 5 wires
 * it from `realRevenueSignal` per cell. The shader does not change.
 */

export const vertexShader = /* glsl */ `
	attribute vec2 aPosition;
	attribute float aRadius;
	attribute float aIntensity;
	attribute float aTemperature;
	attribute float aPhase;
	attribute float aAlive;

	uniform float uTime;
	uniform float uBreatheAmp;
	uniform float uBreatheFreq;

	varying vec2 vUv;
	varying float vIntensity;
	varying float vTemperature;
	varying float vAlive;

	void main() {
		vUv = uv;
		vIntensity = aIntensity;
		vTemperature = aTemperature;
		vAlive = aAlive;

		float breathe = 1.0 + uBreatheAmp * sin(uTime * uBreatheFreq + aPhase);
		float r = aRadius * breathe;

		vec3 p = position;
		p.xy *= r;
		p.xy += aPosition;

		gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
	}
`;

export const fragmentShader = /* glsl */ `
	precision highp float;

	varying vec2 vUv;
	varying float vIntensity;
	varying float vTemperature;
	varying float vAlive;

	// Three-stop saturated gradient. Not a Planckian curve — see
	// 04-field.md Step 2 for why we don't go through orange-red.
	//   cold = vivid cyan         (#1bd0ff) — subsidy-farming, deep-ocean
	//                                          phosphorescence
	//   mid  = deep slate-purple  (#5a5180) — characterful neutral, NOT
	//                                          desaturated white (which
	//                                          washes out under additive
	//                                          blending against any glow)
	//   warm = saturated gold     (#ffb733) — real productive use
	const vec3 COLD = vec3(0.106, 0.816, 1.000);
	const vec3 MID  = vec3(0.353, 0.318, 0.502);
	const vec3 WARM = vec3(1.000, 0.718, 0.200);

	vec3 temperatureToColor(float t) {
		float tc = clamp(t, 0.0, 1.0);
		if (tc < 0.5) {
			return mix(COLD, MID, tc * 2.0);
		}
		return mix(MID, WARM, (tc - 0.5) * 2.0);
	}

	void main() {
		if (vAlive < 0.5) discard;

		vec2 centered = vUv * 2.0 - 1.0;
		float d2 = dot(centered, centered);

		// Tight Gaussian core + wide Gaussian halo. Cheap on GPU; reads
		// as a bright bioluminescent cell, not a hard disc.
		float core = exp(-d2 * 7.0);
		float halo = exp(-d2 * 1.1);
		float glow = core + halo * 0.5;

		vec3 col = temperatureToColor(vTemperature);
		float a = vIntensity * glow;

		// Additive blending in JS — alpha is ignored, RGB accumulates.
		gl_FragColor = vec4(col * a, a);
	}
`;
