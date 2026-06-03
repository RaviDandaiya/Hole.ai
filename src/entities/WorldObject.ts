import * as THREE from 'three';
import { ObjectType, Quality, detectQuality } from '../utils/constants';
import { rand, lerp } from '../utils/math';

export interface WorldObjectData {
  id: number;
  type: ObjectType;
  x: number;
  z: number;
  isEaten: boolean;
  swallowProgress: number;
  eaterX: number;
  eaterZ: number;
  vx: number;
  vz: number;
  mesh: THREE.Group;
  tiltX: number;
  tiltZ: number;
  spinSpeed: number;
  justRespawned: boolean;
}

export class WorldObjectManager {
  private objects: WorldObjectData[] = [];
  private scene: THREE.Scene;
  private quality: Quality;
  private outlineMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.quality = detectQuality();
    this.outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  }

  getObjects(): WorldObjectData[] { return this.objects; }

  populateFromShared(sharedObjs: any[], objectTypes: Record<string, ObjectType>): void {
    this.clear();
    sharedObjs.forEach(obj => {
      const type = objectTypes[obj.typeId];
      if (!type) return;
      const group = this.createMesh(type);
      group.position.set(obj.x, 0, obj.z);
      this.scene.add(group);
      
      this.objects.push({
        id: obj.id, type, x: obj.x, z: obj.z,
        isEaten: obj.isEaten, swallowProgress: obj.isEaten ? 1.0 : 0, eaterX: 0, eaterZ: 0,
        vx: 0, vz: 0, mesh: group, tiltX: 0, tiltZ: 0, spinSpeed: 0, justRespawned: false,
      });
      if (obj.isEaten) {
        group.scale.setScalar(0.01);
      }
    });
  }

  populate(objectTypes: Record<string, ObjectType>, mapSize: number): void {
    this.clear();
    let idCounter = 0;
    const keys = Object.keys(objectTypes);
    keys.forEach(key => {
      const type = objectTypes[key];
      let count = 45;
      if (type.size > 14) count = 35;
      if (type.size > 20) count = 30;
      if (type.size > 30) count = 20;
      if (type.size > 50) count = 12;
      if (type.size > 70) count = 8;
      if (type.size > 100) count = 5;
      for (let i = 0; i < count; i++) {
        const spawn = this.getSafeSpawn(type.size, mapSize);
        const group = this.createMesh(type);
        group.position.set(spawn.x, 0, spawn.z);
        this.scene.add(group);
        this.objects.push({
          id: idCounter++, type, x: spawn.x, z: spawn.z,
          isEaten: false, swallowProgress: 0, eaterX: 0, eaterZ: 0,
          vx: type.isMoving ? rand(-1.5, 1.5) : 0,
          vz: type.isMoving ? rand(-1.5, 1.5) : 0,
          mesh: group, tiltX: 0, tiltZ: 0, spinSpeed: 0, justRespawned: false,
        });
      }
    });
  }

  private createMesh(type: ObjectType): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(type.color);
    const neonColor = new THREE.Color(type.neonColor);
    // Toon material
    const mat = new THREE.MeshToonMaterial({ color });
    let geo: THREE.BufferGeometry;
    const s = type.size * 0.5;
    const h = s * type.heightScale;

    switch (type.geometryType) {
      case 'cylinder':
        geo = new THREE.CylinderGeometry(s * 0.5, s * 0.5, h, 8);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(s * 0.6, h, 6);
        break;
      case 'composite': {
        // Car-like: box body + smaller box top
        geo = new THREE.BoxGeometry(s * 1.2, h * 0.5, s * 0.7);
        const bodyMesh = new THREE.Mesh(geo, mat);
        bodyMesh.position.y = h * 0.25;
        group.add(bodyMesh);
        const topGeo = new THREE.BoxGeometry(s * 0.7, h * 0.35, s * 0.6);
        const topMesh = new THREE.Mesh(topGeo, mat);
        topMesh.position.y = h * 0.55;
        group.add(topMesh);
        // Outline for body
        if (this.quality >= Quality.MEDIUM) {
          const ol = new THREE.Mesh(geo.clone(), this.outlineMaterial.clone());
          ol.scale.multiplyScalar(1.05); ol.position.y = h * 0.25;
          group.add(ol);
        }
        // Neon edge glow (emissive wireframe)
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: neonColor, transparent: true, opacity: 0.6 })
        );
        edge.position.y = h * 0.25;
        group.add(edge);
        return group;
      }
      default: // box
        geo = new THREE.BoxGeometry(s, h, s);
        break;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = h * 0.5;
    if (this.quality >= Quality.HIGH) { mesh.castShadow = true; }
    group.add(mesh);

    // Outline pass (BackSide trick)
    if (this.quality >= Quality.MEDIUM) {
      const outlineGeo = geo.clone();
      const outlineMesh = new THREE.Mesh(outlineGeo, this.outlineMaterial.clone());
      outlineMesh.scale.multiplyScalar(1.05);
      outlineMesh.position.y = h * 0.5;
      group.add(outlineMesh);
    }

    // Neon edge lines
    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({ color: neonColor, transparent: true, opacity: 0.5 });
    const edges = new THREE.LineSegments(edgesGeo, edgeMat);
    edges.position.y = h * 0.5;
    group.add(edges);

    return group;
  }

  update(dt: number, mapSize: number, playerX: number, playerZ: number, playerRadius: number): void {
    for (const obj of this.objects) {
      // Moving objects
      if (!obj.isEaten && (obj.vx !== 0 || obj.vz !== 0)) {
        obj.x += obj.vx; obj.z += obj.vz;
        if (obj.x < 60 || obj.x > mapSize - 60) obj.vx *= -1;
        if (obj.z < 60 || obj.z > mapSize - 60) obj.vz *= -1;
      }

      // Swallow animation
      if (obj.isEaten && obj.swallowProgress < 1.0) {
        obj.swallowProgress += 0.12;
        obj.spinSpeed += 15;
        const progress = obj.swallowProgress;
        const posX = obj.x + (obj.eaterX - obj.x) * progress;
        const posZ = obj.z + (obj.eaterZ - obj.z) * progress;
        const scale = Math.max(0.01, 1 - progress);
        obj.mesh.position.set(posX, 0, posZ);
        obj.mesh.scale.setScalar(scale);
        obj.mesh.rotation.y += obj.spinSpeed * dt;
        if (progress >= 1.0) {
          const spawn = this.getSafeSpawn(obj.type.size, mapSize);
          obj.x = spawn.x; obj.z = spawn.z;
          obj.isEaten = false; obj.swallowProgress = 0;
          obj.spinSpeed = 0; obj.tiltX = 0; obj.tiltZ = 0;
          obj.mesh.scale.setScalar(1);
          obj.mesh.rotation.set(0, 0, 0);
          obj.mesh.position.set(spawn.x, 0, spawn.z);
          obj.justRespawned = true;
        }
        continue;
      }

      // Gravitational tilt toward hole
      if (!obj.isEaten) {
        const dx = playerX - obj.x;
        const dz = playerZ - obj.z;
        const dist = Math.hypot(dx, dz);
        const pullRange = playerRadius * 1.8;
        if (dist < pullRange && playerRadius > obj.type.size - 2) {
          const force = (1 - dist / pullRange) * 0.3;
          obj.tiltX = lerp(obj.tiltX, (dz / dist) * force, 0.1);
          obj.tiltZ = lerp(obj.tiltZ, -(dx / dist) * force, 0.1);
        } else {
          obj.tiltX = lerp(obj.tiltX, 0, 0.05);
          obj.tiltZ = lerp(obj.tiltZ, 0, 0.05);
        }
        obj.mesh.position.set(obj.x, 0, obj.z);
        obj.mesh.rotation.x = obj.tiltX;
        obj.mesh.rotation.z = obj.tiltZ;
      }
    }
  }

  private getSafeSpawn(radius: number, mapSize: number): { x: number; z: number } {
    let x: number, z: number;
    do {
      x = rand(radius + 50, mapSize - radius - 50);
      z = rand(radius + 50, mapSize - radius - 50);
    } while (Math.hypot(x - mapSize / 2, z - mapSize / 2) < 300);
    return { x, z };
  }

  clear(): void {
    for (const obj of this.objects) {
      this.scene.remove(obj.mesh);
      obj.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this.objects = [];
  }

  dispose(): void { this.clear(); }
}
