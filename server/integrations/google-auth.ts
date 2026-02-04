/**
 * Custom Google OAuth2 Authentication
 * Uses user's own Google Cloud credentials with database persistence
 */

import { google, Auth } from 'googleapis';
import { storage } from '../storage';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/cloud-platform',
];

let cachedTokens: Auth.Credentials | null = null;
let oauth2Client: Auth.OAuth2Client | null = null;
let initialized = false;
let initializationPromise: Promise<void> | null = null;

function getRedirectUri(): string {
  let host: string;
  
  // In development mode, always use dynamic detection
  const isDevMode = process.env.HOME_DEV_MODE === 'true' || process.env.NODE_ENV === 'development';
  
  if (process.env.REPLIT_DEV_DOMAIN) {
    // Development environment - always use dev domain
    host = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  } else if (!isDevMode && process.env.GOOGLE_REDIRECT_URI) {
    // Production: use configured redirect URI
    return process.env.GOOGLE_REDIRECT_URI;
  } else if (process.env.REPLIT_DOMAINS) {
    // Production deployment - use first domain from comma-separated list
    const domains = process.env.REPLIT_DOMAINS.split(',');
    host = `https://${domains[0]}`;
  } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    // Fallback to replit.app format
    host = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER.toLowerCase()}.replit.app`;
  } else {
    host = 'http://localhost:5000';
  }
  
  const redirectUri = `${host}/api/auth/google/callback`;
  console.log('[Google OAuth] Using redirect URI:', redirectUri);
  return redirectUri;
}

function createOAuth2Client(): Auth.OAuth2Client {
  let clientId = process.env.GOOGLE_CLIENT_ID?.trim() || undefined;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined;
  
  // In HOME_DEV_MODE, use dummy credentials if real ones are missing
  // This prevents startup crashes due to missing keys
  if ((!clientId || !clientSecret) && process.env.HOME_DEV_MODE === 'true') {
    console.warn("⚠️ [Google OAuth] Running in HOME_DEV_MODE with dummy credentials.");
    console.warn("   Google OAuth features will not work, but the app will start successfully.");
    clientId = "dummy-client-id-for-dev-mode";
    clientSecret = "dummy-client-secret-for-dev-mode";
  }
  
  if (!clientId || !clientSecret) {
    // If not in dev mode, we must have real keys
    throw new Error(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set. ' +
      'Set HOME_DEV_MODE=true in your .env file to bypass this requirement for local development.'
    );
  }
  
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export async function initializeFromDatabase(): Promise<void> {
  if (initialized) return;
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      // Use default ID for global OAuth tokens
      const dbTokens = await storage.getGoogleTokens('default');
      if (dbTokens && dbTokens.accessToken) {
        cachedTokens = {
          access_token: dbTokens.accessToken,
          refresh_token: dbTokens.refreshToken || undefined,
          expiry_date: dbTokens.expiryDate || undefined,
          token_type: dbTokens.tokenType || undefined,
          scope: dbTokens.scope || undefined,
        };
        
        if (!oauth2Client) {
          oauth2Client = createOAuth2Client();
        }
        oauth2Client.setCredentials(cachedTokens);
        console.log('Loaded Google OAuth tokens from database');
      }
      initialized = true;
    } catch (error) {
      console.warn('Failed to load tokens from database (will retry on next request):', error instanceof Error ? error.message : error);
      initialized = true;
    }
    initializationPromise = null;
  })();
  
  return initializationPromise;
}

export async function getOAuth2Client(): Promise<Auth.OAuth2Client> {
  await initializeFromDatabase();
  
  if (!oauth2Client) {
    oauth2Client = createOAuth2Client();
    if (cachedTokens) {
      oauth2Client.setCredentials(cachedTokens);
    }
  }
  return oauth2Client;
}

export function getOAuth2ClientSync(): Auth.OAuth2Client {
  if (!oauth2Client) {
    oauth2Client = createOAuth2Client();
    if (cachedTokens) {
      oauth2Client.setCredentials(cachedTokens);
    }
  }
  return oauth2Client;
}

export function getAuthUrl(): string {
  const client = getOAuth2ClientSync();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function handleCallback(code: string): Promise<Auth.Credentials> {
  const client = await getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  cachedTokens = tokens;
  
  await storage.saveGoogleTokens({
    id: 'default',
    accessToken: tokens.access_token || null,
    refreshToken: tokens.refresh_token || null,
    expiryDate: tokens.expiry_date || null,
    tokenType: tokens.token_type || null,
    scope: tokens.scope || null,
  });
  
  console.log('Saved Google OAuth tokens to database');
  return tokens;
}

export function setTokens(tokens: Auth.Credentials): void {
  cachedTokens = tokens;
  if (oauth2Client) {
    oauth2Client.setCredentials(tokens);
  }
}

export async function getTokens(): Promise<Auth.Credentials | null> {
  await initializeFromDatabase();
  return cachedTokens;
}

export function getTokensSync(): Auth.Credentials | null {
  return cachedTokens;
}

export async function isAuthenticated(): Promise<boolean> {
  await initializeFromDatabase();
  return cachedTokens !== null && cachedTokens.access_token !== undefined;
}

export function isAuthenticatedSync(): boolean {
  return cachedTokens !== null && cachedTokens.access_token !== undefined;
}

export async function refreshTokensIfNeeded(): Promise<void> {
  await initializeFromDatabase();
  if (!cachedTokens || !oauth2Client) return;
  
  const expiryDate = cachedTokens.expiry_date;
  if (expiryDate && expiryDate < Date.now() + 60000) {
    const previousRefreshToken = cachedTokens.refresh_token;
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      cachedTokens = credentials;
      if (!cachedTokens.refresh_token && previousRefreshToken) {
        cachedTokens.refresh_token = previousRefreshToken;
      }
      oauth2Client.setCredentials(cachedTokens);
      
      await storage.saveGoogleTokens({
        id: 'default',
        accessToken: credentials.access_token || null,
        refreshToken: cachedTokens.refresh_token || null,
        expiryDate: credentials.expiry_date || null,
        tokenType: credentials.token_type || null,
        scope: credentials.scope || null,
      });
      
      console.log('Refreshed and saved Google OAuth tokens');
    } catch (error) {
      console.error('Failed to refresh tokens:', error);
      cachedTokens = null;
    }
  }
}

export async function getAuthenticatedClient(): Promise<Auth.OAuth2Client> {
  await initializeFromDatabase();
  
  if (!(await isAuthenticated())) {
    throw new Error('Not authenticated with Google. Please authorize first.');
  }
  await refreshTokensIfNeeded();
  return await getOAuth2Client();
}

export async function revokeAccess(): Promise<void> {
  cachedTokens = null;
  oauth2Client = null;
  initialized = false;
  initializationPromise = null;
  await storage.deleteGoogleTokens();
  console.log('Revoked Google access and cleared tokens');
}

export { SCOPES };
