/**
 * Google OAuth2 Authentication Routes
 * Supports per-user OAuth tokens for multi-user functionality
 */

import { Router, Request, Response } from 'express';
import { 
  getAuthUrl, 
  handleCallback, 
  isAuthenticated, 
  revokeAccess, 
  getTokens, 
  initializeFromDatabase,
  handleUserCallback,
  isUserAuthenticated,
  revokeUserAccess,
} from '../integrations/google-auth';

const router = Router();

// Helper to get user ID from session
function getUserId(req: Request): string | null {
  const user = req.user as any;
  return user?.claims?.sub || null;
}

router.get('/google', (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated. Please log in first.' });
    }
    
    // Store user ID in session to retrieve in callback
    (req.session as any).oauthUserId = userId;
    
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }
  
  try {
    // Retrieve user ID from session
    const userId = (req.session as any).oauthUserId;
    
    if (!userId) {
      // Fallback to legacy flow for backward compatibility
      await handleCallback(code);
      return res.redirect('/?auth=success');
    }
    
    // Per-user flow
    await handleUserCallback(userId, code);
    
    // Clear session data
    delete (req.session as any).oauthUserId;
    
    res.redirect('/?auth=success');
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect('/?auth=error');
  }
});

router.get('/google/status', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  
  if (!userId) {
    // Legacy check for backward compatibility
    const authenticated = await isAuthenticated();
    const tokens = await getTokens();
    return res.json({ 
      authenticated,
      hasTokens: tokens !== null,
      legacy: true,
    });
  }
  
  // Per-user check
  const authenticated = await isUserAuthenticated(userId);
  res.json({ 
    authenticated,
    hasTokens: authenticated,
    userId,
  });
});

router.post('/google/revoke', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  
  if (!userId) {
    // Legacy revoke for backward compatibility
    await revokeAccess();
    return res.json({ success: true, legacy: true });
  }
  
  // Per-user revoke
  await revokeUserAccess(userId);
  res.json({ success: true, userId });
});

export default router;
