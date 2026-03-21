'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';

export default function Lobby({ 
  user, myScore, leaderboard, isGoogleLinked, 
  handleLinkGoogle, changeAvatar, handleWinGameDemo, 
  handleCreateRoom, handleJoinRoom, handleGoAdmin 
}) {
  const [joinInput, setJoinInput] = useState('');
  
  // 👑 從環境變數讀取管理員名單 (由 .env.local 或 Vercel 設定)
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const adminEmailsString = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    const ADMIN_EMAILS = adminEmailsString.split(',').map(email => email.trim().toLowerCase());
    // Lobby.jsx
{isAdmin && (
  <button 
    onClick={() => window.location.href = '/admin'} 
    className="text-[10px] font-black text-rose-500 hover:text-rose-400 transition-all mr-2 border border-rose-500/30 px-3 py-1.5 rounded-full bg-rose-500/10 active:scale-95"
  >
    ⚙️ 系統後台
  </button>
)}
    }
  }, [user]);

  // 🚪 創建包廂 Modal 狀態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); 
  const [selectedGame, setSelectedGame] = useState('boomcat'); 
  
  // ⚙️ 房間規則狀態
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
      
      {/* 頂部導航列 */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-12 px-4">
        <h1 className="font-semibold text-xl tracking-tight tracking-[0.2em] opacity-80 uppercase">Game Bar</h1>
        
        <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-2 pr-6 rounded-full shadow-lg">
          {/* 管理員專屬按鈕 */}
          {isAdmin && (
            <button 
              onClick={handleGoAdmin} 
              className="text-[10px] font-black text-rose-500 hover:text-rose-400 transition-all mr-2 border border-rose-500/30 px-3 py-1.5 rounded-full bg-rose-500/10 active:scale-95 animate-pulse"
            >
              ⚙️ 系統後台
            </button>
          )}

          <button onClick={changeAvatar} title="更換頭像" className="relative group w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden hover:border-white/40 transition-all cursor-pointer">
            <img src={user?.photoURL} alt="avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[9px]">換</div>
          </button>

          <div className="flex flex-col justify-center">
            <span className="text-sm font-medium opacity-90 leading-tight">{user?.displayName || '無名氏'}</span>
            <span className="text-[10px] text-white/50 tracking-widest uppercase font-mono mt-0.5">PTS: <span className="text-white/90 font-bold">{myScore}</span></span>
          </div>

          <div className="h-6 w-px bg-white/10 mx-2"></div>
          
          <button onClick={handleWinGameDemo} className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors mr-2 border border-emerald-500/30 px-3 py-1.5 rounded-full bg-emerald-500/10 active:scale-95 hidden md:block">
            +50 TEST
          </button>

          {!isGoogleLinked && (
            <button onClick={handleLinkGoogle} className="text-[11px] font-medium text-white/40 hover:text-white transition-colors mr-2 hidden sm:block">綁定 Google</button>
          )}
          <button onClick={() => signOut(auth)} className="text-[11px] font-medium text-rose-400/70 hover:text-rose-400 transition-colors">登出</button>
        </div>
      </div>
      
      {/* 操作區塊 */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* 開創包廂按鈕 */}
        <button onClick={() => { setShowCreateModal(true); setCreateStep(1); }} className="group bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 text-left hover:bg-white/[0.04] transition-all duration-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors"></div>
          <h2 className="text-4xl font-semibold mb-4 tracking-tight relative z-10 group-hover:text-yellow-400 transition-colors">開創包廂</h2>
          <p className="text-white/40 text-sm leading-relaxed font-light relative z-10 max-w-sm">建立一個新的遊戲空間，自訂遊戲規則並邀請朋友加入。</p>
        </button>

        {/* 加入房間區塊 */}
        <div className="bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 flex flex-col justify-center relative">
          <h2 className="text-4xl font-semibold mb-8 tracking-tight">加入連線</h2>
          <form onSubmit={onJoin} className="space-y-4 relative z-10">
            <input 
              type="text" placeholder="輸入 4 位房號" value={joinInput} 
              onChange={e => setJoinInput(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-6 px-6 outline-none focus:border-white/30 focus:bg-black/40 text-center font-mono text-2xl tracking-[0.3em] placeholder:tracking-normal placeholder:text-sm placeholder:font-sans transition-all" 
            />
            <button className="w-full py-6 bg-white text-black rounded-[2rem] font-semibold hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.1)] text-sm">
              進入
            </button>
          </form>
        </div>
      </div>

      {/* 排行榜 */}
      <div className="w-full max-w-6xl mx-auto bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-10 mt-4 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-yellow-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="flex items-center justify-between mb-8 relative z-10 px-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">全服排行榜</h2>
            <p className="text-white/30 text-[10px] tracking-widest uppercase mt-1 font-mono tracking-[0.3em]">Hall of Fame</p>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/50 tracking-widest uppercase">Global TOP 10</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
          {leaderboard.length === 0 && <div className="text-white/30 text-sm p-4 col-span-full text-center">目前還沒有玩家上榜！</div>}
          {leaderboard.map((p, index) => {
            const isTop1 = index === 0;
            const borderGlow = isTop1 ? "border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.15)] bg-yellow-400/5" : "border-white/[0.05] bg-white/[0.02]";
            return (
              <div key={p.uid} className={`flex items-center gap-4 p-5 rounded-[2.5rem] border backdrop-blur-sm transition-all hover:scale-105 ${borderGlow}`}>
                <div className="w-12 h-12 rounded-full bg-black/40 overflow-hidden flex-shrink-0 relative border border-white/10">
                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                  {isTop1 && <div className="absolute -top-1 -right-1 text-lg">👑</div>}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className={`text-[11px] font-mono mt-0.5 ${isTop1 ? 'text-yellow-400' : 'text-white/50'}`}>{p.score} PTS</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🚀 創建房間專屬 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-3xl bg-[#0e0e12]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-[3.5rem] p-8 md:p-12 relative overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-8 relative z-10 flex-shrink-0">
              <div>
                <h2 className="text-3xl font-black tracking-tight">{createStep === 1 ? '選擇遊戲模式' : '包廂規則設定'}</h2>
                <div className="flex gap-2 mt-3">
                  <div className={`h-1 w-10 rounded-full transition-colors ${createStep >= 1 ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-white/10'}`}></div>
                  <div className={`h-1 w-10 rounded-full transition-colors ${createStep >= 2 ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-white/10'}`}></div>
                </div>
              </div>
              <button onClick={() => { setShowCreateModal(false); setCreateStep(1); }} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-all">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 pr-2">
              {createStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4">
                  <div onClick={() => setSelectedGame('boomcat')} className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all ${selectedGame === 'boomcat' ? 'bg-indigo-600/20 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="text-5xl mb-4">🐈‍⬛💣</div>
                    <h3 className="text-lg font-bold text-white mb-2">炸彈貓咪</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed">高心機卡牌遊戲。利用手牌陷害對手活到最後。</p>
                  </div>
                  <div onClick={() => setSelectedGame('drawguess')} className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all ${selectedGame === 'drawguess' ? 'bg-emerald-600/20 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="text-5xl mb-4">🎨✏️</div>
                    <h3 className="text-lg font-bold text-white mb-2">你畫我猜</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed">經典派對遊戲。透過畫筆與隊友進行心靈交會。</p>
                  </div>
                  <div onClick={() => setSelectedGame('bingo')} className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all ${selectedGame === 'bingo' ? 'bg-fuchsia-600/20 border-fuchsia-400 shadow-[0_0_30px_rgba(192,38,211,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="text-5xl mb-4">🎱✨</div>
                    <h3 className="text-lg font-bold text-white mb-2">極速賓果</h3>
                    <p className="text-[10px] text-white/50 leading-relaxed">5x5 自訂排盤模式。比手氣也比排盤的心機。</p>
                  </div>
                </div>
              )}

              {createStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 pb-4">
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex justify-between items-center">
                    <h4 className="font-bold">房間人數上限</h4>
                    <div className="flex items-center gap-4 bg-black/40 rounded-full p-1 border border-white/5">
                      <button onClick={() => setRoomRules({...roomRules, maxPlayers: Math.max(2, roomRules.maxPlayers - 1)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-bold">-</button>
                      <span className="font-mono font-bold text-lg w-4 text-center">{roomRules.maxPlayers}</span>
                      <button onClick={() => setRoomRules({...roomRules, maxPlayers: Math.min(10, roomRules.maxPlayers + 1)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-bold">+</button>
                    </div>
                  </div>

                  {selectedGame === 'boomcat' && (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex justify-between items-center cursor-pointer" onClick={() => setRoomRules({...roomRules, fastMode: !roomRules.fastMode})}>
                      <div>
                        <h4 className="font-bold flex items-center gap-2">快速模式 {roomRules.fastMode ? '⚡' : ''}</h4>
                        <p className="text-[11px] text-white/40 mt-1">每回合時間更短，心跳加速</p>
                      </div>
                      <div className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${roomRules.fastMode ? 'bg-indigo-500' : 'bg-white/20'}`}>
                        <div className={`w-6 h-6 rounded-full bg-white transition-transform ${roomRules.fastMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  )}

                  {selectedGame === 'bingo' && (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-fuchsia-400">勝利連線數</h4>
                        <p className="text-[11px] text-white/40 mt-1">達成目標即刻獲勝</p>
                      </div>
                      <div className="flex items-center gap-4 bg-black/40 rounded-full p-1 border border-white/5">
                        <button onClick={() => setRoomRules({...roomRules, winLines: Math.max(1, roomRules.winLines - 1)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-bold">-</button>
                        <span className="font-mono font-bold text-lg w-4 text-center">{roomRules.winLines}</span>
                        <button onClick={() => setRoomRules({...roomRules, winLines: Math.min(5, roomRules.winLines + 1)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-bold">+</button>
                      </div>
                    </div>
                  )}

                  {selectedGame === 'drawguess' && (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex justify-between items-center">
                      <h4 className="font-bold">繪畫秒數</h4>
                      <div className="flex items-center gap-4 bg-black/40 rounded-full p-1 border border-white/5">
                        <button onClick={() => setRoomRules({...roomRules, drawTime: Math.max(30, roomRules.drawTime - 30)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-bold">-</button>
                        <span className="font-mono font-bold text-lg w-10 text-center">{roomRules.drawTime}s</span>
                        <button onClick={() => setRoomRules({...roomRules, drawTime: Math.min(180, roomRules.drawTime + 30)})} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 font-bold">+</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 relative z-10 flex-shrink-0 pt-6 mt-4 border-t border-white/10">
              {createStep === 2 && (
                <button onClick={() => setCreateStep(1)} className="px-8 py-5 rounded-[2rem] bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-colors">返回</button>
              )}
              <button 
                onClick={() => {
                  if (createStep === 1) setCreateStep(2);
                  else handleConfirmCreate();
                }} 
                className="flex-1 py-5 rounded-[2rem] bg-gradient-to-r from-yellow-400 to-yellow-600 font-black text-yellow-950 shadow-[0_0_20px_rgba(250,204,21,0.4)] hover:scale-[1.02] active:scale-95 transition-all border border-yellow-300"
              >
                {createStep === 1 ? '下一步：設定規則' : '確認創建包廂'}
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
