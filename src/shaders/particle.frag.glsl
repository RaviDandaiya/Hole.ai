varying float vAlpha;
varying vec3 vColor;

void main() {
  // Circular particle shape
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  if (dist > 0.5) discard;
  
  // Soft edge
  float alpha = smoothstep(0.5, 0.2, dist) * vAlpha;
  
  // Add glow
  vec3 color = vColor * (1.0 + smoothstep(0.5, 0.0, dist) * 0.5);
  
  gl_FragColor = vec4(color, alpha);
}
