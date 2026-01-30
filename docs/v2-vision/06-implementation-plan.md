# 06 - Implementation Plan

## Build Order and Milestones

---

## Phase 0: Documentation Complete ✓

- [x] 01-core-philosophy.md
- [x] 02-prompt-lifecycle.md
- [x] 03-hypervisor-tiers.md
- [x] 04-tool-taxonomy.md
- [x] 05-device-mesh.md
- [x] 06-implementation-plan.md

---

## Phase 1: Core Primitives

### Goal: Rename and consolidate the 7 core tools

### Tasks

1. **Rename tools in gemini-tools.ts**
   - `terminal_execute` → `terminal`
   - `file_get` → `get`
   - `file_put` → `put`
   - `send_chat` → `write`
   - `log_append` → `log`
   - `say` → `say` (no change)

2. **Create unified `ssh` tool**
   - Persistent WebSocket connection
   - Replace 9 `ssh_*` tools with one
   - Support for multiple hosts
   - Interactive and non-interactive modes

3. **Update JIT manifest**
   - Reflect new tool names
   - Update categories

4. **Test all primitives**
   - Ensure backward compatibility
   - Verify tool execution

### Deliverables
- [ ] Renamed core tools working
- [ ] Unified SSH tool functional
- [ ] All tests passing

---

## Phase 2: Auth Simplification

### Goal: Remove multi-user infrastructure

### Tasks

1. **Remove user tables and references**
   - Delete user-related database tables
   - Remove user ID foreign keys
   - Clean up user session logic

2. **Simplify auth flow**
   - Keep Google OAuth (for API access)
   - Remove login pages
   - Direct to app on load

3. **Implement catch phrase recognition**
   - Define 6 family catch phrases
   - Store securely (env or encrypted file)
   - On match: remember name for session
   - No elevated privileges

4. **Test auth flow**
   - Verify Google services work
   - Test family phrase recognition
   - Confirm no unauthorized access

### Deliverables
- [ ] User tables removed
- [ ] Login page removed
- [ ] Catch phrase working
- [ ] Google OAuth still functional

---

## Phase 3: File-Based Queue System

### Goal: Replace database queue with filesystem

### Tasks

1. **Create queue directory structure**
   ```
   /queues/
   ├── hypervisor/
   ├── code-analyst/
   ├── writer/
   ├── docubot/
   ├── archivist/
   └── .processing/
   ```

2. **Implement job file format**
   - JSON schema for tickets
   - Priority in filename
   - Append-only results

3. **Create worker polling logic**
   - Watch directory for new files
   - Atomic claim (move to .processing)
   - Append results
   - Move to destination on complete

4. **Remove database queue tools**
   - Delete `queue_*` tools
   - Clean up related code

5. **Test queue system**
   - Create jobs via `put`
   - Verify worker picks up
   - Confirm results written

### Deliverables
- [ ] Queue directories created
- [ ] Worker polling functional
- [ ] Job lifecycle working
- [ ] Old queue code removed

---

## Phase 4: Tool Cleanup

### Goal: Remove redundant tools, organize by specialist

### Tasks

1. **Remove redundant tools**
   - `open_url` (use terminal)
   - `codebase_analyze` (shell script)
   - `codebase_progress` (file read)
   - `queue_*` tools (filesystem)
   - `ssh_*` collection (unified ssh)

2. **Remove paid search tools**
   - `perplexity_*` (no free tier)
   - `tavily_*` (no free tier)

3. **Organize remaining tools by specialist**
   - Tag each tool with owner bot
   - Create specialist manifests

4. **Implement on-demand loading**
   - Desktop tools only when needed
   - Load specialist tools on route

### Deliverables
- [ ] Redundant tools removed
- [ ] Tool count reduced to ~85
- [ ] Specialist manifests created
- [ ] On-demand loading working

---

## Phase 5: Hypervisor Implementation

### Goal: Build the multi-tier routing system

### Tasks

1. **Implement HV-0 (Triage)**
   - Flash Lite model for classification
   - Intent detection logic
   - Routing decision tree
   - Pass context to target

2. **Implement HV-1 (Voice Layer)**
   - Flash Audio for live mode
   - Personality in system prompt
   - Quick tool execution
   - Escalation triggers

3. **Implement HV-2 (Strategic)**
   - Pro model for complex work
   - Personal vs Technical modes
   - Ticket decomposition
   - Aggregation logic

4. **Build routing protocol**
   - Message envelope format
   - Context handoff
   - Response routing back

5. **Test tier interactions**
   - Simple query → direct answer
   - Personal query → HV-1 Personal
   - Technical query → HV-2 → specialists

### Deliverables
- [ ] HV-0 triage working
- [ ] HV-1 voice layer working
- [ ] HV-2 strategic layer working
- [ ] Full routing functional

---

## Phase 6: Specialist Bots

### Goal: Create specialized agents with deep context

### Tasks

1. **DocuBot**
   - 100K word system prompt
   - Google Workspace tools
   - Document editing expertise

2. **WriterBot**
   - 250K word system prompt
   - Writing craft knowledge
   - Style and tone control

3. **CodeBot**
   - Codebase analysis tools
   - GitHub integration
   - Pattern library

4. **CommBot**
   - Email/SMS/calls
   - Contact management
   - Communication patterns

5. **CalBot**
   - Calendar management
   - Task scheduling
   - Reminder logic

### Deliverables
- [ ] All specialist bots defined
- [ ] System prompts created
- [ ] Tool assignments working
- [ ] Specialist routing functional

---

## Phase 7: Device Mesh

### Goal: Connect all devices through unified protocol

### Tasks

1. **Create WebSocket mesh handler**
   - Device registry
   - Message router
   - Stream manager

2. **Define message protocol**
   - JSON envelope format
   - All message types
   - Heartbeat mechanism

3. **Update desktop agent**
   - Use new protocol
   - Full capability set
   - Reconnect logic

4. **Create mobile entry point**
   - m.meowstik.com subdomain
   - PWA configuration
   - Native audio streaming

5. **Document device integration**
   - Home server setup
   - Comma 3X integration
   - Alexa integration

### Deliverables
- [ ] Mesh handler deployed
- [ ] Desktop agent updated
- [ ] Mobile site functional
- [ ] Protocol documented

---

## Phase 8: Proactive AI

### Goal: Enable autonomous monitoring and action

### Tasks

1. **Implement Chrono triggers**
   - Cron-like scheduling
   - Periodic check-ins
   - Time-based reminders

2. **Implement Event triggers**
   - Email arrival detection
   - SMS/call notification
   - Calendar alerts

3. **Implement Context triggers**
   - Pattern recognition
   - Inferred needs
   - Safety alerts

4. **Define action permissions**
   - What can AI do autonomously
   - What requires confirmation
   - Emergency overrides

### Deliverables
- [ ] Chrono triggers working
- [ ] Event triggers working
- [ ] Context inference working
- [ ] Permission system defined

---

## Milestones Summary

| Phase | Description | Est. Effort |
|-------|-------------|-------------|
| 0 | Documentation | ✅ Complete |
| 1 | Core Primitives | 1-2 days |
| 2 | Auth Simplification | 1 day |
| 3 | File Queue | 2-3 days |
| 4 | Tool Cleanup | 1 day |
| 5 | Hypervisors | 3-5 days |
| 6 | Specialists | 3-5 days |
| 7 | Device Mesh | 3-5 days |
| 8 | Proactive AI | 3-5 days |

**Total Estimated:** 3-4 weeks

---

## Success Criteria

### Phase 1 Complete When:
- Can execute `terminal "ls -la"` successfully
- Can execute `get "/path/file"` successfully
- All 7 core primitives working

### Phase 5 Complete When:
- "What time is it?" → Immediate answer (no routing)
- "I'm stressed" → Personal Pro responds
- "Debug this code" → Technical Pro + CodeBot

### Phase 7 Complete When:
- Desktop agent connects via mesh
- Mobile site streams audio
- Can send command to any connected device

### Full Vision Complete When:
- Multi-tier hypervisors routing correctly
- Specialists handling domain-specific work
- All devices connected and responsive
- Proactive triggers firing appropriately
- Single-user, self-enforcing auth

---

## Dependencies

```
Phase 1 (Primitives)
    │
    ├── Phase 2 (Auth) - parallel possible
    │
    ├── Phase 3 (Queue) - parallel possible
    │
    └── Phase 4 (Cleanup)
            │
            └── Phase 5 (Hypervisors)
                    │
                    └── Phase 6 (Specialists)
                            │
                            ├── Phase 7 (Mesh) - parallel possible
                            │
                            └── Phase 8 (Proactive)
```

---

*The docs are written. The code writes itself.*
