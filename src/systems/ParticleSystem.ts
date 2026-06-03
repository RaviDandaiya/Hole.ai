import * as THREE from 'three';
import particleVertShader from '../shaders/particle.vert.glsl';
import particleFragShader from '../shaders/particle.frag.glsl';
import { rand } from '../utils/math';
import { isMobileDevice } from '../utils/constants';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  decay: number;
  r: number;
  g: number;
  b: number;
  active: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles: number;
  private points: THREE.Points;
  private positionAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private alphaAttr: THREE.BufferAttribute;
  private colorAttr: THREE.BufferAttribute;

  constructor(scene: THREE.Scene) {
    this.maxParticles = isMobileDevice() ? 200 : 500;

    // Pre-allocate particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        size: 1, alpha: 0, decay: 0.02,
        r: 1, g: 1, b: 1,
        active: false,
      });
    }

    // ─── GPU Buffers ───
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxParticles * 3);
    const sizes = new Float32Array(this.maxParticles);
    const alphas = new Float32Array(this.maxParticles);
    const colors = new Float32Array(this.maxParticles * 3);

    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);
    this.alphaAttr = new THREE.BufferAttribute(alphas, 1);
    this.colorAttr = new THREE.BufferAttribute(colors, 3);

    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aSize', this.sizeAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);
    geometry.setAttribute('aColor', this.colorAttr);

    const material = new THREE.ShaderMaterial({
      vertexShader: particleVertShader,
      fragmentShader: particleFragShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** Emit absorption burst particles */
  emitBurst(x: number, z: number, color: string, count: number = 20): void {
    const rgb = this.hexToRgb(color);
    for (let i = 0; i < count; i++) {
      const p = this.getInactiveParticle();
      if (!p) break;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(2, 6);
      const upSpeed = rand(1, 4);
      p.x = x;
      p.y = 2;
      p.z = z;
      p.vx = Math.cos(angle) * speed;
      p.vy = upSpeed;
      p.vz = Math.sin(angle) * speed;
      p.size = rand(3, 8);
      p.alpha = 1.0;
      p.decay = rand(0.015, 0.04);
      p.r = rgb.r;
      p.g = rgb.g;
      p.b = rgb.b;
      p.active = true;
    }
  }

  /** Emit trail particles behind moving hole */
  emitTrail(x: number, z: number, color: string): void {
    const count = rand(0, 1) > 0.4 ? 1 : 0; // ~60% chance per frame
    if (count === 0) return;
    const rgb = this.hexToRgb(color);
    const p = this.getInactiveParticle();
    if (!p) return;
    p.x = x + rand(-5, 5);
    p.y = 1;
    p.z = z + rand(-5, 5);
    p.vx = rand(-1, 1);
    p.vy = rand(0.5, 1.5);
    p.vz = rand(-1, 1);
    p.size = rand(2, 5);
    p.alpha = 0.8;
    p.decay = rand(0.02, 0.04);
    p.r = rgb.r;
    p.g = rgb.g;
    p.b = rgb.b;
    p.active = true;
  }

  /** Update all particles each frame */
  update(dt: number): void {
    const positions = this.positionAttr.array as Float32Array;
    const sizes = this.sizeAttr.array as Float32Array;
    const alphas = this.alphaAttr.array as Float32Array;
    const colors = this.colorAttr.array as Float32Array;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        alphas[i] = 0;
        continue;
      }

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vx *= 0.95;
      p.vy *= 0.96;
      p.vy -= 0.05; // gravity
      p.vz *= 0.95;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y < -5) {
        p.active = false;
        p.alpha = 0;
      }

      // Write to buffers
      const i3 = i * 3;
      positions[i3] = p.x;
      positions[i3 + 1] = Math.max(0, p.y);
      positions[i3 + 2] = p.z;
      sizes[i] = p.size;
      alphas[i] = Math.max(0, p.alpha);
      colors[i3] = p.r;
      colors[i3 + 1] = p.g;
      colors[i3 + 2] = p.b;
    }

    this.positionAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }

  private getInactiveParticle(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 1, g: 1, b: 1 };
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.ShaderMaterial).dispose();
  }
}
