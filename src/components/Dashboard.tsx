import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, Plus, Keyboard, Calendar, History, ArrowRight, Video, FileText, AlertCircle, Copy, Check, Lock, Play, Database, Server, X, Info, MessageSquare, BarChart2, Users, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MeetingDetails } from "../types";

interface DashboardProps {
  onJoinMeeting: (code: string) => void;
  onNavigate: (view: "landing" | "login" | "register" | "dashboard") => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export default function Dashboard({ onJoinMeeting, onNavigate, isDarkMode, onToggleTheme }: DashboardProps) {
  const { user, token, logoutUser } = useAuth();
  const [meetingCode, setMeetingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scheduling state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [password, setPassword] = useState("");
  const [minDateTime, setMinDateTime] = useState("");

  const [meetingsList, setMeetingsList] = useState<MeetingDetails[]>([]);
  const [dashboardTab, setDashboardTab] = useState<"schedules" | "recordings" | "videos">("schedules");
  const [selectedRecord, setSelectedRecord] = useState<MeetingDetails | null>(null);
  const [modalTab, setModalTab] = useState<"overview" | "chat" | "polls">("overview");
  const [selectedVideo, setSelectedVideo] = useState<MeetingDetails | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();

    // Calculate local min date-time: YYYY-MM-DDTHH:mm
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setMinDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);

    // Poll for new schedules every 5 seconds to automatically sync active schedules in real-time
    const interval = setInterval(() => {
      fetchSchedules();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let activeObjectURL: string | null = null;

    if (selectedVideo && selectedVideo.recordingUrl) {
      const request = indexedDB.open("MeetSphereRecordings", 1);
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains("videos")) {
          const tx = db.transaction("videos", "readonly");
          const store = tx.objectStore("videos");
          const getReq = store.get(selectedVideo.recordingUrl);
          getReq.onsuccess = () => {
            if (getReq.result) {
              const url = URL.createObjectURL(getReq.result);
              activeObjectURL = url;
              setVideoSrc(url);
            } else {
              setVideoSrc("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
            }
          };
          getReq.onerror = () => {
            setVideoSrc("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
          };
        } else {
          setVideoSrc("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
        }
      };
      request.onerror = () => {
        setVideoSrc("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
      };
    } else {
      setVideoSrc("");
    }

    return () => {
      if (activeObjectURL) {
        URL.revokeObjectURL(activeObjectURL);
      }
    };
  }, [selectedVideo]);

  const fetchSchedules = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/meetings/my-meetings", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMeetingsList(data.meetings);
      }
    } catch (err) {
      console.error("Failed to load meetings list.");
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);

    const cleanTitle = title.trim();
    if (cleanTitle && /[^a-zA-Z0-9\s-_]/.test(cleanTitle)) {
      setError("Meeting name must only contain alphanumeric characters, spaces, hyphens, or underscores.");
      setLoading(false);
      return;
    }

    if (isScheduled && scheduleTime) {
      const yearPart = scheduleTime.split("-")[0];
      if (yearPart.length !== 4) {
        setError("Schedule year must be exactly 4 digits.");
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/meetings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title || "Dynamic MeetSphere Group",
          description,
          isScheduled,
          scheduledStartTime: isScheduled ? scheduleTime : undefined,
          password: password || undefined
        })
      });

      const data = await res.json();
      if (data.success && data.meeting) {
        if (!isScheduled) {
          // Direct entrance inside the immediate call room
          onJoinMeeting(data.meeting.meetingCode);
        } else {
          // Add to schedules list and reset forms
          await fetchSchedules();
          setTitle("");
          setDescription("");
          setIsScheduled(false);
          setScheduleTime("");
          setPassword("");
          alert(`Successfully scheduled meeting! Share code: ${data.meeting.meetingCode}`);
        }
      } else {
        setError(data.message || "Failed to organize meeting room.");
      }
    } catch (err) {
      setError("Network fault connecting to meet servers.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanCode = meetingCode.trim().toLowerCase();
    
    // Extract code if user pasted a full URL
    if (cleanCode.includes("/room/")) {
      cleanCode = cleanCode.substring(cleanCode.lastIndexOf("/room/") + 6);
    } else if (cleanCode.includes("/")) {
      cleanCode = cleanCode.substring(cleanCode.lastIndexOf("/") + 1);
    }
    // Sanitize any potential query strings or unwanted characters
    cleanCode = cleanCode.split("?")[0].replace(/[^a-z0-9-]/g, "");

    if (!cleanCode) return;

    onJoinMeeting(cleanCode);
  };



  const executeCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#C9A84C]/20 selection:text-[#1A1A1A]">
      
      {/* Platform Dashboard Top Navigation bar */}
      <header className="border-b border-[#1A1A1A]/8 bg-[#FAFAF8]/90 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#1A1A1A] p-2 rounded-xl text-[#C9A84C] shadow-sm">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold tracking-tight text-lg text-[#1A1A1A]">Conference Panel</h1>
            <p className="text-xs text-[#1A1A1A]/45">Welcome back, {user?.name || "Member"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="p-2.5 rounded-xl border border-[#1A1A1A]/10 bg-[#F0EFE8] hover:bg-[#E8E6DC] text-[#1A1A1A] hover:text-[#C9A84C] transition-all cursor-pointer shadow-sm"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
          <div className="flex items-center gap-3 bg-[#F0EFE8] border border-[#1A1A1A]/8 px-3.5 py-1.5 rounded-xl">
            <img 
              src={user?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user?.name || "avatar")}`} 
              alt="Profile Avatar" 
              className="w-7 h-7 rounded-lg border border-[#1A1A1A]/10"
              referrerPolicy="no-referrer"
            />
            <span className="text-sm font-semibold select-none text-[#1A1A1A]/80">{user?.name}</span>
          </div>

          <button
            onClick={() => {
              logoutUser();
              onNavigate("landing");
            }}
            className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-200 px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all active:scale-95 duration-200"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        <div className="absolute top-[10%] left-[-10%] w-96 h-96 rounded-full bg-[#C9A84C]/5 blur-[120px] animate-float-slow pointer-events-none -z-10"></div>
        <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#C9A84C]/3 blur-[150px] animate-float-medium pointer-events-none -z-10"></div>
        


        {/* Error Bar */}
        {error && (
          <div className="lg:col-span-3 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" /> {error}
          </div>
        )}

        {/* Column 1 & 2: Main control forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Code Join Component */}
          <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 relative overflow-hidden shadow-sm hover:shadow-md hover:border-[#C9A84C]/25 transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9A84C]/4 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-3 mb-4">
              <Keyboard className="w-5 h-5 text-[#C9A84C]" />
              <h2 className="text-sm font-heading font-bold text-[#1A1A1A]">Join with Call Code</h2>
            </div>
            <form onSubmit={handleJoinByCodeSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter 10-char room link code (e.g., abc-defg-hij)"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                required
                className="bg-[#F0EFE8] border border-[#1A1A1A]/10 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] focus:outline-none px-4 py-3.5 rounded-xl text-sm flex-1 font-mono tracking-wider focus:ring-2 focus:ring-[#C9A84C]/20 text-[#1A1A1A]"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white px-6 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 hover:shadow-[0_4px_20px_rgba(201,168,76,0.30)] transition-all duration-200 cursor-pointer w-full sm:w-auto relative z-10"
              >
                {loading ? "Connecting..." : "Join Call"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* New / Schedule Meetings Setup form */}
          <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-[#C9A84C]/25 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <Plus className="w-5 h-5 text-[#C9A84C]" />
              <h2 className="text-sm font-heading font-bold text-[#1A1A1A]">Organize New Video Meeting</h2>
            </div>
            
            <form onSubmit={handleCreateMeeting} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 font-sans">
                  <label className="font-bold text-[#1A1A1A]/55">Meeting Name *</label>
                  <input
                    type="text"
                    placeholder="Weekly Sync Up / Sales Pitch etc."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/10 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 text-[#1A1A1A] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-[#1A1A1A]/55 text-xs flex items-center gap-1">
                    Lobby Password Protection <span className="text-[#C9A84C] font-bold">* (Compulsory)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Provide entering passcode (Compulsory)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-[#F0EFE8] border border-[#C9A84C]/30 hover:border-[#C9A84C]/50 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 text-[#1A1A1A] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#1A1A1A]/55 text-xs">Purpose / Description</label>
                <textarea
                  placeholder="Tell your attendees what this meeting is about..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/10 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 text-[#1A1A1A] transition-all"
                />
              </div>

              <div className="pt-2.5 border-t border-[#1A1A1A]/8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <label className="flex items-center gap-2.5 cursor-pointer text-[#1A1A1A]/65 font-bold select-none text-xs">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="accent-[#C9A84C] cursor-pointer h-4 w-4"
                  />
                  Schedule session for later
                </label>
                
                {isScheduled && (
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    required
                    min={minDateTime}
                    max="9999-12-31T23:59"
                    className="bg-[#F0EFE8] border border-[#1A1A1A]/10 hover:border-[#1A1A1A]/20 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#C9A84C] text-[#1A1A1A] transition-all font-mono"
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-98 hover:shadow-[0_4px_20px_rgba(201,168,76,0.30)] cursor-pointer"
              >
                {isScheduled ? (
                  <><Calendar className="w-4 h-4" /> Book Scheduled Meeting</>
                ) : (
                  <><Video className="w-4 h-4" /> Initialize Instant Session</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Column 3: Schedules & Activity log panel */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            {/* Tab Toggles */}
            <div className="flex mb-4 p-1 bg-[#F0EFE8] border border-[#1A1A1A]/8 rounded-2xl">
              <button
                onClick={() => setDashboardTab("schedules")}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  dashboardTab === "schedules" 
                    ? "bg-white text-[#C9A84C] border border-[#C9A84C]/30 shadow-sm" 
                    : "text-[#1A1A1A]/45 hover:text-[#1A1A1A]/70"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Schedules
              </button>
              <button
                onClick={() => setDashboardTab("recordings")}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  dashboardTab === "recordings" 
                    ? "bg-white text-[#C9A84C] border border-[#C9A84C]/30 shadow-sm" 
                    : "text-[#1A1A1A]/45 hover:text-[#1A1A1A]/70"
                }`}
              >
                <Database className="w-3.5 h-3.5" /> Records
              </button>
              <button
                onClick={() => setDashboardTab("videos")}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  dashboardTab === "videos"
                    ? "bg-white text-[#C9A84C] border border-[#C9A84C]/30 shadow-sm" 
                    : "text-[#1A1A1A]/45 hover:text-[#1A1A1A]/70"
                }`}
              >
                <Video className="w-3.5 h-3.5" /> Videos
              </button>
            </div>

            {dashboardTab === "schedules" && (
              <div>
                <div className="flex items-center justify-between pb-3 mb-4">
                  <h3 className="text-xs font-bold text-[#1A1A1A]/50">
                    Active Schedules List (Auto-sync)
                  </h3>
                  <span className="text-[10px] bg-[#F0EFE8] px-2 py-0.5 rounded-full text-[#1A1A1A]/45 font-mono tracking-wider font-bold border border-[#1A1A1A]/8">
                    {meetingsList.filter(m => m.status === "scheduled" || m.status === "active" || m.status === "completed").length} LOGGED
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                  {meetingsList.filter(m => m.status === "scheduled" || m.status === "active" || m.status === "completed").length === 0 ? (
                    <div className="text-center py-12 text-[#1A1A1A]/30 flex flex-col items-center gap-2 mt-4">
                      <Calendar className="w-8 h-8 opacity-25" />
                      <p className="text-xs">No active scheduled meetings.</p>
                      <p className="text-[10px] text-[#1A1A1A]/25 max-w-xs leading-normal">
                        Schedules will show up here as soon as you or any other user creates a new meeting.
                      </p>
                    </div>
                  ) : (
                    meetingsList
                      .filter(m => m.status === "scheduled" || m.status === "active" || m.status === "completed")
                      .map((mtg, idx) => (
                        <div 
                          key={idx} 
                          className="p-3.5 bg-[#F0EFE8] hover:bg-[#E8E6DC] border border-[#1A1A1A]/8 hover:border-[#C9A84C]/30 rounded-2xl transition-all duration-200 group shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 max-w-[80%]">
                              <h4 className="text-xs font-bold text-[#1A1A1A] group-hover:text-[#8B6914] transition-colors line-clamp-1">
                                {mtg.title}
                              </h4>
                              {mtg.status === "completed" && (
                                <span className="shrink-0 text-[8px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded font-mono font-bold uppercase leading-none">Concluded</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {mtg.password && (
                                <Lock className="w-3 h-3 text-[#C9A84C]/70" title="Password Protected" />
                              )}
                              <button
                                onClick={() => executeCopy(mtg.meetingCode)}
                                className="text-[#1A1A1A]/30 hover:text-[#C9A84C] p-1 rounded hover:bg-[#C9A84C]/10 transition-colors"
                                title="Copy meeting code"
                              >
                                {copiedCode === mtg.meetingCode ? (
                                  <Check className="w-3.5 h-3.5 text-[#C9A84C]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          {mtg.description && (
                            <p className="text-[10px] text-[#1A1A1A]/45 line-clamp-1 mt-1 leading-normal">{mtg.description}</p>
                          )}
                          <div className="flex items-center justify-between text-[10px] mt-3 pt-2.5 border-t border-[#1A1A1A]/8 font-mono text-[#1A1A1A]/40">
                            <span>Code: <span className="text-[#8B6914] select-all font-bold">{mtg.meetingCode}</span></span>
                            {mtg.scheduledStartTime && (
                              <span className="text-[#1A1A1A]/50 font-semibold">
                                {new Date(mtg.scheduledStartTime).toLocaleString(undefined, {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => onJoinMeeting(mtg.meetingCode)}
                            className="w-full mt-3 bg-[#1A1A1A]/5 hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-[#1A1A1A]/60 text-xs py-1.5 rounded font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            Enter Call <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {dashboardTab === "recordings" && (
              <div>
                 <div className="flex items-center justify-between pb-3 mb-2">
                  <h3 className="text-xs font-bold text-[#1A1A1A]/50">Past Meetings & Recordings</h3>
                  <span className="text-[10px] bg-[#F0EFE8] px-2 py-0.5 rounded-full text-[#1A1A1A]/45 font-mono font-bold border border-[#1A1A1A]/8">
                    {meetingsList.filter(m => m.status === "completed" || m.recordingUrl).length} RECORDS
                  </span>
                </div>

                <div className="mb-4 p-3 bg-[#C9A84C]/6 border border-[#C9A84C]/20 rounded-xl space-y-1">
                  <p className="text-[10px] text-[#8B6914] font-bold flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" /> Stored in Account Database
                  </p>
                  <p className="text-[9px] text-[#1A1A1A]/50 leading-relaxed font-sans">
                    All session transcripts, video recording references, attendance rosters, and whiteboard strokes are saved directly under your account on the MongoDB database server.
                  </p>
                </div>

                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                  {meetingsList.filter(m => m.status === "completed" || m.recordingUrl).length === 0 ? (
                    <div className="text-center py-12 text-[#1A1A1A]/30 flex flex-col items-center gap-2 mt-4">
                      <Database className="w-8 h-8 opacity-25" />
                      <p className="text-xs">No records or recordings found.</p>
                      <p className="text-[10px] text-[#1A1A1A]/25 max-w-[200px] leading-normal">
                        Once a meeting finishes or recording is toggled during a session, its transcripts and videos appear here.
                      </p>
                    </div>
                  ) : (
                    meetingsList
                      .filter(m => m.status === "completed" || m.recordingUrl)
                      .map((mtg, idx) => (
                        <div 
                          key={idx} 
                          className="p-3.5 bg-[#F0EFE8] border border-[#1A1A1A]/8 rounded-xl space-y-2.5 hover:border-[#C9A84C]/30 transition-all duration-200"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-[#1A1A1A]/8 pb-2">
                            <div>
                              <h4 className="text-xs font-bold text-[#1A1A1A] line-clamp-1">{mtg.title}</h4>
                              <p className="text-[9px] text-[#1A1A1A]/40 font-mono">{mtg.meetingCode}</p>
                            </div>
                            <span className="text-[9px] text-[#8B6914] bg-[#C9A84C]/10 px-2 py-0.5 rounded font-mono font-semibold">
                              {mtg.status === "completed" ? "Ended" : "Recorded"}
                            </span>
                          </div>

                          <div className="space-y-1 text-[10px] text-[#1A1A1A]/50">
                            {mtg.recordingUrl && (
                              <p className="flex items-center gap-1.5 text-[#8B6914] font-medium">
                                <Video className="w-3.5 h-3.5 shrink-0" /> video-recording: 
                                <span className="font-mono text-[9px] bg-[#1A1A1A]/5 px-1 py-0.5 rounded font-bold border border-[#1A1A1A]/8 cursor-pointer hover:bg-[#1A1A1A]/10" onClick={() => {
                                  alert(`Recording reference code is: ${mtg.recordingUrl}\nStored physically in: MongoDB Database Server (Persistent Object Store)`);
                                }}>{mtg.recordingUrl}</span>
                              </p>
                            )}
                            <p className="flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 shrink-0 text-[#1A1A1A]/30" /> Attendees: <span className="font-bold text-[#1A1A1A]/70">{(mtg.attendance?.length) || 1} joined</span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 shrink-0 text-[#1A1A1A]/30" /> Chat Logs: <span className="font-bold text-[#1A1A1A]/70">{(mtg.chatHistory?.length) || 0} messages</span>
                            </p>
                          </div>

                          <div className="flex gap-2 pt-1">
                            {mtg.recordingUrl && (
                              <button
                                onClick={() => setSelectedVideo(mtg)}
                                className="flex-1 bg-[#C9A84C]/10 hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-[#8B6914] py-1 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" /> Play recording
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedRecord(mtg);
                                setModalTab("overview");
                              }}
                              className="flex-1 bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 text-[#1A1A1A]/60 py-1 rounded text-[10px] font-bold transition-all text-center cursor-pointer"
                            >
                              Explore Logs
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {dashboardTab === "videos" && (
              <div>
                <div className="flex items-center justify-between pb-3 mb-4">
                  <h3 className="text-xs font-bold text-[#1A1A1A]/50">Recorded Videos Database</h3>
                  <span className="text-[10px] bg-[#F0EFE8] px-2 py-0.5 rounded-full text-[#1A1A1A]/45 font-mono font-bold border border-[#1A1A1A]/8">
                    {meetingsList.filter(m => m.recordingUrl && m.recordingUrl !== "recording-active").length} VIDEOS
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                  {meetingsList.filter(m => m.recordingUrl && m.recordingUrl !== "recording-active").length === 0 ? (
                    <div className="text-center py-12 text-[#1A1A1A]/30 flex flex-col items-center gap-2 mt-4">
                      <Video className="w-8 h-8 opacity-25" />
                      <p className="text-xs">No recorded videos found.</p>
                      <p className="text-[10px] text-[#1A1A1A]/25 max-w-xs leading-normal">
                        To save a video, turn on "Record" inside a meeting room and conclude the meeting.
                      </p>
                    </div>
                  ) : (
                    meetingsList
                      .filter(m => m.recordingUrl && m.recordingUrl !== "recording-active")
                      .map((mtg, idx) => (
                        <div 
                          key={idx} 
                          className="p-3.5 bg-[#F0EFE8] border border-[#1A1A1A]/8 rounded-xl space-y-2.5 hover:border-[#C9A84C]/30 transition-all duration-200"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-[#1A1A1A]/8 pb-2">
                            <div>
                              <h4 className="text-xs font-bold text-[#1A1A1A] line-clamp-1">{mtg.title}</h4>
                              <p className="text-[9px] text-[#1A1A1A]/40 font-mono">{mtg.meetingCode}</p>
                            </div>
                            <span className="text-[9px] text-[#8B6914] bg-[#C9A84C]/10 px-2 py-0.5 rounded font-mono font-semibold">MP4 Format</span>
                          </div>

                          <div className="text-[10px] text-[#1A1A1A]/45 space-y-1">
                            <p className="font-mono text-[9px] truncate">Ref: {mtg.recordingUrl}</p>
                            <p>Date: {mtg.actualStartTime ? new Date(mtg.actualStartTime).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                          </div>

                          <button
                            onClick={() => setSelectedVideo(mtg)}
                            className="w-full bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" /> Play Recorded Video
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 p-3.5 bg-[#C9A84C]/6 rounded-xl border border-[#C9A84C]/20 space-y-1.5">
            <h4 className="text-xs font-bold text-[#8B6914] flex items-center gap-1.5">
              <Server className="w-4 h-4" /> Where are recordings & logs stored?
            </h4>
            <p className="text-[10px] text-[#1A1A1A]/50 leading-relaxed font-sans">
              Recorded stream references, live chats, collaborative whiteboard drawings, and attendees rosters are securely written directly to our **MongoDB Database Server** clusters. No extra accounts needed, records persist continuously!
            </p>
          </div>
        </div>

      </main>

      <footer className="py-6 border-t border-[#1A1A1A]/8 text-center bg-[#F0EFE8]">
        <p className="text-[10px] text-[#1A1A1A]/30 font-mono">
          MeetSphere Conference System. Staged Staging Environment.
        </p>
      </footer>
      {/* Recorded Video Player Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 bg-[#1A1A1A]/70 backdrop-blur-md flex items-center justify-center p-4 z-[60] overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-[#1A1A1A] border border-white/10 w-full max-w-3xl rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
            >
              <div className="bg-[#1A1A1A] px-6 py-4 flex justify-between items-center border-b border-white/8">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#C9A84C]" /> Recorded Session: {selectedVideo.title}
                  </h3>
                  <p className="text-[10px] text-white/40 font-mono mt-0.5">
                    Code: {selectedVideo.meetingCode} | Ref: {selectedVideo.recordingUrl}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="p-1.5 bg-white/5 hover:bg-white/15 border border-white/10 text-white/50 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-black aspect-video relative flex items-center justify-center">
                {videoSrc && (
                  <video key={videoSrc} src={videoSrc} controls autoPlay muted playsInline className="w-full h-full object-contain" />
                )}
              </div>
              <div className="bg-[#1A1A1A] px-6 py-4 border-t border-white/8 flex justify-between items-center text-xs">
                <span className="text-white/35 font-mono">Format: H.264 MP4 Stereo</span>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="bg-[#C9A84C] hover:bg-[#B8963C] text-[#1A1A1A] font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  Close Video Player
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meeting Record Details Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white border border-[#1A1A1A]/12 w-full max-w-4xl rounded-2xl shadow-[0_20px_60px_rgba(26,26,26,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-[#F0EFE8] px-6 py-4 flex justify-between items-center border-b border-[#1A1A1A]/8 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-[#C9A84C]/12 border border-[#C9A84C]/25 p-2 rounded-xl text-[#C9A84C]">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1A1A1A] tracking-tight">{selectedRecord.title}</h3>
                    <p className="text-[10px] text-[#1A1A1A]/45 font-mono">
                      Room Code: <span className="text-[#8B6914] font-semibold">{selectedRecord.meetingCode}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedRecord(null); setModalTab("overview"); }}
                  className="p-1.5 bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 border border-[#1A1A1A]/10 text-[#1A1A1A]/40 hover:text-[#1A1A1A] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Sub-Tabs */}
              <div className="bg-[#FAFAF8] px-6 py-2 flex gap-2 border-b border-[#1A1A1A]/8 shrink-0">
                <button
                  onClick={() => setModalTab("overview")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    modalTab === "overview"
                      ? "bg-white border-[#C9A84C]/30 text-[#8B6914]"
                      : "bg-transparent border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                  }`}
                >
                  <Info className="w-3.5 h-3.5 inline mr-1.5" />Overview & Roster
                </button>
                <button
                  onClick={() => setModalTab("chat")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    modalTab === "chat"
                      ? "bg-white border-[#C9A84C]/30 text-[#8B6914]"
                      : "bg-transparent border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />Chat Logs ({selectedRecord.chatHistory?.length || 0})
                </button>
                <button
                  onClick={() => setModalTab("polls")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    modalTab === "polls"
                      ? "bg-white border-[#C9A84C]/30 text-[#8B6914]"
                      : "bg-transparent border-transparent text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 inline mr-1.5" />Polls ({selectedRecord.polls?.length || 0})
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAFAF8]">
                {modalTab === "overview" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                      <div className="bg-white p-4 border border-[#1A1A1A]/8 rounded-xl space-y-3.5">
                        <h4 className="text-xs font-bold text-[#1A1A1A]/45 uppercase tracking-wider">Session Info</h4>
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="text-[#1A1A1A]/40 block">Host Name</span>
                            <span className="text-[#1A1A1A] font-semibold flex items-center gap-1.5 mt-0.5">
                              <img
                                src={typeof selectedRecord.host === "object" ? selectedRecord.host?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(selectedRecord.host?.name || "host")}` : `https://api.dicebear.com/7.x/adventurer/svg?seed=Host`}
                                className="w-5 h-5 rounded border border-[#1A1A1A]/10 bg-[#F0EFE8]"
                                alt="Host"
                                referrerPolicy="no-referrer"
                              />
                              {typeof selectedRecord.host === "object" ? selectedRecord.host?.name : "Organizer"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#1A1A1A]/40 block">Start Time</span>
                            <span className="text-[#1A1A1A] font-semibold font-mono">
                              {selectedRecord.actualStartTime 
                                ? new Date(selectedRecord.actualStartTime).toLocaleString() 
                                : selectedRecord.scheduledStartTime 
                                ? new Date(selectedRecord.scheduledStartTime).toLocaleString()
                                : "Instant Call Start"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#1A1A1A]/40 block">End Time / Status</span>
                            <span className={`font-semibold font-mono ${selectedRecord.status === "completed" ? "text-[#8B6914]" : "text-emerald-600"}`}>
                              {selectedRecord.status === "completed" 
                                ? (selectedRecord.actualEndTime ? new Date(selectedRecord.actualEndTime).toLocaleString() : "Concluded")
                                : "Active/Live Session"}
                            </span>
                          </div>
                          {selectedRecord.recordingUrl && (
                            <div>
                              <span className="text-[#1A1A1A]/40 block">Video Recording</span>
                              <button
                                onClick={() => setSelectedVideo(selectedRecord)}
                                className="mt-1.5 w-full bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" /> Play Recorded Feed
                              </button>
                            </div>
                          )}
                          <div>
                            <span className="text-[#1A1A1A]/40 block">Interactive Elements</span>
                            <div className="flex gap-2 mt-2">
                              <span className="bg-[#F0EFE8] border border-[#1A1A1A]/8 px-2.5 py-1 rounded text-[10px] text-[#1A1A1A]/55 font-mono">
                                {selectedRecord.whiteboardData?.length || 0} Strokes
                              </span>
                              <span className="bg-[#F0EFE8] border border-[#1A1A1A]/8 px-2.5 py-1 rounded text-[10px] text-[#1A1A1A]/55 font-mono">
                                {selectedRecord.polls?.length || 0} Polls
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                      <div className="bg-white p-4 border border-[#1A1A1A]/8 rounded-xl space-y-3.5 h-full flex flex-col">
                        <h4 className="text-xs font-bold text-[#1A1A1A]/45 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-[#C9A84C]" /> Attendance Roster ({(selectedRecord.attendance?.length) || 1} logged)
                        </h4>
                        <div className="flex-1 overflow-y-auto max-h-[250px] pr-1">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#1A1A1A]/8 text-[#1A1A1A]/40">
                                <th className="pb-2 font-semibold">Attendee</th>
                                <th className="pb-2 font-semibold">Joined At</th>
                                <th className="pb-2 font-semibold">Left At</th>
                                <th className="pb-2 font-semibold text-right">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(!selectedRecord.attendance || selectedRecord.attendance.length === 0) ? (
                                <tr><td colSpan={4} className="py-4 text-center text-[#1A1A1A]/30 italic">No direct attendee logs saved.</td></tr>
                              ) : (
                                selectedRecord.attendance.map((record, index) => {
                                  const joinTime = new Date(record.joinedAt);
                                  const leaveTime = record.leftAt ? new Date(record.leftAt) : null;
                                  let durationStr = "Active";
                                  if (leaveTime) {
                                    const diffMs = leaveTime.getTime() - joinTime.getTime();
                                    const mins = Math.floor(diffMs / 60000);
                                    const secs = Math.floor((diffMs % 60000) / 1000);
                                    durationStr = `${mins}m ${secs}s`;
                                  }
                                  return (
                                    <tr key={index} className="border-b border-[#1A1A1A]/6 text-[#1A1A1A]/70 hover:bg-[#F0EFE8] transition-colors">
                                      <td className="py-2.5 font-semibold text-[#1A1A1A]">{record.name}</td>
                                      <td className="py-2.5 font-mono text-[10px]">{joinTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                                      <td className="py-2.5 font-mono text-[10px]">
                                        {leaveTime 
                                          ? leaveTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                          : <span className="text-[#C9A84C] font-bold">Ongoing</span>}
                                      </td>
                                      <td className="py-2.5 text-right font-mono text-[10px] font-bold text-[#8B6914]">{durationStr}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === "chat" && (
                  <div className="bg-white p-4 border border-[#1A1A1A]/8 rounded-xl space-y-4 max-h-[450px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-[#1A1A1A]/45 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#C9A84C]" /> Chronological Discussion Feed
                    </h4>
                    {(!selectedRecord.chatHistory || selectedRecord.chatHistory.length === 0) ? (
                      <div className="text-center py-12 text-[#1A1A1A]/30 italic">No messages were exchanged in this meeting.</div>
                    ) : (
                      <div className="space-y-4">
                        {selectedRecord.chatHistory.map((chat, idx) => (
                          <div key={idx} className="flex gap-3 items-start text-xs">
                            <img
                              src={chat.senderAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(chat.senderName)}`}
                              alt="avatar"
                              className="w-8 h-8 rounded-lg border border-[#1A1A1A]/10 bg-[#F0EFE8] shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="space-y-1 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="font-bold text-[#1A1A1A]">{chat.senderName}</span>
                                <span className="text-[9px] font-mono text-[#1A1A1A]/35">{new Date(chat.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="bg-[#F0EFE8] border border-[#1A1A1A]/8 p-3 rounded-xl text-[#1A1A1A]/75 leading-relaxed font-sans inline-block max-w-2xl whitespace-pre-wrap select-text">
                                {chat.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {modalTab === "polls" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(!selectedRecord.polls || selectedRecord.polls.length === 0) ? (
                      <div className="md:col-span-2 text-center py-12 text-[#1A1A1A]/30 italic bg-white p-4 border border-[#1A1A1A]/8 rounded-xl">
                        No interactive polls were launched during this session.
                      </div>
                    ) : (
                      selectedRecord.polls.map((poll, pIdx) => {
                        const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.votes?.length || 0), 0);
                        return (
                          <div key={pIdx} className="bg-white p-4 border border-[#1A1A1A]/8 rounded-xl space-y-3.5">
                            <div className="flex justify-between items-start border-b border-[#1A1A1A]/8 pb-2">
                              <h4 className="text-xs font-bold text-[#1A1A1A] leading-normal line-clamp-2">Q: {poll.question}</h4>
                              <span className="text-[9px] bg-[#C9A84C]/10 text-[#8B6914] px-2 py-0.5 rounded font-mono font-semibold shrink-0 ml-2">{totalVotes} Votes</span>
                            </div>
                            <div className="space-y-3 text-xs">
                              {poll.options.map((opt, oIdx) => {
                                const votesCount = opt.votes?.length || 0;
                                const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                                return (
                                  <div key={oIdx} className="space-y-1">
                                    <div className="flex justify-between text-[#1A1A1A]/70 font-medium">
                                      <span>{opt.optionText}</span>
                                      <span className="font-mono text-[#1A1A1A]/50 font-bold">{votesCount} ({pct}%)</span>
                                    </div>
                                    <div className="w-full bg-[#F0EFE8] h-2 rounded-full overflow-hidden border border-[#1A1A1A]/8">
                                      <div className="bg-[#C9A84C] h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    {opt.votes && opt.votes.length > 0 && (
                                      <p className="text-[9px] text-[#1A1A1A]/35 truncate">Voters: {opt.votes.join(", ")}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-[#F0EFE8] px-6 py-4 border-t border-[#1A1A1A]/8 flex justify-end shrink-0">
                <button
                  onClick={() => { setSelectedRecord(null); setModalTab("overview"); }}
                  className="bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] text-white font-bold px-5 py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Close Log Viewer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
