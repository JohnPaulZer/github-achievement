import { Router } from "express";
import { analyzeAchievementProgress } from "../services/achievementService";

const router = Router();

router.post("/analyze", async (req, res, next) => {
  try {
    const username =
      typeof req.body?.username === "string" ? req.body.username : "";
    const token =
      typeof req.body?.token === "string" ? req.body.token : undefined;
    const forceRefresh = Boolean(req.body?.forceRefresh);

    const result = await analyzeAchievementProgress({
      username,
      token,
      forceRefresh,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/analyze/:username", async (req, res, next) => {
  try {
    const result = await analyzeAchievementProgress({
      username: req.params.username,
      forceRefresh: req.query.forceRefresh === "true",
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
