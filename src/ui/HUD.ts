import { GAME_DURATION, MAX_HOLE_RADIUS } from '../utils/constants';

export interface LeaderboardEntry {
  name: string;
  score: number;
  isPlayer: boolean;
}

export class HUD {
  private el: HTMLDivElement;
  private scoreEl: HTMLDivElement;
  private timerTextEl: HTMLDivElement;
  private timerRingEl: SVGCircleElement;
  private leaderboardEl: HTMLDivElement;
  private sizeFillEl: HTMLDivElement;
  private powerupsEl: HTMLDivElement;
  private muteBtn: HTMLDivElement;
  private onMuteToggle: (() => void) | null = null;
  private isMuted = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'game-hud';
    this.el.classList.add('hidden');

    const circumference = 2 * Math.PI * 24;
    this.el.innerHTML = `
      <div class="hud-mute-btn" id="mute-btn">🔊</div>
      <div class="hud-score" id="hud-score">0</div>
      <div class="hud-timer" id="hud-timer">
        <svg class="hud-timer-ring" viewBox="0 0 56 56">
          <circle class="bg" cx="28" cy="28" r="24"/>
          <circle class="fg" id="timer-ring" cx="28" cy="28" r="24"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="0"/>
        </svg>
        <div class="hud-timer-text" id="timer-text">2:00</div>
      </div>
      <div class="hud-leaderboard" id="hud-leaderboard"></div>
      <div class="hud-size-meter"><div class="hud-size-fill" id="hud-size-fill"></div></div>
      <div class="hud-powerups" id="hud-powerups"></div>
    `;
    document.getElementById('app')!.appendChild(this.el);

    this.scoreEl = this.el.querySelector('#hud-score')!;
    this.timerTextEl = this.el.querySelector('#timer-text')!;
    this.timerRingEl = this.el.querySelector('#timer-ring')!;
    this.leaderboardEl = this.el.querySelector('#hud-leaderboard')!;
    this.sizeFillEl = this.el.querySelector('#hud-size-fill')!;
    this.powerupsEl = this.el.querySelector('#hud-powerups')!;
    this.muteBtn = this.el.querySelector('#mute-btn')!;

    this.muteBtn.addEventListener('click', () => {
      this.onMuteToggle?.();
      this.isMuted = !this.isMuted;
      this.muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
    });
  }

  setOnMuteToggle(cb: () => void): void { this.onMuteToggle = cb; }
  show(): void { this.el.classList.remove('hidden'); }
  hide(): void { this.el.classList.add('hidden'); }

  updateScore(score: number): void {
    this.scoreEl.textContent = score.toString();
  }

  updateTimer(secondsLeft: number, totalDuration: number = GAME_DURATION): void {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    this.timerTextEl.textContent = secondsLeft < 0 ? '∞' : `${m}:${s.toString().padStart(2, '0')}`;

    // Ring progress
    const circumference = 2 * Math.PI * 24;
    const progress = totalDuration > 0 ? secondsLeft / totalDuration : 1;
    this.timerRingEl.style.strokeDashoffset = (circumference * (1 - progress)).toString();

    // Color transitions
    if (secondsLeft <= 10) {
      this.timerRingEl.style.stroke = '#EF4444';
      this.timerTextEl.style.color = '#EF4444';
    } else if (secondsLeft <= 30) {
      this.timerRingEl.style.stroke = '#F59E0B';
      this.timerTextEl.style.color = '#F59E0B';
    } else {
      this.timerRingEl.style.stroke = '#33FF33';
      this.timerTextEl.style.color = '#fff';
    }
  }

  updateLeaderboard(entries: LeaderboardEntry[]): void {
    this.leaderboardEl.innerHTML = entries.slice(0, 5).map((e, i) => {
      const cls = e.isPlayer ? ' player' : '';
      const colors = ['#39FF14', '#BF00FF', '#F59E0B', '#aaa', '#888'];
      return `<div class="hud-lb-row${cls}">
        <span class="hud-lb-rank" style="color:${colors[i] || '#888'}">${i + 1}</span>
        <span class="hud-lb-name">${e.name}</span>
        <span class="hud-lb-score">${e.score}</span>
      </div>`;
    }).join('');
  }

  updateSize(currentRadius: number): void {
    const pct = Math.min(100, (currentRadius / MAX_HOLE_RADIUS) * 100);
    this.sizeFillEl.style.width = `${pct}%`;
  }

  updatePowerups(magnet: number, speed: number, multiplier: number): void {
    let html = '';
    if (magnet > 0) html += this.powerupRow('🧲', magnet, 15, '#FF007F');
    if (speed > 0) html += this.powerupRow('⚡', speed, 15, '#00F0FF');
    if (multiplier > 0) html += this.powerupRow('💎', multiplier, 15, '#FFD700');
    this.powerupsEl.innerHTML = html;
  }

  private powerupRow(icon: string, current: number, max: number, color: string): string {
    const pct = (current / max) * 100;
    return `<div class="hud-powerup-row">
      <span class="hud-powerup-icon">${icon}</span>
      <div class="hud-powerup-bar"><div class="hud-powerup-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="hud-powerup-time">${current}s</span>
    </div>`;
  }
}
