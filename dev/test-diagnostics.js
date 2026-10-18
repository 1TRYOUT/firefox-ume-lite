/**
 * UME Extension Diagnostic Test Script
 * Run this in the browser console to test and diagnose extension issues
 */

(function() {
  'use strict';
  
  console.log('🔍 Starting UME Extension Diagnostic Tests...\n');
  
  // Test configuration
  const TEST_CONFIG = {
    extensionId: 'onetab-media@example.com',
    testDuration: 30000, // 30 seconds
    checkInterval: 5000,  // 5 seconds
    simulateSpeedChanges: true,
    simulateTabSwitching: false
  };
  
  let testResults = {
    startTime: Date.now(),
    backgroundTests: {},
    contentTests: {},
    tabTrackingTests: {},
    performanceTests: {},
    errors: []
  };
  
  /**
   * Test helper functions
   */
  function logTest(category, test, result, data = null) {
    const timestamp = new Date().toISOString();
    const status = result ? '✅' : '❌';
    console.log(`${status} [${category}] ${test}`, data ? data : '');
    
    if (!testResults[category]) testResults[category] = {};
    testResults[category][test] = { result, data, timestamp };
  }
  
  function logError(error, context = '') {
    console.error('🚨 Test Error:', context, error);
    testResults.errors.push({ error: error.message, context, timestamp: new Date().toISOString() });
  }
  
  /**
   * Test background script functionality
   */
  async function testBackgroundScript() {
    console.log('\n📱 Testing Background Script...');
    
    try {
      // Test extension detection
      const isExtensionActive = typeof browser !== 'undefined' || typeof chrome !== 'undefined';
      logTest('backgroundTests', 'Extension APIs Available', isExtensionActive);
      
      if (!isExtensionActive) {
        logTest('backgroundTests', 'Background Communication', false, 'Extension APIs not available');
        return;
      }
      
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
      
      // Test background script communication
      try {
        const diagnostics = await browserAPI.runtime.sendMessage({ type: 'GET_DIAGNOSTICS' });
        logTest('backgroundTests', 'Background Communication', true, {
          uptime: Math.round(diagnostics.uptime / 1000) + 's',
          activeTabsCount: diagnostics.activeTabsCount,
          potentialTabsCount: diagnostics.potentialTabsCount,
          extensionEnabled: diagnostics.isExtensionEnabled
        });
        
        // Test stats
        logTest('backgroundTests', 'Statistics Tracking', 
          diagnostics.stats && typeof diagnostics.stats.tabsTracked === 'number',
          diagnostics.stats
        );
        
        // Test recent logs
        logTest('backgroundTests', 'Logging System', 
          diagnostics.recentLogs && diagnostics.recentLogs.length > 0,
          `${diagnostics.recentLogs.length} recent log entries`
        );
        
      } catch (error) {
        logError(error, 'Background script communication');
        logTest('backgroundTests', 'Background Communication', false, error.message);
      }
      
    } catch (error) {
      logError(error, 'Background script testing');
    }
  }
  
  /**
   * Test content script functionality
   */
  async function testContentScript() {
    console.log('\n📄 Testing Content Script...');
    
    try {
      // Test if content script is loaded
      const hasContentScript = typeof window.mediaTabManagerInjected !== 'undefined';
      logTest('contentTests', 'Content Script Loaded', hasContentScript);
      
      // Test media detection
      const videoElements = document.querySelectorAll('video');
      const audioElements = document.querySelectorAll('audio');
      const totalMedia = videoElements.length + audioElements.length;
      
      logTest('contentTests', 'Media Elements Detection', totalMedia > 0, {
        videos: videoElements.length,
        audios: audioElements.length,
        total: totalMedia
      });
      
      // Test for livestreams
      const livestreams = Array.from(videoElements).filter(v => 
        v.duration === Infinity || isNaN(v.duration)
      );
      logTest('contentTests', 'Livestream Detection', true, {
        livestreamCount: livestreams.length,
        regularVideos: videoElements.length - livestreams.length
      });
      
      // Test video controller presence
      const videoControllers = Array.from(videoElements).filter(v => v.vsc);
      logTest('contentTests', 'Video Controllers Created', 
        videoControllers.length > 0 || videoElements.length === 0,
        `${videoControllers.length}/${videoElements.length} videos have controllers`
      );
      
      // Test content script diagnostics if available
      if (typeof browser !== 'undefined' || typeof chrome !== 'undefined') {
        try {
          const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
          const contentDiagnostics = await browserAPI.runtime.sendMessage({ 
            type: 'GET_CONTENT_DIAGNOSTICS' 
          });
          
          logTest('contentTests', 'Content Diagnostics', true, {
            uptime: Math.round(contentDiagnostics.uptime / 1000) + 's',
            activeMediaCount: contentDiagnostics.activeMediaCount,
            stats: contentDiagnostics.stats
          });
        } catch (error) {
          logTest('contentTests', 'Content Diagnostics', false, 'Not available from this context');
        }
      }
      
    } catch (error) {
      logError(error, 'Content script testing');
    }
  }
  
  /**
   * Test tab tracking functionality
   */
  async function testTabTracking() {
    console.log('\n🗂️ Testing Tab Tracking...');
    
    try {
      if (typeof browser === 'undefined' && typeof chrome === 'undefined') {
        logTest('tabTrackingTests', 'Tab Tracking', false, 'Extension APIs not available');
        return;
      }
      
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
      
      // Get current tab tracking state
      const state = await browserAPI.runtime.sendMessage({ type: 'GET_ACTIVE_TABS' });
      
      logTest('tabTrackingTests', 'Tab State Retrieval', true, {
        activeTabs: state.activeTabs ? state.activeTabs.length : 0,
        currentPlaying: state.currentPlaying,
        totalTabs: state.totalTabs,
        extensionEnabled: state.extensionEnabled
      });
      
      // Check if current tab is being tracked
      const currentTabHasMedia = document.querySelectorAll('video, audio').length > 0;
      if (currentTabHasMedia) {
        const isCurrentTabTracked = state.activeTabs && 
          state.activeTabs.some(tab => tab.url === window.location.href);
        
        logTest('tabTrackingTests', 'Current Tab Tracking', 
          isCurrentTabTracked || state.activeTabs.length === 0,
          `Current tab ${isCurrentTabTracked ? 'is' : 'is not'} being tracked`
        );
      }
      
      // Test media state communication
      try {
        await browserAPI.runtime.sendMessage({ 
          type: 'MEDIA_STARTED',
          mediaInfo: {
            type: 'video',
            src: 'test',
            title: 'Test Media',
            duration: 100
          }
        });
        logTest('tabTrackingTests', 'Media State Communication', true);
      } catch (error) {
        logTest('tabTrackingTests', 'Media State Communication', false, error.message);
      }
      
    } catch (error) {
      logError(error, 'Tab tracking testing');
    }
  }
  
  /**
   * Test video performance
   */
  async function testVideoPerformance() {
    console.log('\n⚡ Testing Video Performance...');
    
    try {
      const videoElements = document.querySelectorAll('video');
      
      if (videoElements.length === 0) {
        logTest('performanceTests', 'Video Performance', true, 'No videos to test');
        return;
      }
      
      // Test each video element
      for (let i = 0; i < videoElements.length; i++) {
        const video = videoElements[i];
        const isLivestream = video.duration === Infinity || isNaN(video.duration);
        
        logTest('performanceTests', `Video ${i} Analysis`, true, {
          src: video.src || video.currentSrc || 'No source',
          duration: video.duration,
          isLivestream: isLivestream,
          readyState: video.readyState,
          playbackRate: video.playbackRate,
          paused: video.paused,
          hasController: !!video.vsc
        });
        
        // Test speed change if not livestream and video is ready
        if (!isLivestream && video.readyState >= 1 && TEST_CONFIG.simulateSpeedChanges) {
          try {
            const originalSpeed = video.playbackRate;
            video.playbackRate = 1.5;
            
            // Wait a bit and check if speed stuck
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const speedChangeSuccessful = Math.abs(video.playbackRate - 1.5) < 0.01;
            logTest('performanceTests', `Video ${i} Speed Change`, speedChangeSuccessful, {
              originalSpeed: originalSpeed,
              targetSpeed: 1.5,
              actualSpeed: video.playbackRate,
              successful: speedChangeSuccessful
            });
            
            // Restore original speed
            video.playbackRate = originalSpeed;
            
          } catch (error) {
            logError(error, `Video ${i} speed change test`);
          }
        }
      }
      
    } catch (error) {
      logError(error, 'Video performance testing');
    }
  }
  
  /**
   * Monitor extension for a period of time
   */
  async function monitorExtension() {
    console.log('\n⏱️ Starting Extension Monitoring...');
    
    let monitorCount = 0;
    const maxMonitorChecks = Math.floor(TEST_CONFIG.testDuration / TEST_CONFIG.checkInterval);
    
    const monitorInterval = setInterval(async () => {
      monitorCount++;
      console.log(`\n📊 Monitor Check ${monitorCount}/${maxMonitorChecks}`);
      
      try {
        if (typeof browser !== 'undefined' || typeof chrome !== 'undefined') {
          const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
          
          // Check extension state
          const diagnostics = await browserAPI.runtime.sendMessage({ type: 'GET_DIAGNOSTICS' });
          
          console.log('Extension Status:', {
            uptime: Math.round(diagnostics.uptime / 1000) + 's',
            activeTabs: diagnostics.activeTabsCount,
            potentialTabs: diagnostics.potentialTabsCount,
            errors: diagnostics.stats.errors,
            speedChanges: diagnostics.stats.speedChanges
          });
          
          // Check for tab loss issues
          const currentTabHasMedia = document.querySelectorAll('video, audio').length > 0;
          const state = await browserAPI.runtime.sendMessage({ type: 'GET_ACTIVE_TABS' });
          
          if (currentTabHasMedia && state.activeTabs) {
            const isTracked = state.activeTabs.some(tab => 
              tab.url === window.location.href || 
              tab.title === document.title
            );
            
            if (!isTracked) {
              console.warn('⚠️ Current tab with media is not being tracked!');
            }
          }
        }
        
        // Check video states
        const videos = document.querySelectorAll('video');
        videos.forEach((video, index) => {
          if (video.duration === Infinity) {
            console.log(`Livestream ${index}:`, {
              playbackRate: video.playbackRate,
              paused: video.paused,
              readyState: video.readyState
            });
          }
        });
        
      } catch (error) {
        console.error('Monitor error:', error);
      }
      
      if (monitorCount >= maxMonitorChecks) {
        clearInterval(monitorInterval);
        generateReport();
      }
    }, TEST_CONFIG.checkInterval);
  }
  
  /**
   * Generate final test report
   */
  function generateReport() {
    console.log('\n📋 FINAL TEST REPORT');
    console.log('==================');
    
    const totalTime = Date.now() - testResults.startTime;
    console.log(`Test Duration: ${Math.round(totalTime / 1000)}s`);
    console.log(`URL: ${window.location.href}`);
    console.log(`User Agent: ${navigator.userAgent.slice(0, 100)}...`);
    
    // Count passed/failed tests
    let totalTests = 0;
    let passedTests = 0;
    
    Object.keys(testResults).forEach(category => {
      if (typeof testResults[category] === 'object' && category !== 'errors') {
        Object.keys(testResults[category]).forEach(test => {
          totalTests++;
          if (testResults[category][test].result) passedTests++;
        });
      }
    });
    
    console.log(`\nTest Results: ${passedTests}/${totalTests} passed`);
    console.log(`Errors: ${testResults.errors.length}`);
    
    // Detailed results
    console.log('\nDetailed Results:');
    console.log(JSON.stringify(testResults, null, 2));
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (testResults.errors.length > 0) {
      console.log('- Extension has errors that need investigation');
    }
    
    if (testResults.backgroundTests && !testResults.backgroundTests['Background Communication']?.result) {
      console.log('- Background script communication failed - check extension installation');
    }
    
    if (testResults.contentTests && !testResults.contentTests['Content Script Loaded']?.result) {
      console.log('- Content script not loaded - check manifest.json and permissions');
    }
    
    const mediaElements = document.querySelectorAll('video, audio').length;
    if (mediaElements > 0 && testResults.tabTrackingTests && 
        !testResults.tabTrackingTests['Current Tab Tracking']?.result) {
      console.log('- Current tab with media is not being tracked - tab tracking issue detected');
    }
    
    console.log('\nTest completed! Check the detailed results above for specific issues.');
  }
  
  /**
   * Run all tests
   */
  async function runAllTests() {
    try {
      await testBackgroundScript();
      await testContentScript();
      await testTabTracking();
      await testVideoPerformance();
      
      // Start monitoring
      monitorExtension();
      
    } catch (error) {
      logError(error, 'Main test execution');
      generateReport();
    }
  }
  
  // Start tests
  runAllTests();
  
})();
