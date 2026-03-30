"use client";

import React, { Suspense, Component } from "react";
import BughouseArena from "@/components/Arena/BughouseArena";

// Error Boundary — catches any runtime render error and shows fallback instead of "This page couldn't load"
class BughouseErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean; error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error('[BughouseArena] Render error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-black text-white">Помилка завантаження</h1>
          <p className="text-slate-400 text-sm max-w-xs">
            {this.state.error?.message || 'Сталася помилка в арені Bughouse. Спробуйте перезавантажити.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all active:scale-95"
          >
            🔄 Перезавантажити
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function BughousePage() {
  return (
    <BughouseErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white/20 font-black tracking-widest animate-pulse">LOADING BUGHOUSE...</div>}>
        <BughouseArena />
      </Suspense>
    </BughouseErrorBoundary>
  );
}
