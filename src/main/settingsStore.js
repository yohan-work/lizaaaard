const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  scale: 0.8,
  walkSpeed: 2.2,
  dockOverlap: 8,
  clickThrough: false,
  paused: false,
  lastPosition: null,
  sizePreset: 'medium',
  displayPreference: 'rightmost'
};

const SIZE_PRESETS = {
  small: 0.65,
  medium: 0.8,
  large: 1
};

const DISPLAY_PREFERENCES = {
  primary: 'Primary Display',
  rightmost: 'Right Monitor'
};

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizePosition(value) {
  if (!value || typeof value !== 'object') return null;
  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;
  return {
    x: Math.round(value.x),
    y: Math.round(value.y)
  };
}

function sanitizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {};
  const sizePreset = Object.prototype.hasOwnProperty.call(SIZE_PRESETS, input.sizePreset)
    ? input.sizePreset
    : DEFAULT_SETTINGS.sizePreset;
  const scale = isFiniteNumber(input.scale) && input.scale > 0.3 && input.scale < 2
    ? input.scale
    : SIZE_PRESETS[sizePreset];
  const displayPreference = Object.prototype.hasOwnProperty.call(DISPLAY_PREFERENCES, input.displayPreference)
    ? input.displayPreference
    : DEFAULT_SETTINGS.displayPreference;

  return {
    scale,
    walkSpeed: isFiniteNumber(input.walkSpeed) && input.walkSpeed > 0 && input.walkSpeed < 20
      ? input.walkSpeed
      : DEFAULT_SETTINGS.walkSpeed,
    dockOverlap: isFiniteNumber(input.dockOverlap) && input.dockOverlap > -200 && input.dockOverlap < 200
      ? input.dockOverlap
      : DEFAULT_SETTINGS.dockOverlap,
    clickThrough: typeof input.clickThrough === 'boolean'
      ? input.clickThrough
      : DEFAULT_SETTINGS.clickThrough,
    paused: typeof input.paused === 'boolean' ? input.paused : DEFAULT_SETTINGS.paused,
    lastPosition: sanitizePosition(input.lastPosition),
    sizePreset,
    displayPreference
  };
}

function readJsonSafely(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function createSettingsStore(app) {
  const filePath = path.join(app.getPath('userData'), 'settings.json');
  let settings = sanitizeSettings(readJsonSafely(filePath));

  function save() {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.warn('Failed to save settings:', error.message);
    }
  }

  return {
    filePath,
    get() {
      return { ...settings, lastPosition: settings.lastPosition ? { ...settings.lastPosition } : null };
    },
    update(partial) {
      settings = sanitizeSettings({ ...settings, ...partial });
      save();
      return this.get();
    },
    resetPosition() {
      settings = sanitizeSettings({ ...settings, lastPosition: null });
      save();
      return this.get();
    }
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  DISPLAY_PREFERENCES,
  SIZE_PRESETS,
  createSettingsStore
};
