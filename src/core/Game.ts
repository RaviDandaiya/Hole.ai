import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { Hole } from '../entities/Hole';
import { WorldObjectManager, WorldObjectData } from '../entities/WorldObject';
import { EnemyManager } from '../entities/Enemy';
import { ParticleSystem } from '../systems/ParticleSystem';
import { LoadingScreen } from '../ui/LoadingScreen';
import { MainMenu, GameMode } from '../ui/MainMenu';
import { HUD, LeaderboardEntry } from '../ui/HUD';
import { GameOverScreen } from '../ui/GameOver';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { SizeUpCelebration } from '../ui/SizeUpCelebration';
import {
  GameState, MAP_DEFINITIONS, MAP_SIZE, GAME_DURATION, BOT_COUNT,
  POWERUP_TYPES, LEVEL_THRESHOLDS, LEVEL_NAMES, isMobileDevice, MapDefinition,
  MAX_HOLE_RADIUS,
} from '../utils/constants';
import { rand, distance } from '../utils/math';
import * as storage from '../utils/storage';
import * as haptics from '../utils/haptics';

import groundVertShader from '../shaders/ground.vert.glsl';
import groundFragShader from '../shaders/ground.frag.glsl';

interface PowerupInstance {
  type: string; x: number; z: number; color: string; symbol: string; label: string;
  isEaten: boolean; mesh: THREE.Mesh; glowLight: THREE.PointLight;
}

export class Game {
  private state: GameState = GameState.LOADING;
  private renderer: Renderer;
  private camera: Camera;
  private input: InputManager;
  private audio: AudioManager;
  private particles: ParticleSystem;
  private player!: Hole;
  private objects!: WorldObjectManager;
  private enemies!: EnemyManager;

  // UI
  private loadingScreen: LoadingScreen;
  private mainMenu: MainMenu;
  private hud: HUD;
  private gameOverScreen: GameOverScreen;
  private joystick: VirtualJoystick;
  private sizeUpCelebration: SizeUpCelebration;

  // Game state
  private gameMode: GameMode = 'classic';
  private selectedMapId: string = MAP_DEFINITIONS[0].id;
  private equippedSkin: string = 'NEON';
  private timeLeft: number = GAME_DURATION;
  private timerInterval: number = 0;
  private powerups: PowerupInstance[] = [];
  private magnetTimer = 0;
  private speedTimer = 0;
  private multiplierTimer = 0;
  private prevLevel = 0;
  private hudUpdateCounter = 0;

  // Ground
  private groundMaterial!: THREE.ShaderMaterial;

  // Keyboard hint
  private keyboardHint: HTMLDivElement | null = null;

  constructor(container: HTMLElement) {
    // ─── Core systems ───
    this.renderer = new Renderer(container);
    this.camera = new Camera(this.renderer.camera);
    this.input = new InputManager(this.renderer.renderer.domElement);
    this.audio = new AudioManager();
    this.particles = new ParticleSystem(this.renderer.scene);

    // ─── UI ───
    this.loadingScreen = new LoadingScreen();
    this.mainMenu = new MainMenu();
    this.hud = new HUD();
    this.gameOverScreen = new GameOverScreen();
    this.joystick = new VirtualJoystick();
    this.sizeUpCelebration = new SizeUpCelebration();

    // ─── Entities ───
    this.player = new Hole(this.renderer.scene, storage.getEquippedSkin());
    this.objects = new WorldObjectManager(this.renderer.scene);
    this.enemies = new EnemyManager(this.renderer.scene);

    // ─── Ground plane ───
    this.createGround();

    // ─── Map boundary walls ───
    this.createBoundaryWalls();

    // ─── Callbacks ───
    this.mainMenu.setOnPlay((mode, mapId, skinId) => {
      this.startGame(mode, mapId, skinId);
    });
    this.gameOverScreen.setCallbacks(
      () => this.startGame(this.gameMode, this.selectedMapId, this.equippedSkin),
      () => this.showMenu()
    );
    this.hud.setOnMuteToggle(() => this.audio.toggleMute());

    // ─── Start ───
    this.init();
  }

  private async init(): Promise<void> {
    // Simulate loading
    for (let i = 0; i <= 100; i += 5) {
      this.loadingScreen.setProgress(i);
      await new Promise(r => setTimeout(r, 30));
    }
    await this.loadingScreen.hide();
    this.showMenu();
    this.loop(0);
  }

  private showMenu(): void {
    this.state = GameState.MENU;
    this.mainMenu.show();
    this.hud.hide();
    this.gameOverScreen.hide();
    this.player.mesh.visible = false;
    this.player.glowLight.visible = false;
    this.enemies.clear();
    this.objects.clear();
    this.clearPowerups();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.audio.stopAmbient();
    if (this.keyboardHint) this.keyboardHint.remove();
  }

  private startGame(mode: GameMode, mapId: string, skinId: string): void {
    this.gameMode = mode;
    this.selectedMapId = mapId;
    this.equippedSkin = skinId;
    this.state = GameState.PLAYING;

    this.mainMenu.hide();
    this.gameOverScreen.hide();
    this.hud.show();

    const mapDef = MAP_DEFINITIONS.find(m => m.id === mapId) || MAP_DEFINITIONS[0];

    // Reset player
    this.player.reset(skinId);
    this.prevLevel = 0;

    // Populate world objects
    this.objects.populate(mapDef.objects, MAP_SIZE);

    // Create bots
    this.enemies.createBots(BOT_COUNT);

    // Reset powerups
    this.clearPowerups();
    this.magnetTimer = 0;
    this.speedTimer = 0;
    this.multiplierTimer = 0;

    // Update ground colors
    this.updateGroundColors(mapDef);

    // Timer
    this.timeLeft = mode === 'sandbox' ? -1 : GAME_DURATION;
    this.hud.updateTimer(this.timeLeft);
    this.hud.updateScore(0);
    this.hud.updateSize(this.player.radius);

    if (mode !== 'sandbox') {
      this.timerInterval = window.setInterval(() => this.timerTick(), 1000);
    }

    // Audio
    this.audio.startAmbient();

    // Keyboard hint (desktop only)
    if (!isMobileDevice()) {
      this.keyboardHint = document.createElement('div');
      this.keyboardHint.className = 'keyboard-hint';
      this.keyboardHint.textContent = '⌨️ WASD / Arrows or mouse drag to steer';
      document.getElementById('app')!.appendChild(this.keyboardHint);
      setTimeout(() => { if (this.keyboardHint) { this.keyboardHint.style.opacity = '0'; setTimeout(() => this.keyboardHint?.remove(), 500); } }, 5000);
    }
  }

  private timerTick(): void {
    if (this.timeLeft <= 0) return;
    this.timeLeft--;
    this.hud.updateTimer(this.timeLeft);

    // Powerup timers
    if (this.magnetTimer > 0) this.magnetTimer--;
    if (this.speedTimer > 0) this.speedTimer--;
    if (this.multiplierTimer > 0) this.multiplierTimer--;
    this.hud.updatePowerups(this.magnetTimer, this.speedTimer, this.multiplierTimer);

    // Spawn powerups
    if (this.timeLeft % 10 === 0 && this.powerups.filter(p => !p.isEaten).length < 3) {
      this.spawnPowerup();
    }

    // Countdown ticks
    if (this.timeLeft <= 10 && this.timeLeft > 0) {
      this.audio.playTick();
    }

    if (this.timeLeft <= 0) {
      this.endGame();
    }
  }

  private endGame(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.state = GameState.GAME_OVER;

    const score = this.player.score;
    const level = this.player.level;
    const eatenBots = this.player.eatenBotsCount;

    const entries = [
      { name: 'You', score, isPlayer: true },
      ...this.enemies.getEnemies().map(e => ({ name: e.name, score: e.score, isPlayer: false })),
    ].sort((a, b) => b.score - a.score);
    const placement = entries.findIndex(e => e.isPlayer) + 1;

    const reward = Math.floor(score / 9) + (5 - placement) * 22;
    const dm = storage.getDarkMatter() + reward;
    storage.setDarkMatter(dm);

    const highs = storage.getHighScores();
    if (score > (highs[this.gameMode] || 0)) {
      highs[this.gameMode] = score;
      storage.setHighScores(highs);
    }

    this.audio.playGameOver();
    this.audio.stopAmbient();
    haptics.vibrateGameOver();

    this.hud.hide();
    this.gameOverScreen.show({ placement, score, level, currencyEarned: reward, eatenBots });
  }

  // ─── GAME LOOP ───
  private lastTime = 0;
  private loop = (time: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    const timeSeconds = time / 1000;

    if (this.state === GameState.PLAYING) {
      this.updatePlaying(dt, timeSeconds);
    }

    // Render always (menu has idle scene)
    this.renderer.render(timeSeconds);
  };

  private updatePlaying(dt: number, time: number): void {
    const input = this.input.getInput();

    // ─── Player update ───
    this.player.update(dt, input.dx, input.dy, time, this.speedTimer > 0);

    // Respawn check
    if (!this.player.isAlive && this.player.respawnTimer <= 0) {
      const sp = this.getSafeSpawn(this.player.radius);
      this.player.respawn(sp.x, sp.z);
    }

    // ─── Trail particles ───
    if (this.player.isAlive && input.isActive) {
      this.particles.emitTrail(this.player.x, this.player.z, this.player.getRimColor());
    }

    // ─── Objects update ───
    this.objects.update(dt, MAP_SIZE, this.player.x, this.player.z, this.player.radius);

    // ─── Enemies update ───
    this.enemies.update(
      dt, time, this.player.x, this.player.z, this.player.radius,
      this.player.isAlive, this.objects.getObjects(), this.renderer.camera
    );

    // ─── Collisions ───
    this.handleCollisions(dt);

    // ─── Camera ───
    if (this.player.isAlive) {
      this.camera.setTarget(this.player.x, this.player.z);
      this.camera.setZoom(this.player.radius);
    }
    this.camera.update(dt);

    // ─── Ground shader uniforms ───
    this.groundMaterial.uniforms.uTime.value = time;
    this.groundMaterial.uniforms.uHolePos.value.set(this.player.x, 0, this.player.z);
    this.groundMaterial.uniforms.uHoleRadius.value = this.player.radius;
    const skin = this.player.getRimColor();
    const rgb = this.hexToRgb(skin);
    this.groundMaterial.uniforms.uHoleGlowColor.value.set(rgb.r, rgb.g, rgb.b);

    // ─── Particles ───
    this.particles.update(dt);

    // ─── Joystick visual ───
    if (isMobileDevice()) {
      this.joystick.update(this.input);
    }

    // ─── HUD updates (throttled) ───
    this.hudUpdateCounter++;
    if (this.hudUpdateCounter % 8 === 0) {
      this.hud.updateScore(this.player.score);
      this.hud.updateSize(this.player.radius);

      const lb: LeaderboardEntry[] = [
        { name: 'You', score: this.player.score, isPlayer: true },
        ...this.enemies.getEnemies().map(e => ({ name: e.name, score: e.score, isPlayer: false })),
      ].sort((a, b) => b.score - a.score);
      this.hud.updateLeaderboard(lb);
    }

    // ─── Chromatic aberration reset ───
    this.renderer.setChromaticAberration(0.001);
  }

  private handleCollisions(dt: number): void {
    const objs = this.objects.getObjects();
    const enemies = this.enemies.getEnemies();
    const mapDef = MAP_DEFINITIONS.find(m => m.id === this.selectedMapId) || MAP_DEFINITIONS[0];

    // ─── Player ↔ Objects ───
    if (this.player.isAlive) {
      for (const obj of objs) {
        if (obj.isEaten) continue;
        const dist = distance(obj.x, obj.z, this.player.x, this.player.z);
        let pull = this.player.radius * 1.5;
        if (this.magnetTimer > 0) pull *= 2.0;

        if (dist < pull && this.player.radius > obj.type.size - 2) {
          // Gravitational pull
          const force = Math.max(0.1, 1 - dist / pull) * 7;
          const angle = Math.atan2(this.player.z - obj.z, this.player.x - obj.x);
          obj.x += Math.cos(angle) * force;
          obj.z += Math.sin(angle) * force;

          if (dist < this.player.radius * 0.96) {
            obj.isEaten = true;
            obj.swallowProgress = 0.05;
            obj.eaterX = this.player.x;
            obj.eaterZ = this.player.z;

            let points = obj.type.score;
            if (this.multiplierTimer > 0) points *= 2;
            this.player.addScore(points, obj.type.growth);
            this.player.triggerAbsorbFlash();

            this.particles.emitBurst(obj.x, obj.z, obj.type.neonColor, 15);
            this.audio.playAbsorbSmall(obj.type.size / 145);

            if (obj.type.size > 50) {
              this.camera.addTrauma(0.15);
              haptics.vibrateMedium();
            } else if (obj.type.size > 100) {
              this.camera.addTrauma(0.3);
              this.audio.playAbsorbLarge();
              haptics.vibrateLarge();
            } else {
              this.camera.addTrauma(0.05);
              haptics.vibrateSmall();
            }

            // Level up check
            if (this.player.level > this.prevLevel) {
              this.prevLevel = this.player.level;
              this.sizeUpCelebration.trigger(this.player.level);
              this.audio.playSizeUp();
              this.camera.addTrauma(0.4);
              this.renderer.setChromaticAberration(0.008);
              setTimeout(() => this.renderer.setChromaticAberration(0.001), 200);
              haptics.vibrateSizeUp();
            }
          }
        }
      }

      // ─── Player ↔ Enemies ───
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        const dist = distance(enemy.x, enemy.z, this.player.x, this.player.z);
        if (dist < Math.max(this.player.radius, enemy.radius)) {
          if (this.player.radius > enemy.radius + 8) {
            // Player eats bot
            enemy.isAlive = false;
            enemy.respawnTimer = 6000;
            this.player.eatenBotsCount++;
            this.player.addScore(450, 22);
            this.particles.emitBurst(enemy.x, enemy.z, enemy.color, 25);
            this.camera.addTrauma(0.4);
            this.audio.playBotKill();
            haptics.vibrateBotKill();
          } else if (enemy.radius > this.player.radius + 8) {
            // Bot eats player
            this.player.kill();
            enemy.score += 450;
            enemy.targetRadius = Math.min(MAX_HOLE_RADIUS, enemy.targetRadius + 22);
            this.particles.emitBurst(this.player.x, this.player.z, '#2FF5FF', 25);
            this.camera.addTrauma(0.5);
          }
        }
      }

      // ─── Player ↔ Powerups ───
      for (const pw of this.powerups) {
        if (pw.isEaten) continue;
        const dist = distance(pw.x, pw.z, this.player.x, this.player.z);
        if (dist < this.player.radius) {
          pw.isEaten = true;
          pw.mesh.visible = false;
          pw.glowLight.visible = false;
          this.particles.emitBurst(pw.x, pw.z, pw.color, 20);
          this.camera.addTrauma(0.15);
          this.audio.playPowerup();

          if (pw.type === 'MAGNET') this.magnetTimer = 15;
          else if (pw.type === 'SPEED') this.speedTimer = 15;
          else if (pw.type === 'MULTIPLIER') this.multiplierTimer = 15;
          this.hud.updatePowerups(this.magnetTimer, this.speedTimer, this.multiplierTimer);
        }
      }
    }

    // ─── Enemy ↔ Objects ───
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      for (const obj of objs) {
        if (obj.isEaten) continue;
        const dist = distance(obj.x, obj.z, enemy.x, enemy.z);
        if (dist < enemy.radius && enemy.radius > obj.type.size - 2) {
          obj.isEaten = true;
          obj.swallowProgress = 0.05;
          obj.eaterX = enemy.x;
          obj.eaterZ = enemy.z;
          enemy.score += obj.type.score;
          enemy.targetRadius = Math.min(MAX_HOLE_RADIUS, enemy.targetRadius + obj.type.growth);
        }
      }
    }

    // ─── Enemy ↔ Enemy ───
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i], b = enemies[j];
        if (!a.isAlive || !b.isAlive) continue;
        const dist = distance(a.x, a.z, b.x, b.z);
        if (dist < Math.max(a.radius, b.radius)) {
          if (a.radius > b.radius + 8) {
            b.isAlive = false; b.respawnTimer = 6000;
            a.score += 450; a.targetRadius = Math.min(MAX_HOLE_RADIUS, a.targetRadius + 22);
            this.particles.emitBurst(b.x, b.z, b.color, 15);
          } else if (b.radius > a.radius + 8) {
            a.isAlive = false; a.respawnTimer = 6000;
            b.score += 450; b.targetRadius = Math.min(MAX_HOLE_RADIUS, b.targetRadius + 22);
            this.particles.emitBurst(a.x, a.z, a.color, 15);
          }
        }
      }
    }

    // ─── Enemy ↔ Powerups ───
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      for (const pw of this.powerups) {
        if (pw.isEaten) continue;
        const dist = distance(pw.x, pw.z, enemy.x, enemy.z);
        if (dist < enemy.radius) {
          pw.isEaten = true; pw.mesh.visible = false; pw.glowLight.visible = false;
        }
      }
    }
  }

  // ─── GROUND ───
  private createGround(): void {
    const mapDef = MAP_DEFINITIONS[0];
    const baseRgb = this.hexToRgb(mapDef.groundColor);
    const gridRgb = this.hexToRgb(mapDef.gridColor);

    this.groundMaterial = new THREE.ShaderMaterial({
      vertexShader: groundVertShader,
      fragmentShader: groundFragShader,
      uniforms: {
        uTime: { value: 0 },
        uGridColor: { value: new THREE.Vector3(gridRgb.r, gridRgb.g, gridRgb.b) },
        uBaseColor: { value: new THREE.Vector3(baseRgb.r, baseRgb.g, baseRgb.b) },
        uHolePos: { value: new THREE.Vector3(MAP_SIZE / 2, 0, MAP_SIZE / 2) },
        uHoleRadius: { value: 24 },
        uHoleGlowColor: { value: new THREE.Vector3(0.48, 0.18, 1.0) },
      },
    });

    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const ground = new THREE.Mesh(geo, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_SIZE / 2, 0, MAP_SIZE / 2);
    ground.receiveShadow = true;
    this.renderer.scene.add(ground);
  }

  private updateGroundColors(mapDef: MapDefinition): void {
    const baseRgb = this.hexToRgb(mapDef.groundColor);
    const gridRgb = this.hexToRgb(mapDef.gridColor);
    this.groundMaterial.uniforms.uBaseColor.value.set(baseRgb.r, baseRgb.g, baseRgb.b);
    this.groundMaterial.uniforms.uGridColor.value.set(gridRgb.r, gridRgb.g, gridRgb.b);
  }

  private createBoundaryWalls(): void {
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x7B2FFF, transparent: true, opacity: 0.15 });
    const wallHeight = 40;
    const thickness = 5;
    const positions = [
      { x: MAP_SIZE / 2, z: 0, sx: MAP_SIZE, sz: thickness },
      { x: MAP_SIZE / 2, z: MAP_SIZE, sx: MAP_SIZE, sz: thickness },
      { x: 0, z: MAP_SIZE / 2, sx: thickness, sz: MAP_SIZE },
      { x: MAP_SIZE, z: MAP_SIZE / 2, sx: thickness, sz: MAP_SIZE },
    ];
    for (const p of positions) {
      const geo = new THREE.BoxGeometry(p.sx, wallHeight, p.sz);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(p.x, wallHeight / 2, p.z);
      this.renderer.scene.add(mesh);
    }
  }

  // ─── POWERUPS ───
  private spawnPowerup(): void {
    const keys = Object.keys(POWERUP_TYPES);
    const type = POWERUP_TYPES[keys[Math.floor(rand(0, keys.length))]];
    const x = rand(200, MAP_SIZE - 200);
    const z = rand(200, MAP_SIZE - 200);

    const geo = new THREE.OctahedronGeometry(8, 0);
    const mat = new THREE.MeshToonMaterial({ color: new THREE.Color(type.color), emissive: new THREE.Color(type.color), emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 10, z);
    this.renderer.scene.add(mesh);

    const light = new THREE.PointLight(new THREE.Color(type.color).getHex(), 0.8, 60);
    light.position.set(x, 12, z);
    this.renderer.scene.add(light);

    this.powerups.push({ type: type.type, x, z, color: type.color, symbol: type.symbol, label: type.label, isEaten: false, mesh, glowLight: light });
  }

  private clearPowerups(): void {
    for (const pw of this.powerups) {
      this.renderer.scene.remove(pw.mesh);
      this.renderer.scene.remove(pw.glowLight);
      pw.mesh.geometry.dispose();
      (pw.mesh.material as THREE.Material).dispose();
    }
    this.powerups = [];
  }

  private getSafeSpawn(radius: number): { x: number; z: number } {
    let x: number, z: number;
    do {
      x = rand(radius + 50, MAP_SIZE - radius - 50);
      z = rand(radius + 50, MAP_SIZE - radius - 50);
    } while (Math.hypot(x - MAP_SIZE / 2, z - MAP_SIZE / 2) < 300);
    return { x, z };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 };
  }
}
