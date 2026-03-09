import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG = path.join(LOG_DIR, 'error.log');
const ACCESS_LOG = path.join(LOG_DIR, 'access.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export const logError = (err: any) => {
  const timestamp = new Date().toISOString();
  const message = err instanceof Error ? `${err.stack || err.message}` : JSON.stringify(err);
  fs.appendFileSync(ERROR_LOG, `[${timestamp}] ERROR: ${message}\n`);
};

export const logAccess = (msg: string) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(ACCESS_LOG, `[${timestamp}] ${msg}\n`);
};
