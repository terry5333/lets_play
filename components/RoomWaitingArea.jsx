'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, serverTimestamp } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { database, auth } from '../lib/firebaseConfig';

// --- 內部遊戲元件：TicTacToe (直接寫在這裡避免路徑錯誤) ---
function TicTacToeGame({ roomId, gameState, currentUser }) {
  // 🛡️ 防禦：如果遊戲資料還沒準備好，顯示載入中
  if (!gameState || !gameState.board || !Array.isArray(gameState.board)) {
    return <div className="text-white text-center p-10">初始化遊戲畫面中...</div>;
  }

  const { board, currentTurn, winner, symbols } = gameState;

  const handleMove = (index) => {
    if (currentTurn !== currentUser.uid || board[index] || winner) return;
    
    const newBoard = [...board];
    newBoard[index] = symbols[currentUser.uid];
    
    // 勝負判定邏輯
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let gameWinner = null;
    for (let [a,b,c] of lines) {
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        gameWinner = newBoard[a];
      }
    }
    const isDraw = !gameWinner && newBoard.every(cell => cell !== null);

    const playerIds = Object.keys(symbols || {});
    const nextTurn = playerIds.find(id => id !== currentUser.uid);

    update(ref(database, `rooms/${roomId}/gameState`), {
      board: newBoard,
      currentTurn: (gameWinner || isDraw) ? null : nextTurn,
      winner: gameWinner || (isDraw ? 'draw' : null)
    });
  };

  return (
    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
      <div className="text-2xl font-bold mb-8 text-indigo-400">
        {winner ? (winner === 'draw' ? '雙方平手！' : `勝利者: ${winner}`) : 
         (currentTurn === currentUser.uid ? "🌟 輪到你了！" : "💤 對手思考中...")}
      </div>
      <div className="grid grid-cols-3 gap-4 bg-white/5 p-6 rounded-[3rem] border border-white/10 backdrop-blur-md">
        {board.map((cell, i) => (
          <button 
            key={i} onClick={() => handleMove(i)}
            className="w-20 h-20 md:w-24 md:h-24 bg-white/5 rounded-3xl text-4xl font-light hover:bg-white/10 transition-all border border-white/5 flex items-center justify-center"
          >
            {cell === 'O' && <span className="text-cyan-400">○</span>}
            {cell === 'X' && <span className="text-rose-400">×</span>}
          </button>
        ))}
      </div>
      {winner && (
        <button 
          onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })}
          className="mt-8 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-full font-bold shadow-lg shadow-indigo-500/30 transition-all"
        >
          返回大廳
        </button>
      )}
    </div>
  );
}

// --- 主要房間元件 ---
export default function RoomWaitingArea({ roomId = "1234" }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState({});
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [roomInfo, setRoomInfo] = useState({ status: 'waiting' });
  const [gameState, setGameState] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // 1. 匿名登入
  useEffect(() => {
    signInAnonymously(auth).then(res => setCurrentUser(res.user)).catch(e => console.error(e));
  }, []);

  // 2. 監聽 Firebase
  useEffect(() => {
    if (!currentUser) return;
    
    // 註冊/更新我的狀態
    const myRef = ref(database, `rooms/${roomId}/players/${currentUser.uid}`);
    update(myRef, {
      uid: currentUser.uid,
      displayName: `玩家 ${currentUser.uid.slice(0, 4)}`,
      lastSeen: serverTimestamp()
    });

    const roomRef = ref(database, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val() || {};
      
      // 🛡️ 安全地設定所有狀態，確保不會出現 undefined
      setRoomInfo(data.info || { status: 'waiting' });
      setPlayers(data.players || {});
      setGameState(data.gameState || null);
      
      if (data.chat) {
        const chatArr = Object.values(data.chat).sort((a,b) => a.timestamp - b.timestamp);
        setMessages(chatArr);
      } else {
        setMessages([]);
      }
      setIsReady(true);
    });
  }, [roomId, currentUser]);

  // 3. 動作處理
  const toggleReady = () => {
    if (!currentUser || !players[currentUser.uid]) return;
    update(ref(database, `rooms/${roomId}/players/${currentUser.uid}`), {
      isReady: !players[currentUser.uid].isReady
    });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), {
      senderName: players[currentUser?.uid]?.displayName || "匿名",
      text: chatInput,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  const handleStart = () => {
    const ids = Object.keys(players || {});
    if (ids.length < 2) return alert("需要兩位玩家！");
    
    update(ref(database, `rooms/${roomId}`), {
      "info/status": "playing",
      "gameState": {
        board: Array(9).fill(null),
        currentTurn: ids[0],
        winner: null,
        symbols: { [ids[0]]: "O", [ids[1]]: "X" }
      }
    });
  };

  // 🛡️ 最終防線：如果連線還沒好，不准渲染主要 UI
  if (!isReady) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-light tracking-widest">
      CONNECTING TO VIBE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white p-4 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {roomInfo.status === 'playing' ? (
          <TicTacToeGame roomId={roomId} gameState={gameState} currentUser={currentUser} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
            
            {/* 玩家列表 */}
            <div className="lg:col-span-8 bg-white/5 border border-white/10 backdrop-blur-xl rounded-[3rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                房間大廳 <span className="text-sm font-normal text-white/30 tracking-widest">#{roomId}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 🛡️ 這裡用了 Object.values(players || {}) 絕對不會報 map 錯誤 */}
                {Object.values(players || {}).map(p => (
                  <div key={p.uid} className="flex justify-between items-center p-5 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all">
                    <span className="font-medium text-lg">{p.displayName} {p.uid === roomInfo.hostId ? '👑' : ''}</span>
                    <div className={`w-3 h-3 rounded-full ${p.isReady ? 'bg-green-400 shadow-[0_0_12px_#4ade80]' : 'bg-rose-500'}`} />
                  </div>
                ))}
              </div>
              <div className="mt-10 flex gap-4">
                <button onClick={toggleReady} className="flex-1 py-5 bg-white/10 hover:bg-white/20 rounded-3xl font-bold text-lg border border-white/10 transition-all active:scale-95">
                  {players[currentUser?.uid]?.isReady ? '取消準備' : '我已準備'}
                </button>
                {roomInfo.hostId === currentUser?.uid && (
                  <button onClick={handleStart} className="flex-1 py-5 bg-white text-slate-900 hover:bg-indigo-50 rounded-3xl font-bold text-lg transition-all active:scale-95 shadow-xl">
                    開始遊戲
                  </button>
                )}
              </div>
            </div>

            {/* 聊天室 */}
            <div className="lg:col-span-4 bg-white/5 border border-white/10 backdrop-blur-xl rounded-[3rem] p-8 flex flex-col h-[600px] shadow-2xl">
              <h3 className="text-xl font-bold mb-6">即時頻道</h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
                {/* 🛡️ 這裡用了 (messages || []) 絕對不會報 map 錯誤 */}
                {(messages || []).map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.senderName === players[currentUser?.uid]?.displayName ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl text-sm ${m.senderName === players[currentUser?.uid]?.displayName ? 'bg-indigo-600 rounded-tr-none' : 'bg-white/10 rounded-tl-none'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} className="relative">
                <input 
                  value={chatInput} onChange={e => setChatInput(e.target.value)}
                  placeholder="輸入訊息..." className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-indigo-500"
                />
                <button type="submit" className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-all">🚀</button>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
