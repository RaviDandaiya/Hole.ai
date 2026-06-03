/**
 * AudioManager — Procedurally generated game audio using Web Audio API
 * Wrapped in a Howler-like API pattern for convenience
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private muted = false;
  private initialized = false;

  constructor() {
    // Audio context must be created after user interaction
    const initOnInteraction = () => {
      if (this.initialized) return;
      this.init();
      window.removeEventListener('click', initOnInteraction);
      window.removeEventListener('touchstart', initOnInteraction);
    };
    window.addEventListener('click', initOnInteraction);
    window.addEventListener('touchstart', initOnInteraction);
  }

  private init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx || !this.initialized) return null;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Play a quick chirp sound for small object absorption */
  playAbsorbSmall(sizeRatio: number = 0.5): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300 + sizeRatio * 500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800 + sizeRatio * 400, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  /** Deep bass for large object absorption */
  playAbsorbLarge(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);

    // Noise burst
    this.playNoiseHit(0.08, 0.15);
  }

  /** Ascending shimmer for size-up */
  playSizeUp(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  /** Countdown tick */
  playTick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    this.playNoiseHit(0.08, 0.02);
  }

  /** Game over impact */
  playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    // Low impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.85);

    this.playNoiseHit(0.15, 0.3);
  }

  /** Powerup pickup */
  playPowerup(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  /** Bot kill sound */
  playBotKill(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;

    // Impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);

    this.playNoiseHit(0.12, 0.1);
  }

  /** Start ambient hum loop */
  startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    if (this.ambientOsc) return;

    this.ambientOsc = ctx.createOscillator();
    this.ambientGain = ctx.createGain();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = 60;
    this.ambientGain.gain.value = 0.04;
    this.ambientOsc.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
    this.ambientOsc.start();
  }

  stopAmbient(): void {
    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
      } catch {}
      this.ambientOsc = null;
      this.ambientGain = null;
    }
  }

  private playNoiseHit(volume: number, duration: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(ctx.currentTime);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.5;
    }
    if (this.muted) this.stopAmbient();
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }
}
