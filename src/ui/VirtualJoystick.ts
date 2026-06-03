import { InputManager } from '../core/InputManager';

export class VirtualJoystick {
  private base: HTMLDivElement;
  private knob: HTMLDivElement;

  constructor() {
    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    document.getElementById('app')!.appendChild(this.base);
    document.getElementById('app')!.appendChild(this.knob);
  }

  update(input: InputManager): void {
    if (input.joystickActive) {
      this.base.classList.add('active');
      this.knob.classList.add('active');
      this.base.style.left = `${input.joystickBaseX}px`;
      this.base.style.top = `${input.joystickBaseY}px`;
      this.knob.style.left = `${input.joystickKnobX}px`;
      this.knob.style.top = `${input.joystickKnobY}px`;
    } else {
      this.base.classList.remove('active');
      this.knob.classList.remove('active');
    }
  }

  dispose(): void {
    this.base.remove();
    this.knob.remove();
  }
}
