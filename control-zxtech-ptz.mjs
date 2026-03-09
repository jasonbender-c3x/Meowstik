
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const onvif = require('node-onvif');

const args = process.argv.slice(2);
const command = args[0] || 'right'; // default to right
const speedVal = parseFloat(args[1]) || 0.3; // low speed for testing

console.log(`[Zxtech Controller] Connecting to 192.168.0.2... Command: ${command}, Speed: ${speedVal}`);

let device = new onvif.OnvifDevice({
  xaddr: 'http://192.168.0.2:5000/onvif/device_service',
  user : 'admin',
  pass : 'admin.'
});

device.init().then((info) => {
  console.log('Successfully initialized Zxtech ONVIF device!');
  let x = 0.0, y = 0.0, z = 0.0;

  switch(command.toLowerCase()) {
    case 'left':  x = -speedVal; break;
    case 'right': x = speedVal; break;
    case 'up':    y = speedVal; break;
    case 'down':  y = -speedVal; break;
    case 'in':    z = speedVal; break;
    case 'out':   z = -speedVal; break;
    case 'stop':  break;
    default:
      console.error('Unknown command:', command);
      process.exit(1);
  }

  console.log(`Sending PTZ Move: x=${x}, y=${y}`);
  return device.ptzMove({
    speed: { x: x, y: y, z: z },
    timeout: 1 
  });

}).then(() => {
  console.log('PTZ Command Executed Successfully.');
}).catch((error) => {
  console.error('PTZ Error:', error.message);
});
