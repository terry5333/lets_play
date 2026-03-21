'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, remove, update, set, push } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, database } from '../lib/firebaseConfig';
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

  // 1. 權限與身份驗證
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      
      if (!currentUser || !adminEmails.includes(currentUser.email?.toLowerCase())) {
        // 如果不是管理員，直接踢走
        router.push('/');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, [router]);

  // 2. 數據監聽
  useEffect(() => {
    if (!user) return;
    onValue(ref(database, 'users'), (snap) => setAllUsers(snap.val() || {}));
    onValue(ref(database, 'rooms'), (snap) => setAllRooms(snap.val() || {}));
    onValue(ref(database, 'system/config'), (snap) => setSysConfig(snap.val() || {}));
  }, [user]);

  // 3. 上帝視角監聽
  useEffect(() => {
    if (inspectingRoomId) {
      return onValue(ref(database, `rooms/${inspectingRoomId}`), (snap) => setInspectingData(snap.val()));
    }
  }, [inspectingRoomId]);

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-rose-500 animate-pulse font-mono tracking-[0.5em]">AUTHENTICATING GOD_MODE...</div>
    </div>
  );

  // --- 操作函數 ---
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
    alert("廣播已送出");
  };

  // --- 介面組件 ---
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
      {/* 🌠 背景光暈 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 blur-[100px] rounded-full"></div>
      </div>

      {/* 側邊導航欄 */}
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-2xl z-10 flex flex-col">
        <div className="p-8">
          <h1 className="text-xl font-black text-rose-500 tracking-tighter italic">GAMEBAR <span className="text-white/80">ADMIN</span></h1>
          <p className="text-[9px] text-white/20 mt-1 font-mono uppercase tracking-[0.2em]">Creative Director View</p>
        </div>
        <nav className="flex-1 mt-4">
          <SidebarItem id="rooms" label="即時房間監控" icon="📡" />
          <SidebarItem id="players" label="全服玩家數據" icon="👥" />
          <SidebarItem id="system" label="系統核心設定" icon="⚡" />
        </nav>
        <div className="p-6 border-t border-white/5">
          <button onClick={() => router.push('/')} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all">返回大廳</button>
        </div>
      </aside>

      {/* 主內容區 */}
      <main className="flex-1 h-screen overflow-y-auto z-10 p-8 lg:p-12">
        
        {inspectingRoomId ? (
          /* 上帝視角：房間分析 */
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex justify-between items-end mb-10">
              <div>
                <button onClick={() => setInspectingRoomId(null)} className="text-rose-500 text-xs font-bold mb-2 block hover:underline">← 返回列表</button>
                <h2 className="text-4xl font-black tracking-tight">監視中：#{inspectingRoomId}</h2>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/30 px-4 py-2 rounded-full text-rose-500 text-xs font-mono">
                LIVE_DATA_FEEDING...
              </div>
            </div>

            {inspectingData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 核心狀態卡 */}
                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl">
                  <h3 className="text-rose-500 font-black text-sm uppercase tracking-widest mb-6">遊戲核心數據</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40 text-sm">遊戲模式</span>
                      <span className="font-bold text-emerald-400">{inspectingData.info?.gameMode}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40 text-sm">當前狀態</span>
                      <span className="font-bold">{inspectingData.gameState?.status}</span>
                    </div>
                    {inspectingData.info?.gameMode === 'boomcat' && (
                      <div className="mt-6">
                        <span className="text-white/40 text-xs block mb-4">下一張預告牌</span>
                        <div className="flex gap-2 flex-wrap">
                          {inspectingData.gameState?.deck?.slice(0, 5).map((card, i) => (
                            <div key={i} className={`px-3 py-2 rounded-lg border ${card === 'boom' ? 'bg-rose-500/20 border-rose-500 text-rose-500 animate-pulse' : 'bg-white/5 border-white/10 text-white/60'} text-[10px] font-bold`}>
                              {i === 0 ? 'NEXT' : i+1}. {card}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 玩家情報卡 */}
                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl">
                  <h3 className="text-rose-500 font-black text-sm uppercase tracking-widest mb-6">連線玩家情報</h3>
                  <div className="space-y-4">
                    {Object.entries(inspectingData.players || {}).map(([uid, p]) => (
                      <div key={uid} className="flex items-center justify-between bg-black/20 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <img src={p.avatar} className="w-8 h-8 rounded-full" />
                          <span className="text-sm font-bold">{p.name}</span>
                        </div>
                        <span className="font-mono text-xs text-yellow-400">
                          {inspectingData.gameState?.scores?.[uid] || 0} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : <div className="text-white/20 italic">正在從資料庫同步數據...</div>}
          </div>
        ) : (
          /* 分頁內容 */
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            
            {/* 1. 房間監控 */}
            {activeTab === 'rooms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.entries(allRooms).map(([id, room]) => (
                  <div key={id} className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/[0.05] transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                      <span className="text-8xl font-black italic">{id}</span>
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded">
                            {room.info?.gameMode}
                          </span>
                          <h3 className="text-4xl font-mono font-black mt-2 tracking-tighter">#{id}</h3>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${room.info?.status === 'waiting' ? 'bg-yellow-500' : 'bg-emerald-500'} shadow-[0_0_15px_currentColor]`}></div>
                      </div>
                      <div className="flex flex-col gap-3 mb-8">
                        <button onClick={() => setInspectingRoomId(id)} className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs hover:scale-[1.02] transition-transform">👁️ 進入上帝視角</button>
                        <button onClick={() => handleKillRoom(id)} className="w-full py-3 bg-rose-600/10 text-rose-500 border border-rose-500/20 rounded-xl font-bold text-xs hover:bg-rose-500 hover:text-white transition-all">強制解散包廂</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. 玩家管理 */}
            {activeTab === 'players' && (
              <div className="bg-white/[0.02] border border-white/10 rounded-[3rem] overflow-hidden backdrop-blur-xl">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                  <h3 className="font-bold text-white/50 tracking-widest uppercase text-xs">全球玩家資料庫</h3>
                  <input 
                    type="text" placeholder="搜尋玩家..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-full px-6 py-2 text-xs outline-none focus:border-rose-500/50 w-64"
                  />
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] text-[10px] text-white/30 uppercase tracking-widest">
                      <th className="px-10 py-5">玩家身份</th>
                      <th className="px-6 py-5">目前狀態</th>
                      <th className="px-6 py-5">總積分</th>
                      <th className="px-10 py-5 text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(allUsers).map(([uid, u]) => (
                      <tr key={uid} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-10 py-5 flex items-center gap-4">
                          <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                          <div>
                            <div className="font-bold text-sm">{u.name}</div>
                            <div className="text-[9px] text-white/20 font-mono">{uid}</div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {u.currentRoom ? <span className="text-rose-500 font-mono text-xs">正在包廂 #{u.currentRoom}</span> : <span className="text-white/20 text-xs">大廳閒置</span>}
                        </td>
                        <td className="px-6 py-5 text-yellow-400 font-mono font-bold">{u.score || 0}</td>
                        <td className="px-10 py-5 text-right">
                          <button onClick={() => set(ref(database, `users/${uid}/score`), (u.score || 0) + 100)} className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/20 mr-2 hover:bg-emerald-400 hover:text-black transition-all">+100</button>
                          <button onClick={() => confirm("刪除？") && remove(ref(database, `users/${uid}`))} className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all">刪除</button>
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
                <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 backdrop-blur-xl">
                  <h3 className="text-xl font-black mb-2 text-rose-500">全服即時廣播</h3>
                  <p className="text-white/30 text-xs mb-8">訊息將會以「系統通知」形式出現在所有進行中房間的聊天室。</p>
                  <div className="space-y-4">
                    <textarea 
                      value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                      placeholder="輸入廣播內容..."
                      className="w-full bg-black/40 border border-white/10 rounded-[2rem] p-6 text-sm outline-none focus:border-rose-500/50 min-h-[120px]"
                    />
                    <button onClick={handleBroadcast} className="w-full py-4 bg-rose-600 text-white rounded-[2rem] font-black tracking-widest hover:bg-rose-500 shadow-xl shadow-rose-950/50 transition-all">發送全服廣播指令</button>
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 backdrop-blur-xl flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black text-white/80">伺服器維護模式</h3>
                    <p className="text-white/30 text-xs mt-1">開啟後大廳將隱藏「開創包廂」按鈕。</p>
                  </div>
                  <button 
                    onClick={() => set(ref(database, 'system/config/maintenance'), !sysConfig.maintenance)}
                    className={`px-8 py-3 rounded-full font-bold text-xs transition-all border ${sysConfig.maintenance ? 'bg-rose-600 border-rose-400' : 'bg-white/10 border-white/20 text-white/40'}`}
                  >
                    {sysConfig.maintenance ? '已開啟維修' : '關閉維修模式'}
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
