'use client';

import { useState, useEffect } from 'react';
import { ref, onValue, remove, update, set } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, database } from '../../lib/firebaseConfig'; // 💡 修正點：加上 ../ 回到根目錄
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
      <div className="text-rose-500 animate-pulse font-mono tracking-[0.5em]">AUTHENTICATING GOD_MODE...</div>
    </div>
  );

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
    <div className="min-h-screen bg-[#08080a] text-white flex">
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-2xl z-10 flex flex-col">
        <div className="p-8">
          <h1 className="text-xl font-black text-rose-500 tracking-tighter italic">GAMEBAR <span className="text-white/80">ADMIN</span></h1>
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

      <main className="flex-1 h-screen overflow-y-auto p-8 lg:p-12">
        {inspectingRoomId ? (
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
            <button onClick={() => setInspectingRoomId(null)} className="text-rose-500 text-xs font-bold mb-4 hover:underline">← 返回列表</button>
            <h2 className="text-4xl font-black mb-8">監視中：#{inspectingRoomId}</h2>
            {inspectingData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-8">
                  <h3 className="text-rose-500 font-bold mb-4">遊戲數據</h3>
                  <p className="text-sm">模式：{inspectingData.info?.gameMode}</p>
                  <p className="text-sm">狀態：{inspectingData.gameState?.status}</p>
                </div>
              </div>
            ) : <p>載入中...</p>}
          </div>
        ) : (
          <div>
            {activeTab === 'rooms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.entries(allRooms).map(([id, room]) => (
                  <div key={id} className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8">
                    <h3 className="text-4xl font-mono font-black mb-4">#{id}</h3>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setInspectingRoomId(id)} className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs">👁️ 進入上帝視角</button>
                      <button onClick={() => handleKillRoom(id)} className="w-full py-3 bg-rose-600/10 text-rose-500 rounded-xl font-bold text-xs">強制解散</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'players' && (
              <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.03] text-[10px] text-white/30 uppercase tracking-widest">
                    <tr><th className="px-10 py-5">玩家</th><th className="px-6 py-5">分數</th><th className="px-10 py-5 text-right">操作</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(allUsers).map(([uid, u]) => (
                      <tr key={uid} className="hover:bg-white/[0.02]">
                        <td className="px-10 py-5 flex items-center gap-4">
                          <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                          <div><div className="font-bold text-sm">{u.name}</div><div className="text-[9px] text-white/20">{uid}</div></div>
                        </td>
                        <td className="px-6 py-5 text-yellow-400 font-mono font-bold">{u.score || 0}</td>
                        <td className="px-10 py-5 text-right">
                          <button onClick={() => set(ref(database, `users/${uid}/score`), (u.score || 0) + 100)} className="text-[10px] text-emerald-400 mr-2">+100</button>
                          <button onClick={() => remove(ref(database, `users/${uid}`))} className="text-[10px] text-rose-500">刪除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'system' && (
               <div className="max-w-xl mx-auto bg-white/[0.03] border border-white/10 rounded-[2rem] p-10">
                 <h3 className="text-xl font-black text-rose-500 mb-4">全服即時廣播</h3>
                 <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm mb-4" placeholder="公告內容..." />
                 <button onClick={handleBroadcast} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold">送出廣播指令</button>
               </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
