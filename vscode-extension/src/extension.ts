import * as vscode from 'vscode';

// Keep track of the panel so we can reuse it
let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
	console.log('Meowstik extension is active');

	let startDisposable = vscode.commands.registerCommand('meowstik.start', async () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }

		// Create and show a new webview
		const panel = vscode.window.createWebviewPanel(
			'meowstikChat',
			'Meowstik AI',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)]
			}
		);
        
        currentPanel = panel;

        // Reset currentPanel when disposed
        panel.onDidDispose(() => {
            currentPanel = undefined;
        }, null, context.subscriptions);

        const config = vscode.workspace.getConfiguration('meowstik');
        let serverUrlString = config.get<string>('serverUrl') || 'http://localhost:5000';

        // Handle port forwarding/external URI resolution for remote envs (Codespaces, etc)
        let finalUrl = serverUrlString;
        try {
            const uri = vscode.Uri.parse(serverUrlString);
            // Only try to resolve if it is a localhost URL
            if (uri.authority.startsWith('localhost') || uri.authority.startsWith('127.0.0.1')) {
                const externalUri = await vscode.env.asExternalUri(uri);
                finalUrl = externalUri.toString(true); 
            }
        } catch (e) {
            console.error('Failed to resolve external URI:', e);
        }

		panel.webview.html = getWebviewContent(finalUrl);
	});

    let sendToDisposable = vscode.commands.registerCommand('meowstik.sendSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const selection = editor.document.getText(editor.selection);
        if (!selection) {
            return;
        }

        // If panel is not open, open it
        if (!currentPanel) {
            await vscode.commands.executeCommand('meowstik.start');
        } else {
            currentPanel.reveal(vscode.ViewColumn.Beside);
        }
        
        // Wait a brief moment for webview to be ready if it was just opened
        setTimeout(() => {
            if (currentPanel) {
                 currentPanel.webview.postMessage({ command: 'sendText', text: selection });
                 vscode.window.showInformationMessage(`Sent ${selection.length} characters to Meowstik AI.`);
            }
        }, 500);
    });

	context.subscriptions.push(startDisposable, sendToDisposable);
}

function getWebviewContent(serverUrl: string) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meowstik AI</title>
    <style>
        body { padding: 0; margin: 0; height: 100vh; overflow: hidden; background-color: var(--vscode-editor-background); }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <iframe src="${serverUrl}" allow="clipboard-read; clipboard-write; microphone; camera;"></iframe>
    <script>
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            const iframe = document.querySelector('iframe');
            if (message.command === 'sendText' && iframe) {
                // Forward to the iframe
                iframe.contentWindow.postMessage({
                    type: 'MEOWSTIK_INSERT_CODE',
                    code: message.text
                }, '*');
            }
        });
    </script>
</body>
</html>`;
}

export function deactivate() {}
