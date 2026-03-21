"use client";

import { useSettings, backgroundGradients } from "@/hooks/useSettings";
import { useEffect } from "react";

export default function AppBackground() {
  const { settings } = useSettings();
  const currentBg = backgroundGradients[settings.backgroundTheme] || backgroundGradients.cosmos;

  useEffect(() => {
    // Apply background base color to body to prevent flash
    document.body.className = `min-h-full flex flex-col transition-colors duration-700 ${currentBg.base}`;
  }, [currentBg.base]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vh] ${currentBg.primary} rounded-full blur-[120px] transition-all duration-1000 opacity-60`} 
      />
      <div 
        className={`absolute top-0 right-0 w-[80vw] h-[80vh] ${currentBg.secondary || ''} rounded-full blur-[150px] transition-all duration-1000 opacity-40 translate-x-1/4 -translate-y-1/4`} 
      />
    </div>
  );
}
