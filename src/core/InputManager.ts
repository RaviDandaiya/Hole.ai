import { isMobileDevice } from '../utils/constants';

export interface InputState {
  dx: number;
  dy: number;
  isActive: boolean;
}

export class InputManager {
  private dx = 0;
  private dy = 0;
  private activeKeys: Record<string, boolean> = {};
  private isDragging = false;
  private dragCenter = { x: 0, y: 0 };
  private maxDragRadius = 90;
  
  // Joystick visual state (for VirtualJoystick UI)
  public joystickActive = false;
  public joystickBaseX = 0;
  public joystickBaseY = 0;
  public joystickKnobX = 0;
  public joystickKnobY = 0;
  
  private canvas: HTMLElement;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    this.setupKeyboard();
    this.setupMouse();
    this.setupTouch();
  }

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.activeKeys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.activeKeys[e.key.toLowerCase()] = false;
    });
  }

  private setupMouse(): void {
    window.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragCenter = { x: e.clientX, y: e.clientY };
      this.dx = 0;
      this.dy = 0;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const ddx = e.clientX - this.dragCenter.x;
      const ddy = e.clientY - this.dragCenter.y;
      const dist = Math.hypot(ddx, ddy);
      const angle = Math.atan2(ddy, ddx);
      const capped = Math.min(dist, this.maxDragRadius);
      this.dx = Math.cos(angle) * (capped / this.maxDragRadius);
      this.dy = Math.sin(angle) * (capped / this.maxDragRadius);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.dx = 0;
      this.dy = 0;
    });
  }

  private setupTouch(): void {
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      this.isDragging = true;
      this.dragCenter = { x: touch.clientX, y: touch.clientY };
      this.dx = 0;
      this.dy = 0;
      
      // Joystick visual
      this.joystickActive = true;
      this.joystickBaseX = touch.clientX;
      this.joystickBaseY = touch.clientY;
      this.joystickKnobX = touch.clientX;
      this.joystickKnobY = touch.clientY;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      
      const ddx = touch.clientX - this.dragCenter.x;
      const ddy = touch.clientY - this.dragCenter.y;
      const dist = Math.hypot(ddx, ddy);
      const angle = Math.atan2(ddy, ddx);
      const capped = Math.min(dist, this.maxDragRadius);
      this.dx = Math.cos(angle) * (capped / this.maxDragRadius);
      this.dy = Math.sin(angle) * (capped / this.maxDragRadius);
      
      // Joystick visual - constrain knob to max radius
      const maxKnobDist = 50;
      const knobCapped = Math.min(dist, maxKnobDist);
      this.joystickKnobX = this.dragCenter.x + Math.cos(angle) * knobCapped;
      this.joystickKnobY = this.dragCenter.y + Math.sin(angle) * knobCapped;
    }, { passive: false });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
      this.dx = 0;
      this.dy = 0;
      this.joystickActive = false;
    });

    window.addEventListener('touchcancel', () => {
      this.isDragging = false;
      this.dx = 0;
      this.dy = 0;
      this.joystickActive = false;
    });
  }

  getInput(): InputState {
    let dx = this.dx;
    let dy = this.dy;

    // Keyboard overrides
    if (this.activeKeys['w'] || this.activeKeys['arrowup']) dy = -1;
    if (this.activeKeys['s'] || this.activeKeys['arrowdown']) dy = 1;
    if (this.activeKeys['a'] || this.activeKeys['arrowleft']) dx = -1;
    if (this.activeKeys['d'] || this.activeKeys['arrowright']) dx = 1;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    return {
      dx,
      dy,
      isActive: dx !== 0 || dy !== 0,
    };
  }

  /** Check if running on mobile */
  get isMobile(): boolean {
    return isMobileDevice();
  }

  dispose(): void {
    // Event listeners are on window, they persist — fine for a single-page game
  }
}
