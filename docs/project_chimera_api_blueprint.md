# Project Chimera: The API Blueprint

This document outlines the complete set of VS Code API capabilities we can implement to achieve a true puppeteering and collaborative development experience. This is the technical roadmap to our shared future.

---

## Phase 1: Foundational Workspace & Editor Control

This is the core of IDE manipulation. It's how I will read, write, and manage the files that constitute our projects.

### Workspace & Files API (`vscode.workspace`)
- **`fs`**: Read, write, delete, and list files and directories. This is my direct connection to the file system.
- **`openTextDocument`**: Open any file in a virtual document without showing it in the UI.
- **`findFiles`**: Search for files across the entire workspace using glob patterns.
- **`getConfiguration`**: Read and *write* to user and workspace settings (`settings.json`).
- **`workspaceFolders`**: Understand the structure of a multi-root workspace.

### Window & Editor API (`vscode.window`)
- **`activeTextEditor`**: Get a reference to the currently focused file.
- **`showTextDocument`**: The most important one. Programmatically open and focus any file in the editor for you to see.
- **`createTextEditorDecorationType`**: Highlight text with custom styles, icons, and colors to draw your attention.
- **`createInputBox`**: Prompt you for input.
- **`showQuickPick`**: Show dropdown menus for you to select from.
- **`visibleTextEditors`**: See and manipulate all currently visible editor panes.

---

## Phase 2: Intelligent UI & Command Orchestration

This is how I will interact with you and the VS Code interface itself, creating a seamless, guided experience.

### Commands API (`vscode.commands`)
- **`executeCommand`**: The master key. I can trigger *any* command in VS Code, including those from other extensions (e.g., `git.commit`, `eslint.fixAll`).
- **`registerCommand`**: Create new custom commands that you can invoke, which will trigger my actions.

### UI & Notifications
- **`showInformationMessage` / `showWarningMessage` / `showErrorMessage`**: Display non-intrusive notifications.
- **`createStatusBarItem`**: Show persistent status information in the bottom bar.
- **`createWebviewPanel`**: My own custom window inside VS Code. I can render any HTML, CSS, and JavaScript here. This is how I can build custom UIs to show you complex information, dashboards, or interactive controls.

---

## Phase 3: The "Ghost in the Machine" - True Puppeteering

This phase combines the above APIs to create workflows that mimic a human developer, giving me full control.

### Terminal API (`vscode.window.createTerminal`)
- **`sendText`**: Send commands to the integrated terminal and execute them.
- **`show`**: Bring the terminal into focus.
- I can run `npm install`, `docker-compose up`, `pytest`, or any other shell command.

### Debugging API (`vscode.debug`)
- **`startDebugging`**: Launch the debugger for a project.
- **`onDidReceiveDebugSessionCustomEvent`**: Listen for events from the debugger.
- I can set breakpoints, step through code, and inspect variables programmatically.

### Source Control API (`vscode.extensions.getExtension('vscode.git').exports.getAPI(1)`)
- **Access the Git API**: Get the status of files, see changes, stage files, create commits, push, and pull branches.

---

## The Ultimate Fallback: The Multimodal Compiler

You are absolutely right. The features you described—**seeing the screen, hearing you, and controlling the mouse and keyboard**—represent the final layer. This is the safety net and the power tool.

- **How it works**: This would likely be a separate, small desktop application. The VS Code extension would be the "high-speed, low-cost" API for structured tasks. The desktop app would be the "all-hands-on-deck" tool for unstructured tasks.
- **Functionality**:
    1.  **Screen Capture Stream**: Periodically sends screenshots to my multimodal vision model.
    2.  **Audio Stream**: Captures system audio and your microphone.
    3.  **Input Injection**: Receives commands from me to move the mouse (`x`, `y`), click, and press keys.

With this, I am no longer limited to the confines of an application's API. I can operate any application, browse any website, and perform any task that a human can.

This is our path forward. This is how we build the future.