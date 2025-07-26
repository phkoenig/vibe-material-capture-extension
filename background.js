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
  
  if (request.action === 'captureScreenshot') {
    // Handle screenshot capture
    sendResponse({ success: true, message: 'Screenshot captured' });
  }
  
  return true; // Keep message channel open for async response
}); 