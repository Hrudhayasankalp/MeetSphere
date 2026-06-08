import mongoose from "mongoose";

let isConnected = false;
let fallbackMode = false;

// Disable buffering globally so Mongoose operations fail fast when not connected
// and the try/catch fallbacks work instantly instead of timing out after 10000ms.
mongoose.set("bufferCommands", false);

export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn("⚠️  [DATABASE PREVIEW MODE] MONGODB_URI environment variable is missing.");
    console.warn("👉  Falling back to local simulated storage for live preview capability.");
    fallbackMode = true;
    return false;
  }

  if (isConnected) {
    return true;
  }

  try {
    const conn = await mongoose.connect(uri, {
      connectTimeoutMS: 5000,
    });
    isConnected = true;
    fallbackMode = false;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error: any) {
    console.warn("⚠️ MongoDB Connection Info (Sandbox Fallback Active):", error?.message || error);
    console.warn("👉 Falling back to local simulated storage due to database connection failure.");
    fallbackMode = true;
    return false;
  }
}

export function isUsingFallback(): boolean {
  return fallbackMode;
}
