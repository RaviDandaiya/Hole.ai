import * as THREE from 'three';
import holeVertShader from '../shaders/hole.vert.glsl';
import holeFragShader from '../shaders/hole.frag.glsl';
import { INITIAL_PLAYER_RADIUS, MAX_HOLE_RADIUS, SKINS, getBaseSpeed, MAP_SIZE, LEVEL_THRESHOLDS } from '../utils/constants';
import { clamp } from '../utils/math';

export class Hole {
  public mesh: THREE.Mesh;
  public voidMesh: THREE.Mesh;
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
  public speedMultiplier = 1.0;
  private drag = 0.88;
  private acceleration = 2.0;
  private breathPhase = 0;
  private skinId = 'NEON';
  private absorbFlash = 0;

  private getSkin(skinId: string) {
    const skin = SKINS.find(s => s.id === skinId);
    if (skin) return skin;
    if (skinId && skinId.startsWith('#')) {
      return {
        id: skinId,
        name: 'Bot',
        desc: '',
        cost: 0,
        primary: skinId,
        secondary: '#2FF5FF'
      };
    }
    return SKINS[0];
  }

  constructor(scene: THREE.Scene, skinId: string = 'NEON') {
    this.x = MAP_SIZE / 2;
    this.z = MAP_SIZE / 2;
    this.radius = INITIAL_PLAYER_RADIUS;
    this.targetRadius = INITIAL_PLAYER_RADIUS;
    this.skinId = skinId;
    const skin = this.getSkin(skinId);
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
    this.mesh.position.set(this.x, -0.2, this.z); // recessed slightly below ground cutout
    this.mesh.scale.set(this.radius * 2.5, this.radius * 2.5, 1);
    scene.add(this.mesh);

    // Underground 3D void abyss cylinder
    const cylinderGeo = new THREE.CylinderGeometry(1, 0.75, 1, 16, 1, true);
    const colors = [];
    const positionAttr = cylinderGeo.attributes.position;
    const tempColor = new THREE.Color();
    const primaryColor = new THREE.Color(skin.primary);
    for (let i = 0; i < positionAttr.count; i++) {
      const y = positionAttr.getY(i);
      if (y > 0) tempColor.copy(primaryColor);
      else tempColor.set(0x000000);
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }
    cylinderGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const cylinderMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: true
    });
    
    this.voidMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
    this.voidMesh.position.set(this.x, -40, this.z);
    this.voidMesh.scale.set(this.radius, 80, this.radius);
    scene.add(this.voidMesh);

    this.glowLight = new THREE.PointLight(new THREE.Color(skin.primary).getHex(), 1.0, this.radius * 4);
    this.glowLight.position.set(this.x, 10, this.z);
    scene.add(this.glowLight);
  }

  reset(skinId: string): void {
    this.x = MAP_SIZE / 2; this.z = MAP_SIZE / 2;
    this.radius = INITIAL_PLAYER_RADIUS; this.targetRadius = INITIAL_PLAYER_RADIUS;
    this.score = 0; this.level = 0; this.isAlive = true; this.respawnTimer = 0;
    this.eatenBotsCount = 0; this.vx = 0; this.vz = 0; this.absorbFlash = 0;
    this.speedMultiplier = 1.0;
    this.skinId = skinId;
    const skin = this.getSkin(skinId);
    const p = this.hex(skin.primary); const s2 = this.hex(skin.secondary);
    this.material.uniforms.uRimColor.value.set(p.r, p.g, p.b);
    this.material.uniforms.uRimColor2.value.set(s2.r, s2.g, s2.b);
    this.glowLight.color.set(new THREE.Color(skin.primary));

    // Reset voidMesh position, size, and vertex colors
    this.voidMesh.position.set(this.x, -40, this.z);
    this.voidMesh.scale.set(this.radius, 80, this.radius);
    const cylinderGeo = this.voidMesh.geometry as THREE.BufferGeometry;
    const colors = [];
    const positionAttr = cylinderGeo.attributes.position;
    const tempColor = new THREE.Color();
    const primaryColor = new THREE.Color(skin.primary);
    for (let i = 0; i < positionAttr.count; i++) {
      const y = positionAttr.getY(i);
      if (y > 0) tempColor.copy(primaryColor);
      else tempColor.set(0x000000);
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }
    cylinderGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    cylinderGeo.attributes.color.needsUpdate = true;
  }

  update(dt: number, inputDx: number, inputDy: number, time: number, speedBoost: boolean): void {
    if (!this.isAlive) {
      this.respawnTimer -= dt * 1000;
      this.mesh.visible = false;
      this.voidMesh.visible = false;
      this.glowLight.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.voidMesh.visible = true;
    this.glowLight.visible = true;
    let speed = getBaseSpeed(this.radius) * this.speedMultiplier;
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
    this.mesh.position.set(this.x, -0.2, this.z); // recessed
    this.mesh.scale.set(sc * sqX, sc * sqZ, 1);
    this.voidMesh.position.set(this.x, -40, this.z);
    this.voidMesh.scale.set(this.radius, 80, this.radius);
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
  kill(): void {
    this.isAlive = false;
    this.respawnTimer = 3500;
    this.mesh.visible = false;
    this.voidMesh.visible = false;
    this.glowLight.visible = false;
  }
  respawn(x: number, z: number): void { this.x = x; this.z = z; this.isAlive = true; this.radius = INITIAL_PLAYER_RADIUS; this.targetRadius = INITIAL_PLAYER_RADIUS; this.vx = 0; this.vz = 0; }
  getRimColor(): string { return this.getSkin(this.skinId).primary; }
  private hex(h: string) { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); if (!r) return { r: 1, g: 1, b: 1 }; return { r: parseInt(r[1], 16) / 255, g: parseInt(r[2], 16) / 255, b: parseInt(r[3], 16) / 255 }; }
  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.voidMesh.geometry.dispose();
    (this.voidMesh.material as THREE.Material).dispose();
  }
}
