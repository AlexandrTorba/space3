import React from "react";
import { Chessboard } from "react-chessboard";

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
  const myClock = isWhite ? (boardIdx === 0 ? clocks.w0 : clocks.w1) : (boardIdx === 0 ? clocks.b0 : clocks.b1);
  const oppClock = isWhite ? (boardIdx === 0 ? clocks.b0 : clocks.b1) : (boardIdx === 0 ? clocks.w0 : clocks.w1);

  return (
    <div className={`flex flex-col gap-4 ${isMain ? 'w-full max-w-[700px]' : 'w-full max-w-[500px]'}`}>
        <div className="flex justify-between items-center px-4 bg-white/5 rounded-t-2xl py-2 border border-white/5">
            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">
              {getPlayerLabel(orientation === 'white' ? 'b' + boardIdx : 'w' + boardIdx)}
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(oppClock)}
            </div>
        </div>

        <div className="aspect-square border-4 border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <Chessboard 
               options={{
                  id: `board-${boardIdx}`,
                  position: fen,
                  boardOrientation: orientation,
                  pieces: customPieces as any,
                  darkSquareStyle: { backgroundColor: theme.dark },
                  lightSquareStyle: { backgroundColor: theme.light },
                  onPieceDrop: ((s: string, t: string, p: string) => onDrop(boardIdx, s, t, p)) as any,
                  onSquareClick: ( ({ square }: any) => onSquareClick(boardIdx, square) ) as any,
                  animationDurationInMs: 300
               }}
            />
        </div>

        <div className="flex justify-between items-center px-4 bg-white/5 rounded-b-2xl py-2 border border-white/5">
            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">
              {getPlayerLabel(orientation === 'white' ? 'w' + boardIdx : 'b' + boardIdx)}
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(myClock)}
            </div>
        </div>
    </div>
  );
};
