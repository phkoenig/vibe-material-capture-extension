// Minimal Supabase Client Implementation
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  from(table) {
    return new SupabaseQueryBuilder(this.url, this.headers, table);
  }

  async rpc(func, params = {}) {
    const response = await fetch(`${this.url}/rest/v1/rpc/${func}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`RPC Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
}

class SupabaseQueryBuilder {
  constructor(url, headers, table) {
    this.url = url;
    this.headers = headers;
    this.table = table;
    this.query = '';
    this.method = 'GET';
    this.data = null;
  }

  select(columns = '*') {
    this.query = `select=${columns}`;
    return this;
  }

  insert(data) {
    this.method = 'POST';
    this.data = data;
    return this;
  }

  update(data) {
    this.method = 'PATCH';
    this.data = data;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  eq(column, value) {
    this.query += this.query ? '&' : '';
    this.query += `${column}=eq.${encodeURIComponent(value)}`;
    return this;
  }

  order(column, options = {}) {
    const direction = options.ascending !== false ? 'asc' : 'desc';
    this.query += this.query ? '&' : '';
    this.query += `order=${column}.${direction}`;
    return this;
  }

  limit(count) {
    this.query += this.query ? '&' : '';
    this.query += `limit=${count}`;
    return this;
  }

  async execute() {
    return this._execute(this.method, this.data);
  }

  async _execute(method, data = null) {
    const url = `${this.url}/rest/v1/${this.table}${this.query ? '?' + this.query : ''}`;
    
    const options = {
      method: method,
      headers: this.headers
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    console.log('Supabase request:', {
      url: url,
      method: method,
      headers: this.headers,
      body: data ? JSON.stringify(data) : null
    });

    const response = await fetch(url, options);
    
    console.log('Supabase response status:', response.status);
    console.log('Supabase response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase error response:', error);
      throw new Error(`Supabase Error: ${response.status} ${response.statusText} - ${error}`);
    }

    // For INSERT operations with .select(), we should get data back
    if (method === 'POST' && this.query.includes('select=')) {
      try {
        const result = await response.json();
        console.log('Supabase INSERT with SELECT result:', result);
        return { data: result, error: null };
      } catch (e) {
        console.error('Failed to parse JSON response for INSERT with SELECT:', e);
        return { data: null, error: e };
      }
    }

    // For other operations, check if there's content
    const contentLength = response.headers.get('content-length');
    if (!contentLength || parseInt(contentLength, 10) === 0) {
      console.log('Supabase response has no content');
      return { data: null, error: null };
    }

    // Only parse JSON if there is content
    try {
      const result = await response.json();
      console.log('Supabase response data:', result);
      return { data: result, error: null };
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      // Return success with null data if parsing fails but request was ok
      return { data: null, error: null };
    }
  }
}

// Initialize Supabase Client
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State management
let state = {
  screenshotUrl: "",
  thumbnailUrl: "",
  currentUrl: "",
  currentDateTime: "",
  dbStatus: "Disconnected",
  isLoading: false
};

const elements = {
  screenshotBtn: document.getElementById('screenshotBtn'),
  thumbnailBtn: document.getElementById('thumbnailBtn'),
  saveBtn: document.getElementById('saveBtn'),
  screenshotSpinner: document.getElementById('screenshotSpinner'),
  thumbnailSpinner: document.getElementById('thumbnailSpinner'),
  saveSpinner: document.getElementById('saveSpinner'),
  screenshotImg: document.getElementById('screenshotImg'),
  thumbnailImg: document.getElementById('thumbnailImg'),
  urlInput: document.getElementById('urlInput'),
  datetimeInput: document.getElementById('datetimeInput'),
  statusInput: document.getElementById('statusInput'),
  statusIndicator: document.getElementById('statusIndicator'),
  refreshUrlBtn: document.getElementById('refreshUrlBtn')
};

// Chrome API Functions
async function getCurrentTabUrl() {
  try {
    // Try to get URL from background script first
    const response = await chrome.runtime.sendMessage({ action: 'getCurrentTabUrl' });
    if (response && response.url) {
      console.log('URL from background script:', response.url);
      return response.url;
    }
    
    // Fallback: Get the current active tab URL directly
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Found tabs:', tabs);
    
    if (tabs && tabs.length > 0) {
      const url = tabs[0].url;
      console.log('Current tab URL:', url);
      return url || "";
    }
    
    console.log('No active tab found');
    return "";
  } catch (error) {
    console.log('Error getting current tab URL:', error);
    return "";
  }
}

async function captureTabScreenshot() {
  try {
    // Get current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const tab = tabs[0];
    console.log('Capturing screenshot for tab:', tab.url);
    
    // Check if we can capture this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      throw new Error('Cannot capture Chrome internal pages');
    }
    
    // Direct screenshot capture - much simpler!
    const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { 
      format: 'png',
      quality: 100
    });
    
    if (!screenshotUrl) {
      throw new Error('Screenshot capture returned empty result');
    }
    
    console.log('Screenshot captured successfully');
    return screenshotUrl;
    
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
}

async function captureThumbnail() {
  if (!state.screenshotUrl) {
    alert("Bitte zuerst einen Screenshot machen!");
    return;
  }
  
  setLoading(true, 'thumbnail');
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const tab = tabs[0];
    
    // Inject the script to perform area selection on the target page.
    const finalArea = await injectAreaSelection(tab.id);
    
    if (finalArea) {
      // The coordinates are already scaled, so we can use them directly.
      const thumbnailUrl = await createThumbnailFromArea(state.screenshotUrl, finalArea);
      state.thumbnailUrl = thumbnailUrl;
      
      const thumbnailContainer = elements.thumbnailImg;
      thumbnailContainer.innerHTML = `<img src="${thumbnailUrl}" alt="Thumbnail" class="image">`;
      thumbnailContainer.style.height = 'auto';
      thumbnailContainer.style.minHeight = '0';
      
      console.log('Thumbnail created from final scaled area:', finalArea);
    } else {
      console.log('Area selection cancelled');
    }
  } catch (error) {
    console.error('Thumbnail creation failed:', error);
    alert('Thumbnail-Erstellung fehlgeschlagen: ' + error.message);
  }
  
  setLoading(false, 'thumbnail');
}

// Inject area selection into the target page
async function injectAreaSelection(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: performAreaSelection
    }, (results) => {
      if (chrome.runtime.lastError) {
        console.error('Script injection error:', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      
      if (results && results[0] && results[0].result) {
        resolve(results[0].result);
      } else {
        resolve(null);
      }
    });
  });
}

// This function will be injected into the target page to perform selection
// and calculate the final coordinates.
function performAreaSelection() {
  return new Promise((resolve) => {
    // We must calculate coordinates within the context of the target page
    // to get access to the correct devicePixelRatio and viewport dimensions.
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    overlay.style.zIndex = '999999';
    overlay.style.cursor = 'crosshair';
    overlay.style.pointerEvents = 'auto';
    
    // Add instruction text
    const instruction = document.createElement('div');
    instruction.style.position = 'fixed';
    instruction.style.top = '20px';
    instruction.style.left = '50%';
    instruction.style.transform = 'translateX(-50%)';
    instruction.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    instruction.style.color = 'white';
    instruction.style.padding = '12px 20px';
    instruction.style.borderRadius = '6px';
    instruction.style.fontSize = '14px';
    instruction.style.fontFamily = 'Arial, sans-serif';
    instruction.style.zIndex = '1000000';
    instruction.textContent = 'Ziehen Sie einen Rahmen um den gewünschten Bereich. Drücken Sie ESC zum Abbrechen.';
    
    overlay.appendChild(instruction);
    document.body.appendChild(overlay);
    
    let selectionBox = null;
    let startX, startY;

    function handleMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();
      
      startX = e.clientX;
      startY = e.clientY;

      selectionBox = document.createElement('div');
      selectionBox.style.position = 'absolute';
      selectionBox.style.border = '2px solid #db2777';
      selectionBox.style.backgroundColor = 'rgba(219, 39, 119, 0.1)';
      selectionBox.style.zIndex = '1000001';
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      overlay.appendChild(selectionBox);

      overlay.addEventListener('mousemove', handleMouseMove);
      overlay.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(e) {
      e.preventDefault();
      e.stopPropagation();

      const currentX = e.clientX;
      const currentY = e.clientY;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(currentX, startX);
      const top = Math.min(currentY, startY);

      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
    }

    function handleMouseUp(e) {
      e.preventDefault();
      e.stopPropagation();

      cleanup();

      const endX = e.clientX;
      const endY = e.clientY;

      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      if (width > 10 && height > 10) {
        const finalRect = {
          left: Math.round(Math.min(startX, endX) * devicePixelRatio),
          top: Math.round(Math.min(startY, endY) * devicePixelRatio),
          width: Math.round(width * devicePixelRatio),
          height: Math.round(height * devicePixelRatio)
        };
        resolve(finalRect);
      } else {
        resolve(null);
      }
    }
    
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    }
    
    function cleanup() {
      document.removeEventListener('keydown', handleKeyDown);
      overlay.removeEventListener('mousedown', handleMouseDown);
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('mouseup', handleMouseUp);
      document.body.removeChild(overlay);
    }

    overlay.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
  });
}

async function createThumbnailFromArea(imageUrl, area) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
      console.log('Image loaded, dimensions:', img.width, 'x', img.height);
      console.log('Cropping area:', area);
      
      // Validate area coordinates
      if (area.left < 0 || area.top < 0 || 
          area.left + area.width > img.width || 
          area.top + area.height > img.height) {
        console.warn('Area coordinates out of bounds, clamping...');
        area.left = Math.max(0, Math.min(area.left, img.width - area.width));
        area.top = Math.max(0, Math.min(area.top, img.height - area.height));
        area.width = Math.min(area.width, img.width - area.left);
        area.height = Math.min(area.height, img.height - area.top);
        console.log('Clamped area:', area);
      }
      
      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to selected area
      canvas.width = area.width;
      canvas.height = area.height;
      
      console.log('Canvas size:', canvas.width, 'x', canvas.height);
      
      // Draw cropped portion
      ctx.drawImage(
        img,
        area.left, area.top, area.width, area.height,  // Source rectangle
        0, 0, area.width, area.height                   // Destination rectangle
      );
      
      // Convert to data URL
      const thumbnailUrl = canvas.toDataURL('image/png');
      console.log('Thumbnail created successfully');
      resolve(thumbnailUrl);
    };
    
    img.onerror = function() {
      console.error('Failed to load image for cropping');
      reject(new Error('Failed to load image for cropping'));
    };
    
    img.src = imageUrl;
  });
}

function init() {
  console.log('Initializing Chrome Extension...');
  
  // Set current date/time
  state.currentDateTime = new Date().toLocaleString('de-DE');
  elements.datetimeInput.value = state.currentDateTime;
  console.log('Date/time set:', state.currentDateTime);
  
  // Set initial status
  elements.statusInput.value = state.dbStatus;
  
  // Set initial button states
  updateButtonStates();
  
  // Update status indicator
  updateStatusIndicator();
  
  // Test Supabase connection
  testSupabaseConnection();
  
  // Get current tab URL and update UI
  setTimeout(() => {
    updateCurrentUrl();
  }, 500); // Small delay to ensure everything is loaded
  
  // Add test button for debugging
  setTimeout(() => {
    addTestButton();
  }, 1000);
  
  console.log('Initialization complete');
}

async function updateCurrentUrl() {
  try {
    const url = await getCurrentTabUrl();
    state.currentUrl = url;
    elements.urlInput.value = state.currentUrl;
    console.log('URL updated:', state.currentUrl);
    
    // If URL is still empty, try alternative method
    if (!url) {
      console.log('URL is empty, trying alternative method...');
      setTimeout(async () => {
        const retryUrl = await getCurrentTabUrl();
        if (retryUrl) {
          state.currentUrl = retryUrl;
          elements.urlInput.value = retryUrl;
          console.log('URL updated on retry:', retryUrl);
        }
      }, 1000);
    }
  } catch (error) {
    console.log('Error updating URL:', error);
    elements.urlInput.value = "Error getting URL";
  }
}

// Manual URL refresh function
function refreshUrl() {
  console.log('Manually refreshing URL...');
  updateCurrentUrl();
}

async function testSupabaseConnection() {
  try {
    // Test connection by trying to get a simple query
    const result = await supabase.from('captures').select('id').execute();
    if (result.error) {
      console.log('Supabase connection test failed:', result.error);
      state.dbStatus = "Error";
    } else {
      console.log('Supabase connection successful!');
      state.dbStatus = "Connected";
    }
  } catch (err) {
    console.log('Supabase connection error:', err);
    state.dbStatus = "Error";
  }
  
  elements.statusInput.value = state.dbStatus;
  updateStatusIndicator();
}

function updateStatusIndicator() {
  elements.statusIndicator.className = 'status-indicator';
  if (state.dbStatus === "Connected") {
    elements.statusIndicator.classList.add('status-connected');
  } else if (state.dbStatus === "Error") {
    elements.statusIndicator.classList.add('status-error');
  } else {
    elements.statusIndicator.classList.add('status-disconnected');
  }
}

function setLoading(loading, buttonType = 'all') {
  state.isLoading = loading;
  
  if (buttonType === 'all' || buttonType === 'screenshot') {
    elements.screenshotBtn.disabled = loading;
    elements.screenshotSpinner.style.display = loading ? 'inline' : 'none';
    // Hide button text when loading
    const screenshotText = elements.screenshotBtn.childNodes[1]; // Second child is the text
    if (screenshotText && screenshotText.nodeType === Node.TEXT_NODE) {
      screenshotText.style.display = loading ? 'none' : 'inline';
    }
  }
  
  if (buttonType === 'all' || buttonType === 'thumbnail') {
    elements.thumbnailBtn.disabled = loading || !state.screenshotUrl;
    elements.thumbnailSpinner.style.display = loading ? 'inline' : 'none';
    // Hide button text when loading
    const thumbnailText = elements.thumbnailBtn.childNodes[1]; // Second child is the text
    if (thumbnailText && thumbnailText.nodeType === Node.TEXT_NODE) {
      thumbnailText.style.display = loading ? 'none' : 'inline';
    }
  }
  
  if (buttonType === 'all' || buttonType === 'save') {
    elements.saveBtn.disabled = loading || !state.screenshotUrl;
    elements.saveSpinner.style.display = loading ? 'inline' : 'none';
    // Hide button text when loading
    const saveText = elements.saveBtn.childNodes[1]; // Second child is the text
    if (saveText && saveText.nodeType === Node.TEXT_NODE) {
      saveText.style.display = loading ? 'none' : 'inline';
    }
  }
}

// Update button states based on current state
function updateButtonStates() {
  // Screenshot button: always enabled (first step)
  elements.screenshotBtn.disabled = false;
  
  // Thumbnail button: enabled only if screenshot exists
  elements.thumbnailBtn.disabled = !state.screenshotUrl;
  
  // Save button: enabled only if screenshot exists
  elements.saveBtn.disabled = !state.screenshotUrl;
}

// Reset UI to initial state after saving
function resetUI() {
  // Clear images
  elements.screenshotImg.innerHTML = '';
  elements.thumbnailImg.innerHTML = '';
  
  // Restore placeholder heights
  elements.screenshotImg.style.height = '200px';
  elements.thumbnailImg.style.height = '200px';

  // Clear state
  state.screenshotUrl = '';
  state.thumbnailUrl = '';
  
  // Reset button states
  updateButtonStates();
  
  console.log('UI has been reset to initial state.');
}

async function handleScreenshot() {
  setLoading(true, 'screenshot');
  
  try {
    const screenshotUrl = await captureTabScreenshot();
    state.screenshotUrl = screenshotUrl;
    
    // Replace placeholder with actual image
    const screenshotContainer = elements.screenshotImg;
    screenshotContainer.innerHTML = `<img src="${screenshotUrl}" alt="Screenshot" class="image">`;
    
    // Remove fixed height to let image determine container size
    screenshotContainer.style.height = 'auto';
    screenshotContainer.style.minHeight = '0';
    
    // Enable next step buttons
    updateButtonStates();
    
    console.log('Screenshot captured successfully');
  } catch (error) {
    console.error('Screenshot failed:', error);
    alert('Screenshot fehlgeschlagen: ' + error.message);
  }
  
  setLoading(false, 'screenshot');
}

async function handleSave() {
  if (!state.screenshotUrl) {
    alert("Bitte zuerst einen Screenshot aufnehmen!");
    return;
  }
  
  setLoading(true, 'save');
  
  try {
    console.log('=== STARTING SAVE PROCESS ===');
    console.log('Current state:', state);
    
    // Save to Supabase
    const captureData = {
      url: state.currentUrl,
      datetime: state.currentDateTime,
      screenshot_url: state.screenshotUrl,
      thumbnail_url: state.thumbnailUrl,
      created_at: new Date().toISOString()
    };

    console.log('Capture data to save:', captureData);

    // First, insert the data with explicit select to get the inserted data back
    console.log('Attempting Supabase insert with select...');
    const insertResult = await supabase.from('captures').insert(captureData).select('id').execute();
    
    console.log('Supabase insert result:', insertResult);
    
    if (insertResult.error) {
      console.error('Supabase save error:', insertResult.error);
      state.dbStatus = "Error";
      alert("Fehler beim Speichern: " + insertResult.error.message);
      return;
    }
    
    console.log('Capture saved successfully:', insertResult.data);
    state.dbStatus = "Connected";
    
    // Extract capture_id from the insert result
    let captureId = null;
    
    if (insertResult.data && Array.isArray(insertResult.data) && insertResult.data.length > 0) {
      captureId = insertResult.data[0].id;
      console.log('Found capture ID from insert result:', captureId);
    } else if (insertResult.data && insertResult.data.id) {
      captureId = insertResult.data.id;
      console.log('Found capture ID from insert result object:', captureId);
    } else {
      console.log('No capture ID found in insert result');
    }
    
    if (captureId) {
      console.log('=== CAPTURE ID EXTRACTED SUCCESSFULLY ===');
      console.log('Capture ID:', captureId);
      
      // Debug: Check if CONFIG is loaded
      console.log('CONFIG object:', CONFIG);
      console.log('CONFIG.NEXTJS_APP_URL:', CONFIG.NEXTJS_APP_URL);
      console.log('CONFIG.NEXTJS_CAPTURE_ROUTE:', CONFIG.NEXTJS_CAPTURE_ROUTE);
      
      // Open Next.js App with capture_id parameter
      const nextJsUrl = `${CONFIG.NEXTJS_APP_URL}${CONFIG.NEXTJS_CAPTURE_ROUTE}?capture_id=${captureId}`;
      console.log('Next.js URL to open:', nextJsUrl);
      
      // Test if chrome.tabs API is available
      console.log('chrome.tabs available:', typeof chrome !== 'undefined' && chrome.tabs);
      console.log('chrome.tabs.create available:', typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create);
      
      // Try multiple methods to open the new tab
      let tabOpened = false;
      
      // Method 1: Try chrome.tabs.create directly
      try {
        console.log('Method 1: Trying chrome.tabs.create directly...');
        if (chrome.tabs && chrome.tabs.create) {
          const newTab = await chrome.tabs.create({ url: nextJsUrl });
          console.log('Method 1 successful - Next.js App opened in tab:', newTab);
          tabOpened = true;
        } else {
          console.log('chrome.tabs API not available');
        }
      } catch (error) {
        console.error('Method 1 failed:', error);
      }
      
      // Method 2: Try background script message
      if (!tabOpened) {
        try {
          console.log('Method 2: Trying background script message...');
          const response = await chrome.runtime.sendMessage({
            action: 'openNewTab',
            url: nextJsUrl
          });
          
          console.log('Background script response:', response);
          
          if (response && response.success) {
            console.log('Method 2 successful - Next.js App opened in tab:', response.tab);
            tabOpened = true;
          } else {
            console.error('Method 2 failed:', response ? response.error : 'No response');
          }
        } catch (messageError) {
          console.error('Method 2 failed:', messageError);
        }
      }
      
      // Method 3: Try window.open as fallback
      if (!tabOpened) {
        try {
          console.log('Method 3: Trying window.open as fallback...');
          const newWindow = window.open(nextJsUrl, '_blank');
          if (newWindow) {
            console.log('Method 3 successful - Next.js App opened in new window');
            tabOpened = true;
          } else {
            console.error('Method 3 failed - window.open returned null');
          }
        } catch (windowError) {
          console.error('Method 3 failed:', windowError);
        }
      }
      
      // If all methods failed, show manual instructions
      if (!tabOpened) {
        console.error('All methods to open new tab failed');
        alert(`Alle Methoden zum Öffnen der Next.js App sind fehlgeschlagen.\n\nÖffne manuell: ${nextJsUrl}`);
      } else {
        console.log('=== TAB OPENED SUCCESSFULLY ===');
      }
    } else {
      console.warn('No capture_id found in response');
      console.log('Full insertResult.data:', insertResult.data);
      alert('Fehler: Keine capture_id gefunden. Bitte überprüfe die Console für Details.');
    }
    
    // Reset the UI for the next capture
    resetUI();
  } catch (err) {
    console.error('Save error:', err);
    state.dbStatus = "Error";
    alert("Fehler beim Speichern: " + err.message);
  }
  
  elements.statusInput.value = state.dbStatus;
  updateStatusIndicator();
  setLoading(false, 'save');
}

function handleUrlChange(e) { state.currentUrl = e.target.value; }
function handleDateTimeChange(e) { state.currentDateTime = e.target.value; }
function handleStatusChange(e) { state.dbStatus = e.target.value; updateStatusIndicator(); }

// Event Listeners
elements.screenshotBtn.addEventListener('click', handleScreenshot);
elements.thumbnailBtn.addEventListener('click', captureThumbnail);
elements.saveBtn.addEventListener('click', handleSave);
elements.urlInput.addEventListener('input', handleUrlChange);
elements.datetimeInput.addEventListener('input', handleDateTimeChange);
elements.statusInput.addEventListener('input', handleStatusChange);
elements.refreshUrlBtn.addEventListener('click', refreshUrl);

// Listen for tab changes to update URL
chrome.tabs.onActivated.addListener(() => {
  console.log('Tab activated, updating URL...');
  updateCurrentUrl();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log('Tab updated, updating URL...');
    updateCurrentUrl();
  }
});

// Listen for URL from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'page_url' && message.url) {
    state.currentUrl = message.url;
    elements.urlInput.value = message.url;
    console.log('URL received from content script:', message.url);
    console.log('Page title:', message.title);
    console.log('Timestamp:', message.timestamp);
  }
});

// Set text fields to readonly
window.addEventListener('DOMContentLoaded', () => {
  elements.urlInput.readOnly = true;
  elements.datetimeInput.readOnly = true;
  elements.statusInput.readOnly = true;
});

// Initialize app
init();

console.log('Chrome Extension mit Supabase-Integration geladen!'); 

// Test function to verify chrome.tabs.create works
async function testTabCreation() {
  console.log('=== TESTING TAB CREATION ===');
  
  try {
    // Test 1: Check if chrome.tabs is available
    console.log('chrome.tabs available:', typeof chrome !== 'undefined' && chrome.tabs);
    console.log('chrome.tabs.create available:', typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create);
    
    if (!chrome.tabs || !chrome.tabs.create) {
      console.error('chrome.tabs.create is not available');
      alert('chrome.tabs.create ist nicht verfügbar');
      return;
    }
    
    // Test 2: Try to create a simple tab
    console.log('Attempting to create test tab...');
    const testTab = await chrome.tabs.create({ 
      url: 'https://www.google.com',
      active: false 
    });
    
    console.log('Test tab created successfully:', testTab);
    alert('Test-Tab erfolgreich erstellt! Tab ID: ' + testTab.id);
    
    // Close the test tab after 2 seconds
    setTimeout(() => {
      chrome.tabs.remove(testTab.id);
      console.log('Test tab closed');
    }, 2000);
    
  } catch (error) {
    console.error('Test tab creation failed:', error);
    alert('Test-Tab-Erstellung fehlgeschlagen: ' + error.message);
  }
}

// Add test button to UI
function addTestButton() {
  const testBtn = document.createElement('button');
  testBtn.textContent = 'Test Tab Creation';
  testBtn.style.cssText = `
    background: #dc2626;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    margin: 10px 0;
    cursor: pointer;
    font-size: 12px;
  `;
  testBtn.addEventListener('click', testTabCreation);
  
  // Add to the UI (you can adjust the position)
  const container = document.querySelector('.container');
  if (container) {
    container.appendChild(testBtn);
  }
} 