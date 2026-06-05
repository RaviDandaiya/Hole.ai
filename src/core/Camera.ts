import * as THREE from 'three';
import { lerp, rand } from '../utils/math';

export class Camera {
  public targetX = 0;
  public targetY = 0;
  public targetZoom = 800;

  // Trauma-based screen shake
  private trauma = 0;
  private traumaDecay = 1.5;
  private maxShakeOffset = 8;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

  constructor(private camera: THREE.PerspectiveCamera) {}

  /** Set the target position for the camera to follow */
  setTarget(worldX: number, worldZ: number): void {
    this.targetX = worldX;
    this.targetY = worldZ;
  }

  /** Set target height/zoom based on hole size */
  private aspectMultiplier = 1.0;

  /** Set target height/zoom based on hole size */
  setZoom(holeRadius: number): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.aspectMultiplier = aspect < 1.0 ? Math.min(1.7, 1.0 / aspect) : 1.0;

    // Zoom out as hole grows, scaled by aspect ratio multiplier
    const minHeight = 300 * this.aspectMultiplier;
    const maxHeight = 1600 * this.aspectMultiplier;
    this.targetZoom = Math.max(minHeight, Math.min(maxHeight, (400 + holeRadius * 6.0) * this.aspectMultiplier));
  }

  /** Add trauma for screen shake (0-1 range) */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /** Get current shake offset for UI overlay */
  getShakeOffset(): { x: number; y: number } {
    return { x: this.shakeOffsetX, y: this.shakeOffsetY };
  }

  /** Update camera position each frame */
  update(dt: number): void {
    const tiltOffset = 300 * this.aspectMultiplier;

    // Smooth follow
    const lerpFactor = 0.08;
    const currentX = this.camera.position.x;
    const currentZ = this.camera.position.z - tiltOffset; // offset for perspective tilt
    const currentY = this.camera.position.y;

    const newX = lerp(currentX, this.targetX, lerpFactor);
    const newZ = lerp(currentZ, this.targetY, lerpFactor);
    const newY = lerp(currentY, this.targetZoom, 0.04);

    // Apply screen shake
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    if (this.trauma > 0.001) {
      const shake = this.trauma * this.trauma; // quadratic for more dramatic feel
      this.shakeOffsetX = rand(-1, 1) * this.maxShakeOffset * shake;
      this.shakeOffsetY = rand(-1, 1) * this.maxShakeOffset * shake;
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    }

    this.camera.position.set(
      newX + this.shakeOffsetX,
      newY,
      newZ + tiltOffset + this.shakeOffsetY // offset for tilt angle
    );
    this.camera.lookAt(newX, 0, newZ);
  }
}
