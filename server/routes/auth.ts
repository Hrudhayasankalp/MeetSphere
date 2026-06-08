import { Router } from "express";
import { register, login, googleLogin, getProfile } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/register", register as any);
router.post("/login", login as any);
router.post("/google", googleLogin as any);
router.get("/google-client-id", (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});
router.get("/profile", authMiddleware as any, getProfile as any);

export default router;
