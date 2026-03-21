'use client';

import { useState } from 'react';
import { ref, push, update } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

// 卡牌視覺設定字典
const CARD_DIC = {
  defuse: { icon: '🔧', name: '拆除', color: 'from-emerald-50 to-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700' },
  skip: { icon: '⏭️', name: '跳過', color: 'from-blue-50 to-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
  attack: { icon: '⚔️', name: '攻擊', color: 'from-rose-50 to-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
  see: { icon: '👁️', name: '預言', color: 'from-purple-50 to-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
  shuffle: { icon: '🔀', name: '洗牌', color: 'from-cyan-50 to-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700' },
  favor: { icon: '🤲', name: '索要', color: 'from-amber-50 to-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
  bomb: { icon: '💣', name: '炸彈貓', color: 'from-neutral-800 to-black', border: 'border-rose-500', text: 'text-rose-500' }
};

export default function BoomCat({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const gameState = roomData?.gameState;
  if (!gameState) return <div className="min-h-screen bg-black text-white flex items-center justify-center">載入戰局中...</div>;

  const myHand = gameState.hands?.[user.uid] || [];
  const isMyTurn = gameState.currentTurn === user.uid;
  const deckCount = gameState.deck ? gameState.deck.length : 0;
  const lastDiscard = gameState.discardPile?.[gameState.discardPile.length - 1];

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: chatInput, timestamp: Date.now() });
    setChatInput('');
  };

  // 摸牌動作 (下一個步驟我們再來寫完整的邏輯，先讓按鈕有反應)
  const drawCard = () => {
    if (!isMyTurn) return alert("還沒輪到你！");
    alert("摸牌邏輯即將實裝，準備迎接炸彈吧！");
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
          <span className="font-black tracking-widest text-sm drop-shadow-md">炸彈貓激戰中</span>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10">⚙️</div>
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10">❓</div>
        </div>
      </div>

      {/* 頂部對手列表 (動態計算對手剩餘手牌) */}
      <div className="flex justify-center gap-4 md:gap-10 mt-2 z-10">
        {gameState.alivePlayers?.filter(uid => uid !== user.uid).map(uid => {
          const p = roomData.players[uid];
          const handCount = gameState.hands?.[uid]?.length || 0;
          const isOpponentTurn = gameState.currentTurn === uid;
          return (
            <div key={uid} className={`flex flex-col items-center transition-all ${isOpponentTurn ? 'scale-110' : 'opacity-80'}`}>
              <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-[3px] p-1 bg-[#211142] shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isOpponentTurn ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]' : 'border-indigo-400/50'}`}>
                <img src={p?.avatar} alt={p?.name} className="w-full h-full object-cover rounded-full" />
                <div className="absolute -bottom-2 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                  {handCount}
                </div>
              </div>
              <span className="mt-3 text-xs font-medium text-white/90 max-w-[80px] truncate">{p?.name}</span>
              {isOpponentTurn && <span className="text-[10px] text-yellow-400 font-bold mt-1 animate-pulse">思考中...</span>}
            </div>
          );
        })}
      </div>

      {/* 中央戰場 */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-in fade-in zoom-in duration-500">
        
        {/* 提示字眼 */}
        <div className="mb-6 h-8">
          {isMyTurn && <h2 className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] animate-pulse">輪到你出牌或摸牌！</h2>}
        </div>

        <div className="flex gap-6 md:gap-12 mb-10">
          <div className="relative">
            {/* 動態計算爆炸機率 (炸彈數/總牌數) */}
            <div className="absolute -left-12 top-6 bg-white rounded-full p-2 shadow-xl border-4 border-slate-200 z-20 flex flex-col items-center transform -rotate-12">
              <span className="text-rose-500 font-black text-[10px] whitespace-nowrap">危機率</span>
              <span className="text-rose-600 font-black text-sm">{Math.round(((gameState.alivePlayers.length - 1) / (deckCount || 1)) * 100)}%</span>
            </div>
            <div className="w-32 h-44 md:w-40 md:h-56 bg-gradient-to-b from-orange-100 to-orange-300 rounded-[2rem] border-4 border-orange-400 shadow-[0_10px_20px_rgba(0,0,0,0.5),inset_0_-5px_0_rgba(251,146,60,0.5)] flex flex-col items-center justify-center p-4">
              <div className="text-5xl md:text-6xl mb-2 drop-shadow-md">💣</div>
              <span className="text-orange-900 font-black text-lg">剩 {deckCount} 張</span>
            </div>
          </div>
          
          <div className="w-32 h-44 md:w-40 md:h-56 bg-white/90 backdrop-blur-sm rounded-[2rem] border-4 border-slate-200 shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center p-4 relative overflow-hidden">
             {lastDiscard && lastDiscard !== 'start' ? (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-1 font-black text-sm text-slate-800">
                    <span>{CARD_DIC[lastDiscard]?.icon}</span>{CARD_DIC[lastDiscard]?.name}
                  </div>
                  <div className="text-6xl md:text-7xl mt-4 drop-shadow-xl">{CARD_DIC[lastDiscard]?.icon}</div>
                </>
             ) : (
                <div className="text-slate-400 font-bold text-sm">棄牌堆</div>
             )}
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={drawCard} disabled={!isMyTurn} className={`bg-gradient-to-b from-yellow-300 to-yellow-500 px-10 py-4 rounded-[1.5rem] font-black text-yellow-900 border-2 border-yellow-200 transition-all ${isMyTurn ? 'shadow-[0_5px_0_#a16207] active:shadow-none active:translate-y-1 hover:scale-105' : 'opacity-50 cursor-not-allowed grayscale'}`}>
            摸牌結束
          </button>
        </div>
      </div>

      {/* 底部視角與我的手牌 */}
      <div className="relative h-56 md:h-64 w-full flex justify-center items-end pb-8 z-10">
        <div className="absolute left-6 bottom-8 flex flex-col items-center">
          <div className={`w-20 h-20 rounded-full border-4 p-1 bg-[#211142] z-20 transition-all ${isMyTurn ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-110' : 'border-indigo-400/50'}`}>
            <img src={user?.photoURL} alt="me" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="bg-purple-900/80 px-4 py-1 rounded-full text-xs font-bold mt-2 border border-purple-500/50">我 ({myHand.length})</div>
        </div>
        
        {/* 動態渲染手牌 */}
        <div className="flex gap-[-10px] md:gap-1 px-24 overflow-x-auto w-full justify-center max-w-4xl scrollbar-hide pb-4">
          {myHand.map((cardId, idx) => {
            const card = CARD_DIC[cardId];
            return (
              <div key={idx} 
                className={`w-24 h-36 flex-shrink-0 bg-gradient-to-b ${card.color} rounded-2xl border-[3px] ${card.border} shadow-2xl flex flex-col items-center p-2 transform transition-all cursor-pointer hover:-translate-y-6 hover:z-30 relative`}
                style={{ marginLeft: idx !== 0 ? '-20px' : '0' }} // 讓卡牌像扇形一樣重疊
              >
                <div className={`w-full flex font-bold text-xs ${card.text}`}><span className="bg-black/10 rounded px-1 text-[10px] mr-1">■</span>{card.name}</div>
                <div className="text-4xl mt-4 drop-shadow-md">{card.icon}</div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setIsChatOpen(!isChatOpen)} className="absolute right-6 bottom-8 w-14 h-14 bg-purple-600/80 rounded-full flex items-center justify-center text-2xl shadow-lg border border-purple-400/50 hover:bg-purple-500 transition-colors z-20">💬</button>
      </div>

      {/* 側邊聊天室保持不變... */}
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
