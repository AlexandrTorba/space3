"use client";

import { useSettings } from "@/hooks/useSettings";
import { useEffect } from "react";

export default function AppBackground() {
  const { settings } = useSettings();
  const isDark = settings.uiMode === "dark";

  useEffect(() => {
    // Sync theme to document for global CSS targeting
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[var(--bg-color)]">
      {/* Primary Mesh Gradient Layer */}
      <div className="mesh-gradient opacity-100" />
      
      {/* Secondary Dynamic Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px] animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
    </div>
  );
}
