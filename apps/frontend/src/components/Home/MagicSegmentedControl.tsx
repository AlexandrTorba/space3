"use client";

import { motion } from "framer-motion";
import React from "react";

interface Option {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface MagicSegmentedControlProps {
  value: string;
  onChange: (id: string) => void;
  options: Option[];
}

export default function MagicSegmentedControl({ value, onChange, options }: MagicSegmentedControlProps) {
  const activeIndex = options.findIndex(o => o.id === value);

  return (
    <div className="relative w-full pt-6">
      <div className="relative h-12 w-full flex items-center justify-around bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-2xl px-2 select-none group">
        
        {/* Magic Indicator (The Floating Circle) */}
        <motion.div
          animate={{ x: `calc(${activeIndex * 100}% + ${activeIndex * 4}px)` }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="absolute left-1 w-[calc((100%-8px)/length)] flex justify-center pointer-events-none"
          style={{ width: `${100 / options.length}%` }}
        >
          <div className="relative w-10 h-10 -top-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full border-4 border-[#0F111A] shadow-lg shadow-blue-500/40 flex items-center justify-center">
             <div className="absolute inset-0 bg-blue-500/20 blur-lg scale-125 z-[-1]" />
          </div>
          <span className="absolute top-5 text-[8px] font-black uppercase text-blue-400 tracking-[0.2em] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            {options[activeIndex]?.label}
          </span>
        </motion.div>

        {options.map((option) => {
          const isActive = value === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onChange(option.id)}
              className="relative z-10 flex flex-col items-center justify-center w-full h-full"
            >
              <motion.div
                animate={{
                  y: isActive ? -28 : 0,
                  color: isActive ? "#fff" : "#475569",
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 450, damping: 20 }}
                className="flex items-center justify-center gap-2"
              >
                {option.icon && React.cloneElement(option.icon as any, {
                  size: 14,
                  strokeWidth: isActive ? 2.5 : 2,
                })}
                {!isActive && <span className="text-[10px] font-black uppercase tracking-tight">{option.label}</span>}
              </motion.div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
