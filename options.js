/**
 * UME - Ultimate Media Extention - Options Script
 * Manages the extension's settings page interface and storage
 */

// Browser compatibility layer
const browserAPI = (function() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  } else if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  return null;
})();

// Cross-browser storage helpers (Promise-based)
async function syncGet(keys) {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.sync?.get) {
      return await browser.storage.sync.get(keys);
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.sync?.get) {
      return await new Promise((resolve, reject) => {
        chrome.storage.sync.get(keys, (data) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(data || {});
        });
      });
    }
  } catch (_) {}
  return {};
}

async function syncSet(obj) {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.sync?.set) {
      return await browser.storage.sync.set(obj);
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.sync?.set) {
      return await new Promise((resolve, reject) => {
        chrome.storage.sync.set(obj, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });
    }
  } catch (_) {}
}

async function syncRemove(keys) {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.sync?.remove) {
      return await browser.storage.sync.remove(keys);
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.sync?.remove) {
      return await new Promise((resolve, reject) => {
        chrome.storage.sync.remove(keys, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });
    }
  } catch (_) {}
}

async function localGet(keys) {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local?.get) {
      return await browser.storage.local.get(keys);
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
      return await new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (data) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(data || {});
        });
      });
    }
  } catch (_) {}
  return {};
}

async function syncRemove(keys) {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.sync?.remove) {
      return await browser.storage.sync.remove(keys);
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.sync?.remove) {
      return await new Promise((resolve, reject) => {
        chrome.storage.sync.remove(keys, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });
    }
  } catch (_) {}
}

async function localRemove(keys) {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local?.remove) {
      return await browser.storage.local.remove(keys);
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.remove) {
      return await new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });
    }
  } catch (_) {}
}

/**
 * Enhanced storage manager with cross-browser sync storage for options page
 * Both Chrome and Firefox: Uses sync storage for cross-device sync
 * Fallback: Uses local storage if sync fails
 */
const OptionsStorageManager = {
  /**
   * Determine if we're running in Firefox
   */
  isFirefox() {
    return typeof browser !== 'undefined' && browser.runtime;
  },

  /**
   * Get settings with sync storage and local fallback
   */
  async get(keys) {
    try {
      // Try sync storage first (both Chrome and Firefox)
      let result = await syncGet(keys);
      
      if (this.isFirefox()) {
        console.log('OneTab Media Options Firefox: Settings loaded from sync storage');
      } else {
        console.log('OneTab Media Options Chrome: Settings loaded from sync storage');
      }
      
      // If sync storage is empty, try local storage fallback
      if (!result || Object.keys(result).length === 0) {
        console.log('OneTab Media Options: Sync storage empty, trying local storage fallback');
        result = await localGet(keys);
      }
      
      return result || {};
    } catch (error) {
      console.warn('OneTab Media Options: Sync storage failed, trying local fallback:', error);
      try {
        return await localGet(keys) || {};
      } catch (localError) {
        console.error('OneTab Media Options: All storage methods failed:', localError);
        return {};
      }
    }
  },

  /**
   * Set settings to sync storage with local backup
   */
  async set(items) {
    try {
      // Save to sync storage first (primary for both browsers)
      await syncSet(items);
      
      if (this.isFirefox()) {
        console.log('OneTab Media Options Firefox: Settings saved to sync storage');
      } else {
        console.log('OneTab Media Options Chrome: Settings saved to sync storage');
      }
      
      // Also save to local storage as backup for both browsers
      try {
        await localSet(items);
        console.log('OneTab Media Options: Settings backed up to local storage');
      } catch (localError) {
        console.warn('OneTab Media Options: Local storage backup failed:', localError);
      }
      
      return true;
    } catch (error) {
      console.warn('OneTab Media Options: Sync storage failed, using local storage:', error);
      try {
        await localSet(items);
        console.log('OneTab Media Options: Settings saved to local storage only');
        return true;
      } catch (localError) {
        console.error('OneTab Media Options: All storage methods failed:', localError);
        return false;
      }
    }
  },

  /**
   * Remove items from both sync and local storage
   */
  async remove(keys) {
    try {
      await syncRemove(keys);
      await localRemove(keys);
      console.log('OneTab Media Options: Settings removed from storage');
    } catch (error) {
      console.warn('OneTab Media Options: Storage remove failed:', error);
    }
  }
};

function logOptions(...args) {
  try { console.log('[UME Options]', ...args); } catch (_) {}
}

// Default settings - Enhanced to match original videospeed extension exactly  
const defaultSettings = {
  extensionEnabled: true,
  enabled: true, // Legacy compatibility
  theme: 'light', // 'light' | 'dark'
  showController: false, // UME Lite: overlay controller off by default
  allowMultiplePlaying: true, // UME Lite: do not auto-pause other tabs
  startHidden: false,
  rememberSpeed: true, // Enable by default like original
  forceLastSavedSpeed: false, // Always apply last saved speed to new videos  
  audioBoolean: true, // Enable on audio by default
  controllerOpacity: 0.8, // More visible like original
  speed: 1.0, // Default speed for videos
  displayKeyCode: 86, // V key for display toggle
  keyBindings: [
    { action: 'display', key: 86, value: 0, force: false, predefined: true }, // V
    { action: 'slower', key: 83, value: 0.25, force: false, predefined: true }, // S  
    { action: 'faster', key: 68, value: 0.25, force: false, predefined: true }, // D
    { action: 'rewind', key: 90, value: 10, force: false, predefined: true }, // Z
    { action: 'advance', key: 88, value: 10, force: false, predefined: true }, // X
    { action: 'reset', key: 82, value: 1.0, force: false, predefined: true }, // R
    { action: 'fast', key: 71, value: 1.8, force: false, predefined: true }, // G
    { action: 'mark', key: 77, value: 0, force: false, predefined: true }, // M - set marker
    { action: 'jump', key: 74, value: 0, force: false, predefined: true }, // J - jump to marker
    { action: 'volumeUp', key: 38, value: 0.1, force: false, predefined: true }, // Up Arrow - increase volume
    { action: 'volumeDown', key: 40, value: 0.1, force: false, predefined: true } // Down Arrow - decrease volume
  ],
  blacklist: `www.instagram.com
twitter.com
imgur.com
teams.microsoft.com`.replace(/^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm, ''),
  // Volume booster settings
  volumeBoosterEnabled: true,
  globalVolume: 1.0, // Global volume multiplier
  perDomainVolume: {}, // Store per-domain volume settings
  volumeBoostLimit: 5.0, // Maximum volume boost (500%)
  volumeStep: 0.1, // Volume adjustment increment
  // Marker functionality
  markers: {} // Store video markers per URL
};

// Actions that don't need custom values
const customActionsNoValues = ['display', 'reset'];

// Action descriptions for user-friendly display
const actionDescriptions = {
  display: 'Show/Hide Controller',
  slower: 'Decrease Speed',
  faster: 'Increase Speed', 
  rewind: 'Rewind',
  advance: 'Advance',
  reset: 'Reset Speed',
  fast: 'Preferred Speed',
  mark: 'Set Marker',
  jump: 'Jump to Marker',
  volumeUp: 'Volume Up',
  volumeDown: 'Volume Down'
};

// Key code to name mapping
const keyCodeNames = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl', 18: 'Alt', 19: 'Pause',
  20: 'Caps Lock', 27: 'Escape', 32: 'Space', 33: 'Page Up', 34: 'Page Down', 35: 'End',
  36: 'Home', 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down', 45: 'Insert', 46: 'Delete',
  91: 'Left Win', 92: 'Right Win', 93: 'Select', 96: 'Num 0', 97: 'Num 1', 98: 'Num 2',
  99: 'Num 3', 100: 'Num 4', 101: 'Num 5', 102: 'Num 6', 103: 'Num 7', 104: 'Num 8',
  105: 'Num 9', 106: 'Num *', 107: 'Num +', 109: 'Num -', 110: 'Num .', 111: 'Num /',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6', 118: 'F7', 119: 'F8',
  120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12', 186: ';', 187: '=', 188: ',', 189: '-',
  190: '.', 191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'", 59: ';', 61: '+', 173: '-'
};

let keyBindings = [];
let currentSettings = {};

document.addEventListener('DOMContentLoaded', function() {
  initializeOptionsPage();
});

async function initializeOptionsPage() {
  // Migrate first, then only fill missing defaults
  await migrateFromLocalStorage();
  await ensureDefaultsSet();
  
  // Load current settings
  await loadSettings();
  
  // Set up UI event listeners
  setupEventListeners();
  
  // Set up navigation
  setupNavigation();

  // Initialize theme toggle state and listeners
  initializeThemeControls();
}

/**
 * Migrate settings from chrome.storage.local to chrome.storage.sync
 */
async function migrateFromLocalStorage() {
  try {
    // Check if we already have sync settings
    const syncData = await syncGet(Object.keys(defaultSettings)) || {};
    const hasSyncData = Object.keys(syncData).length > 0;
    
    if (!hasSyncData) {
      // Check if we have local storage data to migrate
      const localData = await localGet(Object.keys(defaultSettings)) || {};
      const hasLocalData = Object.keys(localData).length > 0;
      
      if (hasLocalData) {
        console.log('OneTab Media: Migrating settings from local to sync storage');
        await syncSet(localData);
        showStatus('Settings migrated to sync storage for cross-device compatibility', 'success', 4000);
      }
    }
  } catch (error) {
    console.warn('OneTab Media: Failed to migrate settings:', error);
  }
}

function initializeThemeControls() {
  const themeToggle = document.getElementById('themeToggleOptions');
  const themeLabel = document.getElementById('themeLabelOptions');
  if (!themeToggle || !themeLabel) return;
  (async () => {
    try {
      let result;
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync && typeof browser.storage.sync.get === 'function') {
        result = await browser.storage.sync.get(['theme']);
      } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.get === 'function') {
        result = await new Promise((resolve, reject) => {
          chrome.storage.sync.get(['theme'], (data) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(data);
            }
          });
        });
      }
      const theme = (result && result.theme) || 'light';
      applyTheme(theme, themeToggle, themeLabel);
    } catch (e) {
      applyTheme('light', themeToggle, themeLabel);
    }
  })();
  themeToggle.addEventListener('change', async () => {
    const theme = themeToggle.checked ? 'dark' : 'light';
    applyTheme(theme, themeToggle, themeLabel);
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync && typeof browser.storage.sync.set === 'function') {
        await browser.storage.sync.set({ theme });
      } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.set === 'function') {
        await new Promise((resolve, reject) => {
          chrome.storage.sync.set({ theme }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (e) {}
  });
}

function applyTheme(theme, toggleEl, labelEl) {
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  if (toggleEl) toggleEl.checked = isDark;
  if (labelEl) labelEl.textContent = isDark ? 'Dark Mode' : 'Light Mode';
}

/**
 * Ensure default settings are properly set on first install
 */
async function ensureDefaultsSet() {
  try {
    const keys = [...Object.keys(defaultSettings), 'settingsInitialized', 'settingsVersion'];
    const result = await OptionsStorageManager.get(keys) || {};
    
    // Check if this is a fresh install (no settings exist)
    const isFreshInstall = Object.keys(result).length === 0;
    
    const alreadyInitialized = result.settingsInitialized === true;

    if (isFreshInstall && !alreadyInitialized) {
      console.log('OneTab Media Options: Setting up defaults for fresh install with enhanced persistence');
      const success = await OptionsStorageManager.set({ 
        ...defaultSettings, 
        settingsInitialized: true,
        settingsVersion: '4.0',
        installDate: new Date().toISOString()
      });
      
      if (success) {
        console.log('OneTab Media Options: Default settings applied successfully');
      } else {
        console.error('OneTab Media Options: Failed to save default settings');
      }
    } else {
      // Ensure any missing settings are set to defaults
      const updates = {};
      for (const [key, defaultValue] of Object.entries(defaultSettings)) {
        if (result[key] === undefined) {
          updates[key] = defaultValue;
        }
      }
      
      // Update settings version if needed
      if (!result.settingsVersion || result.settingsVersion !== '4.0') {
        updates.settingsVersion = '4.0';
        updates.lastUpdated = new Date().toISOString();
      }
      
      if (!alreadyInitialized) updates.settingsInitialized = true;
      
      if (Object.keys(updates).length > 0) {
        console.log('OneTab Media Options: Adding missing default settings:', updates);
        await OptionsStorageManager.set(updates);
      }
    }
    
    // Clean up deprecated settings
    await cleanupDeprecatedSettings();
    
  } catch (error) {
    console.error('Failed to ensure defaults:', error);
    showStatus('Error setting up default settings', 'error');
  }
}

/**
 * Remove deprecated settings from previous versions
 */
async function cleanupDeprecatedSettings() {
  try {
    const deprecatedKeys = [
      'resetSpeed', 'speedStep', 'fastSpeed', 'rewindTime', 'advanceTime',
      'resetKeyCode', 'slowerKeyCode', 'fasterKeyCode', 'rewindKeyCode', 
      'advanceKeyCode', 'fastKeyCode', 'videoSpeedSettings', 'lastSpeed'
    ];
    
    await browserAPI.storage.sync.remove(deprecatedKeys);
    await browserAPI.storage.local.remove(deprecatedKeys);
  } catch (error) {
    console.warn('Failed to cleanup deprecated settings:', error);
  }
}

/**
 * Set up navigation between sections
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');
  
  navItems.forEach(navItem => {
    navItem.addEventListener('click', () => {
      const targetSection = navItem.dataset.section;
      
      // Update navigation active state
      navItems.forEach(item => item.classList.remove('active'));
      navItem.classList.add('active');
      
      // Update section visibility
      sections.forEach(section => section.classList.remove('active'));
      const targetSectionElement = document.getElementById(targetSection);
      if (targetSectionElement) {
        targetSectionElement.classList.add('active');
      }
    });
  });
}

function setupEventListeners() {
  // Save button
  const saveButton = document.getElementById('saveSettings');
  if (saveButton) {
    saveButton.addEventListener('click', saveSettings);
  }
  
  // Restore defaults button
  const restoreButton = document.getElementById('restoreDefaults');
  if (restoreButton) {
    restoreButton.addEventListener('click', restoreDefaults);
  }
  
  // Add shortcut button
  const addButton = document.getElementById('addShortcut');
  if (addButton) {
    addButton.addEventListener('click', addNewKeybinding);
  }
  
  // Opacity slider
  const opacitySlider = document.getElementById('controllerOpacity');
  const opacityValue = document.getElementById('opacityValue');
  if (opacitySlider && opacityValue) {
    opacitySlider.addEventListener('input', (e) => {
      opacityValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
  }
}

async function loadSettings() {
  try {
    const result = await OptionsStorageManager.get(Object.keys(defaultSettings)) || {};
    currentSettings = { ...defaultSettings, ...result };
    
    // Load general settings
    document.getElementById('extensionEnabled').checked = currentSettings.extensionEnabled || currentSettings.enabled;
    document.getElementById('showController').checked = currentSettings.showController;
    const allowMultiplePlayingEl = document.getElementById('allowMultiplePlaying');
    if (allowMultiplePlayingEl) {
      allowMultiplePlayingEl.checked = currentSettings.allowMultiplePlaying !== false;
    }
    document.getElementById('startHidden').checked = currentSettings.startHidden;
    document.getElementById('rememberSpeed').checked = currentSettings.rememberSpeed;
    document.getElementById('audioBoolean').checked = currentSettings.audioBoolean;
    
    // Load new settings from original videospeed extension
    const forceLastSavedSpeedEl = document.getElementById('forceLastSavedSpeed');
    if (forceLastSavedSpeedEl) {
      forceLastSavedSpeedEl.checked = currentSettings.forceLastSavedSpeed;
    }
    
    const defaultSpeedEl = document.getElementById('defaultSpeed');
    if (defaultSpeedEl) {
      defaultSpeedEl.value = currentSettings.speed || 1.0;
    }
    
    const blacklistEl = document.getElementById('blacklist');
    if (blacklistEl) {
      blacklistEl.value = currentSettings.blacklist || '';
    }
    
    // Load volume booster settings
    const volumeBoosterEnabledEl = document.getElementById('volumeBoosterEnabled');
    if (volumeBoosterEnabledEl) {
      volumeBoosterEnabledEl.checked = currentSettings.volumeBoosterEnabled !== false;
    }
    
    const volumeBoostLimitEl = document.getElementById('volumeBoostLimit');
    if (volumeBoostLimitEl) {
      volumeBoostLimitEl.value = currentSettings.volumeBoostLimit || 5.0;
    }
    
    const globalVolumeEl = document.getElementById('globalVolume');  
    if (globalVolumeEl) {
      globalVolumeEl.value = currentSettings.globalVolume || 1.0;
    }
    
    // Load opacity setting
    const opacitySlider = document.getElementById('controllerOpacity');
    const opacityValue = document.getElementById('opacityValue');
    if (opacitySlider && opacityValue) {
      opacitySlider.value = currentSettings.controllerOpacity;
      opacityValue.textContent = parseFloat(currentSettings.controllerOpacity).toFixed(1);
    }
    
    // Load keyboard shortcuts with enhanced validation
    keyBindings = currentSettings.keyBindings || defaultSettings.keyBindings;
    
    // Ensure display binding exists (for upgrades from older versions)
    if (keyBindings.filter(x => x.action === 'display').length === 0) {
      keyBindings.push({
        action: 'display',
        key: currentSettings.displayKeyCode || defaultSettings.displayKeyCode,
        value: 0,
        force: false,
        predefined: true
      });
    }
    
    populateKeyBindings();
    
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

/**
 * Validate settings before saving
 */
function validateSettings() {
  const errors = [];
  
  // Validate default speed
  const defaultSpeedEl = document.getElementById('defaultSpeed');
  if (defaultSpeedEl) {
    const speed = parseFloat(defaultSpeedEl.value);
    if (isNaN(speed) || speed < 0.1 || speed > 16) {
      errors.push('Default speed must be between 0.1 and 16');
    }
  }
  
  // Validate opacity
  const opacity = parseFloat(document.getElementById('controllerOpacity').value);
  if (isNaN(opacity) || opacity < 0 || opacity > 1) {
    errors.push('Controller opacity must be between 0 and 1');
  }
  
  // Validate key bindings
  const keyBindingErrors = validateKeyBindings();
  errors.push(...keyBindingErrors);
  
  if (errors.length > 0) {
    showStatus('Validation errors: ' + errors.join(', '), 'error', 5000);
    return false;
  }
  
  return true;
}

/**
 * Validate key bindings for duplicates
 */
function validateKeyBindings() {
  const errors = [];
  const usedKeys = new Set();
  
  keyBindings.forEach((binding, index) => {
    if (binding.key && usedKeys.has(binding.key)) {
      errors.push(`Duplicate key binding: ${getKeyName(binding.key)}`);
    }
    if (binding.key) {
      usedKeys.add(binding.key);
    }
    
    // Validate values for specific actions
    if (['slower', 'faster'].includes(binding.action)) {
      const value = parseFloat(binding.value);
      if (isNaN(value) || value <= 0 || value > 5) {
        errors.push(`${actionDescriptions[binding.action]} value must be between 0.1 and 5`);
      }
    }
    
    if (['rewind', 'advance'].includes(binding.action)) {
      const value = parseFloat(binding.value);
      if (isNaN(value) || value <= 0 || value > 300) {
        errors.push(`${actionDescriptions[binding.action]} value must be between 1 and 300 seconds`);
      }
    }
    
    if (binding.action === 'fast') {
      const value = parseFloat(binding.value);
      if (isNaN(value) || value < 0.1 || value > 16) {
        errors.push(`Preferred speed value must be between 0.1 and 16`);
      }
    }
  });
  
  return errors;
}

async function saveSettings() {
  if (!validateSettings()) {
    return;
  }
  
  try {
    // Collect all settings
    const settings = {
      extensionEnabled: document.getElementById('extensionEnabled').checked,
      enabled: document.getElementById('extensionEnabled').checked, // Legacy compatibility
      showController: document.getElementById('showController').checked,
      allowMultiplePlaying: document.getElementById('allowMultiplePlaying').checked,
      startHidden: document.getElementById('startHidden').checked,
      rememberSpeed: document.getElementById('rememberSpeed').checked,
      audioBoolean: document.getElementById('audioBoolean').checked,
      controllerOpacity: parseFloat(document.getElementById('controllerOpacity').value),
      keyBindings: keyBindings
    };
    
    // Add new settings if elements exist
    const forceLastSavedSpeedEl = document.getElementById('forceLastSavedSpeed');
    if (forceLastSavedSpeedEl) {
      settings.forceLastSavedSpeed = forceLastSavedSpeedEl.checked;
    }
    
    const defaultSpeedEl = document.getElementById('defaultSpeed');
    if (defaultSpeedEl) {
      settings.speed = parseFloat(defaultSpeedEl.value) || 1.0;
    }
    
    const blacklistEl = document.getElementById('blacklist');
    if (blacklistEl) {
      settings.blacklist = blacklistEl.value.replace(/^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm, '');
    }

    // Theme
    const themeToggle = document.getElementById('themeToggleOptions');
    if (themeToggle) {
      settings.theme = themeToggle.checked ? 'dark' : 'light';
    }
    
    // Add volume booster settings if elements exist
    const volumeBoosterEnabledEl = document.getElementById('volumeBoosterEnabled');
    if (volumeBoosterEnabledEl) {
      settings.volumeBoosterEnabled = volumeBoosterEnabledEl.checked;
    }
    
    const volumeBoostLimitEl = document.getElementById('volumeBoostLimit');
    if (volumeBoostLimitEl) {
      settings.volumeBoostLimit = parseFloat(volumeBoostLimitEl.value) || 5.0;
    }
    
    const globalVolumeEl = document.getElementById('globalVolume');
    if (globalVolumeEl) {
      settings.globalVolume = parseFloat(globalVolumeEl.value) || 1.0;
    }
    
    // Include additional settings
    settings.perDomainVolume = currentSettings.perDomainVolume || {};
    settings.volumeStep = currentSettings.volumeStep || 0.1;
    settings.markers = currentSettings.markers || {};
    
    // Save to storage with enhanced persistence
    const success = await OptionsStorageManager.set(settings);
    
    if (success) {
      // Update current settings
      currentSettings = settings;
      showStatus('Settings saved successfully and synced across devices (Chrome & Firefox)!', 'success', 2000);
    } else {
      showStatus('Settings saved with limited persistence (storage issues detected)', 'warning', 3000);
    }
    
    // Notify content scripts of settings change
    broadcastSettingsUpdate(settings);
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

async function restoreDefaults() {
  try {
    await browserAPI.storage.sync.set(defaultSettings);
    await loadSettings();
    showStatus('Default settings restored!', 'success', 2000);
  } catch (error) {
    console.error('Failed to restore defaults:', error);
    showStatus('Failed to restore defaults', 'error');
  }
}

function populateKeyBindings() {
  const container = document.getElementById('customsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  keyBindings.forEach((binding, index) => {
    const shortcutItem = createShortcutItem(binding, index);
    container.appendChild(shortcutItem);
  });
}

function createShortcutItem(binding, index) {
  const item = document.createElement('div');
  item.className = 'shortcut-item';
  
  // Action dropdown
  const actionSelect = document.createElement('select');
  actionSelect.className = 'shortcut-action';
  Object.entries(actionDescriptions).forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = binding.action === value;
    actionSelect.appendChild(option);
  });
  
  // Key input
  const keyInput = document.createElement('input');
  keyInput.className = 'shortcut-key';
  keyInput.type = 'text';
  keyInput.value = getKeyName(binding.key);
  keyInput.placeholder = 'Press a key';
  keyInput.readOnly = true;
  
  // Value input
  const valueInput = document.createElement('input');
  valueInput.className = 'shortcut-value';
  valueInput.type = 'number';
  valueInput.step = '0.1';
  valueInput.value = binding.value;
  valueInput.placeholder = '0.1';
  if (binding.action === 'reset') {
    valueInput.disabled = true;
    valueInput.value = '1.0';
  }
  
  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'shortcut-remove';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remove shortcut';
  
  // Event listeners
  actionSelect.addEventListener('change', () => {
    keyBindings[index].action = actionSelect.value;
    if (actionSelect.value === 'reset') {
      valueInput.disabled = true;
      valueInput.value = '1.0';
      keyBindings[index].value = 1.0;
    } else {
      valueInput.disabled = false;
    }
  });
  
  keyInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    keyBindings[index].key = e.keyCode;
    keyInput.value = getKeyName(e.keyCode);
  });
  
  valueInput.addEventListener('change', () => {
    keyBindings[index].value = parseFloat(valueInput.value) || 0.1;
  });
  
  removeBtn.addEventListener('click', () => {
    keyBindings.splice(index, 1);
    populateKeyBindings();
  });
  
  item.appendChild(actionSelect);
  item.appendChild(keyInput);
  item.appendChild(valueInput);
  item.appendChild(removeBtn);
  
  return item;
}

function addNewKeybinding() {
  const newBinding = {
    action: 'faster',
    key: 70, // F key
    value: 0.1,
    force: false
  };
  
  keyBindings.push(newBinding);
  populateKeyBindings();
}

function getKeyName(keyCode) {
  if (keyCodeNames[keyCode]) {
    return keyCodeNames[keyCode];
  }
  
  // For letter keys
  if (keyCode >= 65 && keyCode <= 90) {
    return String.fromCharCode(keyCode);
  }
  
  // For number keys
  if (keyCode >= 48 && keyCode <= 57) {
    return String.fromCharCode(keyCode);
  }
  
  return 'Key' + keyCode;
}

function showStatus(message, type = 'success', duration = 3000) {
  const statusElement = document.getElementById('status');
  if (!statusElement) return;
  
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  
  if (duration > 0) {
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'status-message';
    }, duration);
  }
} 

/**
 * Broadcast settings update to all content scripts via background script
 */
async function broadcastSettingsUpdate(settings) {
  try {
    await browserAPI.runtime.sendMessage({
      type: 'BROADCAST_SETTINGS_UPDATE',
      settings: settings
    });
  } catch (error) {
    console.warn('Failed to broadcast settings update:', error);
  }
} 