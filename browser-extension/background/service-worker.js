/**
 * Sentinel AI - Background Service Worker (Enhanced for Downloads)
 */

class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageListeners();
    this.setupCommandListeners();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'download_file') {
        this.handleDownload(message.content, message.filename, sendResponse);
        return true; 
      }
    });
  }

  setupCommandListeners() {
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'export-canvas') {
        // Triggers a request to the active tab to grab content
        this.requestExportFromActiveTab();
      }
    });
  }

  async handleDownload(content, filename, sendResponse) {
    try {
      // Create a data URL for the content
      const base64Content = btoa(unescape(encodeURIComponent(content)));
      const dataUrl = `data:text/markdown;base64,${base64Content}`;

      chrome.downloads.download({
        url: dataUrl,
        filename: filename || 'sentinel_export.md',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, id: downloadId });
        }
      });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async requestExportFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'trigger_canvas_export' });
    }
  }
}

new BackgroundService();
