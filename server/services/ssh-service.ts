import { Client, ConnectConfig } from 'ssh2';
import { db } from '../db';
import { knowledgeBuckets } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// [💭 Analysis]
// This service handles SSH connections for deployment orremote management.
// Updated to use the modern db export.

export class SSHService {
  private client: Client;

  constructor() {
    this.client = new Client();
  }

  /**
   * Connect to a remote server using provided config
   */
  async connect(config: ConnectConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        console.log('SSH Client :: ready');
        resolve();
      }).on('error', (err) => {
        console.error('SSH Client :: error', err);
        reject(err);
      }).connect(config);
    });
  }

  /**
   * Execute a command on the remote server
   */
  async exec(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) return reject(err);
        
        let output = '';
        let errorOutput = '';

        stream.on('close', (code: any, signal: any) => {
          if (code !== 0) {
            reject(new Error(`SSH Exec failed (Code ${code}): ${errorOutput}`));
          } else {
            resolve(output);
          }
        }).on('data', (data: any) => {
          output += data;
        }).stderr.on('data', (data: any) => {
          errorOutput += data;
        });
      });
    });
  }

  /**
   * Example method to retrieve SSH keys or configs from DB
   * (Placeholder logic to demonstrate db usage)
   */
  async getSSHConfig(bucketId: number) {
      // FIX: Use 'db' directly instead of getDb()
      const [bucket] = await db.select().from(knowledgeBuckets).where(eq(knowledgeBuckets.id, bucketId));
      return bucket?.config; // Assuming config holds SSH details
  }

  disconnect() {
    this.client.end();
  }
}

export const sshService = new SSHService();