const TICK_MS = 1000 / 60;

const LOOPING_STOP_STATES = new Set(['idle', 'waiting', 'excited']);
const ONE_SHOT_STATES = new Set(['waving', 'jumping', 'review', 'oops', 'stretch']);
const INTERACTION_STATES = new Set([...ONE_SHOT_STATES, 'excited']);

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
    this.jumpArc = null;
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
    const yOffset = this.getJumpYOffset(Date.now());
    return {
      x: Math.round(this.clampX(this.x)),
      y: Math.round(this.clampY(this.y + yOffset))
    };
  }

  getJumpYOffset(now) {
    if (!this.jumpArc) return 0;

    const elapsed = now - this.jumpArc.startedAt;
    const progress = clamp(elapsed / this.jumpArc.durationMs, 0, 1);
    return -Math.sin(progress * Math.PI) * this.jumpArc.height;
  }

  startJumpArc(options = {}) {
    const scale = this.getSettings().scale;
    this.jumpArc = {
      startedAt: Date.now(),
      durationMs: options.durationMs ?? 620,
      height: options.height ?? Math.round(46 * scale)
    };
  }

  clearJumpArc() {
    this.jumpArc = null;
    this.applyPosition();
  }

  isValidPoint(point) {
    return point
      && typeof point === 'object'
      && Number.isFinite(point.screenX)
      && Number.isFinite(point.screenY);
  }

  startDrag(point) {
    if (!this.isValidPoint(point)) return;

    this.clearJumpArc();
    const position = this.getCurrentPosition();
    this.drag = {
      startMouseX: point.screenX,
      startMouseY: point.screenY,
      startX: position.x,
      startY: position.y
    };
    this.enterState('idle', { reason: '날 어디로 보낼거냐?' });
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

    if (Math.random() < 0.18) {
      this.enterState('waving', { reason: '좋아, 여긴 내 무대다.' });
      return;
    }

    if (Math.random() < 0.08) {
      this.enterState('oops', { reason: '잠깐, 지구가 흔들렸어.' });
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

    if (this.state === 'excited') {
      this.behavior.energy = clamp(this.behavior.energy - seconds * 0.03, 0, 1);
      this.behavior.attention = clamp(this.behavior.attention - seconds * 0.02, 0, 1);
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
    this.clearJumpArc();
    this.moveToDefaultPosition();
    this.resumeWalking('walking-right');
    this.applyPosition(true);
  }

  playInteraction(state) {
    if (!INTERACTION_STATES.has(state)) return;

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
      if (Math.random() < 0.45) {
        this.enterState('oops', { reason: '야야, 팬서비스 과부하!' });
      } else {
        this.enterState('waiting', {
          durationMs: randomBetween(1800, 3000),
          reason: '잠깐만, 스타도 충전한다.'
        });
      }
      return;
    }

    if (state === 'jumping') {
      this.behavior.energy = clamp(this.behavior.energy - 0.18, 0, 1);
      if (this.behavior.energy < 0.18) {
        this.enterState('oops', { reason: '방금 점프는 예고편이야.' });
        return;
      }
    }

    if (state === 'waving' && this.behavior.attention > 0.68 && this.behavior.energy > 0.38 && Math.random() < 0.35) {
      this.enterState('excited', {
        durationMs: randomBetween(1200, 2200),
        reason: '좋아, 톰 모드 ON!'
      });
      return;
    }

    const reason = state === 'jumping'
      ? '봤냐? 공중 장악.'
      : (previousInteractionAt && now - previousInteractionAt < 1200 ? '또 불렀어? 인기란...' : '안녕, 내 팬!');
    this.enterState(state, { reason });
  }

  animationComplete(state) {
    if (state !== this.state || !ONE_SHOT_STATES.has(state)) return;
    if (state === 'jumping' || state === 'stretch') this.clearJumpArc();
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

    if (state === 'jumping') {
      this.startJumpArc({
        durationMs: options.jumpDurationMs ?? 640,
        height: options.jumpHeight
      });
    } else if (state === 'stretch') {
      this.startJumpArc({
        durationMs: options.jumpDurationMs ?? 520,
        height: Math.round(22 * this.getSettings().scale)
      });
    } else if (state !== 'stretch') {
      this.jumpArc = null;
    }

    this.emitState();
  }

  scheduleNextStop() {
    this.nextStopAt = Date.now() + randomBetween(2600, 5600);
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
    const excitedWeight = this.behavior.attention > 0.55 && this.behavior.energy > 0.35
      ? 0.8 + this.behavior.attention * 2.5
      : 0.2;
    const stretchWeight = this.behavior.energy > 0.45
      ? 0.45 + clamp((now - this.behavior.lastInteractionAt) / 90000, 0, 1)
      : 0.1;
    const oopsWeight = this.behavior.energy < 0.18 ? 1.2 : 0.15;
    const jumpWeight = this.behavior.energy > 0.5 ? 2.25 : 0.35;
    const choices = [
      {
        state: 'idle',
        weight: idleWeight,
        reason: this.behavior.attention < 0.2 ? '조용해도 존재감은 세지.' : null
      },
      {
        state: 'waiting',
        weight: waitingWeight,
        reason: this.behavior.energy < 0.35 ? '충전 중. 곧 화려해진다.' : null
      },
      {
        state: 'waving',
        weight: wavingWeight,
        reason: this.behavior.attention > 0.65 ? '나 여기 있다, 시선 고정!' : null
      },
      {
        state: 'jumping',
        weight: jumpWeight,
        reason: this.behavior.energy > 0.72 ? '폴짝! 방금 봤지?' : null
      },
      {
        state: 'review',
        weight: reviewWeight,
        reason: now - this.behavior.lastInteractionAt > 30000 ? '인간, 뭐 꾸미는 중?' : null
      },
      {
        state: 'excited',
        weight: excitedWeight,
        reason: this.behavior.attention > 0.7 ? '신난다! 톰 지나간다!' : null
      },
      {
        state: 'stretch',
        weight: stretchWeight,
        reason: '쭉... 우아함 장전.'
      },
      {
        state: 'oops',
        weight: oopsWeight,
        reason: this.behavior.energy < 0.18 ? '힘 빠진 게 아니라 연기야.' : null
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
