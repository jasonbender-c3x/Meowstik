import { desktopService } from './server/services/desktop-service.js';
import fs from 'fs';

console.log('Testing DesktopService integration...');

// Need to allow some time for initialization
setTimeout(async () => {
    try {
        console.log('Starting capture...');
        desktopService.startCapture();

        // Listen for frame event
        desktopService.once('frame', (buffer) => {
            console.log('Frame received via event! Size:', buffer.length);
        });

        // Wait 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));

        const snapshot = desktopService.getSnapshot();
        if (snapshot) {
            console.log('Snapshot retrieved! Size:', snapshot.length);
            fs.writeFileSync('test_desktop_service.jpg', snapshot);
            console.log('Saved snapshot to test_desktop_service.jpg');
        } else {
            console.error('No snapshot retrieved!');
        }

        console.log('Stopping capture...');
        desktopService.stopCapture();
        
        console.log('DesktopService verification complete.');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}, 1000);
