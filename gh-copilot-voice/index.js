#!/usr/bin/env node

import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import util from "util";
import ora from "ora";
import chalk from "chalk";
import boxen from "boxen";
import inquirer from "inquirer";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup environment
dotenv.config();

async function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Helper to log to Meowstik Terminal
async function logToTerminal(message, source = 'CLI') {
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch('http://localhost:5001/api/terminal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, source })
    });
  } catch (e) {
    // Ignore errors if server is down
  }
}

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Configuration
const CONFIG_DIR = path.join(os.homedir(), '.config', 'gh-copilot-voice');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Ensure config dir exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Load or create config
let config = {};
if (fs.existsSync(CONFIG_FILE)) {
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {}
}

async function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// --- Main CLI Logic ---

async function main() {
  console.log(boxen(chalk.blue('GH Copilot Voice Extension'), { padding: 1, borderStyle: 'round' }));

  // 1. Check dependencies
  try {
    await execPromise('gh copilot --version');
  } catch (e) {
    console.error(chalk.red('❌ GitHub CLI (gh) or Copilot extension not installed.'));
    console.log('Please run: gh extension install github/gh-copilot');
    process.exit(1);
  }

  // 2. Check API Key
  let apiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY;
  if (!apiKey) {
    const answer = await inquirer.prompt([{
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Google Gemini API Key:',
    }]);
    apiKey = answer.apiKey;
    await saveConfig({ GEMINI_API_KEY: apiKey });
  }

  // 3. Get User Input
  const args = process.argv.slice(2);
  let prompt = args.join(' ');

  if (!prompt) {
    const answer = await inquirer.prompt([{
      type: 'input',
      name: 'prompt',
      message: 'What do you want to ask Copilot?',
    }]);
    prompt = answer.prompt;
  }

  // 4. Query GH Copilot
  const spinner = ora('Asking GitHub Copilot...').start();
  let copilotResponse = '';
  
  await logToTerminal(`User: ${prompt}`, 'VoiceCLI');

  try {
    // We use 'gh copilot explain' for general queries as it gives better prose
    const { stdout } = await execPromise(`gh copilot explain "${prompt}"`);
    copilotResponse = stdout;
    spinner.succeed('Copilot responded.');
    await logToTerminal(`Copilot: ${stdout.substring(0, 200)}...`, 'VoiceCLI');
  } catch (e) {
    spinner.fail('Failed to query Copilot.');
    console.error(e.message);
    process.exit(1);
  }

  console.log(chalk.green('\n--- Copilot Says: ---\n'));
  console.log(copilotResponse);
  console.log(chalk.green('\n---------------------\n'));

  // 5. Enhance with Voice (Gemini TTS via API or similar)
  // Since we don't have direct Google TTS API access without service account,
  // we will simulate voice or use a system TTS if available, 
  // OR we can use Gemini to "humanize" the text before reading it.
  
  const voiceSpinner = ora('Generating Voice...').start();
  
  // SPECIAL FEATURE: If the prompt asks to "open camera", "find camera", or "scan network"
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes('camera') || lowerPrompt.includes('scan') || lowerPrompt.includes('network')) {
     voiceSpinner.info('Detected network/camera command.');
     // In a real integration, we would send a signal to the running desktop app via IPC or WebSocket
     // For now, we'll run the find_camera.sh script if available
     try {
       // Check if desktop agent is available via API
       try {
         const fetch = (await import('node-fetch')).default;
         // 1. Get active sessions
         const sessionsRes = await fetch('http://localhost:5001/api/desktop/sessions');
         const sessionsData = await sessionsRes.json();
         
         if (sessionsData.sessions && sessionsData.sessions.length > 0) {
           // Use the first active session
           const sessionId = sessionsData.sessions[0].id;
           console.log(chalk.blue(`\nFound active desktop session: ${sessionId}`));
           
           // 2. Trigger scan
           const scanRes = await fetch(`http://localhost:5001/api/desktop/sessions/${sessionId}/scan-network`, {
             method: 'POST'
           });
           
           if (scanRes.ok) {
              console.log(chalk.green('✅ Network scan command sent to Desktop Agent.'));
              copilotResponse = "I've instructed your desktop agent to scan the network. Check the desktop app console for results.";
           } else {
              throw new Error('API scan failed');
           }
         } else {
           throw new Error('No active sessions');
         }
       } catch (apiError) {
         // Fallback to local script
         const scriptPath = path.join(__dirname, '..', 'find_camera.sh');
         if (fs.existsSync(scriptPath)) {
           console.log(chalk.yellow('\nRunning Camera Discovery (Fallback Script)...'));
           const { stdout } = await execPromise(`bash "${scriptPath}"`);
           console.log(stdout);
           copilotResponse = "I've scanned your network using the fallback script. Check the output above.";
         }
       }
     } catch(e) {
       console.error('Failed to run discovery:', e);
     }
  }

  // For this standalone tool, we'll try to use a simple TTS approach
  // If on macOS, use 'say'. If Linux, 'espeak' or 'festival'.
  
  try {
    if (process.platform === 'darwin') {
      await execPromise(`say "${escapeShell(copilotResponse.substring(0, 500))}"`);
    } else if (process.platform === 'linux') {
       // Try espeak
       try {
         await execPromise(`espeak "${escapeShell(copilotResponse.substring(0, 500))}"`);
       } catch (e) {
         // Try spd-say
         await execPromise(`spd-say "${escapeShell(copilotResponse.substring(0, 500))}"`);
       }
    }
    voiceSpinner.succeed('Voice playback complete.');
  } catch (e) {
    voiceSpinner.warn('Could not play voice (espeak/say not found). Text displayed above.');
  }
}

function escapeShell(cmd) {
  return cmd.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

main().catch(console.error);
