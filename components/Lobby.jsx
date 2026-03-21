'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { useRouter } from 'next/navigation';

export default function Lobby({ 
  user, myScore, leaderboard, isGoogleLinked, 
  handleLinkGoogle, changeAvatar, handleWinGameDemo, 
  handleCreateRoom, handleJoinRoom 
}) {
  const router = useRouter();
  const [joinInput, setJoinInput] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminEmailsString = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    const ADMIN_EMAILS = adminEmailsString.split(',').map(email => email.trim().toLowerCase());
    if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      setIsAdmin(true);
    }
  }, [user]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); 
  const [selectedGame, setSelectedGame] = useState('boomcat'); 
  
  const [roomRules, setRoomRules] = useState({
    maxPlayers: 5,
    fastMode: false,        
    drawRounds: 2,          
    drawTime: 60,           
    winLines: 3             
  });

  const handleConfirmCreate = () => {
    handleCreateRoom(selectedGame, roomRules);
    setShowCreateModal(false);
    setCreateStep(1); 
  };

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-12 relative z-10 text-white">
      {/* 頂部導航列 */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-16 px-4">
        <h1 className="text-2xl font-black tracking-[0.3em] uppercase opacity-90 italic">Game Bar</h1>
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-2xl border border-white/10 p-2 pr-6 rounded-full shadow-2xl">
          {isAdmin && (
            <button onClick={() => router.push('/admin')} className="text-[10px] font-black text-rose-500 mr-2 border border-rose-500/30 px-4 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all">⚙️ 系統後台</button>
          )}
          <button onClick={changeAvatar} className="relative w-10 h-10 rounded-full bg-black/40 border border-white/10 overflow-hidden hover:scale-105 transition-transform"><img src={user?.photoURL} alt="avatar" className="w-full h-full object-cover" /></button>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">{user?.displayName}</span>
            <span className="text-[10px] text-yellow-400 font-mono font-bold tracking-widest uppercase">Score: {myScore}</span>
          </div>
          <div className="h-6 w-px bg-white/10 mx-2"></div>
          <button onClick={() => signOut(auth)} className="text-[11px] font-bold text-white/30 hover:text-rose-400 transition-colors">登出</button>
        </div>
      </div>
      
      {/* 主操作按鈕區 */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
        <button onClick={() => { setShowCreateModal(true); setCreateStep(1); }} className="group relative bg-white/[0.03] border border-white/10 rounded-[3.5rem] p-16 text-left hover:bg-white/[0.06] transition-all duration-500 overflow-hidden shadow-2xl">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-600/20 blur-[100px] rounded-full group-hover:bg-fuchsia-600/40 transition-all"></div>
          <h2 className="text-5xl font-black mb-6 tracking-tighter group-hover:text-fuchsia-400 transition-colors">開創包廂</h2>
          <p className="text-white/40 text-lg font-light leading-relaxed max-w-xs">建立專屬包廂，邀請戰友，體驗最頂級的連線 Vibe。</p>
        </button>

        <div className="bg-white/[0.03] border border-white/10 rounded-[3.5rem] p-16 flex flex-col justify-center relative overflow-hidden shadow-2xl">
          <h2 className="text-5xl font-black mb-10 tracking-tighter">加入連線</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleJoinRoom(joinInput); }} className="space-y-6">
            <input type="text" placeholder="輸入 4 位房號" value={joinInput} onChange={e => setJoinInput(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-[2rem] py-8 text-center font-mono text-4xl tracking-[0.4em] outline-none focus:border-cyan-400/50 transition-all placeholder:text-sm placeholder:tracking-normal placeholder:font-sans" />
            <button className="w-full py-6 bg-white text-black rounded-[2rem] font-black text-lg hover:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]">連線進入</button>
          </form>
        </div>
      </div>

      {/* 排行榜區塊 */}
      <div className="w-full max-w-6xl mx-auto bg-white/[0.01] border border-white/5 rounded-[3rem] p-12 backdrop-blur-md">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-2xl font-black tracking-widest uppercase italic text-white/80">全球菁英榜</h2>
          <div className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/40 tracking-[0.3em] uppercase">Global Top 10</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {leaderboard.map((p, index) => (
            <div key={p.uid} className={`flex items-center gap-4 p-6 rounded-[2.5rem] border transition-all hover:scale-105 ${index === 0 ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-white/5 bg-white/[0.02]'}`}>
              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 relative">
                <img src={p.avatar} className="w-full h-full object-cover" />
                {index === 0 && <div className="absolute -top-1 -right-1">👑</div>}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold truncate">{p.name}</span>
                <span className="text-[11px] font-mono text-white/40">{p.score} PTS</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🚀 開創包廂專屬高質感 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-3xl bg-[#0e0e12]/90 border border-white/10 rounded-[4rem] p-10 md:p-14 relative overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] animate-in zoom-in-95">
            
            {/* 裝飾背景 */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-fuchsia-600/10 blur-[120px] rounded-full"></div>
            
            <div className="flex justify-between items-center mb-12 relative z-10">
              <div>
                <h2 className="text-4xl font-black tracking-tight">{createStep === 1 ? '選擇遊戲模式' : '包廂規則設定'}</h2>
                <div className="flex gap-3 mt-4">
                  <div className={`h-1.5 w-12 rounded-full transition-all ${createStep >= 1 ? 'bg-fuchsia-500 shadow-[0_0_15px_#d946ef]' : 'bg-white/10'}`}></div>
                  <div className={`h-1.5 w-12 rounded-full transition-all ${createStep >= 2 ? 'bg-fuchsia-500 shadow-[0_0_15px_#d946ef]' : 'bg-white/10'}`}></div>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-all">✕</button>
            </div>

            <div className="relative z-10 min-h-[350px]">
              {createStep === 1 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'boomcat', name: '炸彈貓咪', icon: '🐈‍⬛', color: 'bg-indigo-500', desc: '心機卡牌對決' },
                    { id: 'drawguess', name: '你畫我猜', icon: '🎨', color: 'bg-emerald-500', desc: '靈魂畫手試煉' },
                    { id: 'bingo', name: '極速賓果', icon: '🎱', color: 'bg-fuchsia-500', desc: '幸運填字連線' }
                  ].map(game => (
                    <div 
                      key={game.id} 
                      onClick={() => setSelectedGame(game.id)}
                      className={`p-8 rounded-[3rem] border-2 cursor-pointer transition-all flex flex-col items-center text-center ${selectedGame === game.id ? `border-${game.id === 'boomcat' ? 'indigo' : game.id === 'drawguess' ? 'emerald' : 'fuchsia'}-500 bg-white/5 scale-105` : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}`}
                    >
                      <div className="text-6xl mb-6">{game.icon}</div>
                      <h3 className="text-xl font-black mb-2">{game.name}</h3>
                      <p className="text-[10px] text-white/30 tracking-widest uppercase">{game.desc}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-8">
                  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-lg">房間人數上限</h4>
                      <p className="text-xs text-white/30">包含房主在內的玩家總數</p>
                    </div>
                    <div className="flex items-center gap-6 bg-black/40 p-2 rounded-full border border-white/5">
                      <button onClick={() => setRoomRules({...roomRules, maxPlayers: Math.max(2, roomRules.maxPlayers - 1)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-black">-</button>
                      <span className="font-mono font-bold text-2xl w-8 text-center">{roomRules.maxPlayers}</span>
                      <button onClick={() => setRoomRules({...roomRules, maxPlayers: Math.min(10, roomRules.maxPlayers + 1)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-black">+</button>
                    </div>
                  </div>
                  {/* 根據不同遊戲顯示專屬規則 */}
                  {selectedGame === 'bingo' && (
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex justify-between items-center">
                      <h4 className="font-black text-lg text-fuchsia-400">勝利連線數</h4>
                      <div className="flex items-center gap-6 bg-black/40 p-2 rounded-full border border-white/5">
                        <button onClick={() => setRoomRules({...roomRules, winLines: Math.max(1, roomRules.winLines - 1)})} className="w-10 h-10 rounded-full bg-white/10">-</button>
                        <span className="font-mono font-bold text-2xl w-8 text-center">{roomRules.winLines}</span>
                        <button onClick={() => setRoomRules({...roomRules, winLines: Math.min(5, roomRules.winLines + 1)})} className="w-10 h-10 rounded-full bg-white/10">+</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-6 mt-12 relative z-10 pt-10 border-t border-white/5">
              {createStep === 2 && (
                <button onClick={() => setCreateStep(1)} className="px-10 py-5 rounded-[2rem] bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all">返回</button>
              )}
              <button 
                onClick={() => createStep === 1 ? setCreateStep(2) : handleConfirmCreate()} 
                className="flex-1 py-5 rounded-[2rem] bg-white text-black font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
              >
                {createStep === 1 ? '下一步：設定規則' : '完成並建立包廂'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
