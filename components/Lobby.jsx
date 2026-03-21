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
    wordMode: 'system',     
    winLines: 3             
  });

  const onJoin = (e) => {
    e.preventDefault();
    if (!joinInput) return;
    handleJoinRoom(joinInput);
    setJoinInput('');
  };

  const handleConfirmCreate = () => {
    handleCreateRoom(selectedGame, roomRules);
    setShowCreateModal(false);
    setCreateStep(1); 
  };

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-12 relative z-10 text-white">
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-12 px-4">
        <h1 className="font-semibold text-xl tracking-tight uppercase opacity-80">Game Bar</h1>
        <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-2 pr-6 rounded-full shadow-lg">
          {isAdmin && (
            <button onClick={() => router.push('/admin')} className="text-[10px] font-black text-rose-500 mr-2 border border-rose-500/30 px-3 py-1.5 rounded-full bg-rose-500/10 active:scale-95">⚙️ 系統後台</button>
          )}
          <button onClick={changeAvatar} className="relative w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden"><img src={user?.photoURL} alt="avatar" className="w-full h-full object-cover" /></button>
          <div className="flex flex-col justify-center">
            <span className="text-sm font-medium leading-tight">{user?.displayName}</span>
            <span className="text-[10px] text-white/50 tracking-widest font-mono uppercase">PTS: {myScore}</span>
          </div>
          <div className="h-6 w-px bg-white/10 mx-2"></div>
          <button onClick={() => signOut(auth)} className="text-[11px] font-medium text-rose-400/70 hover:text-rose-400">登出</button>
        </div>
      </div>
      
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <button onClick={() => { setShowCreateModal(true); setCreateStep(1); }} className="bg-white/[0.02] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 text-left hover:bg-white/[0.04] transition-all">
          <h2 className="text-4xl font-semibold mb-4 tracking-tight">開創包廂</h2>
          <p className="text-white/40 text-sm">建立新的遊戲空間並自訂規則。</p>
        </button>
        <div className="bg-white/[0.02] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 flex flex-col justify-center">
          <h2 className="text-4xl font-semibold mb-8 tracking-tight">加入連線</h2>
          <form onSubmit={onJoin} className="space-y-4">
            <input type="text" placeholder="4 位房號" value={joinInput} onChange={e => setJoinInput(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-6 text-center font-mono text-2xl tracking-[0.3em] outline-none" />
            <button className="w-full py-6 bg-white text-black rounded-[2rem] font-semibold text-sm">進入</button>
          </form>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto bg-white/[0.02] border border-white/[0.08] shadow-2xl rounded-[3rem] p-10 relative overflow-hidden">
        <div className="flex items-center justify-between mb-8 px-4">
          <h2 className="text-2xl font-semibold">排行榜</h2>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/50 uppercase">TOP 10</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {leaderboard.map((p, index) => (
            <div key={p.uid} className="flex items-center gap-4 p-5 rounded-[2.5rem] border border-white/[0.05] bg-white/[0.02]">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10"><img src={p.avatar} className="w-full h-full object-cover" /></div>
              <div className="flex flex-col truncate"><span className="text-sm font-medium truncate">{p.name}</span><span className="text-[11px] font-mono text-white/50">{p.score} PTS</span></div>
            </div>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-[#0e0e12]/95 border border-white/10 rounded-[3.5rem] p-8 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black">{createStep === 1 ? '選擇遊戲' : '規則設定'}</h2>
              <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-rose-500/20">✕</button>
            </div>
            <div className="flex-1">
              {createStep === 1 && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {['boomcat', 'drawguess', 'bingo'].map(game => (
                    <div key={game} onClick={() => setSelectedGame(game)} className={`p-6 rounded-[2.5rem] border-2 cursor-pointer ${selectedGame === game ? 'bg-indigo-600/20 border-indigo-400' : 'bg-white/5 border-white/10'}`}>
                      <h3 className="text-lg font-bold text-center capitalize">{game}</h3>
                    </div>
                  ))}
                </div>
              )}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex justify-between items-center">
                    <span>人數上限</span>
                    <span className="font-mono text-xl">{roomRules.maxPlayers}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-6 pt-6 border-t border-white/10">
              {createStep === 2 && <button onClick={() => setCreateStep(1)} className="px-8 py-5 rounded-[2rem] bg-white/5 font-bold">返回</button>}
              <button onClick={() => createStep === 1 ? setCreateStep(2) : handleConfirmCreate()} className="flex-1 py-5 rounded-[2rem] bg-white text-black font-black">{createStep === 1 ? '下一步' : '建立包廂'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
