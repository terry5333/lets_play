'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, remove, update, set } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, database } from '../../lib/firebaseConfig';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rooms');
  
  const [allUsers, setAllUsers] = useState({});
  const [allRooms, setAllRooms] = useState({});
  const [sysConfig, setSysConfig] = useState({ maintenance: false });
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingRoomId, setInspectingRoomId] = useState(null);
  const [inspectingData, setInspectingData] = useState(null);

  // 暫存每個玩家正在輸入的分數
  const [editingScores, setEditingScores] = useState({});

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      if (!currentUser || !adminEmails.includes(currentUser.email?.toLowerCase())) {
        router.push('/');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    onValue(ref(database, 'users'), (snap) => setAllUsers(snap.val() || {}));
    onValue(ref(database, 'rooms'), (snap) => setAllRooms(snap.val() || {}));
    onValue(ref(database, 'system/config'), (snap) => setSysConfig(snap.val() || {}));
  }, [user]);

  useEffect(() => {
    if (inspectingRoomId) {
      return onValue(ref(database, `rooms/${inspectingRoomId}`), (snap) => setInspectingData(snap.val()));
    }
  }, [inspectingRoomId]);

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-rose-500 animate-pulse font-mono tracking-[0.5em]">驗證最高權限中...</div>
    </div>
  );

  const handleUpdateScore = (uid) => {
    const newScore = editingScores[uid];
    if (newScore === undefined || isNaN(newScore)) return;
    set(ref(database, `users/${uid}/score`), Number(newScore));
    alert(`玩家積分已更新為: ${newScore}`);
  };

  const handleKillRoom = (id) => confirm(`確定解散房間 ${id}？`) && remove(ref(database, `rooms/${id}`));
  
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    const updates = {};
    Object.keys(allRooms).forEach(id => {
      updates[`rooms/${id}/chat/broadcast_${Date.now()}`] = {
        senderId: 'system', senderName: '📢 系統公告', text: broadcastMsg, timestamp: Date.now()
      };
    });
    await update(ref(database), updates);
    setBroadcastMsg('');
    alert("全服廣播指令已送出");
  };

  const SidebarItem = ({ id, label, icon }) => (
    <button 
      onClick={() => { setActiveTab(id); setInspectingRoomId(null); }}
      className={`w-full flex items-center gap-4 px-6 py-4 transition-all ${activeTab === id ? 'bg-rose-600/20 text-rose-500 border-r-4 border-rose-500' : 'text-white/40 hover:bg-white/5'}`}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-bold tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#08080a] text-white flex vibe-font">
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-2xl z-20 flex flex-col">
        <div className="p-8">
          <h1 className="text-xl font-black text-rose-500 tracking-tighter italic uppercase">GameBar <span className="text-white/80 font-normal">管理後台</span></h1>
        </div>
        <nav className="flex-1 mt-4">
          <SidebarItem id="rooms" label="即時包廂監控" icon="📡" />
          <SidebarItem id="players" label="全服玩家數據" icon="👥" />
          <SidebarItem id="system" label="系統核心設定" icon="⚡" />
        </nav>
        <div className="p-6 border-t border-white/5">
          <button onClick={() => router.push('/')} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all text-white/50 hover:text-white">退出後台</button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto z-10 p-8 lg:p-12">
        {inspectingRoomId ? (
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
            <button onClick={() => setInspectingRoomId(null)} className="text-rose-500 text-xs font-bold mb-4 hover:underline">← 返回清單</button>
            <h2 className="text-4xl font-black mb-8 tracking-tighter">監視中包廂：#{inspectingRoomId}</h2>
            {inspectingData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                  <h3 className="text-rose-500 font-bold mb-6 tracking-widest uppercase text-sm">包廂數據摘要</h3>
                  <div className="space-y-4 font-mono text-sm">
                    <p className="flex justify-between border-b border-white/5 pb-2"><span>遊戲模式:</span> <span className="text-emerald-400">{inspectingData.info?.gameMode}</span></p>
                    <p className="flex justify-between border-b border-white/5 pb-2"><span>當前狀態:</span> <span className="text-yellow-400">{inspectingData.gameState?.status}</span></p>
                    <p className="flex justify-between border-b border-white/5 pb-2"><span>玩家人數:</span> <span>{Object.keys(inspectingData.players || {}).length}</span></p>
                  </div>
                </div>
              </div>
            ) : <p className="text-white/20">同步數據中...</p>}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* 1. 包廂監控 */}
            {activeTab === 'rooms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.entries(allRooms).map(([id, room]) => (
                  <div key={id} className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/[0.05] transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded">{room.info?.gameMode}</span>
                        <h3 className="text-4xl font-mono font-black mt-2 tracking-tighter">#{id}</h3>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${room.info?.status === 'waiting' ? 'bg-yellow-500' : 'bg-emerald-500'} shadow-[0_0_15px_currentColor]`}></div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button onClick={() => setInspectingRoomId(id)} className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs hover:scale-[1.02] transition-transform">👁️ 上帝視角</button>
                      <button onClick={() => handleKillRoom(id)} className="w-full py-3 bg-rose-600/10 text-rose-500 border border-rose-500/20 rounded-xl font-bold text-xs hover:bg-rose-500 hover:text-white transition-all">強制解散</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. 玩家管理 (重點修正：積分輸入) */}
            {activeTab === 'players' && (
              <div className="bg-white/[0.02] border border-white/10 rounded-[3rem] overflow-hidden backdrop-blur-xl shadow-2xl">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                  <h3 className="font-bold text-white/50 tracking-widest uppercase text-xs">全球玩家數據中心</h3>
                  <input 
                    type="text" placeholder="搜尋玩家名稱或 UID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-full px-6 py-2 text-xs outline-none focus:border-rose-500/50 w-64 transition-all"
                  />
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] text-[10px] text-white/30 uppercase tracking-widest">
                      <th className="px-10 py-5">玩家身份</th>
                      <th className="px-6 py-5">當前狀態</th>
                      <th className="px-6 py-5">修改積分 (輸入數值)</th>
                      <th className="px-10 py-5 text-right">危險操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(allUsers).filter(([uid, u]) => u.name?.includes(searchQuery)).map(([uid, u]) => (
                      <tr key={uid} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-10 py-5 flex items-center gap-4">
                          <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                          <div>
                            <div className="font-bold text-sm">{u.name}</div>
                            <div className="text-[9px] text-white/20 font-mono tracking-tighter">{uid}</div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {u.currentRoom ? <span className="text-rose-500 font-mono text-xs animate-pulse">連線中 #{u.currentRoom}</span> : <span className="text-white/20 text-xs">大廳閒置</span>}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <input 
                              type="number"
                              placeholder={u.score || 0}
                              className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-yellow-400 font-mono font-bold text-sm outline-none focus:border-yellow-400 focus:shadow-[0_0_10px_rgba(250,204,21,0.2)] transition-all"
                              onChange={(e) => setEditingScores({ ...editingScores, [uid]: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdateScore(uid)}
                            />
                            <button 
                              onClick={() => handleUpdateScore(uid)}
                              className="text-[10px] font-black text-white/40 hover:text-yellow-400 transition-colors uppercase tracking-widest"
                            >
                              更新
                            </button>
                          </div>
                        </td>
                        <td className="px-10 py-5 text-right">
                          <button onClick={() => confirm("確定抹除此玩家數據？") && remove(ref(database, `users/${uid}`))} className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-4 py-2 rounded-xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest">徹底刪除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. 系統設定 */}
            {activeTab === 'system' && (
              <div className="max-w-3xl mx-auto space-y-8">
                <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 backdrop-blur-xl shadow-2xl">
                  <h3 className="text-xl font-black mb-2 text-rose-500 italic uppercase">Global Broadcast // 全服廣播</h3>
                  <p className="text-white/30 text-xs mb-8">發送訊息至所有正在運行中包廂的聊天室。</p>
                  <div className="space-y-4">
                    <textarea 
                      value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                      placeholder="請輸入廣播內容..."
                      className="w-full bg-black/40 border border-white/10 rounded-[2rem] p-6 text-sm outline-none focus:border-rose-500/50 min-h-[120px] transition-all"
                    />
                    <button onClick={handleBroadcast} className="w-full py-4 bg-rose-600 text-white rounded-[2rem] font-black tracking-[0.2em] hover:bg-rose-500 shadow-xl shadow-rose-950/50 transition-all uppercase">執行廣播指令</button>
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex justify-between items-center shadow-2xl">
                  <div>
                    <h3 className="text-xl font-black text-white/80">伺服器維修模式</h3>
                    <p className="text-white/30 text-xs mt-1 tracking-widest">開啟後將鎖定大廳，禁止創建新包廂。</p>
                  </div>
                  <button 
                    onClick={() => set(ref(database, 'system/config/maintenance'), !sysConfig.maintenance)}
                    className={`px-8 py-3 rounded-full font-bold text-xs transition-all border ${sysConfig.maintenance ? 'bg-rose-600 border-rose-400 text-white shadow-[0_0_15px_#f43f5e]' : 'bg-white/10 border-white/20 text-white/40 hover:text-white'}`}
                  >
                    {sysConfig.maintenance ? '系統維護中' : '伺服器運行中'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
