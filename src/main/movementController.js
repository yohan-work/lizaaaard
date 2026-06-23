const TICK_MS = 1000 / 60;

const LOOPING_STOP_STATES = new Set(['idle', 'waiting']);
const ONE_SHOT_STATES = new Set(['waving', 'jumping', 'review']);
const STOP_CHOICES = ['idle', 'waving', 'waiting', 'review'];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

class MovementController {
  constructor({ win, screen, petConfig, getSettings, onStateChange, onPositionChange }) {
    this.win = win;
    this.screen = screen;
    this.petConfig = petConfig;
    this.getSettings = getSettings;
    this.onStateChange = onStateChange;
    this.onPositionChange = onPositionChange;

    this.direction = 1;
    this.state = 'walking-right';
    this.x = 0;
    this.timer = null;
    this.lastTickAt = Date.now();
    this.nextStopAt = Date.now() + randomBetween(4500, 9000);
    this.stateUntil = 0;
    this.lastPersistAt = 0;
  }

  getPetSize() {
    const settings = this.getSettings();
    return {
      width: Math.round(this.petConfig.frame.width * settings.scale),
      height: Math.round(this.petConfig.frame.height * settings.scale)
    };
  }

  getWorkArea() {
    return this.screen.getPrimaryDisplay().workArea;
  }

  getFloorY() {
    const settings = this.getSettings();
    const { height } = this.getPetSize();
    const workArea = this.getWorkArea();
    return Math.round(workArea.y + workArea.height - height + settings.dockOverlap);
  }

  getLimits() {
    const workArea = this.getWorkArea();
    const { width, height } = this.getPetSize();
    return {
      minX: workArea.x,
      maxX: workArea.x + workArea.width - width,
      minY: workArea.y,
      maxY: workArea.y + workArea.height - height
    };
  }

  clampX(value) {
    const { minX, maxX } = this.getLimits();
    return Math.min(Math.max(value, minX), Math.max(minX, maxX));
  }

  clampY(value) {
    const { minY, maxY } = this.getLimits();
    return Math.min(Math.max(value, minY), Math.max(minY, maxY));
  }

  initialize() {
    const settings = this.getSettings();
    const workArea = this.getWorkArea();
    this.x = settings.lastPosition ? settings.lastPosition.x : workArea.x + 40;
    this.x = this.clampX(this.x);
    this.applyPosition(true);
    this.emitState();
  }

  start() {
    if (this.timer) return;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  getState() {
    return {
      state: this.state,
      direction: this.direction,
      position: {
        x: Math.round(this.x),
        y: this.clampY(this.getFloorY())
      }
    };
  }

  emitState() {
    this.onStateChange(this.getState());
  }

  applyPosition(forcePersist = false) {
    if (!this.win || this.win.isDestroyed()) return;
    const y = this.clampY(this.getFloorY());
    const position = {
      x: Math.round(this.clampX(this.x)),
      y
    };
    this.win.setPosition(position.x, position.y, false);

    const now = Date.now();
    if (forcePersist || now - this.lastPersistAt > 2000) {
      this.lastPersistAt = now;
      this.onPositionChange(position);
    }
  }

  resizeAndClamp() {
    if (!this.win || this.win.isDestroyed()) return;
    const { width, height } = this.getPetSize();
    this.win.setSize(width, height, false);
    this.x = this.clampX(this.x);
    this.applyPosition(true);
  }

  setPaused(paused) {
    if (paused) {
      this.enterState('waiting', { durationMs: Number.POSITIVE_INFINITY });
      return;
    }

    this.resumeWalking();
  }

  resetPosition() {
    const workArea = this.getWorkArea();
    this.direction = 1;
    this.x = this.clampX(workArea.x + 40);
    this.resumeWalking('walking-right');
    this.applyPosition(true);
  }

  playInteraction(state) {
    if (!ONE_SHOT_STATES.has(state)) return;
    this.enterState(state);
  }

  animationComplete(state) {
    if (state !== this.state || !ONE_SHOT_STATES.has(state)) return;
    this.resumeWalking();
  }

  enterState(state, options = {}) {
    this.state = state;

    if (state === 'walking-left') {
      this.direction = -1;
      this.stateUntil = 0;
      this.scheduleNextStop();
    } else if (state === 'walking-right') {
      this.direction = 1;
      this.stateUntil = 0;
      this.scheduleNextStop();
    } else if (LOOPING_STOP_STATES.has(state)) {
      this.stateUntil = Date.now() + (options.durationMs ?? randomBetween(1600, 4200));
    } else {
      this.stateUntil = 0;
    }

    this.emitState();
  }

  scheduleNextStop() {
    this.nextStopAt = Date.now() + randomBetween(4500, 9500);
  }

  resumeWalking(preferredState) {
    const state = preferredState ?? (this.direction < 0 ? 'walking-left' : 'walking-right');
    this.enterState(state);
  }

  maybeStop(now) {
    if (now < this.nextStopAt) return;
    const nextState = STOP_CHOICES[Math.floor(Math.random() * STOP_CHOICES.length)];
    this.enterState(nextState);
  }

  tick() {
    if (!this.win || this.win.isDestroyed()) return;

    const now = Date.now();
    const delta = Math.min(now - this.lastTickAt, 120);
    this.lastTickAt = now;

    const settings = this.getSettings();
    if (settings.paused) {
      this.applyPosition();
      return;
    }

    if (LOOPING_STOP_STATES.has(this.state)) {
      if (now >= this.stateUntil) this.resumeWalking();
      this.applyPosition();
      return;
    }

    if (ONE_SHOT_STATES.has(this.state)) {
      this.applyPosition();
      return;
    }

    const distance = settings.walkSpeed * (delta / (1000 / 60));
    this.x += this.direction * distance;

    const { minX, maxX } = this.getLimits();
    if (this.x <= minX) {
      this.x = minX;
      this.enterState('walking-right');
    } else if (this.x >= maxX) {
      this.x = maxX;
      this.enterState('walking-left');
    } else {
      this.maybeStop(now);
    }

    this.applyPosition();
  }
}

module.exports = {
  MovementController
};
