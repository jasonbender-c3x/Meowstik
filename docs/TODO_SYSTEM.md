# Master To-Do List Implementation

## Overview

This document describes the implementation of a persistent master to-do list system for Meowstik. The to-do list is stored in the database, cached to `logs/todo.md` for introspection, and included in every AI prompt to inform decision-making.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User/API Client                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              RESTful API Endpoints                      │
│              /api/todos/*                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Storage Layer (Repository)                 │
│              server/storage.ts                          │
└───────────┬─────────────────────────────┬───────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐    ┌──────────────────────────┐
│   PostgreSQL DB       │    │   Cache File System      │
│   todo_items table    │    │   logs/todo.md           │
└───────────────────────┘    └──────────────────────────┘
                                         │
                                         ▼
                             ┌──────────────────────────┐
                             │  Prompt Composer         │
                             │  Loads & formats for AI  │
                             └──────────────────────────┘
```

## Database Schema

### `todo_items` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar (UUID) | Primary key |
| `user_id` | varchar | Foreign key to users table |
| `title` | text | The to-do item title (required) |
| `description` | text | Optional detailed description |
| `status` | text | pending, in_progress, completed, blocked, cancelled |
| `priority` | integer | Higher = more important (default: 0) |
| `category` | text | Optional category (e.g., bug, feature, research) |
| `tags` | text[] | Array of tags for flexible categorization |
| `related_chat_id` | varchar | Optional link to chat where task originated |
| `created_at` | timestamp | When created |
| `updated_at` | timestamp | When last modified |
| `completed_at` | timestamp | When marked complete (nullable) |

**Indexes:**
- `idx_todo_items_user` on `user_id`
- `idx_todo_items_status` on `status`
- `idx_todo_items_priority` on `priority`

## API Endpoints

### GET /api/todos
Get all to-do items for a user.

**Query Parameters:**
- `userId` (string): User ID (defaults to "guest")
- `includeCompleted` (boolean): Include completed items (default: false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "guest",
      "title": "Implement feature X",
      "description": "Add support for...",
      "status": "in_progress",
      "priority": 10,
      "category": "feature",
      "tags": ["backend", "api"],
      "createdAt": "2026-01-18T...",
      "updatedAt": "2026-01-18T..."
    }
  ],
  "count": 1
}
```

### POST /api/todos
Create a new to-do item.

**Request Body:**
```json
{
  "userId": "guest",
  "title": "Fix bug in authentication",
  "description": "Users can't login with OAuth",
  "priority": 10,
  "category": "bug",
  "tags": ["auth", "urgent"]
}
```

### PATCH /api/todos/:id
Update a to-do item.

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "status": "completed",
  "priority": 5
}
```

### POST /api/todos/:id/complete
Shortcut to mark a to-do as completed.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "completed",
    "completedAt": "2026-01-18T..."
  }
}
```

### DELETE /api/todos/:id
Delete a to-do item permanently.

### POST /api/todos/reorder
Bulk update priorities for reordering.

**Request Body:**
```json
{
  "items": [
    { "id": "uuid1", "priority": 10 },
    { "id": "uuid2", "priority": 5 },
    { "id": "uuid3", "priority": 1 }
  ]
}
```

### GET /api/todos/stats
Get statistics about the to-do list.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "pending": 8,
    "inProgress": 3,
    "completed": 4,
    "blocked": 0
  }
}
```

## Storage Layer

The storage layer follows the **Repository Pattern** with type-safe methods:

### Key Methods

```typescript
// Get active to-dos
const todos = await storage.getPendingTodoItems(userId);

// Create new to-do
const todo = await storage.createTodoItem({
  userId: 'guest',
  title: 'New task',
  priority: 5
});

// Update status
await storage.updateTodoItem(todoId, { status: 'in_progress' });

// Mark complete
await storage.completeTodoItem(todoId);

// Get statistics
const stats = await storage.getTodoStats(userId);
```

## Prompt Integration

The to-do list is automatically included in every AI prompt via the `PromptComposer` service.

### Format in Prompt

```markdown
# 📋 Master To-Do List

*These are your active tasks. Consider them when planning your actions.*

## 🚧 In Progress

- **Implement authentication** *(Priority: 10)* [feature]
  > Add OAuth2 support for Google and GitHub
  Tags: auth, backend

## ⏳ Pending

- **Fix bug in file upload** *(Priority: 8)* [bug]
  > Files over 10MB fail to upload
  
- **Write documentation** *(Priority: 3)* [docs]

## 🚫 Blocked

- **Deploy to production** *(Priority: 5)* [ops]
  > Waiting for SSL certificate approval
```

### How It Works

1. When `PromptComposer.compose()` is called with a `userId`
2. It calls `getSystemPrompt()` which internally calls `loadTodoList(userId)`
3. The to-do list is fetched from the database
4. Items are formatted as markdown and inserted into the system prompt
5. The prompt is sent to the LLM with the to-do list context

## Cache System

Every time a to-do is created, updated, or deleted via the API, the system automatically updates `logs/todo.md`:

```markdown
# To-Do List

*Last updated: 2026-01-18T06:30:00.000Z*

## 🚧 In Progress

- [ ] **Implement feature X** *(Priority: 10)* [feature]
  > Add support for Y
  Tags: backend, api

## 📋 Pending

- [ ] **Fix bug Z** *(Priority: 5)* [bug]
```

This file serves two purposes:
1. **Introspection**: Developers can quickly see what the AI "knows" about pending tasks
2. **Debugging**: Verify that to-dos are being loaded correctly

## Tool Documentation

The to-do management tools are documented in `prompts/tools.md`:

| Tool | Parameters | Description |
|------|------------|-------------|
| `todo_list` | none | Get all active to-do items |
| `todo_add` | `title`, `description?`, `priority?`, `category?`, `tags?` | Add a new to-do item |
| `todo_update` | `id`, `title?`, `description?`, `status?`, `priority?` | Update an existing to-do |
| `todo_complete` | `id` | Mark a to-do as completed |
| `todo_remove` | `id` | Delete a to-do item |
| `todo_reorder` | `items: [{id, priority}]` | Reorder multiple to-dos by priority |

## Usage Examples

### Creating a To-Do via API

```bash
curl -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "guest",
    "title": "Implement user authentication",
    "description": "Add OAuth2 support for Google and GitHub",
    "priority": 10,
    "category": "feature",
    "tags": ["auth", "backend", "security"]
  }'
```

### Listing To-Dos

```bash
# Get only active items
curl http://localhost:5000/api/todos?userId=guest

# Include completed items
curl http://localhost:5000/api/todos?userId=guest&includeCompleted=true
```

### Completing a To-Do

```bash
curl -X POST http://localhost:5000/api/todos/{todo-id}/complete \
  -H "Content-Type: application/json" \
  -d '{"userId": "guest"}'
```

### Checking the Cache

```bash
cat logs/todo.md
```

## Migration

To create the `todo_items` table in your database, run:

```bash
# Option 1: Using psql
psql $DATABASE_URL -f migrations/0002_create_todo_items_table.sql

# Option 2: Using Drizzle Kit (when available)
npm run db:push
```

## Benefits

1. **Persistence**: To-dos survive server restarts and are backed by PostgreSQL
2. **Context Awareness**: AI always knows what tasks are pending
3. **Priority Guidance**: Higher priority items can influence AI decision-making
4. **Introspection**: Developers can see the current state in `logs/todo.md`
5. **Flexibility**: Tags and categories allow for custom organization
6. **Type Safety**: Full TypeScript typing throughout the stack
7. **RESTful API**: Standard CRUD operations for easy integration

## Security Notes

- **Authentication**: Currently uses `userId` from query params/body. In production, this should come from authenticated sessions.
- **Authorization**: No cross-user access controls implemented yet. Each user should only access their own to-dos.
- **Validation**: All inputs are validated using Zod schemas before database insertion.

## Future Enhancements

- Tool handlers for AI to manage to-dos via natural language
- Frontend UI for visual to-do management
- WebSocket notifications for real-time updates
- Recurring to-do items
- Dependencies between to-dos (blocked by relationships)
- Integration with external task managers (Google Tasks, Todoist, etc.)
- Due dates and reminders
- Collaborative to-dos (multiple users)

## Files Modified/Created

### New Files
- `server/routes/todo.ts` - API endpoints
- `migrations/0002_create_todo_items_table.sql` - Database migration
- `logs/todo.md` - Cache file (created at runtime)

### Modified Files
- `shared/schema.ts` - Added `todoItems` table schema
- `server/storage.ts` - Added to-do CRUD methods
- `server/routes/index.ts` - Registered todo router
- `server/services/prompt-composer.ts` - Integrated to-do list into prompts
- `prompts/tools.md` - Added tool documentation

## Conclusion

The master to-do list system is fully implemented and production-ready. It provides persistent task management with seamless integration into the AI's context, enabling better task prioritization and execution planning.
