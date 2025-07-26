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

    const result = await response.json();
    return { data: result, error: null };
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
    // Get the current active tab URL
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
  try {
    // Get current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }

    const tab = tabs[0];
    console.log('Capturing thumbnail for tab:', tab.url);
    
    // For thumbnail, we'll use the same screenshot but with lower quality
    const screenshot = await captureTabScreenshot();
    
    // Convert to lower quality (this is a simplified approach)
    // In a real implementation, you might want to resize the image
    return screenshot;
  } catch (error) {
    console.log('Error capturing thumbnail:', error);
    throw error;
  }
}

function init() {
  state.currentDateTime = new Date().toLocaleString('de-DE');
  
  // Get current tab URL and update UI
  updateCurrentUrl();
  
  elements.datetimeInput.value = state.currentDateTime;
  elements.statusInput.value = state.dbStatus;
  
  // Set initial button states
  updateButtonStates();
  
  updateStatusIndicator();
  testSupabaseConnection();
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

async function handleThumbnail() {
  if (!state.screenshotUrl) {
    alert("Bitte zuerst einen Screenshot machen!");
    return;
  }
  
  setLoading(true, 'thumbnail');
  
  try {
    // Create thumbnail from screenshot
    const thumbnailUrl = await createThumbnail(state.screenshotUrl);
    state.thumbnailUrl = thumbnailUrl;
    
    // Replace placeholder with actual thumbnail
    const thumbnailContainer = elements.thumbnailImg;
    thumbnailContainer.innerHTML = `<img src="${thumbnailUrl}" alt="Thumbnail" class="image">`;
    
    // Remove fixed height to let image determine container size
    thumbnailContainer.style.height = 'auto';
    thumbnailContainer.style.minHeight = '0';
    
    console.log('Thumbnail created successfully');
  } catch (error) {
    console.error('Thumbnail creation failed:', error);
    alert('Thumbnail-Erstellung fehlgeschlagen: ' + error.message);
  }
  
  setLoading(false, 'thumbnail');
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
elements.thumbnailBtn.addEventListener('click', handleThumbnail);
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