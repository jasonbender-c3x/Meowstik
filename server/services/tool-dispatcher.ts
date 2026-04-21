
/**
 * =============================================================================
 * MEOWSTIC CHAT - TOOL DISPATCHER SERVICE
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
 */

import { storage } from "../storage";
import { webSearch, formatSearchResult } from "../integrations/web-search";
import {
  structuredLLMResponseSchema,
  type StructuredLLMResponse,
  type ToolCall,
  type FileOperation,
  type BinaryFileOperation,
  type AutoexecScript,
  insertTodoItemSchema,
  type TodoItem,
  httpGetParamsSchema,
  httpPostParamsSchema,
  httpPutParamsSchema,
  copilotSendReportParamsSchema,
  GUEST_USER_ID,
} from "@shared/schema";
import { httpGet, httpPost, httpPut, type HttpResponse } from "../integrations/http-client";
import * as googleTasks from "../integrations/google-tasks";
import * as gmail from "../integrations/gmail";
import * as googleCalendar from "../integrations/google-calendar";
import * as googleDrive from "../integrations/google-drive";
import * as googleDocs from "../integrations/google-docs";
import * as googleSheets from "../integrations/google-sheets";
import * as googleContacts from "../integrations/google-contacts";
import * as github from "../integrations/github";
import * as twilio from "../integrations/twilio";
import * as sshService from "./ssh-service";
import * as arduino from "../integrations/arduino";
import * as adb from "../integrations/adb";
import * as fileQueue from "./file-queue";
import * as petoi from "../integrations/petoi";
import * as printer3d from "../integrations/printer3d";
import * as kicad from "../integrations/kicad";
import * as chromecast from "./chromecast-service";
import * as camera from "./camera-service";
import { clientRouter } from "./client-router";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { BrowserContext, Page } from "playwright";
import { z } from "zod";
import { copilotService } from "./copilot-service";
import { mcpService } from "./mcp-service";

const execAsync = promisify(exec);

export class ToolDispatcher {
  private readonly workspaceDir: string;
  private sseResponse?: any;
  private browserContext?: BrowserContext;
  private browserPage?: Page;

  constructor() {
    this.workspaceDir = process.cwd();
  }
  
  setSseResponse(res: any) {
    this.sseResponse = res;
  }

  private normalizeToolType(toolType: string): string {
    switch (toolType) {
      case "terminal_execute":
        return "terminal";
      case "file_get":
        return "get";
      case "file_put":
        return "put";
      case "send_chat":
        return "write";
      case "file_append":
      case "log_append":
        return "append";
      default:
        return toolType;
    }
  }
  
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
        console.error('[ToolDispatcher] Failed to emit SSE event:', error);
      }
    }
  }

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

    if (structured.toolCalls && structured.toolCalls.length > 0) {
      for (const toolCall of structured.toolCalls) {
        const result = await this.executeToolCall(toolCall, messageId);
        toolResults.push(result);
        if (!result.success && result.error) {
          errors.push(`Tool ${toolCall.id}: ${result.error}`);
        }
      }
    }

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

  async executeToolCall(toolCall: ToolCall, messageId?: string, chatId?: string): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let taskId: string | null = null;
    let toolCallLogId: string | null = null;

    try {
      let resolvedMessageId = messageId;
      if (!resolvedMessageId && chatId) {
        const existingMessages = await storage.getMessages(chatId);
        resolvedMessageId = existingMessages.at(-1)?.id;

        if (!resolvedMessageId) {
          const placeholderMessage = await storage.addMessage({
            chatId,
            role: "assistant",
            content: "[System] Tool execution context restored.",
          });
          resolvedMessageId = placeholderMessage.id;
        }

        console.warn(
          `[ToolDispatcher] Missing messageId for tool "${toolCall.type}". Recovered using chat ${chatId} message ${resolvedMessageId}.`,
        );
      }

      if (!resolvedMessageId) {
        throw new Error(`Tool execution requires a messageId (tool: ${toolCall.type})`);
      }

      const task = await storage.createToolTask({
        messageId: resolvedMessageId,
        taskType: toolCall.type,
        payload: toolCall,
        status: "running"
      });
      taskId = task.id;
      
      if (chatId) {
        const toolCallLog = await storage.createToolCallLog({
          chatId,
          messageId: resolvedMessageId,
          toolCallId: toolCall.id,
          toolType: toolCall.type,
          status: "pending",
          request: toolCall.parameters,
        });
        toolCallLogId = toolCallLog.id;
        
        this.emitToolCallEvent({
          type: 'tool_call_start',
          toolCallId: toolCall.id,
          toolType: toolCall.type,
          data: { id: toolCallLogId, request: toolCall.parameters },
        });
      }

      let result: unknown;
      const normalizedToolType = this.normalizeToolType(toolCall.type);

      switch (normalizedToolType) {
        case "web_search": result = await this.executeWebSearch(toolCall); break;
        case "terminal": result = await this.executeTerminal(toolCall); break;
        case "get": result = await this.executeFileGet(toolCall); break;
        case "put": result = await this.executeFilePut(toolCall); break;
        case "append": case "log": result = await this.executeAppend(toolCall); break;
        case "gmail_list": result = await this.executeGmailList(toolCall); break;
        case "gmail_read": result = await this.executeGmailRead(toolCall); break;
        case "gmail_search": result = await this.executeGmailSearch(toolCall); break;
        case "gmail_send": result = await this.executeGmailSend(toolCall); break;
        case "drive_list": result = await this.executeDriveList(toolCall); break;
        case "drive_read": result = await this.executeDriveRead(toolCall); break;
        case "drive_search": result = await this.executeDriveSearch(toolCall); break;
        case "drive_create": result = await this.executeDriveCreate(toolCall); break;
        case "drive_update": result = await this.executeDriveUpdate(toolCall); break;
        case "drive_delete": result = await this.executeDriveDelete(toolCall); break;
        case "calendar_list": result = await this.executeCalendarList(); break;
        case "calendar_events": result = await this.executeCalendarEvents(toolCall); break;
        case "calendar_create": result = await this.executeCalendarCreate(toolCall); break;
        case "calendar_update": result = await this.executeCalendarUpdate(toolCall); break;
        case "calendar_delete": result = await this.executeCalendarDelete(toolCall); break;
        case "docs_read": result = await this.executeDocsRead(toolCall); break;
        case "docs_create": result = await this.executeDocsCreate(toolCall); break;
        case "docs_append": result = await this.executeDocsAppend(toolCall); break;
        case "docs_replace": result = await this.executeDocsReplace(toolCall); break;
        case "sheets_read": result = await this.executeSheetsRead(toolCall); break;
        case "sheets_write": result = await this.executeSheetsWrite(toolCall); break;
        case "sheets_append": result = await this.executeSheetsAppend(toolCall); break;
        case "sheets_create": result = await this.executeSheetsCreate(toolCall); break;
        case "sheets_clear": result = await this.executeSheetsClear(toolCall); break;
        case "contacts_list": result = await this.executeContactsList(toolCall); break;
        case "contacts_search": result = await this.executeContactsSearch(toolCall); break;
        case "contacts_create": result = await this.executeContactsCreate(toolCall); break;
        case "contacts_update": result = await this.executeContactsUpdate(toolCall); break;
        case "db_tables": result = await this.executeDbTables(toolCall); break;
        case "db_query": result = await this.executeDbQuery(toolCall); break;
        case "db_insert": result = await this.executeDbInsert(toolCall); break;
        case "db_delete": result = await this.executeDbDelete(toolCall); break;
        case "say": result = await this.executeSay(toolCall); break;
        case "soundboard": result = this.executeSoundboard(toolCall); break;
        case "exa_search": result = await this.executeExaSearch(toolCall); break;
        case "puppeteer_navigate": result = await this.executePuppeteerNavigate(toolCall); break;
        case "puppeteer_click": result = await this.executePuppeteerClick(toolCall); break;
        case "puppeteer_type": result = await this.executePuppeteerType(toolCall); break;
        case "puppeteer_screenshot": result = await this.executePuppeteerScreenshot(toolCall); break;
        case "puppeteer_evaluate": result = await this.executePuppeteerEvaluate(toolCall); break;
        case "puppeteer_content": result = await this.executePuppeteerContent(toolCall); break;
        case "http_get": result = await this.executeHttpGet(toolCall); break;
        case "http_post": result = await this.executeHttpPost(toolCall); break;
        case "http_put": result = await this.executeHttpPut(toolCall); break;
        case "http_patch": result = await this.executeHttpPatch(toolCall); break;
        case "http_delete": result = await this.executeHttpDelete(toolCall); break;
        case "sms_send": result = await this.executeSmsSend(toolCall); break;
        case "sms_list": result = await this.executeSmsList(toolCall); break;
        case "call_make": result = await this.executeCallMake(toolCall); break;
        case "call_list": result = await this.executeCallList(toolCall); break;
        case "set_mood_light": result = await this.executeSetMoodLight(toolCall); break;
        case "computer_click":
        case "computer_type":
        case "computer_key":
        case "computer_scroll":
        case "computer_move":
        case "computer_screenshot":
        case "computer_wait":
          result = await this.executeComputerTool(toolCall);
          break;
        case "cast": result = await this.executeCast(toolCall); break;
        case "camera": result = await this.executeCamera(toolCall); break;
        case "todo_list": result = await this.executeTodoList(toolCall, chatId); break;
        case "todo_add": result = await this.executeTodoAdd(toolCall, chatId); break;
        case "todo_update": result = await this.executeTodoUpdate(toolCall, chatId); break;
        case "todo_complete": result = await this.executeTodoComplete(toolCall, chatId); break;
        case "todo_remove": result = await this.executeTodoRemove(toolCall, chatId); break;
        case "mcp_list_servers": result = await this.executeMcpListServers(chatId); break;
        case "mcp_list_tools": result = await this.executeMcpListTools(toolCall, chatId); break;
        case "mcp_call": result = await this.executeMcpCall(toolCall, chatId); break;
        case "tasks_list": result = await this.executeTasksList(toolCall); break;
        case "tasks_create": result = await this.executeTasksCreate(toolCall); break;
        case "tasks_update": result = await this.executeTasksUpdate(toolCall); break;
        case "tasks_complete": result = await this.executeTasksComplete(toolCall); break;
        case "tasks_delete": result = await this.executeTasksDelete(toolCall); break;
        case "schedule_list": result = await this.executeScheduleList(toolCall); break;
        case "schedule_create": result = await this.executeScheduleCreate(toolCall, chatId); break;
        case "schedule_toggle": result = await this.executeScheduleToggle(toolCall); break;
        case "schedule_delete": result = await this.executeScheduleDelete(toolCall); break;
        case "end_turn": result = { success: true, shouldEndTurn: true }; break;
        case "write": {
          const { content } = toolCall.parameters as { content?: string };
          result = { content: content || "", success: true };
          break;
        }
        default:
          console.warn(`[ToolDispatcher] Unknown tool type "${toolCall.type}" (normalized: "${normalizedToolType}")`);
          throw new Error(`Unknown tool type: ${toolCall.type}`);
      }

      if (taskId) await storage.updateToolTaskStatus(taskId, "completed", result as any);
      
      if (toolCallLogId && chatId) {
        const duration = Date.now() - startTime;
        await storage.updateToolCallLog(toolCallLogId, {
          status: "success",
          response: result as any,
          completedAt: new Date(),
          duration,
        });
        this.emitToolCallEvent({
          type: 'tool_call_success',
          toolCallId: toolCall.id,
          toolType: toolCall.type,
          data: { id: toolCallLogId, duration },
        });
      }

      return {
        toolId: toolCall.id,
        type: toolCall.type,
        success: true,
        result,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      if (taskId) await storage.updateToolTaskStatus(taskId, "failed", undefined, error.message);
      if (toolCallLogId && chatId) {
        const duration = Date.now() - startTime;
        await storage.updateToolCallLog(toolCallLogId, {
          status: "failure",
          errorMessage: error.message,
          completedAt: new Date(),
          duration,
        });
        this.emitToolCallEvent({
          type: 'tool_call_failure',
          toolCallId: toolCall.id,
          toolType: toolCall.type,
          data: { id: toolCallLogId, error: error.message, duration },
        });
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

  // Database tools - SQLite optimized
  private async executeDbTables(toolCall: ToolCall): Promise<unknown> {
    try {
      const { rawDb } = await import("../db");
      const tablesList = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
      const tables: Record<string, any> = {};
      for (const table of tablesList) {
        const columns = rawDb.prepare(`PRAGMA table_info("${table.name}")`).all();
        tables[table.name] = { columns };
      }
      return { type: "db_tables", success: true, tables };
    } catch (error: any) {
      return { type: "db_tables", success: false, error: error.message };
    }
  }

  private async executeDbQuery(toolCall: ToolCall): Promise<unknown> {
    try {
      const { rawDb } = await import("../db");
      const { query } = toolCall.parameters as { query: string };
      if (!query.trim().toUpperCase().startsWith("SELECT")) throw new Error("Only SELECT queries allowed");
      const rows = rawDb.prepare(query).all();
      return { type: "db_query", success: true, rows };
    } catch (error: any) {
      return { type: "db_query", success: false, error: error.message };
    }
  }

  private async executeDbInsert(toolCall: ToolCall): Promise<unknown> {
    try {
      const { rawDb } = await import("../db");
      const { table, data } = toolCall.parameters as { table: string, data: any };
      const cols = Object.keys(data).map(c => `"${c}"`).join(", ");
      const placeholders = Object.keys(data).map(() => "?").join(", ");
      const vals = Object.values(data);
      const query = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`;
      const insertedRow = rawDb.prepare(query).get(...vals);
      return { type: "db_insert", success: true, insertedRow };
    } catch (error: any) {
      return { type: "db_insert", success: false, error: error.message };
    }
  }

  private async executeDbDelete(toolCall: ToolCall): Promise<unknown> {
    try {
      const { rawDb } = await import("../db");
      const { table, where } = toolCall.parameters as { table: string, where: any };
      const conditions = Object.keys(where).map(c => `"${c}" = ?`).join(" AND ");
      const vals = Object.values(where);
      const query = `DELETE FROM "${table}" WHERE ${conditions}`;
      rawDb.prepare(query).run(...vals);
      return { type: "db_delete", success: true };
    } catch (error: any) {
      return { type: "db_delete", success: false, error: error.message };
    }
  }

  // Placeholder implementations for basic tools
  private async executeWebSearch(toolCall: ToolCall) { return webSearch(toolCall.parameters as any); }
  private async executeTerminal(toolCall: ToolCall) {
    const { command } = toolCall.parameters as { command: string };
    const { stdout, stderr } = await execAsync(command);
    return { stdout, stderr };
  }
  private async executeFileGet(toolCall: ToolCall) {
    const { path: filePath } = toolCall.parameters as { path: string };
    const { target, path: resolvedPath } = this.parseToolPath(filePath);

    if (target === "editor") {
      throw new Error("Reading editor canvas content is not supported from the server runtime");
    }

    if (target === "client") {
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error("No desktop agent connected. Please start the Meowstik desktop app on your computer.");
      }

      const content = await clientRouter.readFile(resolvedPath);
      return { content, path: resolvedPath, destination: "client" };
    }

    const content = await fs.readFile(resolvedPath, "utf8");
    return { content, path: resolvedPath, destination: "server" };
  }
  private async executeFilePut(toolCall: ToolCall) {
    const { path: filePath, content, mimeType } = toolCall.parameters as {
      path: string;
      content: string;
      mimeType?: string;
    };
    const { target, path: resolvedPath } = this.parseToolPath(filePath);
    const resolvedMimeType = mimeType ?? this.inferMimeType(resolvedPath);

    if (target === "editor") {
      return {
        type: "file_put",
        success: true,
        path: resolvedPath,
        destination: "editor",
        content,
        mimeType: resolvedMimeType,
        message: `File saved to editor canvas: ${resolvedPath}. View at /editor`,
      };
    }

    if (target === "client") {
      if (!clientRouter.hasConnectedAgent()) {
        throw new Error("No desktop agent connected. Please start the Meowstik desktop app on your computer.");
      }

      await clientRouter.writeFile(resolvedPath, content);
      return {
        type: "file_put",
        success: true,
        path: resolvedPath,
        destination: "client",
        content,
        mimeType: resolvedMimeType,
        message: `File written to client: ${resolvedPath}`,
      };
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    if (this.isTextMimeType(resolvedMimeType)) {
      await fs.writeFile(resolvedPath, content, "utf8");
    } else {
      await fs.writeFile(resolvedPath, Buffer.from(content, "base64"));
    }
    return {
      type: "file_put",
      success: true,
      path: resolvedPath,
      destination: "server",
      content,
      mimeType: resolvedMimeType,
    };
  }
  private async executeAppend(toolCall: ToolCall) {
    const { name, content } = toolCall.parameters as { name: string; content: string };
    const normalizedName = this.normalizeLogName(name);
    const logsDir = path.join(this.workspaceDir, "logs");
    const logPath = path.join(logsDir, normalizedName);
    await fs.mkdir(logsDir, { recursive: true });
    await fs.appendFile(logPath, content, "utf8");
    return { success: true, path: logPath };
  }
  private async executeSay(toolCall: ToolCall) {
     const { utterance } = toolCall.parameters as { utterance: string };
      return { success: true, utterance: utterance || "" };
  }

  private executeSoundboard(toolCall: ToolCall) {
    const { sound, volume } = toolCall.parameters as { sound: string; volume?: number };
    return { success: true, sound: sound || "", volume: volume ?? 0.8 };
  }

  private async executeCast(toolCall: ToolCall) {
    const { action, url, device, level } = toolCall.parameters as {
      action: string;
      url?: string;
      device?: string;
      level?: number;
    };
    const dev = device || "Living Room TV";
    try {
      let content: string;
      switch (action) {
        case "cast":
          if (!url) return { content: "url is required for cast action", success: false };
          content = await chromecast.castMedia(dev, url);
          break;
        case "stop":
          content = await chromecast.stopCast(dev);
          break;
        case "volume":
          if (level === undefined) return { content: "level is required for volume action", success: false };
          content = await chromecast.setVolume(dev, level);
          break;
        case "status":
          content = await chromecast.getStatus(dev);
          break;
        case "pause":
          content = await chromecast.pauseCast(dev);
          break;
        case "resume":
          content = await chromecast.resumeCast(dev);
          break;
        case "scan": {
          const devices = await chromecast.scanDevices();
          content = devices.map(d => `${d.ip} - ${d.name} - ${d.model}`).join("\n") || "No devices found";
          break;
        }
        default:
          return { content: `Unknown cast action: ${action}`, success: false };
      }
      return { content, success: true };
    } catch (error: any) {
      return { content: error.message, success: false };
    }
  }

  private async executeCamera(toolCall: ToolCall) {
    const { action, direction, speed, duration } = toolCall.parameters as {
      action: string;
      direction?: string;
      speed?: number;
      duration?: number;
    };
    try {
      let content: string;
      switch (action) {
        case "snapshot":
          content = `Live snapshot: ${camera.getSnapshotUrl()}?t=${Date.now()}\nViewer: open ~/Desktop/camera-live.html in browser`;
          break;
        case "ptz":
          if (!direction) return { content: "direction is required for ptz action", success: false };
          content = await camera.ptzMove(direction, speed ?? 5, duration ?? 500);
          break;
        case "stop":
          content = await camera.ptzStop();
          break;
        default:
          return { content: `Unknown camera action: ${action}`, success: false };
      }
      return { content, success: true };
    } catch (error: any) {
      return { content: error.message, success: false };
    }
  }

  private async executeDriveList(toolCall: ToolCall): Promise<unknown> {
    const { folderId, maxResults } = toolCall.parameters as { folderId?: string; maxResults?: number };
    const query = folderId ? `'${folderId}' in parents and trashed = false` : undefined;
    const files = await googleDrive.listDriveFiles(query, maxResults ?? 20);
    return { success: true, files };
  }

  private async executeDriveRead(toolCall: ToolCall): Promise<unknown> {
    const { fileId } = toolCall.parameters as { fileId: string };
    const content = await googleDrive.getDriveFileContent(fileId);
    return { success: true, fileId, content };
  }

  private async executeDriveSearch(toolCall: ToolCall): Promise<unknown> {
    const { query, maxResults } = toolCall.parameters as { query: string; maxResults?: number };
    const files = await googleDrive.searchDriveFiles(query);
    const sliced = Array.isArray(files) ? files.slice(0, maxResults ?? files.length) : files;
    return { success: true, files: sliced };
  }

  private async executeDriveCreate(toolCall: ToolCall): Promise<unknown> {
    const { name, content, mimeType } = toolCall.parameters as {
      name: string;
      content: string;
      mimeType?: string;
    };
    const file = await googleDrive.createDriveFile(name, content, mimeType ?? "text/plain");
    return { success: true, file };
  }

  private async executeDriveUpdate(toolCall: ToolCall): Promise<unknown> {
    const { fileId, content, mimeType } = toolCall.parameters as {
      fileId: string;
      content: string;
      mimeType?: string;
    };
    const file = await googleDrive.updateDriveFile(fileId, content, mimeType ?? "text/plain");
    return { success: true, file };
  }

  private async executeDriveDelete(toolCall: ToolCall): Promise<unknown> {
    const { fileId } = toolCall.parameters as { fileId: string };
    const result = await googleDrive.deleteDriveFile(fileId);
    return { success: true, ...result };
  }

  private async executeCalendarList(): Promise<unknown> {
    const calendars = await googleCalendar.listCalendars();
    return { success: true, calendars };
  }

  private async executeCalendarEvents(toolCall: ToolCall): Promise<unknown> {
    const { calendarId, timeMin, timeMax, maxResults } = toolCall.parameters as {
      calendarId?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
    };
    const events = await googleCalendar.listEvents(calendarId ?? "primary", timeMin, timeMax, maxResults ?? 20);
    return { success: true, events };
  }

  private async executeCalendarCreate(toolCall: ToolCall): Promise<unknown> {
    const { calendarId, summary, start, end, description, location } = toolCall.parameters as {
      calendarId?: string;
      summary: string;
      start: string;
      end: string;
      description?: string;
      location?: string;
    };
    const event = await googleCalendar.createEvent(
      calendarId ?? "primary",
      summary,
      { dateTime: start },
      { dateTime: end },
      description,
      location,
    );
    return { success: true, event };
  }

  private async executeCalendarUpdate(toolCall: ToolCall): Promise<unknown> {
    const { calendarId, eventId, summary, start, end, description, location } = toolCall.parameters as {
      calendarId?: string;
      eventId: string;
      summary?: string;
      start?: string;
      end?: string;
      description?: string;
      location?: string;
    };
    const event = await googleCalendar.updateEvent(calendarId ?? "primary", eventId, {
      ...(summary !== undefined ? { summary } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(start !== undefined ? { start: { dateTime: start } } : {}),
      ...(end !== undefined ? { end: { dateTime: end } } : {}),
    });
    return { success: true, event };
  }

  private async executeCalendarDelete(toolCall: ToolCall): Promise<unknown> {
    const { calendarId, eventId } = toolCall.parameters as { calendarId?: string; eventId: string };
    const result = await googleCalendar.deleteEvent(calendarId ?? "primary", eventId);
    return { success: true, ...result };
  }

  private async executeDocsRead(toolCall: ToolCall): Promise<unknown> {
    const { documentId } = toolCall.parameters as { documentId: string };
    const document = await googleDocs.getDocumentText(documentId);
    return { success: true, document };
  }

  private async executeDocsCreate(toolCall: ToolCall): Promise<unknown> {
    const { title, content } = toolCall.parameters as { title: string; content?: string };
    const document = await googleDocs.createDocument(title);
    if (content && document && typeof document === "object" && "documentId" in document && typeof document.documentId === "string") {
      await googleDocs.appendText(document.documentId, content);
    }
    return { success: true, document };
  }

  private async executeDocsAppend(toolCall: ToolCall): Promise<unknown> {
    const { documentId, content } = toolCall.parameters as { documentId: string; content: string };
    const result = await googleDocs.appendText(documentId, content);
    return { success: true, result };
  }

  private async executeDocsReplace(toolCall: ToolCall): Promise<unknown> {
    const { documentId, find, replace } = toolCall.parameters as {
      documentId: string;
      find: string;
      replace: string;
    };
    const result = await googleDocs.replaceText(documentId, find, replace);
    return { success: true, result };
  }

  private async executeSheetsRead(toolCall: ToolCall): Promise<unknown> {
    const { spreadsheetId, range } = toolCall.parameters as { spreadsheetId: string; range: string };
    const values = await googleSheets.getSheetValues(spreadsheetId, range);
    return { success: true, values };
  }

  private async executeSheetsWrite(toolCall: ToolCall): Promise<unknown> {
    const { spreadsheetId, range, values } = toolCall.parameters as {
      spreadsheetId: string;
      range: string;
      values: unknown[][];
    };
    const result = await googleSheets.updateSheetValues(spreadsheetId, range, values);
    return { success: true, result };
  }

  private async executeSheetsAppend(toolCall: ToolCall): Promise<unknown> {
    const { spreadsheetId, range, values } = toolCall.parameters as {
      spreadsheetId: string;
      range: string;
      values: unknown[][];
    };
    const result = await googleSheets.appendSheetValues(spreadsheetId, range, values);
    return { success: true, result };
  }

  private async executeSheetsCreate(toolCall: ToolCall): Promise<unknown> {
    const { title, sheetTitles } = toolCall.parameters as { title: string; sheetTitles?: string[] };
    const spreadsheet = await googleSheets.createSpreadsheet(title, sheetTitles);
    return { success: true, spreadsheet };
  }

  private async executeSheetsClear(toolCall: ToolCall): Promise<unknown> {
    const { spreadsheetId, range } = toolCall.parameters as { spreadsheetId: string; range: string };
    const result = await googleSheets.clearSheetRange(spreadsheetId, range);
    return { success: true, result };
  }

  private async executeContactsList(toolCall: ToolCall): Promise<unknown> {
    const { pageSize, pageToken } = toolCall.parameters as { pageSize?: number; pageToken?: string };
    const result = await googleContacts.listContacts(pageSize ?? 100, pageToken);
    return { success: true, ...result };
  }

  private async executeContactsSearch(toolCall: ToolCall): Promise<unknown> {
    const { query, pageSize } = toolCall.parameters as { query: string; pageSize?: number };
    const contacts = await googleContacts.searchContacts(query, pageSize ?? 30);
    return { success: true, contacts };
  }

  private async executeContactsCreate(toolCall: ToolCall): Promise<unknown> {
    const { givenName, familyName, email, phoneNumber } = toolCall.parameters as {
      givenName: string;
      familyName?: string;
      email?: string;
      phoneNumber?: string;
    };
    const contact = await googleContacts.createContact({ givenName, familyName, email, phoneNumber });
    return { success: true, contact };
  }

  private async executeContactsUpdate(toolCall: ToolCall): Promise<unknown> {
    const { resourceName, givenName, familyName, email, phoneNumber } = toolCall.parameters as {
      resourceName: string;
      givenName?: string;
      familyName?: string;
      email?: string;
      phoneNumber?: string;
    };
    const contact = await googleContacts.updateContact(resourceName, {
      givenName,
      familyName,
      email,
      phoneNumber,
    });
    return { success: true, contact };
  }

  private async executeExaSearch(toolCall: ToolCall): Promise<unknown> {
    const { query, maxResults, useAutoprompt, type } = toolCall.parameters as {
      query: string;
      maxResults?: number;
      useAutoprompt?: boolean;
      type?: "neural" | "keyword";
    };
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error("EXA_API_KEY is not configured");
    }
    const { default: Exa } = await import("exa-js");
    const exa = new Exa(apiKey);
    const results = await exa.search(query, {
      numResults: maxResults ?? 10,
      useAutoprompt,
      type,
    });
    return { success: true, results };
  }

  private async executeHttpGet(toolCall: ToolCall): Promise<HttpResponse> {
    const params = httpGetParamsSchema.parse(toolCall.parameters);
    return httpGet(params);
  }

  private async executeHttpPost(toolCall: ToolCall): Promise<HttpResponse> {
    const params = httpPostParamsSchema.parse(toolCall.parameters);
    return httpPost(params);
  }

  private async executeHttpPut(toolCall: ToolCall): Promise<HttpResponse> {
    const params = httpPutParamsSchema.parse(toolCall.parameters);
    return httpPut(params);
  }

  private async executeHttpPatch(toolCall: ToolCall): Promise<HttpResponse> {
    const { url, headers, body, timeout } = toolCall.parameters as {
      url: string;
      headers?: Record<string, string>;
      body?: string | Record<string, unknown>;
      timeout?: number;
    };
    return this.executeHttpRequest("PATCH", url, headers, body, timeout);
  }

  private async executeHttpDelete(toolCall: ToolCall): Promise<HttpResponse> {
    const { url, headers, body, timeout } = toolCall.parameters as {
      url: string;
      headers?: Record<string, string>;
      body?: string | Record<string, unknown>;
      timeout?: number;
    };
    return this.executeHttpRequest("DELETE", url, headers, body, timeout);
  }

  private async executeSmsSend(toolCall: ToolCall): Promise<unknown> {
    const { to, body } = toolCall.parameters as { to: string; body: string };
    const message = await twilio.sendSMS(to, body);
    return { success: true, message };
  }

  private async executeSmsList(toolCall: ToolCall): Promise<unknown> {
    const { limit } = toolCall.parameters as { limit?: number };
    const messages = await twilio.getMessages(limit ?? 20);
    return { success: true, messages };
  }

  private async executeCallMake(toolCall: ToolCall): Promise<unknown> {
    const { to, contact_name: contactName, message, objective } = toolCall.parameters as {
      to?: string;
      contact_name?: string;
      message?: string;
      objective?: string;
    };

    const resolvedPhone = await this.resolveCallTarget(to, contactName);
    if (!resolvedPhone) {
      throw new Error("call_make requires either a phone number or a contact_name with a resolvable phone number");
    }

    const spokenMessage = message ?? objective;
    if (!spokenMessage) {
      throw new Error("call_make currently requires message or objective text");
    }

    const call = await twilio.makeCallWithMessage(resolvedPhone.phoneNumber, spokenMessage);
    return {
      success: true,
      call,
      resolvedTarget: resolvedPhone,
      mode: message ? "message" : "objective",
    };
  }

  private async executeCallList(toolCall: ToolCall): Promise<unknown> {
    const { limit } = toolCall.parameters as { limit?: number };
    const calls = await twilio.getCalls(limit ?? 20);
    return { success: true, calls };
  }

  private async executeSetMoodLight(toolCall: ToolCall): Promise<unknown> {
    const { color, status } = toolCall.parameters as { color?: string; status?: string };
    return {
      success: true,
      color: color ?? "off",
      status: status ?? "off",
      message: "Mood light control remains a stub, but the tool is now dispatched correctly.",
    };
  }

  private async executeComputerTool(toolCall: ToolCall): Promise<unknown> {
    const { computerUseService } = await import("./computer-use");
    switch (toolCall.type) {
      case "computer_click": {
        const { x, y, button } = toolCall.parameters as { x: number; y: number; button?: "left" | "right" | "middle" };
        return computerUseService.executeLocalAction({ type: "click", target: { x, y }, button });
      }
      case "computer_type": {
        const { text } = toolCall.parameters as { text: string };
        return computerUseService.executeLocalAction({ type: "type", text });
      }
      case "computer_key": {
        const { key, modifiers } = toolCall.parameters as { key: string; modifiers?: string[] };
        return computerUseService.executeLocalAction({ type: "key", key, modifiers });
      }
      case "computer_scroll": {
        const { direction, amount } = toolCall.parameters as {
          direction: "up" | "down" | "left" | "right";
          amount?: number;
        };
        return computerUseService.executeLocalAction({ type: "scroll", direction, amount });
      }
      case "computer_move": {
        const { x, y } = toolCall.parameters as { x: number; y: number };
        return computerUseService.executeLocalAction({ type: "move", target: { x, y } });
      }
      case "computer_screenshot":
        return computerUseService.executeLocalAction({ type: "screenshot" });
      case "computer_wait": {
        const { delay } = toolCall.parameters as { delay: number };
        return computerUseService.executeLocalAction({ type: "wait", delay });
      }
      default:
        throw new Error(`Unsupported computer tool: ${toolCall.type}`);
    }
  }

  private async ensureBrowserPage(): Promise<Page> {
    if (this.browserPage && !this.browserPage.isClosed()) {
      return this.browserPage;
    }

    if (this.browserContext) {
      await this.browserContext.close().catch(() => {});
    }

    const { chromium } = await import("playwright");
    this.browserContext = await chromium.launchPersistentContext(path.join(this.workspaceDir, ".local", "tool-dispatcher-browser"), {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      viewport: { width: 1280, height: 720 },
    });

    const pages = this.browserContext.pages();
    this.browserPage = pages[0] ?? await this.browserContext.newPage();
    return this.browserPage;
  }

  private async executePuppeteerNavigate(toolCall: ToolCall): Promise<unknown> {
    const { url, timeout } = toolCall.parameters as { url: string; timeout?: number };
    const page = await this.ensureBrowserPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeout ?? 30000 });
    return { success: true, url: page.url(), title: await page.title() };
  }

  private async executePuppeteerClick(toolCall: ToolCall): Promise<unknown> {
    const { selector, timeout } = toolCall.parameters as { selector: string; timeout?: number };
    const page = await this.ensureBrowserPage();
    await page.click(selector, { timeout: timeout ?? 5000 });
    return { success: true, selector };
  }

  private async executePuppeteerType(toolCall: ToolCall): Promise<unknown> {
    const { selector, text, delay } = toolCall.parameters as { selector: string; text: string; delay?: number };
    const page = await this.ensureBrowserPage();
    await page.locator(selector).fill("");
    await page.type(selector, text, { delay: delay ?? 0 });
    return { success: true, selector, textLength: text.length };
  }

  private async executePuppeteerScreenshot(toolCall: ToolCall): Promise<unknown> {
    const { fullPage } = toolCall.parameters as { fullPage?: boolean };
    const page = await this.ensureBrowserPage();
    const screenshotsDir = path.join(this.workspaceDir, ".local", "tool-dispatcher-screenshots");
    await fs.mkdir(screenshotsDir, { recursive: true });
    const screenshotPath = path.join(screenshotsDir, `screenshot-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: fullPage ?? false });
    return { success: true, path: screenshotPath, fullPage: fullPage ?? false };
  }

  private async executePuppeteerEvaluate(toolCall: ToolCall): Promise<unknown> {
    const { script } = toolCall.parameters as { script: string };
    const page = await this.ensureBrowserPage();
    const result = await page.evaluate((source) => {
      // eslint-disable-next-line no-eval
      return eval(source);
    }, script);
    return { success: true, result };
  }

  private async executePuppeteerContent(toolCall: ToolCall): Promise<unknown> {
    const { format } = toolCall.parameters as { format?: "html" | "text" };
    const page = await this.ensureBrowserPage();
    if (format === "text") {
      return {
        success: true,
        format: "text",
        content: await page.locator("body").innerText(),
      };
    }
    return {
      success: true,
      format: "html",
      content: await page.content(),
    };
  }

  private async executeHttpRequest(
    method: "PATCH" | "DELETE",
    url: string,
    headers?: Record<string, string>,
    body?: string | Record<string, unknown>,
    timeout = 30000,
  ): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const sanitizedHeaders = Object.fromEntries(
        Object.entries(headers ?? {}).map(([key, value]) => [key.replace(/[\r\n\x00-\x1F]/g, ""), value.replace(/[\r\n\x00-\x1F]/g, "")]),
      );
      const response = await fetch(url, {
        method,
        headers: {
          ...(typeof body === "object" && body !== null && !Array.isArray(body) && !Object.keys(sanitizedHeaders).some((key) => key.toLowerCase() === "content-type")
            ? { "Content-Type": "application/json" }
            : {}),
          ...sanitizedHeaders,
        },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : contentType.includes("text/")
          ? await response.text()
          : Buffer.from(await response.arrayBuffer()).toString("base64");
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        contentType: contentType || undefined,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 0,
        statusText: "Error",
        headers: {},
        data: null,
        error: error.name === "AbortError" ? `HTTP ${method} failed: Request timeout after ${timeout}ms` : `HTTP ${method} failed: ${error.message}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async resolveCallTarget(to?: string, contactName?: string): Promise<{ phoneNumber: string; contactName?: string } | null> {
    if (to) {
      return { phoneNumber: to, contactName };
    }

    if (!contactName) {
      return null;
    }

    const matches = await googleContacts.searchContacts(contactName, 5);
    const phoneMatch = matches.find((contact) => contact.phoneNumbers.length > 0);
    if (!phoneMatch) {
      return null;
    }

    return {
      phoneNumber: phoneMatch.phoneNumbers[0],
      contactName: phoneMatch.displayName,
    };
  }

  private async getUserIdFromChat(chatId?: number | string): Promise<string | undefined> {
    if (!chatId) return undefined;
    const chat = await storage.getChat(String(chatId));
    return chat?.userId ?? undefined;
  }

  private inferMimeType(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
      case ".json":
        return "application/json";
      case ".xml":
        return "application/xml";
      case ".svg":
        return "image/svg+xml";
      case ".html":
        return "text/html";
      case ".md":
        return "text/markdown";
      default:
        return "text/plain";
    }
  }

  private parseToolPath(filePath: string): { target: "server" | "client" | "editor"; path: string } {
    if (filePath.startsWith("client:")) {
      return { target: "client", path: filePath.slice("client:".length) };
    }

    if (filePath.startsWith("editor:")) {
      return { target: "editor", path: filePath.slice("editor:".length) };
    }

    if (filePath.startsWith("server:")) {
      return { target: "server", path: filePath.slice("server:".length) };
    }

    return { target: "server", path: filePath };
  }

  private isTextMimeType(mimeType: string): boolean {
    return mimeType.startsWith("text/") || [
      "application/json",
      "application/xml",
      "application/javascript",
      "application/typescript",
      "image/svg+xml",
    ].includes(mimeType);
  }

  private normalizeLogName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Log name is required");
    }

    const basename = path.basename(trimmed).replace(/[^a-zA-Z0-9._-]/g, "_");
    return basename.endsWith(".md") ? basename : `${basename}.md`;
  }

  private async writeTodoCache(userId: string): Promise<void> {
    const todos = await storage.getPendingTodoItems(userId);
    const logsDir = path.join(this.workspaceDir, "logs");
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(path.join(logsDir, "todo.md"), this.formatTodoListAsMarkdown(todos), "utf8");
  }

  private formatTodoListAsMarkdown(todos: TodoItem[]): string {
    if (todos.length === 0) {
      return "# To-Do List\n\n*(No items)*\n";
    }

    let content = "# To-Do List\n\n";
    content += `*Last updated: ${new Date().toISOString()}*\n\n`;

    const pending = todos.filter((todo) => todo.status === "pending");
    const inProgress = todos.filter((todo) => todo.status === "in_progress");
    const blocked = todos.filter((todo) => todo.status === "blocked");

    if (inProgress.length > 0) {
      content += "## 🚧 In Progress\n\n";
      for (const todo of inProgress) {
        content += this.formatTodoItem(todo);
      }
      content += "\n";
    }

    if (pending.length > 0) {
      content += "## 📋 Pending\n\n";
      for (const todo of pending) {
        content += this.formatTodoItem(todo);
      }
      content += "\n";
    }

    if (blocked.length > 0) {
      content += "## 🚫 Blocked\n\n";
      for (const todo of blocked) {
        content += this.formatTodoItem(todo);
      }
    }

    return content;
  }

  private formatTodoItem(todo: TodoItem): string {
    let content = `### ${todo.title}\n`;
    content += `- **ID:** \`${todo.id}\`\n`;
    content += `- **Priority:** ${todo.priority}\n`;

    if (todo.description) {
      content += `- **Description:** ${todo.description}\n`;
    }

    if (todo.category) {
      content += `- **Category:** ${todo.category}\n`;
    }

    if (todo.tags && todo.tags.length > 0) {
      content += `- **Tags:** ${todo.tags.join(", ")}\n`;
    }

    content += "\n";
    return content;
  }

  private async getUserIdForMcp(chatId?: number | string): Promise<string> {
    return (await this.getUserIdFromChat(chatId)) ?? GUEST_USER_ID;
  }

  private async executeMcpListServers(chatId?: number | string): Promise<unknown> {
    try {
      const userId = await this.getUserIdForMcp(chatId);
      const servers = await mcpService.listEnabledServers(userId);
      return {
        success: true,
        servers: servers.map((server) => ({
          id: server.id,
          name: server.name,
          slug: server.slug,
          description: server.description,
          transport: server.transport,
          source: server.source,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeMcpListTools(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const userId = await this.getUserIdForMcp(chatId);
      const { serverId } = toolCall.parameters as { serverId?: string };
      const servers = await mcpService.listTools(userId, serverId);
      return { success: true, servers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeMcpCall(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const userId = await this.getUserIdForMcp(chatId);
      const { serverId, toolName, arguments: args } = toolCall.parameters as {
        serverId: string;
        toolName: string;
        arguments?: Record<string, unknown>;
      };

      if (!serverId || !toolName) {
        return { success: false, error: "serverId and toolName are required" };
      }

      const result = await mcpService.callTool(userId, serverId, toolName, args ?? {});
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTodoList(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const { includeCompleted = false } = toolCall.parameters as { includeCompleted?: boolean };
      const userId = await this.getUserIdFromChat(chatId);
      if (!userId) return { success: false, error: "No user session — cannot access todo list" };
      const items = await storage.getTodoItems(userId, includeCompleted);
      return { success: true, items };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTodoAdd(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const { title, description, priority = 5, category, tags } = toolCall.parameters as {
        title: string; description?: string; priority?: number; category?: string; tags?: string[];
      };
      const userId = await this.getUserIdFromChat(chatId);
      if (!userId) return { success: false, error: "No user session — cannot add todo item" };
      const item = await storage.createTodoItem(insertTodoItemSchema.parse({
        userId,
        title,
        description,
        priority,
        category,
        tags,
        relatedChatId: chatId ? String(chatId) : undefined,
      }));
      await this.writeTodoCache(userId);
      return { success: true, item };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTodoUpdate(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const { id, ...update } = toolCall.parameters as { id: string; [key: string]: any };
      const userId = await this.getUserIdFromChat(chatId);
      if (!userId) return { success: false, error: "No user session — cannot update todo item" };
      const parsedUpdate = insertTodoItemSchema.omit({ userId: true }).partial().parse(update);
      const item = await storage.updateTodoItem(id, parsedUpdate, userId);
      if (!item) return { success: false, error: "Todo item not found" };
      await this.writeTodoCache(userId);
      return { success: true, item };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTodoComplete(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const { id } = toolCall.parameters as { id: string };
      const userId = await this.getUserIdFromChat(chatId);
      if (!userId) return { success: false, error: "No user session — cannot complete todo item" };
      const item = await storage.completeTodoItem(id, userId);
      if (!item) return { success: false, error: "Todo item not found" };
      await this.writeTodoCache(userId);
      return { success: true, item };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTodoRemove(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const { id } = toolCall.parameters as { id: string };
      const userId = await this.getUserIdFromChat(chatId);
      if (!userId) return { success: false, error: "No user session — cannot remove todo item" };
      const deleted = await storage.deleteTodoItem(id, userId);
      if (deleted) {
        await this.writeTodoCache(userId);
      }
      return { success: deleted, error: deleted ? undefined : "Todo item not found" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeGmailList(toolCall: ToolCall): Promise<unknown> {
    try {
      const { maxResults = 20, labelIds } = toolCall.parameters as {
        maxResults?: number;
        labelIds?: string[];
      };
      const emails = await gmail.listEmails(maxResults, labelIds);
      return { success: true, emails };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeGmailRead(toolCall: ToolCall): Promise<unknown> {
    try {
      const { messageId } = toolCall.parameters as { messageId: string };
      if (!messageId) {
        return { success: false, error: "messageId is required" };
      }
      const email = await gmail.getEmail(messageId);
      return { success: true, email };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeGmailSearch(toolCall: ToolCall): Promise<unknown> {
    try {
      const { query, maxResults = 20 } = toolCall.parameters as {
        query?: string;
        maxResults?: number;
      };
      if (!query?.trim()) {
        return { success: false, error: "query is required" };
      }
      const emails = await gmail.searchEmails(query, maxResults);
      return { success: true, emails };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeGmailSend(toolCall: ToolCall): Promise<unknown> {
    try {
      const { to, subject, body } = toolCall.parameters as {
        to?: string;
        subject?: string;
        body?: string;
      };
      if (!to?.trim() || !subject?.trim() || !body?.trim()) {
        return { success: false, error: "to, subject, and body are required" };
      }
      const message = await gmail.sendEmail(to, subject, body);
      return { success: true, message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTasksList(toolCall: ToolCall): Promise<unknown> {
    try {
      const { taskListId = "@default", maxResults } = toolCall.parameters as { taskListId?: string; maxResults?: number };
      const tasks = await googleTasks.listTasks(taskListId, true, maxResults ?? 100);
      return { success: true, tasks };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTasksCreate(toolCall: ToolCall): Promise<unknown> {
    try {
      const { title, notes, due, taskListId = "@default" } = toolCall.parameters as {
        title: string; notes?: string; due?: string; taskListId?: string;
      };
      const task = await googleTasks.createTask(taskListId, title, notes, due);
      return { success: true, task };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTasksUpdate(toolCall: ToolCall): Promise<unknown> {
    try {
      const { taskId, title, notes, due, taskListId = "@default" } = toolCall.parameters as {
        taskId: string; title?: string; notes?: string; due?: string; taskListId?: string;
      };
      const task = await googleTasks.updateTask(taskListId, taskId, { title, notes, due });
      return { success: true, task };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTasksComplete(toolCall: ToolCall): Promise<unknown> {
    try {
      const { taskId, taskListId = "@default" } = toolCall.parameters as { taskId: string; taskListId?: string };
      const task = await googleTasks.completeTask(taskListId, taskId);
      return { success: true, task };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeTasksDelete(toolCall: ToolCall): Promise<unknown> {
    try {
      const { taskId, taskListId = "@default" } = toolCall.parameters as { taskId: string; taskListId?: string };
      await googleTasks.deleteTask(taskListId, taskId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ── Schedule tools ──────────────────────────────────────────────────────────

  private async executeScheduleList(toolCall: ToolCall): Promise<unknown> {
    try {
      const { enabledOnly } = toolCall.parameters as { enabledOnly?: boolean };
      const schedules = await storage.getSchedules();
      const filtered = enabledOnly ? schedules.filter(s => s.isEnabled) : schedules;
      return {
        schedules: filtered.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          cronExpression: s.cronExpression,
          enabled: s.isEnabled,
          nextRunAt: s.nextRunAt,
          lastRunAt: s.lastRunAt,
        }))
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeScheduleCreate(toolCall: ToolCall, chatId?: number | string): Promise<unknown> {
    try {
      const { name, description, cronExpression, prompt, userId: explicitUserId } = toolCall.parameters as {
        name: string;
        description?: string;
        cronExpression: string;
        prompt?: string;
        userId?: string;
      };

      // Resolve userId from explicit param or from the chat
      const resolvedUserId = explicitUserId ?? (chatId ? await this.getUserIdFromChat(chatId) : undefined);

      const schedule = await storage.createSchedule({
        name,
        description: description ?? null,
        cronExpression,
        isEnabled: true,
        taskTemplate: {
          chatMode: true,
          prompt: prompt ?? "SCHEDULED CHECK-IN at {{timestamp}}: {{name}}. {{description}}",
          userId: resolvedUserId,
        },
      });

      return { success: true, id: schedule.id, name: schedule.name, cronExpression: schedule.cronExpression };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeScheduleToggle(toolCall: ToolCall): Promise<unknown> {
    try {
      const { id, enabled } = toolCall.parameters as { id: string; enabled: boolean };
      await storage.updateSchedule(id, { isEnabled: enabled });
      return { success: true, id, enabled };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeScheduleDelete(toolCall: ToolCall): Promise<unknown> {
    try {
      const { id } = toolCall.parameters as { id: string };
      await storage.deleteSchedule(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const toolDispatcher = new ToolDispatcher();

export interface DispatchResult {
  success: boolean;
  chatContent?: string;
  filesCreated: string[];
  filesModified: string[];
  toolResults: ToolExecutionResult[];
  errors: string[];
  executionTime: number;
  pendingAutoexec: any | null;
}

export interface ToolExecutionResult {
  toolId: string;
  type: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}
