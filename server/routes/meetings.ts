import { Router } from "express";
import { createMeeting, getMeetingByCode, getMyMeetings, endMeeting } from "../controllers/meetingController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/create", authMiddleware as any, createMeeting as any);
router.get("/my-meetings", authMiddleware as any, getMyMeetings as any);
router.get("/code/:code", getMeetingByCode as any);
router.post("/end/:code", authMiddleware as any, endMeeting as any);

export default router;
