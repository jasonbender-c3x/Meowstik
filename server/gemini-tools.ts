
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
 * - ssh: Persistent 2-way connection
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
    description: "Send markdown content to the chat window. NON-TERMINATING",
    parametersJsonSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Markdown content to display" }
      },
      required: ["content"]
    }
  },
  {
    name: "end_turn",
    description: "Terminate your turn in the interactive agentic loop and return control to the user. This is the ONLY way to end your turn - call this when you have completed your response.",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "append",
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
  {
    name: "say",
    description: "Generate HD voice audio output. NON-BLOCKING and NON-TERMINATING - speech generation happens concurrently with other operations. Use alongside or before send_chat or write. Must call end_turn to finish your turn.",
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
  {
    name: "soundboard",
    description: "Play a synthesized sound effect in the user's browser. NON-BLOCKING. Use for comedic timing, notifications, alarms, or ambiance. Examples: womp_womp (failure/bad news), rimshot (punchline), fart (comedy), airhorn (hype), success (win), alarm_clock (wake up), pill_reminder (medication), crickets (awkward silence), ding (notification), level_up (achievement).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        sound: {
          type: "string",
          description: "Sound effect ID. Common sounds: womp_womp, rimshot, fart, fart_long, airhorn, crickets, price_is_wrong, laugh_track, jingle, news_intro, alarm_clock, gentle_wake, pill_reminder, urgent_alarm, ding, success, error_buzz, level_up, incoming, traffic_alert, weather_beep"
        },
        volume: {
          type: "number",
          description: "Playback volume 0.0–1.0 (default: 0.8)"
        }
      },
      required: ["sound"]
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
  // WEB SEARCH
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "web_search",
    description: "Search the web for information (using Google or Exa)",
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
    name: "exa_search",
    description: "Search the web using Exa (neural search engine)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results to return (default: 10)" },
        useAutoprompt: { type: "boolean", description: "Whether to use autoprompt (default: true)" },
        type: { type: "string", enum: ["neural", "keyword"], description: "Search type (default: neural)" }
      },
      required: ["query"]
    }
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // BROWSER AUTOMATION (PUPPETEER)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "puppeteer_navigate",
    description: "Navigate to a URL in the browser",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
        timeout: { type: "number", description: "Navigation timeout in ms (default: 30000)" }
      },
      required: ["url"]
    }
  },
  {
    name: "puppeteer_click",
    description: "Click an element on the current page",
    parametersJsonSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click" },
        timeout: { type: "number", description: "Wait timeout in ms (default: 5000)" }
      },
      required: ["selector"]
    }
  },
  {
    name: "puppeteer_type",
    description: "Type text into an input field",
    parametersJsonSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input field" },
        text: { type: "string", description: "Text to type" },
        delay: { type: "number", description: "Delay between keystrokes in ms (default: 0)" }
      },
      required: ["selector", "text"]
    }
  },
  {
    name: "puppeteer_screenshot",
    description: "Take a screenshot of the current page",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fullPage: { type: "boolean", description: "Capture full scrollable page (default: false)" }
      }
    }
  },
  {
    name: "puppeteer_evaluate",
    description: "Execute JavaScript in the page context",
    parametersJsonSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript code to execute" }
      },
      required: ["script"]
    }
  },
  {
    name: "puppeteer_content",
    description: "Get the content of the current page",
    parametersJsonSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["html", "text"], description: "Output format (default: html)" }
      }
    }
  },
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
    description: `Place a phone call on Jason's behalf using Meowstik as the voice AI on the call.

WHEN TO USE: Any time Jason asks you to call someone ("call my mother", "get John on the line", "call Dr. Smith and ask about my appointment").

HOW IT WORKS:
- Provide contact_name OR to (phone number). If you give contact_name, the number is looked up in Google Contacts automatically.
- Provide a detailed objective describing the FULL MISSION for the call — what to say, what to ask, what information to get back.
- Meowstik will call the person, handle the ENTIRE conversation including small talk, complete the mission, and TEXT JASON THE RESULT when done.
- You do NOT need to stay on the call. Meowstik handles it.

OBJECTIVE TIPS:
- Be thorough. Include: what to say, what to ask, what info to collect, any context the AI needs.
- Example: "Call mom. Tell her we're planning to visit Sunday. Ask her what time works best and what we should bring. Make small talk if she wants to chat. When done, text Jason: the time she said and what to bring."`,
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: {
          type: "string",
          description: "Name of the person to call as they appear in contacts (e.g., 'mom', 'John Smith', 'Dr. Wilson'). Used to auto-look up their number. Leave blank if providing 'to' directly."
        },
        to: {
          type: "string",
          description: "Phone number in E.164 format (e.g., +15551234567). Optional if contact_name is provided."
        },
        objective: {
          type: "string",
          description: "Complete mission for the call. Describe: what to say, what to ask, what info to collect, how to handle small talk, and what to report back to Jason when done. Be thorough — this drives the entire conversation."
        },
        message: {
          type: "string",
          description: "One-way TTS message to speak and hang up (optional, for simple announcements only)"
        }
      }
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
  // HARDWARE CONTROL (STUBS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "set_mood_light",
    description: "Set the color/status of the HP Mood Lighting device (USB ID 03f0:150c). Currently a stub.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        color: { type: "string", description: "Color name (red, green, blue, off) or hex code" },
        status: { type: "string", enum: ["on", "off", "blink"], description: "Light status" }
      }
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTER USE (PROJECT GHOST)
  // Hands-free desktop control via Gemini Computer Use API
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
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TODO LIST MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "todo_list",
    description: "Get all active to-do items from the persistent list.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        includeCompleted: { type: "boolean", description: "Whether to include completed items" }
      }
    }
  },
  {
    name: "todo_add",
    description: "Add a new item to the persistent to-do list.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the task" },
        description: { type: "string", description: "Detailed description (optional)" },
        priority: { type: "number", description: "Priority level (0-10, 10 is highest)" },
        category: { type: "string", description: "Category (e.g., bug, feature, research)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization" }
      },
      required: ["title"]
    }
  },
  {
    name: "todo_update",
    description: "Update an existing to-do item.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the todo item" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked", "cancelled"], description: "New status" },
        priority: { type: "number", description: "New priority" }
      },
      required: ["id"]
    }
  },
  {
    name: "todo_complete",
    description: "Mark a to-do item as completed.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the todo item" }
      },
      required: ["id"]
    }
  },
  {
    name: "todo_remove",
    description: "Permanently remove a to-do item.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the todo item" }
      },
      required: ["id"]
    }
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // CHROMECAST
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "cast",
    description: "Control Chromecast and Google Nest devices via the catt CLI. Actions: cast (play a URL), stop, volume, status, pause, resume, scan (list devices). Default device is 'Living Room TV'. Known devices: 'Living Room TV' (192.168.0.14), 'Kitchen display' (192.168.0.31).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["cast", "stop", "volume", "status", "pause", "resume", "scan"],
          description: "Action to perform on the Chromecast device"
        },
        url: {
          type: "string",
          description: "Media URL to cast (required for cast action)"
        },
        device: {
          type: "string",
          description: "Device name (default: 'Living Room TV'). Known: 'Living Room TV', 'Kitchen display'"
        },
        level: {
          type: "number",
          description: "Volume level 0-100 (required for volume action)"
        }
      },
      required: ["action"]
    }
  },
  {
    name: "camera",
    description: "Control the PTZ IP camera at 192.168.0.5 (HI3510). Actions: snapshot (get current image URL), ptz (pan/tilt/zoom), stop (stop movement). The camera supports 8 directions + zoom. Credentials: admin / no password.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["snapshot", "ptz", "stop"],
          description: "Action: snapshot=get image, ptz=move camera, stop=halt movement"
        },
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right", "leftup", "rightup", "leftdown", "rightdown", "zoomin", "zoomout"],
          description: "PTZ direction (required for ptz action)"
        },
        speed: {
          type: "number",
          description: "PTZ speed 1-10 (default 5)"
        },
        duration: {
          type: "number",
          description: "How long to move in milliseconds (default 500). Camera auto-stops after this."
        }
      },
      required: ["action"]
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



