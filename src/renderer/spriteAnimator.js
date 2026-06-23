(function () {
  class SpriteAnimator {
    constructor(element, { petConfig, settings, onComplete }) {
      this.element = element;
      this.petConfig = petConfig;
      this.settings = settings;
      this.onComplete = onComplete;
      this.animationName = null;
      this.stateName = null;
      this.animation = null;
      this.frame = 0;
      this.lastFrameAt = 0;
      this.completed = false;
      this.running = false;
    }

    updateSettings(settings) {
      this.settings = settings;
      this.applyFrame();
    }

    getScale() {
      return this.settings?.scale ?? this.petConfig.defaultScale ?? 0.8;
    }

    getFrameSize() {
      const scale = this.getScale();
      return {
        width: Math.round(this.petConfig.frame.width * scale),
        height: Math.round(this.petConfig.frame.height * scale)
      };
    }

    getSheetSize() {
      const scale = this.getScale();
      return {
        width: Math.round(this.petConfig.sheet.width * scale),
        height: Math.round(this.petConfig.sheet.height * scale)
      };
    }

    setAnimation(animationName, stateName = animationName, options = {}) {
      const nextAnimation = this.petConfig.animations[animationName];
      if (!nextAnimation) return;

      if (!options.force && this.animationName === animationName && this.stateName === stateName) {
        this.applyFrame();
        return;
      }

      this.animationName = animationName;
      this.stateName = stateName;
      this.animation = nextAnimation;
      this.frame = 0;
      this.lastFrameAt = 0;
      this.completed = false;
      this.applyFrame();
    }

    applyFrame() {
      if (!this.animation) return;

      const frameSize = this.getFrameSize();
      const sheetSize = this.getSheetSize();
      const x = -this.frame * frameSize.width;
      const y = -this.animation.row * frameSize.height;

      this.element.style.width = `${frameSize.width}px`;
      this.element.style.height = `${frameSize.height}px`;
      this.element.style.backgroundImage = `url('../assets/${this.petConfig.spritesheetPath}')`;
      this.element.style.backgroundSize = `${sheetSize.width}px ${sheetSize.height}px`;
      this.element.style.backgroundPosition = `${x}px ${y}px`;
    }

    completeOnce() {
      if (this.completed) return;
      this.completed = true;
      if (typeof this.onComplete === 'function') {
        this.onComplete(this.stateName);
      }
    }

    tick(timestamp) {
      if (!this.animation) return;
      if (!this.lastFrameAt) this.lastFrameAt = timestamp;

      const interval = 1000 / this.animation.fps;
      if (timestamp - this.lastFrameAt < interval) return;

      if (this.animation.loop) {
        this.frame = (this.frame + 1) % this.animation.frames;
      } else if (this.frame < this.animation.frames - 1) {
        this.frame += 1;
      } else {
        this.completeOnce();
      }

      this.applyFrame();
      this.lastFrameAt = timestamp;
    }

    start() {
      if (this.running) return;
      this.running = true;

      const loop = (timestamp) => {
        this.tick(timestamp);
        if (this.running) requestAnimationFrame(loop);
      };

      requestAnimationFrame(loop);
    }
  }

  window.SpriteAnimator = SpriteAnimator;
})();
