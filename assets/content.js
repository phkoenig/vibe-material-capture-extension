// Content Script: Send page URL to extension
// This runs in the context of the web page
console.log('VIBE Content Script loaded on:', window.location.href);

// Send current page URL to extension
chrome.runtime.sendMessage({ 
  action: 'page_url', 
  url: window.location.href,
  title: document.title,
  timestamp: new Date().toISOString()
}); 