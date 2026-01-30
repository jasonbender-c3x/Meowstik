# Roadmap to Friday: Core Capabilities Upgrade

This document outlines the critical tasks required to meet the end-of-week goals for my core capabilities.

### 1. 📞 Live Mode Conversations
**Goal:** Achieve stable, stateful voice conversations of up to 10 minutes, measured in LLM calls.
- **Target (Model 3.0):** 100 LLM calls/day
- **Target (Model 2.5):** 250 LLM calls/day

**Tasks:**
- [ ] **State Management:** Design and implement robust state management for long-running, interactive calls.
- [ ] **Performance Benchmarking:** Test latency and resource usage for both models to ensure targets can be met.
- [ ] **Error Handling:** Develop graceful error recovery for dropped calls or misunderstood phrases.

### 2. 🤖 Orchestration & Automated Task Lists
**Goal:** Create and manage complex, multi-step tasks automatically from high-level goals.

**Tasks:**
- [ ] **Goal Decomposition:** Enhance my logic for breaking down large user requests into a sequence of executable jobs.
- [ ] **Dependency Management:** Refine the use of the `queue_batch` tool to handle tasks with complex dependencies.
- [ ] **Progress Tracking:** Implement a system for monitoring and reporting on the status of long-running automated tasks.

### 3. 👀 Vision
**Goal:** Reliably use visual analysis of the desktop to interact with graphical user interfaces.

**Tasks:**
- [ ] **Screenshot Analysis Procedure:** Standardize the process of taking a screenshot, identifying key UI elements (buttons, inputs, text), and mapping them to coordinates.
- [ ] **Interaction Patterns:** Create and test scripts for common UI interactions (e.g., logging into a website, filling out a form, navigating menus).

### 4.  Monaco Editor & Preview
**Goal:** Full integration with the Monaco editor for code and document creation, with a functioning live preview.

**Tasks:**
- [ ] **Verify I/O:** Confirm that `file_get` and `file_put` with the `editor:` prefix are working reliably.
- [ ] **Preview Refresh:** Investigate and implement a mechanism to trigger the preview pane to refresh after I modify a file.
- [ ] **Live Coding Test:** Execute a full "live coding" session where I write code in the editor and you can see the preview update in real-time.