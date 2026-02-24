/**
 * Gemini Function Calling Tool Declarations
 * 
 * Converts our Zod schemas to Gemini's FunctionDeclaration format
 * for native structured output instead of JSON text parsing
 * 
 * V2 CORE PRIMITIVES (7 foundational tools):
 * - terminal: Non-interactive shell command execution
 * - get: Read file or URL content
 * - put: Write file content
 * - write: Output to chat window
 * - log: Append to named log file
 * - say: HD voice output
 * - ssh: Persistent 2-way connection (TODO)
 * 
 * Legacy aliases maintained for backward compatibility.
 */
import type { FunctionDeclaration } from "@google/genai";

export const geminiFunctionDeclarations: FunctionDeclaration[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // V2 CORE PRIMITIVES (7 foundational tools)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "terminal",
    description: "Execute a shell command. NON-TERMINATING. Returns stdout/stderr. For interactive sessions, use ssh instead.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" }
      },
      required: ["command"]
    }
  },
  {
    name: "get",
    description: "Read file or URL content. Prefix path with 'editor:' for Monaco canvas, 'client:' for remote desktop. Returns full content by default.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path or URL to read" },
        maxLength: { type: "number", description: "Optional max content length in characters" }
      },
      required: ["path"]
    }
  },
  {
    name: "put",
    description: "Write content to a file. Prefix path with 'editor:' for Monaco canvas, 'client:' for remote desktop.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "File content" },
        mimeType: { type: "string", description: "MIME type (optional)" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "write",
    description: "Send markdown content to the chat window. NON-TERMINATING - call end_turn when finished.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Markdown content to display" }
      },
      required: ["content"]
    }
  },
  {
    name: "send_chat",
    description: "ALIAS for write. Send markdown content to the chat window. NON-TERMINATING.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Markdown content to display" }
      },
      required: ["content"]
    }
  },
  {
    name: "log",
    description: "Append content to a named log file in ~/workspace/logs/{name}.md",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Log name (e.g., 'execution', 'thoughts')" },
        content: { type: "string", description: "Content to append" }
      },
      required: ["name", "content"]
    }
  },
  // say is already defined below with correct name
  // ssh: TODO - implement persistent WebSocket connection

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY ALIASES (backward compatibility - route to core primitives)
  // Note: send_chat removed - use write instead
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "end_turn",
    description: "Terminate your turn in the interactive agentic loop and return control to the user. This is the ONLY way to end your turn - call this when you have completed your response.",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "say",
    description: "Generate HD voice audio output. NON-BLOCKING and NON-TERMINATING - speech generation happens concurrently with other operations. Use alongside or before send_chat. Must call end_turn to finish your turn.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        utterance: {
          type: "string",
          description: "Text to speak aloud"
        },
        voice: {
          type: "string",
          description: "Voice to use: Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, or Zephyr (default: Kore)"
        }
      },
      required: ["utterance"]
    }
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // GMAIL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "gmail_list",
    description: "List recent emails from inbox",
    parametersJsonSchema: {
      type: "object",
      properties: {
        maxResults: { type: "number", description: "Max emails to return (default: 10)" },
        labelIds: { type: "array", items: { type: "string" }, description: "Label IDs to filter" }
      }
    }
  },
  {
    name: "gmail_read",
    description: "Read a specific email by ID",
    parametersJsonSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Email message ID" }
      },
      required: ["messageId"]
    }
  },
  {
    name: "gmail_search",
    description: "Search emails with Gmail query syntax",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query (e.g., 'from:nick subject:meeting')" },
        maxResults: { type: "number", description: "Max results (default: 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "gmail_send",
    description: "Send an email",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body (plain text or HTML)" },
        cc: { type: "string", description: "CC recipient (optional)" },
        bcc: { type: "string", description: "BCC recipient (optional)" }
      },
      required: ["to", "subject", "body"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DRIVE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "drive_list",
    description: "List files in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "Folder ID to list (optional, defaults to root)" },
        maxResults: { type: "number", description: "Max files to return" }
      }
    }
  },
  {
    name: "drive_read",
    description: "Read a file's content from Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to read" }
      },
      required: ["fileId"]
    }
  },
  {
    name: "drive_search",
    description: "Search files in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results" }
      },
      required: ["query"]
    }
  },
  {
    name: "drive_create",
    description: "Create a new file in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name" },
        content: { type: "string", description: "File content" },
        mimeType: { type: "string", description: "MIME type (optional)" },
        folderId: { type: "string", description: "Parent folder ID (optional)" }
      },
      required: ["name", "content"]
    }
  },
  {
    name: "drive_update",
    description: "Update an existing file in Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to update" },
        content: { type: "string", description: "New content" }
      },
      required: ["fileId", "content"]
    }
  },
  {
    name: "drive_delete",
    description: "Delete a file from Google Drive",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to delete" }
      },
      required: ["fileId"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CALENDAR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "calendar_list",
    description: "List available calendars",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "calendar_events",
    description: "Get calendar events",
    parametersJsonSchema: {
      type: "object",
      properties: {
        calendarId: { type: "string", description: "Calendar ID (default: primary)" },
        maxResults: { type: "number", description: "Max events to return" },
        timeMin: { type: "string", description: "Start time filter (ISO datetime)" },
        timeMax: { type: "string", description: "End time filter (ISO datetime)" }
      }
    }
  },
  {
    name: "calendar_create",
    description: "Create a calendar event",
    parametersJsonSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Event title" },
        start: { type: "string", description: "Start datetime (ISO format)" },
        end: { type: "string", description: "End datetime (ISO format)" },
        description: { type: "string", description: "Event description" },
        location: { type: "string", description: "Event location" }
      },
      required: ["summary", "start", "end"]
    }
  },
  {
    name: "calendar_update",
    description: "Update a calendar event",
    parametersJsonSchema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "Event ID to update" },
        summary: { type: "string", description: "New title" },
        start: { type: "string", description: "New start time" },
        end: { type: "string", description: "New end time" },
        description: { type: "string", description: "New description" }
      },
      required: ["eventId"]
    }
  },
  {
    name: "calendar_delete",
    description: "Delete a calendar event",
    parametersJsonSchema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "Event ID to delete" },
        calendarId: { type: "string", description: "Calendar ID (default: primary)" }
      },
      required: ["eventId"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DOCS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "docs_read",
    description: "Read a Google Doc's content",
    parametersJsonSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" }
      },
      required: ["documentId"]
    }
  },
  {
    name: "docs_create",
    description: "Create a new Google Doc",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        content: { type: "string", description: "Initial content (optional)" }
      },
      required: ["title"]
    }
  },
  {
    name: "docs_append",
    description: "Append content to a Google Doc",
    parametersJsonSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        content: { type: "string", description: "Content to append" }
      },
      required: ["documentId", "content"]
    }
  },
  {
    name: "docs_replace",
    description: "Find and replace text in a Google Doc",
    parametersJsonSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        find: { type: "string", description: "Text to find" },
        replace: { type: "string", description: "Replacement text" }
      },
      required: ["documentId", "find", "replace"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE SHEETS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "sheets_read",
    description: "Read data from a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to read (e.g., 'Sheet1!A1:D10')" }
      },
      required: ["spreadsheetId", "range"]
    }
  },
  {
    name: "sheets_write",
    description: "Write data to a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to write" },
        values: { type: "array", items: { type: "array" }, description: "2D array of values" }
      },
      required: ["spreadsheetId", "range", "values"]
    }
  },
  {
    name: "sheets_append",
    description: "Append rows to a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to append to" },
        values: { type: "array", items: { type: "array" }, description: "2D array of values" }
      },
      required: ["spreadsheetId", "range", "values"]
    }
  },
  {
    name: "sheets_create",
    description: "Create a new Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Spreadsheet title" }
      },
      required: ["title"]
    }
  },
  {
    name: "sheets_clear",
    description: "Clear a range in a Google Sheet",
    parametersJsonSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to clear" }
      },
      required: ["spreadsheetId", "range"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE TASKS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "tasks_list",
    description: "List tasks from a task list",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskListId: { type: "string", description: "Task list ID (optional)" },
        maxResults: { type: "number", description: "Max tasks to return" }
      }
    }
  },
  {
    name: "tasks_create",
    description: "Create a new task",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        notes: { type: "string", description: "Task notes/description" },
        due: { type: "string", description: "Due date (ISO format)" },
        taskListId: { type: "string", description: "Task list ID (optional)" }
      },
      required: ["title"]
    }
  },
  {
    name: "tasks_update",
    description: "Update an existing task",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        title: { type: "string", description: "New title" },
        notes: { type: "string", description: "New notes" },
        due: { type: "string", description: "New due date" }
      },
      required: ["taskId"]
    }
  },
  {
    name: "tasks_complete",
    description: "Mark a task as complete",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        taskListId: { type: "string", description: "Task list ID (optional)" }
      },
      required: ["taskId"]
    }
  },
  {
    name: "tasks_delete",
    description: "Delete a task",
    parametersJsonSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        taskListId: { type: "string", description: "Task list ID (optional)" }
      },
      required: ["taskId"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CONTACTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "contacts_list",
    description: "List contacts from Google Contacts",
    parametersJsonSchema: {
      type: "object",
      properties: {
        pageSize: { type: "number", description: "Number of contacts per page" },
        pageToken: { type: "string", description: "Page token for pagination" }
      }
    }
  },
  {
    name: "contacts_search",
    description: "Search contacts by name, email, or phone",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        pageSize: { type: "number", description: "Max results" }
      },
      required: ["query"]
    }
  },
  {
    name: "contacts_create",
    description: "Create a new contact",
    parametersJsonSchema: {
      type: "object",
      properties: {
        givenName: { type: "string", description: "First name" },
        familyName: { type: "string", description: "Last name (optional)" },
        email: { type: "string", description: "Email address (optional)" },
        phoneNumber: { type: "string", description: "Phone number (optional)" }
      },
      required: ["givenName"]
    }
  },
  {
    name: "contacts_update",
    description: "Update an existing contact",
    parametersJsonSchema: {
      type: "object",
      properties: {
        resourceName: { type: "string", description: "Contact resource name" },
        givenName: { type: "string", description: "New first name" },
        email: { type: "string", description: "New email" },
        phoneNumber: { type: "string", description: "New phone number" }
      },
      required: ["resourceName"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 CORE PRIMITIVE: SSH
  // Unified SSH primitive that replaces 9 individual ssh_* tools
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "ssh",
    description: "[V2 CORE PRIMITIVE] Persistent 2-way SSH connection. " +
      "Actions: 'connect' (establish connection), 'exec' (run command), 'disconnect' (close), 'status' (list active). " +
      "If connected, just provide host and command to execute. Auto-connects if not connected. " +
      "Example: ssh({ host: 'myserver', command: 'ls -la' })",
    parametersJsonSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Host alias (configured via ssh_host_add)" },
        command: { type: "string", description: "Command to execute (for 'exec' action)" },
        action: { 
          type: "string", 
          enum: ["connect", "exec", "disconnect", "status"],
          description: "Action to perform (default: 'exec' if command provided, 'status' otherwise)" 
        }
      },
      required: []
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "web_search",
    description: "Search the web for information",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results (default: 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "browser_scrape",
    description: "Scrape content from a webpage using Playwright",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to scrape" },
        selector: { type: "string", description: "CSS selector for content (optional)" }
      },
      required: ["url"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP METHODS (for API calls including GitHub API)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "http_get",
    description: "Make an HTTP GET request to any URL with custom headers. Use for fetching API data with authentication.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to GET" },
        headers: { type: "object", description: "Optional HTTP headers as key-value pairs (e.g., Authorization)" }
      },
      required: ["url"]
    }
  },
  {
    name: "http_post",
    description: "Make an HTTP POST request to any URL. Use for creating resources, submitting data, or calling APIs.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to POST to" },
        body: { type: "object", description: "JSON body to send" },
        headers: { type: "object", description: "Optional HTTP headers as key-value pairs" }
      },
      required: ["url"]
    }
  },
  {
    name: "http_put",
    description: "Make an HTTP PUT request to any URL. Use for full resource replacement/updates.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to PUT" },
        body: { type: "object", description: "JSON body with full resource data" },
        headers: { type: "object", description: "Optional HTTP headers as key-value pairs" }
      },
      required: ["url"]
    }
  },
  {
    name: "http_patch",
    description: "Make an HTTP PATCH request to any URL. Use for partial updates to resources.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to PATCH" },
        body: { type: "object", description: "JSON body with fields to update" },
        headers: { type: "object", description: "Optional HTTP headers as key-value pairs" }
      },
      required: ["url"]
    }
  },
  {
    name: "http_delete",
    description: "Make an HTTP DELETE request to any URL. Use for removing resources.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to DELETE" },
        headers: { type: "object", description: "Optional HTTP headers as key-value pairs" }
      },
      required: ["url"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TWILIO SMS/VOICE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "sms_send",
    description: "Send an SMS message via Twilio",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number (E.164 format, e.g., +15551234567)" },
        body: { type: "string", description: "Message content" }
      },
      required: ["to", "body"]
    }
  },
  {
    name: "sms_list",
    description: "List recent SMS messages",
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max messages to return (default: 20)" }
      }
    }
  },
  {
    name: "call_make",
    description: "Make a phone call via Twilio",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number (E.164 format)" },
        message: { type: "string", description: "Message to speak on the call (optional)" },
        twimlUrl: { type: "string", description: "Custom TwiML URL (optional)" }
      },
      required: ["to"]
    }
  },
  {
    name: "call_list",
    description: "List recent phone calls",
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max calls to return (default: 20)" }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARDUINO / HARDWARE IoT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "arduino_list_boards",
    description: "List all connected Arduino boards. Detects USB-connected boards and shows port, board name, and FQBN.",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "arduino_compile",
    description: "Compile an Arduino sketch (.ino file) for a specific board.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sketchPath: { type: "string", description: "Path to the .ino file or sketch directory" },
        fqbn: { type: "string", description: "Fully Qualified Board Name (e.g., 'arduino:avr:uno', 'arduino:avr:mega')" }
      },
      required: ["sketchPath", "fqbn"]
    }
  },
  {
    name: "arduino_upload",
    description: "Upload a compiled sketch to a connected Arduino board.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sketchPath: { type: "string", description: "Path to the .ino file or sketch directory" },
        fqbn: { type: "string", description: "Fully Qualified Board Name (e.g., 'arduino:avr:uno')" },
        port: { type: "string", description: "Serial port (e.g., '/dev/ttyUSB0', 'COM3')" }
      },
      required: ["sketchPath", "fqbn", "port"]
    }
  },
  {
    name: "arduino_create_sketch",
    description: "Create a new Arduino sketch with the given code.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the sketch (will create directory and .ino file)" },
        code: { type: "string", description: "Arduino C++ code for the sketch" }
      },
      required: ["name", "code"]
    }
  },
  {
    name: "arduino_install_library",
    description: "Install an Arduino library by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        libraryName: { type: "string", description: "Name of the library to install (e.g., 'Servo', 'FastLED')" }
      },
      required: ["libraryName"]
    }
  },
  {
    name: "arduino_search_libraries",
    description: "Search for Arduino libraries by keyword.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for library name or keyword" }
      },
      required: ["query"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BROWSERBASE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "browserbase_load",
    description: "Load a URL in a Browserbase headless browser session",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to load" }
      },
      required: ["url"]
    }
  },
  {
    name: "browserbase_screenshot",
    description: "Take a screenshot of the current Browserbase session",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Browserbase session ID" }
      },
      required: ["sessionId"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTER USE (PROJECT GHOST)
  // Hands-free desktop control via Gemini Computer Use API
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "computer_click",
    description: "Click at a specific coordinate on the user's desktop screen. Use after analyzing a screenshot to find element positions.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate in pixels from the left edge" },
        y: { type: "number", description: "Y coordinate in pixels from the top edge" },
        button: { 
          type: "string", 
          description: "Mouse button: left, right, or middle (default: left)" 
        }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "computer_type",
    description: "Type text at the current cursor position or into a focused input field on the desktop.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type" }
      },
      required: ["text"]
    }
  },
  {
    name: "computer_key",
    description: "Press a keyboard key (Enter, Tab, Escape, Arrow keys, etc.) with optional modifiers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        key: { 
          type: "string", 
          description: "Key name: Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, PageUp, PageDown, etc." 
        },
        modifiers: { 
          type: "array", 
          items: { type: "string" },
          description: "Modifier keys: Control, Shift, Alt, Meta (e.g., ['Control', 'Shift'] for Ctrl+Shift+Key)"
        }
      },
      required: ["key"]
    }
  },
  {
    name: "computer_scroll",
    description: "Scroll the active window in a direction.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        direction: { 
          type: "string", 
          description: "Scroll direction: up, down, left, or right" 
        },
        amount: { 
          type: "number", 
          description: "Amount to scroll in pixels (default: 300)" 
        }
      },
      required: ["direction"]
    }
  },
  {
    name: "computer_move",
    description: "Move the mouse cursor to a position without clicking. Useful for hovering to reveal tooltips or menus.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "X coordinate in pixels" },
        y: { type: "number", description: "Y coordinate in pixels" }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "computer_screenshot",
    description: "Take a screenshot of the current desktop state. Use this to see the current screen before taking action.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fullScreen: { 
          type: "boolean", 
          description: "Capture full screen or active window only (default: true)" 
        }
      }
    }
  },
  {
    name: "computer_wait",
    description: "Wait for a specified duration before the next action. Useful when waiting for page loads or animations.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        delay: { 
          type: "number", 
          description: "Time to wait in milliseconds (1000ms = 1 second)" 
        }
      },
      required: ["delay"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "db_tables",
    description: "List all database tables with their column schemas. Use this to understand the database structure before querying.",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "db_query",
    description: "Execute a read-only SQL SELECT query against the database. Only SELECT queries are allowed for safety. Use db_tables first to understand the schema.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "SQL SELECT query to execute. Must start with SELECT. Example: SELECT * FROM messages WHERE role = 'user' LIMIT 10" 
        },
        limit: {
          type: "number",
          description: "Maximum rows to return (default: 100, max: 1000)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "db_insert",
    description: "Insert a new row into a database table. Use db_tables first to see available tables and their columns.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        table: { 
          type: "string", 
          description: "Name of the table to insert into (e.g., 'messages', 'chats')" 
        },
        data: {
          type: "object",
          description: "Object with column names as keys and values to insert. Example: {\"role\": \"user\", \"content\": \"Hello\"}"
        }
      },
      required: ["table", "data"]
    }
  },
  {
    name: "db_delete",
    description: "Delete rows from a database table. Requires a WHERE condition to prevent accidental mass deletion.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        table: { 
          type: "string", 
          description: "Name of the table to delete from" 
        },
        where: {
          type: "object",
          description: "Condition for deletion as column-value pairs. Example: {\"id\": 123} or {\"chatId\": \"abc\", \"role\": \"user\"}"
        },
        limit: {
          type: "number",
          description: "Maximum rows to delete (default: 1, max: 100 for safety)"
        }
      },
      required: ["table", "where"]
    }
  }
];

/**
 * Get tool declarations for a specific set of tools
 * Useful for limiting which tools are available in certain contexts
 */
export function getToolDeclarations(toolNames?: string[]): FunctionDeclaration[] {
  if (!toolNames) {
    return geminiFunctionDeclarations;
  }
  return geminiFunctionDeclarations.filter(tool => tool.name && toolNames.includes(tool.name));
}

/**
 * Get tool names as a string array for toolConfig.allowedFunctionNames
 */
export function getAllToolNames(): string[] {
  return geminiFunctionDeclarations.map(tool => tool.name).filter((name): name is string => !!name);
}
