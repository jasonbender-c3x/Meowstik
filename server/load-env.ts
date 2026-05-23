
import fs from "node:fs";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ENVIRONMENT_OVERRIDES_PATH } from "./services/environment-manager";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

function stripWrappingQuotes(): void {
  for (const key in process.env) {
    if (process.env[key]?.startsWith('"') && process.env[key]?.endsWith('"')) {
      process.env[key] = process.env[key]?.substring(1, process.env[key]!.length - 1);
    }
  }
}

function loadEnvFile(filePath: string, label: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const result = dotenv.config({ path: filePath, override: true });

  if (result.error) {
    console.error(`❌ [Env] Error loading ${label}:`, result.error);
    return;
  }

  stripWrappingQuotes();
  console.log(`✅ [Env] Loaded ${label}.`);
}

loadEnvFile(envPath, ".env");
loadEnvFile(ENVIRONMENT_OVERRIDES_PATH, "managed environment overrides");


