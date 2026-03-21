'use client';
import { ref, update } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function TicTacToe({ roomId, gameState, currentUser }) {
  const { board, currentTurn, winner, symbols } = gameState;

  // 勝負判定邏輯
  const checkWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // 橫
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // 直
      [0, 4, 8], [2, 4, 6]             // 斜
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const handleMove = (index) => {
    if (currentTurn !== currentUser.uid || board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = symbols[currentUser.uid];
    const gameWinner = checkWinner(newBoard);
    const isDraw = !gameWinner && newBoard.every(s => s !== null);

    // 切換玩家
    const playerIds = Object.keys(symbols);
    const nextTurn = playerIds.find(id => id !== currentUser.uid);

    update(ref(database, `rooms/${roomId}/gameState`), {
      board: newBoard,
      currentTurn: (gameWinner || isDraw) ? null : nextTurn,
      winner: gameWinner || (isDraw ? 'draw' : null)
    });
  };

  return (
    <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
      <div className="mb-6 text-xl font-semibold text-indigo-300">
        {winner ? (winner === 'draw' ? '平手！' : `勝利者: ${winner}`) : 
         (currentTurn === currentUser.uid ? '🌟 輪到你了！' : '等待對手下棋...')}
      </div>
      
      {/* 3x3 棋盤 */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-white/5 backdrop-blur-md rounded-[3rem] border border-white/10">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleMove(i)}
            className="w-24 h-24 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-4xl font-light transition-all flex items-center justify-center"
          >
            {cell === 'O' && <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">○</span>}
            {cell === 'X' && <span className="text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]">×</span>}
          </button>
        ))}
      </div>

      {winner && (
        <button 
          onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })}
          className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-[3rem] border border-white/20 transition-all"
        >
          回到大廳
        </button>
      )}
    </div>
  );
}
