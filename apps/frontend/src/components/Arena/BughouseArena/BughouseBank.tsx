import React from "react";

interface BughouseBankProps {
  bank: string[];
  boardIdx: number;
  setSelectedPiece: (piece: {char: string, board: number} | null) => void;
  getPieceUrl: (piece: string) => string;
}

export const BughouseBank: React.FC<BughouseBankProps> = ({
  bank, boardIdx, setSelectedPiece, getPieceUrl
}) => {
  return (
    <div className="h-16 bg-white/5 rounded-2xl flex items-center px-4 gap-3 border border-white/5 overflow-x-auto custom-scrollbar">
        {bank?.map((p: string, i: number) => (
            <button 
                key={i} 
                onClick={() => setSelectedPiece({char: p, board: boardIdx})}
                className="w-10 h-10 flex-shrink-0 hover:scale-110 active:scale-95 transition-all duration-200"
            >
                <img src={getPieceUrl(p)} alt={p} className="w-full h-full object-contain drop-shadow-lg" />
            </button>
        ))}
        {(!bank || bank.length === 0) && (
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Empty Bank</div>
        )}
    </div>
  );
};
