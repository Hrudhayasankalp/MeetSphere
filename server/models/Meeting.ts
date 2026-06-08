import { Schema, model, Document, Types } from "mongoose";

export interface IParticipantRecord {
  userId?: string | Types.ObjectId;
  name: string;
  email?: string;
  joinedAt: Date;
  leftAt?: Date;
}

export interface IPollOption {
  optionText: string;
  votes: string[];
}

export interface IPoll {
  id: string;
  question: string;
  options: IPollOption[];
  isActive: boolean;
  isOpen: boolean;
  createdAt: Date;
}

export interface IChatMessage {
  senderId?: string | Types.ObjectId;
  senderName: string;
  senderAvatar?: string;
  message: string;
  timestamp: Date;
}

export interface IWhiteboardStroke {
  tool: string;
  color: string;
  width: number;
  points: number[];
}

export interface IMeeting extends Document {
  meetingCode: string;
  title: string;
  description?: string;
  password?: string;
  host: Types.ObjectId | string;
  status: "scheduled" | "active" | "completed";
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  polls: IPoll[];
  attendance: IParticipantRecord[];
  chatHistory: IChatMessage[];
  whiteboardData: IWhiteboardStroke[];
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantRecordSchema = new Schema<IParticipantRecord>({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  name: { type: String, required: true },
  email: { type: String },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
});

const PollOptionSchema = new Schema<IPollOption>({
  optionText: { type: String, required: true },
  votes: [{ type: String }],
});

const PollSchema = new Schema<IPoll>({
  id: { type: String, required: true },
  question: { type: String, required: true },
  options: [PollOptionSchema],
  isActive: { type: Boolean, default: true },
  isOpen: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const ChatMessageSchema = new Schema<IChatMessage>({
  senderId: { type: Schema.Types.ObjectId, ref: "User" },
  senderName: { type: String, required: true },
  senderAvatar: { type: String },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const WhiteboardStrokeSchema = new Schema<IWhiteboardStroke>({
  tool: { type: String, default: "pencil" },
  color: { type: String, default: "#ffffff" },
  width: { type: Number, default: 3 },
  points: [{ type: Number }],
});

const MeetingSchema = new Schema<IMeeting>(
  {
    meetingCode: { type: String, required: true, unique: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    password: { type: String },
    host: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["scheduled", "active", "completed"], default: "scheduled" },
    scheduledStartTime: { type: Date },
    scheduledEndTime: { type: Date },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    polls: [PollSchema],
    attendance: [ParticipantRecordSchema],
    chatHistory: [ChatMessageSchema],
    whiteboardData: [WhiteboardStrokeSchema],
    recordingUrl: { type: String },
  },
  { timestamps: true }
);

export const Meeting = model<IMeeting>("Meeting", MeetingSchema);
export default Meeting;
