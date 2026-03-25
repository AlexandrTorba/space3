"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Swords } from "lucide-react";

interface MatchLoadingOverlayProps {
    isVisible: boolean;
}

export default function MatchLoadingOverlay({ isVisible }: MatchLoadingOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
         <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-10"
         >
            <div className="relative">
               <Loader2 className="w-24 h-24 text-blue-500 animate-spin opacity-20" />
               <Swords className="w-10 h-10 text-white absolute inset-0 m-auto animate-bounce" />
            </div>
            <h2 className="text-3xl font-black mt-8 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 uppercase">Initializing Arena</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">Connecting to distributed edge instance...</p>
         </motion.div>
      )}
    </AnimatePresence>
  );
}
