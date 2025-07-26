// Minimal Supabase Client Implementation
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
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
  }

  select(columns = '*') {
    this.query = `select=${columns}`;
    return this;
  }

  insert(data) {
    return this._execute('POST', data);
  }

  update(data) {
    return this._execute('PATCH', data);
  }

  delete() {
    return this._execute('DELETE');
  }

  eq(column, value) {
    this.query += this.query ? '&' : '';
    this.query += `${column}=eq.${encodeURIComponent(value)}`;
    return this;
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

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase Error: ${response.status} ${response.statusText} - ${error}`);
    }

    // Check for content before parsing JSON
    const contentLength = response.headers.get('content-length');
    if (!contentLength || parseInt(contentLength, 10) === 0) {
      return { data: null, error: null };
    }

    // Only parse JSON if there is content
    try {
      const result = await response.json();
      return { data: result, error: null };
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      // Return success with null data if parsing fails but request was ok
      return { data: null, error: null };
    }
  }
}

// Initialize Supabase Client
const SUPABASE_URL = 'https://jpmhwyjiuodsvjowddsm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbWh3eWppdW9kc3Zqb3dkZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYyNjQ0NCwiZXhwIjoyMDY0MjAyNDQ0fQ.U2nrk0Ih7xnPQJ-wtMLS3Tgr0WTNI77LeOFkzhkWwXc';

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
    const result = await supabase.from('captures').select('id');
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
    // Save to Supabase
    const captureData = {
      url: state.currentUrl,
      datetime: state.currentDateTime,
      screenshot_url: state.screenshotUrl,
      thumbnail_url: state.thumbnailUrl,
      created_at: new Date().toISOString()
    };

    const result = await supabase.from('captures').insert(captureData);
    
    if (result.error) {
      console.error('Supabase save error:', result.error);
      state.dbStatus = "Error";
      alert("Fehler beim Speichern: " + result.error.message);
    } else {
      console.log('Capture saved successfully:', result.data);
      state.dbStatus = "Connected";
      alert("Capture erfolgreich gespeichert!");
      // Reset the UI for the next capture
      resetUI();
    }
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