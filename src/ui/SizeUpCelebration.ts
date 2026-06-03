import { SIZE_TIER_LABELS } from '../utils/constants';

export class SizeUpCelebration {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'size-up-container';
    document.getElementById('app')!.appendChild(this.container);
  }

  trigger(levelIndex: number): void {
    const label = SIZE_TIER_LABELS[Math.min(levelIndex, SIZE_TIER_LABELS.length - 1)];
    const overlay = document.createElement('div');
    overlay.className = 'size-up-overlay';
    overlay.innerHTML = `
      <div class="size-up-flash"></div>
      <div class="size-up-label">${label}</div>
    `;
    this.container.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1500);
  }
}
