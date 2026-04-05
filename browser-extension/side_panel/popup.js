/**
 * Sentinel AI Assistant - Unified Popup Controller
 * Integrated with Native Downloader for Markdown Exports
 */

class SentinelPopup {
  constructor() {
    this.setupUI();
    this.setupListeners();
    this.initAudio();
  }

  setupUI() {
    this.chatContainer = document.getElementById('chat-messages');
    this.userInput = document.getElementById('user-input');
    this.sendBtn = document.getElementById('send-btn');
    this.exportBtn = document.getElementById('export-btn'); // New Export Button
    this.statusIndicator = document.getElementById('status-indicator');
  }

  setupListeners() {
    this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    this.userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSendMessage();
    });

    // Integrated Downloader Trigger
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => this.exportCurrentChat());
    }

    // Listen for messages from background/content scripts
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'new_ai_response') {
        this.appendMessage('ai', message.content);
      }
    });
  }

  async handleSendMessage() {
    const text = this.userInput.value.trim();
    if (!text) return;

    this.appendMessage('user', text);
    this.userInput.value = '';

    // Send to background service worker for processing
    chrome.runtime.sendMessage({
      type: 'process_chat',
      content: text
    });
  }

  appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message p-2 my-1 rounded-lg ${
      sender === 'user' ? 'bg-blue-100 ml-4' : 'bg-gray-100 mr-4'
    }`;
    msgDiv.innerText = text;
    this.chatContainer.appendChild(msgDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  /**
   * Native Downloader Logic
   * Exports the current chat history to a Markdown file on Debian 13
   */
  async exportCurrentChat() {
    const messages = Array.from(this.chatContainer.querySelectorAll('.message'))
      .map(m => {
        const role = m.classList.contains('user-message') ? 'USER' : 'AI';
        return `### ${role}\n${m.innerText}\n`;
      })
      .join('\n---\n\n');

    if (!messages.trim()) {
      this.showNotification("Nothing to export yet.");
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const content = `# Sentinel AI - Bias Report & Research\nGenerated: ${new Date().toLocaleString()}\n\n${messages}`;
    const filename = `sentinel_research_${timestamp}.md`;

    // Request the background worker to handle the 'downloads' permission
    chrome.runtime.sendMessage({
      type: 'download_file',
      content: content,
      filename: filename
    }, (response) => {
      if (response?.success) {
        this.showNotification(`File saved: ${filename}`);
      } else {
        console.error("Export failed:", response?.error);
        this.showNotification("Export failed. Check console.");
      }
    });
  }

  showNotification(msg) {
    if (this.statusIndicator) {
      this.statusIndicator.innerText = msg;
      setTimeout(() => { this.statusIndicator.innerText = ''; }, 3000);
    }
  }

  initAudio() {
    // Original Meowstik audio initialization logic goes here
    console.log("Audio systems initialized for voice commands.");
  }
}

// Start the UI
document.addEventListener('DOMContentLoaded', () => {
  window.sentinelUI = new SentinelPopup();
});
