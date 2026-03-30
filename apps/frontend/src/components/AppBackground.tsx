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
        mode === 'antigravity' ? 'bg-purple-500/8' : 'bg-blue-500/5'
      }`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] animate-float ${
        mode === 'antigravity' ? 'bg-amber-500/5' : 'bg-indigo-500/5'
      }`} style={{ animationDelay: '2s' }} />
      
      {/* Antigravity-specific gravitational lensing effect */}
      {mode === 'antigravity' && (
        <>
          <div className="absolute top-[20%] right-[15%] w-[25%] h-[25%] rounded-full bg-violet-600/4 blur-[100px] animate-float" style={{ animationDelay: '4s' }} />
          <div className="absolute bottom-[30%] left-[10%] w-[20%] h-[20%] rounded-full bg-amber-400/3 blur-[80px] animate-float" style={{ animationDelay: '1s' }} />
        </>
      )}
    </div>
  );
}
