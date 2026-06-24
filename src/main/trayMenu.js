const { Menu, Tray, nativeImage } = require('electron');

function createTrayIcon() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<rect width="32" height="32" rx="8" fill="none"/>',
    '<path d="M7 18c0-6 4-10 10-10 5 0 8 3 8 7 0 6-5 10-12 10-4 0-6-3-6-7z" fill="black"/>',
    '<circle cx="14" cy="14" r="2" fill="white"/>',
    '<circle cx="22" cy="15" r="2" fill="white"/>',
    '<path d="M5 21c3 2 6 2 9 1" stroke="black" stroke-width="3" stroke-linecap="round" fill="none"/>',
    '</svg>'
  ].join('');
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  icon.setTemplateImage(true);
  return icon;
}

function sizeItems(actions, state) {
  return [
    {
      label: 'Size: Small',
      type: 'radio',
      checked: state.sizePreset === 'small',
      click: () => actions.setSizePreset('small')
    },
    {
      label: 'Size: Medium',
      type: 'radio',
      checked: state.sizePreset === 'medium',
      click: () => actions.setSizePreset('medium')
    },
    {
      label: 'Size: Large',
      type: 'radio',
      checked: state.sizePreset === 'large',
      click: () => actions.setSizePreset('large')
    }
  ];
}

function displayItems(actions, state) {
  return [
    {
      label: 'Display: Primary',
      type: 'radio',
      checked: state.displayPreference === 'primary',
      click: () => actions.setDisplayPreference('primary')
    },
    {
      label: 'Display: Right Monitor',
      type: 'radio',
      checked: state.displayPreference === 'rightmost',
      click: () => actions.setDisplayPreference('rightmost')
    }
  ];
}

function buildPetContextMenu(actions, state) {
  return Menu.buildFromTemplate([
    {
      label: state.paused ? 'Resume' : 'Pause',
      click: actions.togglePaused
    },
    { type: 'separator' },
    ...sizeItems(actions, state),
    { type: 'separator' },
    ...displayItems(actions, state),
    { type: 'separator' },
    {
      label: state.clickThrough ? 'Disable Click-through' : 'Enable Click-through',
      click: actions.toggleClickThrough
    },
    {
      label: 'Reset Position',
      click: actions.resetPosition
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: actions.quit
    }
  ]);
}

function buildTrayMenu(actions, state) {
  return Menu.buildFromTemplate([
    {
      label: state.visible ? 'Hide Pet' : 'Show Pet',
      click: actions.toggleVisible
    },
    {
      label: state.paused ? 'Resume' : 'Pause',
      click: actions.togglePaused
    },
    {
      label: state.clickThrough ? 'Disable Click-through' : 'Enable Click-through',
      click: actions.toggleClickThrough
    },
    { type: 'separator' },
    ...displayItems(actions, state),
    { type: 'separator' },
    {
      label: 'Reset Position',
      click: actions.resetPosition
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: actions.quit
    }
  ]);
}

function createPetTray({ actions, getState }) {
  const tray = new Tray(createTrayIcon());

  function update() {
    tray.setToolTip('Tom Lizard Desktop Pet');
    tray.setContextMenu(buildTrayMenu(actions, getState()));
  }

  tray.on('click', actions.toggleVisible);
  update();

  return {
    update,
    destroy() {
      tray.destroy();
    }
  };
}

function showPetContextMenu({ window, actions, getState }) {
  buildPetContextMenu(actions, getState()).popup({ window });
}

module.exports = {
  createPetTray,
  showPetContextMenu
};
