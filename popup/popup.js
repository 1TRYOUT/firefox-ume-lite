/**
 * UME - Ultimate Media Extention - Popup Script
 * Handles the popup interface for managing media across browser tabs
 */

(function() {
  'use strict';
  
  // Extension loaded successfully
  
  // Browser compatibility layer
  const browserAPI = (function() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome;
    } else if (typeof browser !== 'undefined' && browser.runtime) {
      return browser;
    }
    return null;
  })();
  
  // DOM elements
  let statusDot, statusText, tabsList, noTabsMessage, pauseAllButton, refreshButton;
  let extensionToggle, toggleLabel, footerStatus, popupContainer;
  let speedControlSection, currentSpeedDisplay;
  let volumeControlSection, currentVolumeDisplay, volumeSlider;
  let volumeUpBtn, volumeDownBtn, volumeResetBtn;
  let optionsButton;
  let themeToggle, themeLabel;
  
  // State
  let currentTabs = [];
  let isExtensionEnabled = true;
  let currentSpeed = 1.0;
  let currentVolume = 1.0; // Volume multiplier (1.0 = 100%)
  let speedSettings = {};
  let volumeSettings = {};
  
  /**
   * Initialize popup when DOM is loaded
   */
  function initialize() {
    // Get DOM elements
    getElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load extension settings
    loadExtensionSettings();
    // Load theme
    applyStoredTheme();
    
    // Load initial data
    loadTabsData();
    
    // Load volume settings
    loadVolumeSettings();
    
    // Listen for changes from background script
    setupBackgroundListener();
  }
  
  /**
   * Get all required DOM elements
   */
  function getElements() {
    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    tabsList = document.getElementById('tabsList');
    noTabsMessage = document.getElementById('noTabsMessage');
    pauseAllButton = document.getElementById('pauseAllButton');
    refreshButton = document.getElementById('refreshButton');
    extensionToggle = document.getElementById('extensionToggle');
    toggleLabel = document.getElementById('toggleLabel');
    footerStatus = document.getElementById('footerStatus');
    popupContainer = document.querySelector('.popup-container');
    
    // Speed control elements
    speedControlSection = document.getElementById('speedControlSection');
    currentSpeedDisplay = document.getElementById('currentSpeed');
    
    // Volume control elements
    volumeControlSection = document.getElementById('volumeControlSection');
    currentVolumeDisplay = document.getElementById('currentVolume');
    volumeSlider = document.getElementById('volumeSlider');
    volumeUpBtn = document.getElementById('volumeUpBtn');
    volumeDownBtn = document.getElementById('volumeDownBtn');
    volumeResetBtn = document.getElementById('volumeResetBtn');
    
    optionsButton = document.getElementById('optionsButton');
    themeToggle = document.getElementById('themeToggle');
    themeLabel = document.getElementById('themeLabel');
  }
  
  /**
   * Set up event listeners for user interactions
   */
  function setupEventListeners() {
    // Pause all button
    pauseAllButton?.addEventListener('click', handlePauseAll);
    
    // Refresh button
    refreshButton?.addEventListener('click', handleRefresh);
    
    // Options button
    optionsButton?.addEventListener('click', handleOptions);
    
    // Extension toggle
    extensionToggle?.addEventListener('change', handleExtensionToggle);
    // Theme toggle
    themeToggle?.addEventListener('change', handleThemeToggle);
    
    // Volume control event listeners
    volumeSlider?.addEventListener('input', handleVolumeSliderChange);
    volumeUpBtn?.addEventListener('click', handleVolumeUp);
    volumeDownBtn?.addEventListener('click', handleVolumeDown);
    volumeResetBtn?.addEventListener('click', handleVolumeReset);
    
    // Refresh when popup becomes visible (user opens it)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        loadTabsData();
        loadVolumeSettings();
      }
    });
  }
  
  /**
   * Set up listener for background script notifications
   */
  function setupBackgroundListener() {
    // Listen for messages from background script about media changes
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'MEDIA_STATE_CHANGED') {
        // Refresh popup data when media state changes
        loadTabsData();
      }
    });
  }
  
  /**
   * Load extension settings from storage
   */
  async function loadExtensionSettings() {
    try {
      const result = await browserAPI.storage.local.get(['extensionEnabled']);
      // Handle case where result is undefined or doesn't have the property
      isExtensionEnabled = result && result.extensionEnabled === false ? false : true; // Default to true
      updateExtensionToggleUI();
    } catch (error) {
      console.error('Failed to load extension settings:', error);
      isExtensionEnabled = true;
      updateExtensionToggleUI();
    }
  }
  
  /**
   * Update extension toggle UI
   */
  function updateExtensionToggleUI() {
    if (extensionToggle) {
      extensionToggle.checked = isExtensionEnabled;
    }
    if (toggleLabel) {
      toggleLabel.textContent = isExtensionEnabled ? 'Enabled' : 'Disabled';
    }
    if (footerStatus) {
      footerStatus.textContent = isExtensionEnabled 
        ? 'Extension active on all tabs'
        : 'Extension disabled';
    }
    if (popupContainer) {
      popupContainer.classList.toggle('disabled', !isExtensionEnabled);
    }
  }

  async function applyStoredTheme() {
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
      const theme = (result && typeof result.theme === 'string' ? result.theme : null) || 'light';
      setTheme(theme);
    } catch (error) {
      setTheme('light');
    }
  }

  function setTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) themeToggle.checked = isDark;
    if (themeLabel) themeLabel.textContent = isDark ? 'Dark' : 'Light';
    try { localStorage.setItem('ume_theme', theme); } catch (_) {}
  }

  async function handleThemeToggle() {
    const newTheme = themeToggle?.checked ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync && typeof browser.storage.sync.set === 'function') {
        await browser.storage.sync.set({ theme: newTheme });
      } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.set === 'function') {
        await new Promise((resolve, reject) => {
          chrome.storage.sync.set({ theme: newTheme }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (e) {}
  }

  // Fallback to last-set theme quickly
  try {
    const cachedTheme = localStorage.getItem('ume_theme');
    if (cachedTheme === 'dark' || cachedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', cachedTheme);
    }
  } catch (_) {}
  
  /**
   * Handle extension toggle change
   */
  async function handleExtensionToggle() {
    try {
      isExtensionEnabled = extensionToggle.checked;
      
      // Save to storage
      await browserAPI.storage.local.set({ extensionEnabled: isExtensionEnabled });
      
      // Notify background script
      await sendMessage({ 
        type: 'EXTENSION_TOGGLE',
        enabled: isExtensionEnabled
      });
      
      // Update UI
      updateExtensionToggleUI();
      
      // Refresh data
      loadTabsData();
      
    } catch (error) {
      console.error('Failed to toggle extension:', error);
      showError('Failed to toggle extension');
    }
  }
  
  /**
   * Load tabs data from background script
   */
  async function loadTabsData() {
    try {
      const response = await sendMessage({ type: 'GET_ACTIVE_TABS' });
      
      console.log('DEBUG: Received response from GET_ACTIVE_TABS:', response);
      
      if (response) {
        updateUI(response);
      } else {
        console.log('DEBUG: No response received, showing empty state');
        // Show empty state instead of error
        updateUI({ activeTabs: [], currentPlaying: null });
      }
    } catch (error) {
      console.error('Failed to load tabs data:', error);
      showError('Failed to load media tabs');
    }
  }
  
  /**
   * Update the popup UI with current tab data
   */
  function updateUI(data) {
    const { activeTabs = [], currentPlaying } = data;
    currentTabs = activeTabs;
    
    console.log('DEBUG: updateUI called with data:', data);
    console.log('DEBUG: activeTabs:', activeTabs);
    console.log('DEBUG: currentPlaying:', currentPlaying);
    
    // Update status indicator  
    updateStatus(activeTabs.length, currentPlaying, data);
    
    // Update tabs list
    updateTabsList(activeTabs, currentPlaying);
    
    // Update controls
    updateControls(activeTabs.length);
    
    // Update speed controls
    updateSpeedControls(activeTabs);
    
    // Update volume controls
    updateVolumeControls(activeTabs);
  }
  
  /**
   * Update status indicator
   */
  function updateStatus(activeCount, currentPlaying, data) {
    if (!statusDot || !statusText) return;
    
    const totalTabs = data?.totalTabs || activeCount;
    
    if (!isExtensionEnabled) {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Extension disabled';
    } else if (currentPlaying) {
      statusDot.className = 'status-dot active';
      statusText.textContent = `Media playing (${totalTabs} site${totalTabs !== 1 ? 's' : ''} tracked)`;
    } else if (activeCount > 0) {
      statusDot.className = 'status-dot paused';
      statusText.textContent = `Media available (${activeCount} of ${totalTabs})`;
    } else if (totalTabs > 0) {
      statusDot.className = 'status-dot monitoring';
      statusText.textContent = `Monitoring ${totalTabs} media site${totalTabs !== 1 ? 's' : ''}`;
    } else {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'No media sites detected';
    }
  }
  
  /**
   * Update the tabs list
   */
  function updateTabsList(tabs, currentPlaying) {
    if (!tabsList || !noTabsMessage) return;
    
    // Clear existing content
    tabsList.innerHTML = '';
    
    if (tabs.length === 0) {
      // Show no tabs message
      tabsList.style.display = 'none';
      noTabsMessage.style.display = 'block';
      return;
    }
    
    // Hide no tabs message and show tabs list
    noTabsMessage.style.display = 'none';
    tabsList.style.display = 'flex';
    
    // Create tab items
    tabs.forEach((tabData) => {
      const { tabId, ...tabInfo } = tabData;
      const tabItem = createTabItem(tabId, tabInfo, tabId === currentPlaying);
      tabsList.appendChild(tabItem);
    });
  }
  
  /**
   * Create a tab item element
   */
  function createTabItem(tabId, tabInfo, isPlaying) {
    // Determine display status
    const status = tabInfo.status || (isPlaying ? 'playing' : 'paused');
    
    const tabItem = document.createElement('div');
    tabItem.className = `tab-item ${status} fade-in`;
    tabItem.setAttribute('data-tab-id', tabId);
    tabItem.setAttribute('data-status', status);
    
    // Create favicon
    let favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    if (tabInfo.favicon) {
      favicon.src = tabInfo.favicon;
      favicon.onerror = () => {
        const placeholder = createFaviconPlaceholder(favicon, tabInfo.mediaType);
        if (placeholder && favicon.parentNode) {
          // createFaviconPlaceholder already handled the replacement
        }
      };
    } else {
      // No favicon URL, use placeholder directly
      const placeholder = createFaviconPlaceholder(favicon, tabInfo.mediaType);
      if (placeholder) {
        favicon = placeholder; // Use the placeholder element instead
      }
    }
    
    // Create tab info
    const tabInfoDiv = document.createElement('div');
    tabInfoDiv.className = 'tab-info';
    
    const tabTitle = document.createElement('div');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = tabInfo.title || 'Unknown Title';
    tabTitle.title = tabInfo.title || 'Unknown Title';
    
    const tabUrl = document.createElement('div');
    tabUrl.className = 'tab-url';
    const urlText = formatUrl(tabInfo.url);
    tabUrl.textContent = urlText;
    tabUrl.title = tabInfo.url;
    
    tabInfoDiv.appendChild(tabTitle);
    tabInfoDiv.appendChild(tabUrl);
    
    // Create status indicator
    const statusDiv = document.createElement('div');
    statusDiv.className = `tab-status ${status}`;
    
    const statusIcon = document.createElement('span');
    const statusText = document.createElement('span');
    
    // Set icon and text based on status
    switch (status) {
      case 'playing':
        statusIcon.textContent = '▶️';
        const playbackRate = tabInfo.playbackRate || 1.0;
        statusText.textContent = `Playing (${playbackRate.toFixed(2)}x)`;
        break;
      case 'paused':
        statusIcon.textContent = '⏸️';
        statusText.textContent = 'Paused';
        break;
      case 'has_media':
        statusIcon.textContent = '🎬';
        statusText.textContent = 'Media available';
        break;
      case 'monitoring':
      default:
        statusIcon.textContent = '👁️';
        statusText.textContent = 'Monitoring...';
        break;
    }
    
    statusDiv.appendChild(statusIcon);
    statusDiv.appendChild(statusText);
    
    // Create controls
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'tab-controls';
    
    // Pause button (only show if playing)
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'tab-control-btn';
    pauseBtn.innerHTML = '⏸️';
    pauseBtn.title = 'Pause this tab';
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pauseTab(tabId);
    });
    pauseBtn.style.display = isPlaying ? 'flex' : 'none';
    
    const focusBtn = document.createElement('button');
    focusBtn.className = 'tab-control-btn';
    focusBtn.innerHTML = '🔍';
    focusBtn.title = 'Switch to this tab';
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchToTab(tabId);
    });
    
    controlsDiv.appendChild(pauseBtn);
    controlsDiv.appendChild(focusBtn);
    
    // Add click handler for tab item
    tabItem.addEventListener('click', () => switchToTab(tabId));
    
    // Assemble the tab item
    tabItem.appendChild(favicon);
    tabItem.appendChild(tabInfoDiv);
    tabItem.appendChild(statusDiv);
    tabItem.appendChild(controlsDiv);
    
    return tabItem;
  }
  
  /**
   * Create a placeholder favicon when image fails to load
   */
  function createFaviconPlaceholder(imgElement, mediaType) {
    // Replace img with div for placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'tab-favicon placeholder';
    placeholder.textContent = mediaType === 'video' ? '📹' : '🎵';
    
    // Check if imgElement has a parent before replacing
    if (imgElement.parentNode) {
      imgElement.parentNode.replaceChild(placeholder, imgElement);
    } else {
      // If no parent, copy the className and return the placeholder
      // This handles cases where the element isn't in the DOM yet
      placeholder.className = imgElement.className + ' placeholder';
      return placeholder;
    }
  }
  
  /**
   * Format URL for display
   */
  function formatUrl(url) {
    if (!url) return 'Unknown URL';
    
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }
  
  /**
   * Update control buttons state
   */
  function updateControls(activeCount) {
    if (!pauseAllButton) return;
    
    pauseAllButton.disabled = activeCount === 0 || !isExtensionEnabled;
  }
  
  /**
   * Handle pause all button click
   */
  async function handlePauseAll() {
    try {
      showLoading(pauseAllButton);
      
      // Pause all active tabs
      for (const tabData of currentTabs) {
        await pauseTab(tabData.tabId);
      }
      
      // Refresh data after a short delay
      setTimeout(() => {
        loadTabsData();
        hideLoading(pauseAllButton);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to pause all tabs:', error);
      hideLoading(pauseAllButton);
      showError('Failed to pause all media');
    }
  }
  
  /**
   * Handle refresh button click
   */
  async function handleRefresh() {
    try {
      showLoading(refreshButton);
      await loadTabsData();
      hideLoading(refreshButton);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      hideLoading(refreshButton);
      showError('Failed to refresh data');
    }
  }

  /**
   * Handle options button click
   */
  async function handleOptions() {
    try {
      await browserAPI.runtime.openOptionsPage();
    } catch (error) {
      console.error('Failed to open options page:', error);
      showError('Failed to open options page');
    }
  }
  
  /**
   * Pause media in a specific tab
   */
  async function pauseTab(tabId) {
    try {
      await sendMessage({ type: 'PAUSE_TAB', tabId });
    } catch (error) {
      console.error(`Failed to pause tab ${tabId}:`, error);
      throw error;
    }
  }
  

  
  /**
   * Switch to a specific tab
   */
  async function switchToTab(tabId) {
    try {
      await browserAPI.tabs.update(parseInt(tabId), { active: true });
      window.close(); // Close popup after switching
    } catch (error) {
      console.error(`Failed to switch to tab ${tabId}:`, error);
      showError('Failed to switch to tab');
    }
  }
  
  /**
   * Update speed controls based on current tab data
   */
  function updateSpeedControls(tabs) {
    if (!speedControlSection) return;
    
    const playingTabs = tabs.filter(tab => tab.isPlaying);
    const hasPlayingMedia = playingTabs.length > 0;
    
    // Show/hide speed controls based on media presence
    if (hasPlayingMedia) {
      speedControlSection.classList.remove('disabled');
      
      // Get the speed of the first playing tab (assume all have same speed for simplicity)
      const firstPlayingTab = playingTabs[0];
      if (firstPlayingTab.playbackRate !== undefined) {
        updateSpeedDisplay(firstPlayingTab.playbackRate);
      }
    } else {
      speedControlSection.classList.add('disabled');
      updateSpeedDisplay(1.0);
    }
  }

  /**
   * Update speed display in the popup
   */
  function updateSpeedDisplay(speed) {
    if (currentSpeedDisplay) {
      currentSpeed = speed;
      currentSpeedDisplay.textContent = speed.toFixed(2) + 'x';
    }
  }

  /**
   * Send message to background script
   */
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        // Firefox compatibility - sometimes the callback isn't needed
        if (typeof browser !== 'undefined' && browser.runtime) {
          // Firefox approach
          const result = browserAPI.runtime.sendMessage(message);
          if (result && typeof result.then === 'function') {
            // Firefox returns a Promise
            result.then(resolve).catch(reject);
          } else {
            // Fallback to callback approach
            browserAPI.runtime.sendMessage(message, (response) => {
              if (browserAPI.runtime.lastError) {
                reject(new Error(browserAPI.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          }
        } else {
          // Chrome approach
          browserAPI.runtime.sendMessage(message, (response) => {
            if (browserAPI.runtime.lastError) {
              reject(new Error(browserAPI.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Show loading state on button
   */
  function showLoading(button) {
    if (!button) return;
    
    button.disabled = true;
    const originalText = button.querySelector('.button-text')?.textContent;
    const textElement = button.querySelector('.button-text');
    
    if (textElement) {
      textElement.textContent = 'Loading...';
      button.setAttribute('data-original-text', originalText);
    }
  }
  
  /**
   * Hide loading state on button
   */
  function hideLoading(button) {
    if (!button) return;
    
    button.disabled = false;
    const originalText = button.getAttribute('data-original-text');
    const textElement = button.querySelector('.button-text');
    
    if (textElement && originalText) {
      textElement.textContent = originalText;
      button.removeAttribute('data-original-text');
    }
  }
  
  /**
   * Show error message
   */
  function showError(message) {
    // Create a simple error toast
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc3545;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  /**
   * Load volume settings from storage and current tabs
   */
  async function loadVolumeSettings() {
    try {
      // Get volume settings from storage
      let result;
      if (typeof browser !== 'undefined' && browser.storage) {
        result = await browser.storage.sync.get(['globalVolume', 'perDomainVolume', 'volumeBoosterEnabled']);
      } else if (typeof chrome !== 'undefined' && chrome.storage) {
        result = await new Promise((resolve, reject) => {
          chrome.storage.sync.get(['globalVolume', 'perDomainVolume', 'volumeBoosterEnabled'], (data) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(data);
            }
          });
        });
      } else {
        throw new Error('No storage API available');
      }
      
      volumeSettings = {
        globalVolume: result.globalVolume || 1.0,
        perDomainVolume: result.perDomainVolume || {},
        volumeBoosterEnabled: result.volumeBoosterEnabled !== false
      };
      
      // Get current active tab's domain volume
      await updateCurrentVolumeDisplay();
      
    } catch (error) {
      console.error('Failed to load volume settings:', error);
      volumeSettings = { globalVolume: 1.0, perDomainVolume: {}, volumeBoosterEnabled: true };
      updateCurrentVolumeDisplay();
    }
  }

  /**
   * Update current volume display based on active tab
   */
  async function updateCurrentVolumeDisplay() {
    try {
      // Get the current active tab's domain
      let tabs;
      if (typeof browser !== 'undefined' && browser.tabs) {
        tabs = await browser.tabs.query({ active: true, currentWindow: true });
      } else if (typeof chrome !== 'undefined' && chrome.tabs) {
        tabs = await new Promise((resolve, reject) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      } else {
        throw new Error('No tabs API available');
      }
      
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];
        const hostname = new URL(currentTab.url).hostname;
        
        // Get domain-specific volume or fall back to global
        const domainVolume = volumeSettings.perDomainVolume[hostname] || volumeSettings.globalVolume;
        
        updateVolumeDisplay(domainVolume);
      } else {
        updateVolumeDisplay(volumeSettings.globalVolume);
      }
    } catch (error) {
      console.error('Failed to get current tab domain:', error);
      updateVolumeDisplay(volumeSettings.globalVolume);
    }
  }

  /**
   * Update volume display in the popup
   */
  function updateVolumeDisplay(volume) {
    currentVolume = volume;
    
    if (currentVolumeDisplay) {
      currentVolumeDisplay.textContent = `${(volume * 100).toFixed(0)}%`;
    }
    
    if (volumeSlider) {
      volumeSlider.value = volume * 100; // Convert to percentage
    }
    
    // Update volume control section visibility based on settings
    if (volumeControlSection) {
      if (volumeSettings.volumeBoosterEnabled && currentTabs.length > 0) {
        volumeControlSection.classList.remove('disabled');
      } else {
        volumeControlSection.classList.add('disabled');
      }
    }
  }

  /**
   * Handle volume slider change
   */
  async function handleVolumeSliderChange() {
    const newVolumePercent = parseInt(volumeSlider.value);
    const newVolume = newVolumePercent / 100; // Convert to multiplier
    
    await setActiveTabVolume(newVolume);
    updateVolumeDisplay(newVolume);
  }

  /**
   * Handle volume up button click
   */
  async function handleVolumeUp() {
    const newVolume = Math.min(currentVolume + 0.1, 5.0); // Max 500%
    await setActiveTabVolume(newVolume);
    updateVolumeDisplay(newVolume);
  }

  /**
   * Handle volume down button click
   */
  async function handleVolumeDown() {
    const newVolume = Math.max(currentVolume - 0.1, 0.1); // Min 10%
    await setActiveTabVolume(newVolume);
    updateVolumeDisplay(newVolume);
  }

  /**
   * Handle volume reset button click
   */
  async function handleVolumeReset() {
    const resetVolume = 1.0; // 100%
    await setActiveTabVolume(resetVolume);
    updateVolumeDisplay(resetVolume);
  }

  /**
   * Set volume for the active tab
   */
  async function setActiveTabVolume(volume) {
    try {
      console.log('setActiveTabVolume called with volume:', volume);
      
      // Check if browserAPI is available
      if (!browserAPI || !browserAPI.tabs) {
        console.error('Browser API not available');
        showError('Browser extension API not available');
        return;
      }
      
      console.log('Querying for active tab...');
      
      // Get the current active tab with better error handling
      let tabs;
      try {
        // Handle both Promise-based (Firefox) and callback-based (Chrome) APIs
        if (typeof browser !== 'undefined' && browser.tabs) {
          // Firefox - returns a Promise
          tabs = await browser.tabs.query({ active: true, currentWindow: true });
        } else if (typeof chrome !== 'undefined' && chrome.tabs) {
          // Chrome - use callback wrapped in Promise
          tabs = await new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          });
        } else {
          throw new Error('No browser tabs API available');
        }
      } catch (queryError) {
        console.error('Failed to query tabs:', queryError);
        showError('Failed to access browser tabs: ' + queryError.message);
        return;
      }
      
      console.log('Tabs query result:', tabs, 'Type:', typeof tabs, 'IsArray:', Array.isArray(tabs));
      
      if (!tabs || !Array.isArray(tabs)) {
        console.error('Invalid tabs result:', tabs);
        showError('Failed to get active tab - invalid response');
        return;
      }
      
      if (tabs.length === 0) {
        console.warn('No active tab found for volume control');
        showError('No active tab found');
        return;
      }
      
      const activeTab = tabs[0];
      console.log('Active tab found:', activeTab);
      
      // Validate tab
      if (!activeTab.id) {
        console.error('Active tab has no ID');
        showError('Invalid active tab');
        return;
      }
      
      // Validate URL
      if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('about://') || activeTab.url.startsWith('moz-extension://')) {
        console.warn('Cannot control volume on system pages:', activeTab.url);
        showError('Cannot control volume on this page');
        return;
      }
      
      const hostname = new URL(activeTab.url).hostname;
      
      console.log(`Attempting to set volume to ${volume} for tab ${activeTab.id} (${hostname})`);
      
      // Send message DIRECTLY to content script in the specific tab
      let response;
      try {
        // Handle both Promise-based (Firefox) and callback-based (Chrome) APIs
        if (typeof browser !== 'undefined' && browser.tabs) {
          // Firefox - returns a Promise
          response = await browser.tabs.sendMessage(activeTab.id, {
            type: 'SET_VOLUME',
            volume: volume
          });
        } else if (typeof chrome !== 'undefined' && chrome.tabs) {
          // Chrome - use callback wrapped in Promise
          response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(activeTab.id, {
              type: 'SET_VOLUME',
              volume: volume
            }, (result) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(result);
              }
            });
          });
        } else {
          throw new Error('No browser messaging API available');
        }
      } catch (messageError) {
        console.error('Failed to send message to content script:', messageError);
        showError('Could not communicate with page. Try refreshing the page.');
        return;
      }
      
      console.log('Volume change response:', response);
      
      if (response && response.success) {
        // Update stored volume settings
        volumeSettings.perDomainVolume[hostname] = volume;
        
        // Save to storage
        if (typeof browser !== 'undefined' && browser.storage) {
          await browser.storage.sync.set({
            perDomainVolume: volumeSettings.perDomainVolume
          });
        } else if (typeof chrome !== 'undefined' && chrome.storage) {
          await new Promise((resolve, reject) => {
            chrome.storage.sync.set({
              perDomainVolume: volumeSettings.perDomainVolume
            }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });
        }
        
        console.log(`Volume successfully set to ${(volume * 100).toFixed(0)}% for ${hostname}`);
      } else {
        console.error('Failed to set volume:', response?.error || 'Unknown error');
        showError('Failed to change volume: ' + (response?.error || 'Unknown error'));
      }
      
    } catch (error) {
      console.error('Failed to set tab volume:', error);
      showError('Failed to change volume: ' + error.message);
    }
  }

  /**
   * Update volume controls based on current tab data
   */
  function updateVolumeControls(tabs) {
    if (!volumeControlSection) return;
    
    const hasActiveMedia = tabs.length > 0;
    const isVolumeEnabled = volumeSettings.volumeBoosterEnabled;
    
    // Show/hide volume controls based on media presence and settings
    if (hasActiveMedia && isVolumeEnabled) {
      volumeControlSection.classList.remove('disabled');
      updateCurrentVolumeDisplay();
    } else {
      volumeControlSection.classList.add('disabled');
    }
  }

  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})(); 