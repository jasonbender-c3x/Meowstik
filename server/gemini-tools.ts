/**
 * Gemini Function Calling Tool Declarations
 * 
 * Converts our Zod schemas to Gemini's FunctionDeclaration format
 * for native structured output instead of JSON text parsing
 */
import type { FunctionDeclaration } from "@google/genai";

export const geminiFunctionDeclarations: FunctionDeclaration[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE OUTPUT TOOLS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "send_chat",
    description: "Send final response to the chat window. TERMINATES the agentic loop. Use after gathering all information.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The markdown-formatted response to display in chat"
        }
      },
      required: ["content"]
    }
  },
  {
    name: "say",
    description: "Generate HD voice audio output. Does NOT terminate the loop - use alongside or before send_chat. Required when voice mode is enabled.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        utterance: {
          type: "string",
          description: "Text to speak aloud"
        },
        voice: {
          type: "string",
          enum: ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"],
          description: "Voice to use (default: Kore)"
        }
      },
      required: ["utterance"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "file_get",
    description: "Read file content. Prefix path with 'editor:' for Monaco canvas files.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" }
      },
      required: ["path"]
    }
  },
  {
    name: "file_put",
    description: "Write/create a file. Prefix path with 'editor:' for Monaco canvas.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "File content" },
        mimeType: { type: "string", description: "MIME type (optional)" },
        summary: { type: "string", description: "Change summary (optional)" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "log_append",
    description: "Append content to a named log file in ~/workspace/logs/. Creates the log if it doesn't exist.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Log name (e.g., 'execution', 'thoughts'). Will be saved as {name}.md" },
        content: { type: "string", description: "Content to append to the log" }
      },
      required: ["name", "content"]
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
  // TERMINAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "terminal_execute",
    description: "Execute a shell command on the server with streaming output",
    parametersJsonSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" }
      },
      required: ["command"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SSH - Remote Server Access
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "ssh_key_generate",
    description: "Generate a new SSH key pair. Returns public key (add to server) and instructions for storing private key as Replit secret",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Key pair name (e.g., 'server1')" },
        comment: { type: "string", description: "Key comment (optional)" }
      },
      required: ["name"]
    }
  },
  {
    name: "ssh_key_list",
    description: "List all generated SSH key pairs and their public keys",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "ssh_host_add",
    description: "Add an SSH host profile for remote connections",
    parametersJsonSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Short name for this host (e.g., 'prod-server')" },
        hostname: { type: "string", description: "Server IP or domain" },
        username: { type: "string", description: "SSH username" },
        port: { type: "number", description: "SSH port (default: 22)" },
        keySecretName: { type: "string", description: "Name of the Replit secret containing private key" },
        passwordSecretName: { type: "string", description: "Alternative: name of secret containing password" },
        description: { type: "string", description: "Host description (optional)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for categorization (optional)" }
      },
      required: ["alias", "hostname", "username"]
    }
  },
  {
    name: "ssh_host_list",
    description: "List all configured SSH hosts",
    parametersJsonSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "ssh_host_delete",
    description: "Remove an SSH host profile",
    parametersJsonSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Host alias to delete" }
      },
      required: ["alias"]
    }
  },
  {
    name: "ssh_connect",
    description: "Establish SSH connection to a configured host",
    parametersJsonSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Host alias to connect to" }
      },
      required: ["alias"]
    }
  },
  {
    name: "ssh_disconnect",
    description: "Close SSH connection to a host",
    parametersJsonSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Host alias to disconnect from" }
      },
      required: ["alias"]
    }
  },
  {
    name: "ssh_execute",
    description: "Execute a command on a connected SSH host with streaming output",
    parametersJsonSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Host alias to run command on" },
        command: { type: "string", description: "Shell command to execute" }
      },
      required: ["alias", "command"]
    }
  },
  {
    name: "ssh_status",
    description: "Check SSH connection status for all hosts",
    parametersJsonSchema: {
      type: "object",
      properties: {}
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
  // HTTP CLIENT - Direct HTTP Access
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "http_get",
    description: "Perform a direct HTTP GET request to any URL. Useful for API integrations, fetching raw data, JSON, or files directly from the web.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to request (must start with http:// or https://)" },
        headers: { 
          type: "object", 
          description: "Optional HTTP headers as key-value pairs (e.g., {'Authorization': 'Bearer token', 'Accept': 'application/json'})" 
        },
        params: { 
          type: "object", 
          description: "Optional query parameters as key-value pairs (will be appended to URL)" 
        },
        timeout: { 
          type: "number", 
          description: "Request timeout in milliseconds (default: 30000)" 
        }
      },
      required: ["url"]
    }
  },
  {
    name: "http_post",
    description: "Perform a direct HTTP POST request to any URL. Useful for submitting data to APIs, webhooks, or web services.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to request (must start with http:// or https://)" },
        headers: { 
          type: "object", 
          description: "Optional HTTP headers as key-value pairs (e.g., {'Content-Type': 'application/json', 'Authorization': 'Bearer token'})" 
        },
        body: { 
          type: ["string", "object"],
          description: "Request body - can be a string or an object (objects will be JSON stringified automatically)" 
        },
        timeout: { 
          type: "number", 
          description: "Request timeout in milliseconds (default: 30000)" 
        }
      },
      required: ["url", "body"]
    }
  },
  {
    name: "http_put",
    description: "Perform a direct HTTP PUT request to any URL. Useful for updating resources via RESTful APIs.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to request (must start with http:// or https://)" },
        headers: { 
          type: "object", 
          description: "Optional HTTP headers as key-value pairs (e.g., {'Content-Type': 'application/json', 'Authorization': 'Bearer token'})" 
        },
        body: { 
          type: ["string", "object"],
          description: "Request body - can be a string or an object (objects will be JSON stringified automatically)" 
        },
        timeout: { 
          type: "number", 
          description: "Request timeout in milliseconds (default: 30000)" 
        }
      },
      required: ["url", "body"]
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GITHUB
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "github_repos",
    description: "List repositories for a user",
    parametersJsonSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "GitHub username (optional, defaults to authenticated user)" }
      }
    }
  },
  {
    name: "github_contents",
    description: "List contents of a repository directory",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "Path in repository (optional, defaults to root)" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_file_read",
    description: "Read a file from a GitHub repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path" }
      },
      required: ["owner", "repo", "path"]
    }
  },
  {
    name: "github_code_search",
    description: "Search code in GitHub repositories",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Code search query" },
        owner: { type: "string", description: "Owner to limit search (optional)" },
        repo: { type: "string", description: "Repo to limit search (optional)" }
      },
      required: ["query"]
    }
  },
  {
    name: "github_issues",
    description: "List issues in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "Issue state filter" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_pulls",
    description: "List pull requests in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "PR state filter" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_commits",
    description: "List commits in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        maxResults: { type: "number", description: "Max commits to return" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_issue_create",
    description: "Create a new issue with optional labels, assignees, and milestone",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue body (optional)" },
        labels: { type: "array", items: { type: "string" }, description: "Array of label names to add" },
        assignees: { type: "array", items: { type: "string" }, description: "Array of GitHub usernames to assign" },
        milestone: { type: "number", description: "Milestone number (use github_milestones to list available milestones)" }
      },
      required: ["owner", "repo", "title"]
    }
  },
  {
    name: "github_issue_update",
    description: "Update an existing issue - change title, body, state, labels, assignees, or milestone",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        issueNumber: { type: "number", description: "Issue number to update" },
        title: { type: "string", description: "New issue title" },
        body: { type: "string", description: "New issue body" },
        state: { type: "string", enum: ["open", "closed"], description: "Issue state" },
        labels: { type: "array", items: { type: "string" }, description: "Array of label names (replaces existing labels)" },
        assignees: { type: "array", items: { type: "string" }, description: "Array of GitHub usernames (replaces existing assignees)" },
        milestone: { type: "number", description: "Milestone number (use null to remove milestone)" }
      },
      required: ["owner", "repo", "issueNumber"]
    }
  },
  {
    name: "github_milestones",
    description: "List milestones for a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "Filter by state (default: open)" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_labels",
    description: "List available labels for a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_issue_comment",
    description: "Add a comment to an issue",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        issueNumber: { type: "number", description: "Issue number" },
        body: { type: "string", description: "Comment body" }
      },
      required: ["owner", "repo", "issueNumber", "body"]
    }
  },
  {
    name: "github_branch_create",
    description: "Create a new branch",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        branch: { type: "string", description: "New branch name" },
        sourceBranch: { type: "string", description: "Source branch (default: main)" }
      },
      required: ["owner", "repo", "branch"]
    }
  },
  {
    name: "github_file_create",
    description: "Create or update a file in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: { type: "string", description: "File path" },
        content: { type: "string", description: "File content" },
        message: { type: "string", description: "Commit message" },
        branch: { type: "string", description: "Branch name (optional)" }
      },
      required: ["owner", "repo", "path", "content", "message"]
    }
  },
  {
    name: "github_pr_create",
    description: "Create a pull request",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "PR title" },
        body: { type: "string", description: "PR body (optional)" },
        head: { type: "string", description: "Head branch" },
        base: { type: "string", description: "Base branch" }
      },
      required: ["owner", "repo", "title", "head", "base"]
    }
  },
  {
    name: "github_pr_merge",
    description: "Merge a pull request after approvals",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pullNumber: { type: "number", description: "Pull request number" },
        commitTitle: { type: "string", description: "Custom title for the merge commit" },
        commitMessage: { type: "string", description: "Custom message for the merge commit" },
        mergeMethod: { type: "string", enum: ["merge", "squash", "rebase"], description: "Merge method (default: merge)" }
      },
      required: ["owner", "repo", "pullNumber"]
    }
  },
  {
    name: "github_pr_review_request",
    description: "Request reviews from team members on a pull request",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pullNumber: { type: "number", description: "Pull request number" },
        reviewers: { type: "array", items: { type: "string" }, description: "Array of GitHub usernames to request review from" },
        teamReviewers: { type: "array", items: { type: "string" }, description: "Array of team slugs to request review from" }
      },
      required: ["owner", "repo", "pullNumber", "reviewers"]
    }
  },
  {
    name: "github_repo_create",
    description: "Create a new repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Repository name" },
        description: { type: "string", description: "Repository description" },
        isPrivate: { type: "boolean", description: "Whether the repository is private (default: false)" },
        autoInit: { type: "boolean", description: "Initialize with a README (default: false)" }
      },
      required: ["name"]
    }
  },
  {
    name: "github_repo_fork",
    description: "Fork an existing repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        organization: { type: "string", description: "Organization to fork into (optional, defaults to your account)" },
        name: { type: "string", description: "Custom name for the fork (optional)" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_branch_list",
    description: "List all branches in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" }
      },
      required: ["owner", "repo"]
    }
  },
  {
    name: "github_branch_delete",
    description: "Delete a branch (typically after merge)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        branch: { type: "string", description: "Branch name to delete" }
      },
      required: ["owner", "repo", "branch"]
    }
  },
  {
    name: "github_release_create",
    description: "Create a new release with tag",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        tagName: { type: "string", description: "Tag name for the release (e.g., v1.0.0)" },
        name: { type: "string", description: "Release name/title" },
        body: { type: "string", description: "Release notes/description" },
        draft: { type: "boolean", description: "Create as draft release" },
        prerelease: { type: "boolean", description: "Mark as pre-release" },
        targetCommitish: { type: "string", description: "Commit SHA or branch to tag (defaults to default branch)" }
      },
      required: ["owner", "repo", "tagName"]
    }
  },
  {
    name: "github_actions_trigger",
    description: "Manually trigger a GitHub Actions workflow",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        workflowId: { type: "string", description: "Workflow ID or filename (e.g., 'ci.yml')" },
        ref: { type: "string", description: "Branch or tag to run the workflow on" },
        inputs: { type: "object", description: "Workflow input parameters as key-value pairs" }
      },
      required: ["owner", "repo", "workflowId", "ref"]
    }
  },
  {
    name: "github_workflows_list",
    description: "List all GitHub Actions workflows in a repository",
    parametersJsonSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" }
      },
      required: ["owner", "repo"]
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
  // JOB QUEUE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "queue_create",
    description: "Create a single background job",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Job name" },
        goal: { type: "string", description: "Job goal/description" },
        priority: { type: "number", description: "Priority (0 = highest)" },
        dependencies: { type: "array", items: { type: "string" }, description: "Job IDs this depends on" }
      },
      required: ["name", "goal"]
    }
  },
  {
    name: "queue_batch",
    description: "Create multiple jobs at once",
    parametersJsonSchema: {
      type: "object",
      properties: {
        jobs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              goal: { type: "string" },
              priority: { type: "number" },
              dependencies: { type: "array", items: { type: "string" } }
            },
            required: ["name", "goal"]
          },
          description: "Array of job definitions"
        }
      },
      required: ["jobs"]
    }
  },
  {
    name: "queue_list",
    description: "List jobs in the queue",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "running", "completed", "failed"], description: "Filter by status" },
        limit: { type: "number", description: "Max jobs to return" }
      }
    }
  },
  {
    name: "queue_start",
    description: "Start processing the job queue",
    parametersJsonSchema: {
      type: "object",
      properties: {}
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
          enum: ["left", "right", "middle"], 
          description: "Mouse button to click (default: left)" 
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
          items: { type: "string", enum: ["Control", "Shift", "Alt", "Meta"] },
          description: "Modifier keys to hold while pressing (e.g., ['Control', 'Shift'] for Ctrl+Shift+Key)"
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
          enum: ["up", "down", "left", "right"], 
          description: "Scroll direction" 
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
