"use client";

import dynamic from "next/dynamic";
import React from "react";

// Ultimate Robust Hydration Fix
// Using next/dynamic with ssr: false ensures that anything inside 
// the PlayArena component (and its imports like protobuf/react-chessboard)
// ONLY executes in the browser, bypassing all server-side rendering crashes.
const PlayArenaClient = dynamic(() => import("./PlayArena"), { 
    ssr: false,
    loading: () => <div className="min-h-screen bg-[#07090E]" /> 
});

export default function Page() {
    return <PlayArenaClient />;
}
