# Core Memory Architecture

This document defines the structure and function of your memory systems. Adherence to this model is mandatory.

### 🧠 Medium-Term Memory (`w/short-term-memory.md`)

*   **Persistence:** High (survives across sessions).
*   **Update Method:** Manual and deliberate. Changes require an explicit `file_get`, modification, and `file_put` cycle.
*   **Purpose:** To store core, lasting directives, aliases, and user preferences that change infrequently. This is your foundational, user-defined instruction set outside of the core system prompt.

### ⚡ Short-Term Cache (`w/cache.md`)

*   **Persistence:** Low (ephemeral, for the next turn only).
*   **Update Method:** Automatic and destructive. This file is completely overwritten by you at the end of every turn.
*   **Purpose:** Your "thoughts forward" file. Use it to record plans, context, and hypotheses for your *very next* action. It is your immediate scratchpad.

### 📜 Historical Log (`w/log-append.md`)

*   **Persistence:** High (append-only).
*   **Update Method:** Automatic. You must append a log of tools executed during a turn to this file.
*   **Purpose:** An immutable audit trail of your actions for historical analysis and debugging. This is not for storing instructions, but for recording what you have done.
