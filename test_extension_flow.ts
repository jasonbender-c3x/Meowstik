
import WebSocket from 'ws';

const WS_URL = 'ws://localhost:5000/api/extension/connect';

function testExtensionConnection() {
  console.log('Connecting to server as extension...');
  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('Connected!');
    
    // Simulate extension handshake
    ws.send(JSON.stringify({
      type: 'extension_connected',
      capabilities: ['page_content']
    }));

    // Simulate sending page content
    setTimeout(() => {
      console.log('Sending mock page content...');
      ws.send(JSON.stringify({
        type: 'page_content',
        url: 'https://example.com',
        title: 'Example Domain',
        content: 'This is a test page content.',
        html: '<html><body><h1>Example Domain</h1></body></html>'
      }));
    }, 1000);

    // Keep alive for a bit then close
    setTimeout(() => {
      console.log('Closing connection...');
      ws.close();
      process.exit(0);
    }, 3000);
  });

  ws.on('message', (data) => {
    console.log('Received message from server:', data.toString());
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    process.exit(1);
  });
}

testExtensionConnection();
