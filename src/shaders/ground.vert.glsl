varying vec2 vWorldPos;

void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
