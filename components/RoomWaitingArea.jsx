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
    signInAnonymously(auth).then(res => setCurrentUser(res.user));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    
    // 🛡️ 離線自動清理：關掉視窗就踢掉玩家
    const myPlayerRef = ref(database, `rooms/${roomId}/players/${currentUser.uid}`);
    onDisconnect(myPlayerRef).remove();

    // 註冊玩家資訊
    set(myPlayerRef, {
      uid: currentUser.uid,
      displayName: `玩家 ${currentUser.uid.slice(0, 4)}`,
      isReady: false,
      joinedAt: serverTimestamp()
    });

    const roomRef = ref(database, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val() || {};
      
      // 👑 強行奪權邏輯：如果目前沒有房長，或是房長不在玩家名單裡，就把我設為房長
      const playerList = data.players || {};
      if (!data.info?.hostId || !playerList[data.info.hostId]) {
        update(ref(database, `rooms/${roomId}/info`), { 
          status: 'waiting', 
          hostId: currentUser.uid 
        });
      }

      setRoomInfo(data.info || { status: 'waiting' });
      setPlayers(playerList);
      setGameState(data.gameState || null);
      setMessages(data.chat ? Object.values(data.chat).sort((a,b) => a.timestamp - b.timestamp) : []);
      setIsLoaded(true);
    });
  }, [roomId, currentUser]);

  const handleStart = () => {
    const ids = Object.keys(players || {});
    update(ref(database, `rooms/${roomId}`), {
      "info/status": "playing",
      "gameState": {
        board: Array(9).fill(null),
        currentTurn: ids[0],
        symbols: { [ids[0]]: "O", [ids[1] || 'bot']: "X" }
      }
    });
  };

  // 房長判斷邏輯
  const isHost = roomInfo.hostId === currentUser?.uid;

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#020205] flex items-center justify-center">
      <div className="text-indigo-400 font-light tracking-[1em] animate-pulse">連線中</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#05050a] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a3a] via-[#05050a] to-black text-white p-4 md:p-10">
      
      <div className="max-w-6xl mx-auto">
        {roomInfo.status === 'playing' && gameState?.board ? (
          <TicTacToe roomId={roomId} gameState={gameState} currentUser={currentUser} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-4">
            
            {/* 左側大廳 - 超大圓角磨砂玻璃 */}
            <div className="lg:col-span-7 bg-white/[0.03] border border-white/10 backdrop-blur-2xl rounded-[3.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <h1 className="text-4xl font-black tracking-tight mb-2 italic">遊戲大廳</h1>
                  <p className="text-white/20 text-xs tracking-widest uppercase font-bold">房號: {roomId}</p>
                </div>
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-white/40 tracking-widest">
                  ONLINE: {Object.keys(players).length}
                </div>
              </div>

              <div className="space-y-4">
                {Object.values(players).map(p => (
                  <div key={p.uid} className="flex justify-between items-center p-6 bg-white/[0.02] rounded-[2.5rem] border border-white/5 hover:bg-white/[0.05] transition-all duration-300">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-inner">
                        👤
                      </div>
                      <div>
                        <span className="text-lg font-bold block">{p.displayName}</span>
                        {p.uid === roomInfo.hostId && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-black tracking-widest uppercase">房長 👑</span>}
                      </div>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full ${p.isReady ? 'bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.8)]' : 'bg-white/10'}`} />
                  </div>
                ))}
              </div>

              <div className="mt-12 flex gap-4">
                <button 
                  onClick={() => update(ref(database, `rooms/${roomId}/players/${currentUser.uid}`), { isReady: !players[currentUser.uid]?.isReady })}
                  className="flex-1 py-6 bg-white/5 hover:bg-white/10 rounded-[2.5rem] font-bold border border-white/10 transition-all active:scale-95"
                >
                  {players[currentUser?.uid]?.isReady ? '取消準備' : '準備好了'}
                </button>
                
                {/* 👑 確定會出現的開始按鈕 */}
                {isHost && (
                  <button 
                    onClick={handleStart}
                    className="flex-1 py-6 bg-white text-black rounded-[2.5rem] font-black shadow-[0_15px_40px_rgba(255,255,255,0.15)] hover:bg-indigo-50 transition-all active:scale-95 text-lg"
                  >
                    開始遊戲
                  </button>
                )}
              </div>
            </div>

            {/* 右側聊天室 - 區分發言對象 */}
            <div className="lg:col-span-5 bg-white/[0.03] border border-white/10 backdrop-blur-2xl rounded-[3.5rem] p-8 flex flex-col h-[650px] shadow-2xl overflow-hidden">
              <h3 className="text-xl font-black mb-8 text-white/60 tracking-tighter">聊天頻道</h3>
              <div className="flex-1 overflow-y-auto space-y-5 mb-6 pr-2 scrollbar-hide">
                {messages.map((m, i) => {
                  const isMe = m.senderId === currentUser?.uid;
                  return (
                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && <span className="text-[10px] text-white/20 ml-3 mb-1 font-bold">{m.senderName}</span>}
                      <div className={`px-5 py-3 rounded-[1.8rem] text-sm leading-relaxed max-w-[85%] ${isMe ? 'bg-indigo-600 rounded-tr-none' : 'bg-white/5 rounded-tl-none border border-white/5'}`}>
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
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-5 px-6 outline-none focus:border-indigo-500/50 placeholder:text-white/10" 
                  placeholder="輸入訊息..." 
                />
                <button className="absolute right-3 top-2.5 bottom-2.5 px-6 bg-white/10 hover:bg-white/20 rounded-2xl transition-all font-bold text-xs uppercase">傳送</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
