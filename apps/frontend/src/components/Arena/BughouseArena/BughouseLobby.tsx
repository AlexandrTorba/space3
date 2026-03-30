import React from "react";
import { 
  Users, CheckCircle2, UserPlus, RotateCcw, Shield, Bot, Trash2, Edit3, Save, X, Plus, 
  Settings2, Play, Clock, Swords, CheckCircle
} from "lucide-react";

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
  updateTeamName: (team: "team0" | "team1", name: string) => void;
  fillBots: () => void;
  startMatch: () => void;
  spectators: {id: string, name: string}[];
  assignRole: (sessionId: string, role: string) => void;
  isAdmin: boolean;
}

export const BughouseLobby: React.FC<BughouseLobbyProps> = ({
  state, t, id, role, useRole, claimRole, toggleReady, addBot, removeBot, updateTeamName, fillBots, startMatch, spectators, assignRole, isAdmin
}) => {
  const team0Name = state?.lobby?.team0Name || "Team White";
  const team1Name = state?.lobby?.team1Name || "Team Black";
  const [editingTeam0, setEditingTeam0] = React.useState(team0Name);
  const [editingTeam1, setEditingTeam1] = React.useState(team1Name);

  React.useEffect(() => {
    setEditingTeam0(state?.lobby?.team0Name || "Team White");
    setEditingTeam1(state?.lobby?.team1Name || "Team Black");
  }, [state?.lobby?.team0Name, state?.lobby?.team1Name]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-500 overflow-y-auto">
      {!state ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white font-black tracking-widest text-xs uppercase">{t("bh_connecting")}</p>
        </div>
      ) : (
        <div className="max-w-5xl w-full bg-slate-900/50 border border-white/10 rounded-2xl md:rounded-[3rem] p-4 md:p-12 shadow-2xl relative overflow-hidden my-auto">
          <div className="text-center mb-4 md:mb-10">
             <div className="flex justify-center mb-3 md:mb-6">
                <div className="p-2.5 md:p-4 bg-white/10 rounded-full">
                   <Swords className="w-7 h-7 md:w-12 md:h-12 text-white" />
                </div>
             </div>
             <h2 className="text-xl md:text-4xl font-black uppercase tracking-tighter text-white">{t("bh_assemble_teams")}</h2>
             {isAdmin && <p className="text-blue-400 mt-1 font-black uppercase text-[10px] md:text-xs tracking-[0.2em]">{t("bh_admin_master") || "You are the Match Manager"}</p>}
          </div>

        <div className="grid grid-cols-2 gap-3 md:gap-8 mb-4 md:mb-12">
            {/* Team 0 */}
            <div className="space-y-2 md:space-y-4">
                {isAdmin ? (
                   <input 
                      className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-black text-blue-500 uppercase tracking-widest text-center focus:border-blue-500/50 outline-none"
                      value={editingTeam0}
                      onChange={(e) => setEditingTeam0(e.target.value)}
                      onBlur={() => updateTeamName("team0", editingTeam0)}
                      placeholder={t("bh_team0")}
                   />
                ) : (
                   <h3 className="text-xs md:text-sm font-black text-blue-500 uppercase tracking-widest text-center">{team0Name}</h3>
                )}
              {["w0", "b0"].map(r => {
                 const slot = (state?.lobby as any)?.[r];
                 if (!slot) return <div key={r} className="p-4 rounded-2xl border border-white/5 bg-white/5 animate-pulse h-[64px] md:h-[88px]" />;
                 return (
                    <div key={r} className={`group relative p-3 md:p-6 rounded-2xl md:rounded-3xl border transition-all duration-300 ${slot.isClaimed ? 'bg-white/5 border-white/10' : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50 cursor-pointer'}`} onClick={() => !slot.isClaimed && claimRole(r)}>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 md:gap-4">
                             <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-black shadow-lg text-sm md:text-base ${r.startsWith('w') ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
                                {r.slice(0,1).toUpperCase()}
                             </div>
                              <div>
                                 <div className="text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest">{r === 'w0' ? t('bh_board0_w') : t('bh_board0_b')}</div>
                                 <div className="text-sm md:text-lg font-bold text-white truncate max-w-[80px] md:max-w-none">{slot.isClaimed ? slot.playerName : t('bh_empty_slot')}</div>
                              </div>
                          </div>
                          <div className="flex items-center gap-1 md:gap-2">
                             {slot.isClaimed ? (
                                <>
                                   {slot.isReady ? <CheckCircle className="w-4 h-4 md:w-6 md:h-6 text-emerald-500" /> : <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-500 animate-pulse" />}
                                   {isAdmin && (
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); assignRole(slot.sessionId, "spectator"); }}
                                          className="p-1.5 md:p-2 bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-lg md:rounded-xl transition-all"
                                       >
                                          <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
                                       </button>
                                   )}
                                   {slot.isBot && isAdmin && <button onClick={(e) => { e.stopPropagation(); removeBot(r); }} className="text-[8px] md:text-[10px] font-black p-1.5 md:p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-all uppercase">Kick</button>}
                                </>
                             ) : (
                                isAdmin && (
                                    <button onClick={(e) => { e.stopPropagation(); addBot(r); }} className="p-1.5 md:p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg md:rounded-xl transition-all">
                                       <UserPlus className="w-3 h-3 md:w-4 md:h-4" />
                                    </button>
                                )
                             )}
                          </div>
                       </div>
                    </div>
                 );
              })}
            </div>

            {/* Team 1 */}
            <div className="space-y-2 md:space-y-4">
               {isAdmin ? (
                   <input 
                      className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-black text-emerald-500 uppercase tracking-widest text-center focus:border-emerald-500/50 outline-none"
                      value={editingTeam1}
                      onChange={(e) => setEditingTeam1(e.target.value)}
                      onBlur={() => updateTeamName("team1", editingTeam1)}
                      placeholder={t("bh_team1")}
                   />
                ) : (
                   <h3 className="text-xs md:text-sm font-black text-emerald-500 uppercase tracking-widest text-center">{team1Name}</h3>
                )}
              {["b1", "w1"].map(r => {
                 const slot = (state?.lobby as any)?.[r];
                 if (!slot) return <div key={r} className="p-4 rounded-2xl border border-white/5 bg-white/5 animate-pulse h-[64px] md:h-[88px]" />;
                 return (
                    <div key={r} className={`group relative p-3 md:p-6 rounded-2xl md:rounded-3xl border transition-all duration-300 ${slot.isClaimed ? 'bg-white/5 border-white/10' : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer'}`} onClick={() => !slot.isClaimed && claimRole(r)}>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 md:gap-4">
                             <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-black shadow-lg text-sm md:text-base ${r.startsWith('w') ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
                                {r.slice(0,1).toUpperCase()}
                             </div>
                              <div>
                                 <div className="text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest">{r === 'b1' ? t('bh_board1_b') : t('bh_board1_w')}</div>
                                 <div className="text-sm md:text-lg font-bold text-white truncate max-w-[80px] md:max-w-none">{slot.isClaimed ? slot.playerName : t('bh_empty_slot')}</div>
                              </div>
                          </div>
                          <div className="flex items-center gap-1 md:gap-2">
                             {slot.isClaimed ? (
                                <>
                                   {slot.isReady ? <CheckCircle className="w-4 h-4 md:w-6 md:h-6 text-emerald-500" /> : <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-500 animate-pulse" />}
                                   {isAdmin && (
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); assignRole(slot.sessionId, "spectator"); }}
                                          className="p-1.5 md:p-2 bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-lg md:rounded-xl transition-all"
                                       >
                                          <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
                                       </button>
                                   )}
                                </>
                             ) : (
                                isAdmin && (
                                   <button onClick={(e) => { e.stopPropagation(); addBot(r); }} className="p-1.5 md:p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg md:rounded-xl transition-all">
                                      <UserPlus className="w-3 h-3 md:w-4 md:h-4" />
                                   </button>
                                )
                             )}
                          </div>
                       </div>
                    </div>
                 );
              })}
            </div>
        </div>

        {/* Spectators and Admin Controls */}
        {isAdmin && spectators.length > 0 && (
           <div className="mb-12 p-8 bg-white/5 rounded-[2rem] border border-white/10">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <Users className="w-4 h-4" />
                 {t("bh_spectators") || "Available Spectators"} ({spectators.length})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {spectators.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-all">
                       <span className="text-sm font-bold text-white truncate max-w-[120px]">{s.name}</span>
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {["w0", "b0", "w1", "b1"].map(r => (
                             <button 
                                key={r}
                                onClick={() => assignRole(s.id, r)}
                                className="w-6 h-6 rounded-md bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white text-[8px] font-black transition-all flex items-center justify-center uppercase"
                                title={`Assign to ${r}`}
                             >
                                {r}
                             </button>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

          <div className="flex flex-col items-center gap-3 md:gap-6">
            {isAdmin && ![state.lobby.w0, state.lobby.b0, state.lobby.w1, state.lobby.b1].every(s => s?.isClaimed) && (
               <button 
                  onClick={fillBots}
                  className="w-full py-2.5 md:py-4 rounded-xl md:rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-black text-xs md:text-sm uppercase tracking-widest transition-all mb-1 flex items-center justify-center gap-2 border border-blue-500/30 active:scale-95"
               >
                  <Bot className="w-4 h-4" />
                  {t('bh_fill_bots') || "Fill Empty Slots with Bots"}
               </button>
            )}
            {isAdmin ? (
               <button 
                  onClick={startMatch}
                  disabled={![state.lobby.w0, state.lobby.b0, state.lobby.w1, state.lobby.b1].every(s => s?.isClaimed)}
                  className={`w-full py-3 md:py-6 rounded-2xl md:rounded-3xl font-black text-base md:text-xl tracking-widest transition-all duration-500 shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3 md:gap-4 ${
                     [state.lobby.w0, state.lobby.b0, state.lobby.w1, state.lobby.b1].every(s => s?.isClaimed)
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/40' 
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}
               >
                  <Play className="w-6 h-6 md:w-8 md:h-8" />
                  {t("bh_start_match") || "START MATCH"}
               </button>
            ) : (
               <div className="w-full py-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3">
                  <div className="flex items-center gap-3 text-amber-500 animate-pulse">
                     <Clock className="w-5 h-5" />
                     <span className="font-bold tracking-wider uppercase text-sm">{t("bh_waiting_admin") || "Waiting for Admin to start..."}</span>
                  </div>
               </div>
            )}

            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4">
               <span className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  {[state.lobby.w0, state.lobby.b0, state.lobby.w1, state.lobby.b1].filter(s => s?.isReady).length} / 4 {t("bh_ready")}
               </span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-blue-500/50">v. 2.5 | ID: {id}</span>
            </div>
        </div>
      </div>
      )}
    </div>
  );
};
