# Debug Page Overhaul - LLM Trace Viewer

## Overview

The Debug Page has been completely refactored to focus exclusively on LLM interaction tracing with a professional list/detail pattern inspired by the Database Explorer.

## Architecture

### List/Detail Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                         Debug Page                              │
├──────────────────┬──────────────────────────────────────────────┤
│   Sidebar (List) │            Main Content (Detail)             │
│                  │                                              │
│  ┌────────────┐  │  ┌────────────────────────────────────────┐ │
│  │  Search    │  │  │         Detail Header                  │ │
│  └────────────┘  │  ├────────────────────────────────────────┤ │
│                  │  │                                        │ │
│  Interaction 1   │  │  ┌──┬──────┬────────┬──────────────┐  │ │
│  Interaction 2 ◄─┼──┼─►│I │System│Outputs │Orchestration │  │ │
│  Interaction 3   │  │  └──┴──────┴────────┴──────────────┘  │ │
│  ...             │  │                                        │ │
│                  │  │        Tab Content Area                │ │
│  (10 cycles)     │  │     (Scrollable, Collapsible)          │ │
│                  │  │                                        │ │
└──────────────────┴──┴────────────────────────────────────────┘
```

## Components

### 1. **Sidebar - Interaction List**
- **Width**: 320px (w-80)
- **Features**:
  - Search bar with real-time filtering
  - Scrollable list of up to 10 recent interactions
  - Each card shows:
    - Timestamp
    - Model badge
    - User message preview (truncated to 80 chars)
    - Duration indicator
    - Tool count (if applicable)
  - Selection highlight (primary color background)
  - Empty state with helpful message

### 2. **Main Content - Detail Panel**

#### Detail Header
- Interaction metadata summary
- Quick actions: View Message, Copy JSON
- Navigation breadcrumbs

#### Tab Navigation
Four primary tabs for organized trace viewing:

##### **Inputs Tab**
Shows everything that went into the LLM request:

- **User Message**: The actual prompt sent
  - Collapsible section
  - Character count
  - Copy button
  - Syntax highlighted

- **Conversation History**: Previous messages in the chat
  - Shows all prior user/assistant exchanges
  - Role badges (USER/ASSISTANT)
  - Character counts
  - Chronological order

- **RAG Context**: Retrieved knowledge/context
  - Source identification
  - Relevance scores
  - Content preview
  - Metadata display

- **Injected Files**: Programmatically added files
  - Filename
  - MIME type
  - Content preview
  - File size

- **Injected JSON**: Structured data passed to LLM
  - Named data objects
  - Formatted JSON display

- **Attachments**: User-uploaded files
  - File metadata
  - Type identification
  - Size information

##### **System Tab**
Configuration and instructions:

- **System Prompt**: The AI's instructions
  - Full prompt text
  - Character count
  - Copy functionality
  - Scrollable for long prompts

##### **Outputs Tab**
What the LLM generated:

- **Clean Response**: Parsed, user-facing content
  - Final text output
  - No tool calls or metadata
  - Copy button

- **Raw Response**: Unprocessed LLM output
  - Includes all markup
  - Tool call syntax
  - Debugging details

- **Tool Execution**: Function calls made
  - **Tool Calls Section**:
    - Function name
    - Arguments (formatted JSON)
    - Call ID
  - **Tool Results Section**:
    - Success/failure status
    - Result data
    - Error messages
    - Color-coded (green=success, red=failure)

##### **Orchestration Tab**
System-level information:

- **Metadata Grid**: Key identifiers
  - Interaction ID
  - Model used
  - Chat ID
  - Message ID
  - Duration
  - Timestamp
  - Token estimates (input/output)

- **State Summary**: Aggregate statistics
  - Conversation history count
  - Attachments count
  - RAG context items
  - Tool calls count
  - Tool results count
  - Successful tools count

## Color Coding

Visual semantics for quick identification:

| Element | Color | Usage |
|---------|-------|-------|
| User Input | Blue (`bg-blue-500/10`) | User messages, prompts |
| System | Purple (`bg-purple-500/10`) | System prompts, config |
| AI Output | Green (`bg-green-500/10`) | Clean responses |
| RAG/Context | Cyan (`bg-cyan-500/10`) | Retrieved knowledge |
| Files | Orange (`bg-orange-500/10`) | Injected files |
| JSON Data | Pink (`bg-pink-500/10`) | Structured data |
| Tools | Amber (`bg-amber-500/10`) | Function calls |
| Metadata | Indigo (`bg-indigo-500/10`) | Orchestration info |

## Features

### Real-Time Updates
- Auto-refresh every 5 seconds
- Non-intrusive polling
- Preserves current selection
- Updates interaction count

### Search & Filter
- Searches across:
  - User messages
  - AI responses
  - Model names
  - Interaction IDs
- Live results count
- Instant filtering

### Copy Functionality
- Copy individual sections
- Copy full JSON dump
- Visual feedback (checkmark on success)
- 2-second confirmation display

### Collapsible Sections
All major content sections are collapsible:
- Default states optimized for common debugging workflows
- Persist state during navigation
- Visual indicators (chevron icons)
- Smooth animations

### Responsive Design
- Sidebar adapts to viewport
- Scrollable content areas
- Fixed headers for context
- Mobile-friendly (though optimized for desktop debugging)

## Data Flow

```mermaid
graph LR
    A[Chat Message] --> B[LLM Service]
    B --> C[llmDebugBuffer]
    C --> D[/api/debug/llm]
    D --> E[Debug Page]
    E --> F[List View]
    E --> G[Detail View]
    F --> H[User Selection]
    H --> G
```

### Backend Integration

#### API Endpoints
- `GET /api/debug/llm` - List all interactions (limit 20)
- `GET /api/debug/llm/:id` - Get specific interaction
- `DELETE /api/debug/llm` - Clear all interactions

#### Buffer Configuration
- **Size**: 10 interactions (FIFO)
- **Storage**: In-memory (server restart clears)
- **Retention**: Last 10 cycles only

## Usage

### Accessing the Page
Navigate to `/debug` from the main application.

### Viewing an Interaction
1. Select an interaction from the sidebar list
2. Use tabs to explore different aspects:
   - **Inputs**: What went in
   - **System**: How it was configured
   - **Outputs**: What came out
   - **Orchestration**: How it performed

### Debugging Workflows

#### Prompt Engineering
1. Go to **Inputs** tab
2. Review user message and system prompt
3. Check RAG context for relevance
4. Copy prompt to test variations

#### Response Quality
1. Go to **Outputs** tab
2. Compare clean vs. raw response
3. Check for unexpected tool calls
4. Verify tool execution success

#### Performance Analysis
1. Go to **Orchestration** tab
2. Check duration metrics
3. Review token estimates
4. Analyze state complexity

#### Context Debugging
1. Go to **Inputs** tab
2. Expand conversation history
3. Check RAG context scores
4. Verify injected data

## Comparison with Old Debug Page

### Old Design
- Tab-based layout (Logs, Database, LLM, Errors)
- LLM tab mixed with other concerns
- Modal overlay for details
- Limited RAG visibility
- No search functionality

### New Design
- Dedicated LLM-only page
- List/detail pattern (like Database Explorer)
- Persistent detail panel
- Comprehensive RAG display
- Built-in search and filtering
- Four organized tabs
- Better information hierarchy

## Technical Implementation

### Component Structure
```
DebugPage
├── Header (title, actions)
├── Layout (flex row)
│   ├── Sidebar (interaction list)
│   │   ├── Search input
│   │   └── Interaction cards
│   └── Main (detail panel)
│       ├── Detail header
│       └── Tabs
│           ├── InputsTab (collapsible sections)
│           ├── SystemTab (collapsible sections)
│           ├── OutputsTab (collapsible sections)
│           └── OrchestrationTab (metadata + state)
└── Empty State (when no selection)
```

### State Management
- `interactions`: Array of LLM interactions from API
- `selectedInteraction`: Currently viewed interaction
- `searchQuery`: Filter string
- `detailTab`: Active tab (inputs/system/outputs/orchestration)
- `expandedSections`: Collapsible section states
- `copiedId`: Track copy-to-clipboard feedback

### Styling
- Tailwind CSS for utility classes
- Shadcn/ui components for consistency
- Dark theme optimized
- Semantic color system

## Future Enhancements

### Potential Additions
- [ ] Export interaction as JSON file
- [ ] Compare two interactions side-by-side
- [ ] Syntax highlighting for code in responses
- [ ] Diff view for conversation history
- [ ] Filter by model or date range
- [ ] Performance metrics visualization
- [ ] Token usage graphs
- [ ] RAG source visualization
- [ ] Tool call success rate charts

### Known Limitations
- 10 interaction limit (by design for debugging)
- No persistence across server restarts
- No historical trend analysis
- Search is client-side only (could be server-side for large datasets)

## Related Documentation
- [Database Explorer](./../DATABASE_EXPLORER.md) - Reference list/detail pattern
- [LLM Debug Buffer](../../server/services/llm-debug-buffer.ts) - Backend storage
- [API Routes](../../server/routes.ts) - Debug endpoints

## Changelog

### 2026-01-16 - Initial Overhaul
- Replaced multi-tab debug console with dedicated LLM trace viewer
- Implemented list/detail pattern
- Added four-tab detail view (Inputs, System, Outputs, Orchestration)
- Added search and real-time updates
- Improved visual hierarchy and color coding
- Added comprehensive collapsible sections
- Implemented copy-to-clipboard for all sections
