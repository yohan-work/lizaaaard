const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const petConfig = require('../assets/pet.json');
const { MovementController } = require('./main/movementController');
const { SIZE_PRESETS, createSettingsStore } = require('./main/settingsStore');
const { createPetTray, showPetContextMenu } = require('./main/trayMenu');

let settingsStore;
let settings;
let win;
let clickThroughControlWin;
let movement;
let tray;

function getPetSize() {
  return {
    width: Math.round(petConfig.frame.width * settings.scale),
    height: Math.round(petConfig.frame.height * settings.scale)
  };
}

function getMenuState() {
  return {
    visible: Boolean(win && !win.isDestroyed() && win.isVisible()),
    paused: settings.paused,
    clickThrough: settings.clickThrough,
    sizePreset: settings.sizePreset,
    displayPreference: settings.displayPreference
  };
}

function sendToRenderer(channel, payload) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, payload);
}

function sendSettings() {
  sendToRenderer('pet-settings', settings);
}

function sendState(state = movement?.getState()) {
  if (!state) return;
  sendToRenderer('pet-state', state);
}

function refreshMenus() {
  if (tray) tray.update();
}

function getDisplayForPreference(preference) {
  const displays = screen.getAllDisplays();
  if (preference === 'rightmost') {
    return displays.reduce((rightmost, display) => (
      display.bounds.x > rightmost.bounds.x ? display : rightmost
    ), displays[0]);
  }

  return screen.getPrimaryDisplay();
}

function getTargetWorkArea() {
  return getDisplayForPreference(settings.displayPreference).workArea;
}

function getClickThroughControlBounds() {
  const workArea = getTargetWorkArea();
  const width = 168;
  const height = 34;

  return {
    width,
    height,
    x: Math.round(workArea.x + workArea.width - width - 16),
    y: Math.round(workArea.y + 16)
  };
}

function updateClickThroughControlPosition() {
  if (!clickThroughControlWin || clickThroughControlWin.isDestroyed()) return;
  const { x, y, width, height } = getClickThroughControlBounds();
  clickThroughControlWin.setBounds({ x, y, width, height }, false);
}

function syncClickThroughControl() {
  if (!clickThroughControlWin || clickThroughControlWin.isDestroyed()) return;
  updateClickThroughControlPosition();

  if (settings.clickThrough) {
    clickThroughControlWin.showInactive();
  } else {
    clickThroughControlWin.hide();
  }
}

function applyClickThrough() {
  if (!win || win.isDestroyed()) return;

  if (settings.clickThrough) {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }

  syncClickThroughControl();
}

function updateSettings(partial, options = {}) {
  settings = settingsStore.update(partial);

  if (options.resize && movement) {
    movement.resizeAndClamp();
  }

  applyClickThrough();
  sendSettings();
  sendState();
  refreshMenus();
  return settings;
}

function createActions() {
  return {
    toggleVisible() {
      if (!win || win.isDestroyed()) return;
      if (win.isVisible()) {
        win.hide();
      } else {
        win.showInactive();
      }
      refreshMenus();
    },
    togglePaused() {
      updateSettings({ paused: !settings.paused });
      movement.setPaused(settings.paused);
      sendState();
    },
    toggleClickThrough() {
      updateSettings({ clickThrough: !settings.clickThrough });
    },
    setSizePreset(sizePreset) {
      updateSettings(
        {
          sizePreset,
          scale: SIZE_PRESETS[sizePreset]
        },
        { resize: true }
      );
    },
    setDisplayPreference(displayPreference) {
      updateSettings({ displayPreference, lastPosition: null });
      movement.resetPosition();
      syncClickThroughControl();
      sendState();
      refreshMenus();
    },
    resetPosition() {
      settings = settingsStore.resetPosition();
      movement.resetPosition();
      applyClickThrough();
      sendSettings();
      sendState();
      refreshMenus();
    },
    quit() {
      app.quit();
    }
  };
}

function createWindow() {
  const { width, height } = getPetSize();
  const workArea = getTargetWorkArea();

  win = new BrowserWindow({
    width,
    height,
    x: Math.round(settings.lastPosition?.x ?? workArea.x + 40),
    y: Math.round(settings.lastPosition?.y ?? workArea.y + workArea.height - height),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    acceptFirstMouse: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Keep the pet visible on all Spaces and above normal windows.
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyClickThrough();

  win.loadFile(path.join(__dirname, 'index.html'));

  movement = new MovementController({
    win,
    screen,
    petConfig,
    getSettings: () => settings,
    onStateChange: sendState,
    onPositionChange(position) {
      settings = settingsStore.update({ lastPosition: position });
    }
  });
  movement.initialize();

  win.once('ready-to-show', () => {
    win.showInactive();
    sendSettings();
    sendState();
  });

  win.webContents.once('did-finish-load', () => {
    sendSettings();
    sendState();
  });
}

function createClickThroughControlWindow() {
  const { x, y, width, height } = getClickThroughControlBounds();

  clickThroughControlWin = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  clickThroughControlWin.setAlwaysOnTop(true, 'floating');
  clickThroughControlWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  clickThroughControlWin.loadFile(path.join(__dirname, 'clickthrough.html'));
  clickThroughControlWin.once('ready-to-show', syncClickThroughControl);
}

app.whenReady().then(() => {
  // Hide the Electron app icon from the macOS Dock.
  if (app.dock) app.dock.hide();

  settingsStore = createSettingsStore(app);
  settings = settingsStore.get();

  createWindow();
  createClickThroughControlWindow();
  applyClickThrough();

  const actions = createActions();
  tray = createPetTray({
    actions,
    getState: getMenuState
  });

  ipcMain.handle('pet:get-initial-state', () => ({
    pet: petConfig,
    settings,
    state: movement.getState()
  }));

  ipcMain.on('pet:click', () => {
    if (settings.clickThrough || settings.paused) return;
    movement.playInteraction('waving');
  });

  ipcMain.on('pet:double-click', () => {
    if (settings.clickThrough || settings.paused) return;
    movement.playInteraction('jumping');
  });

  ipcMain.on('pet:context-menu', () => {
    if (settings.clickThrough || !win || win.isDestroyed()) return;
    showPetContextMenu({
      window: win,
      actions,
      getState: getMenuState
    });
  });

  ipcMain.on('pet:disable-click-through', () => {
    if (!settings.clickThrough) return;
    updateSettings({ clickThrough: false });
  });

  ipcMain.on('pet:drag-start', (_event, point) => {
    if (settings.clickThrough) return;
    movement.startDrag(point);
  });

  ipcMain.on('pet:drag-move', (_event, point) => {
    if (settings.clickThrough) return;
    movement.dragTo(point);
  });

  ipcMain.on('pet:drag-end', () => {
    if (settings.clickThrough) return;
    movement.endDrag();
    sendState();
  });

  ipcMain.on('pet:animation-complete', (_event, state) => {
    movement.animationComplete(state);
  });

  movement.start();
});

app.on('window-all-closed', () => {
  app.quit();
});
