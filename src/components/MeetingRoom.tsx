import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Send, Users, 
  MessageSquare, BarChart2, Edit3, Sparkles, Smile, Play, Square, 
  Trash2, Download, Check, HelpCircle, AudioLines, Minimize2, Maximize, ChevronRight, X, ArrowRight,
  Lock, KeySquare, Share2, Database, Sun, Moon
} from "lucide-react";
import { Participant, ChatMessage, Poll, BoardStroke } from "../types";

interface MeetingRoomProps {
  roomCode: string;
  onLeave: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

interface FloatingEmoji {
  id: string;
  sender: string;
  reactionType: string;
}

export default function MeetingRoom({ roomCode, onLeave, isDarkMode, onToggleTheme }: MeetingRoomProps) {
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  // Guest custom joining fields
  const [guestName, setGuestName] = useState("");
  const [hasEnteredGuestName, setHasEnteredGuestName] = useState(user !== null);

  // Passcode room gating States
  const [meetingDetails, setMeetingDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [passwordChecked, setPasswordChecked] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Audio/Video Local States
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const recIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef<string | null>(null);
  const isRecordingInitiator = useRef(false);

  // Real Audio/Video Stream refs & states
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  // WebRTC structure references
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // Participant Listing
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Messaging state
  const [chatActive, setChatActive] = useState(false);
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Polls state
  const [pollsActive, setPollsActive] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [newPollQuestion, setNewPollQuestion] = useState("");
  const [newPollOptions, setNewPollOptions] = useState(["", ""]);

  // Drawing Canvas (Whiteboard) state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [boardColor, setBoardColor] = useState("#C9A84C");
  const [boardWidth, setBoardWidth] = useState(3);
  const [boardTool, setBoardTool] = useState<"pencil" | "eraser">("pencil");

  // Floating Reactions State
  const [reactions, setReactions] = useState<FloatingEmoji[]>([]);

  // AI Assistant Panel State
  const [aiPanelActive, setAiPanelActive] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [notesSummary, setNotesSummary] = useState<string | null>(null);
  const [meetingNotes, setMeetingNotes] = useState("");
  
  // Realtime Captioning Text Feed
  const [captionsFeed, setCaptionsFeed] = useState<string>("[Speech Captions Active... Speak into Microphone]");
  const captionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref streams for Camera Simulations so they paint beautifully on canvases
  const localVideoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localCamLoopRef = useRef<number | null>(null);

  // Realtime Speech Recognition
  const recognitionRef = useRef<any>(null);
  const micActiveRef = useRef(micActive);
  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);

  // Link Sharing functions
  const handleShareMeetingLink = () => {
    const meetingLink = `${window.location.origin}/room/${roomCode}`;
    if (navigator.share) {
      navigator.share({
        title: `Join MeetSphere.io Conference: ${roomCode}`,
        text: `Please join my MeetSphere.io video call! Code: ${roomCode}`,
        url: meetingLink,
      }).catch((err) => {
        copyLinkToClipboard(meetingLink);
      });
    } else {
      copyLinkToClipboard(meetingLink);
    }
  };

  const copyLinkToClipboard = (link: string) => {
    navigator.clipboard.writeText(link);
    alert(`Meeting link generated & copied to clipboard:\n${link}`);
  };

  // Helper to establish WebRTC connections
  const getOrCreatePC = (targetSocketId: string) => {
    if (pcsRef.current.has(targetSocketId)) {
      return pcsRef.current.get(targetSocketId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const videoTrack = (screenSharing && screenStreamRef.current) 
      ? screenStreamRef.current.getVideoTracks()[0] 
      : (localStreamRef.current ? localStreamRef.current.getVideoTracks()[0] : null);

    const audioTrack = localStreamRef.current ? localStreamRef.current.getAudioTracks()[0] : null;

    if (audioTrack && localStreamRef.current) {
      pc.addTrack(audioTrack, localStreamRef.current);
    }
    if (videoTrack) {
      const parentStream = (screenSharing && screenStreamRef.current) ? screenStreamRef.current! : localStreamRef.current!;
      pc.addTrack(videoTrack, parentStream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-signal", {
          targetSocketId,
          signal: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const streams = event.streams;
      if (streams && streams[0]) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetSocketId]: streams[0],
        }));
      }
    };

    pcsRef.current.set(targetSocketId, pc);
    return pc;
  };

  useEffect(() => {
    let active = true;
    const fetchAndVerifyMeeting = async () => {
      try {
        const url = `/api/meetings/code/${roomCode.toLowerCase()}`;
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(url, { headers });
        const data = await res.json();
        
        if (!active) return;

        if (data.success && data.meeting) {
          setMeetingDetails(data.meeting);
          
          if (data.meeting.chatHistory) {
            setChats(data.meeting.chatHistory);
          }
          if (data.meeting.polls) {
            setPolls(data.meeting.polls);
          }

          if (data.meeting.password) {
            const hostId = data.meeting.host?._id || data.meeting.host?.id || data.meeting.host;
            const isHost = user && hostId && String(hostId) === String(user.id);
            
            if (isHost) {
              setPasswordChecked(true);
            } else {
              setPasswordChecked(false);
            }
          } else {
            setPasswordChecked(true);
          }
        } else {
          setPasswordChecked(true);
        }
      } catch (err) {
        console.error("Meeting details fetch error:", err);
        if (active) {
          setPasswordChecked(true);
        }
      } finally {
        if (active) {
          setLoadingDetails(false);
        }
      }
    };

    fetchAndVerifyMeeting();
    return () => {
      active = false;
    };
  }, [roomCode, token, user]);

  useEffect(() => {
    if (!passwordChecked) return;
    if (!hasEnteredGuestName && !user) return;

    let isComponentMounted = true;

    const startSession = async () => {
      // 1. Initialize local media devices first
      await initLocalDevices();

      if (!isComponentMounted) return;

      // 2. Connect Socket.io Client and join room
      socketRef.current = io();

      // Trigger Join Event
      socketRef.current.emit("join-room", {
        roomCode,
        userId: user?.id || "anonymous-" + Math.random().toString(36).substring(2, 7),
        name: user?.name || guestName || "Guest",
        avatar: user?.avatar,
      });

      // Sockets Listeners binding
      socketRef.current.on("room-participants", (list: Participant[]) => {
        setParticipants(list);
      });

      socketRef.current.on("receive-message", (msg: ChatMessage) => {
        setChats((prev) => [...prev, msg]);
      });

      socketRef.current.on("poll-created", (poll: Poll) => {
        setPolls((prev) => [...prev, poll]);
      });

      socketRef.current.on("poll-updated", ({ pollId, optionIndex, voterName }) => {
        setPolls((prev) => 
          prev.map((p) => {
            if (p.id === pollId) {
              const updatedOpts = [...p.options];
              if (!updatedOpts[optionIndex].votes.includes(voterName)) {
                updatedOpts[optionIndex] = {
                  ...updatedOpts[optionIndex],
                  votes: [...updatedOpts[optionIndex].votes, voterName]
                };
              }
              return { ...p, options: updatedOpts };
            }
            return p;
          })
        );
      });

      socketRef.current.on("receive-reaction", (reactionData: FloatingEmoji) => {
        setReactions((prev) => [...prev, reactionData]);
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== reactionData.id));
        }, 4000); // clear after animation loop finishes
      });

      socketRef.current.on("whiteboard-stroke", (stroke: BoardStroke) => {
        paintStroke(stroke);
      });

      socketRef.current.on("whiteboard-cleared", () => {
        clearLocalCanvas();
      });

      socketRef.current.on("recording-status", async ({ isRecording: recStat, recordingUrl }) => {
        setIsRecording(recStat);
        if (recordingUrl) {
          recordingUrlRef.current = recordingUrl;
        }
        if (recStat) {
          setRecordingTimer(0);
          if (recIntervalRef.current) clearInterval(recIntervalRef.current);
          recIntervalRef.current = setInterval(() => {
            setRecordingTimer((prev) => prev + 1);
          }, 1000);

          if (isRecordingInitiator.current) {
            try {
              recordedChunksRef.current = [];
              let recordStream: MediaStream;
              try {
                recordStream = await navigator.mediaDevices.getDisplayMedia({
                  video: true,
                  audio: true
                });
              } catch (err) {
                console.warn("Display media with audio failed, falling back to video-only display media...", err);
                recordStream = await navigator.mediaDevices.getDisplayMedia({
                  video: true
                });
              }

              // Auto-stop recording if user stops sharing via browser bar
              if (recordStream && recordStream.getVideoTracks().length > 0) {
                recordStream.getVideoTracks()[0].onended = () => {
                  if (socketRef.current) {
                    socketRef.current.emit("toggle-recording", {
                      roomCode,
                      isRecording: false,
                      recordingUrl: `rec-ref-${Math.random().toString(36).substring(2,8)}`
                    });
                  }
                };
              }

              const options = { mimeType: "video/webm;codecs=vp9,opus" };
              let recorder: MediaRecorder;
              try {
                recorder = new MediaRecorder(recordStream, options);
              } catch (e) {
                try {
                  recorder = new MediaRecorder(recordStream, { mimeType: "video/webm" });
                } catch (e2) {
                  recorder = new MediaRecorder(recordStream);
                }
              }
              recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                  recordedChunksRef.current.push(event.data);
                }
              };
              recorder.onstop = () => {
                const finalUrl = recordingUrlRef.current;
                if (recordedChunksRef.current.length > 0 && finalUrl) {
                  const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
                  const request = indexedDB.open("MeetSphereRecordings", 1);
                  request.onupgradeneeded = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains("videos")) {
                      db.createObjectStore("videos");
                    }
                  };
                  request.onsuccess = (e: any) => {
                    const db = e.target.result;
                    const tx = db.transaction("videos", "readwrite");
                    const store = tx.objectStore("videos");
                    store.put(blob, finalUrl);
                  };
                  request.onerror = (e: any) => {
                    console.error("IndexedDB open error:", e);
                  };
                }
                // Stop screen capturing tracks
                recordStream.getTracks().forEach((track) => track.stop());
              };
              recorder.start(1000);
              mediaRecorderRef.current = recorder;
            } catch (err) {
              console.warn("Screen share capture denied or failed:", err);
              isRecordingInitiator.current = false;
              if (socketRef.current) {
                socketRef.current.emit("toggle-recording", { roomCode, isRecording: false });
              }
            }
          }
        } else {
          isRecordingInitiator.current = false;
          if (recIntervalRef.current) {
            clearInterval(recIntervalRef.current);
            recIntervalRef.current = null;
          }
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
              mediaRecorderRef.current.stop();
            } catch (err) {
              console.warn("Error stopping MediaRecorder:", err);
            }
          }
          if (recordingUrl) {
            alert("Meeting recording finished successfully!");
          }
        }
      });

      socketRef.current.on("speech-caption", (data: { senderName: string; caption: string }) => {
        setCaptionsFeed(`${data.senderName}: ${data.caption}`);
      });

      socketRef.current.on("meeting-ended", () => {
        alert("The meeting has been concluded by the organizer.");
        onLeave();
      });

      socketRef.current.on("user-joined", async (participant: Participant) => {
        const pc = getOrCreatePC(participant.socketId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit("webrtc-signal", {
            targetSocketId: participant.socketId,
            signal: { type: "offer", sdp: offer.sdp },
          });
        } catch (err) {
          console.error("Error creating WebRTC offer:", err);
        }
      });

      socketRef.current.on("webrtc-signal", async (data: { senderSocketId: string; signal: any }) => {
        const { senderSocketId, signal } = data;
        const pc = getOrCreatePC(senderSocketId);

        try {
          if (signal.type === "offer") {
            if (pc.signalingState !== "stable") {
              console.warn(`Incoming WebRTC offer from ${senderSocketId} ignored because state is ${pc.signalingState}`);
              return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current?.emit("webrtc-signal", {
              targetSocketId: senderSocketId,
              signal: { type: "answer", sdp: answer.sdp },
            });

            // Process queued ICE candidates
            const queued = (pc as any).iceCandidateQueue || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn("Error adding queued ICE candidate:", e);
              }
            }
            (pc as any).iceCandidateQueue = [];

          } else if (signal.type === "answer") {
            if (pc.signalingState !== "have-local-offer") {
              console.warn(`Incoming WebRTC answer from ${senderSocketId} ignored because state is ${pc.signalingState}`);
              return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: signal.sdp }));

            // Process queued ICE candidates
            const queued = (pc as any).iceCandidateQueue || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn("Error adding queued ICE candidate:", e);
              }
            }
            (pc as any).iceCandidateQueue = [];

          } else if (signal.type === "candidate") {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              } catch (e) {
                console.warn("Error establishing ICE candidate:", e);
              }
            } else {
              if (!(pc as any).iceCandidateQueue) {
                (pc as any).iceCandidateQueue = [];
              }
              (pc as any).iceCandidateQueue.push(signal.candidate);
            }
          }
        } catch (err) {
          console.error("Error handling WebRTC signal:", err);
        }
      });

      socketRef.current.on("user-left", (socketId: string) => {
        if (pcsRef.current.has(socketId)) {
          pcsRef.current.get(socketId)?.close();
          pcsRef.current.delete(socketId);
        }
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });
      });

      // Populate initial History
      fetchMeetingHistory();

      // Start dynamic Speech recognition
      initSpeechRecognition();
    };

    const createCanvasFallbackStream = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      
      const draw = () => {
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.fillStyle = "#1A1A1A";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(201, 168, 76, 0.06)";
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += 20) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, h);
          ctx.stroke();
        }
        for (let j = 0; j < h; j += 20) {
          ctx.beginPath();
          ctx.moveTo(0, j);
          ctx.lineTo(w, j);
          ctx.stroke();
        }

        const time = Date.now() * 0.003;
        const pulse = Math.sin(time) * 5 + 45;

        ctx.fillStyle = "#C9A84C";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(201, 168, 76, 0.3)";
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 10, pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Inter";
        ctx.textAlign = "center";
        ctx.fillText("Camera Active (Simulated)", w / 2, h / 2 + 65);

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < w; i += 10) {
          const amp = Math.sin(time + i * 0.05) * 8;
          ctx.lineTo(i, h - 30 + amp);
        }
        ctx.stroke();

        localCamLoopRef.current = requestAnimationFrame(draw);
      };

      localCamLoopRef.current = requestAnimationFrame(draw);
      
      const captureStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
      return captureStream;
    };

    // Initialize local devices
    const initLocalDevices = async () => {
      try {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (dualErr) {
          console.warn("Dual mic/cam capture failed, testing separate channels...", dualErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (videoErr) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            } catch (audioErr) {
              console.warn("No camera or mic hardware, creating fallback canvas feed...", audioErr);
              const fallback = createCanvasFallbackStream();
              if (fallback) {
                stream = fallback;
              } else {
                stream = new MediaStream();
              }
            }
          }
        }

        if (stream && stream.getVideoTracks().length === 0) {
          const fallback = createCanvasFallbackStream();
          if (fallback && fallback.getVideoTracks().length > 0) {
            stream.addTrack(fallback.getVideoTracks()[0]);
          }
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        const videoTrack = stream ? stream.getVideoTracks()[0] : null;
        const audioTrack = stream ? stream.getAudioTracks()[0] : null;
        setCamActive(videoTrack ? videoTrack.enabled : false);
        setMicActive(audioTrack ? audioTrack.enabled : false);

      } catch (err) {
        console.warn("Could not access camera/mic, falling back to simulated visuals:", err);
        const fallback = createCanvasFallbackStream();
        if (fallback) {
          localStreamRef.current = fallback;
          setLocalStream(fallback);
          setCamActive(true);
          setMicActive(true);
        }
      }
    };

    startSession();

    return () => {
      isComponentMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
      if (captionsTimeoutRef.current) clearTimeout(captionsTimeoutRef.current);
      if (localCamLoopRef.current) cancelAnimationFrame(localCamLoopRef.current);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [roomCode, hasEnteredGuestName, guestName, passwordChecked]);

  useEffect(() => {
    // Autoscroll chat
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chats, chatActive]);

  const fetchMeetingHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/meetings/code/${roomCode.toLowerCase()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.meeting) {
        if (data.meeting.chatHistory) {
          setChats(data.meeting.chatHistory);
        }
        if (data.meeting.polls) {
          setPolls(data.meeting.polls);
        }
      }
    } catch (e) {
      console.warn("Failed caching meeting history log.");
    }
  };

  // Web Speech API real-time microphone to text transcription
  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setCaptionsFeed("[Live Caption: Speech Recognition not supported in this browser]");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeCaption = finalTranscript || interimTranscript;
      if (activeCaption.trim()) {
        setCaptionsFeed(`You: ${activeCaption}`);
        if (socketRef.current) {
          socketRef.current.emit("speech-caption", {
            roomCode,
            senderName: user?.name || guestName || "Guest",
            caption: activeCaption,
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setCaptionsFeed("[Live Caption: Mic permission required]");
      }
    };

    recognition.onend = () => {
      // Keep listening if mic is still active
      if (micActiveRef.current && socketRef.current && socketRef.current.connected) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    if (micActiveRef.current) {
      try {
        recognition.start();
      } catch (e) {}
    }
  };

  // Webcam stream animator painting dynamically inside canvas layout
  const kickoffLocalVideoSimulation = () => {
    const draw = () => {
      const canvas = localVideoCanvasRef.current;
      if (canvas && camActive) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Draw futuristic background geometry grids
          ctx.fillStyle = "#1A1A1A";
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = "rgba(201, 168, 76, 0.06)";
          ctx.lineWidth = 1;
          for (let i = 0; i < w; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, h);
            ctx.stroke();
          }
          for (let j = 0; j < h; j += 20) {
            ctx.beginPath();
            ctx.moveTo(0, j);
            ctx.lineTo(w, j);
            ctx.stroke();
          }

          // Draw an animated avatar profile circles
          const time = Date.now() * 0.003;
          const pulse = Math.sin(time) * 5 + 45;

          ctx.fillStyle = "#C9A84C";
          ctx.shadowBlur = 15;
          ctx.shadowColor = "rgba(201, 168, 76, 0.3)";
          ctx.beginPath();
          ctx.arc(w / 2, h / 2 - 10, pulse, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px Inter";
          ctx.textAlign = "center";
          ctx.fillText("Camera Active", w / 2, h / 2 + 65);

          // Signal frequency graphics card soundwave
          ctx.strokeStyle = "rgba(255,255,255,0.4)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < w; i += 10) {
            const amp = Math.sin(time + i * 0.05) * 8;
            ctx.lineTo(i, h - 30 + amp);
          }
          ctx.stroke();
        }
      }
      localCamLoopRef.current = requestAnimationFrame(draw);
    };
    localCamLoopRef.current = requestAnimationFrame(draw);
  };

  const toggleMic = () => {
    const nextVal = !micActive;
    setMicActive(nextVal);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextVal;
      });
    }
    if (socketRef.current) {
      socketRef.current.emit("toggle-media", { roomCode, mediaType: "mic", status: nextVal });
    }

    // Toggle Web Speech recognition engine
    if (recognitionRef.current) {
      if (nextVal) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      } else {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
  };

  const toggleCam = () => {
    const nextVal = !camActive;
    setCamActive(nextVal);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextVal;
      });
    }
    if (socketRef.current) {
      socketRef.current.emit("toggle-media", { roomCode, mediaType: "cam", status: nextVal });
    }
  };

  const startScreenShare = async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
      } catch (audioErr) {
        console.warn("Screen share with audio permission or system capability failed, falling back to video-only display media...", audioErr);
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
      }
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenSharing(true);
      setScreenShareError(null);

      const screenVideoTrack = stream.getVideoTracks()[0];
      if (screenVideoTrack) {
        // Swap into the primary localStream video track
        if (localStreamRef.current) {
          const currentWebcamTrack = localStreamRef.current.getVideoTracks()[0];
          if (currentWebcamTrack) {
            originalVideoTrackRef.current = currentWebcamTrack;
            localStreamRef.current.removeTrack(currentWebcamTrack);
          }
          localStreamRef.current.addTrack(screenVideoTrack);
          // Trigger React state change to re-bind video elements to the modified MediaStream
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        // Replace track in peer connections and force an offer/answer renegotiation
        pcsRef.current.forEach(async (pc, targetSocketId) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === "video");
          let needsRenegotiate = false;
          if (videoSender) {
            try {
              await videoSender.replaceTrack(screenVideoTrack);
            } catch (err) {
              console.error("replaceTrack failed, adding track:", err);
              pc.addTrack(screenVideoTrack, stream);
              needsRenegotiate = true;
            }
          } else {
            pc.addTrack(screenVideoTrack, stream);
            needsRenegotiate = true;
          }

          // Force offer/answer renegotiation flow safely if signalingState is stable
          if (needsRenegotiate || pc.signalingState === "stable") {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current?.emit("webrtc-signal", {
                targetSocketId,
                signal: { type: "offer", sdp: offer.sdp },
              });
            } catch (e) {
              console.error("Renegotiation offer error during screen share:", e);
            }
          } else {
            console.log(`Renegotiation bypassed for ${targetSocketId} as track replaced cleanly and state is ${pc.signalingState}`);
          }
        });
      }

      // Handle stopped screen share from native browser control bar
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

      if (socketRef.current) {
        socketRef.current.emit("toggle-media", { roomCode, mediaType: "screen", status: true });
      }
    } catch (err: any) {
      console.warn("Screen share denied/failed:", err);
      setScreenSharing(false);
      const isIframe = window.self !== window.top;
      if (isIframe || err.name === "NotAllowedError" || err.name === "SecurityError") {
        setScreenShareError(
          "Because this application is running within an iframe (preview sandbox), browsers blocks screen capture by default for security. Please open the application in a new browser tab to enable system-wide screen sharing!"
        );
      } else {
        setScreenShareError(`Screen sharing failed: ${err.message || err}`);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setScreenSharing(false);

    // Swap back the original webcam track into the primary stream object
    if (localStreamRef.current && originalVideoTrackRef.current) {
      const activeVideoTracks = localStreamRef.current.getVideoTracks();
      activeVideoTracks.forEach((track) => {
        localStreamRef.current?.removeTrack(track);
      });
      localStreamRef.current.addTrack(originalVideoTrackRef.current);
      // Trigger React state change to restore the webcam preview
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }

    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        pcsRef.current.forEach(async (pc, targetSocketId) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === "video");
          let needsRenegotiate = false;
          if (videoSender) {
            try {
              await videoSender.replaceTrack(videoTrack);
            } catch (err) {
              console.error("restoreTrack replaceTrack failed:", err);
              needsRenegotiate = true;
            }
          } else {
            pc.addTrack(videoTrack, localStreamRef.current!);
            needsRenegotiate = true;
          }

          // Force offer/answer renegotiation flow safely if signalingState is stable
          if (needsRenegotiate || pc.signalingState === "stable") {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current?.emit("webrtc-signal", {
                targetSocketId,
                signal: { type: "offer", sdp: offer.sdp },
              });
            } catch (e) {
              console.error("Renegotiation offer error during stop screen share:", e);
            }
          } else {
            console.log(`Renegotiation bypassed for ${targetSocketId} as webcam track restored cleanly and state is ${pc.signalingState}`);
          }
        });
      }
    }

    if (socketRef.current) {
      socketRef.current.emit("toggle-media", { roomCode, mediaType: "screen", status: false });
    }
  };

  const toggleScreen = () => {
    if (screenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socketRef.current) return;

    socketRef.current.emit("send-message", {
      roomCode,
      senderId: user?.id || "anon",
      senderName: user?.name || "Guest",
      senderAvatar: user?.avatar,
      message: message.trim(),
    });

    setMessage("");
  };

  const handleLaunchPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOpts = newPollOptions.filter((o) => o.trim() !== "");
    if (!newPollQuestion.trim() || cleanOpts.length < 2 || !socketRef.current) return;

    socketRef.current.emit("create-poll", {
      roomCode,
      pollId: "poll-" + Math.random().toString(36).substring(2, 9),
      question: newPollQuestion.trim(),
      options: cleanOpts,
    });

    setNewPollQuestion("");
    setNewPollOptions(["", ""]);
  };

  const addPollOptionInput = () => {
    setNewPollOptions([...newPollOptions, ""]);
  };

  const castPollVote = (pollId: string, optionIndex: number) => {
    if (!socketRef.current) return;
    socketRef.current.emit("vote-poll", {
      roomCode,
      pollId,
      optionIndex,
      voterName: user?.name || "Participant"
    });
  };

  const triggerReaction = (type: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("send-reaction", {
      roomCode,
      sender: user?.name || "Anonymous",
      reactionType: type,
    });
  };

  const computeTotalsVotes = (options: { votes: string[] }[]): number => {
    return options.reduce((acc, curr) => acc + curr.votes.length, 0);
  };

  // Recording timer actions
  const toggleRecordingAction = () => {
    if (!isRecording) {
      isRecordingInitiator.current = true;
      if (socketRef.current) {
        socketRef.current.emit("toggle-recording", { roomCode, isRecording: true });
      }
    } else {
      if (socketRef.current) {
        socketRef.current.emit("toggle-recording", { 
          roomCode, 
          isRecording: false, 
          recordingUrl: `rec-ref-${Math.random().toString(36).substring(2,8)}` 
        });
      }
    }
  };

  const handleExitRoom = () => {
    if (isRecording) {
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.emit("toggle-recording", {
          roomCode,
          isRecording: false,
          recordingUrl: `rec-ref-${Math.random().toString(36).substring(2,8)}`
        });
      }
    }
    onLeave();
  };

  const handleConcludeAndSave = async () => {
    const confirmSave = window.confirm(
      "Are you sure you want to conclude this meeting and save its records (chat logs, polls, whiteboard drawing, attendees) to your account?"
    );
    if (!confirmSave) return;

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      headers["Content-Type"] = "application/json";

      const res = await fetch(`/api/meetings/end/${roomCode.toLowerCase()}`, {
        method: "POST",
        headers,
      });

      const data = await res.json();
      if (data.success) {
        if (socketRef.current) {
          socketRef.current.emit("conclude-meeting", { roomCode });
        }
        alert("Meeting concluded and records saved to your account!");
        onLeave();
      } else {
        alert(data.message || "Failed to conclude meeting room.");
      }
    } catch (err) {
      console.error("Conclude meeting error:", err);
      alert("Network error. Concluded locally.");
      onLeave();
    }
  };

  const formatRecTime = (sec: number): string => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // DIGITAL WHITEBOARD CANVAS ACTIONS
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    drawStrokePoint(e);
  };

  const drawProgress = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    drawStrokePoint(e);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const drawStrokePoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const stroke: BoardStroke = {
      tool: boardTool,
      color: boardTool === "eraser" ? "#1A1A1A" : boardColor,
      width: boardTool === "eraser" ? 30 : boardWidth,
      points: [x, y]
    };

    paintStroke(stroke);
    
    // Broadcast stroke coordinate to room sockets
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-stroke", { roomCode, stroke });
    }
  };

  const paintStroke = (stroke: BoardStroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    // Simple point trigger drawing vectors
    ctx.arc(stroke.points[0], stroke.points[1], stroke.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const triggerGlobalCanvasClear = () => {
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-clear", { roomCode });
    }
  };

  // GEMINI AI INTEGRATION ASSETS
  const triggerGeminiSummary = async () => {
    setAiLoading(true);
    setNotesSummary(null);

    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `Technical Session Sync: ${roomCode}`,
          chatHistory: chats,
          polls: polls,
          notes: meetingNotes
        })
      });

      const data = await res.json();
      if (data.success) {
        setNotesSummary(data.summary);
      } else {
        setNotesSummary(`Failed launching summarization request: ${data.message}`);
      }
    } catch (err) {
      setNotesSummary("Could not connect to AI services backend pipeline.");
    } finally {
      setAiLoading(false);
    }
  };

  if (loadingDetails) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex flex-col items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#C9A84C] mb-4"></div>
        <p className="text-xs font-mono text-[#1A1A1A]/40">Retrieving room security details...</p>
      </div>
    );
  }

  if (!passwordChecked) {
    const handlePasscodeSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);
      if (meetingDetails && passwordAttempt === meetingDetails.password) {
        setPasswordChecked(true);
      } else {
        setPasswordError("Incorrect Lobby Passcode. Verified authentication failed.");
      }
    };

    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex items-center justify-center p-6 relative font-sans overflow-hidden">
        {/* Warm background orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-[#C9A84C]/6 blur-[100px] animate-float-slow pointer-events-none -z-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#C9A84C]/4 blur-[100px] animate-float-medium pointer-events-none -z-10"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(26,26,26,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,26,26,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] -z-10"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-[#1A1A1A]/10 p-8 rounded-3xl shadow-[0_20px_60px_rgba(26,26,26,0.10)] space-y-6 text-center"
        >
          <div className="inline-flex bg-[#1A1A1A] p-3.5 rounded-2xl text-[#C9A84C] border border-[#1A1A1A]/10 shadow-lg">
            <KeySquare className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-extrabold text-[#1A1A1A] tracking-tight flex items-center justify-center gap-1.5 pt-1">
              Passcode Required <span className="text-[9px] bg-[#C9A84C]/12 border border-[#C9A84C]/25 text-[#8B6914] px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold">Compulsory</span>
            </h2>
            <p className="text-xs text-[#1A1A1A]/55">This conference room is protected. Enter passcode to participate:</p>
            <p className="text-xs font-mono font-bold text-[#8B6914] pt-1.5 bg-[#F0EFE8] py-1 rounded border border-[#1A1A1A]/10 mt-2">Room Code: {roomCode}</p>
          </div>

          {passwordError && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl text-xs font-semibold leading-normal text-left">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasscodeSubmit} className="space-y-4 text-xs text-left">
            <div className="space-y-1.5">
              <label className="font-bold text-[#1A1A1A]/60">Lobby Passcode *</label>
              <input
                type="password"
                placeholder="Enter room passcode"
                value={passwordAttempt}
                onChange={(e) => setPasswordAttempt(e.target.value)}
                required
                className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/12 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 transition-all text-sm"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onLeave}
                className="flex-1 bg-[#F0EFE8] hover:bg-[#E8E6DC] text-[#1A1A1A] border border-[#1A1A1A]/12 py-3 rounded-xl transition-all font-sans text-xs font-bold active:scale-98 cursor-pointer"
              >
                Exit Lobby
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white py-3 rounded-xl transition-all font-sans text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer shadow-sm hover:shadow-[0_4px_20px_rgba(201,168,76,0.30)]"
              >
                Authenticate <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  if (!user && !hasEnteredGuestName) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex items-center justify-center p-6 relative font-sans overflow-hidden">
        {/* Warm background orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-[#C9A84C]/6 blur-[100px] animate-float-slow pointer-events-none -z-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#C9A84C]/4 blur-[100px] animate-float-medium pointer-events-none -z-10"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(26,26,26,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,26,26,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] -z-10"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-[#1A1A1A]/10 p-8 rounded-3xl shadow-[0_20px_60px_rgba(26,26,26,0.10)] space-y-6 text-center"
        >
          <div className="inline-flex bg-[#1A1A1A] p-2.5 rounded-2xl text-[#C9A84C] shadow-lg animate-pulse">
            <Video className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-heading font-extrabold text-[#1A1A1A] tracking-tight pt-1">Join as Guest</h2>
            <p className="text-xs text-[#1A1A1A]/55">Provide a display name to participate in room: <span className="text-[#8B6914] font-mono font-bold">{roomCode}</span></p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = guestName.trim();
              if (trimmed) {
                setGuestName(trimmed);
                setHasEnteredGuestName(true);
              }
            }} 
            className="space-y-4 text-xs text-left"
          >
            <div className="space-y-1.5">
              <label className="font-bold text-[#1A1A1A]/60">Your Display Name *</label>
              <input
                type="text"
                placeholder="e.g. Guest Participant"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/12 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-97 transition-all cursor-pointer shadow-sm hover:shadow-[0_4px_20px_rgba(201,168,76,0.30)]"
            >
              Enter Meeting <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <button
            onClick={onLeave}
            className="text-xs text-[#1A1A1A]/45 hover:text-[#C9A84C] font-bold cursor-pointer"
          >
            Cancel and Return
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex flex-col font-sans overflow-hidden">
      
      {/* Top Banner indicating current call metrics */}
      <header className="bg-[#FAFAF8]/95 border-b border-[#1A1A1A]/8 py-3.5 px-6 flex justify-between items-center z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#C9A84C] animate-pulse"></span>
          <h2 className="text-sm font-heading font-bold text-[#1A1A1A] flex items-center gap-2">
            Room: <span className="text-[#8B6914] font-mono">{roomCode}</span>
          </h2>
          <button
            onClick={handleShareMeetingLink}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#C9A84C]/12 hover:bg-[#C9A84C]/20 border border-[#C9A84C]/25 text-[#8B6914] rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer relative z-10"
            title="Share Meeting Room Link"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Link
          </button>
          <span className="hidden sm:inline text-xs text-[#1A1A1A]/40 font-mono">| Secure Standard Session</span>
        </div>

        {/* Counter indicators */}
        <div className="flex items-center gap-4 text-xs font-bold">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg border border-[#1A1A1A]/10 bg-[#F0EFE8] hover:bg-[#E8E6DC] text-[#1A1A1A] transition-all cursor-pointer shadow-sm flex items-center justify-center"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          {isRecording && (
            <span className="flex items-center gap-1.5 text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full text-[10px] uppercase font-mono tracking-widest leading-none font-bold animate-pulse">
              <Square className="w-2 h-2 fill-red-500" /> REC {formatRecTime(recordingTimer)}
            </span>
          )}

          <div className="flex items-center gap-1.5 text-[#1A1A1A]/50">
            <Users className="w-4 h-4" />
            <span className="font-mono">{participants.length} Active</span>
          </div>

          {token && (
            <button
              onClick={handleConcludeAndSave}
              className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" /> Conclude & Save
            </button>
          )}

          <button
            onClick={handleExitRoom}
            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-500 hover:text-white border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all cursor-pointer"
          >
            <PhoneOff className="w-3.5 h-3.5" /> End Call
          </button>
        </div>
      </header>

      {/* Main workspace (Grid partition + tabs) */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Floating elements animation container */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          <AnimatePresence>
            {reactions.map((react) => {
              const shapesList: Record<string, string> = {
                thumbsup: "👍",
                clap: "👏",
                heart: "💖",
                laugh: "😂",
                fire: "🔥"
              };
              return (
                <motion.div
                  key={react.id}
                  initial={{ opacity: 0, y: "100%", x: Math.random() * 400 + 100 }}
                  animate={{ opacity: 1, y: "20%", x: Math.sin(Date.now()) * 50 + 200 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 3.5, ease: "easeOut" }}
                  className="absolute text-3xl flex flex-col items-center select-none"
                >
                  <span className="p-1 rounded bg-white/90 border border-[#1A1A1A]/10 text-[9px] font-mono tracking-wider font-bold mb-1 text-[#1A1A1A]/80">
                    {react.sender}
                  </span>
                  {shapesList[react.reactionType] || "👍"}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Call layout panels (Left panel displays layout streams/captions) */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 relative justify-between">
          
          {screenShareError && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700 text-xs shadow-lg relative z-20"
            >
              <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-800 mb-1">Iframe Sandbox Security Limitation</p>
                <p className="leading-relaxed text-[#1A1A1A]/70">{screenShareError}</p>
                <div className="mt-3 flex items-center gap-3">
                  <a 
                    href={window.location.href} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white font-bold py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                  >
                    Open in New Tab <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button 
                    onClick={() => setScreenShareError(null)} 
                    className="text-[#1A1A1A]/60 hover:text-[#1A1A1A] font-bold py-1 px-2.5 bg-[#F0EFE8] border border-[#1A1A1A]/10 rounded-lg hover:bg-[#E8E6DC] cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Main Visual Media Projection (Grid representation or active Screen projector) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto content-center pr-1">
            
            {/* Live Camera canvas loops */}
            <div className="aspect-video bg-[#1A1A1A] border border-[#1A1A1A]/20 rounded-2xl overflow-hidden relative flex flex-col justify-between p-4 group shadow-sm">
              {localStream ? (
                <video
                  ref={(el) => {
                    if (el && el.srcObject !== localStream) {
                      el.srcObject = localStream;
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ display: (camActive || screenSharing) ? "block" : "none" }}
                />
              ) : null}

              {(!localStream || (!camActive && !screenSharing)) && (
                <canvas 
                  ref={localVideoCanvasRef} 
                  className="absolute inset-0 w-full h-full object-cover" 
                  width={400} 
                  height={225} 
                />
              )}

              <div className="absolute inset-0 bg-[#1A1A1A]/90 flex flex-col items-center justify-center p-4 text-center z-1" style={{ display: (camActive || screenSharing) ? "none" : "flex" }}>
                <VideoOff className="w-8 h-8 text-white/30 mb-2" />
                <span className="text-xs font-bold text-white/50">Camera Paused</span>
              </div>
              <div className="absolute top-4 left-4 bg-[#1A1A1A]/80 backdrop-blur-sm px-3 py-1 rounded-xl text-xs font-bold border border-white/10 z-2 flex items-center gap-1.5 text-white">
                <span className="h-1.5 w-1.5 bg-[#C9A84C] rounded-full animate-ping"></span> You ({user?.name || guestName || "Guest"})
              </div>
            </div>

            {/* Simulated interactive whiteboard sheet inside call grid */}
            {isWhiteboardActive && (
              <div className="aspect-video bg-[#1A1A1A] border border-[#C9A84C]/30 rounded-2xl overflow-hidden relative flex flex-col justify-between p-3 col-span-1 md:col-span-2 shadow-sm">
                <div className="absolute top-3 left-3 bg-[#1A1A1A]/90 py-1 px-2.5 rounded-lg border border-white/10 text-[10px] font-mono tracking-wider z-2 flex items-center gap-2 text-white">
                  <Edit3 className="w-3.5 h-3.5 text-[#C9A84C] animate-bounce" /> Collaborative Board Canvas
                </div>
                
                <div className="absolute top-3 right-3 bg-[#1A1A1A]/90 py-1 px-1.5 rounded-lg border border-white/10 text-[10px] z-2 flex items-center gap-1">
                  <button 
                    onClick={() => setBoardTool("pencil")} 
                    className={`p-1 rounded ${boardTool === "pencil" ? "bg-[#C9A84C] text-[#1A1A1A] font-bold" : "text-white/60"} hover:text-[#C9A84C] cursor-pointer`}
                  >
                    Brush
                  </button>
                  <button 
                    onClick={() => setBoardTool("eraser")} 
                    className={`p-1 rounded ${boardTool === "eraser" ? "bg-[#C9A84C] text-[#1A1A1A] font-bold" : "text-white/60"} hover:text-[#C9A84C] cursor-pointer`}
                  >
                    Eraser
                  </button>
                  <button 
                    onClick={triggerGlobalCanvasClear} 
                    className="p-1 rounded text-red-400 hover:bg-red-500/25 ml-1 cursor-pointer"
                    title="Clear Board"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={drawProgress}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  className="absolute inset-0 w-full h-full cursor-crosshair z-1"
                  width={600}
                  height={340}
                />
              </div>
            )}

            {/* Other peers grids placeholders */}
            {participants.filter(p => p.socketId !== socketRef.current?.id).map((p, idx) => (
              <div key={idx} className="aspect-video bg-[#1A1A1A] border border-[#1A1A1A]/20 rounded-2xl overflow-hidden relative flex flex-col justify-between p-4 group shadow-sm">
                <div className="absolute inset-0 bg-[#1A1A1A] flex flex-col items-center justify-center text-center">
                  {(p.camActive || p.screenSharing) && remoteStreams[p.socketId] ? (
                    <video
                      ref={(el) => {
                        if (el && el.srcObject !== remoteStreams[p.socketId]) {
                          el.srcObject = remoteStreams[p.socketId];
                        }
                      }}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4">
                      <img 
                        src={p.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(p.name)}`} 
                        alt="Attendee" 
                        className="w-14 h-14 rounded-full border-2 border-white/10 mb-2 bg-[#1A1A1A]"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-xs font-bold text-white/85">{p.name}</span>
                    </div>
                  )}
                </div>
                
                <div className="absolute top-4 left-4 bg-[#1A1A1A]/80 backdrop-blur-sm px-3 py-1 rounded-xl text-xs font-bold border border-white/10 z-10 flex items-center gap-1.5 text-white">
                  {p.name}
                </div>

                <div className="absolute bottom-4 right-4 flex gap-1.5 z-10">
                  <span className="p-1.5 bg-[#1A1A1A]/85 border border-white/10 rounded-lg text-white/55">
                    {p.micActive ? <Mic className="w-3.5 h-3.5 text-[#C9A84C]" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  </span>
                  <span className="p-1.5 bg-[#1A1A1A]/85 border border-white/10 rounded-lg text-white/55">
                    {p.camActive ? <Video className="w-3.5 h-3.5 text-[#C9A84C]" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                  </span>
                  <span className="p-1.5 bg-[#1A1A1A]/85 border border-white/10 rounded-lg text-white/55">
                    {p.screenSharing ? <Monitor className="w-3.5 h-3.5 text-amber-400" /> : <Monitor className="w-3.5 h-3.5 opacity-20" />}
                  </span>
                </div>
              </div>
            ))}

            {participants.length <= 1 && (
              <div className="aspect-video bg-[#F0EFE8] border border-dashed border-[#1A1A1A]/15 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-[#1A1A1A]/55">
                <AudioLines className="w-10 h-10 text-[#C9A84C] opacity-60 mb-2 animate-pulse" />
                <p className="text-xs font-bold max-w-xs leading-normal">
                  No other active connections here yet. Invite friends by sharing the room code!
                </p>
              </div>
            )}
          </div>

          {/* Subtitles caption bar */}
          <div className="bg-white border border-[#1A1A1A]/10 mt-4 p-3.5 rounded-2xl flex items-center gap-3 text-xs shadow-sm relative z-1">
            <div className="bg-[#C9A84C]/12 border border-[#C9A84C]/25 text-[#8B6914] px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider leading-none">
              SPEECH CAPTION
            </div>
            <p className="text-[#1A1A1A]/70 font-semibold italic select-none">
              {captionsFeed}
            </p>
          </div>
        </div>

        {/* Navigation / Side Panels: Chat, Polls, AI assistants */}
        <AnimatePresence>
          {chatActive && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-[#F0EFE8] border-l border-[#1A1A1A]/8 flex flex-col justify-between select-none shrink-0"
            >
              <div className="p-4 border-b border-[#1A1A1A]/8 flex justify-between items-center bg-[#FAFAF8]/50">
                <h3 className="text-sm font-heading font-bold text-[#1A1A1A] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#C9A84C]" /> Group Discussion
                </h3>
                <button onClick={() => setChatActive(false)} className="text-[#1A1A1A]/40 hover:text-[#1A1A1A]/80 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Chat lines logs */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[70vh]">
                {chats.map((chat, index) => (
                  <div key={index} className="flex gap-2.5 items-start">
                    <img 
                      src={chat.senderAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(chat.senderName)}`} 
                      alt="avatar" 
                      className="w-7 h-7 rounded-lg border border-[#1A1A1A]/10 mt-0.5 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-0.5 max-w-[80%]">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-[#1A1A1A]/85">{chat.senderName}</span>
                        <span className="text-[9px] font-mono text-[#1A1A1A]/40">
                          {new Date(chat.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-[#1A1A1A]/6 text-xs text-[#1A1A1A]/80 leading-normal font-sans shadow-sm">
                        {chat.message}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#1A1A1A]/8 flex gap-2 bg-[#FAFAF8]/50">
                <input
                  type="text"
                  placeholder="Input text logs..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="bg-white border border-[#1A1A1A]/10 rounded-lg px-3 py-2 text-xs flex-1 focus:outline-none focus:border-[#C9A84C] text-[#1A1A1A]"
                />
                <button type="submit" className="bg-[#1A1A1A] hover:bg-[#C9A84C] text-white hover:text-[#1A1A1A] p-2 rounded-lg shrink-0 font-bold transition-all cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}

          {pollsActive && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-[#F0EFE8] border-l border-[#1A1A1A]/8 flex flex-col select-none shrink-0"
            >
              <div className="p-4 border-b border-[#1A1A1A]/8 flex justify-between items-center bg-[#FAFAF8]/50">
                <h3 className="text-sm font-heading font-bold text-[#1A1A1A] flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#C9A84C]" /> Interactive Polls
                </h3>
                <button onClick={() => setPollsActive(false)} className="text-[#1A1A1A]/40 hover:text-[#1A1A1A]/80 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Launched polls lists & Vote forms */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Book a Poll form */}
                <form onSubmit={handleLaunchPoll} className="bg-white p-4 border border-[#1A1A1A]/8 rounded-2xl space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">Launch New Poll</h4>
                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[#1A1A1A]/60 font-bold">Question *</label>
                      <input
                        type="text"
                        placeholder="e.g. Which sprint timeline works?"
                        value={newPollQuestion}
                        onChange={(e) => setNewPollQuestion(e.target.value)}
                        required
                        className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/10 rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[#1A1A1A]/60 font-bold">Choices *</label>
                      {newPollOptions.map((opt, idx) => (
                        <input
                           key={idx}
                           type="text"
                           placeholder={`Choice Option ${idx + 1}`}
                           value={opt}
                           onChange={(e) => {
                             const updated = [...newPollOptions];
                             updated[idx] = e.target.value;
                             setNewPollOptions(updated);
                           }}
                           required={idx < 2}
                           className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C9A84C] text-xs text-[#1A1A1A]"
                        />
                      ))}
                      <button
                        type="button"
                        onClick={addPollOptionInput}
                        className="text-[10px] text-[#C9A84C] font-bold hover:underline cursor-pointer"
                      >
                        + Add Choice Option
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-[#1A1A1A] hover:bg-[#C9A84C] text-white hover:text-[#1A1A1A] font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer">
                    Publish Live Poll
                  </button>
                </form>

                {/* Poll Results dashboards visualizers */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Active Results Log</h4>
                  {polls.length === 0 ? (
                    <p className="text-xs text-[#1A1A1A]/45 text-center py-6">No custom polls created.</p>
                  ) : (
                    polls.map((poll) => {
                      const total = computeTotalsVotes(poll.options);
                      return (
                        <div key={poll.id} className="p-4 bg-white border border-[#1A1A1A]/8 rounded-2xl space-y-3 shadow-sm">
                          <h5 className="text-xs font-bold text-[#1A1A1A]">{poll.question}</h5>
                          <div className="space-y-2.5">
                            {poll.options.map((opt, optIdx) => {
                              const percentage = total > 0 ? Math.round((opt.votes.length / total) * 100) : 0;
                              return (
                                <div key={optIdx} className="space-y-1.5 text-xs">
                                  <div className="flex justify-between text-[11px] text-[#1A1A1A]/80 font-bold">
                                    <span>{opt.optionText}</span>
                                    <span className="font-mono text-[10px] font-bold text-[#8B6914]">{opt.votes.length} ({percentage}%)</span>
                                  </div>
                                  <div className="w-full bg-[#F0EFE8] h-2.5 rounded-full overflow-hidden relative border border-[#1A1A1A]/8 flex shadow-inner">
                                    <button
                                      onClick={() => castPollVote(poll.id, optIdx)}
                                      className="absolute inset-0 w-full hover:bg-[#1A1A1A]/5 transition-colors cursor-pointer text-left focus:outline-none"
                                      title="Cast Vote"
                                    />
                                    <div className="bg-[#C9A84C] h-full rounded-full transition-all duration-300" style={{ width: `${percentage}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-[#1A1A1A]/40 text-right font-mono">Total cast votes: {total}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {aiPanelActive && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-[#F0EFE8] border-l border-[#1A1A1A]/8 flex flex-col justify-between select-none shrink-0 max-h-screen"
            >
              <div className="p-4 border-b border-[#1A1A1A]/8 flex justify-between items-center bg-[#FAFAF8]/50">
                <h3 className="text-sm font-heading font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-[#C9A84C]" /> Gemini Meeting Assistant
                </h3>
                <button onClick={() => setAiPanelActive(false)} className="text-[#1A1A1A]/40 hover:text-[#1A1A1A]/80 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* AI summarizing workspace templates */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[80vh]">
                <div className="bg-[#C9A84C]/8 border border-[#C9A84C]/25 p-4 rounded-2xl space-y-2 text-xs shadow-sm">
                  <h4 className="font-bold text-[#8B6914] flex items-center gap-1.5">🤖 Smart AI Companion Controls</h4>
                  <p className="text-[#1A1A1A]/60 leading-relaxed font-sans">
                    Generates polished summaries, actionable item lists, and speaker summaries instantly using Gemini technology. To run summaries, type customized session details below.
                  </p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-[#1A1A1A]/60">Spoken Notes / Staging Agenda</label>
                  <textarea
                    placeholder="We agreed on structural layout changes, and scheduled the beta launch for next Monday."
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-white border border-[#1A1A1A]/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#C9A84C] text-[#1A1A1A]"
                  />
                </div>

                <button
                  onClick={triggerGeminiSummary}
                  disabled={aiLoading}
                  className="w-full bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> {aiLoading ? "Gemini crunching..." : "Generate Call Summary"}
                </button>

                {notesSummary && (
                  <div className="mt-4 p-4 bg-white border border-[#1A1A1A]/8 rounded-2xl space-y-3 relative shadow-sm">
                    <div className="flex justify-between items-center border-b border-[#1A1A1A]/8 pb-2">
                      <span className="text-[10px] font-bold text-[#8B6914] uppercase tracking-widest block">Summary Output</span>
                      <button 
                        onClick={() => {
                          const blob = new Blob([notesSummary], { type: "text/markdown" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `MeetSphere-AI-Summary-${roomCode}.md`;
                          a.click();
                        }}
                        className="text-[#1A1A1A]/40 hover:text-[#1A1A1A]/80 p-1 cursor-pointer"
                        title="Download Markdown summary"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Render neat markdown simulator text */}
                    <p className="text-xs text-[#1A1A1A]/70 leading-relaxed font-sans whitespace-pre-wrap select-text">
                      {notesSummary}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[#1A1A1A]/8 text-center bg-[#FAFAF8]/50">
                <span className="text-[10px] font-mono text-[#1A1A1A]/40">Gemini model output integration.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main control action docks bar */}
      <footer className="bg-glass border-glass mx-6 my-4 px-6 py-3.5 rounded-2xl flex justify-between items-center z-10 select-none backdrop-blur-md shadow-lg">
        
        {/* Toggle camera states controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-xl border transition-all duration-200 shadow-md cursor-pointer ${micActive ? "bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-[#C9A84C] border-[#1A1A1A]/20" : "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"}`}
            title={micActive ? "Mic is active" : "Mic is muted"}
          >
            {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          
          <button
            onClick={toggleCam}
            className={`p-3 rounded-xl border transition-all duration-200 shadow-md cursor-pointer ${camActive ? "bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-[#C9A84C] border-[#1A1A1A]/20" : "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"}`}
            title={camActive ? "Video camera is active" : "Video camera description is muted"}
          >
            {camActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleScreen}
            className={`p-3 rounded-xl border transition-all duration-200 shadow-md cursor-pointer ${screenSharing ? "bg-[#C9A84C] hover:bg-[#B8963C] text-[#1A1A1A] border-transparent font-bold" : "bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white/80 border-[#1A1A1A]/20"}`}
            title="Screen share projection controls"
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsWhiteboardActive(!isWhiteboardActive)}
            className={`p-3 rounded-xl border transition-all duration-200 shadow-md cursor-pointer ${isWhiteboardActive ? "bg-[#C9A84C] hover:bg-[#B8963C] text-[#1A1A1A] border-transparent font-bold" : "bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white/80 border-[#1A1A1A]/20"}`}
            title="Interactive Whiteboard sketch drawer"
          >
            <Edit3 className="w-5 h-5" />
          </button>
        </div>

        {/* Reaction triggers panel details */}
        <div className="hidden md:flex items-center gap-2.5 bg-[#1A1A1A] px-4 py-2.5 rounded-2xl border border-[#1A1A1A]/10 shadow-inner backdrop-blur-md">
          <Smile className="w-4 h-4 text-white/40 mr-1 shrink-0" />
          <button onClick={() => triggerReaction("thumbsup")} className="text-xl hover:scale-125 transition-transform cursor-pointer" title="Thumbsup">👍</button>
          <button onClick={() => triggerReaction("clap")} className="text-xl hover:scale-125 transition-transform cursor-pointer" title="Parade Claps">👏</button>
          <button onClick={() => triggerReaction("heart")} className="text-xl hover:scale-125 transition-transform cursor-pointer" title="Symmetric hearts">💖</button>
          <button onClick={() => triggerReaction("laugh")} className="text-xl hover:scale-125 transition-transform cursor-pointer" title="Joy laugh">😂</button>
          <button onClick={() => triggerReaction("fire")} className="text-xl hover:scale-125 transition-transform cursor-pointer" title="Fire sparkles">🔥</button>
        </div>

        {/* Floating panel toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRecordingAction}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${isRecording ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100" : "bg-[#1A1A1A] text-white/80 border-[#1A1A1A]/20 hover:text-white"}`}
          >
            {isRecording ? <Square className="w-3.5 h-3.5 fill-red-500 animate-pulse" /> : <Play className="w-3.5 h-3.5 text-[#C9A84C] fill-[#C9A84C]" />} Record
          </button>

          <button
            onClick={() => {
              setChatActive(!chatActive);
              setPollsActive(false);
              setAiPanelActive(false);
            }}
            className={`p-3 rounded-xl border transition-colors duration-200 cursor-pointer ${chatActive ? "bg-[#C9A84C] text-[#1A1A1A] border-transparent font-bold" : "bg-[#1A1A1A] text-white/80 border-[#1A1A1A]/20 hover:text-white"}`}
            title="Meeting Room Chat Logs"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setPollsActive(!pollsActive);
              setChatActive(false);
              setAiPanelActive(false);
            }}
            className={`p-3 rounded-xl border transition-colors duration-200 cursor-pointer ${pollsActive ? "bg-[#C9A84C] text-[#1A1A1A] border-transparent font-bold" : "bg-[#1A1A1A] text-white/80 border-[#1A1A1A]/20 hover:text-white"}`}
            title="Meeting Room Polls voting panel"
          >
            <BarChart2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setAiPanelActive(!aiPanelActive);
              setChatActive(false);
              setPollsActive(false);
            }}
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${aiPanelActive ? "bg-[#C9A84C] text-[#1A1A1A] border-transparent shadow-lg shadow-[#C9A84C]/15" : "bg-[#1A1A1A] text-white/80 border-[#1A1A1A]/20 hover:bg-[#1A1A1A]/90 hover:text-[#C9A84C]"}`}
          >
            <Sparkles className="w-4.5 h-4.5" /> AI Assist
          </button>
        </div>

      </footer>
    </div>
  );
}
