// Keyboard + mouse state for Solmere Heat. One Input instance owns every
// listener; the game loop reads it through down()/tap() and calls end()
// once a frame to clear the per-frame edges (fresh presses, mouse deltas,
// wheel ticks). Pointer lock is requested on the first left click so the
// mouse steers the camera.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = false; // left button held
    this.aim = false; // right button held (scope)
    this.dx = 0; // mouse movement this frame
    this.dy = 0;
    this.wheel = 0; // -1 / 0 / +1 wheel ticks this frame

    addEventListener('keydown', (event) => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault();
      }
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    addEventListener('keyup', (event) => this.keys.delete(event.code));
    addEventListener('blur', () => this.clear());

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouse = true;
        if (!document.pointerLockElement) canvas.requestPointerLock?.();
      }
      if (event.button === 2) this.aim = true;
    });
    addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse = false;
      if (event.button === 2) this.aim = false;
    });
    addEventListener('mousemove', (event) => {
      if (document.pointerLockElement) {
        this.dx += event.movementX;
        this.dy += event.movementY;
      }
    });
    canvas.addEventListener(
      'wheel',
      (event) => {
        this.wheel = Math.sign(event.deltaY);
        event.preventDefault();
      },
      { passive: false }
    );
  }

  // Is the key held right now?
  down(code) {
    return this.keys.has(code);
  }

  // Was the key pressed down this frame?
  tap(code) {
    return this.pressed.has(code);
  }

  // Drop all state (used when a menu opens or the window loses focus).
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.mouse = false;
    this.aim = false;
  }

  // End-of-frame housekeeping: forget fresh presses and mouse movement.
  end() {
    this.pressed.clear();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }
}
