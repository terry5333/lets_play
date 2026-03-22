'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { useRouter } from 'next/navigation';

export default function Lobby({ 
  user, myScore, leaderboard, handleCreateRoom, handleJoinRoom 
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

  // 🛡️ 安全讀取環境變數，防止白屏
  useEffect(() => {
    try {
      const adminEmailsString = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
      if (adminEmailsString && user?.email) {
        const ADMIN_EMAILS = adminEmailsString.split(',').map(email => email.trim().toLowerCase());
        if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
          setIsAdmin(true);
        }
      }
    } catch (e) {
      console.error("Admin check failed", e);
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-12 relative z-10 text-white animate-in fade-in duration-700">
      {/* 頂部 */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-10 md:mb-16 px-4">
        <h1 className="text-xl md:text-2xl font-black tracking-[0.3em] italic uppercase opacity-80">Game Bar</h1>
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-2xl border border-white/10 p-2 pr-6 rounded-full shadow-xl">
          {isAdmin && (
            <button 
              onClick={() => router.push('/admin')} 
              className="text-[10px] font-black text-rose-500 border border-rose-500/30 px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
            >
              ADMIN
            </button>
          )}
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-white/10 shadow-inner">
            <img src={user?.photoURL} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight">{user?.displayName || '無名氏'}</span>
            <span className="text-[9px] text-yellow-400 font-black uppercase tracking-widest">PTS: {myScore}</span>
          </div>
          <div className="h-4 w-px bg-white/10 mx-2"></div>
          <button onClick={() => signOut(auth)} className="text-[10px] font-bold text-white/20 hover:text-rose-400 transition-colors">登出</button>
        </div>
      </div>
      
      {/* 操作區 */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
        <button onClick={() => { setShowCreateModal(true); setCreateStep(1); }} className="group relative bg-white/[0.03] border border-white/10 rounded-[2.5rem] md:rounded-[3.5rem] p-10 md:p-16 text-left hover:bg-white/[0.05] transition-all duration-500 overflow-hidden shadow-2xl">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full group-hover:bg-indigo-600/20 transition-all"></div>
          <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">開創包廂</h2>
          <p className="text-white/40 text-sm md:text-lg font-light leading-relaxed">建立規則，發起挑戰。</p>
        </button>

        <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] md:rounded-[3.5rem] p-10 md:p-16 flex flex-col justify-center relative shadow-2xl">
          <h2 className="text-4xl md:text-5xl font-black mb-8 tracking-tighter">加入連線</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleJoinRoom(joinInput); }} className="space-y-4">
            <input 
              type="text" placeholder="輸入 4 位房號" value={joinInput} 
              onChange={e=>setJoinInput(e.target.value)} 
              className="w-full bg-black/40 border border-white/10 rounded-full py-6 text-center font-mono text-3xl md:text-4xl tracking-[0.4em] outline-none focus:border-cyan-500/50 transition-all placeholder:text-sm placeholder:tracking-normal" 
            />
            <button className="w-full py-5 bg-white text-black rounded-full font-black text-lg hover:scale-[0.98] transition-all shadow-lg">連線</button>
          </form>
        </div>
      </div>

      {/* 排行榜 */}
      <div className="w-full max-w-6xl mx-auto bg-white/[0.01] border border-white/5 rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-12 backdrop-blur-md">
        <h2 className="text-xl font-black tracking-widest uppercase italic text-white/50 mb-8 px-4">全球菁英榜</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {leaderboard.map((p, index) => (
            <div key={p.uid || index} className={`flex items-center gap-4 p-5 rounded-[2.2rem] border border-white/5 bg-white/[0.02] transition-all hover:scale-105 ${index === 0 ? 'border-yellow-400/20 bg-yellow-400/5' : ''}`}>
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                <img src={p.avatar} alt="avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold truncate">{p.name}</span>
                <span className="text-[10px] font-mono text-white/30 uppercase">{p.score} PTS</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🚀 開創包廂彈窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-2xl max-h-[90dvh] flex flex-col bg-[#0e0e12] border border-white/10 rounded-[3rem] md:rounded-[4rem] relative overflow-hidden shadow-2xl animate-in zoom-in-95">
            
            <div className="p-8 md:p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">{createStep === 1 ? '選擇模式' : '規則設定'}</h2>
              <button onClick={()=>setShowCreateModal(false)} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all text-2xl font-light">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 md:p-10 scrollbar-hide">
              {createStep === 1 ? (
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  {[
                    { id: 'boomcat', n: '炸彈貓', i: '🐈‍⬛', c: 'indigo' },
                    { id: 'drawguess', n: '你畫我猜', i: '🎨', c: 'emerald' },
                    { id: 'bingo', n: '賓果', i: '🎱', c: 'fuchsia' },
                    { id: 'evilfills', n: '惡搞填空', i: '🤪', c: 'yellow' }
                  ].map(g => (
                    <div 
                      key={g.id} onClick={()=>setSelectedGame(g.id)} 
                      className={`p-6 md:p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer text-center flex flex-col items-center ${selectedGame === g.id ? `border-${g.c}-500 bg-white/5 scale-105 shadow-2xl` : 'border-white/5 bg-white/[0.02] hover:bg-white/5'}`}
                    >
                      <div className="text-4xl md:text-5xl mb-4">{g.i}</div>
                      <div className="font-black text-lg">{g.n}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                   <div className="flex justify-between items-center bg-white/5 p-6 rounded-[2rem] border border-white/5">
                     <span className="font-bold">人數上限</span>
                     <div className="flex items-center gap-6 bg-black/40 p-1 rounded-full border border-white/5">
                       <button onClick={()=>setRoomRules({...roomRules, maxPlayers: Math.max(2, roomRules.maxPlayers-1)})} className="w-8 h-8 md:w-10 md:h-10 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors">-</button>
                       <span className="font-mono font-bold text-xl w-6 text-center">{roomRules.maxPlayers}</span>
                       <button onClick={()=>setRoomRules({...roomRules, maxPlayers: Math.min(10, roomRules.maxPlayers+1)})} className="w-8 h-8 md:w-10 md:h-10 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors">+</button>
                     </div>
                   </div>
                   
                   {selectedGame === 'evilfills' && (
                     <div className="space-y-4">
                       <h4 className="font-black text-yellow-500 text-sm tracking-widest uppercase ml-2">出題模式</h4>
                       <div className="grid grid-cols-3 gap-2 md:gap-4">
                         {[
                           { id: 'ai', n: 'AI出題', i: '🤖' },
                           { id: 'turn', n: '莊家定', i: '🔄' },
                           { id: 'custom', n: '全員寫', i: '✍️' }
                         ].map(m => (
                           <button 
                             key={m.id} onClick={()=>setRoomRules({...roomRules, promptMode: m.id})} 
                             className={`py-4 rounded-[1.5rem] flex flex-col items-center gap-1 border-2 transition-all ${roomRules.promptMode === m.id ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-white/5 border-white/5 text-white/40'}`}
                           >
                             <span className="text-xl">{m.i}</span>
                             <span className="text-[10px] font-black">{m.n}</span>
                           </button>
                         ))}
                       </div>
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="p-8 md:p-10 border-t border-white/5 flex gap-4 bg-white/[0.01]">
              {createStep === 2 && (
                <button onClick={()=>setCreateStep(1)} className="px-8 py-4 bg-white/5 border border-white/10 rounded-full font-bold hover:bg-white/10 transition-all text-white/60">返回</button>
              )}
              <button 
                onClick={() => createStep === 1 ? setCreateStep(2) : handleCreateRoom(selectedGame, roomRules)} 
                className="flex-1 py-4 bg-white text-black rounded-full font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
              >
                {createStep === 1 ? '確認並下一步' : '開創極致包廂'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
