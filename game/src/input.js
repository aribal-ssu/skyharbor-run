// Skyharbor Run — input state.
// One Input instance owns every listener; the game polls snapshot() each
// step instead of reacting to events, which keeps physics deterministic.

export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.mouseY = 0.5;       // 0 = top of window, 1 = bottom
    this.mouseDX = 0;        // accumulated horizontal mouse movement
    this.clicked = false;    // set on mousedown, consumed by snapshot
    this.target = target;

    this.onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseMove = (e) => {
      this.mouseY = Math.min(1, Math.max(0, e.clientY / window.innerHeight));
      this.mouseDX += e.movementX || 0;
    };
    this.onMouseDown = () => { this.clicked = true; };
    this.onBlur = () => this.keys.clear();

    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('mousedown', this.onMouseDown);
    target.addEventListener('blur', this.onBlur);
  }

  dispose() {
    const t = this.target;
    t.removeEventListener('keydown', this.onKeyDown);
    t.removeEventListener('keyup', this.onKeyUp);
    t.removeEventListener('mousemove', this.onMouseMove);
    t.removeEventListener('mousedown', this.onMouseDown);
    t.removeEventListener('blur', this.onBlur);
  }

  down(code) {
    return this.keys.has(code);
  }

  // A normalised control snapshot for one physics step.
  // throttleDelta: -1..1, pitchInput: -1 (nose up) .. 1 (nose down),
  // rollInput: -1 (left) .. 1 (right).
  snapshot() {
    const k = (code) => (this.keys.has(code) ? 1 : 0);
    const snap = {
      throttleDelta: k('KeyW') - k('KeyS'),
      pitchInput: k('ArrowDown') - k('ArrowUp') + (this.mouseY - 0.5) * 1.6,
      rollInput: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'),
      start: this.keys.has('Enter') || this.clicked,
      restart: this.keys.has('KeyR'),
      pause: this.keys.has('KeyP'),
      mute: this.keys.has('KeyM'),
      mouseDX: this.mouseDX,
      clicked: this.clicked,
    };
    snap.pitchInput = Math.max(-1, Math.min(1, snap.pitchInput));
    snap.rollInput = Math.max(-1, Math.min(1, snap.rollInput));
    this.mouseDX = 0;
    this.clicked = false;
    return snap;
  }
}
