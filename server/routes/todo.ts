/**
 * =============================================================================
 * TO-DO LIST API ROUTES
 * =============================================================================
 *
 * RESTful API endpoints for managing persistent to-do list items.
 * All operations require user authentication.
 *
 * ENDPOINTS:
 * ----------
 * GET    /api/todos          - List all to-do items
 * GET    /api/todos/stats    - Get to-do list statistics
 * POST   /api/todos          - Create a new to-do item
 * GET    /api/todos/:id      - Get a specific to-do item
 * PATCH  /api/todos/:id      - Update a to-do item
 * DELETE /api/todos/:id      - Delete a to-do item
 * POST   /api/todos/reorder  - Reorder to-do items by priority
 * POST   /api/todos/:id/complete - Mark a to-do as completed
 *
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { insertTodoItemSchema } from "@shared/schema";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

const router = Router();

/**
 * Helper to get user ID from request
 * In production, this would come from authenticated session
 * For now, we use a fallback or query parameter
 */
function getUserId(req: Request): string {
  // TODO: Replace with actual authentication
  // For now, use query parameter or default to 'guest'
  return (req.query.userId as string) || req.body?.userId || "guest";
}

/**
 * Helper to write to-do list to logs/todo.md for introspection
 */
async function writeTodoCache(userId: string): Promise<void> {
  try {
    const todos = await storage.getPendingTodoItems(userId);
    const logsDir = path.join(process.cwd(), "logs");
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Format as markdown
    const content = formatTodoListAsMarkdown(todos);
    
    // Write to logs/todo.md
    fs.writeFileSync(path.join(logsDir, "todo.md"), content, "utf-8");
  } catch (error) {
    console.error("[TODO] Error writing cache:", error);
  }
}

/**
 * Format to-do list as markdown
 */
function formatTodoListAsMarkdown(todos: any[]): string {
  if (todos.length === 0) {
    return "# To-Do List\n\n*(No items)*\n";
  }
  
  let content = "# To-Do List\n\n";
  content += `*Last updated: ${new Date().toISOString()}*\n\n`;
  
  // Group by status
  const pending = todos.filter(t => t.status === 'pending');
  const inProgress = todos.filter(t => t.status === 'in_progress');
  const blocked = todos.filter(t => t.status === 'blocked');
  
  if (inProgress.length > 0) {
    content += "## 🚧 In Progress\n\n";
    for (const todo of inProgress) {
      content += formatTodoItem(todo);
    }
    content += "\n";
  }
  
  if (pending.length > 0) {
    content += "## 📋 Pending\n\n";
    for (const todo of pending) {
      content += formatTodoItem(todo);
    }
    content += "\n";
  }
  
  if (blocked.length > 0) {
    content += "## 🚫 Blocked\n\n";
    for (const todo of blocked) {
      content += formatTodoItem(todo);
    }
  }
  
  return content;
}

/**
 * Format a single to-do item
 */
function formatTodoItem(todo: any): string {
  let line = `- [ ] **${todo.title}**`;
  
  if (todo.priority > 0) {
    line += ` *(Priority: ${todo.priority})*`;
  }
  
  if (todo.category) {
    line += ` [${todo.category}]`;
  }
  
  line += "\n";
  
  if (todo.description) {
    line += `  > ${todo.description}\n`;
  }
  
  if (todo.tags && todo.tags.length > 0) {
    line += `  Tags: ${todo.tags.join(", ")}\n`;
  }
  
  return line + "\n";
}

// =============================================================================
// ROUTES
// =============================================================================

/**
 * GET /api/todos
 * List all to-do items for the authenticated user
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const includeCompleted = req.query.includeCompleted === "true";
    
    const todos = await storage.getTodoItems(userId, includeCompleted);
    
    res.json({
      success: true,
      data: todos,
      count: todos.length,
    });
  } catch (error) {
    console.error("[TODO] Error listing todos:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list to-dos",
    });
  }
});

/**
 * GET /api/todos/stats
 * Get statistics about the to-do list
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const stats = await storage.getTodoStats(userId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[TODO] Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get stats",
    });
  }
});

/**
 * POST /api/todos
 * Create a new to-do item
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    // Validate request body
    const todoData = insertTodoItemSchema.parse({
      ...req.body,
      userId,
    });
    
    const todo = await storage.createTodoItem(todoData);
    
    // Update cache file
    await writeTodoCache(userId);
    
    res.status(201).json({
      success: true,
      data: todo,
    });
  } catch (error) {
    console.error("[TODO] Error creating todo:", error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create to-do",
      });
    }
  }
});

/**
 * GET /api/todos/:id
 * Get a specific to-do item by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const todo = await storage.getTodoItem(req.params.id);
    
    if (!todo) {
      return res.status(404).json({
        success: false,
        error: "To-do item not found",
      });
    }
    
    res.json({
      success: true,
      data: todo,
    });
  } catch (error) {
    console.error("[TODO] Error getting todo:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get to-do",
    });
  }
});

/**
 * PATCH /api/todos/:id
 * Update a to-do item
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    // Validate partial update data
    const updates = insertTodoItemSchema.partial().parse(req.body);
    
    const todo = await storage.updateTodoItem(req.params.id, updates);
    
    if (!todo) {
      return res.status(404).json({
        success: false,
        error: "To-do item not found",
      });
    }
    
    // Update cache file
    await writeTodoCache(userId);
    
    res.json({
      success: true,
      data: todo,
    });
  } catch (error) {
    console.error("[TODO] Error updating todo:", error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update to-do",
      });
    }
  }
});

/**
 * DELETE /api/todos/:id
 * Delete a to-do item
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const deleted = await storage.deleteTodoItem(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "To-do item not found",
      });
    }
    
    // Update cache file
    await writeTodoCache(userId);
    
    res.json({
      success: true,
      message: "To-do item deleted",
    });
  } catch (error) {
    console.error("[TODO] Error deleting todo:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete to-do",
    });
  }
});

/**
 * POST /api/todos/reorder
 * Reorder to-do items by updating their priorities
 * 
 * Request body: { items: [{ id: string, priority: number }] }
 */
router.post("/reorder", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: "Invalid request: items must be an array",
      });
    }
    
    const updated = await storage.reorderTodoItems(items);
    
    // Update cache file
    await writeTodoCache(userId);
    
    res.json({
      success: true,
      data: updated,
      count: updated.length,
    });
  } catch (error) {
    console.error("[TODO] Error reordering todos:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder to-dos",
    });
  }
});

/**
 * POST /api/todos/:id/complete
 * Mark a to-do item as completed
 */
router.post("/:id/complete", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const todo = await storage.completeTodoItem(req.params.id);
    
    if (!todo) {
      return res.status(404).json({
        success: false,
        error: "To-do item not found",
      });
    }
    
    // Update cache file
    await writeTodoCache(userId);
    
    res.json({
      success: true,
      data: todo,
    });
  } catch (error) {
    console.error("[TODO] Error completing todo:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete to-do",
    });
  }
});

export default router;
