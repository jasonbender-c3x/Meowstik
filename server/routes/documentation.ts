/**
 * =============================================================================
 * DOCUMENTATION GENERATION ROUTES
 * =============================================================================
 * 
 * API endpoints for AI-powered documentation generation.
 * =============================================================================
 */

import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import { storage } from "../storage";
import { 
  generateDocumentation, 
  generateAndSave,
  type DocGenerationConfig 
} from "../services/documentation-generator";
import { z } from "zod";

const router = Router();

/**
 * Validation schema for documentation generation requests
 */
const docGenerationSchema = z.object({
  type: z.enum(["api-reference", "tutorial", "guide", "overview"]),
  title: z.string().min(1, "Title is required"),
  category: z.string().optional(),
  sourceFiles: z.array(z.string()).optional(),
  context: z.string().optional(),
  targetAudience: z.enum(["developer", "user", "contributor"]).optional(),
  saveToDb: z.boolean().optional().default(true),
});

/**
 * POST /api/documentation/generate
 * Generate documentation based on provided configuration
 */
router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const validation = docGenerationSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest(validation.error.errors[0].message);
    }

    const config: DocGenerationConfig = validation.data;
    
    if (config.saveToDb) {
      // Generate and save to database
      const result = await generateAndSave(config);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to generate documentation",
          details: result.error 
        });
      }
      
      // Fetch the saved doc to return full details
      const doc = await storage.getGeneratedDocById(result.docId!);
      res.json({ success: true, doc });
    } else {
      // Generate only, don't save
      const result = await generateDocumentation(config);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to generate documentation",
          details: result.error 
        });
      }
      
      res.json({ success: true, doc: result.doc });
    }
  })
);

/**
 * GET /api/documentation/generated
 * List all generated documentation
 */
router.get(
  "/generated",
  asyncHandler(async (req, res) => {
    const published = req.query.published === "true" ? true : 
                     req.query.published === "false" ? false : 
                     undefined;
    const type = req.query.type as string | undefined;
    const category = req.query.category as string | undefined;
    
    const docs = await storage.getGeneratedDocs({ published, type, category });
    res.json(docs);
  })
);

/**
 * GET /api/documentation/generated/:id
 * Get a specific generated document by ID
 */
router.get(
  "/generated/:id",
  asyncHandler(async (req, res) => {
    const doc = await storage.getGeneratedDocById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(doc);
  })
);

/**
 * GET /api/documentation/generated/slug/:slug
 * Get a specific generated document by slug
 */
router.get(
  "/generated/slug/:slug",
  asyncHandler(async (req, res) => {
    const doc = await storage.getGeneratedDocBySlug(req.params.slug);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(doc);
  })
);

/**
 * PATCH /api/documentation/generated/:id
 * Update a generated document
 */
router.patch(
  "/generated/:id",
  asyncHandler(async (req, res) => {
    const doc = await storage.updateGeneratedDoc(req.params.id, req.body);
    res.json(doc);
  })
);

/**
 * POST /api/documentation/generated/:id/publish
 * Publish a generated document
 */
router.post(
  "/generated/:id/publish",
  asyncHandler(async (req, res) => {
    const doc = await storage.publishGeneratedDoc(req.params.id);
    res.json(doc);
  })
);

/**
 * POST /api/documentation/generated/:id/unpublish
 * Unpublish a generated document
 */
router.post(
  "/generated/:id/unpublish",
  asyncHandler(async (req, res) => {
    const doc = await storage.unpublishGeneratedDoc(req.params.id);
    res.json(doc);
  })
);

/**
 * DELETE /api/documentation/generated/:id
 * Delete a generated document
 */
router.delete(
  "/generated/:id",
  asyncHandler(async (req, res) => {
    await storage.deleteGeneratedDoc(req.params.id);
    res.json({ success: true });
  })
);

export default router;
