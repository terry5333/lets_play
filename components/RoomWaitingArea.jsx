'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update } from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
// 這裡請替換成你專案中實際的 firebase 初始化路徑
import { database, auth } from '../lib/firebaseConfig'; 

export default function RoomWaitingArea({ roomId = "1234" }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState({});
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // 1. 處理匿名登入與加入房間
  useEffect(() => {
    signInAnonymously(auth)
      .then((result) => {
        const user = result.user;
        setCurrentUser(user);
        
        // 將玩家加入房間節點
        const playerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
        set(playerRef, {
          displayName: `Player_${user.uid.slice(0, 4)}`, // 預設給個隨機名字
          isReady: false,
          joinedAt: Date.now(),
        });
      })
      .catch((error) => console.error("登入失敗:", error));
  }, [roomId]);

  // 2. 監聽玩家與聊天室狀態
  useEffect(() => {
    if (!currentUser) return;

    const playersRef = ref(database, `rooms/${roomId}/players`);
    const chatRef = ref(database, `rooms/${roomId}/chat`);

    const unsubPlayers = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) setPlayers(snapshot.val());
    });

    const unsubChat = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const chatArray = Object.values(snapshot.val()).sort((a, b) => a.timestamp - b.timestamp);
        setMessages(chatArray);
      }
    });

    return () => {
      unsubPlayers();
      unsubChat();
    };
  }, [roomId, currentUser]);

  // 3. 處理準備狀態切換
  const toggleReady = () => {
    if (!currentUser) return;
    const isCurrentlyReady = players[currentUser.uid]?.isReady || false;
    const playerRef = ref(database, `rooms/${roomId}/players/${currentUser.uid}`);
    update(playerRef, { isReady: !isCurrentlyReady });
  };

  // 4. 發送訊息
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;

    const chatRef = ref(database, `rooms/${roomId}/chat`);
    push(chatRef, {
      senderId: currentUser.uid,
      senderName: players[currentUser.uid]?.displayName || "Unknown",
      text: chatInput,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-8 text-white font-sans">
      
      {/* 頂部導覽 */}
      <div className="absolute top-8 left-12 right-12 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-wider">我的遊戲吧 <span className="text-sm font-normal text-white/60">房間 #{roomId} - 炸彈貓</span></h1>
        <button className="bg-white/10 hover:bg-white/20 border border-white/20 transition-all rounded-[3rem] px-6 py-2 backdrop-blur-md">
          複製邀請碼
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
        
        {/* 左側：遊戲卡片 (炸彈貓示意) */}
        <div className="col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-8 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(120,119,198,0.1)]">
           {/* 這裡可以放我們先前設計的極簡貓臉 SVG */}
           <div className="w-32 h-32 border-2 border-indigo-400/50 rounded-full flex items-center justify-center mb-6">
              <span className="text-indigo-300">貓臉圖標</span>
           </div>
           <h2 className="text-3xl font-bold">炸彈貓</h2>
        </div>

        {/* 中間：房間玩家列表 */}
        <div className="col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-8 flex flex-col">
          <h3 className="text-xl mb-6 font-semibold">房間玩家 ({Object.keys(players).length}/5)</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {Object.entries(players).map(([uid, player]) => (
              <div key={uid} className="flex justify-between items-center bg-white/5 rounded-[3rem] px-6 py-4 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/30 rounded-full"></div>
                  <span>{player.displayName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${player.isReady ? 'bg-green-400 shadow-[0_0_10px_#4ade80]' : 'bg-red-400'}`}></div>
                  <span className="text-sm text-white/70">{player.isReady ? '已準備' : '未準備'}</span>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={toggleReady}
            className="mt-6 w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-4 rounded-[3rem] transition-colors shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            {players[currentUser?.uid]?.isReady ? '取消準備' : '我已準備！'}
          </button>
        </div>

        {/* 右側：聊天室 */}
        <div className="col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-8 flex flex-col">
          <h3 className="text-xl mb-6 font-semibold">房間聊天室</h3>
          <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2">
            {messages.map((msg, index) => (
              <div key={index} className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 border border-white/5">
                <div className="text-xs text-indigo-300 mb-1">{msg.senderName}</div>
                <div className="text-sm">{msg.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="發送訊息..." 
              className="w-full bg-black/20 border border-white/10 rounded-[3rem] py-4 pl-6 pr-16 text-white outline-none focus:border-indigo-400/50 transition-colors"
            />
            <button type="submit" className="absolute right-2 top-2 bottom-2 bg-white/10 hover:bg-white/20 rounded-[3rem] px-4 transition-colors">
              ➤
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
