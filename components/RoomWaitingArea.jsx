'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, serverTimestamp, onDisconnect } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { database, auth } from '../lib/firebaseConfig';
import TicTacToe from './TicTacToe';

export default function RoomWaitingArea({ roomId = "1234" }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState({});
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [roomInfo, setRoomInfo] = useState({ status: 'waiting' });
  const [gameState, setGameState] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 匿名登入
    signInAnonymously(auth).then(res => setCurrentUser(res.user));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    
    // 1. 🛠️ 最強防線：實作「伺服器端離線清理」
    // 當連線中斷，Firebase 伺服器會自動刪除我的節點
    const myPlayerRef = ref(database, `rooms/${roomId}/players/${currentUser.uid}`);
    onDisconnect(myPlayerRef).remove()
      .then(() => console.log('✅ 離線清理已就緒'))
      .catch(e => console.error('❌ onDisconnect error:', e));

    // 2. 註冊玩家與更新狀態
    update(myPlayerRef, {
      uid: currentUser.uid,
      displayName: `Gamer_${currentUser.uid.slice(0, 4)}`,
      lastSeen: serverTimestamp(),
      isReady: false
    });

    // 3. 監聽房間資料
    const roomRef = ref(database, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val() || {};
      
      // 如果房間沒 host，把我自己設為 host
      if (!data.info || !data.info.hostId) {
        update(ref(database, `rooms/${roomId}/info`), { 
          status: 'waiting', 
          hostId: currentUser.uid,
          gameType: 'tic-tac-toe' 
        });
      }

      setRoomInfo(data.info || { status: 'waiting' });
      setPlayers(data.players || {});
      setGameState(data.gameState || null);
      setMessages(data.chat ? Object.values(data.chat).sort((a,b) => a.timestamp - b.timestamp) : []);
      setIsLoaded(true);
    });
  }, [roomId, currentUser]);

  const handleStart = () => {
    const ids = Object.keys(players || {});
    // if (ids.length < 2) return alert("人數不足"); // 測試時可註解
    
    update(ref(database, `rooms/${roomId}`), {
      "info/status": "playing",
      "gameState": {
        board: Array(9).fill(null),
        currentTurn: ids[0],
        symbols: { [ids[0]]: "O", [ids[1] || 'bot']: "X" }
      }
    });
  };

  // 房長判斷
  const isHost = roomInfo.hostId === currentUser?.uid;

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#070708] flex flex-col items-center justify-center text-lime-400">
      <div className="w-16 h-16 border-2 border-lime-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <p className="tracking-[0.4em] font-light text-sm uppercase animate-pulse">Initializing Vibe</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070708] text-white p-4 md:p-10 relative">
      
      {/* 🧩 UI美感升級1：動態幾何背景 (使用SVG) */}
      <div className="fixed inset-0 z-0 opacity-10">
        <svg width="100%" height="100%">
          <pattern id="pattern-hex" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse" viewBox="0 0 100 100">
            <path d="M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z" fill="none" stroke="white" strokeWidth="1"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#pattern-hex)" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {roomInfo.status === 'playing' && gameState?.board ? (
          <TicTacToe roomId={roomId} gameState={gameState} currentUser={currentUser} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-10">
            
            {/* 左側大廳 - 現代美感重新設計 */}
            <div className="lg:col-span-8 bg-[#0d0d0f] border border-white/5 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
              {/* 微妙的發光背景球 */}
              <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[80%] bg-lime-600/5 blur-[120px] rounded-full z-0 group-hover:bg-lime-600/10 transition-colors duration-500"></div>

              <div className="flex justify-between items-center mb-10 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-8 bg-lime-500 rounded-full shadow-[0_0_10px_#84cc16]"></div>
                  <h2 className="text-4xl font-black bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent italic tracking-tighter">GAME DECK</h2>
                </div>
                <div className="text-xs font-medium text-white/40 tracking-widest uppercase bg-white/5 px-4 py-2 rounded-full border border-white/10">
                  Room: {roomId}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                {Object.values(players).map(p => (
                  <div key={p.uid} className="flex justify-between items-center p-6 bg-[#121215] rounded-[2rem] border border-white/5 hover:border-lime-500/20 transition-colors duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xl text-white/80">
                        {p.displayName[0]}
                      </div>
                      <div>
                        <span className="font-semibold text-white/90">{p.displayName}</span>
                        {p.uid === roomInfo.hostId && <span className="block text-xs text-lime-400/70 font-bold uppercase tracking-widest">HOST</span>}
                      </div>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${p.isReady ? 'bg-lime-400 border-lime-400 shadow-[0_0_15px_#84cc16]' : 'bg-transparent border-white/20'}`} />
                  </div>
                ))}
              </div>

              <div className="mt-12 flex gap-4 relative z-10">
                <button 
                  onClick={() => update(ref(database, `rooms/${roomId}/players/${currentUser.uid}`), { isReady: !players[currentUser.uid]?.isReady })}
                  className="flex-1 py-6 bg-white/[0.04] hover:bg-white/[0.08] rounded-[2rem] font-bold border border-white/10 transition-all duration-300 hover:scale-[1.01]"
                >
                  {players[currentUser?.uid]?.isReady ? 'READY!' : 'PREPARE'}
                </button>
                {/* 🧩 UI美感升級2：開始按鈕重新設計 */}
                {isHost && (
                  <button onClick={handleStart} className="flex-1 py-6 bg-lime-500 text-black rounded-[2rem] font-black shadow-[0_0_40px_rgba(132,204,22,0.4)] hover:bg-lime-400 transition-all duration-300 hover:scale-[1.01] uppercase tracking-tighter">
                    Start Mission
                  </button>
                )}
              </div>
            </div>

            {/* 右側聊天室 - 聊天對象區分 */}
            <div className="lg:col-span-4 bg-[#0d0d0f] border border-white/5 rounded-[3rem] p-8 flex flex-col h-[650px] shadow-2xl relative overflow-hidden">
              <h3 className="text-xl font-bold mb-6 tracking-tight text-white/90">COMMS CHANNEL</h3>
              <div className="flex-1 overflow-y-auto space-y-5 mb-6 pr-2 scrollbar-hide">
                {messages.map((m, i) => {
                  const isMe = m.senderId === currentUser?.uid;
                  return (
                    <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs text-white/60 flex-shrink-0 mt-1">
                        {m.senderName[0]}
                      </div>
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && <span className="text-[11px] text-white/30 ml-2 mb-1">{m.senderName}</span>}
                        <div className={`px-5 py-3 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-lime-950 text-lime-100 rounded-tr-none border border-lime-800/50' : 'bg-white/5 border border-white/5 rounded-tl-none'}`}>
                          {m.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                push(ref(database, `rooms/${roomId}/chat`), {
                  senderId: currentUser.uid,
                  senderName: players[currentUser.uid]?.displayName,
                  text: chatInput,
                  timestamp: Date.now()
                });
                setChatInput('');
              }} className="relative">
                <input 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  className="w-full bg-[#121215] border border-white/5 rounded-3xl py-5 pl-6 pr-16 outline-none focus:border-lime-500/40 transition-all placeholder:text-white/10" 
                  placeholder="Transmit message..." 
                />
                <button className="absolute right-3 top-2.5 bottom-2.5 px-6 bg-lime-500 rounded-2xl hover:bg-lime-400 transition-all font-bold text-black text-xs uppercase">SEND</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
