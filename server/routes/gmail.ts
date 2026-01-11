import { Router } from "express";
import { asyncHandler, badRequest, getUserId } from "./middleware";
import {
  listEmails,
  getEmail,
  sendEmail,
  getLabels,
  searchEmails,
} from "../integrations/gmail";

const router = Router();

router.get(
  "/messages",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const maxResults = parseInt(req.query.maxResults as string) || 20;
    const emails = await listEmails(userId, maxResults);
    res.json(emails);
  })
);

router.get(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const email = await getEmail(userId, req.params.id);
    res.json(email);
  })
);

router.post(
  "/messages",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
      throw badRequest("To, subject, and body are required");
    }
    const result = await sendEmail(userId, to, subject, body);
    res.json(result);
  })
);

router.get(
  "/labels",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const labels = await getLabels(userId);
    res.json(labels);
  })
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const query = req.query.q as string;
    if (!query) {
      throw badRequest("Search query is required");
    }
    const emails = await searchEmails(userId, query);
    res.json(emails);
  })
);

export default router;
