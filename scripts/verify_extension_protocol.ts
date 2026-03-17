import { createServer } from 'http';
import { WebSocket } from 'ws';
import { setupExtensionWebSocket, scrapePage, isExtensionConnected } from '../server/websocket-extension';

// Mock console to keep output clean
const originalConsole = { ...console };
// console.log = () => {}; 

async function runTest() {
  originalConsole.log('🚀 Starting Extension Logic Test...');

  // 1. Setup Server
  const server = createServer();
  setupExtensionWebSocket(server);
  
  const port = 5001;
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      originalConsole.log(`✅ Test Server listening on port ${port}`);
      resolve();
    });
  });

  // 2. Connect "Extension" (Client)
  originalConsole.log('🔌 Connecting Simulated Extension...');
  const ws = new WebSocket(`ws://localhost:${port}/api/extension/connect`);

  let extensionSocket: WebSocket;

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      originalConsole.log('✅ Extension Connected');
      extensionSocket = ws;
      
      // Send Handshake
      ws.send(JSON.stringify({ type: 'extension_connected', capabilities: ['scrape'] }));
      resolve();
    });
    ws.on('error', reject);
  });

  // Wait a bit for server to process handshake
  await new Promise(r => setTimeout(r, 500));

  if (!isExtensionConnected()) {
    throw new Error('Server does not report extension connected!');
  }
  originalConsole.log('✅ isExtensionConnected() returned true');

  // 3. Trigger scrapePage from Server side
  originalConsole.log('⚡ Triggering scrapePage()...');
  
  // Handle requests on the "Extension" side
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    originalConsole.log(`📩 Extension received: ${msg.type} (ID: ${msg.id})`);

    if (msg.type === 'tab_control' && msg.action === 'new') {
        // Reply with a fake tab ID
        originalConsole.log('   -> Replying to tab_control (new)');
        setTimeout(() => {
            ws.send(JSON.stringify({
                id: msg.id,
                result: { id: 123 }
            }));
        }, 100);
    } else if (msg.type === 'page_content_request') {
        // Reply with fake content
        originalConsole.log('   -> Replying to page_content_request');
        setTimeout(() => {
            ws.send(JSON.stringify({
                id: msg.id,
                url: 'http://example.com',
                title: 'Example Domain',
                content: 'Hello World',
                html: '<html><body><h1>Hello World</h1></body></html>'
            }));
        }, 100);
    } else if (msg.type === 'tab_control' && msg.action === 'close') {
        // Reply success
        originalConsole.log('   -> Replying to tab_control (close)');
        setTimeout(() => {
            ws.send(JSON.stringify({
                id: msg.id,
                result: { success: true }
            }));
        }, 100);
    }
  });

  try {
    const result = await scrapePage('http://example.com');
    originalConsole.log('✅ scrapePage returned result:', result);
    
    if (result.content === 'Hello World') {
        originalConsole.log('🎉 TEST PASSED');
    } else {
        originalConsole.error('❌ TEST FAILED: Content mismatch');
        process.exit(1);
    }

  } catch (error: any) {
    originalConsole.error('❌ scrapePage FAILED:', error);
    process.exit(1);
  } finally {
    ws.close();
    server.close();
    process.exit(0);
  }
}

runTest().catch(e => {
  console.error(e);
  process.exit(1);
});
