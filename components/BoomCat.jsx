'use client';

import { useState } from 'react';
import { ref, push, update } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

// 💎 高級卡牌視覺字典 (全新升級：霓虹立體風)
// 包含漸層、邊框、光暈、Emoji、名稱與簡短敘述
const CARD_DIC = {
  defuse: { 
    icon: '🔧', name: '拆除卡', 
    theme: 'emerald', // 使用的主色調
    grad: 'from-[#065f46] via-[#10b981] to-[#059669]', // 卡面漸層
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.5)]', // 霓虹光暈
    desc: '避免被炸死，並重置炸彈位置。' 
  },
  skip: { 
    icon: '⏭️', name: '跳過卡', 
    theme: 'blue',
    grad: 'from-[#1e3a8a] via-[#3b82f6] to-[#2563eb]',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.5)]',
    desc: '不抽牌直接結束回合。' 
  },
  attack: { 
    icon: '⚔️', name: '攻擊卡', 
    theme: 'rose',
    grad: 'from-[#881337] via-[#ef4444] to-[#e11d48]',
    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.5)]',
    desc: '強制下一位玩家連續進行兩回合。' 
  },
  see: { 
    icon: '👁️', name: '預言卡', 
    theme: 'purple',
    grad: 'from-[#4c1d95] via-[#8b5cf6] to-[#7c3aed]',
    glow: 'shadow-[0_0_30px_rgba(139,92,246,0.5)]',
    desc: '偷看牌堆頂端的三張牌。' 
  },
  shuffle: { 
    icon: '🔀', name: '洗牌卡', 
    theme: 'cyan',
    grad: 'from-[#164e63] via-[#06b6d4] to-[#0891b2]',
    glow: 'shadow-[0_0_30px_rgba(6,182,212,0.5)]',
    desc: '將牌堆洗勻。' 
  },
  favor: { 
    icon: '🤲', name: '索要卡', 
    theme: 'amber',
    grad: 'from-[#78350f] via-[#f59e0b] to-[#d97706]',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.5)]',
    desc: '強制對手給予一張卡牌。' 
  },
  bomb: { 
    icon: '🐈‍⬛💣', name: '炸彈貓', 
    theme: 'neutral',
    grad: 'from-[#171717] via-[#404040] to-[#262626]',
    glow: 'shadow-[0_0_40px_rgba(239,68,68,0.7)]',
    desc: '無拆除卡即淘汰。' 
  }
};

// 💎 卡牌元件 (獨立出來方便管理懸停效果)
const PlayingCard = ({ cardId, isMyTurn, idx }) => {
  const card = CARD_DIC[cardId];
  if (!card) return null;

  const isBomb = cardId === 'bomb';

  return (
    <div 
      className={`
        relative w-28 h-44 md:w-32 md:h-52 flex-shrink-0 
        rounded-3xl p-3 flex flex-col items-center justify-between
        transition-all duration-300 ease-out cursor-pointer group
        bg-gradient-to-br ${card.grad} ${card.glow}
        border-t-2 border-l-2 border-white/20
        hover:-translate-y-12 hover:rotate-0 hover:z-50 hover:scale-110
        ${isMyTurn ? 'opacity-100' : 'opacity-80'}
      `}
      style={{ 
        marginLeft: idx !== 0 ? '-30px' : '0', // 稍微增加重疊度
        transform: `rotate(${ (idx - 2) * 3 }deg)`, // 扇形排列
        backfaceVisibility: 'hidden' // 防鋸齒
      }}
    >
      {/* 卡牌立體光影塗層 (Inner Shadow) */}
      <div className="absolute inset-2 rounded-2xl border border-black/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.3)] pointer-events-none"></div>
      
      {/* 霓虹邊框 */}
      <div className={`absolute inset-0 rounded-3xl border-2 border-${card.theme}-300 opacity-40 group-hover:opacity-100 transition-opacity`}></div>

      {/* 卡牌頭部 */}
      <div className="w-full flex items-center justify-between z-10 relative">
        <span className={`bg-white/10 ${card.text} rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider`}>■ {card.name}</span>
        <span className="text-sm">{card.icon.replace('🐈‍⬛', '')}</span> {/* 縮小版的 Icon */}
      </div>

      {/* 卡牌中央 Art (Emoji 升級為立體大圖) */}
      <div className={`text-6xl md:text-7xl z-10 relative drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] ${isBomb ? 'animate-pulse' : ''}`}>
        {card.icon}
      </div>

      {/* 卡牌底部敘述 (懸停時顯示) */}
      <div className="w-full bg-black/40 backdrop-blur-sm p-2 rounded-xl border border-white/10 z-10 relative opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-[8px] leading-tight text-white/80 font-medium">{card.desc}</p>
      </div>

      {/* 卡牌高光紋理 */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAAF4tNKAAAABJQTFRFfX19fX19fX19fX19fX19fX19fX19AAAAAAAABJRU5ErkJggg==')] opacity-[0.03] rounded-3xl pointer-events-none"></div>
    </div>
  );
};

export default function BoomCat({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const gameState = roomData?.gameState;
  if (!gameState) return (
    <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center font-mono tracking-widest text-sm relative">
       <div className="animate-pulse">LOADING VIBE...</div>
    </div>
  );

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

  const drawCard = () => {
    if (!isMyTurn) return alert("還沒輪到你！");
    alert("摸牌邏輯即將實裝...");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#321c60] via-[#211142] to-[#120726] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-rose-500/20">
      
      {/* 🌠 背景動態光暈 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#070709]">
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse duration-[12s]"></div>
        <div className="absolute bottom-[20%] left-[10%] w-[30%] h-[30%] bg-rose-600/10 blur-[100px] rounded-full animate-pulse duration-[8s]"></div>
      </div>

      {/* 頂部狀態列 */}
      <div className="flex justify-between items-center p-4 md:p-6 z-10">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10 shadow-inner group">
          <span className="mr-2 text-xl font-black group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
        </button>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-2 rounded-full border border-purple-400/30 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
          <span className="font-extrabold tracking-widest text-xs drop-shadow-md">炸彈貓咪：激戰中</span>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors shadow-inner cursor-pointer">⚙️</div>
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors shadow-inner cursor-pointer">❓</div>
        </div>
      </div>

      {/* 頂部對手列表 */}
      <div className="flex justify-center gap-6 md:gap-12 mt-2 z-10 px-4">
        {gameState.alivePlayers?.filter(uid => uid !== user.uid).map(uid => {
          const p = roomData.players[uid];
          const handCount = gameState.hands?.[uid]?.length || 0;
          const isOpponentTurn = gameState.currentTurn === uid;
          return (
            <div key={uid} className={`flex flex-col items-center transition-all duration-300 ${isOpponentTurn ? 'scale-105' : 'opacity-70'}`}>
              <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-[4px] p-1 bg-[#211142] shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-colors ${isOpponentTurn ? 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)]' : 'border-indigo-400/50'}`}>
                <img src={p?.avatar} alt={p?.name} className="w-full h-full object-cover rounded-full" />
                <div className="absolute -bottom-2 -right-1 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-[11px] font-black px-2.5 py-1 rounded-full border-2 border-[#211142] shadow-lg">
                  {handCount}
                </div>
              </div>
              <span className="mt-3 text-xs font-bold text-white/90 max-w-[90px] truncate drop-shadow-md">{p?.name}</span>
              {isOpponentTurn && <span className="text-[10px] text-yellow-400 font-bold mt-1.5 animate-pulse tracking-wide">思考中...</span>}
            </div>
          );
        })}
      </div>

      {/* 中央戰場 */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-in fade-in zoom-in duration-500 px-4">
        
        {/* 提示字眼 */}
        <div className="mb-6 h-10">
          {isMyTurn && <h2 className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse tracking-wide">輪到你出牌或摸牌！</h2>}
        </div>

        <div className="flex gap-8 md:gap-16 mb-12">
          {/* 牌堆 */}
          <div className="relative group cursor-pointer" onClick={drawCard}>
            {/* 機率儀表板 (升級外觀) */}
            <div className="absolute -left-12 top-6 bg-white rounded-full p-2 shadow-[0_10px_20px_rgba(0,0,0,0.3)] border-4 border-slate-100 z-20 flex flex-col items-center transform -rotate-12 group-hover:rotate-0 transition-transform">
              <span className="text-rose-500 font-extrabold text-[11px] whitespace-nowrap">爆炸率</span>
              <span className="text-rose-600 font-black text-lg font-mono">{Math.round(((gameState.alivePlayers.length - 1) / (deckCount || 1)) * 100)}%</span>
            </div>
            {/* 牌堆卡片 (立體漸層) */}
            <div className={`w-36 h-48 md:w-44 md:h-60 bg-gradient-to-br from-orange-50 via-orange-200 to-orange-400 rounded-[2.5rem] border-4 border-orange-300 shadow-[0_15px_30px_rgba(0,0,0,0.6),inset_0_-5px_15px_rgba(251,146,60,0.4)] flex flex-col items-center justify-center p-4 transition-all ${isMyTurn ? 'hover:scale-105' : ''}`}>
              <div className="text-6xl md:text-7xl mb-3 drop-shadow-[0_5px_10px_rgba(0,0,0,0.3)]">🐈‍⬛💣</div>
              <span className="text-orange-950 font-black text-xl tracking-wider">剩 {deckCount} 張</span>
              {isMyTurn && <div className="absolute inset-0 rounded-[2.5rem] border-4 border-yellow-300 animate-pulse"></div>}
            </div>
          </div>
          
          {/* 棄牌堆 */}
          <div className="w-36 h-48 md:w-44 md:h-60 bg-white/5 backdrop-blur-sm rounded-[2.5rem] border-4 border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.4),inset_0_-5px_15px_rgba(255,255,255,0.05)] flex flex-col items-center justify-center p-4 relative overflow-hidden group">
             {lastDiscard && lastDiscard !== 'start' ? (
                <>
                  <div className="absolute top-4 left-5 flex items-center gap-1.5 font-extrabold text-sm text-white/60">
                    <span>{CARD_DIC[lastDiscard]?.icon}</span>{CARD_DIC[lastDiscard]?.name}
                  </div>
                  <div className="text-7xl md:text-8xl mt-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform">{CARD_DIC[lastDiscard]?.icon}</div>
                </>
             ) : (
                <div className="text-white/20 font-bold text-sm tracking-widest uppercase">棄牌堆</div>
             )}
          </div>
        </div>

        {/* 摸牌結束按鈕 (原本的按鈕樣式) */}
        <div className="flex gap-4">
          <button onClick={drawCard} disabled={!isMyTurn} className={`bg-gradient-to-b from-yellow-300 to-yellow-500 px-10 py-4 rounded-[1.5rem] font-black text-yellow-900 border-2 border-yellow-200 transition-all ${isMyTurn ? 'shadow-[0_5px_0_#a16207] active:shadow-none active:translate-y-1 hover:scale-105 hover:shadow-[0_8px_15px_rgba(250,204,21,0.4)]' : 'opacity-50 cursor-not-allowed grayscale'}`}>
            摸牌結束
          </button>
        </div>
      </div>

      {/* 底部視角與精美手牌 */}
      <div className="relative h-64 md:h-72 w-full flex justify-center items-end pb-8 z-10 px-4">
        {/* 我的頭像 (左下角) */}
        <div className="absolute left-6 bottom-8 flex flex-col items-center">
          <div className={`w-20 h-20 rounded-full border-4 p-1 bg-[#211142] z-20 transition-all duration-300 ${isMyTurn ? 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.7)] scale-110' : 'border-indigo-400/50 shadow-lg'}`}>
            <img src={user?.photoURL} alt="me" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="bg-purple-900/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-black mt-3 border border-purple-500/50 shadow-inner tracking-wide">我 ({myHand.length})</div>
        </div>
        
        {/* 動態渲染精美手牌 (扇形排列與重疊) */}
        <div className="flex px-24 overflow-x-auto w-full justify-center max-w-5xl scrollbar-hide pb-6 pt-10">
          {myHand.map((cardId, idx) => (
            <PlayingCard 
              key={idx} 
              cardId={cardId} 
              isMyTurn={isMyTurn} 
              idx={idx} 
            />
          ))}
        </div>

        {/* 右下角聊天按鈕 (原本樣式) */}
        <button onClick={() => setIsChatOpen(!isChatOpen)} className="absolute right-6 bottom-8 w-14 h-14 bg-purple-600/80 rounded-full flex items-center justify-center text-2xl shadow-lg border border-purple-400/50 hover:bg-purple-500 active:scale-95 transition-all z-20">💬</button>
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
                  <div className={`px-4 py-2.5 rounded-2xl text-[13px] ${isMe ? 'bg-indigo-600 rounded-tr-none shadow-md' : 'bg-white/10 rounded-tl-none'}`}>{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-white/10">
          <form onSubmit={handleSendMessage} className="relative">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Send a message..." className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-6 pr-16 outline-none focus:border-indigo-500/50 text-sm" />
            <button className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 rounded-full font-bold text-xs hover:bg-indigo-500 active:scale-95 transition-transform">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
