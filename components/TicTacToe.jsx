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
      winner: gameWinner || (isDraw ? 'draw' : null)
    });
  };

  return (
    <div className="flex flex-col items-center py-20 animate-in fade-in duration-1000">
      {/* 發光的狀態標題 */}
      <div className={`text-4xl font-black mb-12 tracking-tighter italic ${isMyTurn ? 'text-lime-400 animate-pulse shadow-[0_0_20px_rgba(132,204,22,0.3)]' : 'text-white/30'}`}>
        {winner ? (winner === 'draw' ? 'STALEMATE' : `VICTOR: ${winner}`) : (isMyTurn ? "YOUR MOVE" : "RIVAL'S TURN")}
      </div>
      
      {/* 棋盤 UI */}
      <div className="grid grid-cols-3 gap-6 bg-[#0d0d0f] p-10 rounded-[3rem] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
        {/* 微妙的發光背景 */}
        <div className="absolute inset-0 bg-lime-600/3 blur-[80px] rounded-full z-0"></div>

        {board.map((cell, i) => (
          <button 
            key={i} 
            onClick={() => handleMove(i)}
            className="relative z-10 w-28 h-28 md:w-32 md:h-32 bg-white/[0.02] rounded-[2rem] border border-white/5 hover:bg-white/[0.07] hover:border-lime-500/20 transition-all duration-300 flex items-center justify-center"
          >
            {cell === 'O' && <span className="text-6xl text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)] font-light">○</span>}
            {cell === 'X' && <span className="text-6xl text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)] font-light">×</span>}
          </button>
        ))}
      </div>

      {winner && (
        <button 
          onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })}
          className="mt-14 px-14 py-6 bg-lime-500 text-black rounded-full font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl hover:bg-lime-400"
        >
          Retreat to Lobby
        </button>
      )}
    </div>
  );
}
