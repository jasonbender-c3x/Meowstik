
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const onvif = require('node-onvif');

const args = process.argv.slice(2);
const command = args[0]; // left, right, up, down, in, out
const speedVal = parseFloat(args[1]) || 0.5; // default speed 0.5 (0.0 - 1.0)

if (!command) {
  console.log('Usage: node control-ptz.js <command> [speed]');
  console.log('Commands: left, right, up, down, in, out, stop');
  process.exit(1);
}

console.log(`Connecting to camera... Command: ${command}, Speed: ${speedVal}`);

// Connect to the ONVIF service
let device = new onvif.OnvifDevice({
  xaddr: 'http://192.168.0.4:5000/onvif/device_service',
  user : 'admin',
  pass : 'clear'
});

device.init().then((info) => {
  let x = 0.0, y = 0.0, z = 0.0;

  switch(command.toLowerCase()) {
    case 'left':  x = -speedVal; break;
    case 'right': x = speedVal; break;
    case 'up':    y = speedVal; break;
    case 'down':  y = -speedVal; break;
    case 'in':    z = speedVal; break;
    case 'out':   z = -speedVal; break;
    case 'stop':  break; // all 0
    default:
      console.error('Unknown command:', command);
      process.exit(1);
  }

  console.log(`Sending PTZ request: x=${x}, y=${y}, z=${z}`);

  // Move for 1 second then stop automatically (timeout parameter)
  return device.ptzMove({
    speed: { x: x, y: y, z: z },
    timeout: 1 
  });

}).then(() => {
  console.log('Done.');
}).catch((error) => {
  console.error('Error:', error.message);
});
