'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, serverTimestamp } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { database, auth } from '../lib/firebaseConfig';
import TicTacToe from './TicTacToe'; // 💡 請確保 components 資料夾下有這檔案

export default function RoomWaitingArea({ roomId = "1234" }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState({}); // 初始為空物件
  const [messages, setMessages] = useState([]); // 初始為空陣列
  const [chatInput, setChatInput] = useState('');
  const [roomInfo, setRoomInfo] = useState({ status: 'waiting', gameType: 'tic-tac-toe' });
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. 初始匿名登入
  useEffect(() => {
    signInAnonymously(auth).then((result) => {
      setCurrentUser(result.user);
    }).catch(err => console.error("登入失敗", err));
  }, []);

  // 2. 登入後註冊玩家並監聽房間
  useEffect(() => {
    if (!currentUser) return;

    // 先註冊/更新玩家自己
    const myPlayerRef = ref(database, `rooms/${roomId}/players/${currentUser.uid}`);
    update(myPlayerRef, {
      uid: currentUser.uid,
      displayName: `玩家 ${currentUser.uid.slice(0, 4)}`,
      isReady: false,
      lastSeen: serverTimestamp(),
    });

    // 監聽整個房間節點
    const roomRef = ref(database, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRoomInfo(data.info || { status: 'waiting' });
        setPlayers(data.players || {});
        setGameState(data.gameState || null);
        
        // 安全處理聊天訊息
        if (data.chat) {
          const chatArray = Object.values(data.chat).sort((a, b) => a.timestamp - b.timestamp);
          setMessages(chatArray);
        } else {
          setMessages([]);
        }
      } else {
        // 如果房間完全沒資料，由第一個進來的人初始化
        set(ref(database, `rooms/${roomId}/info`), {
          status: 'waiting',
          hostId: currentUser.uid,
          gameType: 'tic-tac-toe'
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, currentUser]);

  // 3. 互動邏輯
  const toggleReady = () => {
    if (!currentUser) return;
    const myReadyStatus = players[currentUser.uid]?.isReady || false;
    update(ref(database, `rooms/${roomId}/players/${currentUser.uid}`), { 
      isReady: !myReadyStatus 
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    push(ref(database, `rooms/${roomId}/chat`), {
      senderName: players[currentUser.uid]?.displayName || "匿名",
      text: chatInput,
      timestamp: Date.now(),
    });
    setChatInput('');
  };

  const startGame = () => {
    const playerIds = Object.keys(players || {});
    if (playerIds.length < 2) return alert("至少需要兩位玩家！");

    const initialGame = {
      board: Array(9).fill(null),
      currentTurn: playerIds[0],
      winner: null,
      symbols: { [playerIds[0]]: "O", [playerIds[1]]: "X" }
    };

    update(ref(database, `rooms/${roomId}`), {
      "info/status": "playing",
      "gameState": initialGame
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
      <div className="animate-pulse text-xl font-light tracking-widest">LOADING VIBE...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white p-6 md:p-12">
      
      <div className="max-w-7xl mx-auto">
        {roomInfo.status === 'playing' && gameState ? (
          /* --- 遊戲畫面 --- */
          <TicTacToe roomId={roomId} gameState={gameState} currentUser={currentUser} />
        ) : (
          /* --- 等待大廳 --- */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* 左側：遊戲卡片 */}
            <div className="lg:col-span-3">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 flex flex-col items-center shadow-2xl">
                <div className="w-20 h-20 rounded-full border border-indigo-500/30 flex items-center justify-center mb-4 bg-indigo-500/10 text-3xl">⭕</div>
                <h2 className="text-2xl font-bold">圈圈叉叉</h2>
                <p className="text-white/40 text-xs mt-2">1 vs 1 經典對決</p>
              </div>
            </div>

            {/* 中間：玩家列表 (關鍵修正處) */}
            <div className="lg:col-span-5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 flex flex-col shadow-2xl">
              <h3 className="text-xl font-bold mb-6">房間玩家 ({Object.keys(players || {}).length}/5)</h3>
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2">
                {/* 💡 這裡加上了 (players ? Object.values(players) : []) 來防止 map 報錯 */}
                {(players ? Object.values(players) : []).map((player) => (
                  <div key={player?.uid || Math.random()} className="flex justify-between items-center p-4 bg-white/5 rounded-3xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">
                        {player?.displayName ? player.displayName[0] : '?'}
                      </div>
                      <span className="font-medium text-sm">
                        {player?.displayName} {player?.uid === roomInfo.hostId && "👑"}
                      </span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${player?.isReady ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-rose-500'}`}></div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <button onClick={toggleReady} className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all font-bold">
                  {players[currentUser?.uid]?.isReady ? '取消準備' : '我已準備'}
                </button>
                {roomInfo.hostId === currentUser?.uid && (
                  <button onClick={startGame} className="flex-1 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 font-bold transition-all">
                    開始遊戲
                  </button>
                )}
              </div>
            </div>

            {/* 右側：聊天室 */}
            <div className="lg:col-span-4 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 flex flex-col shadow-2xl h-[500px]">
              <h3 className="text-xl font-bold mb-4 text-white/80">即時頻道</h3>
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                {/* 💡 這裡加上了 (messages || []) 來防止 map 報錯 */}
                {(messages || []).map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg?.senderName === players[currentUser?.uid]?.displayName ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl text-sm ${msg?.senderName === players[currentUser?.uid]?.displayName ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/90'}`}>
                      {msg?.text}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="relative">
                <input 
                  type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  placeholder="說點什麼..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 outline-none focus:border-indigo-500/50"
                />
                <button type="submit" className="absolute right-2 top-2 bottom-2 w-8 bg-indigo-600 rounded-lg">🚀</button>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
