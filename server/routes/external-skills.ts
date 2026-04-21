import { Router } from "express";
import { externalSkillsService } from "../services/external-skills-service";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ skills: externalSkillsService.listSkills() });
});

export default router;
