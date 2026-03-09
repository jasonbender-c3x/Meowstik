/**
 * 🐾 Meowstik PTY Wrapper
 * Version: 0.1.0-alpha
 * 
 * Provides a persistent terminal interface using 'screen'.
 * 
 * Usage: 
 *   node scripts/pty_wrapper.js start <session_name>
 *   node scripts/pty_wrapper.js exec <session_name> <command>
 *   node scripts/pty_wrapper.js read <session_name>
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const action = process.argv[2];
const sessionName = process.argv[3] || 'meowstik-pty';
const command = process.argv.slice(4).join(' ');

const HARDCOPY_FILE = `/tmp/screen_hardcopy_${sessionName}`;

function run(cmd) {
    try {
        return execSync(cmd).toString();
    } catch (e) {
        return e.message;
    }
}

switch (action) {
    case 'start':
        console.log(`🚀 Starting screen session: ${sessionName}`);
        // Start a detached screen session
        run(`screen -dmS ${sessionName} /bin/bash`);
        break;

    case 'exec':
        if (!command) {
            console.error('❌ No command provided');
            process.exit(1);
        }
        console.log(`⌨️ Executing in ${sessionName}: ${command}`);
        // 'stuff' command into the session followed by a newline
        run(`screen -S ${sessionName} -X stuff "${command}\n"`);
        break;

    case 'read':
        // Generate a hardcopy of the screen buffer
        run(`screen -S ${sessionName} -X hardcopy ${HARDCOPY_FILE}`);
        if (fs.existsSync(HARDCOPY_FILE)) {
            const content = fs.readFileSync(HARDCOPY_FILE, 'utf8');
            console.log(content);
            // Optional: clean up file
            // fs.unlinkSync(HARDCOPY_FILE);
        } else {
            console.error('❌ Could not read buffer');
        }
        break;

    case 'status':
        console.log(run(`screen -ls`));
        break;

    default:
        console.log('🐾 Meowstik PTY Wrapper HELP');
        console.log('Available actions: start, exec, read, status');
}
