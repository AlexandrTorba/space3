"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { 
  DailyProvider, 
  useVideoTrack, 
  useAudioTrack, 
  useDaily, 
  useLocalParticipant, 
  useParticipantIds
} from "@daily-co/daily-react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Send, MessageSquare, UserPlus } from "lucide-react";

interface Props {
  matchId: string;
  role?: string;
  filterBoardIdx?: number;
  hideControls?: boolean;
  initialMicOn?: boolean;
  initialCamOn?: boolean;
}

function VideoTile({ id, isLocal = false }: { id: string; isLocal?: boolean }) {
  const videoTrack = useVideoTrack(id);
  const audioTrack = useAudioTrack(id);
  const videoElement = useRef<HTMLVideoElement>(null);
  const audioElement = useRef<HTMLAudioElement>(null);

  const isVideoOff = !videoTrack || videoTrack.state === "off" || videoTrack.state === "blocked";
  const isAudioOff = !audioTrack || audioTrack.state === "off" || audioTrack.state === "blocked";

  useEffect(() => {
    const track = videoTrack?.track;
    if (videoElement.current && track) {
      const currentStream = videoElement.current.srcObject as MediaStream;
      if (currentStream && currentStream.getTracks()[0] === track) return;
      videoElement.current.srcObject = new MediaStream([track]);
    }
  }, [videoTrack?.track]);

  useEffect(() => {
    const track = audioTrack?.track;
    if (audioElement.current && track && !isLocal) {
      const currentStream = audioElement.current.srcObject as MediaStream;
      if (currentStream && currentStream.getTracks()[0] === track) return;
      audioElement.current.srcObject = new MediaStream([track]);
    }
  }, [audioTrack?.track, isLocal]);

  return (
    <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
      {videoTrack?.track && !isVideoOff ? (
        <video
          ref={videoElement}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/50 gap-2">
           <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center border border-white/5">
              <User className="w-6 h-6 text-slate-500" />
           </div>
           <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Camera Off</span>
        </div>
      )}
      {!isLocal && <audio ref={audioElement} autoPlay />}
      
      <div className="absolute top-3 right-3 flex gap-1.5">
          {isAudioOff && (
            <div className="p-1.5 bg-red-500/20 backdrop-blur-md rounded-lg border border-red-500/20">
               <MicOff className="w-3 h-3 text-red-500" />
            </div>
          )}
          {isVideoOff && (
            <div className="p-1.5 bg-slate-800/50 backdrop-blur-md rounded-lg border border-white/5">
               <VideoOff className="w-3 h-3 text-slate-500" />
            </div>
          )}
      </div>

      <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] font-bold text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        {isLocal ? "YOU" : `Player ${id.substring(0,4)}`}
      </div>
    </div>
  );
}

function VideoChatUI({ filterBoardIdx, hideControls }: { filterBoardIdx?: number; hideControls?: boolean }) {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();
  const [messages, setMessages] = useState<{ id: string; text: string; name: string; isLocal: boolean }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isMicOn = !!localParticipant?.audio;
  const isCamOn = !!localParticipant?.video;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!daily) return;
    const handleAppMessage = (ev: any) => {
      const data = ev.data;
      if (data.type === "chat") {
         setMessages(prev => [...prev, { 
            id: Math.random().toString(), 
            text: data.text, 
            name: ev.fromId.substring(0, 4),
            isLocal: false 
         }]);
         if (!showChat) setHasUnread(true);
      }
    };
    daily.on("app-message", handleAppMessage);
    return () => { daily.off("app-message", handleAppMessage); };
  }, [daily, showChat]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!daily || !inputValue.trim()) return;
    const text = inputValue.trim().substring(0, 500);
    daily.sendAppMessage({ type: "chat", text }, "*");
    setMessages(prev => [...prev, { id: Math.random().toString(), text, name: "Me", isLocal: true }]);
    setInputValue("");
  };

  const toggleMic = useCallback(() => {
    if (!daily) return;
    daily.setLocalAudio(!isMicOn);
  }, [daily, isMicOn]);

  const toggleCam = useCallback(() => {
    if (!daily) return;
    daily.setLocalVideo(!isCamOn);
  }, [daily, isCamOn]);

  const leaveCall = useCallback(() => {
    if (!daily) return;
    try { daily.setLocalAudio(false); } catch(e) {}
    try { daily.setLocalVideo(false); } catch(e) {}
    daily.leave().then(() => {
       daily.destroy().catch(() => {});
    }).catch(() => {
       daily.destroy().catch(() => {});
    });
  }, [daily]);

  const toggleChat = () => {
     setShowChat(!showChat);
     if (!showChat) setHasUnread(false);
  };

  const filteredIds = React.useMemo(() => {
    if (filterBoardIdx === undefined || !daily) return participantIds;
    const allParticipants = daily.participants();
    return participantIds.filter(id => {
      const p = allParticipants[id];
      const encodedRole = p?.user_name || "";
      if (filterBoardIdx === 0) return encodedRole === 'w0' || encodedRole === 'b0';
      if (filterBoardIdx === 1) return encodedRole === 'w1' || encodedRole === 'b1';
      return true;
    });
  }, [participantIds, daily, filterBoardIdx]);

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-2xl overflow-hidden border border-white/5 shadow-inner">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        `}</style>
        <div className="flex h-full gap-3 overflow-x-auto pb-2 custom-scrollbar">
          {filteredIds.map(id => (
             <div key={id} className="min-w-[200px] flex-1 h-full">
                <VideoTile id={id} isLocal={id === localParticipant?.session_id} />
             </div>
          ))}
          {filteredIds.length === 0 && (
             <div className="flex-1 bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2 min-h-[120px]">
                <UserPlus className="w-8 h-8 opacity-20" />
                <span className="text-[10px] font-black uppercase tracking-widest italic">Waiting...</span>
             </div>
          )}
        </div>
        {showChat && (
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col h-48 shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.length === 0 && (
                 <div className="h-full flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">Say something...</div>
              )}
              {messages.map(m => (
                 <div key={m.id} className={`flex flex-col ${m.isLocal ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] break-words border ${m.isLocal ? 'bg-blue-600/20 border-blue-500/30 text-blue-100' : 'bg-white/5 border-white/10 text-slate-200'}`}>{m.text}</div>
                    <span className="text-[9px] font-black text-slate-600 uppercase mt-1 px-1">{m.isLocal ? "YOU" : `Player ${m.name}`}</span>
                 </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-2 bg-white/5 border-t border-white/10 flex gap-2">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Message..." className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 transition-all text-white placeholder:text-slate-600" />
              <button type="submit" className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50" disabled={!inputValue.trim()}><Send className="w-4 h-4" /></button>
            </form>
          </div>
        )}
      </div>
      {!hideControls && (
        <div className="flex items-center justify-center gap-4 py-3 bg-white/5 border-t border-white/5 controls-bar">
           <button onClick={toggleChat} className={`p-3 rounded-full transition-all border relative ${showChat ? 'bg-blue-500 text-white border-blue-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
             <MessageSquare className="w-5 h-5" />
             {hasUnread && !showChat && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse" />}
           </button>
           <button onClick={toggleMic} title={isMicOn ? "Mute" : "Unmute"} className={`p-3 rounded-full transition-all border ${isMicOn ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' : 'bg-red-500/20 border-red-500 text-red-500'}`}>{isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}</button>
           <button onClick={toggleCam} title={isCamOn ? "Stop Camera" : "Start Camera"} className={`p-3 rounded-full transition-all border ${isCamOn ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' : 'bg-red-500/20 border-red-500 text-red-500'}`}>{isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}</button>
           <button onClick={leaveCall} className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all shadow-lg shadow-red-600/20"><PhoneOff className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
}

export default function VideoChat({ matchId, role, filterBoardIdx, hideControls = false, initialMicOn = false, initialCamOn = false }: Props) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let call: DailyCall | null | undefined = null;
    let aborted = false;
    let createdNew = false;
    const init = async () => {
      setLoading(true);
      try {
        const isProd = typeof window !== "undefined" && window.location.protocol === "https:";
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? (isProd ? `${window.location.protocol}//${window.location.hostname}` : `${window.location.protocol}//${window.location.hostname}:8787`) : "http://localhost:8787");
        const res = await fetch(`${backendUrl}/api/video/token?matchId=${matchId}&role=${role || 'spectator'}`);
        if (!res.ok) {
           const errData = await res.json().catch(() => ({ error: `Status ${res.status}` }));
           throw new Error(errData?.details || errData?.error || `Error ${res.status}`);
        }
        const data = await res.json();
        if (aborted) return;
        if (!data.roomUrl) throw new Error("No room URL");

        const existingCall = DailyIframe.getCallInstance();
        if (existingCall) {
           call = existingCall;
        } else {
           call = DailyIframe.createCallObject({ url: data.roomUrl, token: data.token });
           call.on("camera-error", (ev: any) => { setErrorDetails(`Device error: ${ev.errorMsg || 'Permission denied'}`); });
           createdNew = true;
        }
        if (aborted) { if (call && createdNew) await call.destroy(); return; }
        setCallObject(call);
        await call.join();
        if (role && role !== 'spectator') { 
           await call.setLocalAudio(initialMicOn); 
           await call.setLocalVideo(initialCamOn); 
        }
      } catch (e: any) { setErrorDetails(e.message); } finally { if (!aborted) setLoading(false); }
    };
    init();
    return () => {
      aborted = true;
      // Stop all media tracks and leave the call on unmount
      const activeCall = call || DailyIframe.getCallInstance();
      if (activeCall) {
        try { activeCall.setLocalAudio(false); } catch(e) {}
        try { activeCall.setLocalVideo(false); } catch(e) {}
        activeCall.leave().then(() => {
          activeCall.destroy().catch(() => {});
        }).catch(() => {
          activeCall.destroy().catch(() => {});
        });
      }
    };
  }, [matchId, role]);

  if (errorDetails) return (
     <div className="flex flex-col items-center justify-center p-8 bg-red-500/5 border border-red-500/20 rounded-2xl h-full">
        <VideoOff className="w-8 h-8 text-red-500 mb-4 opacity-50" /><span className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Service Error</span><p className="text-[8px] font-mono text-red-400 uppercase opacity-70">{errorDetails}</p>
     </div>
  );
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full">
       <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin mb-4" /><span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Initializing Video...</span>
    </div>
  );

  return (
    <DailyProvider callObject={callObject!}>
      <VideoChatUI filterBoardIdx={filterBoardIdx} hideControls={hideControls} />
    </DailyProvider>
  );
}
