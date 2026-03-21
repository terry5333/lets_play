'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, serverTimestamp } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { database, auth } from '../lib/firebaseConfig';
import TicTacToe from './TicTacToe'; // 💡 確保這行引入路徑正確

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
    
    // 註冊玩家
    update(ref(database, `rooms/${roomId}/players/${currentUser.uid}`), {
      uid: currentUser.uid,
      displayName: `玩家 ${currentUser.uid.slice(0, 4)}`,
      lastSeen: serverTimestamp()
    });

    const roomRef = ref(database, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val() || {};
      setRoomInfo(data.info || { status: 'waiting' });
      setPlayers(data.players || {});
      setGameState(data.gameState || null);
      setMessages(data.chat ? Object.values(data.chat).sort((a,b) => a.timestamp - b.timestamp) : []);
      setIsLoaded(true);
    });
  }, [roomId, currentUser]);

  const handleStart = () => {
    const ids = Object.keys(players || {});
    if (ids.length < 2) return alert("需要兩位玩家！");
    update(ref(database, `rooms/${roomId}`), {
      "info/status": "playing",
      "gameState": {
        board: Array(9).fill(null),
        currentTurn: ids[0],
        symbols: { [ids[0]]: "O", [ids[1]]: "X" }
      }
    });
  };

  if (!isLoaded) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400">連線中...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* 核心切換邏輯：Status 為 playing 且資料備齊時才顯示 TicTacToe */}
        {roomInfo.status === 'playing' && gameState?.board ? (
          <TicTacToe roomId={roomId} gameState={gameState} currentUser={currentUser} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
            {/* 玩家列表卡片 */}
            <div className="lg:col-span-8 bg-white/5 border border-white/10 rounded-[3rem] p-8 backdrop-blur-xl">
              <h2 className="text-2xl font-bold mb-8">房間大廳 #{roomId}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(players).map(p => (
                  <div key={p.uid} className="flex justify-between p-5 bg-white/5 rounded-3xl border border-white/5">
                    <span>{p.displayName} {p.uid === roomInfo.hostId ? '👑' : ''}</span>
                    <div className={`w-3 h-3 rounded-full ${p.isReady ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-rose-500'}`} />
                  </div>
                ))}
              </div>
              <div className="mt-10 flex gap-4">
                <button 
                  onClick={() => update(ref(database, `rooms/${roomId}/players/${currentUser.uid}`), { isReady: !players[currentUser.uid]?.isReady })}
                  className="flex-1 py-5 bg-white/10 rounded-3xl font-bold border border-white/10"
                >
                  {players[currentUser?.uid]?.isReady ? '取消準備' : '我已準備'}
                </button>
                {roomInfo.hostId === currentUser?.uid && (
                  <button onClick={handleStart} className="flex-1 py-5 bg-white text-slate-900 rounded-3xl font-bold shadow-xl">
                    開始遊戲
                  </button>
                )}
              </div>
            </div>

            {/* 聊天室卡片 */}
            <div className="lg:col-span-4 bg-white/5 border border-white/10 rounded-[3rem] p-8 flex flex-col h-[500px]">
              <h3 className="text-xl font-bold mb-6">即時頻道</h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.senderName === players[currentUser?.uid]?.displayName ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl text-sm ${m.senderName === players[currentUser?.uid]?.displayName ? 'bg-indigo-600' : 'bg-white/10'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
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
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none" placeholder="輸入訊息..." />
                <button className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 rounded-xl">🚀</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
