
import { desktopService } from './server/services/desktop-service';

async function testInput() {
  console.log('Testing Desktop Input...');

  try {
    // 1. Move Mouse
    console.log('Moving mouse to (100, 100)...');
    await desktopService.performAction({ type: 'move', x: 100, y: 100 });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Move Mouse again
    console.log('Moving mouse to (200, 200)...');
    await desktopService.performAction({ type: 'move', x: 200, y: 200 });

    console.log('Mouse movement test complete.');
    
    // 3. Test Typing (safe string)
    // console.log('Typing "hello"...');
    // await desktopService.performAction({ type: 'type', text: 'hello' });

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testInput();
