// Configuration for VIBE Material Capture Tool Chrome Extension
const CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: 'https://jpmhwyjiuodsvjowddsm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbWh3eWppdW9kc3Zqb3dkZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYyNjQ0NCwiZXhwIjoyMDY0MjAyNDQ0fQ.U2nrk0Ih7xnPQJ-wtMLS3Tgr0WTNI77LeOFkzhkWwXc',
  
  // Next.js App Configuration
  NEXTJS_APP_URL: 'https://megabrain.cloud',
  NEXTJS_CAPTURE_ROUTE: '/capture',
  
  // Chrome Extension Settings
  EXTENSION_NAME: 'VIBE Material Capture Tool',
  VERSION: '1.0.0',
  
  // UI Settings
  DEFAULT_TIMEOUT: 5000,
  SCREENSHOT_QUALITY: 100,
  
  // Development Settings
  DEBUG_MODE: true,
  LOG_LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else {
  // For browser environment
  window.CONFIG = CONFIG;
} 