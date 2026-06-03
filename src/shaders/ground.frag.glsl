uniform float uTime;
uniform vec3 uGridColor;
uniform vec3 uBaseColor;
uniform vec3 uHolePos;
uniform float uHoleRadius;
uniform vec3 uHoleGlowColor;

varying vec2 vWorldPos;

void main() {
  // ─── Grid lines ───
  float gridSize = 60.0;
  vec2 grid = abs(fract(vWorldPos / gridSize - 0.5) - 0.5);
  
  // Anti-aliased grid lines using fwidth
  vec2 fw = fwidth(vWorldPos / gridSize);
  vec2 gridLine = smoothstep(fw * 1.0, vec2(0.0), grid);
  float line = max(gridLine.x, gridLine.y);
  
  // Pulsing brightness
  float pulse = sin(uTime * 2.094) * 0.2 + 0.8; // period ~3s
  line *= pulse;

  // ─── Base color + grid ───
  vec3 color = mix(uBaseColor, uGridColor, line * 0.7);
  
  // ─── Sub-grid (finer, dimmer) ───
  float subGridSize = 15.0;
  vec2 subGrid = abs(fract(vWorldPos / subGridSize - 0.5) - 0.5);
  vec2 subFw = fwidth(vWorldPos / subGridSize);
  vec2 subGridLine = smoothstep(subFw * 1.0, vec2(0.0), subGrid);
  float subLine = max(subGridLine.x, subGridLine.y);
  color += uGridColor * subLine * 0.15 * pulse;

  // ─── Hole ground glow reflection ───
  float holeDist = distance(vWorldPos, uHolePos.xz);
  float glowRadius = uHoleRadius * 4.0;
  float glowIntensity = smoothstep(glowRadius, 0.0, holeDist) * 0.25;
  glowIntensity *= (sin(uTime * 3.0) * 0.1 + 0.9); // subtle pulse
  color += uHoleGlowColor * glowIntensity;

  gl_FragColor = vec4(color, 1.0);
}
