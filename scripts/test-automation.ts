
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/playwright';

async function test() {
  console.log('Starting Playwright Automation Test...');

  try {
    // 1. Create a session (navigate)
    console.log('\n1. Creating Session...');
    const navRes = await axios.post(`${BASE_URL}/navigate`, {
      url: 'https://example.com',
      headless: true
    });
    const sessionId = navRes.data.sessionId;
    console.log('Session ID:', sessionId);

    if (!sessionId) {
        throw new Error("Failed to create session");
    }

    // 2. Test Click with Modifiers (e.g. Shift+Click)
    console.log('\n2. Testing Click with Modifiers...');
    await axios.post(`${BASE_URL}/click`, {
      sessionId,
      selector: 'h1',
      modifiers: ['Shift'],
      clickCount: 1
    });
    console.log('Click successful');

    // 3. Test Type with Key (e.g. Tab)
    console.log('\n3. Testing Key Press...');
    await axios.post(`${BASE_URL}/type`, {
      sessionId,
      key: 'Tab',
      modifiers: ['Alt']
    });
    console.log('Key press successful');

    // 4. Test Touch (Tap)
    console.log('\n4. Testing Touch/Tap...');
    await axios.post(`${BASE_URL}/touch`, {
      sessionId,
      x: 100,
      y: 100
    });
    console.log('Touch successful');
    
    // 5. Test KeyDown/KeyUp (Sticky Keys)
    console.log('\n5. Testing Sticky Keys...');
    await axios.post(`${BASE_URL}/keyDown`, {
      sessionId,
      key: 'Shift'
    });
    console.log('KeyDown (Shift) successful');
    
    await axios.post(`${BASE_URL}/keyUp`, {
      sessionId,
      key: 'Shift'
    });
    console.log('KeyUp (Shift) successful');


    // 6. Test Framebuffer
    console.log('\n6. Testing Framebuffer...');
    const fbRes = await axios.get(`${BASE_URL}/framebuffer/${sessionId}`, {
        responseType: 'arraybuffer'
    });
    console.log(`Framebuffer received: ${fbRes.data.length} bytes`);


    // 7. Cleanup
    console.log('\n7. Closing Session...');
    await axios.post(`${BASE_URL}/close`, { sessionId });
    console.log('Session closed');

    console.log('\nAll tests passed! ✅');
  } catch (error: any) {
    console.error('\nTest failed! ❌');
    if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
    } else {
        console.error(error.message);
    }
    process.exit(1);
  }
}

test();
