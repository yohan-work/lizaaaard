const TICK_MS = 1000 / 60;

const LOOPING_STOP_STATES = new Set(['idle', 'waiting']);
const ONE_SHOT_STATES = new Set(['waving', 'jumping', 'review']);

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function weightedChoice(choices) {
  const total = choices.reduce((sum, choice) => sum + Math.max(0, choice.weight), 0);
  if (total <= 0) return choices[0];

  let cursor = Math.random() * total;
  for (const choice of choices) {
    cursor -= Math.max(0, choice.weight);
    if (cursor <= 0) return choice;
  }

  return choices[choices.length - 1];
}

function getDisplayForPreference(screen, preference) {
  const displays = screen.getAllDisplays();
  if (preference === 'rightmost') {
    return displays.reduce((rightmost, display) => (
      display.bounds.x > rightmost.bounds.x ? display : rightmost
    ), displays[0]);
  }

  return screen.getPrimaryDisplay();
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
    this.y = 0;
    this.timer = null;
    this.lastTickAt = Date.now();
    this.nextStopAt = Date.now() + randomBetween(4500, 9000);
    this.stateUntil = 0;
    this.lastPersistAt = 0;
    this.stateVersion = 0;
    this.currentReason = null;
    this.lastStopState = null;
    this.drag = null;
    this.behavior = {
      energy: 0.85,
      attention: 0.2,
      lastInteractionAt: 0,
      recentInteractions: []
    };
  }

  getPetSize() {
    const settings = this.getSettings();
    return {
      width: Math.round(this.petConfig.frame.width * settings.scale),
      height: Math.round(this.petConfig.frame.height * settings.scale)
    };
  }

  getWorkArea() {
    const settings = this.getSettings();
    return getDisplayForPreference(this.screen, settings.displayPreference).workArea;
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
    const { minX, maxX, minY, maxY } = this.getLimits();
    const savedPosition = settings.lastPosition;
    this.x = typeof savedPosition?.x === 'number' && savedPosition.x >= minX && savedPosition.x <= maxX
      ? savedPosition.x
      : workArea.x + 40;
    this.y = typeof savedPosition?.y === 'number' && savedPosition.y >= minY && savedPosition.y <= maxY
      ? savedPosition.y
      : this.getFloorY();
    this.x = this.clampX(this.x);
    this.y = this.clampY(this.y);
    this.applyPosition(true);
    this.emitState();
  }

  getCurrentPosition() {
    return {
      x: Math.round(this.clampX(this.x)),
      y: Math.round(this.clampY(this.y))
    };
  }

  isValidPoint(point) {
    return point
      && typeof point === 'object'
      && Number.isFinite(point.screenX)
      && Number.isFinite(point.screenY);
  }

  startDrag(point) {
    if (!this.isValidPoint(point)) return;

    const position = this.getCurrentPosition();
    this.drag = {
      startMouseX: point.screenX,
      startMouseY: point.screenY,
      startX: position.x,
      startY: position.y
    };
    this.enterState('idle', { reason: '여기로 갈까?' });
  }

  dragTo(point) {
    if (!this.drag || !this.isValidPoint(point)) return;

    const dx = point.screenX - this.drag.startMouseX;
    const dy = point.screenY - this.drag.startMouseY;
    this.x = this.clampX(this.drag.startX + dx);
    this.y = this.clampY(this.drag.startY + dy);
    this.applyPosition();
  }

  endDrag() {
    if (!this.drag) return;

    this.drag = null;
    this.applyPosition(true);
    if (this.getSettings().paused) {
      this.enterState('waiting', { durationMs: Number.POSITIVE_INFINITY });
      return;
    }

    this.resumeWalking();
  }

  moveToDefaultPosition() {
    const workArea = this.getWorkArea();
    this.x = this.clampX(workArea.x + 40);
    this.y = this.clampY(this.getFloorY());
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
      stateVersion: this.stateVersion,
      direction: this.direction,
      mood: this.getMood(),
      reason: this.currentReason,
      behavior: {
        energy: Number(this.behavior.energy.toFixed(2)),
        attention: Number(this.behavior.attention.toFixed(2))
      },
      position: this.getCurrentPosition()
    };
  }

  emitState() {
    this.onStateChange(this.getState());
  }

  getMood() {
    if (this.behavior.energy < 0.25) return 'tired';
    if (this.behavior.attention > 0.7) return 'playful';
    if (Date.now() - this.behavior.lastInteractionAt > 45000) return 'curious';
    return 'calm';
  }

  updateBehavior(deltaMs) {
    const seconds = deltaMs / 1000;

    if (this.state === 'walking-left' || this.state === 'walking-right') {
      this.behavior.energy = clamp(this.behavior.energy - seconds * 0.018, 0, 1);
      this.behavior.attention = clamp(this.behavior.attention - seconds * 0.012, 0, 1);
      return;
    }

    if (this.state === 'idle' || this.state === 'waiting') {
      this.behavior.energy = clamp(this.behavior.energy + seconds * 0.055, 0, 1);
      this.behavior.attention = clamp(this.behavior.attention - seconds * 0.018, 0, 1);
      return;
    }

    this.behavior.attention = clamp(this.behavior.attention - seconds * 0.01, 0, 1);
  }

  applyPosition(forcePersist = false) {
    if (!this.win || this.win.isDestroyed()) return;
    const position = this.getCurrentPosition();
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
    this.y = this.clampY(this.y);
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
    this.direction = 1;
    this.moveToDefaultPosition();
    this.resumeWalking('walking-right');
    this.applyPosition(true);
  }

  playInteraction(state) {
    if (!ONE_SHOT_STATES.has(state)) return;

    const now = Date.now();
    const previousInteractionAt = this.behavior.lastInteractionAt;
    this.behavior.recentInteractions = this.behavior.recentInteractions
      .filter((timestamp) => now - timestamp < 3500);
    this.behavior.recentInteractions.push(now);
    this.behavior.lastInteractionAt = now;
    this.behavior.attention = clamp(this.behavior.attention + 0.28, 0, 1);

    const isTooBusy = this.behavior.recentInteractions.length >= 4;
    if (isTooBusy) {
      this.behavior.energy = clamp(this.behavior.energy - 0.08, 0, 1);
      this.enterState('waiting', {
        durationMs: randomBetween(1800, 3000),
        reason: '잠깐만, 숨 좀 돌릴게...'
      });
      return;
    }

    if (state === 'jumping') {
      this.behavior.energy = clamp(this.behavior.energy - 0.18, 0, 1);
      if (this.behavior.energy < 0.18) {
        this.enterState('waiting', {
          durationMs: randomBetween(1800, 3200),
          reason: '점프는 조금 쉬고 할래...'
        });
        return;
      }
    }

    const reason = state === 'jumping'
      ? '깜짝이야!'
      : (previousInteractionAt && now - previousInteractionAt < 1200 ? '또 불렀어?' : '안녕!');
    this.enterState(state, { reason });
  }

  animationComplete(state) {
    if (state !== this.state || !ONE_SHOT_STATES.has(state)) return;
    this.resumeWalking();
  }

  enterState(state, options = {}) {
    this.state = state;
    this.stateVersion += 1;
    this.currentReason = options.reason ?? null;

    if (state === 'walking-left') {
      this.direction = -1;
      this.stateUntil = 0;
      this.currentReason = null;
      this.scheduleNextStop();
    } else if (state === 'walking-right') {
      this.direction = 1;
      this.stateUntil = 0;
      this.currentReason = null;
      this.scheduleNextStop();
    } else if (LOOPING_STOP_STATES.has(state)) {
      this.stateUntil = Date.now() + (options.durationMs ?? randomBetween(1600, 4200));
      this.lastStopState = state;
    } else if (ONE_SHOT_STATES.has(state)) {
      this.lastStopState = state;
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
    const choice = this.chooseStopState(now);
    this.enterState(choice.state, { reason: choice.reason });
  }

  chooseStopState(now) {
    const idleWeight = 2 + (this.behavior.attention < 0.25 ? 1.1 : 0);
    const waitingWeight = 1.2 + (1 - this.behavior.energy) * 5;
    const wavingWeight = 1 + this.behavior.attention * 4;
    const reviewWeight = 1.2 + (now - this.behavior.lastInteractionAt > 30000 ? 2 : 0);
    const choices = [
      {
        state: 'idle',
        weight: idleWeight,
        reason: this.behavior.attention < 0.2 ? '조용히 쉬는 중이야.' : null
      },
      {
        state: 'waiting',
        weight: waitingWeight,
        reason: this.behavior.energy < 0.35 ? '조금만 쉴게...' : null
      },
      {
        state: 'waving',
        weight: wavingWeight,
        reason: this.behavior.attention > 0.65 ? '나 여기 있어!' : null
      },
      {
        state: 'review',
        weight: reviewWeight,
        reason: now - this.behavior.lastInteractionAt > 30000 ? '뭐 하고 있는지 볼까?' : null
      }
    ].map((choice) => (
      choice.state === this.lastStopState
        ? { ...choice, weight: choice.weight * 0.35 }
        : choice
    ));

    return weightedChoice(choices);
  }

  tick() {
    if (!this.win || this.win.isDestroyed()) return;

    const now = Date.now();
    const delta = Math.min(now - this.lastTickAt, 120);
    this.lastTickAt = now;
    this.updateBehavior(delta);

    const settings = this.getSettings();
    if (this.drag) {
      this.applyPosition();
      return;
    }

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
