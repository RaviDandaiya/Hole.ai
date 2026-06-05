uniform float uTime;
uniform vec3 uGridColor;
uniform vec3 uBaseColor;

// Dynamic multi-hole cutouts
uniform vec3 uHolesPos[6];
uniform float uHolesRadius[6];
uniform int uHolesCount;

uniform vec3 uHoleGlowColor;

varying vec2 vWorldPos;

void main() {
  // ─── 3D Hole Cutout ───
  float activeGlow = 0.0;
  
  for (int i = 0; i < 6; i++) {
    if (i >= uHolesCount) break;
    float distToHole = distance(vWorldPos, uHolesPos[i].xz);
    if (distToHole < uHolesRadius[i]) {
      discard;
    }
    
    // Accumulate glow intensity for nearby holes
    float glowRadius = uHolesRadius[i] * 4.0;
    if (distToHole < glowRadius) {
      float factor = smoothstep(glowRadius, 0.0, distToHole) * 0.25;
      activeGlow = max(activeGlow, factor);
    }
  }

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
  activeGlow *= (sin(uTime * 3.0) * 0.1 + 0.9); // subtle pulse
  color += uHoleGlowColor * activeGlow;

  gl_FragColor = vec4(color, 1.0);
}
