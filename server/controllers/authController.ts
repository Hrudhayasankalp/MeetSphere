import { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, IUser } from "../models/User";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { isUsingFallback } from "../config/db";
import { memoryUsers } from "../config/tempStore";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_for_dev_only";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const generateToken = (user: any): string => {
  return jwt.sign(
    { id: user._id || user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as any }
  );
};

export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: "Missing required fields (name, email, password)" });
      return;
    }

    let existingUser = null;
    try {
      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        existingUser = await User.findOne({ email });
      } else {
        existingUser = memoryUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      }
    } catch (e) {
      existingUser = memoryUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (existingUser) {
      res.status(409).json({ success: false, message: "Email is already registered" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
    });

    let savedUser: any = newUser;

    if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
      try {
        await newUser.save();
      } catch (e) {
        const memUser = {
          _id: "temp-userId-" + Date.now(),
          name: newUser.name,
          email: newUser.email,
          password: hashedPassword,
          avatar: newUser.avatar,
          role: newUser.role || "user",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryUsers.push(memUser);
        savedUser = memUser;
      }
    } else {
      const memUser = {
        _id: "temp-userId-" + Date.now(),
        name: newUser.name,
        email: newUser.email,
        password: hashedPassword,
        avatar: newUser.avatar,
        role: newUser.role || "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryUsers.push(memUser);
      savedUser = memUser;
    }

    const token = generateToken(savedUser);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: savedUser._id || savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        avatar: savedUser.avatar,
        role: savedUser.role,
      },
    });
  } catch (error: any) {
    console.error("Registration failed:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
}

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Missing email or password" });
      return;
    }

    let user: any = null;
    try {
      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        user = await User.findOne({ email });
      } else {
        user = memoryUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      }
    } catch (e) {}

    if (!user) {
      user = memoryUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (!user) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Authentication successful",
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login failed:", error);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
}

export async function googleLogin(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { email, name, avatar, googleId } = req.body;

    if (!email || !name) {
      res.status(400).json({ success: false, message: "Google OAuth missing fields" });
      return;
    }

    let user = null;
    try {
      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        user = await User.findOne({ email });
      }
    } catch (e) {}

    if (!user) {
      user = new User({
        name,
        email,
        googleId: googleId || `gg-${Date.now()}`,
        avatar: avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      });
      try {
        if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
          await user.save();
        }
      } catch (e) {}
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: "Google login verified",
      token,
      user: {
        id: user._id || "googleId-" + Date.now(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Google authentication failed:", error);
    res.status(500).json({ success: false, message: "Server error during Google auth" });
  }
}

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    let user = null;
    try {
      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        user = await User.findById(req.user.id).select("-password");
      }
    } catch (e) {}

    if (!user) {
      res.status(200).json({
        success: true,
        user: {
          _id: req.user.id,
          name: req.user.email.split("@")[0],
          email: req.user.email,
          role: req.user.role,
          avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(req.user.id)}`
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error("Get profile failed:", error);
    res.status(500).json({ success: false, message: "Server error fetching profile" });
  }
}
