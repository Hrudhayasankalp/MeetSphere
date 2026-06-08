import { Router } from "express";
import { summarizeMeeting, generateCaptions } from "../controllers/aiController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/summarize", authMiddleware as any, summarizeMeeting as any);
router.post("/caption", authMiddleware as any, generateCaptions as any);

export default router;
