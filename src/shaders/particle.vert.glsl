attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mvPosition.z);
  gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
  gl_Position = projectionMatrix * mvPosition;
}
