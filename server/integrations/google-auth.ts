/**
 * Custom Google OAuth2 Authentication
 * Supports per-user OAuth tokens for true multi-user functionality
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
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/cloud-platform',
];

// Time buffer before token expiry to trigger refresh (60 seconds)
const TOKEN_REFRESH_BUFFER_MS = 60000;

// Legacy singleton tokens (deprecated - for backward compatibility)
let cachedTokens: Auth.Credentials | null = null;
let oauth2Client: Auth.OAuth2Client | null = null;
let initialized = false;
let initializationPromise: Promise<void> | null = null;

// Per-user token cache
const userTokenCache = new Map<string, Auth.Credentials>();
const userOAuth2Clients = new Map<string, Auth.OAuth2Client>();

/**
 * Type definition for OAuth tokens stored in database
 */
export interface OAuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiryDate: number | null;
  tokenType: string | null;
  scope: string | null;
}

function getRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  
  let host: string;
  
  if (process.env.REPLIT_DEV_DOMAIN) {
    // Development environment
    host = `https://${process.env.REPLIT_DEV_DOMAIN}`;
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
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
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
      const dbTokens = await storage.getGoogleTokens();
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
  if (expiryDate && expiryDate < Date.now() + TOKEN_REFRESH_BUFFER_MS) {
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

// =============================================================================
// PER-USER OAUTH OPERATIONS
// =============================================================================

/**
 * Get OAuth2 client for a specific user
 * @param userId - The user ID to get the client for
 */
export async function getUserOAuth2Client(userId: string): Promise<Auth.OAuth2Client> {
  // Check cache first
  if (userOAuth2Clients.has(userId)) {
    const client = userOAuth2Clients.get(userId)!;
    // Refresh tokens if needed
    await refreshUserTokensIfNeeded(userId, client);
    return client;
  }
  
  // Load from database
  const tokens = await storage.getUserGoogleTokens(userId);
  if (!tokens || !tokens.accessToken) {
    throw new Error('User not authenticated with Google. Please authorize first.');
  }
  
  const client = createOAuth2Client();
  const credentials: Auth.Credentials = {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || undefined,
    expiry_date: tokens.expiryDate || undefined,
    token_type: tokens.tokenType || undefined,
    scope: tokens.scope || undefined,
  };
  
  client.setCredentials(credentials);
  
  // Cache the client and tokens
  userOAuth2Clients.set(userId, client);
  userTokenCache.set(userId, credentials);
  
  return client;
}

/**
 * Handle OAuth callback for a specific user
 * @param userId - The user ID to associate tokens with
 * @param code - The authorization code from Google
 */
export async function handleUserCallback(userId: string, code: string): Promise<Auth.Credentials> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  
  // Save to database
  await storage.saveUserGoogleTokens(userId, {
    accessToken: tokens.access_token || null,
    refreshToken: tokens.refresh_token || null,
    expiryDate: tokens.expiry_date || null,
    tokenType: tokens.token_type || null,
    scope: tokens.scope || null,
  });
  
  // Cache
  userOAuth2Clients.set(userId, client);
  userTokenCache.set(userId, tokens);
  
  console.log(`Saved Google OAuth tokens for user ${userId}`);
  return tokens;
}

/**
 * Check if a user is authenticated with Google
 * @param userId - The user ID to check
 */
export async function isUserAuthenticated(userId: string): Promise<boolean> {
  const tokens = await storage.getUserGoogleTokens(userId);
  return tokens !== null && tokens.accessToken !== null;
}

/**
 * Refresh tokens for a specific user if needed
 * @param userId - The user ID
 * @param client - The OAuth2 client
 */
async function refreshUserTokensIfNeeded(userId: string, client: Auth.OAuth2Client): Promise<void> {
  const credentials = client.credentials;
  if (!credentials) return;
  
  const expiryDate = credentials.expiry_date;
  if (expiryDate && expiryDate < Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    const previousRefreshToken = credentials.refresh_token;
    try {
      const { credentials: newCredentials } = await client.refreshAccessToken();
      
      // Preserve refresh token if not returned
      if (!newCredentials.refresh_token && previousRefreshToken) {
        newCredentials.refresh_token = previousRefreshToken;
      }
      
      client.setCredentials(newCredentials);
      
      // Update database
      await storage.saveUserGoogleTokens(userId, {
        accessToken: newCredentials.access_token || null,
        refreshToken: newCredentials.refresh_token || null,
        expiryDate: newCredentials.expiry_date || null,
        tokenType: newCredentials.token_type || null,
        scope: newCredentials.scope || null,
      });
      
      // Update cache
      userTokenCache.set(userId, newCredentials);
      
      console.log(`Refreshed Google OAuth tokens for user ${userId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'Error';
      console.error(`[OAuth] Failed to refresh tokens for user ${userId}:`, {
        errorName,
        errorMessage,
        userId,
        hasRefreshToken: !!previousRefreshToken,
      });
      // Clear cache on error
      userOAuth2Clients.delete(userId);
      userTokenCache.delete(userId);
      throw error;
    }
  }
}

/**
 * Revoke Google access for a specific user
 * @param userId - The user ID
 */
export async function revokeUserAccess(userId: string): Promise<void> {
  await storage.deleteUserGoogleTokens(userId);
  userOAuth2Clients.delete(userId);
  userTokenCache.delete(userId);
  console.log(`Revoked Google access for user ${userId}`);
}

export { SCOPES };
