import * as vscode from 'vscode';
import WebSocket from 'ws';

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("Meowstik");
    outputChannel.appendLine('Meowstik Extension Activated');

    // Register commands
    let connectCmd = vscode.commands.registerCommand('meowstik.connect', () => {
        connectToServer();
    });

    let disconnectCmd = vscode.commands.registerCommand('meowstik.disconnect', () => {
        if (ws) {
            ws.close();
            ws = null;
            outputChannel.appendLine('Disconnected by user');
        }
    });

    context.subscriptions.push(connectCmd);
    context.subscriptions.push(disconnectCmd);

    // Auto-connect on startup
    connectToServer();
}

export function deactivate() {
    if (ws) {
        ws.close();
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
}

function connectToServer() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        outputChannel.appendLine('Already connected');
        return;
    }

    const config = vscode.workspace.getConfiguration('meowstik');
    const url = config.get<string>('serverUrl') || 'ws://localhost:5000/api/vscode/connect';

    outputChannel.appendLine(`Connecting to ${url}...`);

    try {
        ws = new WebSocket(url);

        ws.on('open', () => {
            outputChannel.appendLine('Connected to Meowstik Server');
            vscode.window.showInformationMessage('Meowstik Connected');
            
            // Send capabilities
            send({
                type: 'vscode_connected',
                capabilities: ['write_file', 'read_file', 'execute_command']
            });
        });

        ws.on('message', (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(message);
            } catch (e) {
                outputChannel.appendLine(`Error parsing message: ${e}`);
            }
        });

        ws.on('close', () => {
            outputChannel.appendLine('Disconnected from server');
            ws = null;
            // Retry after 5s
            reconnectTimer = setTimeout(connectToServer, 5000);
        });

        ws.on('error', (err) => {
            outputChannel.appendLine(`WebSocket Error: ${err.message}`);
        });

    } catch (e: any) {
        outputChannel.appendLine(`Connection failed: ${e.message}`);
        reconnectTimer = setTimeout(connectToServer, 5000);
    }
}

function send(data: any) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

async function handleMessage(message: any) {
    outputChannel.appendLine(`Received: ${message.type}`);

    switch (message.type) {
        case 'ping':
            send({ type: 'pong', id: message.id });
            break;
            
        case 'write_file':
            await handleWriteFile(message);
            break;

        case 'read_file':
            await handleReadFile(message);
            break;

        case 'execute_command':
             await handleExecuteCommand(message);
             break;
    }
}

async function handleWriteFile(message: any) {
    try {
        const uri = vscode.Uri.file(message.path);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(message.content));
        
        // Open the document to show changes
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);

        send({
            id: message.id,
            type: 'write_file_response',
            success: true
        });
        outputChannel.appendLine(` wrote to ${message.path}`);
    } catch (e: any) {
        send({
            id: message.id,
            type: 'error',
            error: e.message
        });
    }
}

async function handleReadFile(message: any) {
    try {
        const uri = vscode.Uri.file(message.path);
        const content = await vscode.workspace.fs.readFile(uri);
        const decoder = new TextDecoder();
        
        send({
            id: message.id,
            type: 'read_file_response',
            content: decoder.decode(content),
            success: true
        });
    } catch (e: any) {
        send({
            id: message.id,
            type: 'error',
            error: e.message
        });
    }
}

async function handleExecuteCommand(message: any) {
    try {
        // Safe-guard: Ask user permission?
        // For now, just execute standard vscode commands
        // If it's a shell command, we might need a terminal
        
        if (message.command.startsWith('vscode.')) {
            await vscode.commands.executeCommand(message.command);
        } else {
             // Create a terminal for shell commands
             const terminal = vscode.window.createTerminal("Meowstik Command");
             terminal.show();
             terminal.sendText(message.command);
        }

        send({
            id: message.id,
            type: 'execute_command_response',
            success: true
        });
    } catch (e: any) {
        send({
            id: message.id,
            type: 'error',
            error: e.message
        });
    }
}
