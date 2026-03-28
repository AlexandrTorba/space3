import React from "react";
import * as ReactChessboard from "react-chessboard";

// Flexible import to handle different module versions
const Chessboard = (ReactChessboard as any).Chessboard || (ReactChessboard as any).default || ReactChessboard;

interface BughouseBoardProps {
  boardIdx: number;
  orientation: "white" | "black";
  fen: string;
  clocks: any;
  playerName: string;
  isMain?: boolean;
  theme: { dark: string; light: string };
  customPieces: any;
  onDrop: (boardIdx: number, source: string, target: string, piece?: string) => boolean;
  onSquareClick: (boardIdx: number, square: string) => void;
  formatTime: (ms: number) => string;
  getPlayerLabel: (role: string) => string;
}

export const BughouseBoard: React.FC<BughouseBoardProps> = ({
  boardIdx, orientation, fen, clocks, playerName, isMain, theme, customPieces, 
  onDrop, onSquareClick, formatTime, getPlayerLabel
}) => {
  const isWhite = orientation === "white";
  
  // Real clocks logic from BughouseArena needs careful mapping
  const b0clock_w = clocks.w0;
  const b0clock_b = clocks.b0;
  const b1clock_w = clocks.w1;
  const b1clock_b = clocks.b1;

  const currentMyClock = boardIdx === 0 
    ? (isWhite ? b0clock_w : b0clock_b)
    : (isWhite ? b1clock_w : b1clock_b);
    
  const currentOppClock = boardIdx === 0 
    ? (isWhite ? b0clock_b : b0clock_w)
    : (isWhite ? b1clock_b : b1clock_w);

  if (!Chessboard || typeof Chessboard !== 'function') {
    return <div className="p-8 text-white bg-red-500/20 rounded-2xl border border-red-500/50">Chessboard Error</div>;
  }

  return (
    <div className={`flex flex-col gap-4 ${isMain ? 'w-full max-w-[700px]' : 'w-full max-w-[500px]'}`}>
        <div className="flex justify-between items-center px-4 bg-white/5 rounded-t-2xl py-2 border border-white/5">
            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">
              {getPlayerLabel(orientation === 'white' ? 'b' + boardIdx : 'w' + boardIdx)}
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(currentOppClock)}
            </div>
        </div>

        <div className="aspect-square border-4 border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <Chessboard 
               position={fen}
               boardOrientation={orientation}
               customPieces={customPieces}
               customDarkSquareStyle={{ backgroundColor: theme.dark }}
               customLightSquareStyle={{ backgroundColor: theme.light }}
               onPieceDrop={(s: string, t: string, p: string) => onDrop(boardIdx, s, t, p)}
               onSquareClick={( { square }: any ) => onSquareClick(boardIdx, square)}
               animationDuration={300}
            />
        </div>

        <div className="flex justify-between items-center px-4 bg-white/5 rounded-b-2xl py-2 border border-white/5">
            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">
              {getPlayerLabel(orientation === 'white' ? 'w' + boardIdx : 'b' + boardIdx)}
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(currentMyClock)}
            </div>
        </div>
    </div>
  );
};
