(function () {
  const STATE_TO_ANIMATION = {
    'walking-left': 'running-left',
    'walking-right': 'running-right',
    idle: 'idle',
    waving: 'waving',
    jumping: 'jumping',
    waiting: 'waiting',
    review: 'review',
    excited: 'running',
    oops: 'failed',
    stretch: 'jumping'
  };

  class PetStateMachine {
    constructor({ animator, speechBubble }) {
      this.animator = animator;
      this.speechBubble = speechBubble;
      this.state = null;
      this.stateVersion = null;
    }

    updateSettings(settings) {
      if (typeof this.speechBubble.updateSettings === 'function') {
        this.speechBubble.updateSettings(settings);
      }
    }

    apply(nextState) {
      const stateName = typeof nextState === 'string' ? nextState : nextState?.state;
      if (!stateName || !STATE_TO_ANIMATION[stateName]) return;

      const stateVersion = typeof nextState === 'object' ? nextState.stateVersion : null;
      const shouldRestart = stateVersion !== null && stateVersion !== this.stateVersion;
      this.state = stateName;
      this.stateVersion = stateVersion;
      this.animator.setAnimation(STATE_TO_ANIMATION[stateName], stateName, { force: shouldRestart });
      this.animator.setPresentation(typeof nextState === 'object' ? nextState : { state: stateName });

      if (stateName === 'walking-left' || stateName === 'walking-right') {
        this.speechBubble.hide();
      } else {
        this.speechBubble.showForState(stateName, nextState?.reason, {
          activityMode: nextState?.activityMode,
          mood: nextState?.mood,
          speechChance: nextState?.speechChance
        });
      }
    }
  }

  window.PetStateMachine = PetStateMachine;
})();
