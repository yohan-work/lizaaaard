(function () {
  const STATE_TO_ANIMATION = {
    'walking-left': 'running-left',
    'walking-right': 'running-right',
    idle: 'idle',
    waving: 'waving',
    jumping: 'jumping',
    waiting: 'waiting',
    review: 'review'
  };

  class PetStateMachine {
    constructor({ animator, speechBubble }) {
      this.animator = animator;
      this.speechBubble = speechBubble;
      this.state = null;
    }

    apply(nextState) {
      const stateName = typeof nextState === 'string' ? nextState : nextState?.state;
      if (!stateName || !STATE_TO_ANIMATION[stateName]) return;

      this.state = stateName;
      this.animator.setAnimation(STATE_TO_ANIMATION[stateName], stateName);

      if (stateName === 'walking-left' || stateName === 'walking-right') {
        this.speechBubble.hide();
      } else {
        this.speechBubble.showForState(stateName);
      }
    }
  }

  window.PetStateMachine = PetStateMachine;
})();
