import { Router } from "express";
const router = Router();

router.get("/session", (req, res) => {
  res.json({
    session: req.session,
    user: req.user,
    isAuthenticated: req.isAuthenticated(),
  });
});

export default router;
