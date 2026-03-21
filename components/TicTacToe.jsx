'use client';
import { ref, update } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function TicTacToe({ roomId, gameState, currentUser }) {
  if (!gameState || !gameState.board) return null;

  const { board, currentTurn, winner, symbols } = gameState;
  const isMyTurn = currentTurn === currentUser.uid;

  const handleMove = (index) => {
    if (!isMyTurn || board[index] || winner) return;
    const newBoard = [...board];
    newBoard[index] = symbols[currentUser.uid];
    
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let gameWinner = null;
    for (let [a,b,c] of lines) {
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) gameWinner = newBoard[a];
    }
    const isDraw = !gameWinner && newBoard.every(c => c !== null);

    const nextTurn = Object.keys(symbols).find(id => id !== currentUser.uid);
    update(ref(database, `rooms/${roomId}/gameState`), {
      board: newBoard,
      currentTurn: (gameWinner || isDraw) ? null : nextTurn,
      winner: gameWinner || (isDraw ? '重整' : null) 
    });
  };

  return (
    <div className="flex flex-col items-center py-20 animate-in fade-in duration-1000">
      <div className={`text-4xl font-black mb-12 tracking-tighter italic ${isMyTurn ? 'text-indigo-400' : 'text-white/20'}`}>
        {winner ? (winner === 'draw' ? '雙方平手' : `勝利者: ${winner}`) : (isMyTurn ? "輪到你了" : "等待對手下棋...")}
      </div>
      
      <div className="grid grid-cols-3 gap-6 bg-white/[0.03] p-10 rounded-[3.5rem] border border-white/10 backdrop-blur-3xl shadow-2xl relative">
        {board.map((cell, i) => (
          <button 
            key={i} 
            onClick={() => handleMove(i)}
            className="w-24 h-24 md:w-32 md:h-32 bg-white/[0.03] rounded-[2rem] text-6xl border border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-center"
          >
            {cell === 'O' && <span className="text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">○</span>}
            {cell === 'X' && <span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">×</span>}
          </button>
        ))}
      </div>

      {winner && (
        <button 
          onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })}
          className="mt-12 px-14 py-6 bg-white text-black rounded-[2.5rem] font-black hover:scale-105 transition-all shadow-xl"
        >
          返回大廳
        </button>
      )}
    </div>
  );
}
