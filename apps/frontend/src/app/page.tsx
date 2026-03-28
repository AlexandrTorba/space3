"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";
import { useSettingsContext } from "@/providers/SettingsProvider";
import { useSettings } from "@/hooks/useSettings";

import LobbyHeader from "@/components/Home/LobbyHeader";
import ModeSelection from "@/components/Home/ModeSelection";
import MatchSetupModal from "@/components/Home/MatchSetupModal";
import LobbyList from "@/components/Home/LobbyList";
import HomeSidebar from "@/components/Home/HomeSidebar";
import MatchLoadingOverlay from "@/components/Home/MatchLoadingOverlay";
import HomeAnalysisView from "@/components/Home/HomeAnalysisView";
import HomeSettingsView from "@/components/Home/HomeSettingsView";

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setIsPanelOpen } = useSettingsContext();
  const { settings } = useSettings();
  
  const [status, setStatus] = useState("Connecting...");
  const [latency, setLatency] = useState("12");
  const wsRef = useRef<WebSocket | null>(null);
  
  const playerName = settings.playerName;
  const [timeControl, setTimeControl] = useState("3");
  const [colorPref, setColorPref] = useState<"white" | "black" | "random">("random");
  const [bughouseTimeControl, setBughouseTimeControl] = useState("3");
  const [bughouseColorPref, setBughouseColorPref] = useState<"white" | "black" | "random">("random");
  
  const [challenges, setChallenges] = useState<{id: string, playerName: string, tc: string, colorPref: string, mode?: string, playersCount?: number}[]>([]);
  const [liveMatches, setLiveMatches] = useState<{id: string, whiteName: string, blackName: string, timeControl: string, spectators?: number}[]>([]);
  const [myChallengeId, setMyChallengeId] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [activeTab, setActiveTab] = useState<"lobby" | "bughouse" | "live">("lobby");
  const [globalTab, setGlobalTab] = useState<"play" | "analysis" | "settings">("play");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<"standard" | "bughouse">("standard");

  useEffect(() => {
     const fetchLive = () => {
         const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
         let host = rawUrl;
         try {
           if (rawUrl?.includes("://")) host = new URL(rawUrl).host;
         } catch(e) {}
         const protocol = window.location.protocol === "https:" ? "https:" : "http:";
         fetch(`${protocol}//${host}/api/live`)
           .then(res => res.json())
           .then(data => setLiveMatches(data))
           .catch(() => {});
     };
     fetchLive();
     const interval = setInterval(fetchLive, 5000);
     return () => clearInterval(interval);
  }, []);

  useEffect(() => {
     const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
     const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
     let host = rawUrl;
     try {
       if (rawUrl?.includes("://")) host = new URL(rawUrl).host;
     } catch(e) {}
     const ws = new WebSocket(`${protocol}//${host}/lobby`);
     wsRef.current = ws;

     ws.onopen = () => setStatus("Connected");
     ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "pong") {
            const l = Date.now() - (ws as any).lastPing;
            setLatency(String(l));
            return;
        }
        if (data.type === "challenges_list") setChallenges(data.challenges);
        else if (data.type === "waiting_created") setMyChallengeId(data.id);
        else if (data.type === "MATCH_FOUND") {
            if (data.mode === "bughouse") {
               router.push(`/play/bughouse/${data.matchId}?role=${data.role}&tc=${data.tc}${data.fillBots ? '&fillBots=1' : ''}`);
               return;
            }
            setIsMatching(true);
            setTimeout(() => {
                const wParam = data.color === "white" ? encodeURIComponent(playerName) : encodeURIComponent(data.opponent);
                const bParam = data.color === "black" ? encodeURIComponent(playerName) : encodeURIComponent(data.opponent);
                router.push(`/play/${data.matchId}?color=${data.color}&tc=${data.tc}&w=${wParam}&b=${bParam}${data.isBot ? '&isBot=true' : ''}`);
            }, 800);
        }
     };

     const pingInt = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
           (ws as any).lastPing = Date.now();
           ws.send(JSON.stringify({ type: "ping" }));
        }
     }, 5000);

     return () => {
        clearInterval(pingInt);
        ws.close();
     };
  }, [playerName, router]);

  const getNameOrDefault = () => {
      let finalName = settings.playerName.trim();
      if (!finalName) {
          finalName = `Player${Math.floor(Math.random() * 9000) + 1000}`;
      }
      return finalName;
  };

  const handleOpenSetup = (mode: "standard" | "bughouse") => {
      setSetupMode(mode);
      setIsSetupOpen(true);
  };

  const handleCreateChallengeInSetup = () => {
    const isBh = setupMode === "bughouse";
    handleCreateChallenge(isBh);
    setIsSetupOpen(false);
  };

  const handleCreateChallenge = (bughouse: boolean, vsBots?: boolean) => {
      const finalName = getNameOrDefault();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
             type: "create", playerName: finalName, timeControl: bughouse ? bughouseTimeControl : timeControl, colorPref: bughouse ? bughouseColorPref : colorPref,
             mode: bughouse ? "bughouse" : "standard",
             vsBots: !!vsBots
          }));
      }
  };

  const handleCancelChallenge = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "cancel" }));
      }
      setMyChallengeId(null);
  };

  const handleAcceptChallenge = (id: string) => {
      const finalName = getNameOrDefault();
      setIsMatching(true);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "accept", challengeId: id, playerName: finalName }));
      }
  };

  return (
    <main className="min-h-screen bg-[#05060B] text-slate-100 flex flex-col p-4 md:p-10 relative overflow-x-hidden selection:bg-blue-500/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <LobbyHeader 
        status={status} 
        playerName={playerName} 
        activeGlobalTab={globalTab}
        setActiveGlobalTab={setGlobalTab}
      />

      <div className="max-w-[1400px] w-full mx-auto mt-16 md:mt-20 z-10 grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
          {globalTab === "play" ? (
              <>
                <div className="xl:col-span-3">
                    <ModeSelection 
                        isBughouse={activeTab === "bughouse"}
                        myChallengeId={myChallengeId}
                        onOpenSetup={handleOpenSetup}
                        t={t}
                    />
                </div>

                <div className="xl:col-span-6 flex flex-col gap-6">
                    {myChallengeId && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2rem] flex items-center justify-between shadow-xl backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">Global Lobby</div>
                                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-tight">Searching Match...</h3>
                                </div>
                            </div>
                            <button 
                                onClick={handleCancelChallenge}
                                className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    <LobbyList 
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        challenges={challenges}
                        liveMatches={liveMatches}
                        onAcceptChallenge={handleAcceptChallenge}
                        onSpectateMatch={(id) => router.push(`/play/${id}?color=spectator`)}
                    />
                </div>

                <div className="xl:col-span-3">
                    <HomeSidebar latency={latency} />
                </div>
              </>
          ) : globalTab === "analysis" ? (
                <div className="col-span-12">
                    <HomeAnalysisView />
                </div>
          ) : (
                <div className="col-span-12">
                    <HomeSettingsView />
                </div>
          )}
      </div>

      <MatchLoadingOverlay isVisible={isMatching} />

      <MatchSetupModal 
          isOpen={isSetupOpen}
          mode={setupMode}
          onClose={() => setIsSetupOpen(false)}
          onCreate={handleCreateChallengeInSetup}
          timeControl={setupMode === "bughouse" ? bughouseTimeControl : timeControl}
          onTimeControlChange={setupMode === "bughouse" ? setBughouseTimeControl : setTimeControl}
          colorPref={setupMode === "bughouse" ? bughouseColorPref : colorPref}
          onColorPrefChange={setupMode === "bughouse" ? setBughouseColorPref : setColorPref}
          t={t}
      />
      
      <footer className="mt-8 pb-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-700/50">
        © 2026 ANTIGRAVITYCHESS.IO. BY USING THIS SERVICE, YOU AGREE TO OUR 
        <a href="https://github.com/AlexandrTorba/space3/blob/main/DISCLAIMER.md" target="_blank" rel="noopener noreferrer" className="ml-1 text-slate-600 hover:text-blue-500 underline decoration-slate-800 underline-offset-4 transition-colors">
          DISCLAIMER
        </a>
      </footer>
    </main>
  );
}
