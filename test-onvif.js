import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const onvif = require('node-onvif');

console.log('Starting ONVIF discovery...');

// Check 192.168.0.4 on port 5000 
console.log('Checking 192.168.0.4:5000');
let device = new onvif.OnvifDevice({
  xaddr: 'http://192.168.0.4:5000/onvif/device_service',
  user : 'admin',
  pass : 'clear'
});

device.init().then((info) => {
  console.log('Connected to 192.168.0.4:5000');
  console.log(JSON.stringify(info, null, '  '));
  console.log('Stream URL: ' + device.getUdpStreamUrl());
}).catch((error) => {
  console.error('Error on 192.168.0.4:5000:', error.message);
  
  // Check port 80 just in case
  console.log('Checking 192.168.0.4:80');
    let device80 = new onvif.OnvifDevice({
    xaddr: 'http://192.168.0.4:80/onvif/device_service',
    user : 'admin',
    pass : 'clear'
    });

    device80.init().then((info) => {
    console.log('Connected to 192.168.0.4:80');
    console.log('Stream URL: ' + device80.getUdpStreamUrl());
    }).catch((err) => {
    console.error('Error on 192.168.0.4:80:', err.message);

        // Check port 10000
        console.log('Checking 192.168.0.4:10000');
        let device10k = new onvif.OnvifDevice({
        xaddr: 'http://192.168.0.4:10000/onvif/device_service',
        user : 'admin',
        pass : 'clear'
        });

        device10k.init().then((info) => {
        console.log('Connected to 192.168.0.4:10000');
        console.log('Stream URL: ' + device10k.getUdpStreamUrl());
        }).catch((err) => {
        console.error('Error on 192.168.0.4:10000:', err.message);
        });
    });
});
