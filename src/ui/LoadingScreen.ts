export class LoadingScreen {
  private el: HTMLDivElement;
  private fill: HTMLDivElement;
  private pct: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'loading-screen';
    this.el.innerHTML = `
      <div class="loading-vortex"></div>
      <div class="loading-title">LOADING CYBERVORTEX...</div>
      <div class="loading-bar-container"><div class="loading-bar-fill"></div></div>
      <div class="loading-percent">0%</div>
    `;
    document.getElementById('app')!.appendChild(this.el);
    this.fill = this.el.querySelector('.loading-bar-fill')!;
    this.pct = this.el.querySelector('.loading-percent')!;
  }

  setProgress(p: number): void {
    const v = Math.min(100, Math.max(0, p));
    this.fill.style.width = `${v}%`;
    this.pct.textContent = `${Math.floor(v)}%`;
  }

  hide(): Promise<void> {
    return new Promise(resolve => {
      this.el.classList.add('fade-out');
      setTimeout(() => { this.el.remove(); resolve(); }, 700);
    });
  }
}
