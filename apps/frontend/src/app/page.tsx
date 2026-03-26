"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";
import { useSettingsContext } from "@/providers/SettingsProvider";
import { useSettings } from "@/hooks/useSettings";

import LobbyHeader from "@/components/Home/LobbyHeader";
import ModeSelection from "@/components/Home/ModeSelection";
import ChallengeConfig from "@/components/Home/ChallengeConfig";
import LobbyList from "@/components/Home/LobbyList";
import HomeSidebar from "@/components/Home/HomeSidebar";
import MatchLoadingOverlay from "@/components/Home/MatchLoadingOverlay";

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setIsPanelOpen } = useSettingsContext();
  const { settings } = useSettings();
  
  const [status, setStatus] = useState("Connecting...");
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
     return () => ws.close();
  }, [playerName, router]);

  const getNameOrDefault = () => {
      let finalName = settings.playerName.trim();
      if (!finalName) {
          finalName = `Player${Math.floor(Math.random() * 9000) + 1000}`;
      }
      return finalName;
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
        onToggleSettings={() => setIsPanelOpen(true)}
        onAnalysisClick={() => router.push("/analysis")}
      />

      <div className="max-w-[1400px] w-full mx-auto mt-24 z-10 grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-3">
              <ModeSelection 
                isBughouse={activeTab === "bughouse"}
                myChallengeId={myChallengeId}
                onCreateChallenge={handleCreateChallenge}
                t={t}
              />
          </div>

          <div className="xl:col-span-6 flex flex-col gap-6">
              <ChallengeConfig 
                 timeControl={activeTab === "bughouse" ? bughouseTimeControl : timeControl}
                 onTimeControlChange={activeTab === "bughouse" ? setBughouseTimeControl : setTimeControl}
                 colorPref={activeTab === "bughouse" ? bughouseColorPref : colorPref}
                 onColorPrefChange={activeTab === "bughouse" ? setBughouseColorPref : setColorPref}
                 myChallengeId={myChallengeId}
                 onCancelChallenge={handleCancelChallenge}
              />
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
              <HomeSidebar />
          </div>
      </div>

      <MatchLoadingOverlay isVisible={isMatching} />
    </main>
  );
}
