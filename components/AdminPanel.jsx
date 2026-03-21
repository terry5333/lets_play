'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, remove, update, set } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function AdminPanel({ user, handleBackToLobby }) {
  const [allUsers, setAllUsers] = useState({});
  const [allRooms, setAllRooms] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // 📡 監聽全伺服器資料
  useEffect(() => {
    const usersRef = ref(database, 'users');
    const roomsRef = ref(database, 'rooms');

    const unsubUsers = onValue(usersRef, (snap) => setAllUsers(snap.val() || {}));
    const unsubRooms = onValue(roomsRef, (snap) => setAllRooms(snap.val() || {}));

    return () => { unsubUsers(); unsubRooms(); };
  }, []);

  // 💥 破壞神權限：強制關閉房間
  const handleKillRoom = async (roomId) => {
    if (confirm(`⚠️ 確定要強制解散 ${roomId} 號包廂嗎？裡面的人會被踢出。`)) {
      await remove(ref(database, `rooms/${roomId}`));
    }
  };

  // 👑 造物主權限：修改玩家分數
  const handleEditScore = async (uid, currentScore) => {
    const newScore = prompt(`請輸入新的分數 (目前: ${currentScore})`, currentScore);
    if (newScore !== null && !isNaN(newScore)) {
      await set(ref(database, `users/${uid}/score`), Number(newScore));
    }
  };

  // 🗑️ 刪除死帳號 (無綁定、無分數的幽靈)
  const handleDeleteUser = async (uid, name) => {
    if (confirm(`⚠️ 確定要刪除玩家「${name}」的資料庫紀錄嗎？`)) {
      await remove(ref(database, `users/${uid}`));
    }
  };

  const filteredUsers = Object.entries(allUsers).filter(([uid, u]) => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || uid.includes(searchQuery)
  ).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-rose-500/30">
      
      {/* 🔴 警戒紅光暈 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-rose-700/10 blur-[150px] rounded-full animate-pulse duration-[5s]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="flex justify-between items-center p-6 z-10 border-b border-rose-500/20 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={handleBackToLobby} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all">
            ←
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-widest text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)] uppercase">System Override</h1>
            <p className="text-[10px] text-white/50 tracking-widest font-mono">GOD MODE ACTIVATED // ADMIN: {user.displayName}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-black/40 border border-rose-500/30 px-6 py-2 rounded-full font-mono text-xs">
            <span className="text-white/50">ACTIVE ROOMS:</span> <span className="text-rose-400 font-bold">{Object.keys(allRooms).length}</span>
          </div>
          <div className="bg-black/40 border border-rose-500/30 px-6 py-2 rounded-full font-mono text-xs">
            <span className="text-white/50">TOTAL PLAYERS:</span> <span className="text-rose-400 font-bold">{Object.keys(allUsers).length}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10 space-y-8">
        
        {/* 房間監控站 */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> 運行中包廂監控</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.keys(allRooms).length === 0 && <div className="text-white/30 text-sm font-mono border border-dashed border-white/10 p-6 rounded-2xl">目前沒有活躍的房間。</div>}
            {Object.entries(allRooms).map(([roomId, room]) => (
              <div key={roomId} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-rose-500/50 transition-colors group relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-mono text-2xl font-black tracking-widest text-white/90">{roomId}</h3>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-sm">{room.info?.gameMode || '未知'}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${room.info?.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {room.info?.status || 'unknown'}
                  </span>
                </div>
                <div className="text-xs text-white/50 mb-4">
                  玩家數：<span className="text-white">{Object.keys(room.players || {}).length}</span> 人
                </div>
                <button onClick={() => handleKillRoom(roomId)} className="w-full py-2 bg-rose-600/20 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold transition-all">
                  強制解散房間
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 玩家資料庫 */}
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-cyan-400"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> 全域玩家資料庫</h2>
            <input 
              type="text" placeholder="搜尋玩家名稱..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs outline-none focus:border-cyan-500/50 w-64"
            />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-black/40 text-white/50 text-[10px] uppercase tracking-widest font-mono">
                <tr>
                  <th className="px-6 py-4">玩家</th>
                  <th className="px-6 py-4">目前狀態</th>
                  <th className="px-6 py-4">總積分</th>
                  <th className="px-6 py-4 text-right">系統操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map(([uid, u]) => (
                  <tr key={uid} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar} className="w-8 h-8 rounded-full border border-white/10 bg-black" />
                        <div className="flex flex-col">
                          <span className="font-bold">{u.name}</span>
                          <span className="text-[9px] text-white/30 font-mono">{uid}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.currentRoom ? (
                        <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">房號 {u.currentRoom}</span>
                      ) : (
                        <span className="text-white/30 text-xs">大廳閒置</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-yellow-400">{u.score || 0}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEditScore(uid, u.score || 0)} className="px-3 py-1.5 bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-400 border border-white/10 hover:border-cyan-500/50 rounded-lg text-xs font-bold transition-all">
                        改分
                      </button>
                      <button onClick={() => handleDeleteUser(uid, u.name)} className="px-3 py-1.5 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 border border-white/10 hover:border-rose-500/50 rounded-lg text-xs font-bold transition-all">
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
