
import * as pty from 'node-pty';

console.log('Starting TSX test...');
try {
  console.log('node-pty imported successfully');
  const term = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });
  console.log('Term spawned with PID:', term.pid);
  term.destroy();
} catch (e) {
  console.error('Failed to load node-pty:', e);
}
