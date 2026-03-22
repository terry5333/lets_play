'use client';

import { useState, useEffect } from 'react';
import { ref, update, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function BoomCat({ user, roomId, roomData, handleLeaveRoom }) {
  const gameState = roomData?.gameState || {};
  const isHost = roomData?.info?.hostId === user?.uid;
  const players = roomData?.players || {};
  const rules = roomData?.info?.rules || { startWithDefuse: true };

  // 💡 關鍵修復：接住 init 並發牌，將玩家設為 alive
  useEffect(() => {
    if (isHost && gameState.status === 'init') {
      const uids = Object.keys(players);
      const pStates = {};
      uids.forEach(uid => {
        pStates[uid] = { status: 'alive', hand: rules.startWithDefuse ? ['defuse'] : [] };
      });
      
      let deck = [];
      const numPlayers = uids.length;
      for(let i=0; i < numPlayers - 1; i++) deck.push('boom');
      for(let i=0; i < 4; i++) deck.push('defuse');
      for(let i=0; i < 5; i++) deck.push('attack');
      for(let i=0; i < 5; i++) deck.push('skip');
      deck.sort(() => Math.random() - 0.5);

      update(ref(database, `rooms/${roomId}/gameState`), {
        status: 'playing',
        turnOrder: uids.sort(() => Math.random() - 0.5),
        currentTurnIdx: 0,
        deck: deck,
        playerStates: pStates
      });
      push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: '💣 炸彈貓咪遊戲開始！', timestamp: Date.now() });
    }
  }, [isHost, gameState.status, players, roomId]);

  const currentTurnUid = gameState.turnOrder?.[gameState.currentTurnIdx % gameState.turnOrder.length];
  const isMyTurn = currentTurnUid === user?.uid;
  const myState = gameState.playerStates?.[user.uid] || { status: 'dead', hand: [] };

  const drawCard = () => {
    if (!isMyTurn || myState.status !== 'alive') return;
    
    const newDeck = [...(gameState.deck || [])];
    if (newDeck.length === 0) return alert("牌庫空了！");
    
    const card = newDeck.shift();
    const updates = {};
    updates[`rooms/${roomId}/gameState/deck`] = newDeck;

    if (card === 'boom') {
      const hasDefuse = myState.hand?.includes('defuse');
      if (hasDefuse) {
        // 使用拆除牌，把炸彈塞回去
        const newHand = [...myState.hand];
        newHand.splice(newHand.indexOf('defuse'), 1);
        newDeck.splice(Math.floor(Math.random() * newDeck.length), 0, 'boom'); // 隨機塞回炸彈
        updates[`rooms/${roomId}/gameState/playerStates/${user.uid}/hand`] = newHand;
        updates[`rooms/${roomId}/gameState/deck`] = newDeck;
        push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🛡️ ${user.displayName} 抽到炸彈，但驚險地使用了拆除牌！`, timestamp: Date.now() });
      } else {
        // 死亡
        updates[`rooms/${roomId}/gameState/playerStates/${user.uid}/status`] = 'dead';
        push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `💥 轟！${user.displayName} 抽到了炸彈，粉身碎骨！`, timestamp: Date.now() });
      }
    } else {
      updates[`rooms/${roomId}/gameState/playerStates/${user.uid}/hand`] = [...(myState.hand || []), card];
      push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🃏 ${user.displayName} 抽了一張牌。`, timestamp: Date.now() });
    }

    // 換下一位 (簡單邏輯，實際可能需跳過死者)
    let nextIdx = gameState.currentTurnIdx + 1;
    updates[`rooms/${roomId}/gameState/currentTurnIdx`] = nextIdx;
    update(ref(database), updates);
  };

  return (
    // 💡 改為 h-full
    <div className="h-full bg-[#111] text-white flex flex-col vibe-font relative overflow-hidden">
      <div className="flex justify-between items-center p-4 md:p-6 z-10 border-b border-white/5">
        <button onClick={handleLeaveRoom} className="bg-white/5 px-5 py-2 rounded-full text-xs font-bold">← 退出</button>
        <div className="bg-indigo-500/10 px-6 py-2 rounded-full border border-indigo-500/30 text-indigo-400 font-black text-xs tracking-widest uppercase">
          {gameState.status === 'init' ? '洗牌中...' : myState.status === 'dead' ? '💀 觀戰中' : isMyTurn ? '🔥 輪到你了' : '等待別人動作'}
        </div>
        <div className="bg-white/10 px-4 py-1.5 rounded-full font-mono text-sm">{roomId}</div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center">
        {gameState.status === 'init' ? (
           <div className="text-xl font-bold animate-pulse text-indigo-400">正在分配卡牌與炸彈...</div>
        ) : (
           <div className="w-full max-w-2xl text-center space-y-8">
             <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem]">
               <h3 className="text-2xl font-black mb-4">場上局勢</h3>
               <p className="text-white/50 mb-6">剩餘牌庫：<span className="font-bold text-white">{gameState.deck?.length || 0}</span> 張</p>
               <div className="flex gap-4 justify-center">
                 {Object.entries(gameState.playerStates || {}).map(([uid, state]) => (
                   <div key={uid} className={`flex flex-col items-center p-4 rounded-2xl border ${uid === currentTurnUid ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/5'} ${state.status === 'dead' ? 'opacity-30 grayscale' : ''}`}>
                     <img src={players[uid]?.avatar} className="w-12 h-12 rounded-full mb-2" />
                     <span className="text-xs font-bold">{players[uid]?.name}</span>
                     <span className="text-[10px] mt-1 bg-white/10 px-2 py-0.5 rounded">{state.hand?.length || 0} 張牌</span>
                   </div>
                 ))}
               </div>
             </div>

             <div className="bg-black/40 border border-white/10 p-8 rounded-[3rem]">
               <h3 className="text-xl font-black mb-6">你的手牌</h3>
               {myState.status === 'dead' ? (
                 <div className="text-rose-500 font-bold text-xl">你已經被炸死了</div>
               ) : (
                 <>
                   <div className="flex flex-wrap justify-center gap-2 mb-8">
                     {myState.hand?.length === 0 && <span className="text-white/20 text-sm">手牌空空如也</span>}
                     {myState.hand?.map((card, i) => (
                       <div key={i} className={`px-4 py-2 rounded-xl font-bold border ${card==='defuse' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/20'}`}>
                         {card === 'defuse' ? '🛡️ 拆除' : card === 'attack' ? '⚔️ 攻擊' : card === 'skip' ? '⏭️ 跳過' : card}
                       </div>
                     ))}
                   </div>
                   <button 
                     onClick={drawCard} disabled={!isMyTurn}
                     className="px-10 py-4 bg-indigo-600 text-white rounded-full font-black text-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {isMyTurn ? '抽一張牌 (結束回合)' : '等待其他玩家...'}
                   </button>
                 </>
               )}
             </div>
           </div>
        )}
      </main>
    </div>
  );
}
