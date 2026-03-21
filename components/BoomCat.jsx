'use client';

import { useState } from 'react';
import { ref, push, update, increment } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

// 💎 高級卡牌視覺字典 (將 attack 替換為 甩鍋)
const CARD_DIC = {
  defuse: { icon: '🔧', name: '拆除卡', theme: 'emerald', grad: 'from-[#065f46] via-[#10b981] to-[#059669]', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.5)]', desc: '避免被炸死，並重置炸彈位置。' },
  skip: { icon: '⏭️', name: '跳過卡', theme: 'blue', grad: 'from-[#1e3a8a] via-[#3b82f6] to-[#2563eb]', glow: 'shadow-[0_0_30px_rgba(59,130,246,0.5)]', desc: '不抽牌直接結束回合。' },
  attack: { icon: '🍳', name: '甩鍋卡', theme: 'rose', grad: 'from-[#881337] via-[#ef4444] to-[#e11d48]', glow: 'shadow-[0_0_30px_rgba(239,68,68,0.5)]', desc: '指定一名玩家強制執行一次動作。' },
  see: { icon: '👁️', name: '預言卡', theme: 'purple', grad: 'from-[#4c1d95] via-[#8b5cf6] to-[#7c3aed]', glow: 'shadow-[0_0_30px_rgba(139,92,246,0.5)]', desc: '偷看牌堆頂端的三張牌。' },
  shuffle: { icon: '🔀', name: '洗牌卡', theme: 'cyan', grad: 'from-[#164e63] via-[#06b6d4] to-[#0891b2]', glow: 'shadow-[0_0_30px_rgba(6,182,212,0.5)]', desc: '將牌堆洗勻。' },
  favor: { icon: '🤲', name: '索要卡', theme: 'amber', grad: 'from-[#78350f] via-[#f59e0b] to-[#d97706]', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.5)]', desc: '隨機抽取下一位玩家一張牌。' },
  bomb: { icon: '🐈‍⬛💣', name: '炸彈貓', theme: 'neutral', grad: 'from-[#171717] via-[#404040] to-[#262626]', glow: 'shadow-[0_0_40px_rgba(239,68,68,0.7)]', desc: '無拆除卡即淘汰。' }
};

const PlayingCard = ({ cardId, isMyTurn, idx, onClick, isTargeting }) => {
  const card = CARD_DIC[cardId];
  if (!card) return null;
  const isBombOrDefuse = cardId === 'bomb' || cardId === 'defuse'; 

  return (
    <div 
      onClick={isBombOrDefuse || isTargeting ? null : onClick}
      className={`
        relative w-28 h-44 md:w-32 md:h-52 flex-shrink-0 
        rounded-3xl p-3 flex flex-col items-center justify-between
        transition-all duration-300 ease-out group
        bg-gradient-to-br ${card.grad} ${card.glow}
        border-t-2 border-l-2 border-white/20
        ${isMyTurn && !isBombOrDefuse && !isTargeting ? 'cursor-pointer hover:-translate-y-12 hover:rotate-0 hover:z-50 hover:scale-110 opacity-100 shadow-[0_15px_30px_rgba(0,0,0,0.4)]' : 'opacity-80 cursor-not-allowed grayscale-[10%]'}
      `}
      style={{ marginLeft: idx !== 0 ? '-30px' : '0', transform: `rotate(${ (idx - 2) * 3 }deg)`, backfaceVisibility: 'hidden' }}
    >
      <div className="absolute inset-2 rounded-2xl border border-black/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.2),inset_0_-2px_10px_rgba(0,0,0,0.3)] pointer-events-none"></div>
      <div className={`absolute inset-0 rounded-3xl border-2 border-${card.theme}-300 opacity-40 group-hover:opacity-100 transition-opacity`}></div>
      <div className="w-full flex items-center justify-between z-10 relative">
        <span className={`bg-white/10 ${card.text} rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider`}>■ {card.name}</span>
        <span className="text-sm">{card.icon.replace('🐈‍⬛', '')}</span>
      </div>
      <div className="text-6xl md:text-7xl z-10 relative drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]">{card.icon}</div>
      <div className="w-full bg-black/40 backdrop-blur-sm p-2 rounded-xl border border-white/10 z-10 relative opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-[8px] leading-tight text-white/80 font-medium">{card.desc}</p>
      </div>
    </div>
  );
};

export default function BoomCat({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [buckTargetIdx, setBuckTargetIdx] = useState(null); // 🎯 紀錄準備打出的甩鍋卡索引

  const gameState = roomData?.gameState;
  if (!gameState) return <div className="min-h-screen bg-[#070709] text-white flex items-center justify-center font-mono tracking-widest text-sm"><div className="animate-pulse">LOADING VIBE...</div></div>;

  const myHand = gameState.hands?.[user.uid] || [];
  const isMyTurn = gameState.currentTurn === user.uid;
  const isAlive = gameState.alivePlayers?.includes(user.uid);
  const deckCount = gameState.deck ? gameState.deck.length : 0;
  const lastDiscard = gameState.discardPile?.[gameState.discardPile.length - 1];

  const getNextPlayer = (aliveList) => {
    const currentIndex = aliveList.indexOf(gameState.currentTurn);
    const nextIndex = currentIndex !== -1 ? (currentIndex + 1) % aliveList.length : 0;
    return aliveList[nextIndex];
  };

  // 🃏 摸牌引擎 (包含歸還回合邏輯)
  const drawCard = () => {
    if (!isMyTurn || !isAlive || buckTargetIdx !== null) return;
    
    const updates = {};
    let newDeck = [...(gameState.deck || [])];
    let newHand = [...myHand];
    let newAlive = [...gameState.alivePlayers];
    let newCurrentTurn = gameState.currentTurn;
    let newTurnActionsCount = gameState.turnActionsCount || 1;
    let newDiscard = [...(gameState.discardPile || [])];
    let newReturnTurn = gameState.returnTurn || null;

    if (newDeck.length === 0) return alert("牌堆沒牌了！");

    const drawnCard = newDeck.pop(); 

    if (drawnCard === 'bomb') {
      const defuseIdx = newHand.indexOf('defuse');
      if (defuseIdx !== -1) {
        newHand.splice(defuseIdx, 1); 
        newDiscard.push('defuse');
        const insertAt = Math.floor(Math.random() * (newDeck.length + 1));
        newDeck.splice(insertAt, 0, 'bomb');
        push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🔧 ${user.displayName} 驚險拆除了炸彈！`, timestamp: Date.now() });
      } else {
        newAlive = newAlive.filter(uid => uid !== user.uid);
        push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `💥 ${user.displayName} 被炸死了！`, timestamp: Date.now() });
        if (newAlive.length === 1) {
          updates[`users/${newAlive[0]}/score`] = increment(100); 
          updates[`rooms/${roomId}/info/status`] = 'waiting'; 
        }
      }
      newTurnActionsCount--; 
    } else {
      newHand.push(drawnCard);
      newTurnActionsCount--;
    }

    // 🎯 檢查是否是被甩鍋的強制回合
    if (newReturnTurn) {
      newCurrentTurn = newReturnTurn; // 還給原主人
      newReturnTurn = null;           // 結案
    } else if (newAlive.length > 1 && (newTurnActionsCount <= 0 || drawnCard === 'bomb')) {
      newCurrentTurn = getNextPlayer(newAlive);
      newTurnActionsCount = 1;
    }

    updates[`rooms/${roomId}/gameState/deck`] = newDeck;
    updates[`rooms/${roomId}/gameState/hands/${user.uid}`] = newHand;
    updates[`rooms/${roomId}/gameState/alivePlayers`] = newAlive;
    updates[`rooms/${roomId}/gameState/currentTurn`] = newCurrentTurn;
    updates[`rooms/${roomId}/gameState/turnActionsCount`] = newTurnActionsCount;
    updates[`rooms/${roomId}/gameState/discardPile`] = newDiscard;
    updates[`rooms/${roomId}/gameState/returnTurn`] = newReturnTurn; // 更新歸還狀態

    update(ref(database), updates);
  };

  // ⚔️ 出牌引擎 (支援甩鍋點選目標)
  const playCard = (cardIdx, targetUid = null) => {
    if (!isMyTurn || !isAlive) return;
    const cardId = myHand[cardIdx];
    
    // 如果是甩鍋，但還沒選擇目標，進入瞄準模式
    if (cardId === 'attack' && !targetUid) {
      setBuckTargetIdx(cardIdx);
      return;
    }

    let newHand = [...myHand];
    newHand.splice(cardIdx, 1);
    let newDiscard = [...(gameState.discardPile || []), cardId];
    let newDeck = [...(gameState.deck || [])];
    let newCurrentTurn = gameState.currentTurn;
    let newTurnActionsCount = gameState.turnActionsCount || 1;
    let newReturnTurn = gameState.returnTurn || null;
    const updates = {};

    let actionMsg = `${user.displayName} 打出了 ${CARD_DIC[cardId].name}`;

    switch (cardId) {
      case 'shuffle':
        for (let i = newDeck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
        }
        break;
      
      case 'see':
        const top3 = newDeck.slice(-3).reverse().map(c => CARD_DIC[c].name).join('、');
        alert(`👁️ 未來的 3 張牌是：\n${top3 || '沒有足夠的牌了'}`);
        break;
      
      case 'skip':
        newTurnActionsCount--;
        break;
      
      case 'attack': // 🍳 甩鍋邏輯
        newCurrentTurn = targetUid;
        // 如果這個回合本來就是被甩鍋來的，或者是自己的，把歸還權指向「發動甩鍋的人 (user.uid)」
        newReturnTurn = newReturnTurn || user.uid; 
        actionMsg = `🍳 ${user.displayName} 把鍋甩給了 ${roomData.players[targetUid].name}！`;
        break;
      
      case 'favor':
        const target = getNextPlayer(gameState.alivePlayers);
        const targetHand = gameState.hands?.[target] || [];
        if (targetHand.length > 0) {
          const stealIdx = Math.floor(Math.random() * targetHand.length);
          const stolenCard = targetHand.splice(stealIdx, 1)[0];
          newHand.push(stolenCard);
          updates[`rooms/${roomId}/gameState/hands/${target}`] = targetHand;
          actionMsg += "，隨機抽走了下一家一張牌！";
        }
        break;
    }

    // 🎯 只要不是甩鍋，出牌即視為消耗了強制動作，歸還回合
    if (newReturnTurn && cardId !== 'attack') {
      newCurrentTurn = newReturnTurn;
      newReturnTurn = null;
    } else if (newTurnActionsCount <= 0 && cardId !== 'attack') {
      // 正常回合切換
      newCurrentTurn = getNextPlayer(gameState.alivePlayers);
      newTurnActionsCount = 1;
    }

    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: actionMsg, timestamp: Date.now() });

    updates[`rooms/${roomId}/gameState/hands/${user.uid}`] = newHand;
    updates[`rooms/${roomId}/gameState/discardPile`] = newDiscard;
    updates[`rooms/${roomId}/gameState/deck`] = newDeck;
    updates[`rooms/${roomId}/gameState/currentTurn`] = newCurrentTurn;
    updates[`rooms/${roomId}/gameState/turnActionsCount`] = newTurnActionsCount;
    updates[`rooms/${roomId}/gameState/returnTurn`] = newReturnTurn;

    update(ref(database), updates);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: chatInput, timestamp: Date.now() });
    setChatInput('');
  };

  // 決定狀態列顯示的文字
  let statusText = '激戰中';
  if (!isAlive) statusText = '👻 你已成為鬼魂';
  else if (isMyTurn) {
    if (gameState.returnTurn) statusText = '⚠️ 被甩鍋！請出一張牌或摸牌';
    else statusText = `你的回合 (需摸 ${gameState.turnActionsCount} 張)`;
  } else if (gameState.returnTurn === user.uid) {
    statusText = '等待甩鍋結果...';
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#321c60] via-[#211142] to-[#120726] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-rose-500/20">
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse duration-[12s]"></div>
        <div className="absolute bottom-[20%] left-[10%] w-[30%] h-[30%] bg-rose-600/10 blur-[100px] rounded-full animate-pulse duration-[8s]"></div>
      </div>

      <div className="flex justify-between items-center p-4 md:p-6 z-10">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10 shadow-inner group">
          <span className="mr-2 text-xl font-black group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
        </button>
        <div className={`px-6 py-2 rounded-full border shadow-lg transition-colors duration-500 ${isMyTurn && isAlive ? (gameState.returnTurn ? 'bg-rose-500/20 border-rose-400/50 shadow-[0_0_20px_rgba(225,29,72,0.4)]' : 'bg-yellow-500/20 border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.3)]') : 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400/30 shadow-[0_0_20px_rgba(147,51,234,0.3)]'}`}>
          <span className={`font-extrabold tracking-widest text-xs drop-shadow-md transition-colors duration-500 ${isMyTurn && isAlive ? (gameState.returnTurn ? 'text-rose-400' : 'text-yellow-400') : 'text-white'}`}>
            {statusText}
          </span>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors shadow-inner cursor-pointer">⚙️</div>
        </div>
      </div>

      {/* 頂部對手列表 (🎯 甩鍋瞄準模式) */}
      <div className="flex justify-center gap-6 md:gap-12 mt-2 z-10 px-4">
        {roomData.players && Object.keys(roomData.players).filter(uid => uid !== user.uid).map(uid => {
          const p = roomData.players[uid];
          const isOpponentAlive = gameState.alivePlayers?.includes(uid);
          const handCount = gameState.hands?.[uid]?.length || 0;
          const isOpponentTurn = gameState.currentTurn === uid && isOpponentAlive;
          const isTargetable = buckTargetIdx !== null && isOpponentAlive; // 🎯 判斷是否可被選中
          
          return (
            <div 
              key={uid} 
              onClick={() => { if (isTargetable) { playCard(buckTargetIdx, uid); setBuckTargetIdx(null); } }}
              className={`flex flex-col items-center transition-all duration-300 ${isTargetable ? 'cursor-pointer hover:scale-125 hover:-translate-y-2' : ''} ${isOpponentTurn ? 'scale-110 opacity-100' : 'opacity-80'} ${!isOpponentAlive && 'grayscale opacity-30'}`}
            >
              <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-[4px] p-1 shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all duration-300 ${isTargetable ? 'border-rose-500 shadow-[0_0_30px_rgba(225,29,72,0.8)] animate-pulse bg-rose-950' : (isOpponentTurn ? 'border-yellow-400 bg-[#321c60] shadow-[0_0_25px_rgba(250,204,21,0.6)]' : 'border-indigo-400/50 bg-[#211142]')}`}>
                <img src={p?.avatar} alt={p?.name} className="w-full h-full object-cover rounded-full" />
                {isOpponentAlive && (
                  <div className={`absolute -bottom-2 -right-1 text-white text-[11px] font-black px-2.5 py-1 rounded-full border-2 border-[#211142] shadow-lg ${isTargetable ? 'bg-rose-600' : 'bg-gradient-to-br from-indigo-500 to-indigo-700'}`}>
                    {handCount}
                  </div>
                )}
              </div>
              <span className={`mt-3 text-xs font-bold max-w-[90px] truncate drop-shadow-md ${isTargetable ? 'text-rose-400' : 'text-white/90'}`}>
                {!isOpponentAlive ? '☠️ ' : ''}{p?.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
        {/* 🎯 甩鍋提示字眼 */}
        <div className="mb-6 h-10 transition-opacity duration-300 flex flex-col items-center">
          {buckTargetIdx !== null ? (
            <>
              <h2 className="text-3xl font-black text-rose-500 drop-shadow-[0_0_20px_rgba(225,29,72,0.8)] animate-pulse tracking-widest">🎯 請點擊上方對手頭像甩鍋！</h2>
              <button onClick={() => setBuckTargetIdx(null)} className="mt-2 text-xs font-bold bg-white/10 px-4 py-1 rounded-full hover:bg-white/20 transition-colors">取消甩鍋</button>
            </>
          ) : (
            isMyTurn && isAlive && <h2 className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-pulse tracking-widest">點擊出牌，或摸牌結束回合！</h2>
          )}
        </div>

        <div className={`flex gap-8 md:gap-16 mb-12 transition-all duration-300 ${buckTargetIdx !== null ? 'opacity-30 blur-sm pointer-events-none' : ''}`}>
          <div className="relative group cursor-pointer" onClick={drawCard}>
            <div className={`absolute -left-12 top-6 rounded-full p-2 border-4 z-20 flex flex-col items-center transform -rotate-12 group-hover:rotate-0 transition-all duration-300 bg-white border-slate-100 shadow-[0_10px_20px_rgba(0,0,0,0.3)]`}>
              <span className="text-rose-500 font-extrabold text-[11px] whitespace-nowrap">爆炸率</span>
              <span className="text-rose-600 font-black text-lg font-mono">{Math.round(((gameState.alivePlayers.length - 1) / (deckCount || 1)) * 100) || 0}%</span>
            </div>
            <div className={`w-36 h-48 md:w-44 md:h-60 rounded-[2.5rem] border-4 flex flex-col items-center justify-center p-4 transition-all duration-300 bg-gradient-to-br from-orange-50 via-orange-200 to-orange-400 border-orange-300 shadow-[0_15px_30px_rgba(0,0,0,0.6)] ${isMyTurn && isAlive ? 'hover:scale-105 shadow-[0_0_30px_rgba(250,204,21,0.3)] border-yellow-300' : ''}`}>
              <div className="text-6xl md:text-7xl mb-3 drop-shadow-[0_5px_10px_rgba(0,0,0,0.3)]">🐈‍⬛💣</div>
              <span className="font-black text-xl tracking-wider text-orange-950">剩 {deckCount} 張</span>
            </div>
          </div>
          
          <div className={`w-36 h-48 md:w-44 md:h-60 backdrop-blur-md rounded-[2.5rem] border-4 flex flex-col items-center justify-center p-4 relative overflow-hidden group transition-all duration-300 bg-white/5 border-white/10 shadow-[0_15px_30px_rgba(0,0,0,0.4)]`}>
             {lastDiscard && lastDiscard !== 'start' ? (
                <>
                  <div className="absolute top-4 left-5 flex items-center gap-1.5 font-extrabold text-sm text-white/60">
                    <span>{CARD_DIC[lastDiscard]?.icon}</span>{CARD_DIC[lastDiscard]?.name}
                  </div>
                  <div className="text-7xl md:text-8xl mt-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform">{CARD_DIC[lastDiscard]?.icon}</div>
                </>
             ) : (
                <div className="text-white/20 font-bold text-sm tracking-widest uppercase">棄牌堆</div>
             )}
          </div>
        </div>

        <div className={`flex gap-4 transition-all duration-300 ${buckTargetIdx !== null ? 'opacity-30 pointer-events-none' : ''}`}>
          <button onClick={drawCard} disabled={!isMyTurn || !isAlive} className={`px-12 py-4 rounded-[2rem] font-black tracking-widest transition-all duration-300 border-2 ${isMyTurn && isAlive ? 'bg-gradient-to-b from-yellow-300 to-yellow-500 text-yellow-950 border-yellow-200 shadow-[0_5px_0_#a16207,0_0_30px_rgba(250,204,21,0.3)] active:translate-y-1 active:shadow-none hover:scale-105' : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'}`}>
            摸牌結束
          </button>
        </div>
      </div>

      <div className="relative h-64 md:h-72 w-full flex justify-center items-end pb-8 z-10 px-4">
        <div className={`absolute left-6 bottom-8 flex flex-col items-center z-20 ${!isAlive && 'grayscale opacity-50'}`}>
          <div className={`w-20 h-20 rounded-full border-4 p-1 bg-[#211142] transition-all duration-300 ${isMyTurn && isAlive ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] scale-110' : 'border-indigo-400/50 shadow-lg'}`}>
            <img src={user?.photoURL} alt="me" className="w-full h-full object-cover rounded-full" />
          </div>
          <div className={`backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black mt-3 border transition-colors duration-300 tracking-wide shadow-inner ${isMyTurn && isAlive ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' : 'bg-purple-900/80 border-purple-500/50 text-white'}`}>
            {!isAlive ? '☠️ 淘汰' : `我 (${myHand.length})`}
          </div>
        </div>
        
        <div className="flex px-24 overflow-x-auto w-full justify-center max-w-5xl scrollbar-hide pb-6 pt-10">
          {myHand.map((cardId, idx) => (
            <PlayingCard key={idx} cardId={cardId} isMyTurn={isMyTurn && isAlive} isTargeting={buckTargetIdx !== null} idx={idx} onClick={() => playCard(idx)} />
          ))}
        </div>

        <button onClick={() => setIsChatOpen(!isChatOpen)} className={`absolute right-6 bottom-8 w-14 h-14 rounded-full flex items-center justify-center text-2xl border transition-all duration-300 z-20 bg-purple-600/80 border-purple-400/50 shadow-lg hover:bg-purple-500 active:scale-95`}>💬</button>
      </div>

      {/* 聊天室維持不變 */}
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
