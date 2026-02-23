import { google } from 'googleapis';
import { storage } from '../server/storage';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('Script started');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  try {
    const dbTokens = await storage.getGoogleTokens('default');
    if (!dbTokens || !dbTokens.refreshToken) {
      console.error('No refresh token found in database.');
      process.exit(1);
    }

    console.log('Attempting to refresh tokens...');
    oauth2Client.setCredentials({
      refresh_token: dbTokens.refreshToken
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('Success! Refreshed tokens.');
    
    await storage.saveGoogleTokens({
      id: 'default',
      accessToken: credentials.access_token || null,
      refreshToken: credentials.refresh_token || dbTokens.refreshToken,
      expiryDate: credentials.expiry_date || null,
      tokenType: credentials.token_type || null,
      scope: credentials.scope || null,
    });
    
    console.log('New tokens saved to database.');
    process.exit(0);
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    process.exit(1);
  }
}

main();
