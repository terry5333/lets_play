'use client';

import { useState } from 'react';
import { ref, update, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function WaitingRoom({ user, roomId, roomData, isHost, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // 🃏 炸彈貓：發牌與遊戲初始化引擎
  const startGame = () => {
    const playerIds = Object.keys(roomData.players || {});
    if (playerIds.length < 2) return alert("至少需要 2 名玩家才能開始互相陷害！");

    const baseCards = [
      ...Array(4).fill('skip'),   
      ...Array(4).fill('attack'), 
      ...Array(5).fill('see'),    
      ...Array(4).fill('shuffle'),
      ...Array(4).fill('favor')   
    ];

    const shuffleArray = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    let shuffledBaseDeck = shuffleArray([...baseCards]);
    const initialHands = {};

    playerIds.forEach(uid => {
      initialHands[uid] = ['defuse']; 
      for (let i = 0; i < 4; i++) initialHands[uid].push(shuffledBaseDeck.pop());
    });

    const remainingDefuseCount = playerIds.length === 2 ? 2 : 6 - playerIds.length;
    const bombCount = playerIds.length - 1; 
    
    let finalDeck = [
      ...shuffledBaseDeck,
      ...Array(remainingDefuseCount).fill('defuse'),
      ...Array(bombCount).fill('bomb')
    ];
    finalDeck = shuffleArray(finalDeck);

    const gameState = {
      deck: finalDeck,
      discardPile: ['start'], 
      hands: initialHands,
      currentTurn: playerIds[0], 
      turnActionsCount: 1,       
      alivePlayers: playerIds,
      returnTurn: null           
    };

    const updates = {};
    updates[`rooms/${roomId}/info/status`] = 'playing';
    updates[`rooms/${roomId}/gameState`] = gameState;
    update(ref(database), updates);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: chatInput, timestamp: Date.now() });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#321c60] via-[#211142] to-[#120726] text-white flex flex-col font-sans relative overflow-hidden">
      <div className="flex justify-between items-center p-4 md:p-6 z-10">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10">
          <span className="mr-2 text-xl font-black">←</span>
          <span className="font-mono font-bold tracking-wider">{roomId}</span>
        </button>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2 rounded-full border border-purple-400/30 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
          <span className="font-black tracking-widest text-sm drop-shadow-md">等待房間</span>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10">⚙️</div>
        </div>
      </div>

      <div className="flex justify-center gap-4 md:gap-10 mt-6 z-10">
        {(roomData?.players ? Object.values(roomData.players) : []).filter(p => p.uid !== user?.uid).map(p => (
          <div key={p.uid} className="flex flex-col items-center">
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full border-[3px] border-indigo-400/50 p-1 bg-[#211142] shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              <img src={p.avatar} alt={p.name} className="w-full h-full object-cover rounded-full" />
            </div>
            <span className="mt-3 text-xs font-medium text-white/80 max-w-[80px] truncate">{p.name}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-in zoom-in duration-500">
        <h3 className="text-2xl font-black mb-8 text-white/60 tracking-widest">等待所有玩家入座...</h3>
        {isHost ? (
          <button onClick={startGame} className="bg-gradient-to-b from-emerald-400 to-emerald-600 px-12 py-5 rounded-[2rem] text-xl font-black shadow-[0_6px_0_#065f46,0_15px_20px_rgba(16,185,129,0.4)] active:shadow-[0_0px_0_#065f46] active:translate-y-1.5 transition-all text-white border-2 border-emerald-300">
            開始遊戲
          </button>
        ) : (
          <div className="px-8 py-4 bg-white/5 rounded-[2rem] border border-white/10 text-white/40 font-bold">等待房長開始...</div>
        )}
      </div>

      <div className="relative h-48 md:h-56 w-full flex justify-center items-end pb-8 z-10">
        <div className="absolute left-6 bottom-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full border-4 border-yellow-400 p-1 bg-[#211142] shadow-[0_0_20px_rgba(250,204,21,0.5)] z-20">
            <img src={user?.photoURL} alt="me" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="bg-purple-900/80 px-4 py-1 rounded-full text-xs font-bold mt-2 border border-purple-500/50">{user?.displayName}</div>
        </div>
        <button onClick={() => setIsChatOpen(!isChatOpen)} className="absolute right-6 bottom-8 w-14 h-14 bg-purple-600/80 rounded-full flex items-center justify-center text-2xl shadow-lg border border-purple-400/50 hover:bg-purple-500 transition-colors">💬</button>
      </div>

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
