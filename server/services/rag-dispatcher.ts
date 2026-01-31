/**
 * =============================================================================
 * NEBULA CHAT - RAG DISPATCHER SERVICE
 * =============================================================================
 * 
 * Handles the dispatch and execution of structured LLM outputs.
 * 
 * RESPONSIBILITIES:
 * -----------------
 * 1. Parse structured LLM responses into actionable operations
 * 2. Execute tool calls (API calls, file operations, searches)
 * 3. Process file creation/modification requests
 * 4. Handle autoexec script execution with security guardrails
 * 5. Format outputs using the defined delimiter system
 * 
 * EXECUTION FLOW:
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │                        RAG DISPATCHER                                 │
 * │                                                                        │
 * │  Structured LLM Response                                               │
 * │          │                                                             │
 * │          ▼                                                             │
 * │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────────┐│
 * │  │ Validate Schema │───▶│ Execute Tools   │───▶│ Process File Ops  ││
 * │  └─────────────────┘    └─────────────────┘    └────────────────────┘│
 * │          │                      │                       │             │
 * │          ▼                      ▼                       ▼             │
 * │  ┌─────────────────────────────────────────────────────────────────┐ │
 * │  │ Log Execution Results & Return Chat Content                     │ │
 * │  └─────────────────────────────────────────────────────────────────┘ │
 * └───────────────────────────────────────────────────────────────────────┘
 * =============================================================================
 */

import { storage } from "../storage";
import { 
  structuredLLMResponseSchema,
  type StructuredLLMResponse,
  type ToolCall,
  type FileOperation,
  type BinaryFileOperation,
  type AutoexecScript,
  webSearchParamsSchema,
  googleSearchParamsSchema,
  duckduckgoSearchParamsSchema,
  browserScrapeParamsSchema,
  httpGetParamsSchema,
  httpPostParamsSchema,
  httpPutParamsSchema
} from "@shared/schema";
import { webSearch, formatSearchResult } from "../integrations/web-search";
import { searchWeb } from "../integrations/web-scraper";
import { browserScrape } from "../integrations/browser-scraper";
import { httpGet, httpPost, httpPut, type HttpResponse } from "../integrations/http-client";
import { tavilySearch, tavilyQnA, tavilyDeepResearch } from "../integrations/tavily";
import { perplexitySearch, perplexityQuickAnswer, perplexityDeepResearch, perplexityNews } from "../integrations/perplexity";
import * as googleTasks from "../integrations/google-tasks";
import * as gmail from "../integrations/gmail";
import * as googleCalendar from "../integrations/google-calendar";
import * as googleDrive from "../integrations/google-drive";
import * as googleDocs from "../integrations/google-docs";
import * as googleSheets from "../integrations/google-sheets";
import * as googleContacts from "../integrations/google-contacts";
import * as github from "../integrations/github";
import * as browserbase from "../integrations/browserbase";
import * as twilio from "../integrations/twilio";
import * as sshService from "./ssh-service";
import * as arduino from "../integrations/arduino";
import * as adb from "../integrations/adb";
import * as fileQueue from "./file-queue";
import * as petoi from "../integrations/petoi";
import * as printer3d from "../integrations/printer3d";
import * as kicad from "../integrations/kicad";
import { ragService } from "./rag-service";
import { chunkingService } from "./chunking-service";
import { clientRouter } from "./client-router";
import type { CodeEntity } from "./codebase-analyzer";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { z } from "zod";

/**
 * Expand tilde (~) in paths to the user's home directory
 * Handles both ~ and ~/path patterns on Unix and Windows
 * 
 * Edge cases:
 * - Empty string, null, or undefined: returned as-is
 * - '~' alone: expands to home directory
 * - '~/path' or '~\\path': expands to home directory + path
 * - Tilde in middle of path: not expanded (e.g., '/some/~/path' unchanged)
 * 
 * @param filePath - The path that may contain a tilde
 * @returns The path with tilde expanded to home directory
 * 
 * @example
 * expandTilde('~') // '/home/user'
 * expandTilde('~/documents') // '/home/user/documents'
 * expandTilde('/absolute/path') // '/absolute/path' (unchanged)
 */
export function expandTilde(filePath: string): string {
  if (!filePath) return filePath;
  
  // Handle ~ at the start of the path
  if (filePath === '~') {
    return os.homedir();
  }
  
  // Handle ~/path or ~\path (Unix and Windows)
  if (filePath.startsWith('~/') || filePath.startsWith('~' + path.sep)) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  
  // No tilde expansion needed
  return filePath;
}

/**
 * Path Prefix Routing System
 * 
 * Unified prefix system for file and terminal operations:
 * 
 * FILE PATHS (file_get, file_put):
 * - server:path or just path → Server filesystem (default)
 * - client:path → Client machine via connected desktop-app
 * - editor:path → Monaco editor canvas
 * 
 * TERMINAL COMMANDS (terminal_execute):
 * - server:command or just command → Server (default)
 * - client:command → Client machine via connected desktop-app
 * 
 * EDITOR OPERATIONS (editor_load):
 * - editor:server:path or editor:path → Load file from server into Monaco editor (default)
 * - editor:client:path → Load file from client into Monaco editor
 * 
 * TILDE EXPANSION:
 * - ~ expands to user's home directory
 * - ~/path expands to home directory + path
 * - Works with all prefixes (e.g., client:~/file.txt)
 */

type PathTarget = 'server' | 'client' | 'editor';

interface ParsedPath {
  target: PathTarget;
  path: string;
  editorSubTarget?: 'server' | 'client'; // For editor:server: or editor:client:
}

/**
 * Parse a path with prefix routing
 * Returns the target (server/client/editor) and the clean path
 * 
 * Handles tilde expansion before prefix parsing
 * Throws error for invalid prefixes (e.g., client: with no path)
 */
function parsePathPrefix(rawPath: string, defaultTarget: PathTarget = 'server'): ParsedPath {
  if (!rawPath) return { target: defaultTarget, path: '' };
  
  // Handle editor: prefix with possible sub-target
  if (rawPath.startsWith('editor:')) {
    const afterEditor = rawPath.substring('editor:'.length);
    
    if (afterEditor.startsWith('client:')) {
      const clientPath = afterEditor.substring('client:'.length);
      if (!clientPath || clientPath.trim() === '') {
        throw new Error('editor:client: requires a path (e.g., editor:client:/home/user/file.txt)');
      }
      return { 
        target: 'editor', 
        path: expandTilde(clientPath),
        editorSubTarget: 'client'
      };
    }
    if (afterEditor.startsWith('server:')) {
      const serverPath = afterEditor.substring('server:'.length);
      if (!serverPath || serverPath.trim() === '') {
        throw new Error('editor:server: requires a path (e.g., editor:server:src/index.ts)');
      }
      return { 
        target: 'editor', 
        path: expandTilde(serverPath),
        editorSubTarget: 'server'
      };
    }
    // editor: without sub-target - path is filename for editor canvas
    // This is for writing directly to editor, no source file needed
    if (!afterEditor || afterEditor.trim() === '') {
      throw new Error('editor: requires a filename (e.g., editor:app.tsx)');
    }
    return { target: 'editor', path: expandTilde(afterEditor), editorSubTarget: undefined };
  }
  
  // Handle client: prefix
  if (rawPath.startsWith('client:')) {
    const clientPath = rawPath.substring('client:'.length);
    if (!clientPath || clientPath.trim() === '') {
      throw new Error('client: requires a path (e.g., client:/home/user/file.txt)');
    }
    return { target: 'client', path: expandTilde(clientPath) };
  }
  
  // Handle explicit server: prefix
  if (rawPath.startsWith('server:')) {
    const serverPath = rawPath.substring('server:'.length);
    if (!serverPath || serverPath.trim() === '') {
      throw new Error('server: requires a path (e.g., server:package.json)');
    }
    return { target: 'server', path: expandTilde(serverPath) };
  }
  
  // No prefix = default target (also expand tilde)
  return { target: defaultTarget, path: expandTilde(rawPath) };
}

/**
 * Zod schemas for tool call parameter validation
 * Ensures type safety when executing tool calls
 */
const apiCallParamsSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).default("GET"),
  headers: z.record(z.string()).optional().default({}),
  body: z.unknown().optional()
});

const searchParamsSchema = z.object({
  query: z.string(),
  scope: z.string().optional()
});

const execAsync = promisify(exec);

const AUTOEXEC_DISABLED = false;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for created files

/**
 * Result of autoexec script execution
 */
export interface AutoexecExecutionResult {
  command: string;
  output: string;
  exitCode: number;
  success: boolean;
  duration: number;
}

/**
 * Result of dispatching a structured response
 */
export interface DispatchResult {
  success: boolean;
  chatContent?: string;
  filesCreated: string[];
  filesModified: string[];
  toolResults: ToolExecutionResult[];
  errors: string[];
  executionTime: number;
  pendingAutoexec: AutoexecScript | null;
}

/**
 * Result of executing a single tool call
 */
export interface ToolExecutionResult {
  toolId: string;
  type: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * RAGDispatcher
 * 
 * Orchestrates the execution of structured LLM outputs.
 */
export class RAGDispatcher {
  /**
   * Base directory for file operations (sandboxed)
   */
  private readonly workspaceDir: string;
  
  /**
   * Optional response object for SSE streaming
   * Used to emit real-time tool call events to the client
   */
  private sseResponse?: any;

  constructor() {
    this.workspaceDir = process.cwd();
  }
  
  /**
   * Set the SSE response object for emitting real-time events
   * @param res - Express response object
   */
  setSseResponse(res: any) {
    this.sseResponse = res;
  }
  
  /**
   * Emit a tool call event via SSE
   * @param event - Event data to send to client
   */
  private emitToolCallEvent(event: {
    type: 'tool_call_start' | 'tool_call_success' | 'tool_call_failure';
    toolCallId: string;
    toolType: string;
    data?: any;
  }) {
    if (this.sseResponse) {
      try {
        this.sseResponse.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error('[RAGDispatcher] Failed to emit SSE event:', error);
      }
    }
  }

  /**
   * Dispatch and execute a structured LLM response
   * 
   * @param response - The structured response from the LLM
   * @param messageId - ID of the message triggering this dispatch
   * @returns Dispatch result with all execution outcomes
   */
  async dispatch(response: unknown, messageId: string): Promise<DispatchResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const toolResults: ToolExecutionResult[] = [];

    const parseResult = structuredLLMResponseSchema.safeParse(response);
    if (!parseResult.success) {
      return {
        success: false,
        chatContent: "Failed to parse structured response",
        filesCreated: [],
        filesModified: [],
        toolResults: [],
        errors: [parseResult.error.message],
        executionTime: Date.now() - startTime,
        pendingAutoexec: null
      };
    }

    const structured = parseResult.data;

    // Execute all tool calls - file operations are now done via file_put tool
    if (structured.toolCalls && structured.toolCalls.length > 0) {
      for (const toolCall of structured.toolCalls) {
        const result = await this.executeToolCall(toolCall, messageId);
        toolResults.push(result);
        if (!result.success && result.error) {
          errors.push(`Tool ${toolCall.id}: ${result.error}`);
        }
        // Track file operations from file_put tool results
        if (toolCall.type === "file_put" && result.success) {
          const filePath = (toolCall.parameters as { path?: string })?.path;
          if (filePath) {
            filesCreated.push(filePath);
          }
        }
      }
    }

    // Extract chat content from send_chat tool results
    let chatContent = "";
    for (const result of toolResults) {
      if (result.type === "send_chat" && result.success && result.result) {
        const sendChatResult = result.result as { content?: string };
        if (sendChatResult.content) {
          chatContent += sendChatResult.content + "\n";
        }
      }
    }

    return {
      success: errors.length === 0,
      chatContent: chatContent.trim() || undefined,
      filesCreated,
      filesModified,
      toolResults,
      errors,
      executionTime: Date.now() - startTime,
      pendingAutoexec: null
    };
  }

  /**
   * Execute a single tool call (public for external use)
   */
  async executeToolCall(toolCall: ToolCall, messageId: string, chatId?: string): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let taskId: string | null = null;
    let toolCallLogId: string | null = null;

    try {
      // Create tool task (existing functionality)
      const task = await storage.createToolTask({
        messageId,
        taskType: toolCall.type,
        payload: toolCall,
        status: "running"
      });
      taskId = task.id;
      
      // Create tool call log for UI bubbles (if chatId provided)
      if (chatId) {
        try {
          const toolCallLog = await storage.createToolCallLog({
            chatId,
            messageId,
            toolCallId: toolCall.id,
            toolType: toolCall.type,
            status: "pending",
            request: toolCall.parameters,
          });
          toolCallLogId = toolCallLog.id;
          
          // Emit SSE event for tool call start
          this.emitToolCallEvent({
            type: 'tool_call_start',
            toolCallId: toolCall.id,
            toolType: toolCall.type,
            data: {
              id: toolCallLogId,
              request: toolCall.parameters,
            },
          });
          
          // Prune old logs asynchronously (don't wait for it)
          storage.pruneOldToolCallLogs(chatId).catch(err => {
            console.error('[RAGDispatcher] Failed to prune old tool call logs:', err);
          });
        } catch (logError) {
          console.error('[RAGDispatcher] Failed to create tool call log:', logError);
          // Continue execution even if logging fails
        }
      }

      let result: unknown;

      switch (toolCall.type) {
        case "api_call":
          result = await this.executeApiCall(toolCall);
          break;
        case "search":
          result = await this.executeSearch(toolCall);
          break;
        case "web_search":
          result = await this.executeWebSearch(toolCall);
          break;
        case "google_search":
          result = await this.executeGoogleSearch(toolCall);
          break;
        case "duckduckgo_search":
          result = await this.executeDuckDuckGoSearch(toolCall);
          break;
        case "browser_scrape":
          result = await this.executeBrowserScrape(toolCall);
          break;
        case "http_get":
          result = await this.executeHttpGet(toolCall);
          break;
        case "http_post":
          result = await this.executeHttpPost(toolCall);
          break;
        case "http_put":
          result = await this.executeHttpPut(toolCall);
          break;
        case "file_ingest":
          result = await this.executeFileOperation(toolCall, messageId);
          break;
        case "file_get":
        case "get": // V2 core primitive alias
          result = await this.executeFileGet(toolCall);
          break;
        case "file_put":
        case "put": // V2 core primitive alias
          result = await this.executeFilePut(toolCall);
          break;
        case "log_append":
        case "log": // V2 core primitive alias
          result = await this.executeLogAppend(toolCall);
          break;
        case "tasks_list":
          result = await this.executeTasksList(toolCall);
          break;
        case "tasks_get":
          result = await this.executeTasksGet(toolCall);
          break;
        case "tasks_create":
          result = await this.executeTasksCreate(toolCall);
          break;
        case "tasks_update":
          result = await this.executeTasksUpdate(toolCall);
          break;
        case "tasks_delete":
          result = await this.executeTasksDelete(toolCall);
          break;
        case "tasks_complete":
          result = await this.executeTasksComplete(toolCall);
          break;
        case "gmail_list":
          result = await this.executeGmailList(toolCall);
          break;
        case "gmail_read":
          result = await this.executeGmailRead(toolCall);
          break;
        case "gmail_send":
          result = await this.executeGmailSend(toolCall);
          break;
        case "gmail_search":
          result = await this.executeGmailSearch(toolCall);
          break;
        case "sms_send":
          result = await this.executeSmsSend(toolCall);
          break;
        case "sms_list":
          result = await this.executeSmsList(toolCall);
          break;
        case "call_make":
          result = await this.executeCallMake(toolCall);
          break;
        case "call_list":
          result = await this.executeCallList(toolCall);
          break;
        case "calendar_list":
          result = await this.executeCalendarList(toolCall);
          break;
        case "calendar_events":
          result = await this.executeCalendarEvents(toolCall);
          break;
        case "calendar_create":
          result = await this.executeCalendarCreate(toolCall);
          break;
        case "calendar_update":
          result = await this.executeCalendarUpdate(toolCall);
          break;
        case "calendar_delete":
          result = await this.executeCalendarDelete(toolCall);
          break;
        case "drive_list":
          result = await this.executeDriveList(toolCall);
          break;
        case "drive_read":
          result = await this.executeDriveRead(toolCall);
          break;
        case "drive_search":
          result = await this.executeDriveSearch(toolCall);
          break;
        case "drive_create":
          result = await this.executeDriveCreate(toolCall);
          break;
        case "drive_update":
          result = await this.executeDriveUpdate(toolCall);
          break;
        case "drive_delete":
          result = await this.executeDriveDelete(toolCall);
          break;
        case "docs_read":
          result = await this.executeDocsRead(toolCall);
          break;
        case "docs_create":
          result = await this.executeDocsCreate(toolCall);
          break;
        case "docs_append":
          result = await this.executeDocsAppend(toolCall);
          break;
        case "docs_replace":
          result = await this.executeDocsReplace(toolCall);
          break;
        case "sheets_read":
          result = await this.executeSheetsRead(toolCall);
          break;
        case "sheets_create":
          result = await this.executeSheetsCreate(toolCall);
          break;
        case "sheets_write":
          result = await this.executeSheetsWrite(toolCall);
          break;
        case "sheets_append":
          result = await this.executeSheetsAppend(toolCall);
          break;
        case "sheets_clear":
          result = await this.executeSheetsClear(toolCall);
          break;
        case "terminal_execute":
        case "terminal": // V2 core primitive alias
          result = await this.executeTerminal(toolCall);
          break;
        // V2: DEPRECATED - Paid search tools removed to reduce costs
        case "tavily_search":
        case "tavily_qna":
        case "tavily_research":
        case "perplexity_search":
        case "perplexity_quick":
        case "perplexity_research":
        case "perplexity_news":
          result = {
            type: "deprecated",
            message: "[V2] Paid search tools have been removed. Use 'web_search' (free) or 'http_get' for direct URLs instead.",
            alternatives: ["web_search", "http_get", "http_scrape"],
          };
          break;
        case "github_repos":
          result = await this.executeGithubRepos(toolCall);
          break;
        case "github_repo_get":
          result = await this.executeGithubRepoGet(toolCall);
          break;
        case "github_repo_search":
          result = await this.executeGithubRepoSearch(toolCall);
          break;
        case "github_contents":
          result = await this.executeGithubContents(toolCall);
          break;
        case "github_file_read":
          result = await this.executeGithubFileRead(toolCall);
          break;
        case "github_code_search":
          result = await this.executeGithubCodeSearch(toolCall);
          break;
        case "github_issues":
          result = await this.executeGithubIssues(toolCall);
          break;
        case "github_issue_get":
          result = await this.executeGithubIssueGet(toolCall);
          break;
        case "github_issue_create":
          result = await this.executeGithubIssueCreate(toolCall);
          break;
        case "github_issue_update":
          result = await this.executeGithubIssueUpdate(toolCall);
          break;
        case "github_issue_comment":
          result = await this.executeGithubIssueComment(toolCall);
          break;
        case "github_milestones":
          result = await this.executeGithubMilestones(toolCall);
          break;
        case "github_labels":
          result = await this.executeGithubLabels(toolCall);
          break;
        case "github_pulls":
          result = await this.executeGithubPulls(toolCall);
          break;
        case "github_pull_get":
          result = await this.executeGithubPullGet(toolCall);
          break;
        case "github_pr_merge":
          result = await this.executeGithubPrMerge(toolCall);
          break;
        case "github_pr_review_request":
          result = await this.executeGithubPrReviewRequest(toolCall);
          break;
        case "github_repo_create":
          result = await this.executeGithubRepoCreate(toolCall);
          break;
        case "github_repo_fork":
          result = await this.executeGithubRepoFork(toolCall);
          break;
        case "github_branch_list":
          result = await this.executeGithubBranchList(toolCall);
          break;
        case "github_branch_delete":
          result = await this.executeGithubBranchDelete(toolCall);
          break;
        case "github_release_create":
          result = await this.executeGithubReleaseCreate(toolCall);
          break;
        case "github_actions_trigger":
          result = await this.executeGithubActionsTrigger(toolCall);
          break;
        case "github_workflows_list":
          result = await this.executeGithubWorkflowsList(toolCall);
          break;
        case "github_commits":
          result = await this.executeGithubCommits(toolCall);
          break;
        case "github_user":
          result = await this.executeGithubUser(toolCall);
          break;
        case "browserbase_load":
          result = await this.executeBrowserbaseLoad(toolCall);
          break;
        case "browserbase_screenshot":
          result = await this.executeBrowserbaseScreenshot(toolCall);
          break;
        case "browserbase_action":
          result = await this.executeBrowserbaseAction(toolCall);
          break;
        case "contacts_list":
          result = await this.executeContactsList(toolCall);
          break;
        case "contacts_search":
          result = await this.executeContactsSearch(toolCall);
          break;
        case "contacts_get":
          result = await this.executeContactsGet(toolCall);
          break;
        case "contacts_create":
          result = await this.executeContactsCreate(toolCall);
          break;
        case "contacts_update":
          result = await this.executeContactsUpdate(toolCall);
          break;
        case "contacts_delete":
          result = await this.executeContactsDelete(toolCall);
          break;
        case "debug_echo":
          result = await this.executeDebugEcho(toolCall);
          break;
        case "queue_create":
          result = await this.executeQueueCreate(toolCall);
          break;
        case "queue_batch":
          result = await this.executeQueueBatch(toolCall);
          break;
        case "queue_list":
          result = await this.executeQueueList(toolCall);
          break;
        case "queue_start":
          result = await this.executeQueueStart(toolCall);
          break;
        case "say":
          result = await this.executeSay(toolCall);
          break;
        case "open_url":
          // open_url is a client-side operation - just validate and pass through
          const openUrlParams = toolCall.parameters as { url?: string };
          if (!openUrlParams?.url) {
            throw new Error("URL parameter is required");
          }
          // Validate URL format
          try {
            new URL(openUrlParams.url);
          } catch (e) {
            throw new Error("Invalid URL format");
          }
          result = { url: openUrlParams.url, success: true };
          break;
        case "send_chat":
        case "write": // V2 core primitive alias
          // send_chat/write sends content to chat, does NOT terminate the loop
          const sendChatParams = toolCall.parameters as { content?: string };
          result = { content: sendChatParams?.content || "", success: true };
          break;
        case "end_turn":
          // end_turn is the tool that terminates the agentic loop
          result = { success: true, shouldEndTurn: true };
          break;
        case "db_tables":
          result = await this.executeDbTables(toolCall);
          break;
        case "db_query":
          result = await this.executeDbQuery(toolCall);
          break;
        case "db_insert":
          result = await this.executeDbInsert(toolCall);
          break;
        case "db_delete":
          result = await this.executeDbDelete(toolCall);
          break;
        // Codebase Analysis Tools
        case "codebase_analyze":
          result = await this.executeCodebaseAnalyze(toolCall);
          break;
        case "codebase_progress":
          result = await this.executeCodebaseProgress(toolCall);
          break;
        // SSH Host/Key Setup Tools (kept for configuration)
        case "ssh_key_generate":
          result = await this.executeSshKeyGenerate(toolCall);
          break;
        case "ssh_key_list":
          result = await this.executeSshKeyList(toolCall);
          break;
        case "ssh_host_add":
          result = await this.executeSshHostAdd(toolCall);
          break;
        case "ssh_host_list":
          result = await this.executeSshHostList(toolCall);
          break;
        case "ssh_host_delete":
          result = await this.executeSshHostDelete(toolCall);
          break;
        
        // V2: Legacy SSH connection tools redirected to unified primitive
        case "ssh_connect":
          // Redirect to unified ssh primitive
          result = await this.executeSshPrimitive({
            ...toolCall,
            parameters: { host: toolCall.parameters.alias, action: "connect" }
          });
          break;
        case "ssh_disconnect":
          result = await this.executeSshPrimitive({
            ...toolCall,
            parameters: { host: toolCall.parameters.alias, action: "disconnect" }
          });
          break;
        case "ssh_execute":
          result = await this.executeSshPrimitive({
            ...toolCall,
            parameters: { 
              host: toolCall.parameters.alias, 
              command: toolCall.parameters.command, 
              action: "exec" 
            }
          });
          break;
        case "ssh_status":
          result = await this.executeSshPrimitive({
            ...toolCall,
            parameters: { action: "status" }
          });
          break;
        
        // V2 Core Primitive: Unified SSH
        case "ssh":
          result = await this.executeSshPrimitive(toolCall);
          break;
        
        // Hardware & IoT Tools
        case "arduino_list_boards":
          result = await arduino.listBoards();
          break;
        case "arduino_compile":
          result = await arduino.compileSketch(
            toolCall.parameters.sketchPath,
            toolCall.parameters.fqbn
          );
          break;
        case "arduino_upload":
          result = await arduino.uploadSketch(
            toolCall.parameters.sketchPath,
            toolCall.parameters.fqbn,
            toolCall.parameters.port
          );
          break;
        case "arduino_create_sketch":
          result = await arduino.createSketch(
            toolCall.parameters.name,
            toolCall.parameters.code
          );
          break;
        case "arduino_install_library":
          result = await arduino.installLibrary(toolCall.parameters.libraryName);
          break;
        case "arduino_search_libraries":
          result = await arduino.searchLibraries(toolCall.parameters.query);
          break;
        
        case "adb_list_devices":
          result = await adb.listDevices();
          break;
        case "adb_install_app":
          result = await adb.installApp(
            toolCall.parameters.apkPath,
            toolCall.parameters.deviceSerial
          );
          break;
        case "adb_uninstall_app":
          result = await adb.uninstallApp(
            toolCall.parameters.packageName,
            toolCall.parameters.deviceSerial
          );
          break;
        case "adb_shell":
          result = await adb.executeShell(
            toolCall.parameters.command,
            toolCall.parameters.deviceSerial
          );
          break;
        case "adb_screenshot":
          result = await adb.captureScreenshot(
            toolCall.parameters.outputPath,
            toolCall.parameters.deviceSerial
          );
          break;
        case "adb_device_info":
          result = await adb.getDeviceInfo(toolCall.parameters.deviceSerial);
          break;
        case "adb_list_packages":
          result = await adb.listPackages(toolCall.parameters.deviceSerial);
          break;
        case "adb_push_file":
          result = await adb.pushFile(
            toolCall.parameters.localPath,
            toolCall.parameters.remotePath,
            toolCall.parameters.deviceSerial
          );
          break;
        case "adb_pull_file":
          result = await adb.pullFile(
            toolCall.parameters.remotePath,
            toolCall.parameters.localPath,
            toolCall.parameters.deviceSerial
          );
          break;
        
        case "petoi_find_ports":
          result = await petoi.findPorts();
          break;
        case "petoi_execute_skill":
          result = await petoi.executeSkill(
            toolCall.parameters.port,
            toolCall.parameters.skillName
          );
          break;
        case "petoi_set_servo":
          result = await petoi.setServoAngle(
            toolCall.parameters.port,
            toolCall.parameters.joint,
            toolCall.parameters.angle
          );
          break;
        case "petoi_send_command":
          result = await petoi.sendCustomCommand(
            toolCall.parameters.port,
            toolCall.parameters.command
          );
          break;
        case "petoi_list_skills":
          result = { skills: petoi.getAvailableSkills() };
          break;
        
        case "printer_send_gcode":
          result = await printer3d.sendGCodeViaOctoPrint(
            {
              host: toolCall.parameters.host,
              apiKey: toolCall.parameters.apiKey
            },
            toolCall.parameters.command
          );
          break;
        case "printer_get_status":
          result = await printer3d.getPrinterStatus({
            host: toolCall.parameters.host,
            apiKey: toolCall.parameters.apiKey
          });
          break;
        case "printer_get_job":
          result = await printer3d.getJobStatus({
            host: toolCall.parameters.host,
            apiKey: toolCall.parameters.apiKey
          });
          break;
        case "printer_start_print":
          result = await printer3d.startPrint({
            host: toolCall.parameters.host,
            apiKey: toolCall.parameters.apiKey
          });
          break;
        case "printer_pause_print":
          result = await printer3d.pausePrint({
            host: toolCall.parameters.host,
            apiKey: toolCall.parameters.apiKey
          });
          break;
        case "printer_cancel_print":
          result = await printer3d.cancelPrint({
            host: toolCall.parameters.host,
            apiKey: toolCall.parameters.apiKey
          });
          break;
        case "printer_set_extruder_temp":
          result = await printer3d.setExtruderTemp(
            {
              host: toolCall.parameters.host,
              apiKey: toolCall.parameters.apiKey
            },
            toolCall.parameters.temperature,
            toolCall.parameters.tool
          );
          break;
        case "printer_set_bed_temp":
          result = await printer3d.setBedTemp(
            {
              host: toolCall.parameters.host,
              apiKey: toolCall.parameters.apiKey
            },
            toolCall.parameters.temperature
          );
          break;
        case "printer_home_axes":
          result = await printer3d.homeAxes(
            {
              host: toolCall.parameters.host,
              apiKey: toolCall.parameters.apiKey
            },
            toolCall.parameters.axes
          );
          break;
        
        case "kicad_create_project":
          result = await kicad.createProject(
            toolCall.parameters.projectName,
            toolCall.parameters.outputDir
          );
          break;
        case "kicad_generate_gerber":
          result = await kicad.generateGerber(
            toolCall.parameters.pcbFilePath,
            toolCall.parameters.outputDir
          );
          break;
        case "kicad_generate_drill":
          result = await kicad.generateDrill(
            toolCall.parameters.pcbFilePath,
            toolCall.parameters.outputDir
          );
          break;
        case "kicad_export_pdf":
          result = await kicad.exportPDF(
            toolCall.parameters.pcbFilePath,
            toolCall.parameters.outputPath
          );
          break;
        case "kicad_generate_bom":
          result = await kicad.generateBOM(
            toolCall.parameters.schematicFilePath,
            toolCall.parameters.outputPath
          );
          break;
        case "kicad_validate_pcb":
          result = await kicad.validatePCB(toolCall.parameters.pcbFilePath);
          break;
        
        default:
          result = { message: `Custom tool type: ${toolCall.type}` };
      }

      // Update task status to completed
      if (taskId) {
        await storage.updateToolTaskStatus(taskId, "completed", result);
      }
      
      // Update tool call log to success
      if (toolCallLogId && chatId) {
        try {
          const duration = Date.now() - startTime;
          await storage.updateToolCallLog(toolCall.id, {
            status: "success",
            response: result,
            completedAt: new Date(),
            duration,
          });
          
          // Emit SSE event for tool call success
          this.emitToolCallEvent({
            type: 'tool_call_success',
            toolCallId: toolCall.id,
            toolType: toolCall.type,
            data: {
              id: toolCallLogId,
              duration,
            },
          });
        } catch (logError) {
          console.error('[RAGDispatcher] Failed to update tool call log:', logError);
        }
      }

      return {
        toolId: toolCall.id,
        type: toolCall.type,
        success: true,
        result,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      // Update task status to failed
      if (taskId) {
        await storage.updateToolTaskStatus(taskId, "failed", undefined, error.message);
      }
      
      // Update tool call log to failure
      if (toolCallLogId && chatId) {
        try {
          const duration = Date.now() - startTime;
          await storage.updateToolCallLog(toolCall.id, {
            status: "failure",
            errorMessage: error.message,
            completedAt: new Date(),
            duration,
          });
          
          // Emit SSE event for tool call failure
          this.emitToolCallEvent({
            type: 'tool_call_failure',
            toolCallId: toolCall.id,
            toolType: toolCall.type,
            data: {
              id: toolCallLogId,
              error: error.message,
              duration,
            },
          });
        } catch (logError) {
          console.error('[RAGDispatcher] Failed to update tool call log:', logError);
        }
      }
      
      return {
        toolId: toolCall.id,
        type: toolCall.type,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute an API call tool with validated parameters
   */
  private async executeApiCall(toolCall: ToolCall): Promise<unknown> {
    const parseResult = apiCallParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid API call parameters: ${parseResult.error.message}`);
    }

    const { url, method, headers, body } = parseResult.data;

    const isGetOrHead = method === "GET" || method === "HEAD";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: isGetOrHead ? undefined : (body ? JSON.stringify(body) : undefined)
    });

    return response.json();
  }

  /**
   * Execute a search operation with validated parameters
   */
  private async executeSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = searchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid search parameters: ${parseResult.error.message}`);
    }

    const { query, scope } = parseResult.data;
    return { message: `Search executed for: ${query}`, scope };
  }

  /**
   * Execute a web search using Perplexity API
   */
  private async executeWebSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = webSearchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid web search parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const result = await webSearch({
      query: params.query,
      maxTokens: params.maxTokens,
      searchRecency: params.searchRecency,
      domains: params.domains
    });

    if (!result.success) {
      throw new Error(result.error || "Web search failed");
    }

    return {
      content: result.content,
      citations: result.citations,
      formattedResult: formatSearchResult(result)
    };
  }

  /**
   * Execute Google Custom Search (fast, API-based)
   */
  private async executeGoogleSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = googleSearchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid Google search parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const result = await webSearch({
      query: params.query,
      maxTokens: 1024,
      searchRecency: params.searchRecency,
      domains: params.domains
    });

    if (!result.success) {
      throw new Error(result.error || "Google search failed");
    }

    return {
      success: true,
      query: params.query,
      results: result.citations?.map((url, i) => ({
        url,
        snippet: result.content?.split('\n').slice(i * 3, (i + 1) * 3).join('\n') || ''
      })) || [],
      content: result.content,
      formattedResult: formatSearchResult(result)
    };
  }

  /**
   * Execute DuckDuckGo search (free, no API key needed)
   */
  private async executeDuckDuckGoSearch(toolCall: ToolCall): Promise<unknown> {
    const parseResult = duckduckgoSearchParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid DuckDuckGo search parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const response = await searchWeb(params.query, params.maxResults);

    if (!response.success) {
      throw new Error(response.error || "DuckDuckGo search failed");
    }

    return {
      success: true,
      query: params.query,
      results: response.results,
      count: response.results.length
    };
  }

  /**
   * Execute browser scrape using Playwright (for JS-heavy sites)
   */
  private async executeBrowserScrape(toolCall: ToolCall): Promise<unknown> {
    const parseResult = browserScrapeParamsSchema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid browser scrape parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const result = await browserScrape(params.url, params.timeout);

    if (!result.success) {
      throw new Error(result.error || "Browser scrape failed");
    }

    return {
      success: true,
      url: result.url,
      title: result.title,
      content: result.content
    };
  }

  /**
   * Generic HTTP request executor that handles validation and error handling
   * @private
   */
  private async executeHttpRequest<T extends z.ZodType>(
    toolCall: ToolCall,
    schema: T,
    httpMethod: (options: z.infer<T>) => Promise<HttpResponse>,
    methodName: string
  ): Promise<unknown> {
    const parseResult = schema.safeParse(toolCall.parameters);
    
    if (!parseResult.success) {
      throw new Error(`Invalid HTTP ${methodName} parameters: ${parseResult.error.message}`);
    }

    const params = parseResult.data;
    const result = await httpMethod(params);

    if (!result.success) {
      throw new Error(result.error || `HTTP ${methodName} request failed`);
    }

    // Return the complete HTTP response
    return result;
  }

  /**
   * Execute HTTP GET request
   */
  private async executeHttpGet(toolCall: ToolCall): Promise<unknown> {
    return this.executeHttpRequest(
      toolCall,
      httpGetParamsSchema,
      httpGet,
      'GET'
    );
  }

  /**
   * Execute HTTP POST request
   */
  private async executeHttpPost(toolCall: ToolCall): Promise<unknown> {
    return this.executeHttpRequest(
      toolCall,
      httpPostParamsSchema,
      httpPost,
      'POST'
    );
  }

  /**
   * Execute HTTP PUT request
   */
  private async executeHttpPut(toolCall: ToolCall): Promise<unknown> {
    return this.executeHttpRequest(
      toolCall,
      httpPutParamsSchema,
      httpPut,
      'PUT'
    );
  }


  /**
   * Execute file ingest/upload operations
   * Ingests content into the RAG system for semantic search
   * 
   * Parameters:
   * - content: The file content to ingest (string)
   * - filename: Name of the file being ingested
   * - mimeType: Optional MIME type (e.g., 'text/plain', 'application/json')
   */
  private async executeFileOperation(toolCall: ToolCall, messageId: string): Promise<unknown> {
    const params = toolCall.parameters as {
      content: string;
      filename: string;
      mimeType?: string;
    };

    // Validate required parameters
    if (!params.content || typeof params.content !== 'string') {
      throw new Error('file_ingest requires a content parameter (string)');
    }
    if (!params.filename || typeof params.filename !== 'string') {
      throw new Error('file_ingest requires a filename parameter (string)');
    }

    try {
      // Get the message to find the userId for data isolation
      const message = await storage.getMessageById(messageId);
      let userId: string | null = null;
      
      if (message?.chatId) {
        const chat = await storage.getChatById(message.chatId);
        userId = chat?.userId || null;
      }

      // Ingest the document into the RAG system
      const result = await ragService.ingestDocument(
        params.content,
        null, // attachmentId - not from an attachment
        params.filename,
        params.mimeType || 'text/plain',
        undefined, // options - use default chunking strategy
        userId // userId for data isolation
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to ingest document');
      }

      return {
        success: true,
        documentId: result.documentId,
        chunksCreated: result.chunksCreated,
        filename: params.filename,
        message: `Successfully ingested ${params.filename} into RAG system (${result.chunksCreated} chunks created)`
      };
    } catch (error) {
      console.error('[RAGDispatcher] File ingest error:', error);
      throw new Error(`Failed to ingest file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process a text file creation/replacement
   * 
   * PROTOCOL:
   * - If path starts with "editor:" → save to Monaco editor canvas (frontend handling)
   * - Otherwise → write to filesystem
   */
  private async processTextFile(fileOp: FileOperation): Promise<string> {
    const content = fileOp.encoding === "base64" 
      ? Buffer.from(fileOp.content, "base64").toString("utf8")
      : fileOp.content;

    if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File content exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
    }

    // Handle editor: prefix - files meant for Monaco editor canvas
    if (fileOp.path.startsWith("editor:")) {
      const editorPath = fileOp.path.substring("editor:".length) || `/${fileOp.filename}`;
      console.log(`[RAGDispatcher] Targeting file to editor canvas: ${editorPath}`);
      // Return editor path for frontend processing
      return editorPath;
    }

    // Standard filesystem write
    const sanitizedPath = this.sanitizePath(fileOp.path, fileOp.filename);
    const fullPath = path.join(this.workspaceDir, sanitizedPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");

    if (fileOp.permissions) {
      try {
        await fs.chmod(fullPath, parseInt(fileOp.permissions, 8));
      } catch (error) {
        console.warn(`[RAGDispatcher] Failed to set permissions ${fileOp.permissions} on ${sanitizedPath}:`, error);
      }
    }

    return sanitizedPath;
  }

  /**
   * Process a file append operation
   */
  private async processAppendFile(fileOp: FileOperation): Promise<string> {
    const content = fileOp.encoding === "base64"
      ? Buffer.from(fileOp.content, "base64").toString("utf8")
      : fileOp.content;

    const sanitizedPath = this.sanitizePath(fileOp.path, fileOp.filename);
    const fullPath = path.join(this.workspaceDir, sanitizedPath);

    await fs.appendFile(fullPath, content, "utf8");

    return sanitizedPath;
  }

  /**
   * Process a binary file creation
   * 
   * PROTOCOL:
   * - If path starts with "editor:" → save to Monaco editor canvas (frontend handling)
   * - Otherwise → write to filesystem
   */
  private async processBinaryFile(binOp: BinaryFileOperation): Promise<string> {
    const buffer = Buffer.from(binOp.base64Content, "base64");

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Binary file exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
    }

    // Handle editor: prefix - files meant for Monaco editor canvas
    if (binOp.path.startsWith("editor:")) {
      const editorPath = binOp.path.substring("editor:".length) || `/${binOp.filename}`;
      console.log(`[RAGDispatcher] Targeting binary file to editor canvas: ${editorPath}`);
      // Return editor path for frontend processing
      return editorPath;
    }

    // Standard filesystem write
    const sanitizedPath = this.sanitizePath(binOp.path, binOp.filename);
    const fullPath = path.join(this.workspaceDir, sanitizedPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    if (binOp.permissions) {
      try {
        await fs.chmod(fullPath, parseInt(binOp.permissions, 8));
      } catch (error) {
        console.warn(`[RAGDispatcher] Failed to set permissions ${binOp.permissions} on ${sanitizedPath}:`, error);
      }
    }

    return sanitizedPath;
  }

  /**
   * Process autoexec script (DISABLED by default for security)
   * Public method for async execution from routes.ts
   */
  async processAutoexec(
    autoexec: AutoexecScript, 
    messageId: string
  ): Promise<AutoexecExecutionResult> {
    const startTime = Date.now();
    const command = autoexec.content.split('\n').find(line => 
      line.trim() && !line.startsWith('#') && !line.startsWith('#!/')
    ) || autoexec.content.substring(0, 100);

    if (AUTOEXEC_DISABLED) {
      console.warn("[RAGDispatcher] Autoexec is disabled for security");
      return {
        command,
        output: "Autoexec execution is disabled for security reasons",
        exitCode: 1,
        success: false,
        duration: Date.now() - startTime
      };
    }

    try {
      const scriptPath = path.join(this.workspaceDir, ".nebula", "autoexec.666");
      await fs.mkdir(path.dirname(scriptPath), { recursive: true });
      await fs.writeFile(scriptPath, autoexec.content, "utf8");
      await fs.chmod(scriptPath, 0o700);

      await storage.createExecutionLog({
        taskId: null,
        action: "autoexec_start",
        input: { scriptPath, requiresSudo: autoexec.requiresSudo }
      });

      const execCommand = autoexec.requiresSudo ? `sudo ${scriptPath}` : scriptPath;
      const { stdout, stderr } = await execAsync(execCommand, {
        timeout: autoexec.timeout,
        cwd: this.workspaceDir
      });

      await storage.createExecutionLog({
        taskId: null,
        action: "autoexec_complete",
        output: { stdout },
        exitCode: "0"
      });

      return { 
        command,
        output: stdout + (stderr ? `\n${stderr}` : ''),
        exitCode: 0,
        success: true,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      const exitCode = error.code || 1;
      await storage.createExecutionLog({
        taskId: null,
        action: "autoexec_error",
        output: { error: error.message },
        exitCode: exitCode.toString()
      });

      return { 
        command,
        output: error.stderr || error.stdout || error.message,
        exitCode,
        success: false,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Sanitize file paths to prevent directory traversal attacks
   */
  private sanitizePath(filePath: string, filename: string): string {
    const cleanPath = filePath.replace(/\.\./g, "").replace(/^\/+/, "");
    const cleanFilename = path.basename(filename);
    return path.join(cleanPath, cleanFilename);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE TASKS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeTasksList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId?: string; showCompleted?: boolean };
    const tasks = await googleTasks.listTasks(params?.taskListId || '@default', params?.showCompleted ?? true);
    return { tasks, count: tasks.length };
  }

  private async executeTasksGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string };
    return await googleTasks.getTask(params.taskListId, params.taskId);
  }

  private async executeTasksCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { title: string; notes?: string; due?: string; taskListId?: string };
    return await googleTasks.createTask(params.taskListId || '@default', params.title, params.notes, params.due);
  }

  private async executeTasksUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string; updates: Record<string, unknown> };
    return await googleTasks.updateTask(params.taskListId, params.taskId, params.updates);
  }

  private async executeTasksDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string };
    return await googleTasks.deleteTask(params.taskListId, params.taskId);
  }

  private async executeTasksComplete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { taskListId: string; taskId: string };
    return await googleTasks.completeTask(params.taskListId, params.taskId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CONTACTS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeContactsList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { pageSize?: number; pageToken?: string };
    const result = await googleContacts.listContacts(params?.pageSize || 100, params?.pageToken);
    return { contacts: result.contacts, count: result.contacts.length, nextPageToken: result.nextPageToken };
  }

  private async executeContactsSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; pageSize?: number };
    const contacts = await googleContacts.searchContacts(params.query, params?.pageSize || 30);
    return { contacts, count: contacts.length, query: params.query };
  }

  private async executeContactsGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { resourceName: string };
    const contact = await googleContacts.getContact(params.resourceName);
    if (!contact) {
      throw new Error(`Contact not found: ${params.resourceName}`);
    }
    return contact;
  }

  private async executeContactsCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      givenName: string;
      familyName?: string;
      email?: string;
      phoneNumber?: string;
      organization?: string;
      title?: string;
    };
    const contact = await googleContacts.createContact(params);
    return { success: true, contact, message: `Contact "${params.givenName}" created successfully` };
  }

  private async executeContactsUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      resourceName: string;
      givenName?: string;
      familyName?: string;
      email?: string;
      phoneNumber?: string;
      organization?: string;
      title?: string;
    };
    const { resourceName, ...updates } = params;
    const contact = await googleContacts.updateContact(resourceName, updates);
    return { success: true, contact, message: `Contact updated successfully` };
  }

  private async executeContactsDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { resourceName: string };
    const success = await googleContacts.deleteContact(params.resourceName);
    return { success, message: success ? "Contact deleted" : "Failed to delete contact" };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GMAIL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeGmailList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { maxResults?: number; labelIds?: string[] };
    try {
      const emails = await gmail.listEmails(params?.maxResults || 20, params?.labelIds || ['INBOX']);
      return { emails, count: emails.length };
    } catch (error: any) {
      console.error('[Gmail List Error]', error.message);
      throw error;
    }
  }

  private async executeGmailRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { messageId: string };
    return await gmail.getEmail(params.messageId);
  }

  private async executeGmailSend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { to: string; subject: string; body: string };
    return await gmail.sendEmail(params.to, params.subject, params.body);
  }

  private async executeGmailSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; maxResults?: number };
    const emails = await gmail.searchEmails(params.query, params.maxResults || 20);
    return { emails, count: emails.length, query: params.query };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE CALENDAR HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeCalendarList(toolCall: ToolCall): Promise<unknown> {
    const calendars = await googleCalendar.listCalendars();
    return { calendars, count: calendars.length };
  }

  private async executeCalendarEvents(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { calendarId?: string; timeMin?: string; timeMax?: string; maxResults?: number };
    const events = await googleCalendar.listEvents(params?.calendarId || 'primary', params?.timeMin, params?.timeMax, params?.maxResults || 20);
    return { events, count: events.length };
  }

  private async executeCalendarCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      summary: string; 
      start: string; 
      end: string; 
      description?: string; 
      calendarId?: string;
      timeZone?: string;
    };
    const startObj = { dateTime: params.start, timeZone: params.timeZone };
    const endObj = { dateTime: params.end, timeZone: params.timeZone };
    return await googleCalendar.createEvent(params.calendarId || 'primary', params.summary, startObj, endObj, params.description);
  }

  private async executeCalendarUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      calendarId: string; 
      eventId: string; 
      updates: Record<string, unknown>;
    };
    return await googleCalendar.updateEvent(params.calendarId, params.eventId, params.updates);
  }

  private async executeCalendarDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { calendarId: string; eventId: string };
    await googleCalendar.deleteEvent(params.calendarId, params.eventId);
    return { success: true, message: `Event ${params.eventId} deleted from calendar ${params.calendarId}` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DRIVE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeDriveList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query?: string; pageSize?: number };
    const files = await googleDrive.listDriveFiles(params?.query, params?.pageSize || 20);
    return { files, count: files.length };
  }

  private async executeDriveRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { fileId: string };
    return await googleDrive.getDriveFile(params.fileId);
  }

  private async executeDriveSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; pageSize?: number };
    const files = await googleDrive.searchDriveFiles(params.query);
    return { files, count: files.length, query: params.query };
  }

  private async executeDriveCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { name: string; content?: string; mimeType?: string };
    return await googleDrive.createDriveFile(params.name, params.content || '', params.mimeType || 'text/plain');
  }

  private async executeDriveUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { fileId: string; content: string; mimeType?: string };
    return await googleDrive.updateDriveFile(params.fileId, params.content, params.mimeType || 'text/plain');
  }

  private async executeDriveDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { fileId: string };
    await googleDrive.deleteDriveFile(params.fileId);
    return { success: true, message: `File ${params.fileId} deleted` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE DOCS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeDocsRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { documentId: string };
    const text = await googleDocs.getDocumentText(params.documentId);
    return { documentId: params.documentId, text };
  }

  private async executeDocsCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { title: string };
    return await googleDocs.createDocument(params.title);
  }

  private async executeDocsAppend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { documentId: string; text: string };
    await googleDocs.appendText(params.documentId, params.text);
    return { success: true, documentId: params.documentId, message: 'Text appended successfully' };
  }

  private async executeDocsReplace(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { documentId: string; oldText: string; newText: string };
    await googleDocs.replaceText(params.documentId, params.oldText, params.newText);
    return { success: true, documentId: params.documentId, message: 'Text replaced successfully' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE SHEETS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeSheetsRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range?: string };
    if (params.range) {
      const values = await googleSheets.getSheetValues(params.spreadsheetId, params.range);
      return { spreadsheetId: params.spreadsheetId, range: params.range, values };
    }
    return await googleSheets.getSpreadsheet(params.spreadsheetId);
  }

  private async executeSheetsCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { title: string; sheetTitles?: string[] };
    return await googleSheets.createSpreadsheet(params.title, params.sheetTitles);
  }

  private async executeSheetsWrite(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range: string; values: unknown[][] };
    const result = await googleSheets.updateSheetValues(params.spreadsheetId, params.range, params.values);
    return { success: true, spreadsheetId: params.spreadsheetId, range: params.range, updatedCells: result.updatedCells };
  }

  private async executeSheetsAppend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range: string; values: unknown[][] };
    const result = await googleSheets.appendSheetValues(params.spreadsheetId, params.range, params.values);
    return { success: true, spreadsheetId: params.spreadsheetId, range: params.range, updatedRows: result.updates?.updatedRows };
  }

  private async executeSheetsClear(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { spreadsheetId: string; range: string };
    await googleSheets.clearSheetRange(params.spreadsheetId, params.range);
    return { success: true, spreadsheetId: params.spreadsheetId, range: params.range, message: 'Range cleared successfully' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TERMINAL HANDLER
  // Supports server:/client: prefix routing
  // - server:command or just command → Execute on Replit server (default)
  // - client:command → Execute on connected desktop-app client
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * V2 terminal primitive - Execute command locally
   * Simple: just run the command, return the result
   */
  private async executeTerminal(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { command: string; cwd?: string; timeout?: number };
    
    if (!params.command || typeof params.command !== 'string') {
      throw new Error('command is required');
    }

    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: params.cwd || this.workspaceDir,
        timeout: params.timeout || 30000,
        maxBuffer: 1024 * 1024
      });

      return {
        type: "terminal",
        success: true,
        command: params.command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        type: "terminal",
        success: false,
        command: params.command,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message,
        exitCode: error.code || 1,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE GET/PUT HANDLERS
  // Supports server:/client:/editor: prefix routing
  // - server:path or just path → Server filesystem (default)
  // - client:path → Client machine via connected desktop-app
  // - editor:path → Monaco editor canvas
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * File Get Tool - Read a file with prefix routing
   * - server:path or just path → Read from server filesystem (default)
   * - client:path → Read from client via desktop-app
   * - editor:path → Read from Monaco editor canvas
   * 
   * Supports optional maxLength parameter to truncate content if needed.
   * If maxLength is omitted, returns full content without truncation.
   */
  private async executeFileGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { path: string; encoding?: string; maxLength?: number };
    
    if (!params.path || typeof params.path !== 'string') {
      throw new Error('file_get requires a path parameter');
    }

    // Parse prefix to determine target
    const parsed = parsePathPrefix(params.path, 'server');
    const actualPath = parsed.path;

    // Route to editor canvas
    if (parsed.target === 'editor') {
      console.log(`[RAGDispatcher] Reading from editor canvas: ${actualPath}`);
      return {
        type: 'file_get',
        path: actualPath,
        source: 'editor',
        encoding: params.encoding || 'utf8',
        noTruncate: !params.maxLength, // Signal to routes.ts to skip auto-truncation
        message: `Request to read file from editor canvas: ${actualPath}`
      };
    }

    // Route to client machine
    if (parsed.target === 'client') {
      console.log(`[RAGDispatcher] Reading file from client: ${actualPath}`);
      
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error('No desktop agent connected. Start the Meowstik desktop app on your computer to use client: paths.');
      }
      
      let content = await clientRouter.readFile(actualPath, params.encoding || 'utf8');
      
      // Apply maxLength if specified
      const truncated = params.maxLength && typeof content === 'string' && content.length > params.maxLength;
      if (truncated) {
        content = content.substring(0, params.maxLength) + `\n... [truncated to ${params.maxLength} characters]`;
      }
      
      return {
        type: 'file_get',
        path: actualPath,
        source: 'client',
        content,
        encoding: params.encoding || 'utf8',
        truncated,
        noTruncate: !params.maxLength // Signal to routes.ts to skip auto-truncation
      };
    }

    // Read from server filesystem (default)
    const sanitizedPath = actualPath.replace(/\.\./g, "").replace(/^\/+/, "");
    const fullPath = path.join(this.workspaceDir, sanitizedPath);
    
    try {
      let content = await fs.readFile(fullPath, params.encoding === 'base64' ? 'base64' : 'utf8');
      
      // Apply maxLength if specified
      const truncated = params.maxLength && typeof content === 'string' && content.length > params.maxLength;
      if (truncated) {
        content = content.substring(0, params.maxLength) + `\n... [truncated to ${params.maxLength} characters]`;
      }
      
      return {
        type: 'file_get',
        path: sanitizedPath,
        source: 'server',
        content,
        encoding: params.encoding || 'utf8',
        truncated,
        noTruncate: !params.maxLength // Signal to routes.ts to skip auto-truncation
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          type: 'file_get',
          path: sanitizedPath,
          source: 'server',
          content: null,
          error: `File not found: ${sanitizedPath}. If you expected this file to exist, verify the path or use ls to find it.`,
          exists: false
        };
      }
      throw error;
    }
  }

  /**
   * File Put Tool - Write/create a file with prefix routing
   * - server:path or just path → Write to server filesystem (default)
   * - client:path → Write to client via desktop-app
   * - editor:path → Write to Monaco editor canvas
   */
  private async executeFilePut(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      path: string; 
      content: string; 
      mimeType?: string;
      permissions?: string;
      summary?: string;
    };
    
    if (!params.path || typeof params.path !== 'string') {
      throw new Error('file_put requires a path parameter');
    }
    if (!params.content && params.content !== '') {
      throw new Error('file_put requires a content parameter');
    }

    // Parse prefix to determine target
    const parsed = parsePathPrefix(params.path, 'server');
    const actualPath = parsed.path;

    // Route to editor canvas
    if (parsed.target === 'editor') {
      console.log(`[RAGDispatcher] Writing to editor canvas: ${actualPath}`);
      
      // Auto-ingest into RAG if content is text-based
      const mimeType = params.mimeType || this.detectMimeType(actualPath);
      let ingestResult = null;
      if (chunkingService.supportsTextExtraction(mimeType)) {
        try {
          ingestResult = await ragService.ingestDocument(
            params.content,
            null, // No attachment record for editor-based ingestion
            path.basename(actualPath),
            mimeType
          );
          console.log(`[RAGDispatcher] Auto-ingested editor file: ${actualPath}, chunks: ${ingestResult.chunksCreated}`);
        } catch (error) {
          console.warn(`[RAGDispatcher] Failed to auto-ingest editor file:`, error);
        }
      }
      
      return {
        type: 'file_put',
        path: actualPath,
        destination: 'editor',
        content: params.content,
        mimeType,
        summary: params.summary,
        ingested: ingestResult?.success || false,
        chunksCreated: ingestResult?.chunksCreated || 0,
        message: `File saved to editor canvas: ${actualPath}. View at /editor`
      };
    }

    // Route to client machine
    if (parsed.target === 'client') {
      console.log(`[RAGDispatcher] Writing file to client: ${actualPath}`);
      
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error('No desktop agent connected. Start the Meowstik desktop app on your computer to use client: paths.');
      }
      
      await clientRouter.writeFile(actualPath, params.content, { permissions: params.permissions });
      
      return {
        type: 'file_put',
        path: actualPath,
        destination: 'client',
        mimeType: params.mimeType || this.detectMimeType(actualPath),
        summary: params.summary,
        message: `File written to client: ${actualPath}`
      };
    }

    // Write to server filesystem (default)
    const sanitizedPath = actualPath.replace(/\.\./g, "").replace(/^\/+/, "");
    const fullPath = path.join(this.workspaceDir, sanitizedPath);
    
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, params.content, 'utf8');
      
      if (params.permissions) {
        try {
          await fs.chmod(fullPath, parseInt(params.permissions, 8));
        } catch (error) {
          console.warn(`[RAGDispatcher] Failed to set permissions on ${sanitizedPath}:`, error);
        }
      }

      // Auto-ingest into RAG if content is text-based
      const mimeType = params.mimeType || this.detectMimeType(sanitizedPath);
      let ingestResult = null;
      if (chunkingService.supportsTextExtraction(mimeType)) {
        try {
          ingestResult = await ragService.ingestDocument(
            params.content,
            null, // No attachment record for file-based ingestion
            path.basename(sanitizedPath),
            mimeType
          );
          console.log(`[RAGDispatcher] Auto-ingested file: ${sanitizedPath}, chunks: ${ingestResult.chunksCreated}`);
        } catch (error) {
          console.warn(`[RAGDispatcher] Failed to auto-ingest file:`, error);
        }
      }

      return {
        type: 'file_put',
        path: sanitizedPath,
        destination: 'server',
        mimeType,
        summary: params.summary,
        ingested: ingestResult?.success || false,
        chunksCreated: ingestResult?.chunksCreated || 0,
        message: `File written to: ${sanitizedPath}`
      };
    } catch (error: any) {
      return {
        type: 'file_put',
        path: sanitizedPath,
        destination: 'server',
        success: false,
        error: `Failed to write file: ${error.message || String(error)}`
      };
    }
  }

  /**
   * Log Append Tool - Append content to a named log file in ~/workspace/logs/
   */
  private async executeLogAppend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      name: string; 
      content: string;
    };
    
    if (!params.name || typeof params.name !== 'string') {
      throw new Error('log_append requires a name parameter');
    }
    if (!params.content && params.content !== '') {
      throw new Error('log_append requires a content parameter');
    }

    // Sanitize log name to prevent path traversal
    const sanitizedName = params.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const logPath = path.join(this.workspaceDir, 'logs', `${sanitizedName}.md`);
    
    try {
      // Ensure logs directory exists
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      
      // Append content with timestamp
      const timestamp = new Date().toISOString();
      const entry = `\n---\n**${timestamp}**\n${params.content}\n`;
      
      await fs.appendFile(logPath, entry, 'utf8');
      
      console.log(`[RAGDispatcher] Appended to log: ${logPath}`);
      
      return {
        type: 'log_append',
        name: sanitizedName,
        path: logPath,
        success: true,
        message: `Content appended to log: ${sanitizedName}.md`
      };
    } catch (error: any) {
      return {
        type: 'log_append',
        name: sanitizedName,
        path: logPath,
        success: false,
        error: `Failed to append to log: ${error.message || String(error)}`
      };
    }
  }

  /**
   * Detect MIME type from file extension
   */
  private detectMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.jsx': 'application/javascript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.py': 'text/x-python',
      '.sql': 'text/x-sql',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    return mimeTypes[ext] || 'text/plain';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAVILY SEARCH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeTavilySearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      query: string; 
      searchDepth?: 'basic' | 'advanced';
      maxResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
    };
    return await tavilySearch({
      query: params.query,
      searchDepth: params.searchDepth || 'basic',
      maxResults: params.maxResults || 5,
      includeAnswer: true,
      includeDomains: params.includeDomains,
      excludeDomains: params.excludeDomains,
    });
  }

  private async executeTavilyQnA(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string };
    return await tavilyQnA(params.query);
  }

  private async executeTavilyResearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; maxResults?: number };
    return await tavilyDeepResearch(params.query, params.maxResults || 10);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERPLEXITY SEARCH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executePerplexitySearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { 
      query: string; 
      model?: string;
      searchRecency?: 'hour' | 'day' | 'week' | 'month';
    };
    return await perplexitySearch({
      query: params.query,
      model: params.model,
      returnCitations: true,
      searchRecency: params.searchRecency,
    });
  }

  private async executePerplexityQuick(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string };
    return await perplexityQuickAnswer(params.query);
  }

  private async executePerplexityResearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string };
    return await perplexityDeepResearch(params.query);
  }

  private async executePerplexityNews(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; recency?: 'hour' | 'day' | 'week' };
    return await perplexityNews(params.query, params.recency || 'day');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GITHUB HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeGithubRepos(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { perPage?: number; page?: number; sort?: 'created' | 'updated' | 'pushed' | 'full_name' };
    const repos = await github.listUserRepos(params?.perPage || 30, params?.page || 1, params?.sort || 'updated');
    return { repos, count: repos.length };
  }

  private async executeGithubRepoGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string };
    return await github.getRepo(params.owner, params.repo);
  }

  private async executeGithubRepoSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; perPage?: number };
    return await github.searchRepos(params.query, params.perPage || 10);
  }

  private async executeGithubContents(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; path?: string; ref?: string };
    return await github.getRepoContents(params.owner, params.repo, params.path || '', params.ref);
  }

  private async executeGithubFileRead(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; path: string; ref?: string };
    return await github.getFileContent(params.owner, params.repo, params.path, params.ref);
  }

  private async executeGithubCodeSearch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; perPage?: number };
    return await github.searchCode(params.query, params.perPage || 10);
  }

  private async executeGithubIssues(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; perPage?: number };
    const issues = await github.listIssues(params.owner, params.repo, params.state || 'open', params.perPage || 30);
    return { issues, count: issues.length };
  }

  private async executeGithubIssueGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; issueNumber: number };
    return await github.getIssue(params.owner, params.repo, params.issueNumber);
  }

  private async executeGithubIssueCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; title: string; body?: string; labels?: string[]; assignees?: string[]; milestone?: number };
    return await github.createIssue(params.owner, params.repo, params.title, params.body, params.labels, params.assignees, params.milestone);
  }

  private async executeGithubIssueUpdate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; issueNumber: number; title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; assignees?: string[]; milestone?: number | null };
    const updates: { title?: string; body?: string; state?: 'open' | 'closed'; labels?: string[]; assignees?: string[]; milestone?: number | null } = {};
    if (params.title !== undefined) updates.title = params.title;
    if (params.body !== undefined) updates.body = params.body;
    if (params.state !== undefined) updates.state = params.state;
    if (params.labels !== undefined) updates.labels = params.labels;
    if (params.assignees !== undefined) updates.assignees = params.assignees;
    if (params.milestone !== undefined) updates.milestone = params.milestone;
    return await github.updateIssue(params.owner, params.repo, params.issueNumber, updates);
  }

  private async executeGithubMilestones(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; state?: 'open' | 'closed' | 'all' };
    const milestones = await github.listMilestones(params.owner, params.repo, params.state);
    return { milestones, count: milestones.length };
  }

  private async executeGithubLabels(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string };
    const labels = await github.listLabels(params.owner, params.repo);
    return { labels, count: labels.length };
  }

  private async executeGithubIssueComment(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; issueNumber: number; body: string };
    return await github.addIssueComment(params.owner, params.repo, params.issueNumber, params.body);
  }

  private async executeGithubPulls(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; perPage?: number };
    const pulls = await github.listPullRequests(params.owner, params.repo, params.state || 'open', params.perPage || 30);
    return { pulls, count: pulls.length };
  }

  private async executeGithubPullGet(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; pullNumber: number };
    return await github.getPullRequest(params.owner, params.repo, params.pullNumber);
  }

  private async executeGithubCommits(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; sha?: string; perPage?: number };
    const commits = await github.listCommits(params.owner, params.repo, params.sha, params.perPage || 30);
    return { commits, count: commits.length };
  }

  private async executeGithubUser(toolCall: ToolCall): Promise<unknown> {
    return await github.getAuthenticatedUser();
  }

  private async executeGithubPrMerge(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; pullNumber: number; commitTitle?: string; commitMessage?: string; mergeMethod?: 'merge' | 'squash' | 'rebase' };
    return await github.mergePullRequest(params.owner, params.repo, params.pullNumber, {
      commitTitle: params.commitTitle,
      commitMessage: params.commitMessage,
      mergeMethod: params.mergeMethod
    });
  }

  private async executeGithubPrReviewRequest(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; pullNumber: number; reviewers: string[]; teamReviewers?: string[] };
    return await github.requestReviewers(params.owner, params.repo, params.pullNumber, params.reviewers, params.teamReviewers);
  }

  private async executeGithubRepoCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { name: string; description?: string; isPrivate?: boolean; autoInit?: boolean };
    return await github.createRepo(params.name, {
      description: params.description,
      isPrivate: params.isPrivate,
      autoInit: params.autoInit
    });
  }

  private async executeGithubRepoFork(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; organization?: string; name?: string };
    return await github.forkRepo(params.owner, params.repo, params.organization, params.name);
  }

  private async executeGithubBranchList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string };
    const branches = await github.listBranches(params.owner, params.repo);
    return { branches, count: branches.length };
  }

  private async executeGithubBranchDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; branch: string };
    return await github.deleteBranch(params.owner, params.repo, params.branch);
  }

  private async executeGithubReleaseCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; tagName: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean; targetCommitish?: string };
    return await github.createRelease(params.owner, params.repo, params.tagName, {
      name: params.name,
      body: params.body,
      draft: params.draft,
      prerelease: params.prerelease,
      targetCommitish: params.targetCommitish
    });
  }

  private async executeGithubActionsTrigger(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string; workflowId: string; ref: string; inputs?: Record<string, string> };
    return await github.triggerWorkflow(params.owner, params.repo, params.workflowId, params.ref, params.inputs);
  }

  private async executeGithubWorkflowsList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { owner: string; repo: string };
    const workflows = await github.listWorkflows(params.owner, params.repo);
    return { workflows, count: workflows.length };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BROWSERBASE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeBrowserbaseLoad(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { url: string; textOnly?: boolean; waitForSelector?: string; timeout?: number };
    const result = await browserbase.loadPage(params.url, {
      textOnly: params.textOnly,
      waitForSelector: params.waitForSelector,
      timeout: params.timeout,
    });
    return {
      url: result.url,
      title: result.title,
      html: result.text || result.html.substring(0, 10000),
      sessionId: result.sessionId,
      replayUrl: result.sessionId ? browserbase.getSessionReplayUrl(result.sessionId) : undefined,
    };
  }

  private async executeBrowserbaseScreenshot(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { url: string; fullPage?: boolean; timeout?: number };
    const result = await browserbase.takeScreenshot(params.url, {
      fullPage: params.fullPage,
      timeout: params.timeout,
    });
    return {
      url: result.url,
      screenshotSize: result.screenshot.length,
      sessionId: result.sessionId,
      replayUrl: result.sessionId ? browserbase.getSessionReplayUrl(result.sessionId) : undefined,
      message: 'Screenshot captured successfully',
    };
  }

  private async executeBrowserbaseAction(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      url: string;
      actions: Array<{
        type: 'click' | 'type' | 'scroll' | 'wait' | 'screenshot';
        selector?: string;
        text?: string;
        delay?: number;
      }>;
    };
    const result = await browserbase.executeBrowserAction(params.url, params.actions);
    return {
      success: result.success,
      results: result.results,
      sessionId: result.sessionId,
      replayUrl: browserbase.getSessionReplayUrl(result.sessionId),
    };
  }

  /**
   * Debug Echo Tool - Returns all context the LLM received
   * Useful for debugging what information is being passed to the AI
   */
  private async executeDebugEcho(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      include_system?: boolean;
      include_history?: boolean;
      include_tools?: boolean;
      raw_input?: string;
      conversation_context?: unknown;
    };

    // Gather debug information
    const debugInfo: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      toolCall: {
        id: toolCall.id,
        type: toolCall.type,
        operation: toolCall.operation,
        parameters: toolCall.parameters,
      },
    };

    // Include raw input if provided
    if (params.raw_input) {
      debugInfo.raw_input = params.raw_input;
    }

    // Include conversation context if provided
    if (params.conversation_context) {
      debugInfo.conversation_context = params.conversation_context;
    }

    // Get last stored debug buffer if available
    try {
      const debugBuffer = await import('./llm-debug-buffer');
      if (debugBuffer.llmDebugBuffer) {
        debugInfo.lastPrompt = debugBuffer.llmDebugBuffer.getLastPrompt();
        debugInfo.lastSystemInstruction = debugBuffer.llmDebugBuffer.getLastSystemInstruction();
        debugInfo.lastMessages = debugBuffer.llmDebugBuffer.getLastMessages();
      }
    } catch {
      debugInfo.debugBufferError = "Debug buffer not available";
    }

    return {
      type: "debug_echo",
      message: "Debug information retrieved successfully",
      debug: debugInfo,
    };
  }

  // =========================================================================
  // QUEUE TOOLS - AI batch processing queue
  // =========================================================================

  /**
   * Create a single task in the queue (V2: file-based)
   */
  private async executeQueueCreate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      title: string;
      description?: string;
      taskType: string;
      priority?: number;
      input?: Record<string, unknown>;
      workerName?: string;
    };

    if (!params.title || !params.taskType) {
      throw new Error("Task title and taskType are required");
    }

    // V2: Use file-based queue (default worker: "general")
    const workerName = params.workerName || params.taskType || "general";
    const job = fileQueue.createJob(workerName, params.taskType, params.input || {}, {
      priority: params.priority || 5,
      title: params.title,
      description: params.description,
    });

    return {
      type: "queue_create",
      message: `Job "${params.title}" created in ${workerName} queue`,
      job,
      path: `queues/${workerName}/`,
    };
  }

  /**
   * Create multiple tasks in the queue at once (V2: file-based)
   */
  private async executeQueueBatch(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      tasks: Array<{
        title: string;
        description?: string;
        taskType: string;
        priority?: number;
        input?: Record<string, unknown>;
      }>;
      workerName?: string;
    };

    if (!params.tasks || !Array.isArray(params.tasks) || params.tasks.length === 0) {
      throw new Error("tasks array is required and must not be empty");
    }

    // V2: Create jobs in file-based queue
    const jobs = params.tasks.map((t, idx) => {
      const workerName = params.workerName || t.taskType || "general";
      return fileQueue.createJob(workerName, t.taskType || "action", t.input || {}, {
        priority: t.priority ?? (params.tasks.length - idx),
        title: t.title,
        description: t.description,
      });
    });

    return {
      type: "queue_batch",
      message: `${jobs.length} jobs created successfully`,
      jobs,
    };
  }

  /**
   * List tasks in the queue (V2: file-based)
   */
  private async executeQueueList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      workerName?: string;
      status?: "pending" | "processing" | "finished" | "failed";
    };

    // V2: List all workers or specific worker
    const workers = params.workerName ? [params.workerName] : fileQueue.listWorkers();
    const status = params.status || "pending";

    const result: Record<string, { jobs: fileQueue.Job[]; stats: ReturnType<typeof fileQueue.getQueueStats> }> = {};
    let totalJobs = 0;

    for (const worker of workers) {
      const jobs = fileQueue.listJobs(worker, status);
      const stats = fileQueue.getQueueStats(worker);
      result[worker] = { jobs, stats };
      totalJobs += jobs.length;
    }

    return {
      type: "queue_list",
      message: `Found ${totalJobs} jobs across ${workers.length} worker(s)`,
      queues: result,
      path: "queues/",
    };
  }

  /**
   * Start/claim the next pending task in the queue (V2: file-based)
   */
  private async executeQueueStart(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      workerName?: string;
      workerId?: string;
      jobId?: string;
    };

    const workerName = params.workerName || "general";
    let job: fileQueue.Job | null;

    // If specific job ID provided, claim that job
    if (params.jobId) {
      job = fileQueue.claimJobById(workerName, params.jobId, params.workerId);
      if (!job) {
        return {
          type: "queue_start",
          message: `Job ${params.jobId} not found in ${workerName} queue`,
          job: null,
        };
      }
    } else {
      // Claim next job by priority
      job = fileQueue.claimJob(workerName, params.workerId);
      if (!job) {
        return {
          type: "queue_start",
          message: `No pending jobs in ${workerName} queue`,
          job: null,
        };
      }
    }

    return {
      type: "queue_start",
      message: `Job "${job.title || job.id}" claimed`,
      job,
      path: `queues/${workerName}/.processing/`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TWILIO SMS/VOICE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send an SMS message via Twilio
   */
  private async executeSmsSend(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { to: string; body: string };
    
    if (!params.to || !params.body) {
      throw new Error("sms_send requires 'to' (phone number) and 'body' parameters");
    }

    // Validate phone number format (basic E.164 check)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(params.to.replace(/[\s\-\(\)]/g, ''))) {
      throw new Error("Invalid phone number format. Please use E.164 format (e.g., +14155551234)");
    }

    if (params.body.length < 1 || params.body.length > 1600) {
      throw new Error("SMS body must be between 1 and 1600 characters");
    }

    try {
      const result = await twilio.sendSMS(params.to, params.body);
      
      return {
        type: "sms_send",
        success: true,
        sid: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
        message: `SMS sent successfully to ${params.to}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "sms_send",
        success: false,
        to: params.to,
        error: errorMessage,
        message: `Failed to send SMS: ${errorMessage}`,
      };
    }
  }

  /**
   * List recent SMS messages from Twilio
   */
  private async executeSmsList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { limit?: number };
    
    try {
      const messages = await twilio.getMessages(params.limit || 20);
      
      return {
        type: "sms_list",
        success: true,
        messages,
        count: messages.length,
        message: `Retrieved ${messages.length} SMS messages`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "sms_list",
        success: false,
        error: errorMessage,
        message: `Failed to list SMS messages: ${errorMessage}`,
      };
    }
  }

  /**
   * Make a voice call via Twilio
   */
  private async executeCallMake(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { to: string; message?: string; twimlUrl?: string };
    
    if (!params.to) {
      throw new Error("call_make requires 'to' (phone number) parameter");
    }

    if (!params.message && !params.twimlUrl) {
      throw new Error("call_make requires either 'message' (text to speak) or 'twimlUrl' parameter");
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(params.to.replace(/[\s\-\(\)]/g, ''))) {
      throw new Error("Invalid phone number format. Please use E.164 format (e.g., +14155551234)");
    }

    try {
      let result;
      if (params.twimlUrl) {
        // Use custom TwiML URL
        result = await twilio.makeCall(params.to, params.twimlUrl);
      } else {
        // Use text-to-speech message
        result = await twilio.makeCallWithMessage(params.to, params.message!);
      }
      
      return {
        type: "call_make",
        success: true,
        sid: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
        message: `Call initiated to ${params.to}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "call_make",
        success: false,
        to: params.to,
        error: errorMessage,
        message: `Failed to make call: ${errorMessage}`,
      };
    }
  }

  /**
   * List recent voice calls from Twilio
   */
  private async executeCallList(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { limit?: number };
    
    try {
      const calls = await twilio.getCalls(params.limit || 20);
      
      return {
        type: "call_list",
        success: true,
        calls,
        count: calls.length,
        message: `Retrieved ${calls.length} call records`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "call_list",
        success: false,
        error: errorMessage,
        message: `Failed to list calls: ${errorMessage}`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOICE / TTS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate speech audio using Gemini TTS
   */
  private async executeSay(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { utterance: string; voice?: string };
    
    console.log(`[Say] ▶ executeSay called, utterance length: ${params.utterance?.length || 0}`);
    
    if (!params.utterance) {
      throw new Error("say tool requires 'utterance' parameter (text to speak)");
    }

    try {
      // Determine TTS provider from environment variable (defaults to Google)
      const ttsProvider = process.env.TTS_PROVIDER || "google";
      console.log(`[Say] Using TTS provider: ${ttsProvider}`);
      
      let ttsResult;
      let voice;
      
      if (ttsProvider === "elevenlabs" || ttsProvider === "11labs") {
        // Use ElevenLabs TTS
        const { generateSingleSpeakerAudio, DEFAULT_ELEVENLABS_VOICE } = await import("../integrations/elevenlabs-tts");
        voice = params.voice || DEFAULT_ELEVENLABS_VOICE;
        console.log(`[Say] Calling ElevenLabs TTS: "${params.utterance.substring(0, 50)}..." with voice ${voice}`);
        ttsResult = await generateSingleSpeakerAudio(params.utterance, voice);
      } else {
        // Use Google Cloud TTS (default)
        const { generateSingleSpeakerAudio, DEFAULT_TTS_VOICE } = await import("../integrations/expressive-tts");
        voice = params.voice || DEFAULT_TTS_VOICE;
        console.log(`[Say] Calling Google Cloud TTS: "${params.utterance.substring(0, 50)}..." with voice ${voice}`);
        ttsResult = await generateSingleSpeakerAudio(params.utterance, voice);
      }
      
      if (!ttsResult.success) {
        return {
          type: "say",
          success: false,
          utterance: params.utterance,
          voice,
          provider: ttsProvider,
          error: ttsResult.error || "TTS generation failed",
          message: `Failed to generate speech: ${ttsResult.error}`,
        };
      }

      console.log(`[Say] Audio generated successfully, base64 length: ${ttsResult.audioBase64?.length || 0}`);

      return {
        type: "say",
        success: true,
        utterance: params.utterance,
        voice,
        provider: ttsProvider,
        audioBase64: ttsResult.audioBase64,
        mimeType: ttsResult.mimeType || "audio/mpeg",
        duration: ttsResult.duration,
        message: `Generated speech for: "${params.utterance.substring(0, 50)}${params.utterance.length > 50 ? '...' : ''}"`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Say] Error:`, error);
      return {
        type: "say",
        success: false,
        utterance: params.utterance,
        error: errorMessage,
        message: `Failed to generate speech: ${errorMessage}`,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE QUERY HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List all database tables and their schemas
   */
  private async executeDbTables(toolCall: ToolCall): Promise<unknown> {
    try {
      const { db } = await import("../db");
      
      // Query PostgreSQL information_schema for table info
      const tablesResult = await db.execute(`
        SELECT 
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position
      `);

      // Group columns by table
      const tables: Record<string, { columns: Array<{ name: string; type: string; nullable: boolean; default: string | null }> }> = {};
      
      for (const row of tablesResult.rows as any[]) {
        const tableName = row.table_name;
        if (!tables[tableName]) {
          tables[tableName] = { columns: [] };
        }
        tables[tableName].columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default
        });
      }

      return {
        type: "db_tables",
        success: true,
        tables,
        tableCount: Object.keys(tables).length,
        message: `Found ${Object.keys(tables).length} tables in the database`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        type: "db_tables",
        success: false,
        error: errorMessage,
        message: `Failed to list tables: ${errorMessage}`
      };
    }
  }

  /**
   * Execute a read-only SQL SELECT query
   */
  private async executeDbQuery(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { query: string; limit?: number };
    
    if (!params.query) {
      throw new Error("db_query tool requires 'query' parameter");
    }

    // Security: Only allow SELECT queries
    const normalizedQuery = params.query.trim().toUpperCase();
    if (!normalizedQuery.startsWith('SELECT')) {
      return {
        type: "db_query",
        success: false,
        error: "Only SELECT queries are allowed for safety",
        message: "Query rejected: Only SELECT queries are permitted. Use db_tables to see available tables."
      };
    }

    // Block dangerous operations even if they start with SELECT
    const dangerousPatterns = [
      /INTO\s+/i,        // SELECT INTO
      /UPDATE\s+/i,      // Subquery with UPDATE
      /DELETE\s+/i,      // Subquery with DELETE
      /INSERT\s+/i,      // Subquery with INSERT
      /DROP\s+/i,        // DROP
      /TRUNCATE\s+/i,    // TRUNCATE
      /ALTER\s+/i,       // ALTER
      /CREATE\s+/i,      // CREATE
      /GRANT\s+/i,       // GRANT
      /REVOKE\s+/i,      // REVOKE
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(params.query)) {
        return {
          type: "db_query",
          success: false,
          error: "Query contains forbidden operations",
          message: "Query rejected: Contains potentially dangerous operations. Only pure SELECT queries are allowed."
        };
      }
    }

    try {
      const { db } = await import("../db");
      
      // Apply limit (default 100, max 1000)
      const limit = Math.min(params.limit || 100, 1000);
      let queryToExecute = params.query;
      
      // Add LIMIT if not present
      if (!normalizedQuery.includes('LIMIT')) {
        queryToExecute = `${params.query} LIMIT ${limit}`;
      }

      console.log(`[DB Query] Executing: ${queryToExecute.substring(0, 100)}...`);
      
      const result = await db.execute(queryToExecute);
      
      return {
        type: "db_query",
        success: true,
        rows: result.rows,
        rowCount: result.rows.length,
        query: params.query,
        message: `Query returned ${result.rows.length} rows`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DB Query] Error:`, error);
      return {
        type: "db_query",
        success: false,
        error: errorMessage,
        query: params.query,
        message: `Query failed: ${errorMessage}`
      };
    }
  }

  /**
   * Insert a new row into a database table
   */
  private async executeDbInsert(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { table: string; data: Record<string, unknown> };
    
    if (!params.table) {
      throw new Error("db_insert tool requires 'table' parameter");
    }
    if (!params.data || typeof params.data !== 'object') {
      throw new Error("db_insert tool requires 'data' parameter as an object");
    }

    // Sanitize table name (only allow alphanumeric and underscore)
    const tableName = params.table.replace(/[^a-zA-Z0-9_]/g, '');
    if (tableName !== params.table) {
      return {
        type: "db_insert",
        success: false,
        error: "Invalid table name",
        message: "Table name contains invalid characters. Only letters, numbers, and underscores are allowed."
      };
    }

    try {
      const { db } = await import("../db");
      
      // Build parameterized INSERT query
      const columns = Object.keys(params.data);
      const values = Object.values(params.data);
      
      if (columns.length === 0) {
        return {
          type: "db_insert",
          success: false,
          error: "Empty data object",
          message: "No data provided to insert"
        };
      }

      // Sanitize column names
      const sanitizedColumns = columns.map(col => col.replace(/[^a-zA-Z0-9_]/g, ''));
      if (sanitizedColumns.some((col, i) => col !== columns[i])) {
        return {
          type: "db_insert",
          success: false,
          error: "Invalid column name",
          message: "Column names contain invalid characters"
        };
      }

      // Build parameterized query with $1, $2, etc.
      const columnList = sanitizedColumns.map(c => `"${c}"`).join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) RETURNING *`;

      console.log(`[DB Insert] Table: ${tableName}, Columns: ${columns.join(', ')}`);
      
      const result = await db.execute({
        text: query,
        values: values
      } as any);
      
      return {
        type: "db_insert",
        success: true,
        table: tableName,
        insertedRow: result.rows[0],
        message: `Successfully inserted row into ${tableName}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DB Insert] Error:`, error);
      return {
        type: "db_insert",
        success: false,
        error: errorMessage,
        table: params.table,
        message: `Insert failed: ${errorMessage}`
      };
    }
  }

  /**
   * Delete rows from a database table with required WHERE clause
   */
  private async executeDbDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { table: string; where: Record<string, unknown>; limit?: number };
    
    if (!params.table) {
      throw new Error("db_delete tool requires 'table' parameter");
    }
    if (!params.where || typeof params.where !== 'object' || Object.keys(params.where).length === 0) {
      return {
        type: "db_delete",
        success: false,
        error: "WHERE clause required",
        message: "Delete requires a non-empty 'where' condition to prevent accidental mass deletion. Example: {\"id\": 123}"
      };
    }

    // Sanitize table name
    const tableName = params.table.replace(/[^a-zA-Z0-9_]/g, '');
    if (tableName !== params.table) {
      return {
        type: "db_delete",
        success: false,
        error: "Invalid table name",
        message: "Table name contains invalid characters"
      };
    }

    try {
      const { db } = await import("../db");
      
      // Build parameterized WHERE clause
      const whereColumns = Object.keys(params.where);
      const whereValues = Object.values(params.where);
      
      // Sanitize column names
      const sanitizedColumns = whereColumns.map(col => col.replace(/[^a-zA-Z0-9_]/g, ''));
      if (sanitizedColumns.some((col, i) => col !== whereColumns[i])) {
        return {
          type: "db_delete",
          success: false,
          error: "Invalid column name in where clause",
          message: "Column names contain invalid characters"
        };
      }

      // Build WHERE conditions with $1, $2, etc.
      const whereConditions = sanitizedColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');
      
      // Apply limit (default 1, max 100 for safety)
      const limit = Math.min(params.limit || 1, 100);
      
      // First, count how many rows will be affected
      const countQuery = `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereConditions}`;
      const countResult = await db.execute({
        text: countQuery,
        values: whereValues
      } as any);
      const affectedCount = parseInt((countResult.rows[0] as any).count, 10);
      
      if (affectedCount === 0) {
        return {
          type: "db_delete",
          success: true,
          table: tableName,
          deletedCount: 0,
          message: `No rows matched the where condition in ${tableName}`
        };
      }

      if (affectedCount > limit) {
        return {
          type: "db_delete",
          success: false,
          error: "Too many rows would be deleted",
          table: tableName,
          wouldDelete: affectedCount,
          limit: limit,
          message: `Would delete ${affectedCount} rows but limit is ${limit}. Increase limit parameter or narrow your where condition.`
        };
      }

      // Execute the delete
      const deleteQuery = `DELETE FROM "${tableName}" WHERE ${whereConditions}`;
      console.log(`[DB Delete] Table: ${tableName}, Where: ${JSON.stringify(params.where)}, Rows: ${affectedCount}`);
      
      const result = await db.execute({
        text: deleteQuery,
        values: whereValues
      } as any);
      
      return {
        type: "db_delete",
        success: true,
        table: tableName,
        deletedCount: affectedCount,
        message: `Successfully deleted ${affectedCount} row(s) from ${tableName}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DB Delete] Error:`, error);
      return {
        type: "db_delete",
        success: false,
        error: errorMessage,
        table: params.table,
        message: `Delete failed: ${errorMessage}`
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CODEBASE ANALYSIS HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Analyze a codebase - crawl files, extract entities, ingest to RAG
   */
  private async executeCodebaseAnalyze(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { path?: string };
    const rootPath = params.path || ".";
    
    try {
      const { codebaseAnalyzer } = await import("./codebase-analyzer");
      
      // Start analysis (may take time for large codebases)
      // Skip RAG ingestion for external codebases (paths outside the project)
      // Check if resolved path is outside current working directory
      const resolvedPath = path.resolve(rootPath);
      const cwd = process.cwd();
      const isExternal = resolvedPath !== cwd && !resolvedPath.startsWith(cwd + path.sep);
      
      const result = await codebaseAnalyzer.analyzeCodebase(rootPath, isExternal);
      
      // Convert Map to object for JSON serialization
      const glossaryObj = Object.fromEntries(result.glossary);
      
      return {
        type: "codebase_analyze",
        success: true,
        rootPath: result.rootPath,
        totalFiles: result.totalFiles,
        totalEntities: result.totalEntities,
        totalChunks: result.totalChunks,
        duration: result.duration,
        errors: result.errors,
        glossary: glossaryObj,
        message: `Analysis complete: ${result.totalFiles} files, ${result.totalEntities} entities found in ${Math.round(result.duration / 1000)}s`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Codebase Analyze] Error:", error);
      return {
        type: "codebase_analyze",
        success: false,
        error: errorMessage,
        message: `Failed to analyze codebase: ${errorMessage}`
      };
    }
  }

  /**
   * Get current progress of codebase analysis
   */
  private async executeCodebaseProgress(toolCall: ToolCall): Promise<unknown> {
    try {
      const { codebaseAnalyzer } = await import("./codebase-analyzer");
      const progress = codebaseAnalyzer.getProgress();
      
      const percentComplete = progress.filesDiscovered > 0 
        ? Math.round((progress.filesProcessed / progress.filesDiscovered) * 100) 
        : 0;
      
      return {
        type: "codebase_progress",
        success: true,
        progress: {
          phase: progress.phase,
          filesDiscovered: progress.filesDiscovered,
          filesProcessed: progress.filesProcessed,
          entitiesFound: progress.entitiesFound,
          chunksIngested: progress.chunksIngested,
          currentFile: progress.currentFile,
          errors: progress.errors,
          percentComplete
        },
        message: `Analysis phase: ${progress.phase} (${progress.filesProcessed}/${progress.filesDiscovered} files processed)`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Codebase Progress] Error:", error);
      return {
        type: "codebase_progress",
        success: false,
        error: errorMessage,
        message: `Failed to get progress: ${errorMessage}`
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SSH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeSshKeyGenerate(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { name: string; comment?: string };
    const result = await sshService.generateSshKey(params.name, params.comment);
    return {
      type: "ssh_key_generate",
      success: true,
      name: result.name,
      publicKey: result.publicKey,
      privateKeySecretName: result.privateKeySecretName,
      fingerprint: result.fingerprint,
      privateKey: result.privateKey,
      instructions: result.instructions
    };
  }

  private async executeSshKeyList(toolCall: ToolCall): Promise<unknown> {
    const keys = await sshService.listSshKeys();
    return {
      type: "ssh_key_list",
      success: true,
      keys: keys.map(k => ({
        name: k.name,
        publicKey: k.publicKey,
        keyType: k.keyType,
        fingerprint: k.fingerprint,
        secretName: k.privateKeySecretName,
        createdAt: k.createdAt
      }))
    };
  }

  private async executeSshHostAdd(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      alias: string;
      hostname: string;
      username: string;
      port?: number;
      keySecretName?: string;
      passwordSecretName?: string;
      description?: string;
      tags?: string[];
    };
    const host = await sshService.addSshHost({
      alias: params.alias,
      hostname: params.hostname,
      username: params.username,
      port: params.port || 22,
      keySecretName: params.keySecretName,
      passwordSecretName: params.passwordSecretName,
      description: params.description,
      tags: params.tags
    });
    return {
      type: "ssh_host_add",
      success: true,
      host: {
        alias: host.alias,
        hostname: host.hostname,
        port: host.port,
        username: host.username
      },
      message: `SSH host "${params.alias}" added successfully`
    };
  }

  private async executeSshHostList(toolCall: ToolCall): Promise<unknown> {
    const hosts = await sshService.listSshHosts();
    return {
      type: "ssh_host_list",
      success: true,
      hosts: hosts.map(h => ({
        alias: h.alias,
        hostname: h.hostname,
        port: h.port,
        username: h.username,
        description: h.description,
        tags: h.tags,
        lastConnected: h.lastConnected,
        lastError: h.lastError
      }))
    };
  }

  private async executeSshHostDelete(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { alias: string };
    await sshService.deleteSshHost(params.alias);
    return {
      type: "ssh_host_delete",
      success: true,
      alias: params.alias,
      message: `SSH host "${params.alias}" removed`
    };
  }

  private async executeSshConnect(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { alias: string };
    const result = await sshService.connectSsh(params.alias);
    return {
      type: "ssh_connect",
      success: result.success,
      alias: params.alias,
      message: result.message
    };
  }

  private async executeSshDisconnect(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { alias: string };
    await sshService.disconnectSsh(params.alias);
    return {
      type: "ssh_disconnect",
      success: true,
      alias: params.alias,
      message: `Disconnected from ${params.alias}`
    };
  }

  private async executeSshExecute(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as { alias: string; command: string };
    const result = await sshService.executeSshCommand(params.alias, params.command);
    return {
      type: "ssh_execute",
      success: result.exitCode === 0,
      host: params.alias,
      command: params.command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  }

  private async executeSshStatus(toolCall: ToolCall): Promise<unknown> {
    const activeConnections = sshService.getActiveConnections();
    const allHosts = await sshService.listSshHosts();
    return {
      type: "ssh_status",
      success: true,
      activeConnections,
      hosts: allHosts.map(h => ({
        alias: h.alias,
        connected: activeConnections.includes(h.alias),
        lastConnected: h.lastConnected,
        lastError: h.lastError
      }))
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 CORE PRIMITIVE: SSH
  // Unified persistent SSH connection interface
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * V2 ssh primitive - Unified SSH interface
   * 
   * Actions:
   * - connect: Establish persistent connection
   * - exec: Execute command (auto-connects if needed)
   * - disconnect: Close connection
   * - status: List active connections
   */
  private async executeSshPrimitive(toolCall: ToolCall): Promise<unknown> {
    const params = toolCall.parameters as {
      host?: string;
      command?: string;
      action?: "connect" | "exec" | "disconnect" | "status";
    };

    // Infer action from parameters if not specified
    const action = params.action || (params.command ? "exec" : "status");

    try {
      switch (action) {
        case "connect": {
          if (!params.host) {
            throw new Error("host is required for 'connect' action");
          }
          const result = await sshService.connectSsh(params.host);
          return {
            type: "ssh",
            action: "connect",
            success: true,
            host: params.host,
            message: result.message,
          };
        }

        case "exec": {
          if (!params.host) {
            throw new Error("host is required for 'exec' action");
          }
          if (!params.command) {
            throw new Error("command is required for 'exec' action");
          }

          // Auto-connect if not connected
          if (!sshService.isConnected(params.host)) {
            await sshService.connectSsh(params.host);
          }

          const result = await sshService.executeSshCommand(params.host, params.command);
          return {
            type: "ssh",
            action: "exec",
            success: result.exitCode === 0,
            host: params.host,
            command: params.command,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          };
        }

        case "disconnect": {
          if (!params.host) {
            throw new Error("host is required for 'disconnect' action");
          }
          await sshService.disconnectSsh(params.host);
          return {
            type: "ssh",
            action: "disconnect",
            success: true,
            host: params.host,
            message: `Disconnected from ${params.host}`,
          };
        }

        case "status": {
          const activeConnections = sshService.getActiveConnections();
          const allHosts = await sshService.listSshHosts();
          return {
            type: "ssh",
            action: "status",
            success: true,
            activeConnections,
            hosts: allHosts.map(h => ({
              alias: h.alias,
              connected: activeConnections.includes(h.alias),
              hostname: h.hostname,
              port: h.port,
              lastConnected: h.lastConnected,
              lastError: h.lastError,
            })),
          };
        }

        default:
          throw new Error(`Unknown ssh action: ${action}`);
      }
    } catch (error: any) {
      return {
        type: "ssh",
        action,
        success: false,
        host: params.host,
        error: error.message,
      };
    }
  }
}

export const ragDispatcher = new RAGDispatcher();
