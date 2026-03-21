'use client';

import { useState, useEffect } from 'react';
import { ref, push, update, increment } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function Bingo({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  
  const gameState = roomData?.gameState || { status: 'waiting' };
  const rules = roomData?.info?.rules || { winLines: 3 };
  const isHost = roomData?.info?.hostId === user?.uid;
  
  const alivePlayers = gameState.playerQueue || Object.keys(roomData?.players || {});
  const currentTurnUid = gameState.playerQueue?.[gameState.currentTurnIdx];
  const isMyTurn = currentTurnUid === user?.uid;
  
  const calledNumbers = gameState.calledNumbers || [];
  
  // 💡 排盤階段專用本地狀態
  const [localBoard, setLocalBoard] = useState(Array(25).fill(null));
  const isReady = gameState.readyPlayers?.[user?.uid];
  const readyCount = Object.keys(gameState.readyPlayers || {}).length;
  
  // 計算下一個要填入的數字 (1~25)
  const nextNumberToFill = localBoard.filter(n => n !== null).length + 1;

  // 正式遊戲的盤面 (從 Firebase 拿)
  const myBoard = gameState.playerBoards?.[user?.uid] || localBoard;
  const [myLines, setMyLines] = useState(0);

  // 🏆 遊戲中：即時計算連線數
  useEffect(() => {
    if (gameState.status === 'playing' && myBoard && !myBoard.includes(null)) {
      let lines = 0;
      const isCalled = (index) => calledNumbers.includes(myBoard[index]);
      
      // 橫線
      for(let i=0; i<5; i++) {
        if(isCalled(i*5) && isCalled(i*5+1) && isCalled(i*5+2) && isCalled(i*5+3) && isCalled(i*5+4)) lines++;
      }
      // 直線
      for(let i=0; i<5; i++) {
        if(isCalled(i) && isCalled(i+5) && isCalled(i+10) && isCalled(i+15) && isCalled(i+20)) lines++;
      }
      // 對角線
      if(isCalled(0) && isCalled(6) && isCalled(12) && isCalled(18) && isCalled(24)) lines++;
      if(isCalled(4) && isCalled(8) && isCalled(12) && isCalled(16) && isCalled(20)) lines++;
      
      setMyLines(lines);

      // 達成獲勝條件！
      if (lines >= rules.winLines && gameState.status === 'playing') {
        const updates = {};
        updates[`rooms/${roomId}/gameState/status`] = 'game_over';
        updates[`rooms/${roomId}/gameState/winner`] = user.uid;
        updates[`users/${user.uid}/score`] = increment(100); 
        
        push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🎉 BINGO！${user.displayName} 達成了 ${rules.winLines} 條連線，獲得勝利！`, timestamp: Date.now() });
        update(ref(database), updates);
      }
    }
  }, [calledNumbers, myBoard, gameState.status, rules.winLines, user.uid, roomId]);

  // ==========================================
  // 🎮 遊戲流程控制
  // ==========================================

  // 1. 房長：進入排盤階段
  const enterSetupPhase = () => {
    const players = Object.keys(roomData.players);
    update(ref(database), {
      [`rooms/${roomId}/gameState`]: {
        status: 'setup',
        playerQueue: players.sort(() => 0.5 - Math.random()), 
        readyPlayers: {},
        playerBoards: {},
        calledNumbers: []
      }
    });
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `⚙️ 進入排盤階段！請大家填寫自己的幸運數字。`, timestamp: Date.now() });
  };

  // 2. 玩家：排盤操作
  const handleCellClickSetup = (idx) => {
    if (isReady || localBoard[idx] !== null || nextNumberToFill > 25) return;
    const newBoard = [...localBoard];
    newBoard[idx] = nextNumberToFill;
    setLocalBoard(newBoard);
  };

  const handleUndo = () => {
    if (isReady || nextNumberToFill === 1) return;
    const newBoard = [...localBoard];
    const lastIdx = newBoard.indexOf(nextNumberToFill - 1);
    if (lastIdx !== -1) newBoard[lastIdx] = null;
    setLocalBoard(newBoard);
  };

  const handleRandomFill = () => {
    if (isReady) return;
    let nums = Array.from({length: 25}, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    setLocalBoard(nums);
  };

  const toggleReady = () => {
    if (!isReady && localBoard.includes(null)) return alert("請填滿 25 個數字！");
    const updates = {};
    if (isReady) {
      updates[`rooms/${roomId}/gameState/readyPlayers/${user.uid}`] = null;
      updates[`rooms/${roomId}/gameState/playerBoards/${user.uid}`] = null;
    } else {
      updates[`rooms/${roomId}/gameState/readyPlayers/${user.uid}`] = true;
      updates[`rooms/${roomId}/gameState/playerBoards/${user.uid}`] = localBoard;
    }
    update(ref(database), updates);
  };

  // 3. 房長：正式開始遊戲
  const startGame = () => {
    if (readyCount < alivePlayers.length) return alert("還有人沒準備好！");
    update(ref(database), {
      [`rooms/${roomId}/gameState/status`]: 'playing',
      [`rooms/${roomId}/gameState/currentTurnIdx`]: 0
    });
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🎱 遊戲正式開始！最快達成 ${rules.winLines} 條連線者獲勝！`, timestamp: Date.now() });
  };

  // 4. 玩家：遊戲中喊數字
  const pickNumber = (num) => {
    if (!isMyTurn || gameState.status !== 'playing' || calledNumbers.includes(num)) return;
    
    const nextIdx = (gameState.currentTurnIdx + 1) % alivePlayers.length;
    const updates = {};
    updates[`rooms/${roomId}/gameState/calledNumbers`] = [...calledNumbers, num];
    updates[`rooms/${roomId}/gameState/currentTurnIdx`] = nextIdx;
    
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🎯 ${user.displayName} 圈選了數字【 ${num} 】`, timestamp: Date.now() });
    update(ref(database), updates);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: chatInput.trim(), timestamp: Date.now() });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-fuchsia-500/20">
      
      {/* 🌠 賽博背景光暈 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-fuchsia-600/10 blur-[150px] rounded-full animate-pulse duration-[10s]"></div>
        <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full animate-pulse duration-[8s]"></div>
      </div>

      <div className="flex justify-between items-center p-3 md:p-5 z-10 flex-shrink-0">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10 shadow-inner group">
          <span className="mr-2 text-xl font-black group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
        </button>
        
        <div className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-2 rounded-full border border-fuchsia-400/30 shadow-[0_0_20px_rgba(192,38,211,0.3)]">
          <span className="font-extrabold tracking-widest text-xs drop-shadow-md text-white">
            {gameState.status === 'waiting' && '🎱 極速賓果：等待開始'}
            {gameState.status === 'setup' && '⚙️ 排盤準備中'}
            {gameState.status === 'playing' && `🎯 目標：${rules.winLines} 條連線`}
            {gameState.status === 'game_over' && '🏆 遊戲結束'}
          </span>
        </div>
        
        <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner cursor-not-allowed opacity-50">⚙️</div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-2 md:p-6 pb-6 z-10 overflow-hidden relative w-full max-w-[1920px] mx-auto">
        
        {/* ================================== */}
        {/* 左側：主視角區塊 */}
        {/* ================================== */}
        <div className="flex-[3] lg:flex-[4] flex flex-col h-full relative min-h-[60vh] md:min-h-[75vh] items-center justify-center">
          
          {/* 狀態 1: 等待房長開啟排盤 */}
          {gameState.status === 'waiting' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-[2.5rem] border border-white/10">
              <h2 className="text-4xl font-black mb-4 tracking-widest text-fuchsia-400 drop-shadow-[0_0_20px_rgba(192,38,211,0.5)]">🎱 極速連線</h2>
              <p className="text-white/50 mb-8">準備填寫你的幸運數字盤</p>
              {isHost ? (
                <button onClick={enterSetupPhase} className="bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-12 py-5 rounded-[2rem] text-xl font-black shadow-[0_0_20px_rgba(192,38,211,0.4)] hover:scale-105 active:scale-95 transition-all text-white border border-fuchsia-300">
                  進入排盤
                </button>
              ) : (
                <div className="px-8 py-4 bg-white/5 rounded-[2rem] border border-white/10 text-white/50 font-bold">等待房長開始...</div>
              )}
            </div>
          )}

          {/* 狀態 2: 遊戲結束 */}
          {gameState.status === 'game_over' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-6 animate-in fade-in duration-500">
              <h2 className="text-5xl font-black text-yellow-400 mb-4 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">BINGO!</h2>
              <h3 className="text-2xl font-bold text-white mb-8">贏家：{roomData.players[gameState.winner]?.name} 👑</h3>
              <div className="flex gap-4">
                <button onClick={handleLeaveRoom} className="px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 font-bold transition-colors">返回大廳</button>
                {isHost && (
                  <button onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })} className="px-8 py-4 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 font-bold transition-colors text-white shadow-[0_0_15px_rgba(192,38,211,0.4)]">再來一局</button>
                )}
              </div>
            </div>
          )}

          {/* 狀態 3: ⚙️ 排盤階段 */}
          {gameState.status === 'setup' && (
            <div className="w-full max-w-lg flex flex-col items-center animate-in zoom-in duration-500">
              <div className="mb-4 text-center w-full flex justify-between items-end px-2">
                <div className="text-left">
                  <h2 className="text-2xl font-black text-cyan-400 tracking-widest">排盤階段</h2>
                  <p className="text-xs text-white/50 mt-1">
                    {isReady ? '等待其他玩家...' : `請依序點擊填入數字：即將填入 [ ${nextNumberToFill <= 25 ? nextNumberToFill : '滿'} ]`}
                  </p>
                </div>
                
                {/* 輔助工具列 */}
                {!isReady && (
                  <div className="flex gap-2">
                    <button onClick={handleUndo} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold border border-white/10 transition-colors">↩️</button>
                    <button onClick={handleRandomFill} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold border border-white/10 transition-colors">🎲 隨機</button>
                    <button onClick={() => setLocalBoard(Array(25).fill(null))} className="px-3 py-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-xs font-bold border border-rose-500/30 transition-colors">🗑️ 清空</button>
                  </div>
                )}
              </div>

              {/* Bingo 盤 (排盤用) */}
              <div className="grid grid-cols-5 gap-2 md:gap-3 w-full p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl mb-6">
                {localBoard.map((num, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCellClickSetup(idx)}
                    disabled={isReady || num !== null}
                    className={`
                      relative aspect-square flex items-center justify-center text-xl md:text-3xl font-black rounded-2xl transition-all duration-300
                      ${num !== null 
                        ? 'bg-fuchsia-600/80 text-white border border-fuchsia-400 shadow-[0_0_15px_rgba(192,38,211,0.3)]' 
                        : isReady 
                          ? 'bg-white/5 text-transparent border border-transparent' 
                          : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105 border border-white/10 cursor-pointer shadow-inner border-dashed'}
                    `}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* 準備與開始按鈕 */}
              <div className="flex gap-4 w-full px-2">
                <button 
                  onClick={toggleReady} 
                  className={`flex-1 py-4 rounded-[1.5rem] font-black text-sm transition-all border ${isReady ? 'bg-white/10 text-white/60 border-white/10 hover:bg-white/20' : 'bg-gradient-to-r from-emerald-400 to-cyan-500 text-black border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.4)] hover:scale-105 active:scale-95'}`}
                >
                  {isReady ? '取消準備' : '✅ 準備完成'}
                </button>
                
                {isHost && (
                  <button 
                    onClick={startGame}
                    disabled={readyCount < alivePlayers.length}
                    className={`flex-1 py-4 rounded-[1.5rem] font-black text-sm transition-all border ${readyCount < alivePlayers.length ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed' : 'bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white border-fuchsia-300 shadow-[0_0_20px_rgba(192,38,211,0.4)] hover:scale-105 active:scale-95'}`}
                  >
                    正式開始 ({readyCount}/{alivePlayers.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 狀態 4: 🎯 正式戰鬥階段 */}
          {gameState.status === 'playing' && (
            <div className="w-full max-w-lg flex flex-col items-center animate-in zoom-in duration-500">
              <div className="mb-6 text-center">
                {isMyTurn ? (
                  <h2 className="text-3xl font-black text-fuchsia-400 drop-shadow-[0_0_15px_rgba(192,38,211,0.6)] animate-pulse tracking-widest">輪到你選號！</h2>
                ) : (
                  <h2 className="text-2xl font-bold text-white/60">等待 {roomData.players[currentTurnUid]?.name} 選號...</h2>
                )}
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-cyan-300">你的連線：{myLines} / {rules.winLines}</span>
                </div>
              </div>

              {/* 5x5 Bingo 盤 (戰鬥用) */}
              <div className="grid grid-cols-5 gap-2 md:gap-3 w-full p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl">
                {myBoard.map((num, idx) => {
                  const isCalled = calledNumbers.includes(num);
                  return (
                    <button
                      key={idx}
                      onClick={() => pickNumber(num)}
                      disabled={isCalled || !isMyTurn}
                      className={`
                        relative aspect-square flex items-center justify-center text-xl md:text-3xl font-black rounded-2xl transition-all duration-300
                        ${isCalled 
                          ? 'bg-cyan-500/20 text-cyan-300 border-2 border-cyan-500/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.3)] scale-95' 
                          : isMyTurn 
                            ? 'bg-white/10 text-white hover:bg-white/20 hover:scale-105 border border-white/10 cursor-pointer shadow-lg' 
                            : 'bg-white/5 text-white/60 border border-transparent cursor-not-allowed'}
                      `}
                    >
                      {num}
                      {isCalled && <div className="absolute inset-0 bg-cyan-400/20 rounded-2xl animate-ping opacity-50"></div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================================== */}
        {/* 右側：側邊欄 (名單與聊天) */}
        {/* ================================== */}
        <div className="w-full lg:w-[320px] bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl h-[400px] lg:h-auto z-10 relative">
          
          {/* 上半部：依狀態顯示不同資訊 */}
          {gameState.status === 'setup' ? (
            <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col gap-3">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">準備狀況 ({readyCount}/{alivePlayers.length})</span>
              <div className="flex flex-col gap-2">
                {alivePlayers.map((uid) => (
                  <div key={uid} className="flex items-center justify-between bg-white/5 p-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10"><img src={roomData.players[uid]?.avatar} /></div>
                      <span className="text-xs font-bold">{roomData.players[uid]?.name}</span>
                    </div>
                    <span>{gameState.readyPlayers?.[uid] ? '✅' : '⏳'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-white/5 bg-black/20 flex flex-col gap-2">
              <span className="text-xs font-black text-fuchsia-400 uppercase tracking-widest">已開出號碼 ({calledNumbers.length})</span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-hide">
                {calledNumbers.map(n => (
                  <span key={n} className="w-7 h-7 flex items-center justify-center bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-full text-[10px] font-bold text-fuchsia-300 shadow-inner">{n}</span>
                ))}
                {calledNumbers.length === 0 && <span className="text-xs text-white/30">尚未開出號碼...</span>}
              </div>
            </div>
          )}

          {/* 聊天室 */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
            {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
              const isMe = m.senderId === user?.uid;
              const isSystem = m.senderId === 'system';
              
              if (isSystem) {
                return (
                  <div key={i} className="flex justify-center w-full">
                    <span className="bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] md:text-[11px] font-bold px-3 md:px-4 py-1 md:py-1.5 rounded-full text-center">{m.text}</span>
                  </div>
                );
              }

              return (
                <div key={i} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/5 border border-white/10"><img src={m.avatar} className="w-full h-full object-cover" /></div>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                    {!isMe && <span className="text-[9px] md:text-[10px] text-white/40 ml-2 mb-0.5">{m.senderName}</span>}
                    <div className={`px-3 md:px-4 py-2 rounded-2xl text-xs md:text-[13px] ${isMe ? 'bg-fuchsia-600/80 border border-fuchsia-500/50 rounded-tr-none shadow-md' : 'bg-white/5 border border-white/5 rounded-tl-none'}`}>{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="p-3 md:p-4 border-t border-white/5 bg-black/20">
            <form onSubmit={handleSendMessage} className="relative">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="聊天..." className="w-full bg-white/5 border border-white/10 rounded-full py-3 md:py-4 pl-4 pr-14 outline-none focus:border-fuchsia-500/50 text-xs md:text-sm placeholder:text-white/20 font-light" />
              <button className="absolute right-1.5 top-1.5 bottom-1.5 px-3 md:px-4 bg-white/10 border border-white/20 rounded-full font-bold text-[10px] md:text-xs hover:bg-white/20 active:scale-95 transition-all">發送</button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
