"use client";

import MagicMenu from "./MagicMenu";
import { usePathname, useRouter } from "next/navigation";
import { Crown, Swords, Activity, Settings as SettingsIcon, User } from "lucide-react";

interface LobbyHeaderProps {
    status: string;
    playerName: string;
    activeGlobalTab: "play" | "analysis" | "settings";
    setActiveGlobalTab: (tab: "play" | "analysis" | "settings") => void;
}

export default function LobbyHeader({ 
    status, playerName, 
    activeGlobalTab, setActiveGlobalTab 
}: LobbyHeaderProps) {
  const router = useRouter();

  const handleTabChange = (id: any) => {
    setActiveGlobalTab(id);
    // Sync with router if needed, or just stay on home page
    if (id === "play") router.push("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-start pt-4 pb-4 px-6 md:px-12 bg-gradient-to-b from-[#05060B] via-[#05060B]/80 to-transparent gap-4">
        <div className="flex items-center gap-3 pt-6 md:pt-4 cursor-pointer" onClick={() => handleTabChange("play")}>
           <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Crown className="w-6 h-6 text-white" />
           </div>
           <div className="flex flex-col justify-center">
              <h1 className="text-xs sm:text-lg font-black tracking-tighter uppercase leading-tight text-white whitespace-nowrap">AntigravityChess</h1>
              <div className="flex items-center gap-1.5 sm:gap-2">
                 <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-ping" />
                 <span className="text-[7px] sm:text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Edge: {status}</span>
              </div>
           </div>
        </div>

        <div className="flex-1 max-w-sm px-4 hidden md:block scale-90">
            <MagicMenu 
                activeTab={activeGlobalTab}
                onChange={handleTabChange}
                tabs={[
                    { id: "play", label: "Play", icon: <Swords />, color: "blue" },
                    { id: "analysis", label: "Analysis", icon: <Activity />, color: "indigo" },
                    { id: "settings", label: "Settings", icon: <SettingsIcon />, color: "slate" },
                ]}
            />
        </div>

        <div className="flex items-center gap-2 md:gap-4 pt-8">
           <div className="flex items-center gap-1 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-black tracking-tight max-w-[80px] sm:max-w-none truncate">{playerName}</span>
           </div>
           <button onClick={() => setActiveGlobalTab("settings")} className="md:hidden p-2.5 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10">
              <SettingsIcon className="w-5 h-5 text-slate-400" />
           </button>
        </div>
    </header>
  );
}
