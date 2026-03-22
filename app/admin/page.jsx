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
  
  // 👁️ 監視狀態
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
    <div className="h-screen bg-[#E5DCC5] flex items-center justify-center">
      <div className="text-[#8B2626] font-serif text-2xl tracking-[0.5em] border-2 border-[#8B2626] p-4">身分確認中...</div>
    </div>
  );

  const handleUpdateScore = (uid, newScore) => {
    if (isNaN(newScore)) return;
    set(ref(database, `users/${uid}/score`), Number(newScore));
  };

  const handleKillRoom = (id) => confirm(`確定執行【強制解散】指令？ (對象：包廂 ${id})`) && remove(ref(database, `rooms/${id}`));
  
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    const updates = {};
    Object.keys(allRooms).forEach(id => {
      updates[`rooms/${id}/chat/broadcast_${Date.now()}`] = {
        senderId: 'system', senderName: '【中央情報局】', text: broadcastMsg, timestamp: Date.now()
      };
    });
    await update(ref(database), updates);
    setBroadcastMsg('');
    alert("電報已發送至全服。");
  };

  const SidebarItem = ({ id, label }) => (
    <button 
      onClick={() => { setActiveTab(id); setInspectingRoomId(null); }}
      className={`w-full text-left px-6 py-4 transition-all font-serif font-bold text-lg border-b-2 border-[#D4C4A8] ${activeTab === id ? 'bg-[#8B2626] text-[#F4EFEA]' : 'text-[#3E3A39] hover:bg-[#D4C4A8]'}`}
    >
      {label}
    </button>
  );

  // --- 👁️ 上帝視角渲染 ---
  const renderInspector = () => {
    if (!inspectingData) return <div className="text-[#8B2626] font-serif p-10 font-bold">讀取機密情報中...</div>;
    
    // 🛡️ 防崩潰安全宣告：確保就算資料還沒生成，變數也不會是 undefined
    const info = inspectingData.info || {};
    const gameState = inspectingData.gameState || {};
    const players = inspectingData.players || {};
    
    return (
      <div className="animate-in fade-in duration-300">
        {/* 監視頭部 */}
        <div className="border-4 border-[#3E3A39] bg-[#E5DCC5] p-6 mb-8 flex justify-between items-end relative">
          <div className="absolute top-0 right-0 bg-[#8B2626] text-[#E5DCC5] px-4 py-1 font-serif text-sm font-bold">極秘 (SECRET)</div>
          <div>
            <button onClick={() => setInspectingRoomId(null)} className="text-[#8B2626] text-sm font-bold mb-2 underline decoration-2">返回卷宗列表</button>
            <h2 className="text-4xl font-serif font-black text-[#3E3A39] tracking-widest">監視對象：第 {inspectingRoomId} 號室</h2>
            {/* 🛡️ 加入安全判斷防止 .toUpperCase() 報錯 */}
            <p className="font-mono text-[#5A5045] font-bold mt-2">任務代號：{info.gameMode?.toUpperCase() || '未知'} // 狀態：{gameState.status?.toUpperCase() || '等待中'}</p>
          </div>
        </div>

        {/* 💣 炸彈貓透視 */}
        {info.gameMode === 'boomcat' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="border-2 border-[#3E3A39] bg-[#F4EFEA] p-6 shadow-[8px_8px_0_#3E3A39]">
              <h3 className="text-xl font-serif font-black text-[#8B2626] border-b-2 border-[#8B2626] pb-2 mb-4">預知牌庫 (由上至下)</h3>
              <div className="flex flex-wrap gap-2">
                {gameState.deck?.map((card, i) => (
                  <div key={i} className={`px-2 py-1 border-2 text-sm font-bold ${card === 'boom' ? 'bg-[#8B2626] text-[#F4EFEA] border-[#8B2626]' : 'bg-white border-[#3E3A39] text-[#3E3A39]'}`}>
                    {i+1}. {card === 'boom' ? '💥 爆發' : card === 'defuse' ? '🛡️ 解除' : card}
                  </div>
                ))}
                {(!gameState.deck || gameState.deck.length === 0) && <span className="text-[#A69B8D] font-bold">目前無牌庫資料</span>}
              </div>
            </div>
            <div className="border-2 border-[#3E3A39] bg-[#F4EFEA] p-6 shadow-[8px_8px_0_#3E3A39]">
              <h3 className="text-xl font-serif font-black text-[#3E3A39] border-b-2 border-[#3E3A39] pb-2 mb-4">目標持有物檢查</h3>
              <div className="space-y-4">
                {Object.entries(gameState.hands || {}).map(([uid, hand]) => (
                  <div key={uid} className="flex flex-col gap-2 p-3 bg-[#E5DCC5] border border-[#D4C4A8]">
                    <div className="flex items-center gap-2 font-bold text-[#8B2626]">
                      <img src={players[uid]?.avatar} className="w-6 h-6 rounded-full border border-[#3E3A39] grayscale" />
                      <span>{players[uid]?.name || '未知特工'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {hand?.map((card, i) => (
                        <span key={i} className="px-2 border border-[#3E3A39] bg-white text-xs font-bold text-[#3E3A39]">{card}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 🎨 你畫我猜透視 */}
        {info.gameMode === 'drawguess' && (
          <div className="border-4 border-[#3E3A39] bg-[#F4EFEA] p-6 shadow-[10px_10px_0_#3E3A39] flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h3 className="text-xl font-serif font-black text-[#8B2626] mb-4">現場筆跡攔截</h3>
              <div className="w-full max-w-[500px] aspect-square border-2 border-[#3E3A39] bg-white relative mx-auto md:mx-0">
                {gameState.status === 'drawing' ? (
                  <iframe src={`https://wbo.ophir.dev/boards/vibe_dg_${inspectingRoomId}_r${gameState.currentRound || 1}_p${gameState.currentDrawerIdx || 0}`} className="w-full h-full border-none pointer-events-none" scrolling="no" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#A69B8D] font-serif font-bold text-center p-4">目標目前未在作畫<br/>(需等待進入作畫階段)</div>
                )}
              </div>
            </div>
            <div className="w-full md:w-64">
              <h3 className="text-xl font-serif font-black text-[#3E3A39] mb-4">機密答案</h3>
              <div className="bg-[#E5DCC5] border-2 border-[#3E3A39] p-4 text-center text-3xl font-black text-[#8B2626] mb-6">
                {gameState.currentWord || '尚未選題'}
              </div>
              <h3 className="text-md font-serif font-bold text-[#3E3A39] mb-2">猜對名單</h3>
              <ul className="list-disc pl-5 font-bold text-[#5A5045]">
                {gameState.correctGuesserIds?.map(uid => <li key={uid}>{players[uid]?.name || '未知'}</li>) || <li>無人答對</li>}
              </ul>
            </div>
          </div>
        )}

        {/* 🎱 賓果透視 */}
        {info.gameMode === 'bingo' && (
          <div className="space-y-6">
            <div className="border-2 border-[#8B2626] bg-[#F4EFEA] p-4 text-center">
              <h3 className="text-lg font-serif font-black text-[#8B2626]">已開出之號碼： {gameState.calledNumbers?.join(', ') || '尚未開出'}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {Object.entries(gameState.playerBoards || {}).map(([uid, board]) => (
                <div key={uid} className="border-2 border-[#3E3A39] bg-[#E5DCC5] p-4 shadow-[4px_4px_0_#3E3A39]">
                  <div className="font-bold text-[#3E3A39] mb-2 truncate flex items-center justify-between">
                    <span>{players[uid]?.name || '未知玩家'}</span>
                    {gameState.winner === uid && <span>🏆</span>}
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {board?.map((num, i) => (
                      <div key={i} className={`aspect-square flex items-center justify-center text-xs font-bold border border-[#3E3A39] ${gameState.calledNumbers?.includes(num) ? 'bg-[#8B2626] text-[#F4EFEA]' : 'bg-[#F4EFEA] text-[#3E3A39]'}`}>
                        {num}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4EFEA] text-[#3E3A39] flex flex-col md:flex-row" style={{ fontFamily: '"Noto Serif TC", serif' }}>
      {/* 左側/頂部：控制台目錄 */}
      <aside className="w-full md:w-64 md:min-h-screen bg-[#E5DCC5] border-b-4 md:border-b-0 md:border-r-4 border-[#3E3A39] z-20 flex flex-col shadow-2xl flex-shrink-0">
        <div className="p-6 md:p-8 border-b-4 border-[#3E3A39] flex md:flex-col justify-between md:justify-start items-center md:items-start">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-widest text-[#8B2626]">情報管理局</h1>
            <p className="text-[10px] md:text-xs font-bold mt-1 md:mt-2 text-[#5A5045]">系統管理與處分中心</p>
          </div>
          <button onClick={() => router.push('/')} className="md:hidden border-2 border-[#3E3A39] bg-[#F4EFEA] font-bold text-xs px-4 py-2 shadow-[2px_2px_0_#3E3A39] active:shadow-none active:translate-x-0.5 active:translate-y-0.5">返回</button>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible flex-1 mt-0 md:mt-4 bg-[#D4C4A8] md:bg-transparent">
          <SidebarItem id="rooms" label="卷宗 壹：包廂監視" />
          <SidebarItem id="players" label="卷宗 貳：國民情報" />
          <SidebarItem id="system" label="卷宗 參：總部廣播" />
        </nav>
        <div className="hidden md:block p-6 border-t-4 border-[#3E3A39] bg-[#D4C4A8]">
          <button onClick={() => router.push('/')} className="w-full py-3 border-2 border-[#3E3A39] bg-[#F4EFEA] font-bold text-sm hover:bg-[#3E3A39] hover:text-[#F4EFEA] transition-colors shadow-[4px_4px_0_#3E3A39] active:shadow-none active:translate-x-1 active:translate-y-1">退出管理部</button>
        </div>
      </aside>

      {/* 右側：檔案庫主畫面 */}
      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-10 bg-[url('https://www.transparenttextures.com/patterns/rice-paper.png')] relative">
        {inspectingRoomId ? renderInspector() : (
          <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            
            {/* 1. 包廂監視 */}
            {activeTab === 'rooms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                {Object.keys(allRooms).length === 0 && <div className="col-span-full text-center font-bold text-[#8B2626] mt-10">目前無任何活動包廂。</div>}
                {Object.entries(allRooms).map(([id, room]) => (
                  <div key={id} className="border-4 border-[#3E3A39] bg-[#E5DCC5] p-6 shadow-[8px_8px_0_#3E3A39] flex flex-col relative">
                    <div className="absolute top-2 right-4 text-[#8B2626] font-black text-xl opacity-20 transform rotate-12">極秘</div>
                    <div className="mb-4 border-b-2 border-[#3E3A39] pb-4">
                      <span className="bg-[#3E3A39] text-[#F4EFEA] px-2 py-1 text-xs font-bold tracking-widest">{room.info?.gameMode === 'boomcat' ? '炸彈貓' : room.info?.gameMode === 'drawguess' ? '你畫我猜' : room.info?.gameMode === 'bingo' ? '賓果' : '未知'}</span>
                      <h3 className="text-4xl font-mono font-black mt-3 text-[#8B2626]">#{id}</h3>
                    </div>
                    <div className="flex gap-4 mt-auto pt-4">
                      <button onClick={() => setInspectingRoomId(id)} className="flex-1 py-2 border-2 border-[#3E3A39] bg-white font-bold text-sm hover:bg-[#3E3A39] hover:text-white transition-colors shadow-[4px_4px_0_#3E3A39] active:shadow-none active:translate-y-1 active:translate-x-1">👁️ 調查</button>
                      <button onClick={() => handleKillRoom(id)} className="flex-1 py-2 border-2 border-[#8B2626] bg-[#8B2626] text-white font-bold text-sm hover:bg-rose-700 transition-colors shadow-[4px_4px_0_#3E3A39] active:shadow-none active:translate-y-1 active:translate-x-1">處分</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. 國民情報 */}
            {activeTab === 'players' && (
              <div className="border-4 border-[#3E3A39] bg-[#E5DCC5] shadow-[12px_12px_0_#3E3A39] overflow-hidden">
                <div className="p-4 md:p-6 border-b-4 border-[#3E3A39] flex flex-col md:flex-row justify-between items-start md:items-center bg-[#D4C4A8] gap-4">
                  <h3 className="font-black text-[#8B2626] tracking-widest text-lg md:text-xl">全域身家調查表</h3>
                  <input type="text" placeholder="搜尋姓名..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full md:w-auto border-2 border-[#3E3A39] bg-[#F4EFEA] px-4 py-2 font-bold outline-none focus:bg-white" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-bold min-w-[600px]">
                    <thead>
                      <tr className="bg-[#3E3A39] text-[#F4EFEA] tracking-widest whitespace-nowrap">
                        <th className="px-6 py-4">國民姓名</th>
                        <th className="px-6 py-4">行蹤</th>
                        <th className="px-6 py-4">配給點數</th>
                        <th className="px-6 py-4 text-right">行政手續</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-[#3E3A39]">
                      {Object.entries(allUsers).filter(([uid, u]) => u.name?.includes(searchQuery)).map(([uid, u]) => (
                        <tr key={uid} className="hover:bg-[#D4C4A8] transition-colors">
                          <td className="px-6 py-4 flex items-center gap-4">
                            <img src={u.avatar} className="w-10 h-10 border-2 border-[#3E3A39] grayscale sepia flex-shrink-0" />
                            <div className="text-sm md:text-lg text-[#8B2626] truncate max-w-[150px] md:max-w-none">{u.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{u.currentRoom ? `第 ${u.currentRoom} 號室` : '遊蕩中'}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" defaultValue={u.score || 0}
                                onBlur={(e) => handleUpdateScore(uid, e.target.value)}
                                className="w-20 md:w-24 border-2 border-[#3E3A39] bg-white px-2 py-1 text-center outline-none focus:bg-yellow-100 font-mono"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => confirm("確認執行徹底抹消？") && remove(ref(database, `users/${uid}`))} className="border-2 border-[#8B2626] text-[#8B2626] bg-[#F4EFEA] px-3 py-1 text-sm font-black hover:bg-[#8B2626] hover:text-white transition-colors shadow-[2px_2px_0_#8B2626] active:shadow-none active:translate-x-0.5 active:translate-y-0.5">抹消</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. 系統廣播 */}
            {activeTab === 'system' && (
              <div className="max-w-2xl border-4 border-[#3E3A39] bg-[#E5DCC5] p-6 md:p-10 shadow-[12px_12px_0_#3E3A39]">
                <h3 className="text-2xl md:text-3xl font-black mb-2 text-[#8B2626] tracking-widest border-b-4 border-[#3E3A39] pb-4">緊急廣播發報機</h3>
                <p className="text-[#5A5045] font-bold mb-8 mt-4 text-sm md:text-base">此電報將會強制發送至所有國民之終端畫面。</p>
                <div className="space-y-6">
                  <textarea 
                    value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                    placeholder="輸入電文..."
                    className="w-full border-4 border-[#3E3A39] bg-[#F4EFEA] p-4 font-bold outline-none focus:bg-white min-h-[150px]"
                  />
                  <button onClick={handleBroadcast} className="w-full py-4 border-4 border-[#8B2626] bg-[#8B2626] text-[#F4EFEA] font-black text-lg md:text-xl tracking-[0.5em] hover:bg-rose-800 transition-colors shadow-[6px_6px_0_#3E3A39] active:shadow-none active:translate-y-1 active:translate-x-1">發送電報</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
