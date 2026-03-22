'use client';

import { ref, update, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function WaitingRoom({ user, roomId, roomData, isHost, handleLeaveRoom }) {
  const players = roomData?.players ? Object.values(roomData.players) : [];
  
  // 💡 把四款遊戲的名稱對應好
  const gameModeName = {
    'boomcat': '💣 炸彈貓咪',
    'drawguess': '🎨 你畫我猜',
    'bingo': '🎱 極速賓果',
    'evilfills': '🤪 惡搞填空'
  }[roomData?.info?.gameMode] || '🎮 遊戲載入中...';

  const startGame = () => {
    const updates = {};
    updates[`rooms/${roomId}/info/status`] = 'playing';
    updates[`rooms/${roomId}/gameState`] = { status: 'init', startTime: Date.now() };
    update(ref(database), updates);
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: '🚀 遊戲即將開始，請各位準備！', timestamp: Date.now() });
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center p-6 vibe-font">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse"></div>
      </div>

      <div className="w-full max-w-4xl z-10 text-center animate-in zoom-in duration-500">
        <div className="mb-4 inline-block px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black tracking-[0.4em] uppercase text-white/50">
          Waiting Room
        </div>
        <h1 className="text-5xl md:text-6xl font-black mb-2 tracking-tighter italic">{gameModeName}</h1>
        <div className="text-sm font-mono text-white/30 tracking-widest mb-16">ROOM ID: <span className="text-white/80 font-bold">{roomId}</span></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {players.map((p) => (
            <div key={p.uid} className="group relative">
              <div className="bg-white/5 border border-white/10 rounded-[3rem] p-8 transition-all hover:bg-white/10 hover:-translate-y-2 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 mb-4 group-hover:border-indigo-400 transition-colors shadow-2xl">
                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-sm font-bold truncate max-w-full">{p.name}</span>
                {roomData?.info?.hostId === p.uid && <span className="text-[9px] mt-2 px-2 py-0.5 bg-yellow-400/20 text-yellow-400 rounded-full font-black uppercase tracking-widest">HOST</span>}
              </div>
            </div>
          ))}
          {Array.from({ length: (roomData?.info?.rules?.maxPlayers || 4) - players.length }).map((_, i) => (
            <div key={i} className="bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem] flex items-center justify-center min-h-[160px]">
              <span className="text-white/10 text-4xl">?</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <button onClick={handleLeaveRoom} className="px-12 py-5 rounded-full bg-white/5 border border-white/10 font-bold hover:bg-rose-500/10 hover:text-rose-400 transition-all">退出房間</button>
          {isHost ? (
            <button onClick={startGame} className="px-16 py-5 rounded-full bg-white text-black font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]">
              開始遊戲 ({players.length}/{roomData?.info?.rules?.maxPlayers})
            </button>
          ) : (
            <div className="px-12 py-5 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold animate-pulse">等待房主發車...</div>
          )}
        </div>
      </div>
    </div>
  );
}
