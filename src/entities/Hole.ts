import * as THREE from 'three';
import holeVertShader from '../shaders/hole.vert.glsl';
import holeFragShader from '../shaders/hole.frag.glsl';
import { INITIAL_PLAYER_RADIUS, MAX_HOLE_RADIUS, SKINS, getBaseSpeed, MAP_SIZE, LEVEL_THRESHOLDS } from '../utils/constants';
import { clamp } from '../utils/math';

export class Hole {
  public mesh: THREE.Mesh;
  public glowLight: THREE.PointLight;
  public material: THREE.ShaderMaterial;
  public x: number;
  public z: number;
  public radius: number;
  public targetRadius: number;
  public score = 0;
  public level = 0;
  public isAlive = true;
  public respawnTimer = 0;
  public eatenBotsCount = 0;
  public vx = 0;
  public vz = 0;
  private drag = 0.88;
  private acceleration = 2.0;
  private breathPhase = 0;
  private skinId = 'NEON';
  private absorbFlash = 0;

  constructor(scene: THREE.Scene, skinId: string = 'NEON') {
    this.x = MAP_SIZE / 2;
    this.z = MAP_SIZE / 2;
    this.radius = INITIAL_PLAYER_RADIUS;
    this.targetRadius = INITIAL_PLAYER_RADIUS;
    this.skinId = skinId;
    const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
    const p = this.hex(skin.primary);
    const s2 = this.hex(skin.secondary);

    this.material = new THREE.ShaderMaterial({
      vertexShader: holeVertShader,
      fragmentShader: holeFragShader,
      uniforms: {
        uTime: { value: 0 },
        uHoleSize: { value: this.radius },
        uRimColor: { value: new THREE.Vector3(p.r, p.g, p.b) },
        uRimColor2: { value: new THREE.Vector3(s2.r, s2.g, s2.b) },
        uAbsorbFlash: { value: 0 },
      },
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });

    const geo = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(this.x, 0.5, this.z);
    this.mesh.scale.set(this.radius * 2.5, this.radius * 2.5, 1);
    scene.add(this.mesh);

    this.glowLight = new THREE.PointLight(new THREE.Color(skin.primary).getHex(), 1.0, this.radius * 4);
    this.glowLight.position.set(this.x, 10, this.z);
    scene.add(this.glowLight);
  }

  reset(skinId: string): void {
    this.x = MAP_SIZE / 2; this.z = MAP_SIZE / 2;
    this.radius = INITIAL_PLAYER_RADIUS; this.targetRadius = INITIAL_PLAYER_RADIUS;
    this.score = 0; this.level = 0; this.isAlive = true; this.respawnTimer = 0;
    this.eatenBotsCount = 0; this.vx = 0; this.vz = 0; this.absorbFlash = 0;
    this.skinId = skinId;
    const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
    const p = this.hex(skin.primary); const s2 = this.hex(skin.secondary);
    this.material.uniforms.uRimColor.value.set(p.r, p.g, p.b);
    this.material.uniforms.uRimColor2.value.set(s2.r, s2.g, s2.b);
    this.glowLight.color.set(skin.primary);
  }

  update(dt: number, inputDx: number, inputDy: number, time: number, speedBoost: boolean): void {
    if (!this.isAlive) {
      this.respawnTimer -= dt * 1000;
      this.mesh.visible = false; this.glowLight.visible = false;
      return;
    }
    this.mesh.visible = true; this.glowLight.visible = true;
    let speed = getBaseSpeed(this.radius);
    if (speedBoost) speed *= 1.6;
    this.vx += inputDx * speed * this.acceleration * dt;
    this.vz += inputDy * speed * this.acceleration * dt;
    this.vx *= this.drag; this.vz *= this.drag;
    this.x += this.vx; this.z += this.vz;
    this.x = clamp(this.x, this.radius, MAP_SIZE - this.radius);
    this.z = clamp(this.z, this.radius, MAP_SIZE - this.radius);
    if (this.radius < this.targetRadius) this.radius = Math.min(this.targetRadius, this.radius + 0.38);
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.score >= LEVEL_THRESHOLDS[i]) { this.level = i; break; }
    }
    const velMag = Math.hypot(this.vx, this.vz);
    const sqX = 1 + Math.min(velMag * 0.005, 0.08);
    const sqZ = 1 - Math.min(velMag * 0.003, 0.05);
    this.breathPhase += dt * Math.PI;
    const breath = 1 + Math.sin(this.breathPhase) * 0.03;
    const sc = this.radius * 2.5 * breath;
    this.mesh.position.set(this.x, 0.5, this.z);
    this.mesh.scale.set(sc * sqX, sc * sqZ, 1);
    this.glowLight.position.set(this.x, 10, this.z);
    this.glowLight.intensity = 0.5 + this.radius * 0.01;
    this.glowLight.distance = this.radius * 4;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uHoleSize.value = this.radius;
    if (this.absorbFlash > 0) {
      this.absorbFlash = Math.max(0, this.absorbFlash - dt * 5);
      this.material.uniforms.uAbsorbFlash.value = this.absorbFlash;
    }
  }

  triggerAbsorbFlash(): void { this.absorbFlash = 1.0; this.material.uniforms.uAbsorbFlash.value = 1.0; }
  addScore(points: number, growth: number): void { this.score += points; this.targetRadius = Math.min(MAX_HOLE_RADIUS, this.targetRadius + growth); }
  kill(): void { this.isAlive = false; this.respawnTimer = 3500; }
  respawn(x: number, z: number): void { this.x = x; this.z = z; this.isAlive = true; this.radius = INITIAL_PLAYER_RADIUS; this.targetRadius = INITIAL_PLAYER_RADIUS; this.vx = 0; this.vz = 0; }
  getRimColor(): string { return (SKINS.find(s => s.id === this.skinId) || SKINS[0]).primary; }
  private hex(h: string) { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); if (!r) return { r: 1, g: 1, b: 1 }; return { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 }; }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); }
}
