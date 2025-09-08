// Background Service Worker for VIBE Material Capture Tool
console.log('VIBE Material Capture Tool Background Service Worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('VIBE Material Capture Tool installed');
  
  // Enable side panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Handle action button click
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension action clicked, opening side panel');
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Handle messages from content scripts or side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'getCurrentTabUrl') {
    // Get current active tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const url = tabs[0].url;
        console.log('Current tab URL from background:', url);
        sendResponse({ url: url });
      } else {
        console.log('No active tab found');
        sendResponse({ url: null });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'captureScreenshot') {
    // Handle screenshot capture
    sendResponse({ success: true, message: 'Screenshot captured' });
  }
  
  if (request.action === 'openNewTab') {
    // Open a new tab with the specified URL
    console.log('Opening new tab with URL:', request.url);
    chrome.tabs.create({ url: request.url }, (newTab) => {
      if (chrome.runtime.lastError) {
        console.error('Error creating tab:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('New tab created successfully:', newTab);
        sendResponse({ success: true, tab: newTab });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  return true; // Keep message channel open for async response
}); 