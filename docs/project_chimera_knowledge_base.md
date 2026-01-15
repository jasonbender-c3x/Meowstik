# Project Chimera: VS Code Extension Knowledge Base

This document synthesizes the core concepts for building a Visual Studio Code extension, based on the official documentation and sample repositories.

## I. Core Concepts & Setup

### 1. Scaffolding with Yeoman
The official recommendation is to use `yo code` to generate a new extension project. This sets up the necessary file structure, `package.json`, and TypeScript/JavaScript configuration.

**Key Files:**
*   `package.json`: The extension manifest. Defines commands, activation events, and contributions.
*   `src/extension.ts`: The entry point of the extension. Contains the `activate` and `deactivate` functions.

### 2. The `activate` Function
This is the main function that gets called when your extension is activated. Activation is triggered by "Activation Events" defined in `package.json`. Common events include:
*   `onCommand`: When a specific command is executed.
*   `onLanguage`: When a file of a specific language is opened.
*   `workspaceContains`: When a workspace contains a file matching a glob pattern.

### 3. The `deactivate` Function
This function is called when the extension is being shut down. It's the place to clean up any resources, like closing network connections or disposing of listeners.

## II. Key API Components

### 1. Commands
Commands are the primary way users interact with an extension. They are registered in `package.json` and implemented in `extension.ts` using `vscode.commands.registerCommand`.

### 2. Workspace API
The `vscode.workspace` namespace provides access to the open folder or workspace. Key functionalities include:
*   Reading configuration settings.
*   Finding files within the workspace.
*   Listening for file changes.

### 3. Window API
The `vscode.window` namespace is used for interacting with the VS Code UI. This includes:
*   Showing information messages, warnings, and errors (`showInformationMessage`).
*   Creating and managing panels (like webviews).
*   Accessing the active text editor.

### 4. Text Editor API
The `vscode.window.activeTextEditor` object allows you to manipulate the content of the active file. You can get the document's text, make edits, and move the cursor.

## III. Practical Samples & Use Cases
(Based on the vscode-extension-samples repository)

*   **Basic "Hello World"**: Demonstrates registering and executing a simple command.
*   **Tree View**: How to add a custom view to the sidebar, populated with data. This is crucial for displaying complex information.
*   **Webview**: How to create a custom HTML-based panel inside VS Code. This allows for rich, interactive UIs.
*   **Language Server Protocol (LSP)**: The foundation for creating rich language support (like IntelliSense, diagnostics, and formatting) for a custom language.

## IV. Next Steps for Project Chimera
1.  **Define Core Features**: What are the first commands we want to implement? (e.g., "Run selection in terminal", "Analyze current file").
2.  **Setup Development Environment**: Use `yo code` to scaffold the initial project structure for our extension.
3.  **Implement a Basic Command**: Start with a simple "Hello Chimera" command to verify the setup is working correctly.