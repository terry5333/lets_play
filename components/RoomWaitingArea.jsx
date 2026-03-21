'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, serverTimestamp } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { database, auth } from '../lib/firebaseConfig';
import TicTacToe from './TicTacToe'; // 確保你有建立這個元件

export default function RoomWaitingArea({ roomId = "1234" }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState({});
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [roomInfo, setRoomInfo] = useState({ status: 'waiting', gameType: 'tic-tac-toe' });
  const [gameState, setGameState] = useState(null);

  // 1. 初始匿名登入與玩家註冊
  useEffect(() => {
    signInAnonymously(auth).then((result) => {
      const user = result.user;
      setCurrentUser(user);
      
      const playerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
      // 只有當玩家不在房間內時才寫入，避免重整時覆蓋狀態
      update(playerRef, {
        uid: user.uid,
        displayName: `玩家 ${user.uid.slice(0, 4)}`,
        isReady: false,
        lastSeen: serverTimestamp(),
      });
    });
  }, [roomId]);

  // 2. 監聽所有即時數據 (房間狀態、玩家、聊天、遊戲數據)
  useEffect(() => {
    if (!currentUser) return;

    const roomRef = ref(database, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRoomInfo(data.info || { status: 'waiting' });
        setPlayers(data.players || {});
        setGameState(data.gameState || null);
        
        if (data.chat) {
          const chatArray = Object.values(data.chat).sort((a, b) => a.timestamp - b.timestamp);
          setMessages(chatArray);
        }
      } else {
        // 如果房間不存在，初始化房間
        set(ref(database, `rooms/${roomId}/info`), {
          status: 'waiting',
          hostId: currentUser.uid,
          gameType: 'tic-tac-toe'
        });
      }
    });

    return () => unsubscribe();
  }, [roomId, currentUser]);

  // 3. 操作邏輯
  const toggleReady = () => {
    const playerRef = ref(database, `rooms/${roomId}/players/${currentUser.uid}`);
    update(playerRef, { isReady: !players[currentUser.uid]?.isReady });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), {
      senderName: players[currentUser.uid]?.displayName || "匿名",
      text: chatInput,
      timestamp: Date.now(),
    });
    setChatInput('');
  };

  const startGame = () => {
    const playerIds = Object.keys(players);
    if (playerIds.length < 2) return alert("至少需要兩位玩家才能開始圈圈叉叉！");

    // 初始化圈圈叉叉遊戲資料
    const initialGame = {
      type: "tic-tac-toe",
      board: Array(9).fill(null),
      currentTurn: playerIds[0],
      winner: null,
      symbols: {
        [playerIds[0]]: "O",
        [playerIds[1]]: "X"
      }
    };

    update(ref(database, `rooms/${roomId}`), {
      "info/status": "playing",
      "gameState": initialGame
    });
  };

  // 判斷是否為房長 (第一個進入的人或是設定好的 hostId)
  const isHost = roomInfo.hostId === currentUser?.uid;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black text-white p-6 md:p-12 font-sans">
      
      {/* 頂部導覽列 */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-12">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tighter">我的遊戲吧</h1>
          <p className="text-indigo-400/80 text-sm">房間 ID: {roomId} • {roomInfo.status === 'playing' ? '遊戲進行中' : '等待玩家中'}</p>
        </div>
        <div className="flex gap-4">
          <div className="hidden md:flex items-center px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-sm">
            管理員模式 <span className="ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          </div>
          <button className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-all active:scale-95">
            複製邀請碼
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {roomInfo.status === 'playing' && gameState ? (
          /* --- A2: 遊戲轉場畫面 --- */
          <div className="flex justify-center items-center py-10">
            <TicTacToe roomId={roomId} gameState={gameState} currentUser={currentUser} />
          </div>
        ) : (
          /* --- A1: 房間等待 UI --- */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* 左側：遊戲資訊卡 */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 flex flex-col items-center text-center shadow-2xl">
                <div className="w-24 h-24 rounded-full border-2 border-indigo-500/30 flex items-center justify-center mb-6 bg-indigo-500/10">
                  <span className="text-4xl">❌</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">圈圈叉叉</h2>
                <p className="text-white/50 text-sm mb-6">經典對戰遊戲，先連成一線者獲勝。</p>
                <div className="w-full h-[1px] bg-white/10 mb-6"></div>
                <div className="text-xs text-white/40 uppercase tracking-widest">目前模式</div>
                <div className="text-indigo-300 font-medium">1 vs 1 對戰</div>
              </div>
            </div>

            {/* 中間：玩家列表 */}
            <div className="lg:col-span-5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold">準備中玩家 ({Object.keys(players).length}/5)</h3>
              </div>
              
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {Object.values(players).map((player) => (
                  <div key={player.uid} className="flex justify-between items-center p-4 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${player.uid === currentUser?.uid ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                        {player.displayName[0]}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {player.displayName}
                          {player.uid === roomInfo.hostId && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/30">房長</span>}
                        </div>
                        <div className="text-xs text-white/40">{player.uid === currentUser?.uid ? '你自己' : '玩家'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-xs font-bold px-3 py-1 rounded-full ${player.isReady ? 'text-green-400 bg-green-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                        {player.isReady ? 'READY' : 'WAITING'}
                      </div>
                      <div className={`w-2 h-2 rounded-full ${player.isReady ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-rose-400'}`}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-4">
                <button 
                  onClick={toggleReady}
                  className={`flex-1 py-4 rounded-[2rem] font-bold transition-all active:scale-95 ${players[currentUser?.uid]?.isReady ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'}`}>
                  {players[currentUser?.uid]?.isReady ? '取消準備' : '我已準備'}
                </button>
                {isHost && (
                  <button 
                    onClick={startGame}
                    className="flex-1 py-4 rounded-[2rem] bg-white text-slate-900 font-bold hover:bg-indigo-100 transition-all active:scale-95 shadow-xl">
                    開始遊戲
                  </button>
                )}
              </div>
            </div>

            {/* 右側：聊天室 */}
            <div className="lg:col-span-4 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 flex flex-col shadow-2xl h-[600px] lg:h-auto">
              <h3 className="text-xl font-bold mb-6">房間頻道</h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                {messages.length === 0 && <div className="text-center text-white/20 mt-10 text-sm italic">尚無訊息，打個招呼吧！</div>}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.senderName === players[currentUser?.uid]?.displayName ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-white/40 mb-1 px-2">{msg.senderName}</span>
                    <div className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${msg.senderName === players[currentUser?.uid]?.displayName ? 'bg-indigo-600 rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="relative">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="輸入訊息..." 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 outline-none focus:border-indigo-500/50 transition-all"
                />
                <button type="submit" className="absolute right-2 top-2 bottom-2 w-10 bg-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-500 transition-all">
                  <span className="transform rotate-[-45deg] translate-y-[-1px]">✈️</span>
                </button>
              </form>
            </div>

          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
