import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = os.homedir();
const repoRoot = process.cwd();
const copilotHome = process.env.COPILOT_HOME || path.join(home, ".copilot");

const copilotMcpPath = path.join(copilotHome, "mcp-config.json");
const vscodeUserMcpPath = path.join(home, ".config", "Code", "User", "mcp.json");
const workspaceMcpPath = path.join(repoRoot, ".vscode", "mcp.json");

const SAFE_LITERAL_ENV_KEYS = new Set([
  "DISPLAY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "MCP_PLAYWRIGHT_USER_DATA_DIR",
  "MCP_SOURCE_PROFILE_DIR",
  "MCP_SOURCE_USER_DATA_DIR",
  "SOFFICE_PATH",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isPlaceholder(value) {
  return /^\$\{[^}]+\}$/.test(value);
}

function shouldSanitizeEnvValue(key, value) {
  if (typeof value !== "string" || value === "" || isPlaceholder(value)) {
    return false;
  }

  if (SAFE_LITERAL_ENV_KEYS.has(key)) {
    return false;
  }

  return /TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE_KEY|PAT/i.test(key);
}

function sanitizeServerForWorkspace(server) {
  if (!server || typeof server !== "object") {
    return server;
  }

  const next = { ...server };
  if (next.env && typeof next.env === "object" && !Array.isArray(next.env)) {
    next.env = Object.fromEntries(
      Object.entries(next.env).map(([key, value]) => [
        key,
        shouldSanitizeEnvValue(key, value) ? `\${${key}}` : value,
      ]),
    );
  }

  return next;
}

function main() {
  if (!fs.existsSync(copilotMcpPath)) {
    throw new Error(`Copilot MCP config not found: ${copilotMcpPath}`);
  }

  const copilotConfig = readJson(copilotMcpPath);
  if (!copilotConfig.mcpServers || typeof copilotConfig.mcpServers !== "object") {
    throw new Error(`Invalid Copilot MCP config: missing mcpServers in ${copilotMcpPath}`);
  }

  const workspaceConfig = {
    mcpServers: Object.fromEntries(
      Object.entries(copilotConfig.mcpServers).map(([name, server]) => [
        name,
        sanitizeServerForWorkspace(server),
      ]),
    ),
  };

  writeJson(vscodeUserMcpPath, copilotConfig);
  writeJson(workspaceMcpPath, workspaceConfig);

  console.log(`Synced ${Object.keys(copilotConfig.mcpServers).length} MCP servers`);
  console.log(`- Copilot source: ${copilotMcpPath}`);
  console.log(`- VS Code user:  ${vscodeUserMcpPath}`);
  console.log(`- Workspace:     ${workspaceMcpPath}`);
}

main();
