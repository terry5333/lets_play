'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, serverTimestamp } from 'firebase/database';
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
    signInAnonymously(auth).then(res => setCurrentUser(res.user));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    
    // 註冊玩家與更新線上狀態
    const myRef = ref(database, `rooms/${roomId}/players/${currentUser.uid}`);
    update(myRef, {
      uid: currentUser.uid,
      displayName: `玩家 ${currentUser.uid.slice(0, 4)}`,
      lastSeen: serverTimestamp(),
      isReady: false
    });

    const roomRef = ref(database, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val() || {};
      if (!data.info) {
        set(ref(database, `rooms/${roomId}/info`), { status: 'waiting', hostId: currentUser.uid });
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
    // 💡 為了測試方便，我暫時註解掉人數限制
    // if (ids.length < 2) return alert("需要兩位玩家！");
    
    console.log("嘗試開始遊戲...");
    update(ref(database, `rooms/${roomId}`), {
      "info/status": "playing",
      "gameState": {
        board: Array(9).fill(null),
        currentTurn: ids[0],
        symbols: { [ids[0]]: "O", [ids[1] || 'bot']: "X" } // 即使只有一人也生成 X 給虛擬對手
      }
    }).then(() => console.log("遊戲狀態已更新至 Firebase"));
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-indigo-400">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="animate-pulse tracking-[0.3em] font-light">LOADING VIBE</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-4 md:p-10 selection:bg-indigo-500/30">
      {/* 背景裝飾 */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full z-0"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        {roomInfo.status === 'playing' && gameState?.board ? (
          <TicTacToe roomId={roomId} gameState={gameState} currentUser={currentUser} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10">
            
            {/* 左側大廳 - 3rem 大圓角 */}
            <div className="lg:col-span-8 bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 backdrop-blur-3xl shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-black bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent italic tracking-tighter">LOBBY</h2>
                  <p className="text-white/30 text-xs mt-1 tracking-widest uppercase">Room #{roomId}</p>
                </div>
                <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold">
                  等待中玩家: {Object.keys(players).length}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(players).map(p => (
                  <div key={p.uid} className="group flex justify-between items-center p-6 bg-white/[0.03] rounded-[2rem] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
                        {p.displayName[0]}
                      </div>
                      <span className="font-semibold">{p.displayName} {p.uid === roomInfo.hostId && '👑'}</span>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${p.isReady ? 'bg-green-400 shadow-[0_0_15px_#4ade80]' : 'bg-white/10'}`} />
                  </div>
                ))}
              </div>

              <div className="mt-12 flex gap-4">
                <button 
                  onClick={() => update(ref(database, `rooms/${roomId}/players/${currentUser.uid}`), { isReady: !players[currentUser.uid]?.isReady })}
                  className="flex-1 py-6 bg-white/[0.05] hover:bg-white/[0.1] rounded-[2rem] font-bold border border-white/10 transition-all hover:scale-[1.02] active:scale-95"
                >
                  {players[currentUser?.uid]?.isReady ? 'READY!' : 'PREPARE'}
                </button>
                {roomInfo.hostId === currentUser?.uid && (
                  <button onClick={handleStart} className="flex-1 py-6 bg-white text-black rounded-[2rem] font-black shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:bg-indigo-50 transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-tighter">
                    Start Mission
                  </button>
                )}
              </div>
            </div>

            {/* 右側聊天室 - 3rem 大圓角 */}
            <div className="lg:col-span-4 bg-white/[0.03] border border-white/10 rounded-[3rem] p-8 backdrop-blur-3xl flex flex-col h-[650px] shadow-2xl">
              <h3 className="text-xl font-bold mb-6 tracking-tight">CHATROOM</h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 scrollbar-hide">
                {messages.map((m, i) => {
                  const isMe = m.senderName === players[currentUser?.uid]?.displayName;
                  return (
                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && <span className="text-[10px] text-white/30 ml-2 mb-1">{m.senderName}</span>}
                      <div className={`px-5 py-3 rounded-3xl text-sm leading-relaxed ${isMe ? 'bg-indigo-600 rounded-tr-none shadow-lg shadow-indigo-600/20' : 'bg-white/5 border border-white/5 rounded-tl-none'}`}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                push(ref(database, `rooms/${roomId}/chat`), {
                  senderName: players[currentUser.uid]?.displayName,
                  text: chatInput,
                  timestamp: Date.now()
                });
                setChatInput('');
              }} className="relative">
                <input 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  className="w-full bg-white/[0.05] border border-white/10 rounded-3xl py-5 px-6 outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/20" 
                  placeholder="Send a message..." 
                />
                <button className="absolute right-3 top-2.5 bottom-2.5 px-5 bg-indigo-500 rounded-2xl hover:bg-indigo-400 transition-all font-bold">🚀</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
