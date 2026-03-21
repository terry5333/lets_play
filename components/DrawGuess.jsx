'use client';

import { useState } from 'react';
import { ref, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function DrawGuess({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  
  const alivePlayers = Object.keys(roomData?.players || {});

  // 💬 聊天室發送
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), { 
      senderId: user.uid, 
      senderName: user.displayName, 
      avatar: user.photoURL || '', 
      text: chatInput.trim(), 
      timestamp: Date.now() 
    });
    setChatInput('');
  };

  // 🎨 外部白板 URL (使用開源的 WBO 白板，並綁定你的 roomId 確保隱私)
  const whiteboardUrl = `https://wbo.ophir.dev/boards/gamebar_vibe_${roomId}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-emerald-500/20">
      
      {/* 🌠 霓虹背景光暈 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse duration-[10s]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[100px] rounded-full animate-pulse duration-[8s]"></div>
      </div>

      {/* 頂部狀態列 */}
      <div className="flex justify-between items-center p-3 md:p-5 z-10 flex-shrink-0">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10 shadow-inner group">
          <span className="mr-2 text-xl font-black group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
        </button>
        
        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-2 rounded-full border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex flex-col items-center">
          <span className="font-extrabold tracking-widest text-xs drop-shadow-md text-white">
            🎨 派對塗鴉板：自由模式
          </span>
        </div>
        
        <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner cursor-not-allowed opacity-50">⚙️</div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-2 md:p-6 pb-6 z-10 overflow-hidden relative w-full max-w-[1920px] mx-auto">
        
        {/* 左側：外部白板區 (Iframe 嵌入) */}
        <div className="flex-[3] lg:flex-[4] xl:flex-[5] flex flex-col h-full gap-3 relative min-h-[55vh] md:min-h-[70vh]">
          <div className="flex-1 w-full bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            {/* 嵌入 WBO 開源白板 */}
            <iframe 
              src={whiteboardUrl} 
              className="w-full h-full border-none"
              title="External Whiteboard"
              allow="pointer-lock"
            />
          </div>
        </div>

        {/* 右側：玩家列表與聊天區 */}
        <div className="w-full lg:w-[260px] xl:w-[320px] bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl h-[400px] lg:h-auto z-10 relative">
          
          {/* 玩家列表 */}
          <div className="p-3 md:p-4 border-b border-white/5 bg-black/20 flex gap-2 overflow-x-auto scrollbar-hide">
            {alivePlayers.map((uid) => {
              const p = roomData.players[uid];
              return (
                <div key={uid} className={`flex flex-col items-center flex-shrink-0 transition-all relative`}>
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 overflow-hidden relative border-white/10`}>
                    <img src={p?.avatar} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-bold mt-1 text-white/80 truncate max-w-[50px]">{p?.name}</span>
                </div>
              );
            })}
          </div>

          {/* 聊天室 */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
            {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
              const isMe = m.senderId === user?.uid;
              const isSystem = m.senderId === 'system';
              
              if (isSystem) {
                return (
                  <div key={i} className="flex justify-center w-full">
                    <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] md:text-[11px] font-bold px-3 md:px-4 py-1 md:py-1.5 rounded-full">{m.text}</span>
                  </div>
                );
              }

              return (
                <div key={i} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/5 border border-white/10"><img src={m.avatar} className="w-full h-full object-cover" /></div>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                    {!isMe && <span className="text-[9px] md:text-[10px] text-white/40 ml-2 mb-0.5">{m.senderName}</span>}
                    <div className={`px-3 md:px-4 py-2 rounded-2xl text-xs md:text-[13px] ${isMe ? 'bg-emerald-600/80 border border-emerald-500/50 rounded-tr-none shadow-md' : 'bg-white/5 border border-white/5 rounded-tl-none'}`}>{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* 輸入框 */}
          <div className="p-3 md:p-4 border-t border-white/5 bg-black/20">
            <form onSubmit={handleSendMessage} className="relative">
              <input 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                placeholder="喊出你的答案..." 
                className="w-full bg-white/5 border border-white/10 rounded-full py-3 md:py-4 pl-4 pr-14 outline-none focus:border-emerald-500/50 text-xs md:text-sm placeholder:text-white/20 font-light" 
              />
              <button className="absolute right-1.5 top-1.5 bottom-1.5 px-3 md:px-4 bg-white/10 border border-white/20 rounded-full font-bold text-[10px] md:text-xs hover:bg-white/20 active:scale-95 transition-all">
                發送
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
