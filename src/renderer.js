const pet = document.getElementById('pet');
const speechBubble = document.getElementById('speech-bubble');

let clickTimer = null;
let dragState = null;
let suppressClickUntil = 0;

function toScreenPoint(event) {
  return {
    screenX: event.screenX,
    screenY: event.screenY
  };
}

function bindDrag() {
  pet.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;

    dragState = {
      startX: event.screenX,
      startY: event.screenY,
      active: false
    };
  });

  document.addEventListener('mousemove', (event) => {
    if (!dragState) return;

    const dx = event.screenX - dragState.startX;
    const dy = event.screenY - dragState.startY;
    const distance = Math.hypot(dx, dy);

    if (!dragState.active && distance >= 5) {
      dragState.active = true;
      clearTimeout(clickTimer);
      window.petAPI.beginDrag({
        screenX: dragState.startX,
        screenY: dragState.startY
      });
    }

    if (dragState.active) {
      event.preventDefault();
      window.petAPI.updateDrag(toScreenPoint(event));
    }
  });

  document.addEventListener('mouseup', (event) => {
    if (!dragState) return;

    if (dragState.active) {
      event.preventDefault();
      suppressClickUntil = Date.now() + 350;
      clearTimeout(clickTimer);
      window.petAPI.endDrag();
    }

    dragState = null;
  });
}

function bindInteractions() {
  bindDrag();

  pet.addEventListener('click', (event) => {
    if (event.button !== 0) return;
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }

    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      window.petAPI.notifyClick();
    }, 220);
  });

  pet.addEventListener('dblclick', (event) => {
    if (event.button !== 0) return;
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }

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
