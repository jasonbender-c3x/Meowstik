/**
 * =============================================================================
 * GOOGLE CLOUD SQL PROVISIONER
 * =============================================================================
 * 
 * This service provides functionality to provision and manage Google Cloud SQL
 * instances for PostgreSQL databases. It uses the Google Cloud SQL Admin API
 * to create database instances, configure them, and generate connection strings.
 * 
 * Prerequisites:
 * - Google Cloud Project with Cloud SQL Admin API enabled
 * - Service account with Cloud SQL Admin role
 * - GOOGLE_APPLICATION_CREDENTIALS environment variable set
 * 
 * Features:
 * - Create PostgreSQL instances with custom configuration
 * - Auto-generate secure passwords
 * - Configure networking (public IP, authorized networks)
 * - Create databases within instances
 * - Generate connection strings
 * - Instance status monitoring
 * =============================================================================
 */

import { google } from 'googleapis';
import crypto from 'crypto';

const sqladmin = google.sqladmin('v1beta4');

export interface CloudSqlConfig {
  projectId: string;
  instanceId: string;
  region: string;
  tier?: string; // e.g., 'db-f1-micro', 'db-g1-small', 'db-n1-standard-1'
  databaseVersion?: string; // e.g., 'POSTGRES_15', 'POSTGRES_14'
  diskSizeGb?: number;
  databaseName?: string;
  userName?: string;
  userPassword?: string;
  authorizedNetworks?: string[]; // CIDR ranges, e.g., ['0.0.0.0/0'] for public
  backupEnabled?: boolean;
  highAvailability?: boolean;
}

export interface CloudSqlInstance {
  instanceId: string;
  state: string;
  ipAddress: string;
  connectionName: string;
  connectionString: string;
  region: string;
  tier: string;
  databaseVersion: string;
}

/**
 * Cloud SQL Provisioner Service
 */
export class CloudSqlProvisioner {
  private projectId: string;
  
  constructor(projectId?: string) {
    this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || '';
    
    if (!this.projectId) {
      throw new Error('Google Cloud Project ID is required. Set GOOGLE_CLOUD_PROJECT environment variable.');
    }
  }

  /**
   * Generate a secure random password
   */
  private generatePassword(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  /**
   * Get authenticated client
   */
  private async getAuthClient() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    return await auth.getClient();
  }

  /**
   * Check if Cloud SQL API is enabled
   */
  async checkApiEnabled(): Promise<boolean> {
    try {
      const auth = await this.getAuthClient();
      const serviceusage = google.serviceusage('v1');
      
      const response = await serviceusage.services.get({
        auth: auth as any,
        name: `projects/${this.projectId}/services/sqladmin.googleapis.com`,
      });

      return response.data.state === 'ENABLED';
    } catch (error: any) {
      console.error('Failed to check Cloud SQL API status:', error.message);
      return false;
    }
  }

  /**
   * Enable Cloud SQL API
   */
  async enableApi(): Promise<void> {
    const auth = await this.getAuthClient();
    const serviceusage = google.serviceusage('v1');
    
    console.log('Enabling Cloud SQL Admin API...');
    await serviceusage.services.enable({
      auth: auth as any,
      name: `projects/${this.projectId}/services/sqladmin.googleapis.com`,
    });
    
    console.log('✓ API enabled. It may take a few minutes to propagate.');
  }

  /**
   * Create a new Cloud SQL PostgreSQL instance
   */
  async createInstance(config: CloudSqlConfig): Promise<CloudSqlInstance> {
    const auth = await this.getAuthClient();
    
    // Generate secure password if not provided
    const password = config.userPassword || this.generatePassword();
    const userName = config.userName || 'meowstik';
    const databaseName = config.databaseName || 'meowstik';

    console.log(`Creating Cloud SQL instance: ${config.instanceId}...`);
    console.log(`  Project: ${this.projectId}`);
    console.log(`  Region: ${config.region}`);
    console.log(`  Tier: ${config.tier || 'db-f1-micro'}`);
    console.log(`  Database: ${config.databaseVersion || 'POSTGRES_15'}`);

    // Create instance
    const instanceConfig = {
      name: config.instanceId,
      region: config.region,
      databaseVersion: config.databaseVersion || 'POSTGRES_15',
      settings: {
        tier: config.tier || 'db-f1-micro',
        dataDiskSizeGb: config.diskSizeGb || 10,
        dataDiskType: 'PD_SSD',
        backupConfiguration: {
          enabled: config.backupEnabled !== false,
          startTime: '03:00', // 3 AM UTC
          pointInTimeRecoveryEnabled: config.highAvailability || false,
        },
        ipConfiguration: {
          ipv4Enabled: true,
          authorizedNetworks: (config.authorizedNetworks || []).map(cidr => ({
            value: cidr,
            name: 'Authorized network',
          })),
        },
        availabilityType: config.highAvailability ? 'REGIONAL' : 'ZONAL',
      },
    };

    try {
      const response = await sqladmin.instances.insert({
        auth: auth as any,
        project: this.projectId,
        requestBody: instanceConfig,
      });

      console.log('✓ Instance creation initiated');
      console.log(`  Operation: ${response.data.name}`);
      
      // Wait for instance to be ready
      console.log('  Waiting for instance to be ready (this may take 5-10 minutes)...');
      await this.waitForOperation(response.data.name!);
      
      // Create user
      console.log(`  Creating user: ${userName}...`);
      await this.createUser(config.instanceId, userName, password);
      
      // Create database
      console.log(`  Creating database: ${databaseName}...`);
      await this.createDatabase(config.instanceId, databaseName);
      
      // Get instance details
      const instance = await this.getInstance(config.instanceId);
      
      console.log('✓ Instance created successfully');
      console.log(`  IP Address: ${instance.ipAddress}`);
      console.log(`  Connection Name: ${instance.connectionName}`);
      console.log(`  Connection String: ${instance.connectionString}`);
      
      return instance;
    } catch (error: any) {
      console.error('Failed to create Cloud SQL instance:', error.message);
      throw error;
    }
  }

  /**
   * Get instance information
   */
  async getInstance(instanceId: string): Promise<CloudSqlInstance> {
    const auth = await this.getAuthClient();
    
    const response = await sqladmin.instances.get({
      auth: auth as any,
      project: this.projectId,
      instance: instanceId,
    });

    const instance = response.data;
    const ipAddress = instance.ipAddresses?.[0]?.ipAddress || '';
    const connectionName = instance.connectionName || '';
    
    // Generate connection string
    const connectionString = `postgresql://meowstik:PASSWORD@${ipAddress}:5432/meowstik`;

    return {
      instanceId: instance.name || '',
      state: instance.state || 'UNKNOWN',
      ipAddress,
      connectionName,
      connectionString,
      region: instance.region || '',
      tier: instance.settings?.tier || '',
      databaseVersion: instance.databaseVersion || '',
    };
  }

  /**
   * Wait for an operation to complete
   */
  private async waitForOperation(operationName: string): Promise<void> {
    const auth = await this.getAuthClient();
    const maxAttempts = 60; // 10 minutes max (10 seconds * 60)
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await sqladmin.operations.get({
        auth: auth as any,
        project: this.projectId,
        operation: operationName,
      });

      if (response.data.status === 'DONE') {
        if (response.data.error) {
          throw new Error(`Operation failed: ${JSON.stringify(response.data.error)}`);
        }
        return;
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      process.stdout.write('.');
    }

    throw new Error('Operation timed out');
  }

  /**
   * Create a database user
   */
  async createUser(instanceId: string, userName: string, password: string): Promise<void> {
    const auth = await this.getAuthClient();
    
    await sqladmin.users.insert({
      auth: auth as any,
      project: this.projectId,
      instance: instanceId,
      requestBody: {
        name: userName,
        password: password,
      },
    });
  }

  /**
   * Create a database
   */
  async createDatabase(instanceId: string, databaseName: string): Promise<void> {
    const auth = await this.getAuthClient();
    
    await sqladmin.databases.insert({
      auth: auth as any,
      project: this.projectId,
      instance: instanceId,
      requestBody: {
        name: databaseName,
      },
    });
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceId: string): Promise<void> {
    const auth = await this.getAuthClient();
    
    console.log(`Deleting instance: ${instanceId}...`);
    
    const response = await sqladmin.instances.delete({
      auth: auth as any,
      project: this.projectId,
      instance: instanceId,
    });

    console.log('  Waiting for deletion to complete...');
    await this.waitForOperation(response.data.name!);
    
    console.log('✓ Instance deleted');
  }

  /**
   * List all instances in the project
   */
  async listInstances(): Promise<CloudSqlInstance[]> {
    const auth = await this.getAuthClient();
    
    const response = await sqladmin.instances.list({
      auth: auth as any,
      project: this.projectId,
    });

    const instances = response.data.items || [];
    
    return instances.map(instance => {
      const ipAddress = instance.ipAddresses?.[0]?.ipAddress || '';
      const connectionName = instance.connectionName || '';
      const connectionString = `postgresql://meowstik:PASSWORD@${ipAddress}:5432/meowstik`;

      return {
        instanceId: instance.name || '',
        state: instance.state || 'UNKNOWN',
        ipAddress,
        connectionName,
        connectionString,
        region: instance.region || '',
        tier: instance.settings?.tier || '',
        databaseVersion: instance.databaseVersion || '',
      };
    });
  }

  /**
   * Get estimated monthly cost for an instance tier
   */
  getEstimatedCost(tier: string): string {
    // Approximate pricing as of 2024 (subject to change)
    const pricing: Record<string, number> = {
      'db-f1-micro': 7.67,      // Shared-core, 0.6 GB RAM
      'db-g1-small': 24.00,     // Shared-core, 1.7 GB RAM
      'db-n1-standard-1': 46.00, // 1 vCPU, 3.75 GB RAM
      'db-n1-standard-2': 92.00, // 2 vCPU, 7.5 GB RAM
      'db-n1-standard-4': 184.00, // 4 vCPU, 15 GB RAM
    };

    const cost = pricing[tier] || 0;
    return `$${cost}/month (approximate, excludes storage and network)`;
  }
}

// Export a singleton instance
export const cloudSqlProvisioner = new CloudSqlProvisioner();
