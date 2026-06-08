export interface IMemoryMeeting {
  meetingCode: string;
  title: string;
  description?: string;
  password?: string;
  host: any; // Can be user ID, string, or populated user object
  status: "scheduled" | "active" | "completed";
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  polls: any[];
  attendance: any[];
  chatHistory: any[];
  whiteboardData: any[];
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const memoryMeetings: IMemoryMeeting[] = [];

export interface IMemoryUser {
  _id: string;
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  avatar?: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

export const memoryUsers: IMemoryUser[] = [];

