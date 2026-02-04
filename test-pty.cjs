
try {
  const pty = require('node-pty');
  console.log('node-pty loaded successfully');
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
