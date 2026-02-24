import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('❌ [Env] Error loading .env file:', result.error);
} else {
  console.log('✅ [Env] .env file loaded and variables overridden.');
  console.log('🚀 [Env] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
  console.log('🚀 [Env] GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
}
