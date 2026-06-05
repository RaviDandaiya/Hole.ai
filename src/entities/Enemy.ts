import * as THREE from 'three';
import holeVertShader from '../shaders/hole.vert.glsl';
import holeFragShader from '../shaders/hole.frag.glsl';
import { INITIAL_PLAYER_RADIUS, MAX_HOLE_RADIUS, MAP_SIZE, LEVEL_THRESHOLDS, getBaseSpeed, BOT_NAMES, BOT_COLORS } from '../utils/constants';
import { rand, clamp } from '../utils/math';
import { SpatialGrid } from '../utils/SpatialGrid';

export interface EnemyData {
  id: number;
  name: string;
  color: string;
  x: number;
  z: number;
  radius: number;
  targetRadius: number;
  score: number;
  level: number;
  isAlive: boolean;
  respawnTimer: number;
  targetTimer: number;
  vx: number;
  vz: number;
  mesh: THREE.Mesh;
  voidMesh: THREE.Mesh;
  glowLight: THREE.PointLight;
  material: THREE.ShaderMaterial;
  labelDiv: HTMLDivElement | null;
}

export class EnemyManager {
  private enemies: EnemyData[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getEnemies(): EnemyData[] { return this.enemies; }

  createBots(count: number): void {
    this.clear();
    for (let i = 0; i < count; i++) {
      const color = BOT_COLORS[i] || '#FF00FF';
      const name = BOT_NAMES[i] || `Bot${i}`;
      const pRgb = this.hex(color);
      const mat = new THREE.ShaderMaterial({
        vertexShader: holeVertShader, fragmentShader: holeFragShader,
        uniforms: {
          uTime: { value: 0 }, uHoleSize: { value: INITIAL_PLAYER_RADIUS },
          uRimColor: { value: new THREE.Vector3(pRgb.r, pRgb.g, pRgb.b) },
          uRimColor2: { value: new THREE.Vector3(pRgb.r * 0.5, pRgb.g * 0.5, pRgb.b * 1.5) },
          uAbsorbFlash: { value: 0 },
        },
        transparent: true, side: THREE.DoubleSide, depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      const spawnX = rand(200, MAP_SIZE - 200);
      const spawnZ = rand(200, MAP_SIZE - 200);
      mesh.position.set(spawnX, -0.2, spawnZ); // recessed slightly below ground cutout
      mesh.scale.set(INITIAL_PLAYER_RADIUS * 2.5, INITIAL_PLAYER_RADIUS * 2.5, 1);
      this.scene.add(mesh);

      // Bot 3D void cylinder
      const cylinderGeo = new THREE.CylinderGeometry(1, 0.75, 1, 16, 1, true);
      const colors = [];
      const positionAttr = cylinderGeo.attributes.position;
      const tempColor = new THREE.Color();
      const primaryColor = new THREE.Color(color);
      for (let j = 0; j < positionAttr.count; j++) {
        const y = positionAttr.getY(j);
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

      const voidMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
      voidMesh.position.set(spawnX, -40, spawnZ);
      voidMesh.scale.set(INITIAL_PLAYER_RADIUS, 80, INITIAL_PLAYER_RADIUS);
      this.scene.add(voidMesh);

      const light = new THREE.PointLight(new THREE.Color(color).getHex(), 0.5, INITIAL_PLAYER_RADIUS * 3);
      light.position.set(spawnX, 8, spawnZ);
      this.scene.add(light);

      // Name label
      const labelDiv = document.createElement('div');
      labelDiv.className = 'bot-label';
      labelDiv.textContent = name;
      labelDiv.style.cssText = `position:fixed;pointer-events:none;font-family:'Bebas Neue',sans-serif;font-size:14px;color:${color};text-shadow:0 0 8px ${color};z-index:10;display:none;white-space:nowrap;`;
      document.getElementById('app')?.appendChild(labelDiv);

      this.enemies.push({
        id: i, name, color, x: spawnX, z: spawnZ,
        radius: INITIAL_PLAYER_RADIUS, targetRadius: INITIAL_PLAYER_RADIUS,
        score: 0, level: 0, isAlive: true, respawnTimer: 0, targetTimer: 0,
        vx: 0, vz: 0, mesh, voidMesh, glowLight: light, material: mat, labelDiv,
      });
    }
  }

  update(dt: number, time: number, playerX: number, playerZ: number, playerRadius: number, playerAlive: boolean, spatialGrid: SpatialGrid<any>, camera: THREE.PerspectiveCamera, isFrozen: boolean = false): void {
    for (const bot of this.enemies) {
      if (!bot.isAlive) {
        bot.respawnTimer -= dt * 1000;
        bot.mesh.visible = false;
        bot.voidMesh.visible = false;
        bot.glowLight.visible = false;
        if (bot.labelDiv) bot.labelDiv.style.display = 'none';
        if (bot.respawnTimer <= 0) {
          bot.x = rand(200, MAP_SIZE - 200); bot.z = rand(200, MAP_SIZE - 200);
          bot.isAlive = true; bot.radius = INITIAL_PLAYER_RADIUS; bot.targetRadius = INITIAL_PLAYER_RADIUS;
          bot.score = Math.floor(bot.score * 0.45); bot.level = 0;
          bot.voidMesh.position.set(bot.x, -40, bot.z);
          bot.voidMesh.scale.set(bot.radius, 80, bot.radius);
        }
        continue;
      }

      bot.mesh.visible = true;
      bot.voidMesh.visible = true;
      bot.glowLight.visible = true;
      if (bot.radius < bot.targetRadius) bot.radius = Math.min(bot.targetRadius, bot.radius + 0.35);

      let speed = isFrozen ? 0 : getBaseSpeed(bot.radius) * 0.15;
      if (isFrozen) {
        bot.vx = 0; bot.vz = 0;
      }
      bot.targetTimer -= dt * 1000;

      // AI steering
      let avoidForceX = 0;
      let avoidForceZ = 0;

      // ─── 1. Flee from larger threats ───
      // Flee from player
      const distToPlayer = Math.hypot(playerX - bot.x, playerZ - bot.z);
      if (playerAlive && playerRadius > bot.radius + 8 && distToPlayer < (250 + bot.radius)) {
        const fw = (250 + bot.radius - distToPlayer) / (250 + bot.radius);
        avoidForceX += (bot.x - playerX) / distToPlayer * fw * 2.5;
        avoidForceZ += (bot.z - playerZ) / distToPlayer * fw * 2.5;
      }
      // Flee from larger bots
      for (const other of this.enemies) {
        if (other.id === bot.id || !other.isAlive) continue;
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (other.radius > bot.radius + 8 && d < (250 + bot.radius)) {
          const fw = (250 + bot.radius - d) / (250 + bot.radius);
          avoidForceX += (bot.x - other.x) / d * fw * 2.5;
          avoidForceZ += (bot.z - other.z) / d * fw * 2.5;
        }
      }

      // ─── 2. Hunt smaller targets ───
      let huntForceX = 0;
      let huntForceZ = 0;
      let hasHunt = false;

      // Hunt player if smaller
      if (playerAlive && bot.radius > playerRadius + 8 && distToPlayer < (300 + bot.radius)) {
        huntForceX += (playerX - bot.x) / distToPlayer;
        huntForceZ += (playerZ - bot.z) / distToPlayer;
        hasHunt = true;
      }
      // Hunt smaller bots
      let closestHunt: EnemyData | null = null;
      let closestHuntDist = Infinity;
      for (const other of this.enemies) {
        if (other.id === bot.id || !other.isAlive) continue;
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (bot.radius > other.radius + 8 && d < (300 + bot.radius) && d < closestHuntDist) {
          closestHuntDist = d;
          closestHunt = other;
        }
      }
      if (closestHunt) {
        huntForceX += (closestHunt.x - bot.x) / closestHuntDist;
        huntForceZ += (closestHunt.z - bot.z) / closestHuntDist;
        hasHunt = true;
      }

      // Normalize hunt force if active
      if (hasHunt) {
        const mag = Math.hypot(huntForceX, huntForceZ);
        if (mag > 0.001) {
          huntForceX /= mag;
          huntForceZ /= mag;
        }
      }

      // ─── 3. Density-based foraging ───
      let forageForceX = 0;
      let forageForceZ = 0;
      let hasForage = false;

      const nearbyObjs = spatialGrid.query(bot.x, bot.z, 450);
      let forageX = 0;
      let forageZ = 0;
      let totalWeight = 0;
      for (const obj of nearbyObjs) {
        if (obj.isEaten) continue;
        if (bot.radius < obj.type.size - 2) continue; // Can't eat it yet
        const d = Math.hypot(obj.x - bot.x, obj.z - bot.z);
        if (d > 0) {
          const w = (450 - d) / 450;
          forageX += (obj.x - bot.x) / d * w;
          forageZ += (obj.z - bot.z) / d * w;
          totalWeight += w;
        }
      }
      if (totalWeight > 0) {
        const mag = Math.hypot(forageX, forageZ);
        if (mag > 0.001) {
          forageForceX = forageX / mag;
          forageForceZ = forageZ / mag;
          hasForage = true;
        }
      }

      // ─── 4. Combine Forces & Steer ───
      let steerX = 0;
      let steerZ = 0;
      let isSteering = false;

      const avoidMag = Math.hypot(avoidForceX, avoidForceZ);
      if (avoidMag > 0.05) {
        steerX = avoidForceX / avoidMag;
        steerZ = avoidForceZ / avoidMag;
        isSteering = true;
      } else if (hasHunt) {
        steerX = huntForceX;
        steerZ = huntForceZ;
        isSteering = true;
      } else if (hasForage) {
        steerX = forageForceX;
        steerZ = forageForceZ;
        isSteering = true;
      }

      if (isSteering) {
        bot.vx += (steerX * speed - bot.vx) * 0.12;
        bot.vz += (steerZ * speed - bot.vz) * 0.12;
      } else if (bot.targetTimer <= 0) {
        const ra = rand(0, Math.PI * 2);
        bot.vx = Math.cos(ra) * speed; bot.vz = Math.sin(ra) * speed;
        bot.targetTimer = rand(800, 2500);
      }

      // ─── 5. Stuck / Wall Collision Prevention ───
      const margin = bot.radius + 30;
      if (bot.x < margin) bot.vx += 0.8 * dt * speed;
      if (bot.x > MAP_SIZE - margin) bot.vx -= 0.8 * dt * speed;
      if (bot.z < margin) bot.vz += 0.8 * dt * speed;
      if (bot.z > MAP_SIZE - margin) bot.vz -= 0.8 * dt * speed;

      bot.x += bot.vx; bot.z += bot.vz;
      bot.x = clamp(bot.x, bot.radius, MAP_SIZE - bot.radius);
      bot.z = clamp(bot.z, bot.radius, MAP_SIZE - bot.radius);

      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (bot.score >= LEVEL_THRESHOLDS[i]) { bot.level = i; break; }
      }

      const sc = bot.radius * 2.5;
      bot.mesh.position.set(bot.x, -0.2, bot.z); // recessed
      bot.mesh.scale.set(sc, sc, 1);
      bot.voidMesh.position.set(bot.x, -40, bot.z);
      bot.voidMesh.scale.set(bot.radius, 80, bot.radius);
      bot.glowLight.position.set(bot.x, 8, bot.z);
      bot.glowLight.intensity = 0.3 + bot.radius * 0.005;
      bot.glowLight.distance = bot.radius * 3;
      bot.material.uniforms.uTime.value = time;
      bot.material.uniforms.uHoleSize.value = bot.radius;

      // Project label to screen
      if (bot.labelDiv) {
        const pos = new THREE.Vector3(bot.x, 20, bot.z);
        pos.project(camera);
        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
        if (pos.z < 1) {
          bot.labelDiv.style.display = 'block';
          bot.labelDiv.style.left = `${x}px`; bot.labelDiv.style.top = `${y - 20}px`;
          bot.labelDiv.style.transform = 'translateX(-50%)';
        } else {
          bot.labelDiv.style.display = 'none';
        }
      }
    }
  }

  clear(): void {
    for (const e of this.enemies) {
      this.scene.remove(e.mesh); this.scene.remove(e.glowLight); this.scene.remove(e.voidMesh);
      e.mesh.geometry.dispose(); e.material.dispose();
      e.voidMesh.geometry.dispose(); (e.voidMesh.material as THREE.Material).dispose();
      if (e.labelDiv) e.labelDiv.remove();
    }
    this.enemies = [];
  }

  private hex(h: string) { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); if (!r) return {r:1,g:1,b:1}; return {r:parseInt(r[1],16)/255,g:parseInt(r[2],16)/255,b:parseInt(r[3],16)/255}; }
  dispose(): void { this.clear(); }
}
