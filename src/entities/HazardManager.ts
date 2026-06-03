import * as THREE from 'three';
import { rand, distance } from '../utils/math';
import { MAP_SIZE, INITIAL_PLAYER_RADIUS } from '../utils/constants';
import { ParticleSystem } from '../systems/ParticleSystem';
import { Hole } from './Hole';
import { EnemyData } from './Enemy';
import { Camera } from '../core/Camera';

interface BombInstance {
  id: number;
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  x: number;
  z: number;
  radius: number;
}

interface LavaZoneInstance {
  x: number;
  z: number;
  width: number;
  depth: number;
  mesh: THREE.Mesh;
}

export class HazardManager {
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private bombs: BombInstance[] = [];
  private lavaZones: LavaZoneInstance[] = [];
  private bombIdCounter = 0;
  private spawnTimer = 0;

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene = scene;
    this.particles = particles;

    this.createLavaZones();
  }

  private createLavaZones(): void {
    // 2 Lava Zones on opposite sides of the map
    const zones = [
      { x: 600, z: 700, w: 350, d: 350 },
      { x: 1600, z: 1500, w: 400, d: 400 }
    ];

    zones.forEach(z => {
      const geo = new THREE.PlaneGeometry(z.w, z.d);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xFF2200,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(z.x, 0.15, z.z); // Slightly off the ground plane
      this.scene.add(mesh);

      // Add a border line to make it visually clear
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xFF3300, transparent: true, opacity: 0.5 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(z.x, 0.16, z.z);
      this.scene.add(line);

      this.lavaZones.push({ x: z.x, z: z.z, width: z.w, depth: z.d, mesh });
    });
  }

  public update(dt: number, player: Hole, enemies: EnemyData[], camera: Camera, isMultiplayer: boolean, socket: any): void {
    // ─── Spawn Bombs (Host only if multiplayer, or all singleplayer clients) ───
    if (!isMultiplayer || (socket && socket.connected)) {
      this.spawnTimer += dt;
      // Spawn every 14 seconds up to 5 bombs
      if (this.spawnTimer >= 14 && this.bombs.length < 5) {
        this.spawnTimer = 0;
        this.spawnBomb();
      }
    }

    // ─── Update Bombs ───
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.mesh.rotation.y += 1.8 * dt;
      bomb.mesh.rotation.x += 0.9 * dt;

      // Pulse the bomb scale/light
      const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.1;
      bomb.mesh.scale.set(pulse, pulse, pulse);
      bomb.light.intensity = 0.6 + Math.sin(Date.now() * 0.008) * 0.3;

      // ─── Player collision ───
      if (player.isAlive) {
        const d = distance(player.x, player.z, bomb.x, bomb.z);
        if (d < player.radius) {
          this.triggerBombExplosion(bomb, player);
          this.bombs.splice(i, 1);
          continue;
        }
      }

      // ─── Bot collisions ───
      if (!isMultiplayer) {
        for (const bot of enemies) {
          if (!bot.isAlive) continue;
          const d = distance(bot.x, bot.z, bomb.x, bomb.z);
          if (d < bot.radius) {
            this.triggerBotBombExplosion(bomb, bot);
            this.bombs.splice(i, 1);
            break;
          }
        }
      }
    }

    // ─── Lava Zones check ───
    this.lavaZones.forEach(zone => {
      // Check player
      if (player.isAlive) {
        if (Math.abs(player.x - zone.x) < zone.width / 2 && Math.abs(player.z - zone.z) < zone.depth / 2) {
          // Slowly decay player size
          const prevRadius = player.radius;
          player.radius = Math.max(15, player.radius - 9.0 * dt);
          player.targetRadius = Math.max(15, player.targetRadius - 9.0 * dt);
          player.score = Math.max(0, Math.floor(player.score - 15 * dt));

          // Scale local mesh
          const sc = player.radius * 2.5;
          player.mesh.scale.set(sc, sc, 1);

          // Emit warning sparks
          if (Math.random() < 0.25) {
            this.particles.emitBurst(player.x + rand(-5, 5), player.z + rand(-5, 5), '#FF3300', 3);
          }
        }
      }

      // Check bots
      if (!isMultiplayer) {
        enemies.forEach(bot => {
          if (!bot.isAlive) return;
          if (Math.abs(bot.x - zone.x) < zone.width / 2 && Math.abs(bot.z - zone.z) < zone.depth / 2) {
            bot.radius = Math.max(15, bot.radius - 9.0 * dt);
            bot.targetRadius = Math.max(15, bot.targetRadius - 9.0 * dt);
            bot.score = Math.max(0, Math.floor(bot.score - 15 * dt));

            const sc = bot.radius * 2.5;
            bot.mesh.scale.set(sc, sc, 1);
            if (Math.random() < 0.15) {
              this.particles.emitBurst(bot.x + rand(-3, 3), bot.z + rand(-3, 3), '#FF3300', 1);
            }
          }
        });
      }
    });
  }

  private spawnBomb(): void {
    const x = rand(200, MAP_SIZE - 200);
    const z = rand(200, MAP_SIZE - 200);

    const geo = new THREE.IcosahedronGeometry(7, 0);
    const mat = new THREE.MeshToonMaterial({
      color: 0xFF0033,
      emissive: 0xFF0011,
      emissiveIntensity: 0.6,
      wireframe: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 6, z);
    this.scene.add(mesh);

    const light = new THREE.PointLight(0xFF0033, 0.8, 60);
    light.position.set(x, 10, z);
    this.scene.add(light);

    this.bombs.push({
      id: this.bombIdCounter++,
      mesh,
      light,
      x,
      z,
      radius: 7
    });
  }

  private triggerBombExplosion(bomb: BombInstance, player: Hole): void {
    // Remove visuals
    this.scene.remove(bomb.mesh);
    this.scene.remove(bomb.light);
    bomb.mesh.geometry.dispose();
    (bomb.mesh.material as THREE.Material).dispose();

    // Damage player size
    player.radius = Math.max(15, player.radius - 16);
    player.targetRadius = Math.max(15, player.targetRadius - 16);
    player.score = Math.max(0, player.score - 150);

    // Visual feedback
    this.particles.emitBurst(bomb.x, bomb.z, '#FF0033', 35);
    player.triggerAbsorbFlash();

    // Shake camera
    // If the game has camera trauma
    // Let's add trauma
    const cameraObj = (window as any).gameCamera || null;
    if (cameraObj) {
      cameraObj.addTrauma(0.6);
    }

    // Play sound/haptics
    const audioObj = (window as any).gameAudio || null;
    if (audioObj) {
      audioObj.playAbsorbLarge?.();
    }
  }

  private triggerBotBombExplosion(bomb: BombInstance, bot: EnemyData): void {
    this.scene.remove(bomb.mesh);
    this.scene.remove(bomb.light);
    bomb.mesh.geometry.dispose();
    (bomb.mesh.material as THREE.Material).dispose();

    bot.radius = Math.max(15, bot.radius - 16);
    bot.targetRadius = Math.max(15, bot.targetRadius - 16);
    bot.score = Math.max(0, bot.score - 150);

    this.particles.emitBurst(bomb.x, bomb.z, '#FF0033', 25);
  }

  public clear(): void {
    this.bombs.forEach(b => {
      this.scene.remove(b.mesh);
      this.scene.remove(b.light);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    });
    this.bombs = [];
  }
}
