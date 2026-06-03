uniform float uTime;
uniform float uHoleSize;
uniform vec3 uRimColor;
uniform vec3 uRimColor2;
uniform float uAbsorbFlash;

varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718

// Simplex noise-like hash
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = vUv - 0.5;
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);

  // Discard pixels outside the circle
  if (dist > 0.5) discard;

  // ─── Inner void (deep purple gradient) ───
  vec3 voidDark = vec3(0.051, 0.0, 0.082);   // #0D0015
  vec3 voidMid = vec3(0.102, 0.0, 0.188);     // #1A0030
  vec3 voidColor = mix(voidDark, voidMid, smoothstep(0.0, 0.35, dist));

  // ─── Swirling vortex ───
  float spiralAngle = angle + dist * 8.0 - uTime * 2.0;
  float spiral = sin(spiralAngle * 3.0) * 0.5 + 0.5;
  spiral *= smoothstep(0.35, 0.1, dist); // fade in center region
  
  // Noise-based turbulence in the vortex
  float turbulence = noise(vec2(angle * 2.0 + uTime * 0.5, dist * 6.0 - uTime)) * 0.3;
  spiral += turbulence * smoothstep(0.4, 0.1, dist);

  vec3 spiralColor = mix(voidMid, uRimColor * 0.3, spiral * 0.6);
  vec3 color = mix(voidColor, spiralColor, smoothstep(0.05, 0.3, dist));

  // ─── Event horizon rim ───
  float rimWidth = 0.08;
  float rimStart = 0.5 - rimWidth;
  float rim = smoothstep(rimStart - 0.02, rimStart + 0.02, dist) * smoothstep(0.5, 0.48, dist);
  
  // Animated pulsing rim
  float pulse = sin(uTime * 3.0) * 0.3 + 0.7;
  
  // Hue rotation between rim colors
  float hueT = sin(uTime * 0.8) * 0.5 + 0.5;
  vec3 rimColor = mix(uRimColor, uRimColor2, hueT);
  
  color = mix(color, rimColor * (1.5 + pulse * 0.5), rim);

  // ─── Gravitational distortion glow ───
  float outerGlow = smoothstep(0.5, 0.35, dist) * smoothstep(0.25, 0.42, dist);
  color += rimColor * outerGlow * 0.15 * pulse;

  // ─── Sparkle particles on rim ───
  float sparkleAngle = angle + uTime * 1.5;
  float sparkle = pow(max(0.0, sin(sparkleAngle * 8.0)), 20.0);
  sparkle *= smoothstep(0.42, 0.46, dist) * smoothstep(0.5, 0.47, dist);
  color += vec3(1.0) * sparkle * 0.8;

  // ─── Absorption flash ───
  if (uAbsorbFlash > 0.01) {
    float flashRing = smoothstep(0.3, 0.35, dist) * smoothstep(0.5, 0.45, dist);
    color += vec3(1.0) * flashRing * uAbsorbFlash * 2.0;
  }

  // ─── Alpha ───
  float alpha = smoothstep(0.5, 0.47, dist);
  // Add soft outer glow
  float glow = smoothstep(0.5, 0.38, dist) * 0.4;
  alpha = max(alpha, glow);

  gl_FragColor = vec4(color, alpha);
}
