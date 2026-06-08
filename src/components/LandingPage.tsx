import { useState } from "react";
import { motion } from "motion/react";
import { Video, Shield, Users, Mic, Laptop, HelpCircle, ArrowRight, CheckCircle, Smartphone, Globe, MessageSquare, Play, Sparkles, Sun, Moon } from "lucide-react";

interface LandingPageProps {
  onNavigate: (view: "landing" | "login" | "register" | "dashboard") => void;
  onJoinMeeting?: (code: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export default function LandingPage({ onNavigate, onJoinMeeting, isDarkMode, onToggleTheme }: LandingPageProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const features = [
    {
      icon: <Video className="w-6 h-6 text-[#C9A84C]" />,
      title: "Ultra HD Video Conferences",
      description: "Low-latency high-definition video feeds optimized for low bandwidth connections using standard WebRTC.",
    },
    {
      icon: <Laptop className="w-6 h-6 text-[#C9A84C]" />,
      title: "Fluid Screen Sharing",
      description: "Present full windows, native screens, or individual browser tabs in real-time with flawless motion.",
    },
    {
      icon: <Shield className="w-6 h-6 text-[#C9A84C]" />,
      title: "Secure Encrypted Rooms",
      description: "Secure meetings utilizing standard JSON Web Tokens, custom passcode blockades, and lobby approvals.",
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-[#C9A84C]" />,
      title: "Real-Time Chat & Polls",
      description: "Engage teams through dynamic instant chat channels and live multiple-choice decision polling dashboards.",
    },
    {
      icon: <Globe className="w-6 h-6 text-[#C9A84C]" />,
      title: "Collaborative Whiteboards",
      description: "Brainstorm on a shared digital canvas. Sketch, write, and align ideas in active video sessions.",
    },
    {
      icon: <Users className="w-6 h-6 text-[#C9A84C]" />,
      title: "Smart Gemini AI Insights",
      description: "Leverage advanced Gemini models to transcribe calls, generate actionable tasks lists, and summarize sessions.",
    }
  ];

  const faqs = [
    {
      q: "Does this video platform require custom software installation?",
      a: "Absolutely not. Our solution operates entirely within modern web browsers without requiring custom modules or setups."
    },
    {
      q: "Can I host meetings with participants who do not have a profile?",
      a: "Yes. Simply share the secure 10-character meeting code, and guests can easily join high fidelity audio-video feeds after host approval."
    },
    {
      q: "How does the AI Summarization feature work?",
      a: "By clicking the AI Summarize trigger inside a call, our integration compiles chat records, whiteboard inputs, and meeting notes, transmitting them to Gemini to receive structured meeting digests with action items within seconds."
    },
    {
      q: "Is there local video capturing/recording supported?",
      a: "Yes, you can toggle a recording session on-the-fly and fetch, preview, or play your recordings."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex flex-col selection:bg-[#C9A84C]/20 selection:text-[#1A1A1A] relative overflow-hidden font-sans">
      
      {/* Warm ambient background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#C9A84C]/6 blur-[140px] animate-float-slow pointer-events-none -z-10"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#C9A84C]/4 blur-[160px] animate-float-medium pointer-events-none -z-10"></div>
      <div className="absolute top-[40%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-[#F0EFE8]/80 blur-[100px] animate-pulse-glow pointer-events-none -z-10"></div>

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(26,26,26,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,26,26,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none -z-10"></div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#FAFAF8]/80 border-b border-[#1A1A1A]/8 py-4 px-6 md:px-12 flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-2.5 rounded-2xl text-[#C9A84C] shadow-sm relative overflow-hidden group">
            <span className="absolute inset-0 bg-[#C9A84C]/10 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300"></span>
            <Video className="w-5 h-5 relative z-10" />
          </div>
          <span className="font-heading font-extrabold tracking-tight text-2xl text-[#1A1A1A]">
            MeetSphere<span className="text-[#C9A84C] font-medium">.io</span>
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button
            onClick={onToggleTheme}
            className="p-2.5 rounded-xl border border-[#1A1A1A]/10 bg-[#F0EFE8] hover:bg-[#E8E6DC] text-[#1A1A1A] hover:text-[#C9A84C] transition-all cursor-pointer shadow-sm"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
          <button 
            onClick={() => onNavigate("login")} 
            className="text-sm font-semibold text-[#1A1A1A]/60 hover:text-[#C9A84C] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
          >
            Sign In
          </button>
          <button 
            onClick={() => onNavigate("register")} 
            className="bg-[#1A1A1A] hover:bg-[#C9A84C] text-white hover:text-[#1A1A1A] px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Get Started Free
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-20 pb-24 px-6 md:px-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Live badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#C9A84C]/12 border border-[#C9A84C]/30 text-xs font-bold text-[#8B6914] uppercase tracking-widest leading-none shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C9A84C] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C9A84C]"></span>
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#C9A84C]" /> Powered by WebRTC & Gemini AI
              </span>
            </div>

            <h1 className="text-4xl md:text-[4.25rem] font-heading font-extrabold tracking-tight leading-[1.06] text-[#1A1A1A]">
              Next-Generation Video <br />
              Conferences.{" "}
              <span className="relative inline-block">
                <span className="text-[#C9A84C]">Smarter Summaries.</span>
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-[#C9A84C]/30 rounded-full"></span>
              </span>
            </h1>

            <p className="text-[#1A1A1A]/55 text-base md:text-lg max-w-2xl mx-auto font-sans font-normal leading-relaxed">
              Experience zero-latency immersive calls equipped with real-time whiteboards, interactive poll engines, and automatic meeting digests compiled in seconds by Google Gemini.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <button
                onClick={() => onNavigate("register")}
                className="w-full sm:w-auto bg-[#1A1A1A] hover:bg-[#C9A84C] text-white hover:text-[#1A1A1A] px-8 py-4 rounded-2xl text-base font-bold shadow-lg hover:shadow-[0_8px_30px_rgba(201,168,76,0.30)] flex items-center justify-center gap-2 active:scale-97 transition-all duration-200 cursor-pointer"
              >
                Launch Custom Meeting <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigate("login")}
                className="w-full sm:w-auto bg-[#F0EFE8] hover:bg-[#E8E6DC] text-[#1A1A1A] border border-[#1A1A1A]/12 px-8 py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 hover:border-[#C9A84C]/40 active:scale-97 transition-all duration-200 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-[#1A1A1A]" /> Live Sandbox
              </button>
            </div>
          </motion.div>

          {/* Hero UI Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-5xl mx-auto mt-20 rounded-3xl border border-[#1A1A1A]/10 bg-[#F0EFE8] p-4 shadow-[0_20px_60px_rgba(26,26,26,0.10)] relative"
          >
            {/* Mock browser bar */}
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/8 pb-3.5 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400/80"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-400/80"></span>
                <span className="w-3 h-3 rounded-full bg-green-400/80"></span>
                <span className="text-xs text-[#1A1A1A]/35 ml-2.5 font-mono select-none">https://meetsphere.io/room/tech-sync-2026</span>
              </div>
              <span className="text-xs text-[#8B6914] font-mono flex items-center gap-1.5 bg-[#C9A84C]/12 px-3 py-1 rounded-full border border-[#C9A84C]/25 font-bold animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]"></span> LIVE BROADCAST
              </span>
            </div>
            
            {/* Mock dashboard — video area stays dark for realism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="md:col-span-2 aspect-video bg-[#1A1A1A] rounded-2xl relative overflow-hidden flex items-center justify-center border border-[#1A1A1A]/20 shadow-inner">
                <img 
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800" 
                  alt="Presentation Feed" 
                  className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent"></div>
                <div className="absolute top-4 left-4 bg-[#1A1A1A]/80 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md shadow-md text-white">
                  Dr. Sarah Jenkins (Host)
                </div>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <span className="p-2 px-3 gap-2 text-xs bg-[#1A1A1A]/90 border border-white/10 rounded-xl flex items-center shadow-lg backdrop-blur-md text-white">
                    <Mic className="w-3.5 h-3.5 text-[#C9A84C]" /> Active Speaker
                  </span>
                </div>
              </div>
              
              {/* Chat sidebar */}
              <div className="bg-white rounded-2xl p-4 border border-[#1A1A1A]/8 flex flex-col justify-between space-y-4 shadow-sm">
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]/40">Live Chat Log</h4>
                  <div className="space-y-3 text-xs max-h-[190px] overflow-hidden">
                    <div className="bg-[#F0EFE8] p-2.5 rounded-xl border border-[#1A1A1A]/6">
                      <span className="font-bold text-[#8B6914] block mb-0.5">Marcus Chen</span>
                      <span className="text-[#1A1A1A]/70">Agreed! Let's schedule the beta deployment.</span>
                    </div>
                    <div className="bg-[#F0EFE8] p-2.5 rounded-xl border border-[#1A1A1A]/6">
                      <span className="font-bold text-[#1A1A1A]/80 block mb-0.5">Aisha Touray</span>
                      <span className="text-[#1A1A1A]/70">Just saved the updated layout vectors to cloud.</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#C9A84C]/8 border border-[#C9A84C]/25 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#8B6914]">
                    <CheckCircle className="w-4 h-4 text-[#C9A84C]" /> Gemini Smart AI Summary
                  </div>
                  <p className="text-[10px] text-[#1A1A1A]/55 leading-normal font-sans">
                    Sarah Jenkins asked Aisha Touray to complete structural layout animations and aligned roadmap deliverables...
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Feature Grid */}
        <section className="py-28 border-t border-[#1A1A1A]/8 bg-[#F0EFE8] relative">
          <div className="max-w-6xl mx-auto px-6 md:px-12">
            <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
              <h2 className="text-3xl font-heading font-extrabold tracking-tight text-[#1A1A1A] sm:text-[2.75rem] leading-tight">
                Loaded with Collaborative Controls
              </h2>
              <p className="text-[#1A1A1A]/55 font-sans text-base leading-relaxed">
                A unified conferencing hub optimized for professional standups, interactive tutorials, and live customer reviews.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feat, index) => (
                <div 
                  key={index} 
                  className="bg-[#FAFAF8] border border-[#1A1A1A]/8 p-7 rounded-3xl hover:border-[#C9A84C]/40 hover:shadow-[0_12px_40px_rgba(201,168,76,0.12)] hover:scale-[1.02] transition-all duration-300 group cursor-default"
                >
                  <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/20 p-3.5 rounded-2xl w-fit mb-5 group-hover:bg-[#C9A84C]/18 group-hover:scale-110 transition-all duration-300">
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-heading font-bold mb-2 text-[#1A1A1A] group-hover:text-[#8B6914] transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-[#1A1A1A]/55 text-sm leading-relaxed font-sans">
                    {feat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-28 border-t border-[#1A1A1A]/8 bg-[#FAFAF8]">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-3xl font-heading font-extrabold tracking-tight text-[#1A1A1A] sm:text-[2.75rem]">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div 
                  key={index} 
                  className="bg-[#F0EFE8] border border-[#1A1A1A]/8 rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#C9A84C]/30"
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                    className="w-full text-left p-6 flex justify-between items-center hover:bg-[#C9A84C]/5 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-[#1A1A1A] font-sans pr-4">{faq.q}</span>
                    <HelpCircle className={`w-5 h-5 text-[#1A1A1A]/30 shrink-0 transition-transform duration-300 ${activeFaq === index ? "rotate-180 text-[#C9A84C]" : ""}`} />
                  </button>
                  
                  <div className={`transition-all duration-350 ease-in-out overflow-hidden ${activeFaq === index ? "max-h-[300px] border-t border-[#1A1A1A]/8" : "max-h-0"}`}>
                    <p className="p-6 text-[#1A1A1A]/60 text-sm leading-relaxed font-sans">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1A1A1A]/8 bg-[#F0EFE8] py-12 px-6 md:px-12 flex flex-col sm:flex-row justify-between items-center gap-6 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-2 rounded-xl text-[#C9A84C]">
            <Video className="w-4 h-4" />
          </div>
          <span className="font-heading font-extrabold text-[#1A1A1A]">MeetSphere.io</span>
        </div>
        <p className="text-xs text-[#1A1A1A]/35 font-mono tracking-tight text-center sm:text-right select-none">
          © 2026 MeetSphere Platforms Inc. Fully secure sandbox staging environment.
        </p>
      </footer>
    </div>
  );
}
