"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MagicMenuProps {
  activeTab: string;
  onChange: (id: string) => void;
  tabs: { id: string; label: string; icon: React.ReactNode; color: string; count?: number }[];
}

export default function MagicMenu({ activeTab, onChange, tabs }: MagicMenuProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  return (
    <div className="relative w-full pt-8 mb-4">
      <div className="relative h-14 w-full max-w-sm mx-auto flex items-center justify-around bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] px-4 shadow-xl select-none group">
        
        {/* Magic Indicator (The "Cutout" logic + Circle) */}
        <motion.div
          animate={{ x: `${activeIndex * 100}%` }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="absolute left-4 w-[calc((100%-32px)/3)] flex justify-center pointer-events-none"
        >
          {/* Output Circle */}
          <div className="relative w-14 h-14 -top-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full border-4 border-[#05060B] shadow-lg shadow-blue-500/30 flex items-center justify-center">
             {/* Concave dip effect via masked container (simplified) */}
             <div className="absolute inset-0 bg-blue-500/20 blur-xl scale-125 z-[-1]" />
          </div>
          
          {/* Label below the dip */}
          <motion.span 
            initial={false}
            animate={{ opacity: 1 }}
            className="absolute top-8 text-[9px] font-black uppercase text-blue-400 tracking-[0.2em] whitespace-nowrap"
          >
            {tabs[activeIndex]?.label}
          </motion.span>
        </motion.div>

        {tabs.map((tab, i) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id as any)}
              className="relative z-10 flex flex-col items-center justify-center w-full h-full"
            >
              <motion.div
                animate={{
                  y: isActive ? -42 : 0,
                  color: isActive ? "#fff" : "#475569",
                  scale: isActive ? 1.2 : 1,
                }}
                transition={{ type: "spring", stiffness: 450, damping: 15 }}
                className="flex items-center justify-center"
              >
                {React.cloneElement(tab.icon as any, {
                  size: 20,
                  strokeWidth: isActive ? 2.5 : 2,
                })}
              </motion.div>
              
              {tab.count !== undefined && !isActive && (
                <span className="absolute bottom-2 font-mono text-[7px] font-black text-slate-700 uppercase tracking-tighter">
                  {tab.count} {tab.count === 1 ? 'MATCH' : 'MATCHES'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
