'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, remove, update, set, push } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function AdminPanel({ user, handleBackToLobby }) {
  const [activeTab, setActiveTab] = useState('rooms'); 
  const [allUsers, setAllUsers] = useState({});
  const [allRooms, setAllRooms] = useState({});
  const [sysConfig, setSysConfig] = useState({ maintenance: false });
  const [adminLogs, setAdminLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 👁️ 監視模式狀態
  const [inspectingRoomId, setInspectingRoomId] = useState(null);
  const [inspectingData, setInspectingData] = useState(null);

  useEffect(() => {
    onValue(ref(database, 'users'), (snap) => setAllUsers(snap.val() || {}));
    onValue(ref(database, 'rooms'), (snap) => setAllRooms(snap.val() || {}));
    onValue(ref(database, 'system/config'), (snap) => setSysConfig(snap.val() || {}));
    onValue(ref(database, 'system/logs'), (snap) => {
      const data = snap.val() ? Object.values(snap.val()).reverse().slice(0, 10) : [];
      setAdminLogs(data);
    });
  }, []);

  // 📡 當選擇監視特定房間時，開啟獨立監聽
  useEffect(() => {
    if (inspectingRoomId) {
      const roomRef = ref(database, `rooms/${inspectingRoomId}`);
      const unsub = onValue(roomRef, (snap) => setInspectingData(snap.val()));
      return () => unsub();
    } else {
      setInspectingData(null);
    }
  }, [inspectingRoomId]);

  const logAction = (action) => {
    push(ref(database, 'system/logs'), { admin: user.displayName, action, timestamp: Date.now() });
  };

  const handleKillRoom = async (roomId) => {
    if (confirm(`⚠️ 確定要強制解散 ${roomId} 號包廂嗎？`)) {
      await remove(ref(database, `rooms/${roomId}`));
      logAction(`強制解散房間: ${roomId}`);
      if (inspectingRoomId === roomId) setInspectingRoomId(null);
    }
  };

  const filteredUsers = Object.entries(allUsers).filter(([uid, u]) => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || uid.includes(searchQuery)
  ).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

  // --- 渲染上帝視角介面 ---
  const renderInspector = () => {
    if (!inspectingData) return <div className="p-10 text-center opacity-30 italic">正在載入數據流...</div>;
    const { info, gameState, players } = inspectingData;
    
    return (
      <div className="animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-8 bg-white/5 p-6 rounded-[2rem] border border-white/10">
          <div className="flex items-center gap-4">
            <span className="text-4xl">👁️</span>
            <div>
              <h2 className="text-2xl font-black text-rose-500 font-mono tracking-tighter">SPECTATING ROOM: {inspectingRoomId}</h2>
              <p className="text-[10px] text-white/40 tracking-[0.3em] font-mono uppercase">{info?.gameMode} // STATUS: {gameState?.status}</p>
            </div>
          </div>
          <button onClick={() => setInspectingRoomId(null)} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-all">結束監視</button>
        </div>

        {/* --- 💣 炸彈貓上帝視角 --- */}
        {info?.gameMode === 'boomcat' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* 牌庫預知 */}
            <div className="bg-black/40 border border-white/10 rounded-[2.5rem] p-8">
              <h3 className="text-sm font-black text-rose-400 mb-6 flex items-center gap-2">🔍 牌庫剩餘順序 (從最上面開始)</h3>
              <div className="flex flex-wrap gap-2">
                {gameState?.deck?.map((card, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${card === 'boom' ? 'bg-rose-500/20 border-rose-500 text-rose-500 animate-pulse' : 'bg-white/5 border-white/20 text-white/60'}`}>
                    {i+1}. {card === 'boom' ? '💣 炸彈' : card === 'defuse' ? '🛡️ 拆除' : card}
                  </div>
                ))}
                {!gameState?.deck && <span className="text-white/20 italic">牌庫已空</span>}
              </div>
            </div>

            {/* 玩家手牌透視 */}
            <div className="bg-black/40 border border-white/10 rounded-[2.5rem] p-8">
              <h3 className="text-sm font-black text-rose-400 mb-6 flex items-center gap-2">🃏 玩家手牌即時情報</h3>
              <div className="space-y-4">
                {Object.entries(gameState?.hands || {}).map(([uid, hand]) => (
                  <div key={uid} className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <img src={players[uid]?.avatar} className="w-5 h-5 rounded-full" />
                      <span className="text-xs font-bold text-white/80">{players[uid]?.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {hand.map((card, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded text-[9px] font-bold ${card === 'defuse' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
                          {card}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 🎱 賓果全體掃描 --- */}
        {info?.gameMode === 'bingo' && (
          <div className="space-y-8">
            <div className="bg-fuchsia-600/10 border border-fuchsia-500/20 p-6 rounded-3xl flex items-center justify-between">
              <h3 className="text-sm font-black text-fuchsia-400">🎯 全服已開號：{gameState?.calledNumbers?.join(' , ') || '無'}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {Object.entries(gameState?.playerBoards || {}).map(([uid, board]) => {
                const isWinner = gameState?.winner === uid;
                return (
                  <div key={uid} className={`bg-black/40 border rounded-[2rem] p-5 transition-all ${isWinner ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.2)]' : 'border-white/10'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={players[uid]?.avatar} className="w-8 h-8 rounded-full border border-white/10" />
                      <span className="text-xs font-bold">{players[uid]?.name} {isWinner && '👑'}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {board.map((num, i) => (
                        <div key={i} className={`aspect-square flex items-center justify-center text-[10px] font-black rounded ${gameState?.calledNumbers?.includes(num) ? 'bg-fuchsia-500/40 text-white border border-fuchsia-500/50' : 'bg-white/5 text-white/30'}`}>
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 🎨 你畫我猜監視 (簡單顯示數據) --- */}
        {info?.gameMode === 'drawguess' && (
          <div className="bg-black/40 border border-white/10 rounded-[2.5rem] p-10 text-center">
            <h3 className="text-xl font-black text-emerald-400 mb-4 tracking-widest">目前題目：{gameState?.currentWord || '尚未選題'}</h3>
            <p className="text-white/40 font-mono text-xs">此模式建議直接進入房間觀察畫布同步狀況。</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col vibe-font relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50"></div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 z-10 border-b border-rose-500/20 bg-black/60 backdrop-blur-xl gap-4">
        <div className="flex items-center gap-4">
          <button onClick={handleBackToLobby} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center transition-all">←</button>
          <h1 className="text-xl font-black tracking-[0.2em] text-rose-500 uppercase italic">Admin Terminal</h1>
        </div>
        {!inspectingRoomId && (
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {['rooms', 'players', 'system'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>{tab.toUpperCase()}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10 z-10">
        {inspectingRoomId ? renderInspector() : (
          <>
            {activeTab === 'rooms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                {Object.entries(allRooms).map(([roomId, room]) => (
                  <div key={roomId} className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 hover:border-rose-500/50 transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{room.info?.gameMode}</span>
                        <h3 className="text-3xl font-mono font-black tracking-tighter">#{roomId}</h3>
                      </div>
                      <div className={`w-3 h-3 rounded-full animate-pulse ${room.info?.status === 'waiting' ? 'bg-yellow-500' : 'bg-emerald-500'}`}></div>
                    </div>
                    <div className="flex flex-col gap-2 mb-6">
                      <button onClick={() => setInspectingRoomId(roomId)} className="w-full py-2.5 bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border border-cyan-500/20">👁️ 進入監視</button>
                      <button onClick={() => handleKillRoom(roomId)} className="w-full py-2.5 bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all border border-rose-500/20">Kill Connection</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'players' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold tracking-widest text-white/40 uppercase">Player Database</h2>
                  <input type="text" placeholder="搜尋..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-white/5 border border-white/10 rounded-full px-5 py-2 text-xs w-64 outline-none" />
                </div>
                <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/5 text-white/30 uppercase font-mono tracking-tighter border-b border-white/5"><th className="px-8 py-5">Player</th><th className="px-6 py-5">Score</th><th className="px-6 py-5 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map(([uid, u]) => (
                        <tr key={uid} className="hover:bg-white/[0.03]">
                          <td className="px-8 py-4 flex items-center gap-4">
                            <img src={u.avatar} className="w-8 h-8 rounded-full border border-white/10" />
                            <div><div className="font-bold">{u.name}</div><div className="text-[9px] text-white/30 font-mono">{uid}</div></div>
                          </td>
                          <td className="px-6 py-4 font-mono text-yellow-400 font-bold">{u.score || 0}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button onClick={() => set(ref(database, `users/${uid}/score`), (u.score || 0) + 100)} className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px]">+100</button>
                            <button onClick={() => remove(ref(database, `users/${uid}`))} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg text-[10px]">DEL</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="max-w-4xl mx-auto bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-10 text-center">
                <h2 className="text-2xl font-black text-rose-500 mb-6">維修與廣播模式正在開發中...</h2>
                <p className="text-white/40">目前你已經擁有最重要的「監控監視」功能了！</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
