export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "user" | "admin";
}

export interface Participant {
  socketId: string;
  userId: string;
  name: string;
  avatar?: string;
  micActive: boolean;
  camActive: boolean;
  screenSharing: boolean;
}

export interface ChatMessage {
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  timestamp: string | Date;
}

export interface PollOption {
  optionText: string;
  votes: string[]; // names of voters
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  isActive: boolean;
  isOpen: boolean;
}

export interface BoardStroke {
  tool: "pencil" | "eraser";
  color: string;
  width: number;
  points: number[];
}

export interface AttendanceRecord {
  userId?: string;
  name: string;
  email?: string;
  joinedAt: string | Date;
  leftAt?: string | Date;
}

export interface MeetingDetails {
  meetingCode: string;
  title: string;
  description?: string;
  host: {
    _id?: string;
    name: string;
    email: string;
    avatar?: string;
  } | string;
  status: "scheduled" | "active" | "completed";
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string | Date;
  actualEndTime?: string | Date;
  polls?: Poll[];
  attendance?: AttendanceRecord[];
  chatHistory?: ChatMessage[];
  whiteboardData?: any[];
  recordingUrl?: string;
}
