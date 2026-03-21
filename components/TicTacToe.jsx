'use client';

import { ref, update } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function TicTacToe({ roomId, gameState, currentUser }) {
  // 🛡️ 第一層防護：確保資料存在才開始渲染
  if (!gameState || !gameState.board) {
    return <div className="text-white text-center p-10">遊戲資料同步中...</div>;
  }

  const { board, currentTurn, winner, symbols } = gameState;

  const handleMove = (index) => {
    // 檢查：是否輪到我、格子是否為空、是否已有勝者
    if (currentTurn !== currentUser.uid || board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = symbols[currentUser.uid];
    
    // 勝負判定
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let gameWinner = null;
    for (let [a,b,c] of lines) {
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        gameWinner = newBoard[a];
      }
    }
    const isDraw = !gameWinner && newBoard.every(cell => cell !== null);

    const playerIds = Object.keys(symbols || {});
    const nextTurn = playerIds.find(id => id !== currentUser.uid);

    // 更新 Firebase
    update(ref(database, `rooms/${roomId}/gameState`), {
      board: newBoard,
      currentTurn: (gameWinner || isDraw) ? null : nextTurn,
      winner: gameWinner || (isDraw ? 'draw' : null)
    });
  };

  return (
    <div className="flex flex-col items-center animate-in fade-in duration-500">
      <div className="text-2xl font-bold mb-8 text-indigo-400">
        {winner ? (winner === 'draw' ? '平手！' : `勝利者: ${winner}`) : 
         (currentTurn === currentUser.uid ? "🌟 輪到你了" : "💤 對手思考中")}
      </div>
      
      <div className="grid grid-cols-3 gap-4 bg-white/5 p-6 rounded-[3rem] border border-white/10 backdrop-blur-xl">
        {board.map((cell, i) => (
          <button 
            key={i} onClick={() => handleMove(i)}
            className="w-20 h-20 md:w-24 md:h-24 bg-white/5 rounded-3xl text-4xl border border-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
          >
            {cell === 'O' && <span className="text-cyan-400">○</span>}
            {cell === 'X' && <span className="text-rose-400">×</span>}
          </button>
        ))}
      </div>

      {winner && (
        <button 
          onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })}
          className="mt-8 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-full font-bold shadow-lg transition-all"
        >
          回到大廳
        </button>
      )}
    </div>
  );
}
