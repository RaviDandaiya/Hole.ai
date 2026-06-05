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
    const targetKeys = Object.keys(objectTypes);
    const serverKeys = ['TRASH', 'BENCH', 'TREE', 'CAR', 'BUS', 'SHOP', 'RESTAURANT', 'SKYSCRAPER'];

    sharedObjs.forEach(obj => {
      let type = objectTypes[obj.typeId];
      if (!type) {
        const idx = serverKeys.indexOf(obj.typeId);
        if (idx !== -1 && targetKeys[idx]) {
          type = objectTypes[targetKeys[idx]];
        }
      }
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

  private createEmojiSprite(symbol: string, size: number, height: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);
      ctx.font = '84px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
      ctx.fillText(symbol, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.format = THREE.RGBAFormat;
    texture.premultiplyAlpha = false;
    texture.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      color: 0xffffff,
      opacity: 1.0,
      depthWrite: false,
      depthTest: true
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    sprite.position.set(0, height + size * 0.45, 0);
    return sprite;
  }

  private addSubMesh(
    group: THREE.Group,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    neonColor: THREE.Color,
    px: number, py: number, pz: number,
    sx: number = 1, sy: number = 1, sz: number = 1,
    rx: number = 0, ry: number = 0, rz: number = 0
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(rx, ry, rz);
    if (this.quality >= Quality.HIGH) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    group.add(mesh);

    // Outline pass
    if (this.quality >= Quality.MEDIUM) {
      const ol = new THREE.Mesh(geo.clone(), this.outlineMaterial.clone());
      ol.position.set(px, py, pz);
      ol.scale.set(sx * 1.05, sy * 1.05, sz * 1.05);
      ol.rotation.set(rx, ry, rz);
      group.add(ol);
    }

    // Neon edge lines
    const edgesGeo = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({ color: neonColor, transparent: true, opacity: 0.5 });
    const edges = new THREE.LineSegments(edgesGeo, edgeMat);
    edges.position.set(px, py, pz);
    edges.scale.set(sx, sy, sz);
    edges.rotation.set(rx, ry, rz);
    group.add(edges);

    return mesh;
  }

  private createMesh(type: ObjectType): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(type.color);
    const neonColor = new THREE.Color(type.neonColor);
    const mat = new THREE.MeshToonMaterial({ color });
    
    const s = type.size * 0.5;
    const h = s * type.heightScale;

    const id = type.id;

    // Foliage & Plants
    if (id === 'TREE' || id === 'CHERRY' || id === 'PALM' || id === 'PLANT') {
      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(s * 0.1, s * 0.12, h * 0.3, 5);
      const trunkMat = new THREE.MeshToonMaterial({ color: 0x78350F });
      this.addSubMesh(group, trunkGeo, trunkMat, neonColor, 0, h * 0.15, 0);

      // Canopy
      if (id === 'PALM') {
        const leafGeo = new THREE.ConeGeometry(s * 0.7, h * 0.75, 5);
        this.addSubMesh(group, leafGeo, mat, neonColor, 0, h * 0.65, 0);
      } else if (id === 'CHERRY') {
        const cherryGeo = new THREE.SphereGeometry(s * 0.48, 6, 6);
        const cherryMat = new THREE.MeshToonMaterial({ color: 0xFBCFE8 });
        this.addSubMesh(group, cherryGeo, cherryMat, neonColor, 0, h * 0.65, 0);
      } else {
        // Double cone tree
        const lowerGeo = new THREE.ConeGeometry(s * 0.55, h * 0.5, 5);
        this.addSubMesh(group, lowerGeo, mat, neonColor, 0, h * 0.45, 0);
        const upperGeo = new THREE.ConeGeometry(s * 0.42, h * 0.4, 5);
        this.addSubMesh(group, upperGeo, mat, neonColor, 0, h * 0.75, 0);
      }
    }
    // Vehicles
    else if (id === 'CAR' || id === 'BUS' || id === 'ELECTRIC_CAR' || id === 'AUTONOMOUS_BUS' || id === 'ROVER' || id === 'SPACECRAFT') {
      // Chassis
      const chassisGeo = new THREE.BoxGeometry(s * 1.35, h * 0.4, s * 0.75);
      this.addSubMesh(group, chassisGeo, mat, neonColor, 0, h * 0.22, 0);

      // Cabin
      const cabinGeo = new THREE.BoxGeometry(s * 0.75, h * 0.4, s * 0.65);
      this.addSubMesh(group, cabinGeo, mat, neonColor, 0, h * 0.58, 0);

      // Windows (blue cyan glowing panels)
      const windGeo = new THREE.BoxGeometry(s * 0.15, h * 0.22, s * 0.55);
      const windMat = new THREE.MeshToonMaterial({ color: 0x00E5FF, emissive: 0x00E5FF, emissiveIntensity: 0.3 });
      this.addSubMesh(group, windGeo, windMat, neonColor, s * 0.31, h * 0.58, 0);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(h * 0.18, h * 0.18, s * 0.15, 6);
      const wheelMat = new THREE.MeshToonMaterial({ color: 0x1F2937 });
      const rWheel = Math.PI / 2;
      this.addSubMesh(group, wheelGeo, wheelMat, neonColor, s * 0.4, h * 0.09, s * 0.38, 1, 1, 1, rWheel, 0, 0);
      this.addSubMesh(group, wheelGeo, wheelMat, neonColor, s * 0.4, h * 0.09, -s * 0.38, 1, 1, 1, rWheel, 0, 0);
      this.addSubMesh(group, wheelGeo, wheelMat, neonColor, -s * 0.4, h * 0.09, s * 0.38, 1, 1, 1, rWheel, 0, 0);
      this.addSubMesh(group, wheelGeo, wheelMat, neonColor, -s * 0.4, h * 0.09, -s * 0.38, 1, 1, 1, rWheel, 0, 0);
    }
    // Bins / Trash / Drums / Slime Vats
    else if (id === 'TRASH' || id === 'SMART_BIN' || id === 'WASTE_DRUM' || id === 'SLIME_VATS') {
      const cylGeo = new THREE.CylinderGeometry(s * 0.42, s * 0.42, h * 0.8, 8);
      this.addSubMesh(group, cylGeo, mat, neonColor, 0, h * 0.4, 0);

      const lidGeo = new THREE.CylinderGeometry(s * 0.46, s * 0.46, h * 0.08, 8);
      const lidMat = new THREE.MeshToonMaterial({ color: 0x3F3F46 });
      this.addSubMesh(group, lidGeo, lidMat, neonColor, 0, h * 0.84, 0);

      // Glowing hazard bands
      const bandGeo = new THREE.CylinderGeometry(s * 0.43, s * 0.43, h * 0.06, 8);
      const bandMat = new THREE.MeshToonMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 0.5 });
      this.addSubMesh(group, bandGeo, bandMat, neonColor, 0, h * 0.5, 0);
    }
    // Buildings & Large complexes
    else if (id === 'SHOP' || id === 'RESTAURANT' || id === 'SMART_HOME' || id === 'RESEARCH_LAB' || id === 'LAB' || id === 'STATION' || id === 'DOME') {
      const baseGeo = new THREE.BoxGeometry(s * 1.0, h * 0.65, s * 1.0);
      this.addSubMesh(group, baseGeo, mat, neonColor, 0, h * 0.325, 0);

      if (id === 'DOME') {
        const domeGeo = new THREE.SphereGeometry(s * 0.48, 8, 8);
        const domeMat = new THREE.MeshToonMaterial({ color: 0x2FF5FF, transparent: true, opacity: 0.6 });
        this.addSubMesh(group, domeGeo, domeMat, neonColor, 0, h * 0.65, 0);
      } else {
        // Sloped roof
        const roofGeo = new THREE.BoxGeometry(s * 0.8, s * 0.8, s * 0.8);
        const roofMat = new THREE.MeshToonMaterial({ color: 0x7F1D1D });
        this.addSubMesh(group, roofGeo, roofMat, neonColor, 0, h * 0.72, 0, 1.1, 0.2, 1.1, 0, 0, Math.PI / 4);
      }

      // Door
      const doorGeo = new THREE.BoxGeometry(s * 0.2, h * 0.35, s * 0.05);
      const doorMat = new THREE.MeshToonMaterial({ color: 0x78350F });
      this.addSubMesh(group, doorGeo, doorMat, neonColor, 0, h * 0.175, s * 0.505);
    }
    // Skyscrapers & Large Towers
    else if (id === 'SKYSCRAPER' || id === 'GLASS_SKYSCRAPER' || id === 'MAINFRAME_TOWER' || id === 'MOTHERSHIP' || id === 'COOLING_TOWER') {
      const towerGeo = new THREE.BoxGeometry(s * 0.8, h * 0.95, s * 0.8);
      this.addSubMesh(group, towerGeo, mat, neonColor, 0, h * 0.475, 0);

      // Vertical/Horizontal Neon stripes (windows representation)
      const windowStripGeo = new THREE.BoxGeometry(s * 0.82, h * 0.04, s * 0.82);
      const windowStripMat = new THREE.MeshToonMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 0.6 });
      this.addSubMesh(group, windowStripGeo, windowStripMat, neonColor, 0, h * 0.3, 0);
      this.addSubMesh(group, windowStripGeo, windowStripMat, neonColor, 0, h * 0.6, 0);
      this.addSubMesh(group, windowStripGeo, windowStripMat, neonColor, 0, h * 0.8, 0);

      // Antenna
      const antGeo = new THREE.CylinderGeometry(s * 0.02, s * 0.02, h * 0.12, 4);
      const antMat = new THREE.MeshToonMaterial({ color: 0x9CA3AF });
      this.addSubMesh(group, antGeo, antMat, neonColor, 0, h * 1.01, 0);

      const tipGeo = new THREE.SphereGeometry(s * 0.05, 4, 4);
      const tipMat = new THREE.MeshToonMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 1.0 });
      this.addSubMesh(group, tipGeo, tipMat, neonColor, 0, h * 1.07, 0);
    }
    // Retro Arcades / CRT Screens
    else if (id === 'CRT_MONITOR' || id === 'ARCADE_CABINET' || id === 'RETRO_CONSOLE' || id === 'JOYSTICK') {
      if (id === 'JOYSTICK') {
        const baseGeo = new THREE.BoxGeometry(s * 1.0, h * 0.24, s * 1.0);
        this.addSubMesh(group, baseGeo, mat, neonColor, 0, h * 0.12, 0);

        const shaftGeo = new THREE.CylinderGeometry(s * 0.08, s * 0.08, h * 0.58, 6);
        const shaftMat = new THREE.MeshToonMaterial({ color: 0xD1D5DB });
        this.addSubMesh(group, shaftGeo, shaftMat, neonColor, 0, h * 0.53, 0);

        const knobGeo = new THREE.SphereGeometry(s * 0.24, 6, 6);
        const knobMat = new THREE.MeshToonMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 0.5 });
        this.addSubMesh(group, knobGeo, knobMat, neonColor, 0, h * 0.82, 0);
      } else {
        const cabGeo = new THREE.BoxGeometry(s * 0.85, h * 0.95, s * 0.85);
        this.addSubMesh(group, cabGeo, mat, neonColor, 0, h * 0.475, 0);

        // Control board slab
        const ctrlGeo = new THREE.BoxGeometry(s * 0.95, h * 0.08, s * 0.3);
        const ctrlMat = new THREE.MeshToonMaterial({ color: 0x111827 });
        this.addSubMesh(group, ctrlGeo, ctrlMat, neonColor, 0, h * 0.5, s * 0.38);

        // Bezel / Screen face
        const bezelGeo = new THREE.BoxGeometry(s * 0.75, h * 0.3, s * 0.03);
        const bezelMat = new THREE.MeshToonMaterial({ color: neonColor, emissive: neonColor, emissiveIntensity: 0.6 });
        this.addSubMesh(group, bezelGeo, bezelMat, neonColor, 0, h * 0.72, s * 0.435);
      }
    }
    // Miscellaneous items & default shapes
    else {
      if (id === 'BENCH') {
        const seatGeo = new THREE.BoxGeometry(s * 1.25, h * 0.15, s * 0.45);
        this.addSubMesh(group, seatGeo, mat, neonColor, 0, h * 0.45, 0);

        const legGeo = new THREE.BoxGeometry(s * 0.12, h * 0.4, s * 0.45);
        const legMat = new THREE.MeshToonMaterial({ color: 0x3F3F46 });
        this.addSubMesh(group, legGeo, legMat, neonColor, s * 0.45, h * 0.2, 0);
        this.addSubMesh(group, legGeo, legMat, neonColor, -s * 0.45, h * 0.2, 0);
      } else if (id === 'FLOPPY_DISK' || id === 'CASSETTE') {
        const diskGeo = new THREE.BoxGeometry(s * 1.0, h * 0.9, s * 0.08);
        const rDiskX = Math.PI / 2;
        this.addSubMesh(group, diskGeo, mat, neonColor, 0, h * 0.04, 0, 1, 1, 1, rDiskX, 0, 0);

        // white label stickers
        const lblGeo = new THREE.BoxGeometry(s * 0.7, h * 0.4, s * 0.09);
        const lblMat = new THREE.MeshToonMaterial({ color: 0xF9FAFB });
        this.addSubMesh(group, lblGeo, lblMat, neonColor, -s * 0.08, h * 0.045, 0, 1, 1, 1, rDiskX, 0, 0);
      } else if (id === 'ROBOT') {
        const bodyGeo = new THREE.BoxGeometry(s * 0.7, h * 0.48, s * 0.7);
        this.addSubMesh(group, bodyGeo, mat, neonColor, 0, h * 0.24, 0);

        const headGeo = new THREE.BoxGeometry(s * 0.48, h * 0.32, s * 0.48);
        this.addSubMesh(group, headGeo, mat, neonColor, 0, h * 0.64, 0);

        // glowing red eyes
        const eyeGeo = new THREE.BoxGeometry(s * 0.08, h * 0.08, s * 0.04);
        const eyeMat = new THREE.MeshToonMaterial({ color: neonColor, emissive: neonColor });
        this.addSubMesh(group, eyeGeo, eyeMat, neonColor, s * 0.12, h * 0.64, s * 0.245);
        this.addSubMesh(group, eyeGeo, eyeMat, neonColor, -s * 0.12, h * 0.64, s * 0.245);
      } else {
        // Normal geometry types (cylinder / cone / box)
        let geo: THREE.BufferGeometry;
        if (type.geometryType === 'cylinder') {
          geo = new THREE.CylinderGeometry(s * 0.5, s * 0.5, h, 8);
        } else if (type.geometryType === 'cone') {
          geo = new THREE.ConeGeometry(s * 0.6, h, 6);
        } else {
          geo = new THREE.BoxGeometry(s, h, s);
        }
        this.addSubMesh(group, geo, mat, neonColor, 0, h * 0.5, 0);
      }
    }

    // Attach Cute Floating Emoji Sprite on top of the 3D model!
    const spriteSize = s * 1.15;
    const emojiSprite = this.createEmojiSprite(type.symbol, spriteSize, h);
    group.add(emojiSprite);

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
        const posY = -progress * 45;
        obj.mesh.position.set(posX, posY, posZ);
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
