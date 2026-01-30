/**
 * =============================================================================
 * DATABASE ADMINISTRATION API ROUTES
 * =============================================================================
 * 
 * RESTful API for database export, import, and Cloud SQL provisioning.
 * 
 * Security: These endpoints should be protected with authentication
 * and restricted to admin users only.
 * 
 * Endpoints:
 * - POST /api/database/export - Export database to file
 * - POST /api/database/import - Import from uploaded file
 * - POST /api/database/provision-cloud-sql - Provision Cloud SQL instance
 * - GET /api/database/migration-status - Check migration status
 * - GET /api/database/cloud-sql-instances - List Cloud SQL instances
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { CloudSqlProvisioner, CloudSqlConfig } from '../services/cloud-sql-provisioner';
import { writeFileSync, existsSync, unlinkSync, readFileSync } from 'fs';
import { z } from 'zod';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

// Track active migrations
const activeMigrations = new Map<string, {
  status: 'exporting' | 'importing' | 'validating' | 'complete' | 'failed';
  progress: number;
  message: string;
  startedAt: Date;
  error?: string;
}>();

/**
 * Validation schemas
 */
const exportSchema = z.object({
  format: z.enum(['sql', 'sql.gz']).optional(),
  includeSchema: z.boolean().optional(),
  includeData: z.boolean().optional(),
});

const provisionCloudSqlSchema = z.object({
  projectId: z.string().min(1),
  instanceId: z.string().min(1),
  region: z.string().min(1),
  tier: z.string().optional(),
  databaseVersion: z.string().optional(),
  diskSizeGb: z.number().optional(),
  authorizedNetworks: z.array(z.string()).optional(),
});

/**
 * POST /api/database/export
 * Export database to downloadable file
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    // Validate request
    const options = exportSchema.parse(req.body);
    
    // Generate filename
    const timestamp = Date.now();
    const format = options.format || 'sql';
    const filename = `meowstik-export-${timestamp}.${format}`;
    const filepath = `/tmp/${filename}`;

    // Build export command
    let cmd = `npx tsx scripts/db-export.ts --output=${filepath}`;
    if (format === 'sql.gz') {
      cmd += ' --compress';
    }
    if (options.includeData === false) {
      cmd += ' --schema-only';
    }
    if (options.includeSchema === false) {
      cmd += ' --data-only';
    }

    // Execute export
    const migrationId = `export-${timestamp}`;
    activeMigrations.set(migrationId, {
      status: 'exporting',
      progress: 0,
      message: 'Exporting database...',
      startedAt: new Date(),
    });

    try {
      await execAsync(cmd);

      // Update status
      activeMigrations.set(migrationId, {
        status: 'complete',
        progress: 100,
        message: 'Export complete',
        startedAt: activeMigrations.get(migrationId)!.startedAt,
      });

      // Send file
      res.download(filepath, filename, (err) => {
        if (!err) {
          // Clean up file after download
          setTimeout(() => {
            if (existsSync(filepath)) {
              unlinkSync(filepath);
            }
          }, 5000);
        }
      });
    } catch (error: any) {
      activeMigrations.set(migrationId, {
        status: 'failed',
        progress: 0,
        message: 'Export failed',
        startedAt: activeMigrations.get(migrationId)!.startedAt,
        error: error.message,
      });
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Export failed', message: error.message });
  }
});

/**
 * POST /api/database/import
 * Import database from uploaded SQL file
 * NOTE: This simplified version works without multer by using server-side file path
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    // For now, expect a file path in the body since multer isn't installed
    // In a full implementation, you'd use multer for file uploads
    const { filepath, targetUrl } = req.body;
    
    if (!filepath) {
      return res.status(400).json({ 
        error: 'File path required', 
        message: 'Please provide a filepath parameter with the SQL file path on the server' 
      });
    }

    if (!existsSync(filepath)) {
      return res.status(400).json({ error: 'File not found', message: `The file ${filepath} does not exist` });
    }

    const migrationId = `import-${Date.now()}`;
    activeMigrations.set(migrationId, {
      status: 'importing',
      progress: 0,
      message: 'Importing database...',
      startedAt: new Date(),
    });

    // Execute import
    try {
      const targetDbUrl = targetUrl || process.env.DATABASE_URL;
      await execAsync(
        `npx tsx scripts/db-import.ts --file=${filepath} --target=${targetDbUrl} --skip-errors`
      );

      activeMigrations.set(migrationId, {
        status: 'complete',
        progress: 100,
        message: 'Import complete',
        startedAt: activeMigrations.get(migrationId)!.startedAt,
      });

      res.json({
        success: true,
        migrationId,
        message: 'Database imported successfully',
      });
    } catch (error: any) {
      activeMigrations.set(migrationId, {
        status: 'failed',
        progress: 0,
        message: 'Import failed',
        startedAt: activeMigrations.get(migrationId)!.startedAt,
        error: error.message,
      });
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Import failed', message: error.message });
  }
});

/**
 * POST /api/database/provision-cloud-sql
 * Provision a new Google Cloud SQL instance
 */
router.post('/provision-cloud-sql', async (req: Request, res: Response) => {
  try {
    // Validate request
    const config = provisionCloudSqlSchema.parse(req.body) as CloudSqlConfig;

    // Initialize provisioner
    const provisioner = new CloudSqlProvisioner(config.projectId);

    // Check if API is enabled
    const apiEnabled = await provisioner.checkApiEnabled();
    if (!apiEnabled) {
      return res.status(400).json({
        error: 'Cloud SQL Admin API not enabled',
        message: 'Please enable the API in your Google Cloud Console',
      });
    }

    // Create instance
    const migrationId = `provision-${Date.now()}`;
    activeMigrations.set(migrationId, {
      status: 'exporting', // Reusing status for provisioning
      progress: 0,
      message: 'Provisioning Cloud SQL instance...',
      startedAt: new Date(),
    });

    try {
      const instance = await provisioner.createInstance(config);

      activeMigrations.set(migrationId, {
        status: 'complete',
        progress: 100,
        message: 'Instance provisioned successfully',
        startedAt: activeMigrations.get(migrationId)!.startedAt,
      });

      res.json({
        success: true,
        migrationId,
        instance,
        message: 'Cloud SQL instance provisioned successfully',
      });
    } catch (error: any) {
      activeMigrations.set(migrationId, {
        status: 'failed',
        progress: 0,
        message: 'Provisioning failed',
        startedAt: activeMigrations.get(migrationId)!.startedAt,
        error: error.message,
      });
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Provisioning failed', message: error.message });
  }
});

/**
 * GET /api/database/migration-status/:migrationId
 * Get status of a migration operation
 */
router.get('/migration-status/:migrationId', (req: Request, res: Response) => {
  const { migrationId } = req.params;
  const status = activeMigrations.get(migrationId);

  if (!status) {
    return res.status(404).json({ error: 'Migration not found' });
  }

  res.json({
    migrationId,
    ...status,
    elapsedSeconds: Math.floor((Date.now() - status.startedAt.getTime()) / 1000),
  });
});

/**
 * GET /api/database/cloud-sql-instances
 * List all Cloud SQL instances in the project
 */
router.get('/cloud-sql-instances', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }

    const provisioner = new CloudSqlProvisioner(projectId);
    const instances = await provisioner.listInstances();

    res.json({
      success: true,
      instances,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list instances', message: error.message });
  }
});

/**
 * GET /api/database/health
 * Check database connection health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const db = storage.getDb();
    await db.execute('SELECT 1');

    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
