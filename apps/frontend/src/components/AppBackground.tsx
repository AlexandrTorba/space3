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
    <div 
      className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-500 ${
        isDark ? "bg-[#161512]" : "bg-[#f0f0f0]"
      }`}
    />
  );
}
