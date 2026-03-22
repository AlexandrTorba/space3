import React from "react";
import PlayArena from "./PlayArena";

export default function Page() {
    return (
        <React.Suspense fallback={<div className="min-h-screen bg-[#07090E] flex items-center justify-center text-white">Initializing...</div>}>
            <PlayArena />
        </React.Suspense>
    );
}
