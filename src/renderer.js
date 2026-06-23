const pet = document.getElementById('pet');
const speechBubble = document.getElementById('speech-bubble');

let clickTimer = null;

function bindInteractions() {
  pet.addEventListener('click', (event) => {
    if (event.button !== 0) return;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      window.petAPI.notifyClick();
    }, 220);
  });

  pet.addEventListener('dblclick', (event) => {
    if (event.button !== 0) return;
    clearTimeout(clickTimer);
    window.petAPI.notifyDoubleClick();
  });

  pet.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    clearTimeout(clickTimer);
    window.petAPI.showContextMenu();
  });
}

async function boot() {
  const initialState = await window.petAPI.getInitialState();
  const animator = new window.SpriteAnimator(pet, {
    petConfig: initialState.pet,
    settings: initialState.settings,
    onComplete(state) {
      window.petAPI.notifyAnimationComplete(state);
    }
  });
  const stateMachine = new window.PetStateMachine({
    animator,
    speechBubble: new window.SpeechBubble(speechBubble)
  });

  window.petAPI.onSettingsChange((settings) => {
    animator.updateSettings(settings);
  });

  window.petAPI.onStateChange((state) => {
    stateMachine.apply(state);
  });

  bindInteractions();
  stateMachine.apply(initialState.state);
  animator.start();
}

boot().catch((error) => {
  console.error('Failed to start Tom Lizard renderer:', error);
});
