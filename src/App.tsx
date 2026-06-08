import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import MeetingRoom from "./components/MeetingRoom";
import { Video, Shield, KeySquare, Loader2, ArrowRight, VideoOff, Smartphone, HelpCircle, Sun, Moon } from "lucide-react";
import { motion } from "motion/react";

function RootNavigator() {
  const { user, token, loading, loginUser, registerUser, googleOAuth } = useAuth();
  const [currentView, setCurrentView] = useState<"landing" | "login" | "register" | "dashboard" | "room">("landing");
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [joiningRoomCode, setJoiningRoomCode] = useState<string | null>(null);
  const [joinStep, setJoinStep] = useState(1);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.body.classList.contains("dark-mode");
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.body.classList.add("dark-mode");
      setIsDarkMode(true);
    } else {
      document.body.classList.remove("dark-mode");
      setIsDarkMode(false);
    }
  }, []);

  const handleToggleTheme = () => {
    const nextVal = !isDarkMode;
    setIsDarkMode(nextVal);
    if (nextVal) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    // Read room path if user accesses a direct URL
    const pathname = window.location.pathname;
    const match = pathname.match(/\/room\/([a-z0-9-]+)/i);
    if (match && match[1]) {
      const roomCode = match[1].toLowerCase();
      setActiveRoomCode(roomCode);
      setCurrentView("room");
    }
  }, []);

  // Authentication Fields
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleClientConfigured, setGoogleClientConfigured] = useState(true);

  useEffect(() => {
    if (currentView !== "login" && currentView !== "register") return;

    let isMounted = true;

    const initGoogleSignIn = async () => {
      try {
        const res = await fetch("/api/auth/google-client-id");
        const data = await res.json();
        const clientId = data.clientId;

        if (!clientId || clientId === "dummy") {
          if (isMounted) {
            setGoogleClientConfigured(false);
          }
          return;
        }

        if (isMounted) {
          setGoogleClientConfigured(true);
        }

        // Wait until window.google script is loaded
        const checkGoogleScript = setInterval(() => {
          if ((window as any).google?.accounts?.id) {
            clearInterval(checkGoogleScript);

            if (!isMounted) return;

            // Initialize Google Sign-In
            (window as any).google.accounts.id.initialize({
              client_id: clientId,
              callback: async (response: any) => {
                setAuthLoading(true);
                setAuthError(null);
                try {
                  const credential = response.credential;
                  // Decode base64 payload from JWT token
                  const payload = JSON.parse(atob(credential.split(".")[1]));
                  const { name, email, picture, sub } = payload;
                  
                  const oauthRes = await googleOAuth(name, email, picture, sub);
                  if (oauthRes.success) {
                    setCurrentView("dashboard");
                  } else {
                    setAuthError(oauthRes.error || "Google login registration rejected.");
                  }
                } catch (err) {
                  setAuthError("Failed to parse Google OAuth payload.");
                } finally {
                  setAuthLoading(false);
                }
              }
            });

            // Render Google Sign-In button
            const btnEl = document.getElementById("googleSignInButton");
            if (btnEl) {
              (window as any).google.accounts.id.renderButton(
                btnEl,
                { 
                  theme: "filled_blue", 
                  size: "large", 
                  width: btnEl.clientWidth || 300,
                  text: "signin_with",
                  shape: "pill"
                }
              );
            }
          }
        }, 100);

        return () => clearInterval(checkGoogleScript);
      } catch (err) {
        console.error("Error setting up Google Sign-In:", err);
      }
    };

    initGoogleSignIn();

    return () => {
      isMounted = false;
    };
  }, [currentView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-10 h-10 text-[#C9A84C] animate-spin mb-4" />
        <p className="text-sm font-mono text-[#1A1A1A]/40">Connecting MeetSphere Session Nodes...</p>
      </div>
    );
  }

  // Route security interceptor
  const navigateToView = (view: "landing" | "login" | "register" | "dashboard") => {
    setAuthError(null);
    setAuthName("");
    setAuthEmail("");
    setAuthPassword("");

    if ((view === "dashboard") && !token) {
      setCurrentView("login");
      return;
    }
    setCurrentView(view);
  };

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const res = await loginUser(authEmail, authPassword);
    setAuthLoading(false);

    if (res.success) {
      setCurrentView("dashboard");
    } else {
      setAuthError(res.error || "Authentication rejected.");
    }
  };

  const handleFormRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const res = await registerUser(authName, authEmail, authPassword);
    setAuthLoading(false);

    if (res.success) {
      setCurrentView("dashboard");
    } else {
      setAuthError(res.error || "Signup failed.");
    }
  };

  const handleGoogleOAuthMock = async () => {
    setAuthError(null);
    setAuthLoading(true);

    // Simulated Google OAuth response payload
    const names = ["Sarah Jenkins", "Marcus Chen", "Aisha Touray", "Alex Mercer"];
    const chosenName = names[Math.floor(Math.random() * names.length)];
    const chosenEmail = `${chosenName.toLowerCase().replace(" ", "")}@gmail.com`;
    const avatarSeed = encodeURIComponent(chosenName);

    const res = await googleOAuth(
      chosenName,
      chosenEmail,
      `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`
    );
    setAuthLoading(false);

    if (res.success) {
      setCurrentView("dashboard");
    } else {
      setAuthError(res.error || "Google Authentication failed.");
    }
  };

  const startJoinMeetingRoom = (code: string) => {
    const clean = code.toLowerCase();
    setJoiningRoomCode(clean);
    setJoinStep(1);

    setTimeout(() => {
      setJoinStep(2);
    }, 450);

    setTimeout(() => {
      setJoinStep(3);
    }, 900);

    setTimeout(() => {
      setActiveRoomCode(clean);
      setJoiningRoomCode(null);
      setCurrentView("room");
      window.history.pushState({}, "", `/room/${clean}`);
    }, 1350);
  };

  const exitMeetingRoom = () => {
    setActiveRoomCode(null);
    setCurrentView(token ? "dashboard" : "landing");
    if (window.location.pathname.startsWith("/room/")) {
      window.history.pushState({}, "", "/");
    }
  };

  // Auth Layout wrapper for Login / Register cards
  const renderAuthLayout = (isRegister: boolean) => {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex items-center justify-center p-6 relative font-sans overflow-hidden">
        {/* Toggle Theme Button in Top-Right */}
        <div className="absolute top-6 right-6 z-20">
          <button
            onClick={handleToggleTheme}
            className="p-2.5 rounded-xl border border-[#1A1A1A]/10 bg-white hover:bg-[#F0EFE8] text-[#1A1A1A] transition-all cursor-pointer shadow-sm"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>
        {/* Warm background orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-[#C9A84C]/6 blur-[100px] animate-float-slow pointer-events-none -z-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#C9A84C]/4 blur-[100px] animate-float-medium pointer-events-none -z-10"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(26,26,26,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,26,26,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] -z-10"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full bg-white border border-[#1A1A1A]/10 p-8 rounded-3xl shadow-[0_20px_60px_rgba(26,26,26,0.10)] space-y-6"
        >
          {/* Header */}
          <div className="text-center space-y-2 select-none">
            <div 
              onClick={() => navigateToView("landing")} 
              className="inline-flex bg-[#1A1A1A] p-2.5 rounded-2xl text-[#C9A84C] shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
            >
              <Video className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-heading font-extrabold text-[#1A1A1A] tracking-tight pt-1">
              {isRegister ? "Launch Your Identity" : "Access Your Space"}
            </h2>
            <p className="text-xs text-[#1A1A1A]/45">Secure credential authentication hub</p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl text-xs font-semibold leading-normal">
              {authError}
            </div>
          )}

          {/* Core Login/Register Forms */}
          <form onSubmit={isRegister ? handleFormRegister : handleFormLogin} className="space-y-4 text-xs">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="font-bold text-[#1A1A1A]/60">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Jenkins"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  required
                  className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/12 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 transition-all text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold text-[#1A1A1A]/60">Email Address *</label>
              <input
                type="email"
                placeholder="jenkins@meetsphere.io"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/12 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 transition-all text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[#1A1A1A]/60">Security Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                className="w-full bg-[#F0EFE8] border border-[#1A1A1A]/12 hover:border-[#1A1A1A]/20 focus:border-[#C9A84C] rounded-xl px-3.5 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#1A1A1A] hover:bg-[#C9A84C] hover:text-[#1A1A1A] disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-97 transition-all cursor-pointer shadow-sm hover:shadow-[0_4px_20px_rgba(201,168,76,0.30)]"
            >
              {authLoading ? "Synchronizing..." : isRegister ? "Create Credentials" : "Sign In Session"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Separator */}
          <div className="relative text-center py-2 select-none">
            <span className="bg-white px-3 text-[10px] uppercase font-bold text-[#1A1A1A]/30 z-10 relative">Or authenticate with</span>
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#1A1A1A]/10 -z-0"></div>
          </div>

          {!googleClientConfigured ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center space-y-2.5">
              <p className="text-[10px] leading-relaxed text-[#1A1A1A]/55">
                Google Client ID is set to <strong>"dummy"</strong> in <code>.env</code>. Please supply a real Google Client ID to enable OAuth login.
              </p>
              <button
                type="button"
                onClick={handleGoogleOAuthMock}
                className="w-full bg-[#C9A84C] hover:bg-[#B8963C] text-[#1A1A1A] font-bold py-2.5 rounded-full text-xs active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                Use Mock Google Login (Fallback)
              </button>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <div id="googleSignInButton" className="w-full flex justify-center min-h-[44px]"></div>
            </div>
          )}

          {/* Bottom link */}
          <div className="text-center text-[11px] text-[#1A1A1A]/45 pt-2 select-none">
            {isRegister ? (
              <span>Already have an account?{" "}
                <button 
                  onClick={() => navigateToView("login")} 
                  className="text-[#8B6914] font-bold hover:underline"
                >
                  Log In
                </button>
              </span>
            ) : (
              <span>New to client conferences?{" "}
                <button 
                  onClick={() => navigateToView("register")} 
                  className="text-[#8B6914] font-bold hover:underline"
                >
                  Sign Up Free
                </button>
              </span>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  // If currently pacing/joining, show dynamic security handshake progress screen
  if (joiningRoomCode) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex items-center justify-center p-6 relative font-sans overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-[#C9A84C]/7 blur-[120px] animate-float-slow pointer-events-none -z-10"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(26,26,26,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,26,26,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] -z-10"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-[#1A1A1A]/10 p-8 rounded-3xl shadow-[0_20px_60px_rgba(26,26,26,0.10)] space-y-6 text-center"
        >
          <div className="relative inline-flex">
            <div className="absolute inset-0 bg-[#C9A84C]/20 rounded-full blur-xl animate-pulse"></div>
            <div className="relative bg-[#1A1A1A] p-5 rounded-2xl text-[#C9A84C] shadow-lg animate-bounce">
              <Video className="w-8 h-8 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2 select-none">
            <h2 className="text-xl font-heading font-extrabold text-[#1A1A1A] tracking-tight">
              Joining Conference Call
            </h2>
            <div className="text-xs text-[#1A1A1A]/45 font-mono flex items-center justify-center gap-1.5">
              Room Link ID: <span className="text-[#8B6914] font-bold select-all bg-[#F0EFE8] px-2 py-0.5 rounded border border-[#1A1A1A]/10">{joiningRoomCode}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#F0EFE8] p-5 rounded-2xl border border-[#1A1A1A]/8 space-y-3">
              <div className="flex justify-between items-center text-[10px] text-[#1A1A1A]/40 font-mono font-bold uppercase tracking-wider">
                <span>Negotiation Progress</span>
                <span className="text-[#C9A84C] font-bold">
                  {joinStep === 1 ? "33%" : joinStep === 2 ? "66%" : "100%"}
                </span>
              </div>
              
              <div className="w-full bg-[#1A1A1A]/8 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#C9A84C] h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(201,168,76,0.4)]"
                  style={{ width: joinStep === 1 ? "33%" : joinStep === 2 ? "66%" : "100%" }}
                ></div>
              </div>

              <p className="text-xs text-[#1A1A1A]/60 font-mono h-4 flex items-center justify-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C9A84C] animate-ping"></span>
                {joinStep === 1 && "Securing entrance authentication gateway..."}
                {joinStep === 2 && "Synchronizing live signaling channels..."}
                {joinStep === 3 && "Configuring WebRTC call layout nodes..."}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // View state switch routers
  switch (currentView) {
    case "landing":
      return <LandingPage onNavigate={navigateToView} isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />;
    case "login":
      return renderAuthLayout(false);
    case "register":
      return renderAuthLayout(true);
    case "dashboard":
      return <Dashboard onJoinMeeting={startJoinMeetingRoom} onNavigate={navigateToView} isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />;
    case "room":
      return activeRoomCode ? (
        <MeetingRoom roomCode={activeRoomCode} onLeave={exitMeetingRoom} isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />
      ) : (
        <Dashboard onJoinMeeting={startJoinMeetingRoom} onNavigate={navigateToView} isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />
      );
    default:
      return <LandingPage onNavigate={navigateToView} isDarkMode={isDarkMode} onToggleTheme={handleToggleTheme} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
