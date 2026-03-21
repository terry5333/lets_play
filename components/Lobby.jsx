'use client';

import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';

export default function Lobby({ 
  user, myScore, leaderboard, isGoogleLinked, 
  handleLinkGoogle, changeAvatar, handleWinGameDemo, 
  handleCreateRoom, handleJoinRoom 
}) {
  const [joinInput, setJoinInput] = useState('');

  const onJoin = (e) => {
    e.preventDefault();
    handleJoinRoom(joinInput);
    setJoinInput('');
  };

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-12 relative z-10 text-white">
      {/* 頂部導航 */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-12 px-4">
        <h1 className="font-semibold text-xl tracking-tight">GAME BAR</h1>
        <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-2 pr-6 rounded-full shadow-lg">
          <button onClick={changeAvatar} title="點擊更換頭像" className="relative group w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden hover:border-white/40 transition-all cursor-pointer">
            <img src={user?.photoURL} alt="avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">更換</div>
          </button>
          <div className="flex flex-col justify-center">
            <span className="text-sm font-medium opacity-90 leading-tight">{user?.displayName || '無名氏'}</span>
            <span className="text-[10px] text-white/50 tracking-widest uppercase font-mono mt-0.5">PTS: <span className="text-white/90 font-bold">{myScore}</span></span>
          </div>
          <div className="h-6 w-px bg-white/10 mx-2"></div>
          
          <button onClick={handleWinGameDemo} className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors mr-2 border border-emerald-500/30 px-3 py-1.5 rounded-full bg-emerald-500/10 active:scale-95">
            加分測試 (+50)
          </button>

          {!isGoogleLinked && (
            <button onClick={handleLinkGoogle} className="text-[11px] font-medium text-white/60 hover:text-white transition-colors mr-2">綁定 Google</button>
          )}
          <button onClick={() => signOut(auth)} className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors">登出</button>
        </div>
      </div>
      
      {/* 操作區 */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <button onClick={handleCreateRoom} className="group bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 text-left hover:bg-white/[0.04] transition-all duration-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors"></div>
          <h2 className="text-4xl font-semibold mb-4 tracking-tight relative z-10">開創包廂</h2>
          <p className="text-white/40 text-sm leading-relaxed font-light relative z-10 max-w-sm">建立一個全新的專屬私密空間，邀請朋友一同加入連線。</p>
        </button>

        <div className="bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 flex flex-col justify-center relative">
          <h2 className="text-4xl font-semibold mb-8 tracking-tight">加入連線</h2>
          <form onSubmit={onJoin} className="space-y-4 relative z-10">
            <input type="text" placeholder="輸入 4 位數房號" value={joinInput} onChange={e => setJoinInput(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-6 px-6 outline-none focus:border-white/30 focus:bg-black/40 text-center font-mono text-2xl tracking-[0.3em] placeholder:tracking-normal placeholder:text-sm placeholder:font-sans font-light transition-all" />
            <button className="w-full py-6 bg-white text-black rounded-[2rem] font-semibold hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.15)] text-sm">
              進入
            </button>
          </form>
        </div>
      </div>

      {/* 排行榜 */}
      <div className="w-full max-w-6xl mx-auto bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-10 mt-4 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-yellow-500/10 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">全服排行榜</h2>
            <p className="text-white/30 text-[10px] tracking-widest uppercase mt-1">Hall of Fame</p>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-white/50">TOP 10</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 relative z-10">
          {leaderboard.length === 0 && <div className="text-white/30 text-sm p-4">目前還沒有玩家上榜！</div>}
          {leaderboard.map((p, index) => {
            const isTop1 = index === 0, isTop2 = index === 1, isTop3 = index === 2;
            let borderGlow = "border-white/[0.05]", textGlow = "text-white/80";
            if (isTop1) { borderGlow = "border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.2)] bg-yellow-500/5"; textGlow = "text-yellow-400 font-bold"; }
            else if (isTop2) { borderGlow = "border-slate-300/50 shadow-[0_0_15px_rgba(203,213,225,0.1)] bg-slate-400/5"; textGlow = "text-slate-300 font-bold"; }
            else if (isTop3) { borderGlow = "border-orange-400/50 shadow-[0_0_15px_rgba(251,146,60,0.1)] bg-orange-500/5"; textGlow = "text-orange-400 font-bold"; }

            return (
              <div key={p.uid} className={`flex items-center gap-4 p-5 rounded-[2rem] border backdrop-blur-sm transition-all hover:scale-105 ${borderGlow}`}>
                <div className="w-12 h-12 rounded-full bg-black/40 overflow-hidden flex-shrink-0 relative">
                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                  {isTop1 && <div className="absolute -top-1 -right-1 text-lg">👑</div>}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className={`text-[11px] tracking-widest uppercase font-mono mt-0.5 ${textGlow}`}>{p.score} PTS</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
