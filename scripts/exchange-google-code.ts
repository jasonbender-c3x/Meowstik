import { google } from 'googleapis';
import { storage } from '../server/storage';
import * as dotenv from 'dotenv';
dotenv.config();

const code = '4/0AfrIepBCGovTQle9ilVJ-OGPvT82dPirpWm8khIx-jQiVf_jiEXMEgIUNpIPzb_ZuVp0KQ';

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim().replace(/\s/g, '');
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim().replace(/\s/g, '');
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback').trim();

  console.log(`Using Client ID: ${clientId}`);
  console.log(`Using Client Secret: ${clientSecret?.substring(0, 10)}...`);

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
    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Success! Tokens received.');
    
    await storage.saveGoogleTokens({
      id: 'default',
      accessToken: tokens.access_token || null,
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date || null,
      tokenType: tokens.token_type || null,
      scope: tokens.scope || null,
    });
    
    console.log('Tokens saved to database.');
    process.exit(0);
  } catch (error) {
    console.error('Error exchanging code:', error);
    process.exit(1);
  }
}

main();
