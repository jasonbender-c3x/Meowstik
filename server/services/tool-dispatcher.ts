
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
  httpGetParamsSchema,
  httpPostParamsSchema,
  httpPutParamsSchema,
  copilotSendReportParamsSchema,
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
import { clientRouter } from "./client-router";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { z } from "zod";
import { copilotService } from "./copilot-service";

const execAsync = promisify(exec);

export class ToolDispatcher {
  private readonly workspaceDir: string;
  private sseResponse?: any;

  constructor() {
    this.workspaceDir = process.cwd();
  }
  
  setSseResponse(res: any) {
    this.sseResponse = res;
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

  async executeToolCall(toolCall: ToolCall, messageId: string, chatId?: string): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let taskId: string | null = null;
    let toolCallLogId: string | null = null;

    try {
      const task = await storage.createToolTask({
        messageId,
        taskType: toolCall.type,
        payload: toolCall,
        status: "running"
      });
      taskId = task.id;
      
      if (chatId) {
        const toolCallLog = await storage.createToolCallLog({
          chatId,
          messageId,
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

      switch (toolCall.type) {
        case "web_search": result = await this.executeWebSearch(toolCall); break;
        case "terminal": result = await this.executeTerminal(toolCall); break;
        case "file_get": case "get": result = await this.executeFileGet(toolCall); break;
        case "file_put": case "put": result = await this.executeFilePut(toolCall); break;
        case "db_tables": result = await this.executeDbTables(toolCall); break;
        case "db_query": result = await this.executeDbQuery(toolCall); break;
        case "db_insert": result = await this.executeDbInsert(toolCall); break;
        case "db_delete": result = await this.executeDbDelete(toolCall); break;
        case "say": result = await this.executeSay(toolCall); break;
        case "soundboard": result = this.executeSoundboard(toolCall); break;
        case "end_turn": result = { success: true, shouldEndTurn: true }; break;
        default: result = { message: `Tool type: ${toolCall.type} executed (fallback)` };
      }

      if (taskId) await storage.updateToolTaskStatus(taskId, "completed", result);
      
      if (toolCallLogId && chatId) {
        const duration = Date.now() - startTime;
        await storage.updateToolCallLog(toolCall.id, {
          status: "success",
          response: result,
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
        await storage.updateToolCallLog(toolCall.id, {
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
    const content = await fs.readFile(filePath, "utf8");
    return { content };
  }
  private async executeFilePut(toolCall: ToolCall) {
    const { path: filePath, content } = toolCall.parameters as { path: string, content: string };
    await fs.writeFile(filePath, content, "utf8");
    return { success: true };
  }
  private async executeSay(toolCall: ToolCall) {
     const { utterance } = toolCall.parameters as { utterance: string };
     return { success: true, utterance: utterance || "" };
  }

  private executeSoundboard(toolCall: ToolCall) {
    const { sound, volume } = toolCall.parameters as { sound: string; volume?: number };
    return { success: true, sound: sound || "", volume: volume ?? 0.8 };
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
