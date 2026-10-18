/**
 * UME - Ultimate Media Extension - Content Script (Complete Redesign)
 * Clean, maintainable media detection and speed control system
 * Senior developer approach with proper separation of concerns
 */

(function() {
  'use strict';
  
  // Prevent multiple injections
  if (window.umeContentScriptLoaded) return;
  window.umeContentScriptLoaded = true;
  
  // ============================================================================
  // CORE BROWSER API AND LOGGING
  // ============================================================================
  
  const browserAPI = (() => {
    if (typeof browser !== 'undefined' && browser.runtime) return browser;
    if (typeof chrome !== 'undefined' && chrome.runtime) return chrome;
    throw new Error('Browser extension API not available');
  })();
  
  const log = {
    info: (msg, data) => console.log(`[UME-CONTENT] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[UME-CONTENT] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[UME-CONTENT] ${msg}`, data || '')
  };
  
  // ============================================================================
  // STORAGE AND SETTINGS MANAGER
  // ============================================================================
  
  class StorageManager {
    static async get(keys) {
      try {
        // Try local first (faster), then sync as fallback
        const localResult = await browserAPI.storage.local.get(keys);
        if (Object.keys(localResult).length > 0) {
          return localResult;
        }
        
        // If no local data, try sync
        const syncResult = await browserAPI.storage.sync.get(keys);
        return syncResult || {};
      } catch (error) {
        log.warn('Storage get failed', { error: error.message });
        return {};
      }
    }
    
    static async set(items) {
      // Batch storage operations with timeout to prevent blocking
      const operations = [];
      
      // Local storage (fast)
      operations.push(
        browserAPI.storage.local.set(items).catch(error => {
          log.warn('Local storage set failed', { error: error.message });
        })
      );
      
      // Sync storage (slower, optional)
      operations.push(
        Promise.race([
          browserAPI.storage.sync.set(items),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync storage timeout')), 2000))
        ]).catch(error => {
          log.warn('Sync storage set failed', { error: error.message });
        })
      );
      
      // Don't wait for sync to complete, just local
      await operations[0];
      
      // Sync happens in background
      operations[1].then(() => {
        log.info('Sync storage completed');
      });
      
      return true;
    }
  }
  
  class SettingsManager {
    constructor() {
      this.settings = this.getDefaultSettings();
      this.loaded = false;
    }
    
    getDefaultSettings() {
      return {
        enabled: true,
        showController: false,
        startHidden: false,
        rememberSpeed: true,
        forceLastSavedSpeed: false,
        audioBoolean: true,
        controllerOpacity: 0.8,
        speed: 1.0, // Default speed for new videos (set only in options)
        lastSpeed: 1.0, // Last used speed (for remember speed feature)
        keyBindings: [
          { action: 'display', key: 86, value: 0, force: false },     // V
          { action: 'slower', key: 83, value: 0.1, force: false },   // S
          { action: 'faster', key: 68, value: 0.1, force: false },   // D
          { action: 'rewind', key: 90, value: 10, force: false },     // Z
          { action: 'advance', key: 88, value: 10, force: false },    // X
          { action: 'reset', key: 82, value: 1.0, force: false },     // R
          { action: 'fast', key: 71, value: 1.8, force: false }       // G
        ],
        blacklist: 'www.instagram.com\ntwitter.com\nimgur.com\nteams.microsoft.com',
        speeds: {}, // Per-video speed storage
        markers: {} // Video bookmarks
      };
    }
    
    async load() {
      try {
        const keys = Object.keys(this.getDefaultSettings());
        const result = await StorageManager.get(keys);
        this.settings = { ...this.getDefaultSettings(), ...result };
        this.loaded = true;
        log.info('Settings loaded successfully');
      } catch (error) {
        log.error('Failed to load settings, using defaults', { error: error.message });
        this.settings = this.getDefaultSettings();
        this.loaded = true;
      }
    }
    
    async save() {
      // Debounced saving to prevent excessive storage operations
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(async () => {
        try {
          await StorageManager.set(this.settings);
          log.info('Settings saved successfully');
        } catch (error) {
          log.error('Failed to save settings', { error: error.message });
        }
        this.saveTimeout = null;
      }, 500); // Debounce by 500ms
    }
    
    async saveImmediate() {
      // For cases where we need immediate saves (like options page)
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      
      try {
        await StorageManager.set(this.settings);
        log.info('Settings saved immediately');
      } catch (error) {
        log.error('Failed to save settings immediately', { error: error.message });
      }
    }
    
    get(key) { return this.settings[key]; }
    set(key, value) { this.settings[key] = value; }
    update(updates) { Object.assign(this.settings, updates); }
    
    isBlacklisted(url) {
      if (!this.settings.blacklist) return false;
      
      const blacklistItems = this.settings.blacklist.split('\n').map(item => item.trim()).filter(item => item);
      const hostname = new URL(url).hostname.toLowerCase();
      
      return blacklistItems.some(item => {
        const blacklistedHost = item.toLowerCase();
        return hostname === blacklistedHost || hostname.endsWith('.' + blacklistedHost);
      });
    }
  }
  
  // ============================================================================
  // SPEED CONTROLLER (COMPLETE REDESIGN)
  // ============================================================================
  
  class SpeedController {
    constructor(mediaElement, settings) {
      this.media = mediaElement;
      this.settings = settings;
      this.container = null;
      this.shadowRoot = null;
      this.isInitialized = false;
      this.currentSpeed = 1.0;
      
      this.init();
    }
    
    init() {
      try {
        if (!this.settings.get('showController')) return;
        
        this.createController();
        this.attachEventListeners();
        this.restoreSpeed();
        this.isInitialized = true;
        
        log.info('Speed controller initialized', { 
          mediaType: this.media.tagName,
          src: this.media.src || this.media.currentSrc 
        });
      } catch (error) {
        log.error('Failed to initialize speed controller', { error: error.message });
      }
    }
    
    createController() {
      // Create container with shadow DOM
      this.container = document.createElement('div');
      this.container.className = 'ume-speed-controller';
      this.shadowRoot = this.container.attachShadow({ mode: 'open' });
      
      // Add styles (exactly matching original videospeed extension)
      const style = document.createElement('style');
      style.textContent = `
        * {
          line-height: 1.9em;
          font-family: sans-serif;
          font-size: 13px;
        }

        :host(:hover) #controls {
          display: inline;
        }

        #controller {
          position: absolute;
          top: 0;
          left: 0;
          background: black;
          color: white;
          border-radius: 5px;
          padding: 5px;
          margin: 10px 10px 10px 15px;
          cursor: default;
          z-index: 9999999;
        }

        #controller:hover {
          opacity: 0.7;
        }

        #controller:hover > .draggable {
          margin-right: 0.8em;
        }

        #controls {
          display: none;
        }

        #controller.dragging {
          cursor: -webkit-grabbing;
          cursor: -moz-grabbing;
          opacity: 0.7;
        }

        #controller.dragging #controls {
          display: inline;
        }

        .draggable {
          cursor: -webkit-grab;
          cursor: -moz-grab;
        }

        .draggable:active {
          cursor: -webkit-grabbing;
          cursor: -moz-grabbing;
        }

        button {
          cursor: pointer;
          color: black;
          background: white;
          font-weight: bold;
          border-radius: 5px;
          padding: 3px 6px 3px 6px;
          font-size: 14px;
          line-height: 14px;
          border: 1px solid white;
          font-family: "Lucida Console", Monaco, monospace;
          margin-bottom: 2px;
        }

        button:focus {
          outline: 0;
        }

        button:hover {
          opacity: 1;
        }

        button:active {
          background: #ccc;
        }

        button.rw {
          opacity: 0.65;
        }

        button.hideButton {
          opacity: 0.65;
          margin-right: 2px;
        }

        .vsc-hidden {
          display: none !important;
        }
        
        .vsc-manual {
          visibility: visible !important;
          /* opacity removed - controlled by JS settings */
        }
        
        .controller.hidden {
          display: none !important;
        }
      `;
      this.shadowRoot.appendChild(style);
      
      // Create controller UI (matching original videospeed extension)
      const speed = this.media.playbackRate.toFixed(2);
      const top = Math.max(this.media.offsetTop, 0) + "px";
      const left = Math.max(this.media.offsetLeft, 0) + "px";
      
      const controller = document.createElement('div');
      controller.id = 'controller';
      controller.style.top = top;
      controller.style.left = left;
      controller.style.opacity = this.settings.get('controllerOpacity');
      
      if (this.settings.get('startHidden')) {
        controller.classList.add('hidden');
      }
      
      // Speed display (draggable)
      const speedDisplay = document.createElement('span');
      speedDisplay.className = 'draggable';
      speedDisplay.setAttribute('data-action', 'drag');
      speedDisplay.textContent = speed;
      
      // Controls container
      const controls = document.createElement('span');
      controls.id = 'controls';
      
      // Create buttons with original styling and symbols
      const buttons = [
        { text: '«', title: 'Rewind (Z)', action: 'rewind', class: 'rw' },
        { text: '−', title: 'Slower (S)', action: 'slower' },
        { text: '+', title: 'Faster (D)', action: 'faster' },
        { text: '»', title: 'Advance (X)', action: 'advance', class: 'rw' },
        { text: '×', title: 'Hide (V)', action: 'display', class: 'hideButton' }
      ];
      
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.title = btn.title;
        button.setAttribute('data-action', btn.action);
        if (btn.class) {
          button.className = btn.class;
        }
        button.addEventListener('click', (e) => {
          this.handleAction(btn.action);
          e.stopPropagation();
        });
        controls.appendChild(button);
      });
      
      // Setup dragging for speed display
      speedDisplay.addEventListener('mousedown', (e) => {
        this.handleDrag(e);
        e.stopPropagation();
      });
      
      controller.appendChild(speedDisplay);
      controller.appendChild(controls);
      this.shadowRoot.appendChild(controller);
      
      // Insert into DOM
      this.media.parentNode.insertBefore(this.container, this.media.nextSibling);
      
      // Store references
      this.speedDisplay = speedDisplay;
      this.controllerElement = controller;
      this.controlsElement = controls;
    }
    
    handleDrag(e) {
      const controller = this.controllerElement;
      
      // Find nearest parent of same size as video parent.
      var parentElement = this.container.parentElement;
      while (
        parentElement.parentNode &&
        parentElement.parentNode.offsetHeight === parentElement.offsetHeight &&
        parentElement.parentNode.offsetWidth === parentElement.offsetWidth
      ) {
        parentElement = parentElement.parentNode;
      }

      this.media.classList.add('vcs-dragging');
      controller.classList.add('dragging');

      const initialMouseXY = [e.clientX, e.clientY];
      const initialControllerXY = [
        parseInt(controller.style.left) || 0,
        parseInt(controller.style.top) || 0
      ];

      const startDragging = (e) => {
        let style = controller.style;
        let dx = e.clientX - initialMouseXY[0];
        let dy = e.clientY - initialMouseXY[1];
        style.left = initialControllerXY[0] + dx + "px";
        style.top = initialControllerXY[1] + dy + "px";
      };

      const stopDragging = () => {
        parentElement.removeEventListener('mousemove', startDragging);
        parentElement.removeEventListener('mouseup', stopDragging);
        parentElement.removeEventListener('mouseleave', stopDragging);

        controller.classList.remove('dragging');
        this.media.classList.remove('vcs-dragging');
      };

      parentElement.addEventListener('mouseup', stopDragging);
      parentElement.addEventListener('mouseleave', stopDragging);
      parentElement.addEventListener('mousemove', startDragging);
    }
    
    attachEventListeners() {
      this.media.addEventListener('play', () => this.onMediaPlay());
      this.media.addEventListener('loadeddata', () => this.onMediaReady());
      this.media.addEventListener('ratechange', () => this.onRateChange());
    }
    
    onMediaPlay() {
      if (this.settings.get('rememberSpeed') || this.settings.get('forceLastSavedSpeed')) {
        setTimeout(() => this.restoreSpeed(), 100);
      }
    }
    
    onMediaReady() {
      if (this.settings.get('forceLastSavedSpeed')) {
        this.restoreSpeed();
      }
    }
    
    onRateChange() {
      const newRate = this.media.playbackRate;
      if (Math.abs(newRate - this.currentSpeed) > 0.01) {
        this.currentSpeed = newRate;
        this.updateDisplay();
        this.storeSpeed();
      }
    }
    
    restoreSpeed() {
      try {
        if (this.isLivestream()) {
          log.info('Skipping speed restoration for livestream');
          return;
        }
        
        const src = this.media.src || this.media.currentSrc;
        let targetSpeed = this.settings.get('speed'); // Default speed from settings
        
        // Priority 1: Per-video stored speed (highest priority)
        const speeds = this.settings.get('speeds');
        if (src && speeds[src]) {
          targetSpeed = speeds[src];
          log.info('Using per-video stored speed', { speed: targetSpeed, src: src.substring(0, 50) + '...' });
        }
        // Priority 2: Last used speed (if rememberSpeed is enabled and no per-video speed)
        else if (this.settings.get('rememberSpeed')) {
          const lastSpeed = this.settings.get('lastSpeed');
          if (lastSpeed && lastSpeed !== 1.0) {
            targetSpeed = lastSpeed;
            log.info('Using remembered last speed', { speed: targetSpeed });
          }
        }
        // Priority 3: Force last saved speed (overrides everything if enabled)
        else if (this.settings.get('forceLastSavedSpeed')) {
          const lastSpeed = this.settings.get('lastSpeed') || this.settings.get('speed');
          targetSpeed = lastSpeed;
          log.info('Force applying last saved speed', { speed: targetSpeed });
        }
        
        // Only apply if different from current and not default 1.0
        if (targetSpeed !== 1.0 && Math.abs(this.media.playbackRate - targetSpeed) > 0.01) {
          this.setSpeed(targetSpeed);
          log.info('Speed restored', { 
            speed: targetSpeed, 
            source: src ? 'per-video' : 'default',
            currentRate: this.media.playbackRate 
          });
        }
      } catch (error) {
        log.error('Failed to restore speed', { error: error.message });
      }
    }
    
    handleAction(action) {
      try {
        switch (action) {
          case 'slower':
            this.adjustSpeed(-0.25);
            break;
          case 'faster':
            this.adjustSpeed(0.25);
            break;
          case 'rewind':
            this.seek(-10);
            break;
          case 'advance':
            this.seek(10);
            break;
                  case 'reset':
          // Reset toggles between 1.0x and default speed setting
          const defaultSpeed = this.settings.get('speed');
          const resetSpeed = (Math.abs(this.currentSpeed - 1.0) < 0.01) ? defaultSpeed : 1.0;
          this.setSpeed(resetSpeed);
          break;
          case 'display':
            this.toggleVisibility();
            break;
        }
      } catch (error) {
        log.error('Action failed', { action, error: error.message });
      }
    }
    
    adjustSpeed(delta) {
      if (this.isLivestream()) {
        this.showNotification('Speed control not available for live streams');
        return;
      }
      const newSpeed = Math.max(0.1, Math.min(5.0, this.currentSpeed + delta));
      this.setSpeed(newSpeed);
    }
    
    seek(seconds) {
      const newTime = Math.max(0, this.media.currentTime + seconds);
      this.media.currentTime = Math.min(newTime, this.media.duration || newTime);
    }
    
    setSpeed(speed) {
      if (this.isLivestream()) {
        this.showNotification('Speed control not available for live streams');
        return;
      }
      
      try {
        speed = Math.max(0.1, Math.min(5.0, speed));
        this.media.playbackRate = speed;
        this.currentSpeed = speed;
        this.updateDisplay();
        this.storeSpeed();
        this.notifySpeedChange(speed);
        log.info('Speed set', { speed });
      } catch (error) {
        log.error('Failed to set speed', { speed, error: error.message });
      }
    }
    
    updateDisplay() {
      if (this.speedDisplay) {
        if (this.isLivestream()) {
          this.speedDisplay.textContent = 'LIVE';
        } else {
          this.speedDisplay.textContent = this.currentSpeed.toFixed(2);
        }
      }
    }
    
    storeSpeed() {
      const src = this.media.src || this.media.currentSrc;
      if (src && this.currentSpeed !== this.lastStoredSpeed) {
        // Only save speed-specific data, not entire settings
        this.storeSpeedData(src, this.currentSpeed);
        this.lastStoredSpeed = this.currentSpeed;
        
        log.info('Speed stored for video source', { 
          speed: this.currentSpeed, 
          src: src.substring(0, 50) + '...' 
        });
      }
    }
    
    async storeSpeedData(src, speed) {
      // Debounced storage to prevent excessive calls during rapid speed changes
      if (this.storeSpeedTimeout) {
        clearTimeout(this.storeSpeedTimeout);
      }
      
      // Update in-memory immediately
      const currentSpeeds = this.settings.get('speeds') || {};
      currentSpeeds[src] = speed;
      this.settings.set('speeds', currentSpeeds);
      this.settings.set('lastSpeed', speed);
      
      // Debounced storage write
      this.storeSpeedTimeout = setTimeout(async () => {
        try {
          // Store only the speed data directly to storage
          await StorageManager.set({
            speeds: currentSpeeds,
            lastSpeed: speed
          });
          
          log.info('Speed data stored efficiently');
          this.storeSpeedTimeout = null;
        } catch (error) {
          log.error('Failed to store speed data', { error: error.message });
          this.storeSpeedTimeout = null;
        }
      }, 200); // 200ms debounce for speed storage
    }
    
    toggleVisibility() {
      if (this.controllerElement) {
        this.controllerElement.classList.add('vsc-manual');
        this.controllerElement.classList.toggle('hidden');
        
        // Ensure opacity setting is maintained when showing/hiding
        this.controllerElement.style.opacity = this.settings.get('controllerOpacity');
      }
    }
    
    isLivestream() {
      return this.media.duration === Infinity || isNaN(this.media.duration);
    }
    
    showNotification(message) {
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: rgba(0, 0, 0, 0.8); color: white;
        padding: 12px 16px; border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px; z-index: 2147483647; pointer-events: none;
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
    
    notifySpeedChange(speed) {
      try {
        browserAPI.runtime.sendMessage({
          type: 'SPEED_CHANGED',
          speed: speed,
          src: this.media.src || this.media.currentSrc
        });
      } catch (error) {
        log.warn('Failed to notify background of speed change', { error: error.message });
      }
    }
    
    destroy() {
      // Clear any pending speed storage timeout
      if (this.storeSpeedTimeout) {
        clearTimeout(this.storeSpeedTimeout);
        this.storeSpeedTimeout = null;
      }
      
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.isInitialized = false;
      log.info('Speed controller destroyed');
    }
  }
  
  // ============================================================================
  // MEDIA MANAGER (COMPLETE REDESIGN)
  // ============================================================================
  
  class MediaManager {
    constructor(settings) {
      this.settings = settings;
      this.trackedMedia = new Map();
      this.activeMedia = new Set();
      this.observer = null;
      this.keyboardHandler = null;
      
      this.init();
    }
    
    init() {
      log.info('Media manager initializing');
      
      this.scanForMedia();
      this.setupMutationObserver();
      this.setupKeyboardShortcuts();
      this.setupMessageListener();
      this.setupStorageListener();
      
      log.info('Media manager initialized');
    }
    
    scanForMedia() {
      // Use passive scanning - don't force immediate DOM queries
      this.deferredScan = setTimeout(() => {
        const mediaElements = document.querySelectorAll('video, audio');
        log.info('Scanning for media elements', { count: mediaElements.length });
        
        mediaElements.forEach(element => {
          this.trackMediaElement(element);
          
          // Only check for already playing media if element is visible
          if (this.isElementVisible(element) && !element.paused && element.currentTime > 0) {
            log.info('Found already playing media', { 
              type: element.tagName.toLowerCase(),
              currentTime: element.currentTime 
            });
            
            // Use requestAnimationFrame for smoother performance
            requestAnimationFrame(() => this.onMediaPlay(element));
          }
        });
      }, 100); // Small delay to let page settle
    }
    
    setupMutationObserver() {
      // Debounced mutation handling to prevent excessive processing
      let mutationTimeout = null;
      const debouncedHandler = () => {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => this.handleMutations(), 50);
      };
      
      this.observer = new MutationObserver(debouncedHandler);
      
      // Only observe specific containers likely to have media, not entire document
      const observeTarget = document.getElementById('content') || 
                           document.getElementById('player') ||
                           document.querySelector('main') ||
                           document.body ||
                           document.documentElement;
      
      this.observer.observe(observeTarget, {
        childList: true,
        subtree: true,
        // Only watch for new nodes, not all attribute changes
        attributes: false,
        attributeOldValue: false,
        characterData: false
      });
    }
    
    handleMutations() {
      // Batch process mutations for better performance
      const newMediaElements = document.querySelectorAll('video:not([data-ume-tracked]), audio:not([data-ume-tracked])');
      
      newMediaElements.forEach(element => {
        element.setAttribute('data-ume-tracked', 'true');
        this.trackMediaElement(element);
      });
      
      // Clean up removed elements
      this.trackedMedia.forEach((tracked, element) => {
        if (!document.contains(element)) {
          this.untrackMediaElement(element);
        }
      });
    }
    
    trackMediaElement(element) {
      if (this.trackedMedia.has(element)) return;
      
      try {
        // Setup event listeners with passive option for better performance
        const listeners = {
          play: () => this.onMediaPlay(element),
          pause: () => this.onMediaPause(element),
          ended: () => this.onMediaEnded(element),
          loadstart: () => this.onMediaLoadStart(element)
        };
        
        Object.entries(listeners).forEach(([event, handler]) => {
          element.addEventListener(event, handler, { passive: true });
        });
        
        // Track the element (create controller lazily when actually needed)
        this.trackedMedia.set(element, {
          controller: null, // Create lazily
          info: {
            type: element.tagName.toLowerCase(),
            src: element.src || element.currentSrc,
            isPlaying: false,
            trackingStarted: Date.now()
          },
          listeners
        });
        
        // Only check for already playing media if element is visible
        if (this.isElementVisible(element) && !element.paused && element.currentTime > 0) {
          requestAnimationFrame(() => {
            if (!this.activeMedia.has(element)) {
              this.onMediaPlay(element);
            }
          });
        }
        
        log.info('Media element tracked', {
          type: element.tagName.toLowerCase(),
          visible: this.isElementVisible(element)
        });
      } catch (error) {
        log.error('Failed to track media element', { error: error.message });
      }
    }
    
    untrackMediaElement(element) {
      const tracked = this.trackedMedia.get(element);
      if (!tracked) return;
      
      try {
        // Remove event listeners
        Object.entries(tracked.listeners).forEach(([event, handler]) => {
          element.removeEventListener(event, handler);
        });
        
        // Destroy controller
        if (tracked.controller) {
          tracked.controller.destroy();
        }
        
        // Remove from tracking
        this.trackedMedia.delete(element);
        this.activeMedia.delete(element);
        
        log.info('Media element untracked', { type: tracked.info.type });
      } catch (error) {
        log.error('Failed to untrack media element', { error: error.message });
      }
    }
    
    onMediaPlay(element) {
      this.activeMedia.add(element);
      
      const tracked = this.trackedMedia.get(element);
      if (tracked) {
        tracked.info.isPlaying = true;
        tracked.info.lastPlay = Date.now();
        
        // Create controller lazily only when media starts playing
        if (!tracked.controller && element.tagName.toLowerCase() === 'video' && this.settings.get('showController')) {
          try {
            tracked.controller = new SpeedController(element, this.settings);
          } catch (error) {
            log.warn('Failed to create speed controller', { error: error.message });
          }
        }
      }
      
      this.notifyBackgroundScript('MEDIA_STARTED', {
        type: element.tagName.toLowerCase(),
        src: element.src || element.currentSrc,
        title: document.title,
        duration: element.duration,
        playbackRate: element.playbackRate
      });
      
      log.info('Media started playing', { 
        type: element.tagName.toLowerCase(),
        src: element.src || element.currentSrc
      });
    }
    
    onMediaPause(element) {
      this.activeMedia.delete(element);
      
      const tracked = this.trackedMedia.get(element);
      if (tracked) {
        tracked.info.isPlaying = false;
      }
      
      if (this.activeMedia.size === 0) {
        this.notifyBackgroundScript('MEDIA_PAUSED');
      }
      
      log.info('Media paused');
    }
    
    onMediaEnded(element) {
      this.activeMedia.delete(element);
      
      const tracked = this.trackedMedia.get(element);
      if (tracked) {
        tracked.info.isPlaying = false;
      }
      
      if (this.activeMedia.size === 0) {
        this.notifyBackgroundScript('MEDIA_ENDED');
      }
      
      log.info('Media ended');
    }
    
    onMediaLoadStart(element) {
      const tracked = this.trackedMedia.get(element);
      if (tracked && tracked.controller) {
        tracked.controller.restoreSpeed();
      }
    }
    
    setupKeyboardShortcuts() {
      this.keyboardHandler = (event) => {
        // Skip if modifiers or in input fields
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target.matches('input, textarea, [contenteditable="true"]')) return;
        if (this.trackedMedia.size === 0) return;
        
        // Find matching key binding
        const keyBindings = this.settings.get('keyBindings');
        const binding = keyBindings.find(b => b.key === event.keyCode);
        
        if (binding && this.settings.get('enabled')) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          this.executeAction(binding.action, binding.value);
          return false;
        }
      };
      
      // Add event listeners at multiple levels for maximum coverage
      window.addEventListener('keydown', this.keyboardHandler, true);
      document.addEventListener('keydown', this.keyboardHandler, true);
    }
    
    executeAction(action, value) {
      const activeElements = Array.from(this.activeMedia);
      const allElements = Array.from(this.trackedMedia.keys());
      const elementsToProcess = activeElements.length > 0 ? activeElements : allElements;
      
      elementsToProcess.forEach(element => {
        const tracked = this.trackedMedia.get(element);
        
        switch (action) {
          case 'slower':
            if (tracked && tracked.controller) {
              tracked.controller.adjustSpeed(-value);
            } else {
              this.adjustElementSpeed(element, -value);
            }
            break;
            
          case 'faster':
            if (tracked && tracked.controller) {
              tracked.controller.adjustSpeed(value);
            } else {
              this.adjustElementSpeed(element, value);
            }
            break;
            
          case 'reset':
            // Reset behavior: toggle between 1.0x and default speed setting
            const currentSpeed = element.playbackRate;
            const defaultSpeed = this.settings.get('speed');
            const resetSpeed = (Math.abs(currentSpeed - 1.0) < 0.01) ? defaultSpeed : 1.0;
            
            if (tracked && tracked.controller) {
              tracked.controller.setSpeed(resetSpeed);
            } else {
              element.playbackRate = resetSpeed;
              
              // Store only the reset speed efficiently
              const src = element.src || element.currentSrc;
              if (src) {
                this.storeSpeedDataDirect(src, resetSpeed);
              }
            }
            break;
            
          case 'fast':
            if (tracked && tracked.controller) {
              tracked.controller.setSpeed(value);
            } else {
              element.playbackRate = value;
              
              // Store only the fast speed efficiently
              const src = element.src || element.currentSrc;
              if (src) {
                this.storeSpeedDataDirect(src, value);
              }
            }
            break;
            
          case 'rewind':
            element.currentTime = Math.max(0, element.currentTime - value);
            break;
            
          case 'advance':
            element.currentTime = Math.min(element.currentTime + value, element.duration || element.currentTime + value);
            break;
            
          case 'display':
            this.trackedMedia.forEach((tracked) => {
              if (tracked.controller) {
                tracked.controller.toggleVisibility();
              }
            });
            break;
        }
      });
      
      // Speed storage is now handled efficiently in individual methods
      // No need for full settings save on keyboard speed actions
      
      log.info('Keyboard action executed', { action, value, elements: elementsToProcess.length });
    }
    
    adjustElementSpeed(element, delta) {
      if (element.duration === Infinity || isNaN(element.duration)) {
        log.info('Skipping speed adjustment for livestream');
        return;
      }
      
      const newSpeed = Math.max(0.1, Math.min(5.0, element.playbackRate + delta));
      element.playbackRate = newSpeed;
      
      // Store only speed-specific data efficiently
      const src = element.src || element.currentSrc;
      if (src) {
        this.storeSpeedDataDirect(src, newSpeed);
        
        log.info('Element speed adjusted and stored', { 
          speed: newSpeed, 
          element: element.tagName.toLowerCase() 
        });
      }
    }
    
    async storeSpeedDataDirect(src, speed) {
      // Debounced storage to prevent excessive calls during rapid speed changes
      const storageKey = `speed-${src}`;
      
      if (this.speedStorageTimeouts && this.speedStorageTimeouts[storageKey]) {
        clearTimeout(this.speedStorageTimeouts[storageKey]);
      }
      
      if (!this.speedStorageTimeouts) this.speedStorageTimeouts = {};
      
      // Update in-memory immediately
      const currentSpeeds = this.settings.get('speeds') || {};
      currentSpeeds[src] = speed;
      this.settings.set('speeds', currentSpeeds);
      this.settings.set('lastSpeed', speed);
      
      // Debounced storage write
      this.speedStorageTimeouts[storageKey] = setTimeout(async () => {
        try {
          // Store only the speed data directly
          await StorageManager.set({
            speeds: currentSpeeds,
            lastSpeed: speed
          });
          
          log.info('Speed data stored efficiently');
          delete this.speedStorageTimeouts[storageKey];
        } catch (error) {
          log.error('Failed to store speed data', { error: error.message });
          delete this.speedStorageTimeouts[storageKey];
        }
      }, 200); // 200ms debounce for speed storage
    }
    
    /**
     * Keep this tab's copy of the settings in sync with the stored ones.
     *
     * Upstream broadcast settings only to tabs it already tracked as media tabs, so
     * a tab whose content script had not initialized yet — or that had no media at
     * save time — never received the update. That is why changed hotkeys and speed
     * increments appeared to apply to just one tab until the settings were saved
     * again. Storage events reach every content script, tracked or not.
     */
    setupStorageListener() {
      if (!browserAPI.storage || !browserAPI.storage.onChanged) return;
      
      this.storageListener = (changes, areaName) => {
        if (areaName !== 'local' && areaName !== 'sync') return;
        
        const updates = {};
        for (const [key, change] of Object.entries(changes)) {
          if (change && change.newValue !== undefined) updates[key] = change.newValue;
        }
        
        if (Object.keys(updates).length === 0) return;
        this.handleSettingsUpdate(updates);
      };
      
      browserAPI.storage.onChanged.addListener(this.storageListener);
      log.info('Storage settings listener registered');
    }
    
    setupMessageListener() {
      browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          switch (message.type) {
            case 'PAUSE_MEDIA':
              this.pauseAllMedia();
              sendResponse({ success: true });
              break;
              
            case 'SET_VOLUME':
              this.setVolume(message.volume);
              sendResponse({ success: true, volume: message.volume });
              break;
              
            case 'SET_SPEED':
              this.setSpeedAll(message.speed);
              sendResponse({ success: true });
              break;
              
            case 'SPEED_ACTION':
              this.executeAction(message.action, message.value);
              sendResponse({ success: true });
              break;
              
            case 'CHECK_FOR_MEDIA':
              const mediaInfo = this.getMediaInfo();
              sendResponse(mediaInfo);
              break;
              
            case 'SETTINGS_UPDATED':
              this.handleSettingsUpdate(message.settings);
              sendResponse({ success: true });
              break;
              
            case 'GET_CONTENT_DIAGNOSTICS':
              const diagnostics = this.getDiagnostics();
              sendResponse(diagnostics);
              break;
              
            default:
              log.warn('Unknown message type', { type: message.type });
              sendResponse({ error: 'Unknown message type' });
          }
        } catch (error) {
          log.error('Message handling failed', { type: message.type, error: error.message });
          sendResponse({ error: error.message });
        }
        
        return true;
      });
    }
    
    pauseAllMedia() {
      this.activeMedia.forEach(element => {
        if (element && typeof element.pause === 'function') {
          element.pause();
        }
      });
      log.info('All media paused', { count: this.activeMedia.size });
    }
    
    setVolume(volume) {
      this.trackedMedia.forEach((tracked, element) => {
        if (element.volume !== undefined) {
          element.volume = Math.max(0, Math.min(1, volume));
        }
      });
      log.info('Volume set for all media', { volume, count: this.trackedMedia.size });
    }
    
    async setSpeedAll(speed) {
      const speedPromises = [];
      
      this.trackedMedia.forEach((tracked, element) => {
        if (tracked.controller) {
          tracked.controller.setSpeed(speed);
        } else if (element.duration !== Infinity && !isNaN(element.duration)) {
          element.playbackRate = speed;
          
          // Store per-video speed efficiently
          const src = element.src || element.currentSrc;
          if (src) {
            speedPromises.push(this.storeSpeedDataDirect(src, speed));
          }
        }
      });
      
      // Wait for all speed storage operations to complete
      await Promise.allSettled(speedPromises);
      
      log.info('Speed set for all media', { speed, count: this.trackedMedia.size });
    }
    
    getMediaInfo() {
      const allMedia = document.querySelectorAll('video, audio');
      const trackedCount = this.trackedMedia.size;
      const activeCount = this.activeMedia.size;
      
      // CRITICAL FIX: Check for actively playing media
      const playingMedia = Array.from(allMedia).filter(el => !el.paused && el.currentTime > 0);
      const hasPlayingMedia = playingMedia.length > 0;
      
      return {
        hasMedia: allMedia.length > 0,
        mediaCount: allMedia.length,
        trackedCount,
        activeCount,
        hasPlayingMedia, // NEW: Indicates if any media is currently playing
        playingMediaCount: playingMedia.length, // NEW: Count of playing media
        mediaTypes: Array.from(new Set(Array.from(allMedia).map(el => el.tagName.toLowerCase()))),
        videoCount: document.querySelectorAll('video').length,
        audioCount: document.querySelectorAll('audio').length
      };
    }
    
    handleSettingsUpdate(newSettings) {
      this.settings.update(newSettings);
      
      // Update existing controllers
      this.trackedMedia.forEach(tracked => {
        if (tracked.controller) {
          if (newSettings.showController !== undefined && !newSettings.showController) {
            tracked.controller.destroy();
            tracked.controller = null;
          }
          
          if (tracked.controller && newSettings.controllerOpacity !== undefined) {
            tracked.controller.controllerElement.style.opacity = newSettings.controllerOpacity;
          }
        }
      });
      
      log.info('Settings updated', { settingsKeys: Object.keys(newSettings) });
    }
    
    getDiagnostics() {
      return {
        trackedMediaCount: this.trackedMedia.size,
        activeMediaCount: this.activeMedia.size,
        mediaInfo: this.getMediaInfo(),
        settings: {
          enabled: this.settings.get('enabled'),
          showController: this.settings.get('showController'),
          keyBindingsCount: this.settings.get('keyBindings').length
        }
      };
    }
    
    isElementVisible(element) {
      // Quick visibility check to avoid processing hidden media
      if (!element || element.offsetParent === null) return false;
      
      const rect = element.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight
      };
      
      // Element is visible if any part is in viewport
      return rect.bottom > 0 && 
             rect.right > 0 && 
             rect.top < viewport.height && 
             rect.left < viewport.width;
    }
    
    notifyBackgroundScript(type, data = null) {
      try {
        const message = { type };
        if (data) message.mediaInfo = data;
        browserAPI.runtime.sendMessage(message);
      } catch (error) {
        log.warn('Failed to notify background script', { type, error: error.message });
      }
    }
    
    destroy() {
      // Stop listening for settings changes
      if (this.storageListener && browserAPI.storage && browserAPI.storage.onChanged) {
        browserAPI.storage.onChanged.removeListener(this.storageListener);
        this.storageListener = null;
      }
      
      // Clear timers
      if (this.deferredScan) {
        clearTimeout(this.deferredScan);
        this.deferredScan = null;
      }
      
      // Clear speed storage timeouts
      if (this.speedStorageTimeouts) {
        Object.values(this.speedStorageTimeouts).forEach(timeout => clearTimeout(timeout));
        this.speedStorageTimeouts = null;
      }
      
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      if (this.keyboardHandler) {
        window.removeEventListener('keydown', this.keyboardHandler, true);
        document.removeEventListener('keydown', this.keyboardHandler, true);
        this.keyboardHandler = null;
      }
      
      this.trackedMedia.forEach((tracked, element) => {
        this.untrackMediaElement(element);
      });
      
      this.trackedMedia.clear();
      this.activeMedia.clear();
      
      log.info('Media manager destroyed');
    }
  }
  
  // ============================================================================
  // MAIN CONTENT SCRIPT CLASS
  // ============================================================================
  
  class ContentScript {
    constructor() {
      this.settings = new SettingsManager();
      this.mediaManager = null;
      this.initialized = false;
    }
    
    async init() {
      try {
        log.info('Content script initializing', { url: window.location.href });
        
        // Load settings
        await this.settings.load();
        
        // Check if site is blacklisted
        if (this.settings.isBlacklisted(window.location.href)) {
          log.info('Site is blacklisted, skipping initialization');
          return;
        }
        
        // Check if extension is enabled
        if (!this.settings.get('enabled')) {
          log.info('Extension is disabled, skipping initialization');
          return;
        }
        
        // Initialize media manager
        this.mediaManager = new MediaManager(this.settings);
        
        // Setup navigation handler for SPAs
        this.setupNavigationHandler();
        
        // CRITICAL FIX: Add delayed checks for media that starts playing after page load
        this.setupDelayedMediaChecks();
        
        this.initialized = true;
        log.info('Content script initialized successfully');
        
      } catch (error) {
        log.error('Content script initialization failed', { error: error.message });
      }
    }
    
    setupNavigationHandler() {
      // Handle single-page app navigation
      let lastUrl = location.href;
      
      const navigationObserver = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          log.info('Navigation detected, reinitializing', { newUrl: currentUrl });
          
          // Clean up and reinitialize
          this.cleanup();
          setTimeout(() => this.init(), 1000);
        }
      });
      
      navigationObserver.observe(document, { subtree: true, childList: true });
    }
    
    setupDelayedMediaChecks() {
      // Single delayed check instead of multiple aggressive checks
      this.delayedCheckTimer = setTimeout(() => {
        if (this.mediaManager && this.initialized) {
          // Only check for media that's actually visible and playing
          const mediaElements = document.querySelectorAll('video, audio');
          
          mediaElements.forEach(element => {
            if (this.mediaManager.isElementVisible(element) && 
                !element.paused && 
                element.currentTime > 0 && 
                !this.mediaManager.activeMedia.has(element)) {
              
              log.info('Delayed check found new playing media', { 
                type: element.tagName.toLowerCase(),
                currentTime: element.currentTime
              });
              
              if (!this.mediaManager.trackedMedia.has(element)) {
                this.mediaManager.trackMediaElement(element);
              }
              
              this.mediaManager.onMediaPlay(element);
            }
          });
        }
      }, 1000); // Single check after 1 second
      
      log.info('Set up single delayed media check');
    }
    
    cleanup() {
      // Clear timers
      if (this.delayedCheckTimer) {
        clearTimeout(this.delayedCheckTimer);
        this.delayedCheckTimer = null;
      }
      
      if (this.mediaManager) {
        this.mediaManager.destroy();
        this.mediaManager = null;
      }
      
      // Clean up settings timeouts
      if (this.settings && this.settings.saveTimeout) {
        clearTimeout(this.settings.saveTimeout);
        this.settings.saveTimeout = null;
      }
      
      this.initialized = false;
      log.info('Content script cleaned up');
    }
  }
  
  // ============================================================================
  // LIGHTWEIGHT MEDIA DETECTOR AND STARTUP
  // ============================================================================
  
  class LightweightMediaDetector {
    constructor() {
      this.fullScriptInitialized = false;
      this.contentScript = null;
      this.checkTimeout = null;
    }
    
    async init() {
      // Quick check for existing media
      if (this.hasMedia()) {
        await this.initializeFullScript();
      } else {
        // Set up lightweight monitoring for dynamically added media
        this.setupLightweightMonitoring();
      }
    }
    
    hasMedia() {
      // Quick, efficient check for media elements
      return document.querySelector('video, audio') !== null;
    }
    
    setupLightweightMonitoring() {
      // Very lightweight mutation observer that only watches for video/audio elements
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if ((node.matches && node.matches('video, audio')) || 
                  (node.querySelector && node.querySelector('video, audio'))) {
                observer.disconnect();
                this.initializeFullScript();
                return;
              }
            }
          }
        }
      });
      
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      
      // Also check periodically for the first few seconds (for sites that load media via JavaScript)
      this.checkTimeout = setTimeout(() => {
        if (this.hasMedia()) {
          observer.disconnect();
          this.initializeFullScript();
        }
      }, 2000);
      
      log.info('Lightweight media monitoring active');
    }
    
    async initializeFullScript() {
      if (this.fullScriptInitialized) return;
      this.fullScriptInitialized = true;
      
      if (this.checkTimeout) {
        clearTimeout(this.checkTimeout);
        this.checkTimeout = null;
      }
      
      log.info('Media detected - initializing full content script');
      
      this.contentScript = new ContentScript();
      await this.contentScript.init();
    }
    
    cleanup() {
      if (this.checkTimeout) {
        clearTimeout(this.checkTimeout);
        this.checkTimeout = null;
      }
      
      if (this.contentScript) {
        this.contentScript.cleanup();
        this.contentScript = null;
      }
    }
  }
  
  const detector = new LightweightMediaDetector();
  
  // Initialize lightweight detector when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => detector.init());
  } else {
    detector.init();
  }
  
  // Cleanup on unload
  window.addEventListener('beforeunload', () => detector.cleanup());
  
  log.info('UME Lightweight Detector loaded', { 
    url: window.location.href,
    readyState: document.readyState,
    hasMediaNow: document.querySelector('video, audio') !== null
  });
  
})();
