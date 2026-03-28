import React from "react";
import { Swords, CheckCircle, CheckCircle2, RotateCcw, UserPlus, Users } from "lucide-react";

interface BughouseLobbyProps {
  state: any;
  t: (key: any) => string;
  id: string;
  role: string;
  useRole: string;
  claimRole: (r: string) => void;
  toggleReady: () => void;
  addBot: (r: string) => void;
  removeBot: (r: string) => void;
}

export const BughouseLobby: React.FC<BughouseLobbyProps> = ({
  state, t, id, role, useRole, claimRole, toggleReady, addBot, removeBot
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
      {!state ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6" />
            <p className="text-white font-black tracking-widest text-sm uppercase">{t("bh_connecting")}</p>
        </div>
      ) : (
        <div className="max-w-4xl w-full bg-slate-900/50 border border-white/10 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
          <div className="text-center mb-10">
             <div className="flex justify-center mb-6">
                <div className="p-4 bg-white/10 rounded-full">
                   <Swords className="w-12 h-12 text-white" />
                </div>
             </div>
             <h2 className="text-4xl font-black uppercase tracking-tighter text-white">{t("bh_assemble_teams")}</h2>
             <p className="text-slate-400 mt-2 font-medium">{t("bh_lobby_hint")}</p>
          </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
           {/* Team White */}
            <div className="space-y-4">
               <h3 className="text-sm font-black text-blue-500 uppercase tracking-widest text-center">{t("bh_team0")}</h3>
              {["w0", "b0"].map(r => {
                 const slot = state.lobby?.[r];
                 if (!slot) return <div key={r} className="p-6 rounded-3xl border border-white/5 bg-white/5 animate-pulse h-[88px]" />;
                 return (
                    <div key={r} className={`group relative p-6 rounded-3xl border transition-all duration-300 ${slot.isClaimed ? 'bg-white/5 border-white/10' : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50 cursor-pointer'}`} onClick={() => !slot.isClaimed && claimRole(r)}>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${r.startsWith('w') ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
                                {r.slice(0,1).toUpperCase()}
                             </div>
                              <div>
                                 <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{r === 'w0' ? t('bh_board0_w') : t('bh_board0_b')}</div>
                                 <div className="text-lg font-bold text-white">{slot.isClaimed ? slot.playerName : t('bh_empty_slot')}</div>
                              </div>
                          </div>
                          {slot.isClaimed ? (
                             <div className="flex items-center gap-2">
                                {slot.isReady ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />}
                                {slot.isBot && <button onClick={(e) => { e.stopPropagation(); removeBot(r); }} className="text-[10px] font-black p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-all uppercase">Kick Bot</button>}
                             </div>
                          ) : (
                             <button onClick={(e) => { e.stopPropagation(); addBot(r); }} className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/20 rounded-xl text-slate-500 hover:text-white transition-all group/bot">
                                <UserPlus className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest hidden group-hover/bot:block animate-in fade-in slide-in-from-right-1">{t("bh_add_bot")}</span>
                             </button>
                          )}
                       </div>
                       {slot.isClaimed && slot.sessionId === (state?.mySessionId || '') && (
                          <div className="absolute inset-0 border-2 border-blue-500 rounded-3xl pointer-events-none shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
                       )}
                    </div>
                 );
              })}
           </div>

           {/* Team Black */}
            <div className="space-y-4">
               <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest text-center">{t("bh_team1")}</h3>
              {["b1", "w1"].map(r => {
                 const slot = state.lobby?.[r];
                 if (!slot) return <div key={r} className="p-6 rounded-3xl border border-white/5 bg-white/5 animate-pulse h-[88px]" />;
                 return (
                    <div key={r} className={`group relative p-6 rounded-3xl border transition-all duration-300 ${slot.isClaimed ? 'bg-white/5 border-white/10' : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer'}`} onClick={() => !slot.isClaimed && claimRole(r)}>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${r.startsWith('w') ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
                                {r.slice(0,1).toUpperCase()}
                             </div>
                              <div>
                                 <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{r === 'b1' ? t('bh_board1_b') : t('bh_board1_w')}</div>
                                 <div className="text-lg font-bold text-white">{slot.isClaimed ? slot.playerName : t('bh_empty_slot')}</div>
                              </div>
                          </div>
                          {slot.isClaimed ? (
                             <div className="flex items-center gap-2">
                                {slot.isReady ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />}
                                {slot.isBot && <button onClick={(e) => { e.stopPropagation(); removeBot(r); }} className="text-[10px] font-black p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-all uppercase">Kick Bot</button>}
                             </div>
                          ) : (
                             <button onClick={(e) => { e.stopPropagation(); addBot(r); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all">
                                <UserPlus className="w-5 h-5" />
                             </button>
                          )}
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>

        <div className="flex flex-col items-center gap-6">
            {state.lobby?.[useRole]?.isClaimed ? (
               <button 
                  onClick={toggleReady}
                  className={`w-full py-6 rounded-3xl font-black text-xl tracking-widest transition-all duration-500 shadow-2xl active:scale-[0.98] flex items-center justify-center gap-4 ${
                     state.lobby?.[useRole]?.isReady 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' 
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/40'
                  }`}
               >
                  {state.lobby?.[useRole]?.isReady ? <RotateCcw className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
                  {state.lobby?.[useRole]?.isReady ? t("bh_cancel_ready") : t("bh_ready")}
               </button>
            ) : (
               <div className="w-full py-6 rounded-3xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-3">
                  <Users className="w-8 h-8 text-slate-600" />
                  <p className="text-amber-500 font-black tracking-widest uppercase text-xs animate-pulse">{t("bh_select_role_hint") || "Select a role to enable Ready button"}</p>
               </div>
            )}

            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4">
               <span className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  {Object.values(state.lobby || {}).filter((s:any) => s.isReady).length} / 4 {t("bh_ready")}
               </span>
               <span className="w-1 h-1 rounded-full bg-white/20" />
               <span className="text-blue-500/50">ID: {id}</span>
            </div>
        </div>
      </div>
      )}
    </div>
  );
};
