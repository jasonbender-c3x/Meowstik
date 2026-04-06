
async function test() {
  const BASE_URL = 'http://localhost:5001/api/playwright';
  
  console.log('Starting Playwright Automation Test (using fetch on port 5001)...');

  try {
    let sessionId = "";
    
    // Helper for POST requests
    const post = async (endpoint, body) => {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST ${endpoint} failed: ${res.status} ${text}`);
      }
      return res.json();
    };

    // 1. Create a session (navigate)
    console.log('\n1. Creating Session...');
    const navRes = await post('/navigate', {
      url: 'https://example.com',
      headless: true
    });
    sessionId = navRes.sessionId;
    console.log('Session ID:', sessionId);

    if (!sessionId) {
        throw new Error("Failed to create session");
    }

    // 2. Test Click with Modifiers (e.g. Shift+Click)
    console.log('\n2. Testing Click with Modifiers...');
    await post('/click', {
      sessionId,
      selector: 'h1',
      modifiers: ['Shift'],
      clickCount: 1
    });
    console.log('Click successful');

    // 3. Test Type with Key (e.g. Tab)
    console.log('\n3. Testing Key Press (Alt+Tab emulation)...');
    // Emulate holding Alt and pressing Tab
    await post('/keyDown', { sessionId, key: 'Alt' });
    await post('/type', { sessionId, key: 'Tab' });
    await post('/keyUp', { sessionId, key: 'Alt' });
    console.log('Key sequence successful');

    // 4. Test Touch (Tap)
    console.log('\n4. Testing Touch/Tap...');
    await post('/touch', {
      sessionId,
      x: 100,
      y: 100
    });
    console.log('Touch successful');
    
    // 5. Test Framebuffer
    console.log('\n5. Testing Framebuffer...');
    const fbRes = await fetch(`${BASE_URL}/framebuffer/${sessionId}`);
    if (!fbRes.ok) throw new Error(`GET /framebuffer failed: ${fbRes.status}`);
    const buffer = await fbRes.arrayBuffer();
    console.log(`Framebuffer received: ${buffer.byteLength} bytes`);

    // 6. Cleanup
    console.log('\n6. Closing Session...');
    await post('/close', { sessionId });
    console.log('Session closed');

    console.log('\nAll tests passed! ✅');
  } catch (error) {
    console.error('\nTest failed! ❌');
    console.error(error.message);
    process.exit(1);
  }
}

test();
