'use client';

import { useState } from 'react';
import { ref, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function BoomCat({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: chatInput, timestamp: Date.now() });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#321c60] via-[#211142] to-[#120726] text-white flex flex-col font-sans relative overflow-hidden">
      {/* 頂部狀態列 */}
      <div className="flex justify-between items-center p-4 md:p-6 z-10">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10">
          <span className="mr-2 text-xl font-black">←</span>
          <span className="font-mono font-bold tracking-wider">{roomId}</span>
        </button>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2 rounded-full border border-purple-400/30 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
          <span className="font-black tracking-widest text-sm drop-shadow-md">炸彈貓初級場</span>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10">⚙️</div>
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10">❓</div>
        </div>
      </div>

      {/* 頂部對手列表 */}
      <div className="flex justify-center gap-4 md:gap-10 mt-6 z-10">
        {(roomData?.players ? Object.values(roomData.players) : []).filter(p => p.uid !== user?.uid).map(p => (
          <div key={p.uid} className="flex flex-col items-center">
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border-[3px] border-indigo-400/50 p-1 bg-[#211142] shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              <img src={p.avatar} alt={p.name} className="w-full h-full object-cover rounded-full" />
              <div className="absolute -bottom-2 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20">3</div>
            </div>
            <span className="mt-3 text-xs font-medium text-white/80 max-w-[80px] truncate">{p.name}</span>
          </div>
        ))}
      </div>

      {/* 中央戰場 */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex gap-6 md:gap-12 mb-10">
          <div className="relative">
            <div className="absolute -left-12 top-6 bg-white rounded-full p-2 shadow-xl border-4 border-slate-200 z-20 flex flex-col items-center transform -rotate-12">
              <span className="text-rose-500 font-black text-xs">17%</span>
              <div className="text-xl">💣</div>
            </div>
            <div className="w-32 h-44 md:w-40 md:h-56 bg-gradient-to-b from-orange-100 to-orange-300 rounded-[2rem] border-4 border-orange-400 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_-5px_0_rgba(251,146,60,0.5)] flex flex-col items-center justify-center p-4">
              <div className="text-5xl md:text-6xl mb-2 drop-shadow-md">💣</div>
              <span className="text-orange-900 font-black text-lg">剩6張</span>
            </div>
          </div>
          <div className="w-32 h-44 md:w-40 md:h-56 bg-white rounded-[2rem] border-4 border-slate-200 shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex flex-col items-center justify-start p-4 relative overflow-hidden">
            <div className="absolute top-3 left-3 flex items-center gap-1 text-orange-500 font-black text-sm"><span>⚡</span>甩鍋</div>
            <div className="text-6xl md:text-7xl mt-8 drop-shadow-xl">🍳</div>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="bg-gradient-to-b from-yellow-300 to-yellow-500 px-8 py-3 rounded-[1.5rem] font-black text-yellow-900 shadow-[0_5px_0_#a16207] active:shadow-none active:translate-y-1 transition-all border-2 border-yellow-200">摸牌</button>
          <button className="bg-gradient-to-b from-emerald-300 to-emerald-500 px-8 py-3 rounded-[1.5rem] font-black text-emerald-900 shadow-[0_5px_0_#065f46] active:shadow-none active:translate-y-1 transition-all border-2 border-emerald-200">出牌</button>
        </div>
      </div>

      {/* 底部視角 */}
      <div className="relative h-48 md:h-56 w-full flex justify-center items-end pb-8 z-10">
        <div className="absolute left-6 bottom-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full border-4 border-yellow-400 p-1 bg-[#211142] shadow-[0_0_20px_rgba(250,204,21,0.5)] z-20">
            <img src={user?.photoURL} alt="me" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="bg-purple-900/80 px-4 py-1 rounded-full text-xs font-bold mt-2 border border-purple-500/50">{user?.displayName}</div>
        </div>
        
        {/* 手牌 */}
        <div className="flex gap-2">
          <div className="w-24 h-36 bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-2xl border-[3px] border-cyan-300 shadow-2xl flex flex-col items-center p-2 transform -rotate-6 hover:-translate-y-4 hover:rotate-0 transition-all cursor-pointer">
            <div className="w-full flex text-cyan-700 font-bold text-xs"><span className="bg-cyan-500 text-white rounded px-1 text-[10px] mr-1">■</span>交換</div>
            <div className="text-4xl mt-4">🔀</div>
          </div>
          <div className="w-24 h-36 bg-gradient-to-b from-rose-50 to-rose-100 rounded-2xl border-[3px] border-rose-300 shadow-2xl flex flex-col items-center p-2 transform hover:-translate-y-4 transition-all cursor-pointer">
            <div className="w-full flex text-rose-700 font-bold text-xs"><span className="bg-rose-500 text-white rounded px-1 text-[10px] mr-1">■</span>攻擊</div>
            <div className="text-4xl mt-4">⚔️</div>
          </div>
        </div>

        <button onClick={() => setIsChatOpen(!isChatOpen)} className="absolute right-6 bottom-8 w-14 h-14 bg-purple-600/80 rounded-full flex items-center justify-center text-2xl shadow-lg border border-purple-400/50 hover:bg-purple-500 transition-colors">💬</button>
      </div>

      {/* 聊天室 */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-[#120726]/95 backdrop-blur-3xl shadow-2xl border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${isChatOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 flex justify-between items-center border-b border-white/10">
          <h3 className="font-bold tracking-widest uppercase">Room Chat</h3>
          <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
            const isMe = m.senderId === user?.uid;
            return (
              <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/5 border border-white/10"><img src={m.avatar} className="w-full h-full object-cover" /></div>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  {!isMe && <span className="text-[10px] text-white/40 ml-2 mb-1">{m.senderName}</span>}
                  <div className={`px-4 py-2.5 rounded-2xl text-[13px] ${isMe ? 'bg-indigo-600 rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-white/10">
          <form onSubmit={handleSendMessage} className="relative">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Send a message..." className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-6 pr-16 outline-none focus:border-indigo-500/50 text-sm" />
            <button className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 rounded-full font-bold text-xs hover:bg-indigo-500">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
