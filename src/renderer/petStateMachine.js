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

    apply(nextState) {
      const stateName = typeof nextState === 'string' ? nextState : nextState?.state;
      if (!stateName || !STATE_TO_ANIMATION[stateName]) return;

      const stateVersion = typeof nextState === 'object' ? nextState.stateVersion : null;
      const shouldRestart = stateVersion !== null && stateVersion !== this.stateVersion;
      this.state = stateName;
      this.stateVersion = stateVersion;
      this.animator.setAnimation(STATE_TO_ANIMATION[stateName], stateName, { force: shouldRestart });

      if (stateName === 'walking-left' || stateName === 'walking-right') {
        this.speechBubble.hide();
      } else {
        this.speechBubble.showForState(stateName, nextState?.reason);
      }
    }
  }

  window.PetStateMachine = PetStateMachine;
})();
