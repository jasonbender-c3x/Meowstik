import { Router } from "express";
import { asyncHandler, badRequest } from "./middleware";
import { fetchReadablePage, summarizeReadablePage } from "../services/read-to-me";

const router = Router();

router.post(
  "/summary",
  asyncHandler(async (req, res) => {
    const { url } = req.body ?? {};
    if (typeof url !== "string" || !url.trim()) {
      throw badRequest("url is required");
    }

    const page = await fetchReadablePage(url);
    const summary = await summarizeReadablePage(page);

    res.json({
      ...page,
      ...summary,
    });
  })
);

export default router;
