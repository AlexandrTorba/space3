import React from "react";

interface BughouseBankProps {
  bank: string[];
  boardIdx: number;
  playerColor: "w" | "b";
  selectedPiece: {char: string, board: number} | null;
  setSelectedPiece: (piece: {char: string, board: number} | null) => void;
  getPieceUrl: (piece: string) => string;
  placementHint?: string;
  emptyLabel?: string;
  compact?: boolean;  // true = landscape (smaller), false = portrait (larger)
}

export const BughouseBank: React.FC<BughouseBankProps> = ({
  bank, boardIdx, playerColor, selectedPiece, setSelectedPiece, getPieceUrl, placementHint, emptyLabel, compact = false
}) => {
  const isSelected = (p: string) =>
    selectedPiece?.board === boardIdx && selectedPiece?.char === p;

  const hasSelection = selectedPiece?.board === boardIdx;

  const containerH = compact ? 'h-9' : 'h-14';
  const pieceSize   = compact ? 'w-7 h-7' : 'w-10 h-10';

  return (
    <div className="relative">
      {hasSelection && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-400 uppercase tracking-widest whitespace-nowrap animate-pulse z-10">
          {placementHint || "Click a square to place"}
        </div>
      )}
      <div className={`${containerH} bg-slate-700/40 rounded-xl flex items-center px-2 gap-1 border border-white/10 overflow-x-auto custom-scrollbar`}>
        {bank?.map((p: string, i: number) => {
            const pieceCode = p.length === 1 ? `${playerColor}${p.toUpperCase()}` : p;
            const isWhitePiece = pieceCode[0] === 'w';
            const selected = isSelected(p);

            // White pieces need dark outline/shadow to show on dark bg; black pieces need light outline
            const pieceShadow: React.CSSProperties = {
              filter: isWhitePiece
                ? 'drop-shadow(0 0 1px #000) drop-shadow(0 1px 2px rgba(0,0,0,0.8))'
                : 'drop-shadow(0 0 1px rgba(255,255,255,0.6)) drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
            };

            return (
                <button
                    key={i}
                    onClick={() => {
                      if (selected) {
                        setSelectedPiece(null);
                      } else {
                        setSelectedPiece({char: p, board: boardIdx});
                      }
                    }}
                    className={`${pieceSize} flex-shrink-0 transition-all duration-150 rounded-md ${
                      selected
                        ? 'scale-110 ring-2 ring-emerald-400 bg-emerald-400/20 shadow-md shadow-emerald-400/20'
                        : 'hover:scale-105 active:scale-95 hover:bg-white/10'
                    }`}
                >
                    <img
                      src={getPieceUrl(pieceCode)}
                      alt={pieceCode}
                      className="w-full h-full object-contain"
                      style={pieceShadow}
                    />
                </button>
            );
        })}
        {(!bank || bank.length === 0) && (
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2">{emptyLabel || "Empty"}</div>
        )}
      </div>
    </div>
  );
};
