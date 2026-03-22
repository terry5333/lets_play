'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { useRouter } from 'next/navigation';

export default function Lobby({ 
  user, myScore, leaderboard, changeAvatar, handleCreateRoom, handleJoinRoom 
}) {
  const router = useRouter();
  const [joinInput, setJoinInput] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); 
  const [selectedGame, setSelectedGame] = useState('boomcat'); 
  
  const [roomRules, setRoomRules] = useState({
    maxPlayers: 5, fastMode: false, startWithDefuse: true, 
    drawRounds: 2, drawTime: 60, winLines: 3,
    evilRounds: 3, promptMode: 'ai', fillTime: 60 
  });

  useEffect(() => {
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    if (user?.email && adminEmails.includes(user.email.toLowerCase())) setIsAdmin(true);
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-12 relative z-10 text-white">
      {/* 頂部 */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-10 md:mb-16">
        <h1 className="text-xl font-black tracking-[0.3em] italic uppercase">Game Bar</h1>
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-2xl border border-white/10 p-2 pr-6 rounded-full">
          {isAdmin && <button onClick={() => router.push('/admin')} className="text-[10px] font-black text-rose-500 border border-rose-500/30 px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all">ADMIN</button>}
          <button onClick={changeAvatar} className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-white/10"><img src={user?.photoURL} className="w-full h-full object-cover" /></button>
          <div className="flex flex-col"><span className="text-xs font-bold">{user?.displayName}</span><span className="text-[9px] text-yellow-400 font-bold uppercase">Score: {myScore}</span></div>
          <div className="h-4 w-px bg-white/10 mx-2"></div>
          <button onClick={() => signOut(auth)} className="text-[10px] text-white/30 hover:text-rose-400">登出</button>
        </div>
      </div>
      
      {/* 操作 */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
        <button onClick={() => { setShowCreateModal(true); setCreateStep(1); }} className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-12 text-left hover:bg-white/[0.05] transition-all">
          <h2 className="text-4xl font-black mb-4">開創包廂</h2>
          <p className="text-white/40 text-sm">建立規則，邀請好友。</p>
        </button>
        <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-12 flex flex-col justify-center">
          <h2 className="text-4xl font-black mb-6">加入連線</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleJoinRoom(joinInput); }} className="space-y-4">
            <input type="text" placeholder="房號" value={joinInput} onChange={e=>setJoinInput(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-full py-4 text-center font-mono text-2xl outline-none focus:border-cyan-500/50" />
            <button className="w-full py-4 bg-white text-black rounded-full font-black uppercase">連線</button>
          </form>
        </div>
      </div>

      {/* 彈窗：解決手機按不到按鈕問題 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="w-full max-w-2xl max-h-[90dvh] flex flex-col bg-[#0e0e12] border border-white/10 rounded-[3rem] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-2xl font-black">{createStep === 1 ? '選擇遊戲' : '規則設定'}</h2>
              <button onClick={()=>setShowCreateModal(false)} className="text-white/20 hover:text-white font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
              {createStep === 1 ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'boomcat', n: '炸彈貓', i: '🐈‍⬛', c: 'indigo' },
                    { id: 'drawguess', n: '你畫我猜', i: '🎨', c: 'emerald' },
                    { id: 'bingo', n: '賓果', i: '🎱', c: 'fuchsia' },
                    { id: 'evilfills', n: '惡搞填空', i: '🤪', c: 'yellow' }
                  ].map(g => (
                    <div key={g.id} onClick={()=>setSelectedGame(g.id)} className={`p-6 rounded-3xl border-2 transition-all cursor-pointer text-center ${selectedGame === g.id ? `border-${g.c}-500 bg-white/5` : 'border-white/5 hover:bg-white/5'}`}>
                      <div className="text-4xl mb-2">{g.i}</div>
                      <div className="font-bold">{g.n}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                     <span>人數上限</span>
                     <div className="flex items-center gap-4">
                       <button onClick={()=>setRoomRules({...roomRules, maxPlayers: Math.max(2, roomRules.maxPlayers-1)})} className="w-8 h-8 bg-white/10 rounded-full">-</button>
                       <span className="font-mono font-bold">{roomRules.maxPlayers}</span>
                       <button onClick={()=>setRoomRules({...roomRules, maxPlayers: Math.min(10, roomRules.maxPlayers+1)})} className="w-8 h-8 bg-white/10 rounded-full">+</button>
                     </div>
                   </div>
                   {selectedGame === 'evilfills' && (
                     <div className="space-y-4">
                       <div className="grid grid-cols-3 gap-2">
                         {['ai', 'turn', 'custom'].map(m => (
                           <button key={m} onClick={()=>setRoomRules({...roomRules, promptMode: m})} className={`py-2 rounded-xl text-[10px] font-bold border ${roomRules.promptMode === m ? 'bg-yellow-500 text-black border-yellow-500' : 'border-white/10'}`}>
                             {m === 'ai' ? 'AI出題' : m === 'turn' ? '玩家決定' : '全員投稿'}
                           </button>
                         ))}
                       </div>
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="p-8 border-t border-white/5 flex gap-4">
              {createStep === 2 && <button onClick={()=>setCreateStep(1)} className="px-6 py-4 bg-white/5 rounded-full font-bold">返回</button>}
              <button onClick={() => createStep === 1 ? setCreateStep(2) : handleCreateRoom(selectedGame, roomRules)} className="flex-1 py-4 bg-white text-black rounded-full font-black">
                {createStep === 1 ? '下一步' : '開啟包廂'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
