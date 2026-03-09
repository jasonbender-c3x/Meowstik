
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const onvif = require('node-onvif');

console.log('Connecting to ONVIF for PTZ check...');

let device = new onvif.OnvifDevice({
  xaddr: 'http://192.168.0.4:5000/onvif/device_service',
  user : 'admin',
  pass : 'clear'
});

device.init().then((info) => {
  console.log('Connected!');
  
  if (device.services.ptz) {
    console.log('PTZ Service FOUND!');
    
    // Get PTZ capabilities/status if possible, or just try a move
    // node-onvif ptzMove method: device.ptzMove(params)
    // params: { speed: { x: 1.0, y: 0.0, z: 0.0 }, timeout: 1 }
    
    console.log('Attempting small move RIGHT...');
    // Speed x=0.5 (right), y=0 (no tilt), z=0 (no zoom)
    return device.ptzMove({
      speed: { x: 0.5, y: 0.0, z: 0.0 },
      timeout: 1 // stops after 1 second
    });
  } else {
    console.log('PTZ Service NOT supported by this device.');
  }
}).then(() => {
  console.log('Move command sent successfully.');
  
  // Wait a bit then move back left
  setTimeout(() => {
      console.log('Attempting small move LEFT...');
      device.ptzMove({
        speed: { x: -0.5, y: 0.0, z: 0.0 },
        timeout: 1
      }).then(() => {
          console.log('Move back command sent.');
      }).catch(err => console.error('Error moving back:', err.message));
  }, 2000);

}).catch((error) => {
  console.error('Error:', error.message);
});
