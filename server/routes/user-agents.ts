/**
 * =============================================================================
 * USER AGENTS API ROUTES
 * =============================================================================
 * 
 * API endpoints for creating and managing multiple AI agent personas.
 * Allows users to create custom agents with different personalities and settings.
 * 
 * Routes:
 * - GET    /api/user-agents           - List all user's agents
 * - GET    /api/user-agents/:id       - Get specific agent
 * - POST   /api/user-agents           - Create new agent
 * - PATCH  /api/user-agents/:id       - Update agent
 * - DELETE /api/user-agents/:id       - Delete agent
 * - POST   /api/user-agents/:id/default - Set agent as default
 * =============================================================================
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { insertUserAgentSchema } from '@shared/schema';

const router = Router();

/**
 * GET /api/user-agents
 * List all agents for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const activeOnly = req.query.active !== 'false';
    const agents = await storage.getUserAgents(userId, activeOnly);
    
    res.json({ agents });
  } catch (error: any) {
    console.error('Error fetching user agents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agents', 
      message: error.message 
    });
  }
});

/**
 * GET /api/user-agents/:id
 * Get a specific agent by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const agent = await storage.getUserAgent(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Verify agent belongs to user
    if (agent.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ agent });
  } catch (error: any) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent', 
      message: error.message 
    });
  }
});

/**
 * POST /api/user-agents
 * Create a new agent
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate request body
    const result = insertUserAgentSchema.safeParse({
      ...req.body,
      userId, // Override userId with authenticated user
    });

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid agent data', 
        details: result.error.errors 
      });
    }

    const agent = await storage.createUserAgent(result.data);
    
    res.status(201).json({ 
      agent,
      message: 'Agent created successfully' 
    });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    res.status(500).json({ 
      error: 'Failed to create agent', 
      message: error.message 
    });
  }
});

/**
 * PATCH /api/user-agents/:id
 * Update an agent
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if agent exists and belongs to user
    const existing = await storage.getUserAgent(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate update data
    const result = insertUserAgentSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid update data', 
        details: result.error.errors 
      });
    }

    const agent = await storage.updateUserAgent(req.params.id, result.data);
    
    res.json({ 
      agent,
      message: 'Agent updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating agent:', error);
    res.status(500).json({ 
      error: 'Failed to update agent', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/user-agents/:id
 * Delete an agent
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if agent exists and belongs to user
    const existing = await storage.getUserAgent(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = await storage.deleteUserAgent(req.params.id);
    
    if (deleted) {
      res.json({ message: 'Agent deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ 
      error: 'Failed to delete agent', 
      message: error.message 
    });
  }
});

/**
 * POST /api/user-agents/:id/default
 * Set an agent as the default for this user
 */
router.post('/:id/default', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if agent exists and belongs to user
    const existing = await storage.getUserAgent(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const agent = await storage.setDefaultUserAgent(req.params.id);
    
    res.json({ 
      agent,
      message: 'Default agent updated successfully' 
    });
  } catch (error: any) {
    console.error('Error setting default agent:', error);
    res.status(500).json({ 
      error: 'Failed to set default agent', 
      message: error.message 
    });
  }
});

export default router;
