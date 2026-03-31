import React, { useRef, useState, useEffect, useCallback, Component } from "react";
import { Chessboard } from "react-chessboard";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Catches "Square width not found" and similar react-chessboard render errors during resize */
class ChessboardErrorBoundary extends Component<
  { children: React.ReactNode; boardWidth: number },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; boardWidth: number }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    setTimeout(() => this.setState({ hasError: false }), 500);
  }
  componentDidUpdate(prev: { boardWidth: number }) {
    if (this.state.hasError && prev.boardWidth !== this.props.boardWidth) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ width: this.props.boardWidth, height: this.props.boardWidth }} />;
    }
    return this.props.children;
  }
}

interface BughouseBoardProps {
  boardIdx: number;
  orientation: "white" | "black";
  fen: string;
  clocks: any;
  playerName: string;
  isMain?: boolean;
  scale?: number;
  theme: { dark: string; light: string };
  customPieces: any;
  showCoordinates?: boolean;
  onDrop: (boardIdx: number, source: string, target: string, piece?: string) => boolean;
  onSquareClick: (boardIdx: number, square: string) => void;
  formatTime: (ms: number) => string;
  getPlayerLabel: (role: string) => string;
}

export const BughouseBoard: React.FC<BughouseBoardProps> = ({
  boardIdx, orientation, fen, clocks, playerName, isMain, scale = 100, theme, customPieces,
  showCoordinates = false, onDrop, onSquareClick, formatTime, getPlayerLabel
}) => {
  const whiteKey = `w${boardIdx}` as "w0" | "w1";
  const blackKey = `b${boardIdx}` as "b0" | "b1";
  const whiteClock = clocks?.[whiteKey] ?? 0;
  const blackClock = clocks?.[blackKey] ?? 0;

  const bottomClock = orientation === "white" ? whiteClock : blackClock;
  const topClock    = orientation === "white" ? blackClock : whiteClock;
  const bottomRole  = orientation === "white" ? `w${boardIdx}` : `b${boardIdx}`;
  const topRole     = orientation === "white" ? `b${boardIdx}` : `w${boardIdx}`;

  // ─── Board width measurement ───────────────────────────────────────────────
  // Rules: never pass 0 to boardWidth, debounce resize, use contentRect
  const containerRef  = useRef<HTMLDivElement>(null);
  const wrapperRef    = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // userWidth: null = fluid (100%), number = user has dragged to a fixed size
  const [userWidth, setUserWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const applyWidth = (w: number) => {
      if (w > 10) setBoardWidth(w);
    };

    const init = setTimeout(() => applyWidth(el.getBoundingClientRect().width), 0);

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.getBoundingClientRect().width;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => applyWidth(w), 50);
    });
    ro.observe(el);

    return () => {
      clearTimeout(init);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      ro.disconnect();
    };
  }, []);

  // ─── Resize handle logic ───────────────────────────────────────────────────
  // The handle is a small grip at the bottom-right OUTSIDE touch-action:none zone.
  // Pointer events on the handle never reach the chess board.
  const resizeStart = useRef<{ x: number; y: number; w: number } | null>(null);

  const onResizeMove = useCallback((e: PointerEvent) => {
    if (!resizeStart.current) return;
    const delta = e.clientX - resizeStart.current.x;
    const newW  = Math.max(120, Math.min(700, resizeStart.current.w + delta));
    setUserWidth(newW);
  }, []);

  const onResizeEnd = useCallback(() => {
    resizeStart.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup",   onResizeEnd);
  }, [onResizeMove]);

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation(); // don't let this bubble into the board
    const container = containerRef.current;
    if (!container) return;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: container.getBoundingClientRect().width,
    };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup",   onResizeEnd);
  }, [onResizeMove, onResizeEnd]);

  // Cleanup pointer listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup",   onResizeEnd);
    };
  }, [onResizeMove, onResizeEnd]);

  const safeTheme = theme ?? { dark: "#4d6d4d", light: "#f0f0f0" };
  const safeFen   = (!fen || fen === "start") ? START_FEN : fen;

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        // Apply user-set width; fall back to 100% of parent
        width: userWidth ? `${userWidth}px` : "100%",
      } as React.CSSProperties}
    >
      {/* Top player bar */}
      <div className="flex justify-between items-center px-2 bg-white/5 rounded-t-xl py-1 border border-white/5 border-b-0">
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[60%]">
          {getPlayerLabel(topRole)}
        </div>
        <div className={`text-sm font-mono font-black tabular-nums ${topClock < 30000 ? "text-red-400" : "text-white"}`}>
          {formatTime(topClock)}
        </div>
      </div>

      {/* Board container — touch-action:none prevents scroll hijacking on mobile */}
      <div
        ref={containerRef}
        className="aspect-square border-2 border-slate-800 overflow-hidden shadow-xl relative w-full"
        style={{
          touchAction: "none",   // piece drags work; resize handle is outside
          userSelect: "none",
          WebkitUserSelect: "none",
        } as React.CSSProperties}
        onContextMenu={e => e.preventDefault()}
      >
        {boardWidth > 0 && (
          <ChessboardErrorBoundary boardWidth={boardWidth}>
            <Chessboard
              options={{
                boardWidth,
                position: safeFen,
                boardOrientation: orientation,
                pieces: customPieces,
                darkSquareStyle:  { backgroundColor: safeTheme.dark },
                lightSquareStyle: { backgroundColor: safeTheme.light },
                showNotation: showCoordinates,
                onPieceDrop: ({ piece, sourceSquare, targetSquare }: any) =>
                  onDrop(boardIdx, sourceSquare || piece?.position, targetSquare, piece?.pieceType || piece),
                onSquareClick: ({ square }: any) => onSquareClick(boardIdx, square),
                animationDurationInMs: 200,
              } as any}
            />
          </ChessboardErrorBoundary>
        )}
      </div>

      {/* Bottom player bar + resize handle row */}
      <div className="relative">
        <div className="flex justify-between items-center px-2 bg-white/5 rounded-b-xl py-1 border border-white/5 border-t-0">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[60%]">
            {getPlayerLabel(bottomRole)}
          </div>
          <div className={`text-sm font-mono font-black tabular-nums ${bottomClock < 30000 ? "text-red-400" : "text-white"}`}>
            {formatTime(bottomClock)}
          </div>
        </div>

        {/*
          Resize handle — bottom-right corner.
          IMPORTANT: this element is NOT inside the touch-action:none board,
          so it gets its own pointer events without interfering with piece drags.
          touch-action:none on the handle itself so its own drag works on mobile.
        */}
        <div
          onPointerDown={onResizeStart}
          title="Drag to resize board"
          style={{ touchAction: "none", cursor: "se-resize" } as React.CSSProperties}
          className={`
            absolute bottom-0 right-0
            w-5 h-5
            flex items-center justify-center
            rounded-br-xl
            opacity-30 hover:opacity-80 active:opacity-100
            transition-opacity duration-150
            select-none
          `}
        >
          {/* Grip dots — classic resize icon */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-slate-300">
            <circle cx="8" cy="8" r="1.2"/>
            <circle cx="4" cy="8" r="1.2"/>
            <circle cx="8" cy="4" r="1.2"/>
          </svg>
        </div>
      </div>
    </div>
  );
};
