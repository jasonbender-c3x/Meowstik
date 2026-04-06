// ESM compatibility shim.
// Node.js ESM does not support bare directory imports (ERR_UNSUPPORTED_DIR_IMPORT).
// Bundler/Vite tooling resolves them fine at build time, but the runtime path
// is safer with an explicit re-export from the split module directory.
export * from "./codebase-analyzer/index";
