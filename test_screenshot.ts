
import screenshot from 'screenshot-desktop';
import fs from 'fs';

console.log('Attempting to capture screen...');

screenshot().then((img) => {
  console.log('Screen captured! Image buffer length:', img.length);
  fs.writeFileSync('test_screenshot.jpg', img);
  console.log('Saved to test_screenshot.jpg');
}).catch((err) => {
  console.error('Failed to capture screen:', err);
});
