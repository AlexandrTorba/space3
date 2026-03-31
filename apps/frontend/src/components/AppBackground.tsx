"use client";

import { useSettings } from "@/hooks/useSettings";
import { useEffect } from "react";

export default function AppBackground() {
  const { settings } = useSettings();
  const mode = settings.uiMode;

  useEffect(() => {
    // Sync theme to document for global CSS targeting
    document.documentElement.classList.remove('dark', 'light', 'antigravity');
    document.documentElement.classList.add(mode);
  }, [mode]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[var(--bg-color)]">
      {/* Primary Mesh Gradient Layer */}
      <div className="mesh-gradient opacity-100" />

      {/* Secondary Dynamic Glows */}
      <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-float ${
        mode === 'antigravity' ? 'bg-violet-500/8' : 'bg-blue-500/5'  /* violet visor top-left */
      }`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-float ${
        mode === 'antigravity' ? 'bg-pink-500/6' : 'bg-indigo-500/5'  /* neon-pink bottom-right */
      }`} style={{ animationDelay: '2s' }} />

      {/* Antigravity — hyperdrive corridor: violet core + ice-blue wings + pink stripe */}
      {mode === 'antigravity' && (
        <>
          {/* Violet visor shimmer — center-right */}
          <div className="absolute top-[15%] right-[10%] w-[30%] h-[30%] rounded-full bg-violet-500/5 blur-[100px] animate-float" style={{ animationDelay: '4s' }} />
          {/* Ice-blue corridor light — top-center */}
          <div className="absolute top-[5%] left-[35%] w-[20%] h-[20%] rounded-full bg-sky-300/4 blur-[90px] animate-float" style={{ animationDelay: '1s' }} />
          {/* Neon-pink suit stripe — bottom-left */}
          <div className="absolute bottom-[20%] left-[5%] w-[18%] h-[18%] rounded-full bg-pink-400/4 blur-[70px] animate-float" style={{ animationDelay: '3s' }} />
        </>
      )}
    </div>
  );
}
