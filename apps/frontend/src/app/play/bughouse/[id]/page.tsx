"use client";

import React, { Suspense } from "react";
import BughouseArena from "@/components/Arena/BughouseArena";

export default function BughousePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white/20 font-black tracking-widest animate-pulse">LOADING BUGHOUSE...</div>}>
      <BughouseArena />
    </Suspense>
  );
}
