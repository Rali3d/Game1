// Polled keyboard/mouse state. Call endFrame() once per frame after all systems have read it.
const BLOCKED_DEFAULTS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.primaryClick = false;
    this.dragging = false;
    this.pointerLocked = false;

    addEventListener('keydown', (e) => {
      if (BLOCKED_DEFAULTS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => {
      this.down.clear();
      this.dragging = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.pointerLocked) this.primaryClick = true;
      // Without pointer lock (e.g. embedded previews), dragging still turns the camera.
      if (e.button === 2 || (e.button === 0 && !this.pointerLocked)) this.dragging = true;
    });
    addEventListener('mouseup', () => (this.dragging = false));
    addEventListener('mousemove', (e) => {
      if (this.pointerLocked || this.dragging) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    canvas.addEventListener('wheel', (e) => {
      this.wheel += e.deltaY;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  anyPressed() {
    return this.pressed.size > 0;
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.primaryClick = false;
  }
}
