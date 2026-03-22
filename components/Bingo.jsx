'use client';

import { useState, useEffect } from 'react';
import { ref, update, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function Bingo({ user, roomId, roomData, handleLeaveRoom }) {
  const gameState = roomData?.gameState || {};
  const isHost = roomData?.info?.hostId === user?.uid;
  const players = roomData?.players || {};
  const rules = roomData?.info?.rules || { winLines: 3 };

  // 💡 關鍵修復：接住 WaitingRoom 的 init 訊號並初始化所有人的賓果盤
  useEffect(() => {
    if (isHost && gameState.status === 'init') {
      const uids = Object.keys(players);
      const generatedBoards = {};
      uids.forEach(uid => {
        // 產生 1~25 的亂數陣列
        generatedBoards[uid] = Array.from({length: 25}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      });
      
      update(ref(database, `rooms/${roomId}/gameState`), {
        status: 'playing',
        calledNumbers: [],
        playerBoards: generatedBoards,
        winner: null
      });
      push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: '🎱 賓果盤已發送！點擊你的數字即可叫號！', timestamp: Date.now() });
    }
  }, [isHost, gameState.status, players, roomId]);

  const handleCallNumber = (num) => {
    if (gameState.status !== 'playing' || gameState.calledNumbers?.includes(num)) return;
    
    const newCalled = [...(gameState.calledNumbers || []), num];
    update(ref(database, `rooms/${roomId}/gameState/calledNumbers`), newCalled);
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `📢 ${user.displayName} 叫號： ${num}`, timestamp: Date.now() });
    
    // 檢查自己有沒有連線成功
    checkWinCondition(newCalled);
  };

  const checkWinCondition = (calledNums) => {
    const myBoard = gameState.playerBoards?.[user.uid];
    if (!myBoard) return;

    const lines = [
      [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24], // 橫
      [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24], // 直
      [0,6,12,18,24], [4,8,12,16,20] // 斜
    ];

    let linesCompleted = 0;
    lines.forEach(line => {
      if (line.every(idx => calledNums.includes(myBoard[idx]))) linesCompleted++;
    });

    if (linesCompleted >= rules.winLines) {
      update(ref(database, `rooms/${roomId}/gameState/status`), 'game_over');
      update(ref(database, `rooms/${roomId}/gameState/winner`), user.uid);
      push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🏆 BINGO！${user.displayName} 達成了 ${rules.winLines} 條連線！`, timestamp: Date.now() });
    }
  };

  const myBoard = gameState.playerBoards?.[user.uid] || [];

  return (
    // 💡 改為 h-full
    <div className="h-full bg-[#1e0a2d] text-white flex flex-col vibe-font relative overflow-hidden">
      <div className="flex justify-between items-center p-4 md:p-6 z-10 border-b border-white/5">
        <button onClick={handleLeaveRoom} className="bg-white/5 px-5 py-2 rounded-full text-xs font-bold">← 退出</button>
        <div className="bg-fuchsia-500/10 px-6 py-2 rounded-full border border-fuchsia-500/30 text-fuchsia-400 font-black text-xs tracking-widest">
          {gameState.status === 'init' ? '發盤中...' : gameState.status === 'playing' ? `目標：${rules.winLines} 條連線` : '遊戲結束'}
        </div>
        <div className="bg-white/10 px-4 py-1.5 rounded-full font-mono text-sm">{roomId}</div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center">
        {gameState.status === 'init' ? (
          <div className="text-xl font-bold animate-pulse text-fuchsia-400">系統正在為大家生成命運盤...</div>
        ) : (
          <>
            {gameState.status === 'game_over' && (
              <div className="text-center mb-8 animate-in zoom-in">
                <h2 className="text-5xl font-black text-yellow-400 mb-2">BINGO!</h2>
                <p className="text-xl font-bold text-white/80">{players[gameState.winner]?.name} 獲得了最終勝利！</p>
              </div>
            )}

            <div className="w-full max-w-md bg-black/40 p-6 md:p-8 rounded-[3rem] border border-white/10 shadow-2xl">
              <div className="grid grid-cols-5 gap-2 md:gap-3">
                {myBoard.map((num, i) => {
                  const isCalled = gameState.calledNumbers?.includes(num);
                  return (
                    <button 
                      key={i} onClick={() => handleCallNumber(num)} disabled={gameState.status !== 'playing' || isCalled}
                      className={`aspect-square rounded-2xl flex items-center justify-center text-xl md:text-3xl font-black transition-all ${isCalled ? 'bg-fuchsia-600 text-white shadow-inner scale-95' : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/5 hover:border-fuchsia-400/50'}`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 w-full max-w-md p-6 bg-white/5 rounded-3xl border border-white/5">
              <h3 className="text-sm font-bold text-white/50 mb-3">開號紀錄 (共 {gameState.calledNumbers?.length || 0} 個)</h3>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {gameState.calledNumbers?.map((n, i) => <span key={i} className="w-8 h-8 rounded-full bg-fuchsia-900/50 flex items-center justify-center text-xs font-bold text-fuchsia-300 border border-fuchsia-500/30">{n}</span>)}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
