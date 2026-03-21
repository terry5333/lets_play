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
  
  // 🚪 創建包廂 Modal 狀態
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); 
  const [selectedGame, setSelectedGame] = useState('boomcat'); // 'boomcat' | 'drawguess'
  
  // ⚙️ 統一管理的房間規則狀態
  const [roomRules, setRoomRules] = useState({
    maxPlayers: 5,
    fastMode: false,        // 炸彈貓專用
    drawRounds: 2,          // 你畫我猜專用：回合數
    drawTime: 60,           // 你畫我猜專用：秒數
    wordMode: 'system'      // 你畫我猜專用：詞彙模式 ('system', 'custom', 'drawer')
  });

  const onJoin = (e) => {
    e.preventDefault();
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
          
          <button onClick={handleWinGameDemo} className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors mr-2 border border-emerald-500/30 px-3 py-1.5 rounded-full bg-emerald-500/10 active:scale-95 hidden md:block">
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
        <button onClick={() => { setShowCreateModal(true); setCreateStep(1); }} className="group bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 text-left hover:bg-white/[0.04] transition-all duration-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors"></div>
          <h2 className="text-4xl font-semibold mb-4 tracking-tight relative z-10 group-hover:text-yellow-400 transition-colors">開創包廂</h2>
          <p className="text-white/40 text-sm leading-relaxed font-light relative z-10 max-w-sm">建立一個全新的專屬私密空間，選擇遊戲模式並邀請朋友一同加入連線。</p>
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
              <div key={p.uid} className={`flex items-center gap-4 p-5 rounded-[2.5rem] border backdrop-blur-sm transition-all hover:scale-105 ${borderGlow}`}>
                <div className="w-12 h-12 rounded-full bg-black/40 overflow-hidden flex-shrink-0 relative">
                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                  {isTop1 && <div className="absolute -top-1 -right-1 text-lg drop-shadow-md">👑</div>}
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

      {/* 🚀 創建房間專屬 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-[#120726]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-[3.5rem] p-8 md:p-12 relative overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-8 relative z-10 flex-shrink-0">
              <div>
                <h2 className="text-3xl font-black tracking-tight">{createStep === 1 ? '選擇遊戲模式' : '包廂規則設定'}</h2>
                <div className="flex gap-2 mt-3">
                  <div className={`h-1.5 w-12 rounded-full transition-colors ${createStep >= 1 ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-white/10'}`}></div>
                  <div className={`h-1.5 w-12 rounded-full transition-colors ${createStep >= 2 ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-white/10'}`}></div>
                </div>
              </div>
              <button onClick={() => { setShowCreateModal(false); setCreateStep(1); }} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 transition-all text-lg">✕</button>
            </div>

            {/* 中間滾動區塊 */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 pr-2">
              {/* 步驟 1：選擇遊戲 */}
              {createStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  {/* 選項：炸彈貓 */}
                  <div 
                    onClick={() => setSelectedGame('boomcat')}
                    className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col items-center text-center ${selectedGame === 'boomcat' ? 'bg-indigo-600/20 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.3)] scale-105' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:scale-105'}`}
                  >
                    <div className="text-6xl drop-shadow-xl mb-4 mt-2">🐈‍⬛💣</div>
                    <h3 className="text-xl font-bold text-white mb-2">炸彈貓咪</h3>
                    <p className="text-xs text-white/50 leading-relaxed px-2">高心機派對卡牌遊戲。利用手牌陷害對手，活到最後的才是贏家。</p>
                  </div>

                  {/* 🚀 新增選項：你畫我猜 */}
                  <div 
                    onClick={() => setSelectedGame('drawguess')}
                    className={`p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 flex flex-col items-center text-center ${selectedGame === 'drawguess' ? 'bg-emerald-600/20 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)] scale-105' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:scale-105'}`}
                  >
                    <div className="text-6xl drop-shadow-xl mb-4 mt-2">🎨✏️</div>
                    <h3 className="text-xl font-bold text-white mb-2">你畫我猜</h3>
                    <p className="text-xs text-white/50 leading-relaxed px-2">靈魂畫手大考驗。考驗默契與畫技，歡樂破表的經典派對遊戲。</p>
                  </div>
                </div>
              )}

              {/* 步驟 2：設定規則 (依據遊戲動態切換) */}
              {createStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 pb-4">
                  
                  {/* === 共用規則 === */}
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-md">房間人數上限</h4>
                      <p className="text-[11px] text-white/40 mt-1">超過人數將無法加入</p>
                    </div>
                    <div className="flex items-center gap-3 bg-black/40 rounded-full p-1 border border-white/5">
                      <button onClick={() => setRoomRules({...roomRules, maxPlayers: Math.max(2, roomRules.maxPlayers - 1)})} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 font-bold">-</button>
                      <span className="font-mono font-bold text-lg w-4 text-center">{roomRules.maxPlayers}</span>
                      <button onClick={() => setRoomRules({...roomRules, maxPlayers: Math.min(10, roomRules.maxPlayers + 1)})} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 font-bold">+</button>
                    </div>
                  </div>

                  {/* === 炸彈貓專屬規則 === */}
                  {selectedGame === 'boomcat' && (
                    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 flex justify-between items-center cursor-pointer" onClick={() => setRoomRules({...roomRules, fastMode: !roomRules.fastMode})}>
                      <div>
                        <h4 className="font-bold text-md flex items-center gap-2">快速出牌模式 {roomRules.fastMode ? '⚡' : ''}</h4>
                        <p className="text-[11px] text-white/40 mt-1">開啟後每回合限制 15 秒，超高壓迫感</p>
                      </div>
                      <div className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 ${roomRules.fastMode ? 'bg-indigo-500' : 'bg-white/20'}`}>
                        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${roomRules.fastMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  )}

                  {/* === 🎨 你畫我猜專屬規則 === */}
                  {selectedGame === 'drawguess' && (
                    <>
                      {/* 規則 1：回合數 */}
                      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-md">遊戲回合數</h4>
                          <p className="text-[11px] text-white/40 mt-1">所有人畫過一遍視為 1 回合</p>
                        </div>
                        <div className="flex items-center gap-3 bg-black/40 rounded-full p-1 border border-white/5">
                          <button onClick={() => setRoomRules({...roomRules, drawRounds: Math.max(1, roomRules.drawRounds - 1)})} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 font-bold">-</button>
                          <span className="font-mono font-bold text-lg w-4 text-center">{roomRules.drawRounds}</span>
                          <button onClick={() => setRoomRules({...roomRules, drawRounds: Math.min(5, roomRules.drawRounds + 1)})} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 font-bold">+</button>
                        </div>
                      </div>

                      {/* 規則 2：繪畫秒數 */}
                      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-md">繪畫與猜題時間</h4>
                          <p className="text-[11px] text-white/40 mt-1">每位玩家作畫的倒數秒數</p>
                        </div>
                        <div className="flex items-center gap-3 bg-black/40 rounded-full p-1 border border-white/5">
                          <button onClick={() => setRoomRules({...roomRules, drawTime: Math.max(30, roomRules.drawTime - 30)})} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 font-bold">-</button>
                          <span className="font-mono font-bold text-lg w-8 text-center">{roomRules.drawTime}s</span>
                          <button onClick={() => setRoomRules({...roomRules, drawTime: Math.min(180, roomRules.drawTime + 30)})} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 font-bold">+</button>
                        </div>
                      </div>

                      {/* 規則 3：詞彙題庫 (三個 Pill 按鈕) */}
                      <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
                        <div className="mb-3">
                          <h4 className="font-bold text-md">詞彙題庫模式</h4>
                          <p className="text-[11px] text-white/40 mt-1">決定每一局要畫什麼題目的方式</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button 
                            onClick={() => setRoomRules({...roomRules, wordMode: 'system'})}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${roomRules.wordMode === 'system' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]' : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/5'}`}
                          >
                            🤖 系統預設
                          </button>
                          <button 
                            onClick={() => setRoomRules({...roomRules, wordMode: 'custom'})}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${roomRules.wordMode === 'custom' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]' : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/5'}`}
                          >
                            👑 房主設定
                          </button>
                          <button 
                            onClick={() => setRoomRules({...roomRules, wordMode: 'drawer'})}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${roomRules.wordMode === 'drawer' ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]' : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/5'}`}
                          >
                            🎨 繪畫者決定
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal 底部按鈕區 */}
            <div className="flex gap-4 relative z-10 flex-shrink-0 pt-4 mt-2 border-t border-white/10">
              {createStep === 2 && (
                <button onClick={() => setCreateStep(1)} className="px-8 py-5 rounded-[2rem] bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-colors">
                  返回
                </button>
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
