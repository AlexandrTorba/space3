"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import DailyIframe, { DailyCall, DailyEventObjectNoPayload } from "@daily-co/daily-js";
import { 
  DailyProvider, 
  useVideoTrack, 
  useAudioTrack, 
  useDaily, 
  useLocalParticipant, 
  useParticipantIds 
} from "@daily-co/daily-react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Send, MessageSquare } from "lucide-react";

interface Props {
  matchId: string;
}

function VideoTile({ id, isLocal = false }: { id: string; isLocal?: boolean }) {
  const videoTrack = useVideoTrack(id);
  const audioTrack = useAudioTrack(id);
  const videoElement = useRef<HTMLVideoElement>(null);
  const audioElement = useRef<HTMLAudioElement>(null);

  const isVideoOff = !videoTrack || videoTrack.state === "off" || videoTrack.state === "blocked";
  const isAudioOff = !audioTrack || audioTrack.state === "off" || audioTrack.state === "blocked";

  useEffect(() => {
    if (videoElement.current && videoTrack?.track) {
      videoElement.current.srcObject = new MediaStream([videoTrack.track]);
    }
  }, [videoTrack]);

  useEffect(() => {
    if (audioElement.current && audioTrack?.track && !isLocal) {
      audioElement.current.srcObject = new MediaStream([audioTrack.track]);
    }
  }, [audioTrack, isLocal]);

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
      
      {/* Status Overlay */}
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

function VideoChatUI() {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [messages, setMessages] = useState<{ id: string; text: string; name: string; isLocal: boolean }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    return () => {
      daily.off("app-message", handleAppMessage);
    };
  }, [daily]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!daily || !inputValue.trim()) return;

    const text = inputValue.trim().substring(0, 500); // SECURITY: Length limit
    daily.sendAppMessage({ type: "chat", text }, "*");
    
    setMessages(prev => [...prev, { 
       id: Math.random().toString(), 
       text, 
       name: "Me", 
       isLocal: true 
    }]);
    setInputValue("");
  };

  const toggleMic = () => {
    if (!daily) return;
    const next = !isMicOn;
    daily.setLocalAudio(next);
    setIsMicOn(next);
  };

  const toggleCam = () => {
    if (!daily) return;
    const next = !isCamOn;
    daily.setLocalVideo(next);
    setIsCamOn(next);
  };

  const leaveCall = () => {
    if (!daily) return;
    daily.leave();
  };

   const toggleChat = () => {
      setShowChat(!showChat);
      if (!showChat) setHasUnread(false);
   };

   return (
    <div className="flex flex-col gap-4">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <div className="grid grid-cols-2 gap-3">
        {participantIds.map(id => (
           <VideoTile key={id} id={id} isLocal={id === localParticipant?.session_id} />
        ))}
        {participantIds.length === 0 && (
           <div className="col-span-2 aspect-video bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2">
              <Video className="w-8 h-8 opacity-20" />
              <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Players...</span>
           </div>
        )}
      </div>

      {showChat && (
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col h-48 shadow-2xl animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {messages.length === 0 && (
               <div className="h-full flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">
                  Say something...
               </div>
            )}
            {messages.map(m => (
               <div key={m.id} className={`flex flex-col ${m.isLocal ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] break-words border ${m.isLocal ? 'bg-blue-600/20 border-blue-500/30 text-blue-100' : 'bg-white/5 border-white/10 text-slate-200'}`}>
                    {m.text}
                  </div>
                  <span className="text-[9px] font-black text-slate-600 uppercase mt-1 px-1">
                    {m.isLocal ? "YOU" : `Player ${m.name}`}
                  </span>
               </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} className="p-2 bg-white/5 border-t border-white/10 flex gap-2">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message..."
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 transition-all text-white placeholder:text-slate-600"
            />
            <button type="submit" className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50" disabled={!inputValue.trim()}>
               <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 py-2">
         <button 
           onClick={toggleChat}
           className={`p-3 rounded-full transition-all border relative ${showChat ? 'bg-blue-500 text-white border-blue-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
         >
           <MessageSquare className="w-5 h-5" />
           {hasUnread && !showChat && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse" />
           )}
         </button>
         <button 
           onClick={toggleMic}
           className={`p-3 rounded-full transition-all border ${isMicOn ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' : 'bg-red-500/20 border-red-500 text-red-500'}`}
         >
           {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
         </button>
         <button 
           onClick={toggleCam}
           className={`p-3 rounded-full transition-all border ${isCamOn ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10' : 'bg-red-500/20 border-red-500 text-red-500'}`}
         >
           {isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
         </button>
         <button 
           onClick={leaveCall}
           className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all shadow-lg shadow-red-600/20"
         >
           <PhoneOff className="w-5 h-5" />
         </button>
      </div>
    </div>
  );
}

export default function VideoChat({ matchId }: Props) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [loading, setLoading] = useState(true);
  const initializingRef = useRef(false);

  useEffect(() => {
    let call: DailyCall | null | undefined = null;
    let aborted = false;

    const init = async () => {
      setLoading(true);
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (window.location.protocol + "//" + window.location.hostname + ":8787");
        const res = await fetch(`${backendUrl}/api/video/token?matchId=${matchId}`);
        const data = await res.json();
        
        if (aborted) return;
        if (!data.roomUrl) throw new Error("No room URL");

        // Use existing instance if available, otherwise create new
        const existingCall = DailyIframe.getCallInstance();
        if (existingCall) {
           call = existingCall;
        } else {
           call = DailyIframe.createCallObject({ 
             url: data.roomUrl,
             token: data.token
           });
        }
        
        if (aborted) {
          if (call && !existingCall) await call.destroy();
          return;
        }

        setCallObject(call);
        
        await call.join();
        await call.setLocalVideo(false);
        await call.setLocalAudio(false);
      } catch (e) {
        console.error("Daily init error details:", e);
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    init();

    return () => {
      aborted = true;
      if (call) {
        call.destroy();
        setCallObject(null);
      }
    };
  }, [matchId]);

  if (loading) return (
     <div className="p-8 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Initializing Video...</span>
     </div>
  );

  if (!callObject) return (
    <div className="p-8 text-center text-red-400 text-[10px] font-black uppercase tracking-widest border border-red-500/20 rounded-2xl bg-red-500/5">
       Video service unavailable
    </div>
  );

  return (
    <DailyProvider callObject={callObject}>
      <VideoChatUI />
    </DailyProvider>
  );
}
