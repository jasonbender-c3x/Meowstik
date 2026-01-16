/**
 * =============================================================================
 * USER BRANDING API ROUTES
 * =============================================================================
 * 
 * API endpoints for managing user-specific branding configuration.
 * Allows users to customize their agent's name, signature, avatar, and domain.
 * 
 * Routes:
 * - GET    /api/branding       - Get current user's branding settings
 * - PUT    /api/branding       - Update current user's branding settings
 * - DELETE /api/branding       - Reset branding to defaults
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { insertUserBrandingSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/branding
 * Get current user's branding configuration
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get userId from session (assuming Replit Auth middleware)
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get branding or return defaults
    const branding = await storage.getUserBrandingOrDefault(userId);
    
    res.json({ branding });
  } catch (error: any) {
    console.error('Error fetching branding:', error);
    res.status(500).json({ 
      error: 'Failed to fetch branding settings', 
      message: error.message 
    });
  }
});

/**
 * PUT /api/branding
 * Update current user's branding configuration
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate request body
    const result = insertUserBrandingSchema.safeParse({
      ...req.body,
      userId, // Override userId with authenticated user
    });

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid branding data', 
        details: result.error.errors 
      });
    }

    // Upsert branding configuration
    const branding = await storage.upsertUserBranding(result.data);
    
    res.json({ 
      branding,
      message: 'Branding settings updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating branding:', error);
    res.status(500).json({ 
      error: 'Failed to update branding settings', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/branding
 * Reset branding to system defaults
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const deleted = await storage.deleteUserBranding(userId);
    
    if (deleted) {
      // Return default branding
      const branding = await storage.getUserBrandingOrDefault(userId);
      res.json({ 
        branding,
        message: 'Branding reset to defaults' 
      });
    } else {
      res.json({ 
        message: 'No custom branding to delete (already using defaults)' 
      });
    }
  } catch (error: any) {
    console.error('Error deleting branding:', error);
    res.status(500).json({ 
      error: 'Failed to reset branding', 
      message: error.message 
    });
  }
});

export default router;
