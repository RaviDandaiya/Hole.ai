import * as THREE from 'three';
import { Renderer } from './Renderer';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { AudioManager } from './AudioManager';
import { Hole } from '../entities/Hole';
import { WorldObjectManager, WorldObjectData } from '../entities/WorldObject';
import { EnemyManager } from '../entities/Enemy';
import { ParticleSystem } from '../systems/ParticleSystem';
import { HazardManager } from '../entities/HazardManager';
import { LoadingScreen } from '../ui/LoadingScreen';
import { MainMenu, GameMode } from '../ui/MainMenu';
import { HUD, LeaderboardEntry } from '../ui/HUD';
import { GameOverScreen } from '../ui/GameOver';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { SizeUpCelebration } from '../ui/SizeUpCelebration';
import {
  GameState, MAP_DEFINITIONS, MAP_SIZE, GAME_DURATION, BOT_COUNT,
  POWERUP_TYPES, LEVEL_THRESHOLDS, LEVEL_NAMES, isMobileDevice, MapDefinition,
  MAX_HOLE_RADIUS, SKINS,
} from '../utils/constants';
import { rand, distance } from '../utils/math';
import * as storage from '../utils/storage';
import * as haptics from '../utils/haptics';
import { SpatialGrid } from '../utils/SpatialGrid';

import groundVertShader from '../shaders/ground.vert.glsl';
import groundFragShader from '../shaders/ground.frag.glsl';
import { io, Socket } from 'socket.io-client';
import { MultiplayerLobby } from '../ui/MultiplayerLobby';

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
  private hazards!: HazardManager;

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
  private isPaused = false;
  private timeLeft: number = GAME_DURATION;
  private timerInterval: number = 0;
  private powerups: PowerupInstance[] = [];
  private magnetTimer = 0;
  private speedTimer = 0;
  private multiplierTimer = 0;
  private freezeTimer = 0;
  private ghostTimer = 0;
  private pulseTimer = 0;
  private prevLevel = 0;
  private hudUpdateCounter = 0;
  private spatialGrid = new SpatialGrid<any>(200);
  private socket: Socket | null = null;
  private remotePlayers: Map<string, { hole: Hole; labelDiv: HTMLDivElement }> = new Map();
  private lobby: MultiplayerLobby;
  private isHost = false;

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
    this.lobby = new MultiplayerLobby();

    // ─── Entities ───
    this.player = new Hole(this.renderer.scene, storage.getEquippedSkin());
    this.objects = new WorldObjectManager(this.renderer.scene);
    this.enemies = new EnemyManager(this.renderer.scene);
    this.hazards = new HazardManager(this.renderer.scene, this.particles);

    (window as any).gameCamera = this.camera;
    (window as any).gameAudio = this.audio;

    // ─── Ground plane ───
    this.createGround();

    // ─── Map boundary walls ───
    this.createBoundaryWalls();

    // ─── Callbacks ───
    this.mainMenu.setOnPlay((mode, mapId, skinId) => {
      this.startGame(mode, mapId, skinId);
    });
    this.mainMenu.setOnMapSelect((mapId) => {
      this.selectedMapId = mapId;
      const mapDef = MAP_DEFINITIONS.find(m => m.id === mapId);
      if (mapDef) {
        this.updateGroundColors(mapDef);
      }
    });
    this.gameOverScreen.setCallbacks(
      () => this.startGame(this.gameMode, this.selectedMapId, this.equippedSkin),
      () => this.showMenu()
    );
    this.hud.setOnMuteToggle(() => this.audio.toggleMute());
    this.hud.setOnExitClick(() => {
      this.isPaused = true;
      this.audio.stopAmbient();
    });
    this.hud.setOnExitCancel(() => {
      this.isPaused = false;
      this.audio.startAmbient();
    });
    this.hud.setOnExitConfirm(() => {
      this.isPaused = false;
      this.showMenu();
    });

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
    this.lobby.hide();
    this.gameOverScreen.hide();
    this.player.mesh.visible = false;
    this.player.voidMesh.visible = false;
    this.player.glowLight.visible = false;
    this.enemies.clear();
    this.objects.clear();
    this.hazards.clear();
    this.clearPowerups();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.audio.stopAmbient();

    if (this.groundMaterial) {
      this.groundMaterial.uniforms.uHolesCount.value = 0;
    }

    // Restore ground colors to match active selected map
    const mapDef = MAP_DEFINITIONS.find(m => m.id === this.selectedMapId) || MAP_DEFINITIONS[0];
    this.updateGroundColors(mapDef);

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.remotePlayers.forEach(rp => {
      rp.hole.dispose();
      this.renderer.scene.remove(rp.hole.mesh);
      this.renderer.scene.remove(rp.hole.voidMesh);
      this.renderer.scene.remove(rp.hole.glowLight);
      rp.labelDiv.remove();
    });
    this.remotePlayers.clear();
    if (this.keyboardHint) this.keyboardHint.remove();
  }

  private startGame(mode: GameMode, mapId: string, skinId: string): void {
    this.gameMode = mode;
    this.selectedMapId = mapId;
    this.equippedSkin = skinId;

    const mapDef = MAP_DEFINITIONS.find(m => m.id === mapId) || MAP_DEFINITIONS[0];

    if (mode === 'multiplayer') {
      this.state = GameState.MENU;
      this.mainMenu.hide();
      this.gameOverScreen.hide();
      this.hud.hide();
      
      this.lobby.showSetup();
      this.lobby.setCallbacks(
        (name) => {
          this.socket = io('http://localhost:3002');
          this.setupSocketEvents(mapDef);
          this.socket.on('connect', () => {
            this.socket!.emit('createRoom', { name, skin: this.equippedSkin });
          });
        },
        (name, code) => {
          this.socket = io('http://localhost:3002');
          this.setupSocketEvents(mapDef);
          this.socket.on('connect', () => {
            this.socket!.emit('joinRoom', { name, roomCode: code, skin: this.equippedSkin });
          });
        },
        () => {
          if (this.socket && this.isHost) {
            this.socket.emit('startMatch');
          }
        },
        () => {
          this.showMenu();
        }
      );
      return;
    }

    this.state = GameState.PLAYING;
    this.mainMenu.hide();
    this.gameOverScreen.hide();
    this.hud.show();
    this.isPaused = false;

    // Reset player
    this.player.reset(skinId);
    this.prevLevel = 0;

    // Apply starting perks
    const activePerk = storage.getActivePerk();
    if (activePerk === 'SIZE_PERK') {
      this.player.radius = 29;
      this.player.targetRadius = 29;
      this.player.mesh.scale.set(29 * 2.5, 29 * 2.5, 1);
    }
    this.player.speedMultiplier = activePerk === 'SPEED_PERK' ? 1.15 : 1.0;

    this.objects.populate(mapDef.objects, MAP_SIZE);
    this.enemies.createBots(BOT_COUNT);

    // Reset powerups
    this.clearPowerups();
    this.magnetTimer = 0;
    this.speedTimer = 0;
    this.multiplierTimer = 0;
    this.freezeTimer = 0;
    this.ghostTimer = 0;
    this.pulseTimer = 0;

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

  private startMultiplayerMatch(data: any, mapDef: MapDefinition): void {
    this.state = GameState.PLAYING;
    this.lobby.hide();
    this.hud.show();
    this.isPaused = false;

    // Reset player
    this.player.reset(this.equippedSkin);
    this.prevLevel = 0;

    // Apply starting perks
    const activePerk = storage.getActivePerk();
    if (activePerk === 'SIZE_PERK') {
      this.player.radius = 29;
      this.player.targetRadius = 29;
      this.player.mesh.scale.set(29 * 2.5, 29 * 2.5, 1);
    }
    this.player.speedMultiplier = activePerk === 'SPEED_PERK' ? 1.15 : 1.0;

    // Populate objects
    this.objects.populateFromShared(data.objects, mapDef.objects);

    // Add initial remote players (humans)
    Object.keys(data.players).forEach(id => {
      if (id !== this.socket!.id) {
        this.addRemotePlayer(id, data.players[id]);
      }
    });

    // If host, create remaining slots as bots
    if (this.isHost) {
      const humanCount = Object.keys(data.players).length;
      const botCountToSpawn = Math.max(0, 6 - humanCount);
      console.log(`Spawning ${botCountToSpawn} bots in room as Host`);
      this.enemies.createBots(botCountToSpawn);
    }

    // Reset powerups
    this.clearPowerups();
    this.magnetTimer = 0;
    this.speedTimer = 0;
    this.multiplierTimer = 0;
    this.freezeTimer = 0;
    this.ghostTimer = 0;
    this.pulseTimer = 0;

    // Update ground colors
    this.updateGroundColors(mapDef);

    // Timer
    this.timeLeft = GAME_DURATION;
    this.hud.updateTimer(this.timeLeft);
    this.hud.updateScore(0);
    this.hud.updateSize(this.player.radius);

    this.timerInterval = window.setInterval(() => this.timerTick(), 1000);

    // Audio
    this.audio.startAmbient();

    // Keyboard hint
    if (!isMobileDevice()) {
      this.keyboardHint = document.createElement('div');
      this.keyboardHint.className = 'keyboard-hint';
      this.keyboardHint.textContent = '⌨️ WASD / Arrows or mouse drag to steer';
      document.getElementById('app')!.appendChild(this.keyboardHint);
      setTimeout(() => { if (this.keyboardHint) { this.keyboardHint.style.opacity = '0'; setTimeout(() => this.keyboardHint?.remove(), 500); } }, 5000);
    }
  }

  private setupSocketEvents(mapDef: MapDefinition): void {
    if (!this.socket) return;

    this.socket.on('roomCreated', (data) => {
      this.isHost = true;
      this.lobby.showLobby(data.roomCode, true, data.players);
    });

    this.socket.on('roomJoined', (data) => {
      this.isHost = false;
      this.lobby.showLobby(data.roomCode, false, data.players);
    });

    this.socket.on('playerJoinedRoom', (data) => {
      this.lobby.updatePlayersList(data.players);
    });

    this.socket.on('playerDisconnected', (id) => {
      const rp = this.remotePlayers.get(id);
      if (rp) {
        rp.hole.dispose();
        this.renderer.scene.remove(rp.hole.mesh);
        this.renderer.scene.remove(rp.hole.voidMesh);
        this.renderer.scene.remove(rp.hole.glowLight);
        rp.labelDiv.remove();
        this.remotePlayers.delete(id);
      }
    });

    this.socket.on('joinRoomError', (data) => {
      this.lobby.showError(data.message);
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    });

    this.socket.on('roomClosed', () => {
      alert('Host left. Room closed.');
      this.showMenu();
    });

    this.socket.on('matchStarted', (data) => {
      this.startMultiplayerMatch(data, mapDef);
    });

    this.socket.on('playerUpdated', (data) => {
      let rp = this.remotePlayers.get(data.id);
      if (!rp) {
        this.addRemotePlayer(data.id, data);
        rp = this.remotePlayers.get(data.id);
      }
      if (rp) {
        rp.hole.x = data.x;
        rp.hole.z = data.z;
        rp.hole.targetRadius = data.radius;
        rp.hole.score = data.score;
        rp.hole.isAlive = data.isAlive;
        rp.hole.vx = data.vx || 0;
        rp.hole.vz = data.vz || 0;
      }
    });

    this.socket.on('objectEaten', (data) => {
      const { objectId, eaterId, x, z } = data;
      const obj = this.objects.getObjects().find(o => o.id === objectId);
      if (obj && !obj.isEaten) {
        obj.isEaten = true;
        obj.swallowProgress = 0.05;
        obj.eaterX = x;
        obj.eaterZ = z;
        
        this.particles.emitBurst(obj.x, obj.z, obj.type.neonColor, 15);
        this.audio.playAbsorbSmall(obj.type.size / 145);
        
        if (eaterId !== this.socket!.id) {
          const rp = this.remotePlayers.get(eaterId);
          if (rp) rp.hole.addScore(obj.type.score, obj.type.growth);
        }
      }
    });

    this.socket.on('objectRespawned', (data) => {
      const { objectId, x, z } = data;
      const obj = this.objects.getObjects().find(o => o.id === objectId);
      if (obj) {
        obj.x = x; obj.z = z;
        obj.isEaten = false; obj.swallowProgress = 0;
        obj.spinSpeed = 0; obj.tiltX = 0; obj.tiltZ = 0;
        obj.mesh.scale.setScalar(1);
        obj.mesh.rotation.set(0, 0, 0);
        obj.mesh.position.set(x, 0, z);
        obj.justRespawned = true;
      }
    });

    this.socket.on('playerEaten', (data) => {
      const { targetId, eaterId } = data;
      if (targetId === this.socket!.id) {
        this.player.kill();
        this.particles.emitBurst(this.player.x, this.player.z, '#FF00FF', 25);
        this.camera.addTrauma(0.5);
        
        setTimeout(() => {
          if (this.state === GameState.PLAYING) {
            const sp = this.getSafeSpawn(this.player.radius);
            this.player.respawn(sp.x, sp.z);
            this.socket!.emit('respawn');
          }
        }, 3500);
      } else {
        const rp = this.remotePlayers.get(targetId);
        if (rp) {
          rp.hole.isAlive = false;
          this.particles.emitBurst(rp.hole.x, rp.hole.z, '#2FF5FF', 25);
        }
        if (eaterId === this.socket!.id) {
          this.player.addScore(450, 22);
          this.camera.addTrauma(0.4);
          this.audio.playBotKill();
          haptics.vibrateBotKill();
        } else {
          const eater = this.remotePlayers.get(eaterId);
          if (eater) eater.hole.addScore(450, 22);
        }
      }
    });
  }

  private timerTick(): void {
    if (this.isPaused) return;
    if (this.timeLeft <= 0) return;
    this.timeLeft--;
    this.hud.updateTimer(this.timeLeft);

    // Powerup timers
    if (this.magnetTimer > 0) this.magnetTimer--;
    if (this.speedTimer > 0) this.speedTimer--;
    if (this.multiplierTimer > 0) this.multiplierTimer--;
    if (this.freezeTimer > 0) this.freezeTimer--;
    if (this.ghostTimer > 0) this.ghostTimer--;
    if (this.pulseTimer > 0) this.pulseTimer--;
    this.hud.updatePowerups(
      this.magnetTimer, this.speedTimer, this.multiplierTimer,
      this.freezeTimer, this.ghostTimer, this.pulseTimer
    );

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
    if (this.isPaused) return;
    const input = this.input.getInput();

    // ─── Player update ───
    this.player.update(dt, input.dx, input.dy, time, this.speedTimer > 0);

    // Ghost skin color feedback
    if (this.player.isAlive) {
      if (this.ghostTimer > 0) {
        const flash = Math.sin(time * 15) * 0.5 + 0.5;
        this.player.material.uniforms.uRimColor.value.set(1.0, 0.0, 1.0); // magenta
        this.player.material.uniforms.uRimColor2.value.set(0.2 + flash * 0.8, 0.8 + flash * 0.2, 1.0); // bright neon cyan/white
      } else {
        const skin = SKINS.find(s => s.id === this.equippedSkin) || SKINS[0];
        const p = this.hexToRgb(skin.primary);
        const s2 = this.hexToRgb(skin.secondary);
        this.player.material.uniforms.uRimColor.value.set(p.r, p.g, p.b);
        this.player.material.uniforms.uRimColor2.value.set(s2.r, s2.g, s2.b);
      }
    }

    // Respawn check
    if (!this.player.isAlive && this.player.respawnTimer <= 0) {
      const sp = this.getSafeSpawn(this.player.radius);
      this.player.respawn(sp.x, sp.z);
    }

    // ─── Trail particles ───
    if (this.player.isAlive && input.isActive) {
      if (this.pulseTimer > 0) {
        if (Math.random() < 0.2) {
          this.particles.emitPulseWave(this.player.x, this.player.z, '#FFFFFF');
        }
      }
      this.particles.emitTrail(this.player.x, this.player.z, this.player.getRimColor(), storage.getEquippedTrail());
    }

    // ─── Objects update ───
    this.objects.update(dt, MAP_SIZE, this.player.x, this.player.z, this.player.radius);

    // ─── Populate SpatialGrid ───
    this.spatialGrid.clear();
    for (const obj of this.objects.getObjects()) {
      if (!obj.isEaten) this.spatialGrid.insert(obj);
    }

    // ─── Enemies update ───
    if (this.gameMode !== 'multiplayer') {
      this.enemies.update(
        dt, time, this.player.x, this.player.z, this.player.radius,
        this.player.isAlive, this.spatialGrid, this.renderer.camera,
        this.freezeTimer > 0
      );
    } else {
      // Broadcast player state to server
      if (this.socket?.connected) {
        this.socket.emit('update', {
          x: this.player.x,
          z: this.player.z,
          radius: this.player.radius,
          score: this.player.score,
          vx: this.player.vx,
          vz: this.player.vz,
          isAlive: this.player.isAlive
        });
      }

      // If host, update and sync bots
      if (this.isHost && this.socket?.connected) {
        this.enemies.update(
          dt, time, this.player.x, this.player.z, this.player.radius,
          this.player.isAlive, this.spatialGrid, this.renderer.camera,
          this.freezeTimer > 0
        );

        // Emit bot updates
        const botList = this.enemies.getEnemies().map(b => ({
          id: `bot_${b.id}`,
          name: b.name,
          x: b.x,
          z: b.z,
          radius: b.radius,
          score: b.score,
          isAlive: b.isAlive,
          vx: b.vx,
          vz: b.vz,
          color: b.color
        }));
        this.socket.emit('syncBots', { bots: botList });
      }

      // Update remote player meshes and labels
      this.remotePlayers.forEach((rp) => {
        rp.hole.update(dt, 0, 0, time, false);
        // Do not override y-position to 0.5, keep it recessed as updated by hole.update()
        rp.hole.mesh.visible = rp.hole.isAlive;
        rp.hole.voidMesh.visible = rp.hole.isAlive;
        rp.hole.glowLight.visible = rp.hole.isAlive;

        if (rp.hole.isAlive) {
          const pos = new THREE.Vector3(rp.hole.x, 20, rp.hole.z);
          pos.project(this.renderer.camera);
          const px = (pos.x * 0.5 + 0.5) * window.innerWidth;
          const py = (-pos.y * 0.5 + 0.5) * window.innerHeight;
          if (pos.z < 1) {
            rp.labelDiv.style.display = 'block';
            rp.labelDiv.style.left = `${px}px`;
            rp.labelDiv.style.top = `${py - 20}px`;
            rp.labelDiv.style.transform = 'translateX(-50%)';
          } else {
            rp.labelDiv.style.display = 'none';
          }
        } else {
          rp.labelDiv.style.display = 'none';
        }
      });
    }

    // ─── Hazards update ───
    this.hazards.update(dt, this.player, this.enemies.getEnemies(), this.camera, this.gameMode === 'multiplayer', this.socket);

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
    
    // Pack active holes positions, radii and count
    const holesPos = this.groundMaterial.uniforms.uHolesPos.value as THREE.Vector3[];
    const holesRadius = this.groundMaterial.uniforms.uHolesRadius.value as Float32Array;
    let holesCount = 0;

    // 1. Player
    if (this.player.isAlive) {
      holesPos[holesCount].set(this.player.x, 0, this.player.z);
      holesRadius[holesCount] = this.player.radius;
      holesCount++;
    }

    // 2. Local Bots
    if (this.gameMode !== 'multiplayer' || this.isHost) {
      for (const bot of this.enemies.getEnemies()) {
        if (bot.isAlive && holesCount < 6) {
          holesPos[holesCount].set(bot.x, 0, bot.z);
          holesRadius[holesCount] = bot.radius;
          holesCount++;
        }
      }
    }

    // 3. Remote Players
    if (this.gameMode === 'multiplayer') {
      this.remotePlayers.forEach((rp) => {
        if (rp.hole.isAlive && holesCount < 6) {
          holesPos[holesCount].set(rp.hole.x, 0, rp.hole.z);
          holesRadius[holesCount] = rp.hole.radius;
          holesCount++;
        }
      });
    }

    this.groundMaterial.uniforms.uHolesCount.value = holesCount;

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

      const lb: LeaderboardEntry[] = this.gameMode === 'multiplayer' ? [
        { name: 'You', score: this.player.score, isPlayer: true },
        ...Array.from(this.remotePlayers.values()).map(rp => ({ name: rp.labelDiv.textContent || 'Player', score: rp.hole.score, isPlayer: false })),
        ...(this.isHost ? this.enemies.getEnemies().map(e => ({ name: e.name, score: e.score, isPlayer: false })) : [])
      ].sort((a, b) => b.score - a.score) : [
        { name: 'You', score: this.player.score, isPlayer: true },
        ...this.enemies.getEnemies().map(e => ({ name: e.name, score: e.score, isPlayer: false })),
      ].sort((a, b) => b.score - a.score);
      this.hud.updateLeaderboard(lb);
    }

    // ─── Chromatic aberration reset ───
    this.renderer.setChromaticAberration(0.001);
  }

  private handleCollisions(dt: number): void {
    const enemies = this.enemies.getEnemies();

    // ─── Player ↔ Objects ───
    if (this.player.isAlive) {
      let pull = this.player.radius * 1.5;
      if (this.magnetTimer > 0) pull *= 2.0;
      if (storage.getActivePerk() === 'MAGNET_PERK') pull *= 1.25;
      if (this.pulseTimer > 0) pull = Math.max(pull, 800);
      
      const nearbyObjs = this.spatialGrid.query(this.player.x, this.player.z, pull);
      for (const obj of nearbyObjs) {
        if (obj.isEaten) continue;
        const dist = distance(obj.x, obj.z, this.player.x, this.player.z);
        let objPull = this.player.radius * 1.5;
        if (this.magnetTimer > 0) objPull *= 2.0;
        if (storage.getActivePerk() === 'MAGNET_PERK') objPull *= 1.25;
        if (this.pulseTimer > 0) objPull = Math.max(objPull, 800);

        if (dist < objPull && this.player.radius > obj.type.size - 2) {
          // Gravitational pull
          const pullForce = this.pulseTimer > 0 ? 15 : 7;
          const force = Math.max(0.1, 1 - dist / objPull) * pullForce;
          const angle = Math.atan2(this.player.z - obj.z, this.player.x - obj.x);
          obj.x += Math.cos(angle) * force;
          obj.z += Math.sin(angle) * force;

          if (dist < this.player.radius * 0.96) {
            obj.isEaten = true;
            obj.swallowProgress = 0.05;
            obj.eaterX = this.player.x;
            obj.eaterZ = this.player.z;

            // Emit to server if multiplayer
            if (this.gameMode === 'multiplayer' && this.socket?.connected) {
              this.socket.emit('eatObject', { objectId: obj.id, eaterId: this.socket.id });
            }

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

      // ─── Player ↔ Enemies (Local Bots) ───
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        const dist = distance(enemy.x, enemy.z, this.player.x, this.player.z);
        if (dist < Math.max(this.player.radius, enemy.radius)) {
          if (this.player.radius > enemy.radius + 8) {
            // Player eats bot
            if (this.gameMode === 'multiplayer') {
              if (this.socket?.connected) {
                this.socket.emit('eatPlayer', { eaterId: this.socket.id, targetId: `bot_${enemy.id}` });
              }
            } else {
              enemy.isAlive = false;
              enemy.respawnTimer = 6000;
              this.player.eatenBotsCount++;
              this.player.addScore(450, 22);
              this.particles.emitBurst(enemy.x, enemy.z, enemy.color, 25);
              this.camera.addTrauma(0.4);
              this.audio.playBotKill();
              haptics.vibrateBotKill();
            }
          } else if (enemy.radius > this.player.radius + 8) {
            // Bot eats player
            if (this.ghostTimer <= 0) {
              if (this.gameMode === 'multiplayer') {
                if (this.isHost && this.socket?.connected) {
                  this.socket.emit('eatPlayer', { eaterId: `bot_${enemy.id}`, targetId: this.socket.id });
                }
              } else {
                this.player.kill();
                enemy.score += 450;
                enemy.targetRadius = Math.min(MAX_HOLE_RADIUS, enemy.targetRadius + 22);
                this.particles.emitBurst(this.player.x, this.player.z, '#2FF5FF', 25);
                this.camera.addTrauma(0.5);
              }
            }
          }
        }
      }

      // ─── Player ↔ Remote Players (including bots for guests) ───
      if (this.gameMode === 'multiplayer') {
        this.remotePlayers.forEach((rp, id) => {
          if (!rp.hole.isAlive) return;
          const dist = distance(rp.hole.x, rp.hole.z, this.player.x, this.player.z);
          if (dist < Math.max(this.player.radius, rp.hole.radius)) {
            if (this.player.radius > rp.hole.radius + 8) {
              // Player eats remote player/bot
              if (this.socket?.connected) {
                this.socket.emit('eatPlayer', { eaterId: this.socket.id, targetId: id });
              }
            } else if (rp.hole.radius > this.player.radius + 8) {
              // Remote player/bot eats player
              if (this.ghostTimer <= 0) {
                if (this.socket?.connected) {
                  this.socket.emit('eatPlayer', { eaterId: id, targetId: this.socket.id });
                }
              }
            }
          }
        });
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
          else if (pw.type === 'FREEZE') this.freezeTimer = 10;
          else if (pw.type === 'GHOST') this.ghostTimer = 10;
          else if (pw.type === 'PULSE') this.pulseTimer = 2;
          
          this.hud.updatePowerups(
            this.magnetTimer, this.speedTimer, this.multiplierTimer,
            this.freezeTimer, this.ghostTimer, this.pulseTimer
          );
        }
      }
    }

    // ─── Enemy ↔ Objects ───
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      const nearbyObjs = this.spatialGrid.query(enemy.x, enemy.z, enemy.radius);
      for (const obj of nearbyObjs) {
        if (obj.isEaten) continue;
        const dist = distance(obj.x, obj.z, enemy.x, enemy.z);
        if (dist < enemy.radius && enemy.radius > obj.type.size - 2) {
          if (this.gameMode === 'multiplayer') {
            if (this.isHost && this.socket?.connected) {
              this.socket.emit('eatObject', { objectId: obj.id, eaterId: `bot_${enemy.id}` });
            }
          } else {
            obj.isEaten = true;
            obj.swallowProgress = 0.05;
            obj.eaterX = enemy.x;
            obj.eaterZ = enemy.z;
            enemy.score += obj.type.score;
            enemy.targetRadius = Math.min(MAX_HOLE_RADIUS, enemy.targetRadius + obj.type.growth);
          }
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
            if (this.gameMode === 'multiplayer') {
              if (this.isHost && this.socket?.connected) {
                this.socket.emit('eatPlayer', { eaterId: `bot_${a.id}`, targetId: `bot_${b.id}` });
              }
            } else {
              b.isAlive = false; b.respawnTimer = 6000;
              a.score += 450; a.targetRadius = Math.min(MAX_HOLE_RADIUS, a.targetRadius + 22);
              this.particles.emitBurst(b.x, b.z, b.color, 15);
            }
          } else if (b.radius > a.radius + 8) {
            if (this.gameMode === 'multiplayer') {
              if (this.isHost && this.socket?.connected) {
                this.socket.emit('eatPlayer', { eaterId: `bot_${b.id}`, targetId: `bot_${a.id}` });
              }
            } else {
              a.isAlive = false; a.respawnTimer = 6000;
              b.score += 450; b.targetRadius = Math.min(MAX_HOLE_RADIUS, b.targetRadius + 22);
              this.particles.emitBurst(a.x, a.z, a.color, 15);
            }
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

    // ─── Remote Player ↔ Powerups (multiplayer only) ───
    if (this.gameMode === 'multiplayer') {
      this.remotePlayers.forEach((rp) => {
        if (!rp.hole.isAlive) return;
        for (const pw of this.powerups) {
          if (pw.isEaten) continue;
          const dist = distance(pw.x, pw.z, rp.hole.x, rp.hole.z);
          if (dist < rp.hole.radius) {
            pw.isEaten = true; pw.mesh.visible = false; pw.glowLight.visible = false;
          }
        }
      });
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
        uHolesPos: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
        uHolesRadius: { value: new Float32Array(6) },
        uHolesCount: { value: 0 },
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

  private addRemotePlayer(id: string, data: any): void {
    const hole = new Hole(this.renderer.scene, data.skin);
    hole.reset(data.skin);
    hole.x = data.x;
    hole.z = data.z;
    hole.radius = data.radius;
    hole.targetRadius = data.radius;
    hole.score = data.score;
    hole.isAlive = data.isAlive;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'bot-label remote-player-label';
    labelDiv.textContent = data.name;
    labelDiv.style.cssText = `position:fixed;pointer-events:none;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#fff;text-shadow:0 0 8px #FF00FF;z-index:10;display:none;white-space:nowrap;`;
    document.getElementById('app')?.appendChild(labelDiv);

    this.remotePlayers.set(id, { hole, labelDiv });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 };
  }
}
