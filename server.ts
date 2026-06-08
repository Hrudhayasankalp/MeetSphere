import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

import { connectDB } from "./server/config/db";
import { setupMeetingSocket } from "./server/socket/meetingSocket";
import authRoutes from "./server/routes/auth";
import meetingRoutes from "./server/routes/meetings";
import aiRoutes from "./server/routes/ai";


const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
});

async function startPlatform() {
  // Try connecting to MongoDB. Will automatically failover to local fallback simulation if Uri is empty or fails.
  await connectDB();

  // Root Request Parsing middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Router Attachments
  app.use("/api/auth", authRoutes);
  app.use("/api/meetings", meetingRoutes);
  app.use("/api/ai", aiRoutes);

  // Status Diagnostic Endpoint (No over-telemetry logging as guidelines reject noise, keep it literal human simple)
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
  });

  // Client Static Assets integration with dev / production splits
  if (process.env.NODE_ENV !== "production") {
    console.log("🛠️  Express is operating under DEVELOPMENT environment. Hooking Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 Express is operating under PRODUCTION static mode. Serving dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind Socket operations listener
  setupMeetingSocket(io);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`📡 Server running on http://localhost:${PORT}`);
  });
}

startPlatform().catch((err) => {
  console.error("❌ Fatal Platform Boot Failure:", err);
});
