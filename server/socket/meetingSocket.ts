import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { Meeting } from "../models/Meeting";
import { isUsingFallback } from "../config/db";
import { memoryMeetings } from "../config/tempStore";

interface Participant {
  socketId: string;
  userId: string;
  name: string;
  avatar?: string;
  micActive: boolean;
  camActive: boolean;
  screenSharing: boolean;
}

// Memory backup for fallback live interactive state
const activeRooms = new Map<string, Participant[]>();

export function setupMeetingSocket(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`🔌 Socket Connected: ${socket.id}`);

    // Join Room Event
    socket.on("join-room", async (data: { roomCode: string; userId: string; name: string; avatar?: string }) => {
      const { roomCode, userId, name, avatar } = data;
      const cleanCode = roomCode.toLowerCase();

      await socket.join(cleanCode);

      // Create or update participant
      const participant: Participant = {
        socketId: socket.id,
        userId,
        name,
        avatar,
        micActive: true,
        camActive: true,
        screenSharing: false,
      };

      // Register in room
      if (!activeRooms.has(cleanCode)) {
        activeRooms.set(cleanCode, []);
      }
      const participants = activeRooms.get(cleanCode)!;
      // Prevent duplicates from same multi-tab user
      const existingIdx = participants.findIndex(p => p.userId === userId);
      if (existingIdx !== -1) {
        participants[existingIdx] = participant;
      } else {
        participants.push(participant);
      }

      console.log(`👤 User [${name}] joined meeting: [${cleanCode}]`);

      // Broadcast client list in this session room
      io.to(cleanCode).emit("room-participants", participants);
      socket.to(cleanCode).emit("user-joined", participant);

      // Update Database attendance logs
      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        try {
          const meeting = await Meeting.findOne({ meetingCode: cleanCode });
          if (meeting) {
            const attendeeIdx = meeting.attendance.findIndex(
              (a) => a.userId?.toString() === userId || (a.name === name && !a.leftAt)
            );
            if (attendeeIdx === -1) {
              meeting.attendance.push({
                userId: mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
                name,
                joinedAt: new Date(),
              } as any);
              await meeting.save();
            }
          }
        } catch (err) {
          console.log("[DB Info/Offline Mode] Skipped database attendance sync.");
        }
      }

      // Update fallback local memory meetings list
      const memM = memoryMeetings.find(m => m.meetingCode === cleanCode);
      if (memM) {
        const attendeeIdx = memM.attendance.findIndex(
          (a) => String(a.userId) === String(userId) || (a.name === name && !a.leftAt)
        );
        if (attendeeIdx === -1) {
          memM.attendance.push({
            userId,
            name,
            joinedAt: new Date(),
          });
        }
      }
    });

    // Toggle Web RTC audio / video controls triggers
    socket.on("toggle-media", (data: { roomCode: string; mediaType: "mic" | "cam" | "screen"; status: boolean }) => {
      const { roomCode, mediaType, status } = data;
      const cleanCode = roomCode.toLowerCase();
      const participants = activeRooms.get(cleanCode);

      if (participants) {
        const participant = participants.find((p) => p.socketId === socket.id);
        if (participant) {
          if (mediaType === "mic") participant.micActive = status;
          if (mediaType === "cam") participant.camActive = status;
          if (mediaType === "screen") participant.screenSharing = status;

          // Broadcast state refresh to peers
          io.to(cleanCode).emit("media-state-updated", {
            socketId: socket.id,
            userId: participant.userId,
            mediaType,
            status,
          });
          io.to(cleanCode).emit("room-participants", participants);
        }
      }
    });

    // Standard signaling proxy event for multi-participant mesh topology connection
    socket.on("webrtc-signal", (data: { targetSocketId: string; signal: any }) => {
      io.to(data.targetSocketId).emit("webrtc-signal", {
        senderSocketId: socket.id,
        signal: data.signal,
      });
    });

    // Real-time Chat proxy logic
    socket.on("send-message", async (data: { roomCode: string; senderId: string; senderName: string; senderAvatar?: string; message: string }) => {
      const { roomCode, senderId, senderName, senderAvatar, message } = data;
      const cleanCode = roomCode.toLowerCase();

      const messageObj = {
        senderId,
        senderName,
        senderAvatar,
        message,
        timestamp: new Date(),
      };

      // Broadcast instantly
      io.to(cleanCode).emit("receive-message", messageObj);

      // Save to database
      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        try {
          const meeting = await Meeting.findOne({ meetingCode: cleanCode });
          if (meeting) {
            const dbMessageObj = {
              senderId: mongoose.Types.ObjectId.isValid(senderId) ? senderId : undefined,
              senderName,
              senderAvatar,
              message,
              timestamp: new Date(),
            };
            meeting.chatHistory.push(dbMessageObj as any);
            await meeting.save();
          }
        } catch (err) {
          console.log("[DB Info/Offline Mode] Skipped database chat sync.");
        }
      }

      // Update fallback local memory meeting chat log
      const memM = memoryMeetings.find(m => m.meetingCode === cleanCode);
      if (memM) {
        memM.chatHistory.push(messageObj);
      }
    });

    // Real-time Poll creation trigger and persistence
    socket.on("create-poll", async (data: { roomCode: string; pollId: string; question: string; options: string[] }) => {
      const { roomCode, pollId, question, options } = data;
      const cleanCode = roomCode.toLowerCase();

      const newPoll = {
        id: pollId,
        question,
        options: options.map((opt) => ({ optionText: opt, votes: [] })),
        isActive: true,
        isOpen: true,
        createdAt: new Date(),
      };

      io.to(cleanCode).emit("poll-created", newPoll);

      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        try {
          const meeting = await Meeting.findOne({ meetingCode: cleanCode });
          if (meeting) {
            meeting.polls.push(newPoll as any);
            await meeting.save();
          }
        } catch (e) {}
      }

      // Update fallback in-memory meeting
      const memM = memoryMeetings.find(m => m.meetingCode === cleanCode);
      if (memM) {
        memM.polls.push(newPoll);
      }
    });

    // Poll voting event
    socket.on("vote-poll", async (data: { roomCode: string; pollId: string; optionIndex: number; voterName: string }) => {
      const { roomCode, pollId, optionIndex, voterName } = data;
      const cleanCode = roomCode.toLowerCase();

      io.to(cleanCode).emit("poll-updated", { pollId, optionIndex, voterName });

      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        try {
          const meeting = await Meeting.findOne({ meetingCode: cleanCode });
          if (meeting) {
            const poll = meeting.polls.find((p) => p.id === pollId);
            if (poll && poll.options[optionIndex]) {
              // Avoid double voting from same client name
              const votes = poll.options[optionIndex].votes;
              if (!votes.includes(voterName)) {
                votes.push(voterName);
                await meeting.save();
              }
            }
          }
        } catch (err) {}
      }

      // Update fallback in-memory vote
      const memM = memoryMeetings.find(m => m.meetingCode === cleanCode);
      if (memM) {
        const poll = memM.polls.find((p) => p.id === pollId);
        if (poll && poll.options[optionIndex]) {
          const votes = poll.options[optionIndex].votes;
          if (!votes.includes(voterName)) {
            votes.push(voterName);
          }
        }
      }
    });

    // Emoji burst triggers (high interactivity layout)
    socket.on("send-reaction", (data: { roomCode: string; sender: string; reactionType: string }) => {
      const { roomCode, sender, reactionType } = data;
      const cleanCode = roomCode.toLowerCase();

      // Transmits reaction immediately to floating effects renderer
      io.to(cleanCode).emit("receive-reaction", {
        id: Math.random().toString(36).substring(2, 9),
        sender,
        reactionType,
        createdAt: Date.now(),
      });
    });

    // Whiteboard realtime brush drawing vector streams
    socket.on("whiteboard-stroke", async (data: { roomCode: string; stroke: { tool: string; color: string; width: number; points: number[] } }) => {
      const { roomCode, stroke } = data;
      const cleanCode = roomCode.toLowerCase();

      socket.to(cleanCode).emit("whiteboard-stroke", stroke);

      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        try {
          const meeting = await Meeting.findOne({ meetingCode: cleanCode });
          if (meeting) {
            meeting.whiteboardData.push(stroke as any);
            await meeting.save();
          }
        } catch (e) {}
      }

      // Update fallback in-memory canvas data
      const memM = memoryMeetings.find(m => m.meetingCode === cleanCode);
      if (memM) {
        memM.whiteboardData.push(stroke);
      }
    });

    socket.on("whiteboard-clear", async (data: { roomCode: string }) => {
      const { roomCode } = data;
      const cleanCode = roomCode.toLowerCase();

      io.to(cleanCode).emit("whiteboard-cleared");

      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        try {
          const meeting = await Meeting.findOne({ meetingCode: cleanCode });
          if (meeting) {
            meeting.whiteboardData = [];
            await meeting.save();
          }
        } catch (e) {}
      }

      // Update fallback in-memory clear
      const memM = memoryMeetings.find(m => m.meetingCode === cleanCode);
      if (memM) {
        memM.whiteboardData = [];
      }
    });

    // Real-time speech caption routing
    socket.on("speech-caption", (data: { roomCode: string; senderName: string; caption: string }) => {
      const { roomCode, senderName, caption } = data;
      socket.to(roomCode.toLowerCase()).emit("speech-caption", { senderName, caption });
    });

    // Real-time meeting conclusion routing
    socket.on("conclude-meeting", (data: { roomCode: string }) => {
      const { roomCode } = data;
      io.to(roomCode.toLowerCase()).emit("meeting-ended");
    });

    // Start/Stop recording toggle state persistence
    socket.on("toggle-recording", (data: { roomCode: string; isRecording: boolean; recordingUrl?: string }) => {
      const { roomCode, isRecording, recordingUrl } = data;
      const cleanCode = roomCode.toLowerCase();

      io.to(cleanCode).emit("recording-status", { isRecording, recordingUrl });

      if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
        Meeting.findOne({ meetingCode: cleanCode })
          .then((m) => {
            if (m) {
              m.recordingUrl = recordingUrl || (isRecording ? "recording-active" : undefined);
              return m.save();
            }
          })
          .catch(() => {});
      }

      // Update fallback in-memory meeting recording url status
      const memM = memoryMeetings.find(m => m.meetingCode === cleanCode);
      if (memM) {
        memM.recordingUrl = recordingUrl || (isRecording ? "recording-active" : undefined);
      }
    });

    // Cleanup active socket on disconnect
    socket.on("disconnect", async () => {
      console.log(`🔌 Socket Disconnected: ${socket.id}`);

      for (const [roomCode, participants] of activeRooms.entries()) {
        const idx = participants.findIndex((p) => p.socketId === socket.id);
        if (idx !== -1) {
          const [removedParticipant] = participants.splice(idx, 1);
          console.log(`👤 User [${removedParticipant.name}] left the socket room: [${roomCode}]`);

          // Update DB with departure timestamps
          if (mongoose.connection.readyState === 1 && !isUsingFallback()) {
            try {
              const meeting = await Meeting.findOne({ meetingCode: roomCode });
              if (meeting) {
                const attendeeIdx = meeting.attendance.findIndex(
                  (a) =>
                    (a.userId?.toString() === removedParticipant.userId ||
                      a.name === removedParticipant.name) &&
                    !a.leftAt
                );
                if (attendeeIdx !== -1) {
                  meeting.attendance[attendeeIdx].leftAt = new Date();
                  await meeting.save();
                }
              }
            } catch (e) {}
          }

          // Update fallback in-memory left timestamp logs
          const memM = memoryMeetings.find(m => m.meetingCode === roomCode);
          if (memM) {
            const attendeeIdx = memM.attendance.findIndex(
              (a) =>
                (String(a.userId) === String(removedParticipant.userId) ||
                  a.name === removedParticipant.name) &&
                !a.leftAt
            );
            if (attendeeIdx !== -1) {
              memM.attendance[attendeeIdx].leftAt = new Date();
            }
          }

          if (participants.length === 0) {
            activeRooms.delete(roomCode);
          } else {
            // Update other participants
            activeRooms.set(roomCode, participants);
            io.to(roomCode).emit("room-participants", participants);
            io.to(roomCode).emit("user-left", removedParticipant.socketId);
          }
          break;
        }
      }
    });
  });
}
