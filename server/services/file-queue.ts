/**
 * =============================================================================
 * FILE-BASED QUEUE SERVICE
 * =============================================================================
 * 
 * Per v2 philosophy (01-core-philosophy.md Axiom 2):
 * "Files Are the Database - Queue System = Directories"
 * 
 * Queue Structure:
 * queues/
 *   worker-name/
 *     job-{timestamp}-p{priority}-{id}.json    # Pending jobs
 *     .processing/
 *       job-xxx.json                            # Jobs being processed
 *     finished/
 *       job-xxx.json                            # Completed jobs
 *     failed/
 *       job-xxx.json                            # Failed jobs
 * 
 * Job File Format:
 * {
 *   "id": "abc123",
 *   "type": "code-analysis",
 *   "priority": 5,
 *   "created": "2026-01-19T...",
 *   "input": { ... },
 *   "audit": [
 *     { "event": "created", "timestamp": "..." },
 *     { "event": "claimed", "timestamp": "...", "worker": "..." },
 *     { "event": "completed", "timestamp": "...", "result": {...} }
 *   ]
 * }
 * 
 * =============================================================================
 */

import * as fs from "fs";
import * as path from "path";
import { nanoid } from "nanoid";

const QUEUES_DIR = path.join(process.cwd(), "queues");

export interface Job {
  id: string;
  type: string;
  priority: number;
  created: string;
  input: Record<string, unknown>;
  title?: string;
  description?: string;
  audit: AuditEntry[];
}

export interface AuditEntry {
  event: string;
  timestamp: string;
  worker?: string;
  result?: unknown;
  error?: string;
}

/**
 * Generate a job filename with sortable priority
 * Format: job-{timestamp}-p{priority}-{id}.json
 */
function jobFilename(timestamp: number, priority: number, id: string): string {
  const paddedPriority = String(priority).padStart(2, "0");
  return `job-${timestamp}-p${paddedPriority}-${id}.json`;
}

/**
 * Parse job info from filename
 */
function parseFilename(filename: string): { timestamp: number; priority: number; id: string } | null {
  const match = filename.match(/^job-(\d+)-p(\d+)-(.+)\.json$/);
  if (!match) return null;
  return {
    timestamp: parseInt(match[1], 10),
    priority: parseInt(match[2], 10),
    id: match[3],
  };
}

/**
 * Ensure queue directory structure exists
 */
function ensureQueueDir(workerName: string): string {
  const queuePath = path.join(QUEUES_DIR, workerName);
  const processingPath = path.join(queuePath, ".processing");
  const finishedPath = path.join(queuePath, "finished");
  const failedPath = path.join(queuePath, "failed");

  for (const dir of [queuePath, processingPath, finishedPath, failedPath]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return queuePath;
}

/**
 * Create a new job in the queue
 */
export function createJob(
  workerName: string,
  type: string,
  input: Record<string, unknown>,
  options?: {
    priority?: number;
    title?: string;
    description?: string;
  }
): Job {
  const queuePath = ensureQueueDir(workerName);
  const id = nanoid(8);
  const timestamp = Date.now();
  const priority = options?.priority ?? 5;

  const job: Job = {
    id,
    type,
    priority,
    created: new Date().toISOString(),
    input,
    title: options?.title,
    description: options?.description,
    audit: [
      {
        event: "created",
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const filename = jobFilename(timestamp, priority, id);
  const filepath = path.join(queuePath, filename);
  fs.writeFileSync(filepath, JSON.stringify(job, null, 2), "utf-8");

  console.log(`[file-queue] Created job: ${workerName}/${filename}`);
  return job;
}

/**
 * List jobs in a queue
 */
export function listJobs(
  workerName: string,
  status: "pending" | "processing" | "finished" | "failed" = "pending"
): Job[] {
  const queuePath = ensureQueueDir(workerName);
  
  let targetDir: string;
  switch (status) {
    case "processing":
      targetDir = path.join(queuePath, ".processing");
      break;
    case "finished":
      targetDir = path.join(queuePath, "finished");
      break;
    case "failed":
      targetDir = path.join(queuePath, "failed");
      break;
    default:
      targetDir = queuePath;
  }

  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith(".json") && f.startsWith("job-"));
  
  const jobs: Job[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(targetDir, file), "utf-8");
      jobs.push(JSON.parse(content));
    } catch (err) {
      console.error(`[file-queue] Failed to read ${file}:`, err);
    }
  }

  // Sort by priority (higher first), then by timestamp (older first)
  jobs.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(a.created).getTime() - new Date(b.created).getTime();
  });

  return jobs;
}

/**
 * Claim the next job (move to .processing/)
 * Sorts by priority (higher first), then by timestamp (older first)
 */
export function claimJob(workerName: string, workerId?: string): Job | null {
  const queuePath = ensureQueueDir(workerName);
  
  const files = fs.readdirSync(queuePath)
    .filter(f => f.endsWith(".json") && f.startsWith("job-"));

  if (files.length === 0) {
    return null;
  }

  // Parse all filenames to get priority and timestamp, then sort correctly
  const parsed = files.map(f => ({ filename: f, ...parseFilename(f) }))
    .filter(p => p.priority !== undefined) as Array<{ filename: string; timestamp: number; priority: number; id: string }>;

  // Sort by priority DESC (higher priority first), then by timestamp ASC (older first)
  parsed.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.timestamp - b.timestamp;
  });

  if (parsed.length === 0) {
    return null;
  }

  const filename = parsed[0].filename;
  const sourcePath = path.join(queuePath, filename);
  const targetPath = path.join(queuePath, ".processing", filename);

  try {
    // Atomic move (claim)
    fs.renameSync(sourcePath, targetPath);
    
    // Update job with claim event
    const content = fs.readFileSync(targetPath, "utf-8");
    const job: Job = JSON.parse(content);
    job.audit.push({
      event: "claimed",
      timestamp: new Date().toISOString(),
      worker: workerId || "default",
    });
    fs.writeFileSync(targetPath, JSON.stringify(job, null, 2), "utf-8");

    console.log(`[file-queue] Claimed job: ${workerName}/${filename}`);
    return job;
  } catch (err) {
    // Another worker may have claimed it
    console.error(`[file-queue] Failed to claim ${filename}:`, err);
    return null;
  }
}

/**
 * Claim a specific job by ID (move to .processing/)
 */
export function claimJobById(workerName: string, jobId: string, workerId?: string): Job | null {
  const queuePath = ensureQueueDir(workerName);
  
  const files = fs.readdirSync(queuePath)
    .filter(f => f.endsWith(".json") && f.startsWith("job-") && f.includes(jobId));

  if (files.length === 0) {
    console.error(`[file-queue] Job not found: ${jobId}`);
    return null;
  }

  const filename = files[0];
  const sourcePath = path.join(queuePath, filename);
  const targetPath = path.join(queuePath, ".processing", filename);

  try {
    fs.renameSync(sourcePath, targetPath);
    
    const content = fs.readFileSync(targetPath, "utf-8");
    const job: Job = JSON.parse(content);
    job.audit.push({
      event: "claimed",
      timestamp: new Date().toISOString(),
      worker: workerId || "default",
    });
    fs.writeFileSync(targetPath, JSON.stringify(job, null, 2), "utf-8");

    console.log(`[file-queue] Claimed specific job: ${workerName}/${filename}`);
    return job;
  } catch (err) {
    console.error(`[file-queue] Failed to claim ${filename}:`, err);
    return null;
  }
}

/**
 * Complete a job (move to finished/)
 */
export function completeJob(workerName: string, jobId: string, result: unknown): boolean {
  const queuePath = ensureQueueDir(workerName);
  const processingDir = path.join(queuePath, ".processing");
  const finishedDir = path.join(queuePath, "finished");

  const files = fs.readdirSync(processingDir).filter(f => f.includes(jobId));
  if (files.length === 0) {
    console.error(`[file-queue] Job not found in processing: ${jobId}`);
    return false;
  }

  const filename = files[0];
  const sourcePath = path.join(processingDir, filename);
  const targetPath = path.join(finishedDir, filename);

  try {
    const content = fs.readFileSync(sourcePath, "utf-8");
    const job: Job = JSON.parse(content);
    job.audit.push({
      event: "completed",
      timestamp: new Date().toISOString(),
      result,
    });
    fs.writeFileSync(sourcePath, JSON.stringify(job, null, 2), "utf-8");
    fs.renameSync(sourcePath, targetPath);

    console.log(`[file-queue] Completed job: ${workerName}/${filename}`);
    return true;
  } catch (err) {
    console.error(`[file-queue] Failed to complete ${filename}:`, err);
    return false;
  }
}

/**
 * Fail a job (move to failed/)
 */
export function failJob(workerName: string, jobId: string, error: string): boolean {
  const queuePath = ensureQueueDir(workerName);
  const processingDir = path.join(queuePath, ".processing");
  const failedDir = path.join(queuePath, "failed");

  const files = fs.readdirSync(processingDir).filter(f => f.includes(jobId));
  if (files.length === 0) {
    console.error(`[file-queue] Job not found in processing: ${jobId}`);
    return false;
  }

  const filename = files[0];
  const sourcePath = path.join(processingDir, filename);
  const targetPath = path.join(failedDir, filename);

  try {
    const content = fs.readFileSync(sourcePath, "utf-8");
    const job: Job = JSON.parse(content);
    job.audit.push({
      event: "failed",
      timestamp: new Date().toISOString(),
      error,
    });
    fs.writeFileSync(sourcePath, JSON.stringify(job, null, 2), "utf-8");
    fs.renameSync(sourcePath, targetPath);

    console.log(`[file-queue] Failed job: ${workerName}/${filename}`);
    return true;
  } catch (err) {
    console.error(`[file-queue] Failed to mark as failed ${filename}:`, err);
    return false;
  }
}

/**
 * Get queue statistics
 */
export function getQueueStats(workerName: string): {
  pending: number;
  processing: number;
  finished: number;
  failed: number;
} {
  const queuePath = ensureQueueDir(workerName);

  const countFiles = (dir: string): number => {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(f => f.endsWith(".json") && f.startsWith("job-")).length;
  };

  return {
    pending: countFiles(queuePath),
    processing: countFiles(path.join(queuePath, ".processing")),
    finished: countFiles(path.join(queuePath, "finished")),
    failed: countFiles(path.join(queuePath, "failed")),
  };
}

/**
 * List all queue workers (directories)
 */
export function listWorkers(): string[] {
  if (!fs.existsSync(QUEUES_DIR)) {
    return [];
  }

  return fs.readdirSync(QUEUES_DIR).filter(f => {
    const fullPath = path.join(QUEUES_DIR, f);
    return fs.statSync(fullPath).isDirectory() && !f.startsWith(".");
  });
}

/**
 * Get a specific job by ID
 */
export function getJob(workerName: string, jobId: string): { job: Job; status: string } | null {
  const queuePath = ensureQueueDir(workerName);

  const locations = [
    { dir: queuePath, status: "pending" },
    { dir: path.join(queuePath, ".processing"), status: "processing" },
    { dir: path.join(queuePath, "finished"), status: "finished" },
    { dir: path.join(queuePath, "failed"), status: "failed" },
  ];

  for (const { dir, status } of locations) {
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir).filter(f => f.includes(jobId));
    if (files.length > 0) {
      const content = fs.readFileSync(path.join(dir, files[0]), "utf-8");
      return { job: JSON.parse(content), status };
    }
  }

  return null;
}

export default {
  createJob,
  listJobs,
  claimJob,
  claimJobById,
  completeJob,
  failJob,
  getQueueStats,
  listWorkers,
  getJob,
};
