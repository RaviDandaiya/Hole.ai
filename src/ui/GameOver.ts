export class GameOverScreen {
  private el: HTMLDivElement;
  private onPlayAgain: (() => void) | null = null;
  private onMainMenu: (() => void) | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'game-over-screen';
    this.el.classList.add('hidden');
    document.getElementById('app')!.appendChild(this.el);
  }

  setCallbacks(playAgain: () => void, mainMenu: () => void): void {
    this.onPlayAgain = playAgain;
    this.onMainMenu = mainMenu;
  }

  show(stats: { placement: number; score: number; level: number; currencyEarned: number; eatenBots: number }): void {
    const placementText = stats.placement === 1 ? '🏆 1ST PLACE' :
      stats.placement === 2 ? '🥈 2ND PLACE' :
      stats.placement === 3 ? '🥉 3RD PLACE' : '🎖️ 4TH PLACE';

    this.el.innerHTML = `<div class="gameover-card">
      <div class="gameover-title">ROUND FINISHED</div>
      <div class="gameover-placement">${placementText}</div>
      <div class="gameover-stats">
        <div class="gameover-stat"><span class="gameover-stat-label">FINAL SCORE</span><span class="gameover-stat-value">${stats.score}</span></div>
        <div class="gameover-stat"><span class="gameover-stat-label">MAX LEVEL</span><span class="gameover-stat-value">LV.${stats.level + 1}</span></div>
        <div class="gameover-stat"><span class="gameover-stat-label">BOTS DEVOURED</span><span class="gameover-stat-value">${stats.eatenBots}</span></div>
        <div class="gameover-stat"><span class="gameover-stat-label">DARK MATTER</span><span class="gameover-stat-value gold">+💎 ${stats.currencyEarned}</span></div>
      </div>
      <div class="gameover-buttons">
        <button class="gameover-btn primary" id="go-play-again">PLAY AGAIN</button>
        <button class="gameover-btn secondary" id="go-main-menu">MAIN MENU</button>
      </div>
    </div>`;

    this.el.classList.remove('hidden');
    requestAnimationFrame(() => { this.el.classList.add('visible'); });

    this.el.querySelector('#go-play-again')?.addEventListener('click', () => this.onPlayAgain?.());
    this.el.querySelector('#go-main-menu')?.addEventListener('click', () => this.onMainMenu?.());
  }

  hide(): void {
    this.el.classList.remove('visible');
    this.el.classList.add('hidden');
  }
}
