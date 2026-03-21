'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, push, update, increment, get } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

const SYSTEM_WORDS = ['蘋果', '太空人', '皮卡丘', '電腦', '珍珠奶茶', '恐龍', '自由女神', '黑洞', '馬桶', '衛生紙', '長頸鹿', '麥克風', '蒙娜麗莎', '蜘蛛人', '火鍋', '吉他', '殭屍', '獨角獸', '魔法陣', '忍者'];

export default function DrawGuess({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [timeLeft, setTimeLeft] = useState(0);
  const [customWord, setCustomWord] = useState(''); 
  const [systemWordChoices, setSystemWordChoices] = useState([]); 

  const gameState = roomData?.gameState || { status: 'waiting' };
  const rules = roomData?.info?.rules || { drawRounds: 2, drawTime: 60, wordMode: 'system' };
  const isHost = roomData?.info?.hostId === user?.uid;
  
  const alivePlayers = gameState.playerQueue || Object.keys(roomData?.players || {});
  const currentDrawerUid = gameState.playerQueue?.[gameState.currentDrawerIdx];
  const isMyTurnToDraw = currentDrawerUid === user?.uid;
  const currentWord = gameState.currentWord || '';
  const isDrawingState = gameState.status === 'drawing';

  // ⏱️ 計時器與狀態引擎
  useEffect(() => {
    if (gameState.status === 'drawing' && gameState.turnEndTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((gameState.turnEndTime - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0 && (isMyTurnToDraw || isHost)) endTurn();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState.status, gameState.turnEndTime, isMyTurnToDraw, isHost]);

  // 生成系統題目
  useEffect(() => {
    if (gameState.status === 'selecting' && isMyTurnToDraw) {
      const shuffled = [...SYSTEM_WORDS].sort(() => 0.5 - Math.random());
      setSystemWordChoices(shuffled.slice(0, 3));
    }
  }, [gameState.status, isMyTurnToDraw]);

  // 🎮 遊戲流程控制
  const startGame = () => {
    const players = Object.keys(roomData.players);
    if (players.length < 1) return alert("發生錯誤：找不到玩家"); 
    
    update(ref(database), {
      [`rooms/${roomId}/gameState`]: {
        status: 'selecting',
        currentDrawerIdx: 0,
        currentRound: 1,
        playerQueue: players.sort(() => 0.5 - Math.random()), 
        scores: {}
      }
    });
  };

  const submitWord = (word) => {
    if (!word.trim()) return;
    const updates = {};
    updates[`rooms/${roomId}/gameState/status`] = 'drawing';
    updates[`rooms/${roomId}/gameState/currentWord`] = word.trim();
    updates[`rooms/${roomId}/gameState/turnEndTime`] = Date.now() + (rules.drawTime * 1000);
    updates[`rooms/${roomId}/gameState/correctGuesserIds`] = []; 
    
    update(ref(database), updates);
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🎨 ${user.displayName} 開始作畫了！大家快猜！`, timestamp: Date.now() });
  };

  const endTurn = (extraUpdates = {}) => {
    extraUpdates[`rooms/${roomId}/gameState/status`] = 'turn_end';
    update(ref(database), extraUpdates);
    
    let nextIdx = gameState.currentDrawerIdx + 1;
    let nextRound = gameState.currentRound;
    let nextStatus = 'selecting';

    if (nextIdx >= alivePlayers.length) {
      nextIdx = 0;
      nextRound++;
      if (nextRound > rules.drawRounds) nextStatus = 'game_over';
    }

    setTimeout(async () => {
      const snap = await get(ref(database, `rooms/${roomId}/gameState/status`));
      if (snap.val() === 'turn_end') {
        const nextUpdates = {};
        nextUpdates[`rooms/${roomId}/gameState/status`] = nextStatus;
        nextUpdates[`rooms/${roomId}/gameState/currentDrawerIdx`] = nextIdx;
        nextUpdates[`rooms/${roomId}/gameState/currentRound`] = nextRound;
        nextUpdates[`rooms/${roomId}/gameState/correctGuesserIds`] = [];
        update(ref(database), nextUpdates);
      }
    }, 4000);
  };

  // 💬 聊天與秒殺搶答
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const inputTxt = chatInput.trim();
    setChatInput('');

    if (gameState.status === 'drawing') {
      if (isMyTurnToDraw) {
        if (inputTxt.includes(currentWord)) return alert("畫家不可以在聊天室暴雷答案喔！");
      } else {
        const hasGuessed = gameState.correctGuesserIds?.includes(user.uid);
        if (!hasGuessed && inputTxt === currentWord) {
          const totalPoints = 10 + Math.floor((timeLeft / rules.drawTime) * 20); 
          const updates = {};
          updates[`rooms/${roomId}/gameState/correctGuesserIds`] = [...(gameState.correctGuesserIds || []), user.uid];
          updates[`rooms/${roomId}/gameState/scores/${user.uid}`] = increment(totalPoints); 
          updates[`rooms/${roomId}/gameState/scores/${currentDrawerUid}`] = increment(15); 
          
          push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🟢 搶答成功！${user.displayName} 猜對了，獲得 ${totalPoints} 分！`, timestamp: Date.now() });

          endTurn(updates);
          return; 
        }
      }
    }
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: inputTxt, timestamp: Date.now() });
  };

  const hiddenWord = currentWord.replace(/./g, ' ◯ ');

  // 🎨 動態白板網址 (隨回合與畫家動態改變，確保每次都是乾淨白板！)
  const currentBoardId = `gamebar_${roomId}_r${gameState.currentRound || 1}_t${gameState.currentDrawerIdx || 0}`;
  const whiteboardUrl = `https://wbo.ophir.dev/boards/${currentBoardId}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-emerald-500/20">
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse duration-[10s]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[100px] rounded-full animate-pulse duration-[8s]"></div>
      </div>

      {/* 頂部狀態列 */}
      <div className="flex justify-between items-center p-3 md:p-5 z-10 flex-shrink-0">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10 shadow-inner group">
          <span className="mr-2 text-xl font-black group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
        </button>
        
        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-2 rounded-full border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex flex-col items-center">
          <span className="font-extrabold tracking-widest text-xs drop-shadow-md text-white">
            {gameState.status === 'waiting' && '等待房長開始'}
            {gameState.status === 'selecting' && '畫家選詞中...'}
            {gameState.status === 'drawing' && `⏱️ ${timeLeft}s`}
            {gameState.status === 'turn_end' && '回合結束'}
            {gameState.status === 'game_over' && '遊戲結算'}
          </span>
        </div>
        
        <div className="flex flex-col items-end mr-2">
          <span className="text-xs font-black text-emerald-400 tracking-widest hidden md:block">
            第 {gameState.currentRound || 1}/{rules.drawRounds} 回合
          </span>
          <span className="text-[10px] font-bold text-white/50 tracking-widest hidden md:block mt-0.5">
            (畫家 {((gameState.currentDrawerIdx || 0) + 1)}/{alivePlayers.length})
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-2 md:p-6 pb-6 z-10 overflow-hidden relative w-full max-w-[1920px] mx-auto">
        
        {/* 左側：主畫布區 */}
        <div className="flex-[3] lg:flex-[4] xl:flex-[5] flex flex-col w-full h-full min-h-[60vh] md:min-h-[75vh] relative">
          
          {/* === 遊戲狀態蓋板 === */}
          {gameState.status === 'waiting' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-[2.5rem] border border-white/10">
              <h2 className="text-3xl font-black mb-8 tracking-widest text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">🎨 準備發揮你的靈魂畫技</h2>
              {isHost ? (
                <button onClick={startGame} className="bg-gradient-to-r from-emerald-400 to-cyan-500 px-12 py-5 rounded-[2rem] text-xl font-black shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all border border-emerald-300 text-black">
                  開始遊戲
                </button>
              ) : (
                <div className="px-8 py-4 bg-white/5 rounded-[2rem] border border-white/10 text-white/50 font-bold">等待房長開始...</div>
              )}
            </div>
          )}

          {gameState.status === 'selecting' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-[2.5rem] border border-white/10 p-6">
              {isMyTurnToDraw ? (
                <div className="w-full max-w-md bg-white/5 border border-white/10 p-8 rounded-[2rem] text-center shadow-2xl animate-in zoom-in duration-300">
                  <h3 className="text-2xl font-black mb-2 text-emerald-400">輪到你了！</h3>
                  <p className="text-sm text-white/50 mb-8">請選擇你要畫的題目</p>
                  {rules.wordMode === 'drawer' || rules.wordMode === 'custom' ? (
                    <form onSubmit={(e) => { e.preventDefault(); submitWord(customWord); }} className="space-y-4">
                      <input type="text" required placeholder="輸入你想畫的詞..." value={customWord} onChange={e => setCustomWord(e.target.value)} className="w-full bg-black/40 border border-white/20 rounded-2xl py-4 px-6 text-center outline-none focus:border-emerald-500 transition-colors" />
                      <button className="w-full py-4 rounded-2xl bg-emerald-600 font-bold hover:bg-emerald-500 transition-colors text-white">確認題目</button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {systemWordChoices.map((w, i) => (
                        <button key={i} onClick={() => submitWord(w)} className="py-4 rounded-2xl bg-white/5 border border-white/10 font-bold hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-400 transition-all text-white">
                          {w}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center animate-pulse">
                  <div className="text-6xl mb-4">🤔</div>
                  <h3 className="text-xl font-bold text-white/60">等待 {roomData?.players?.[currentDrawerUid]?.name} 選擇題目...</h3>
                </div>
              )}
            </div>
          )}

          {gameState.status === 'turn_end' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-[2.5rem] border border-white/10">
              <h3 className="text-xl font-bold text-white/50 mb-2 tracking-widest uppercase">本回合答案是</h3>
              <h2 className="text-5xl font-black text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.5)] mb-8 animate-in zoom-in">{currentWord}</h2>
              <p className="text-sm text-white/30 animate-pulse">準備切換畫家...</p>
            </div>
          )}

          {gameState.status === 'game_over' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-6 animate-in fade-in duration-500">
              <h2 className="text-4xl font-black text-emerald-400 mb-8 drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]">🏆 遊戲結算</h2>
              <div className="w-full max-w-sm space-y-3 mb-10">
                {Object.entries(gameState.scores || {}).sort((a, b) => b[1] - a[1]).map(([uid, score], idx) => (
                  <div key={uid} className={`flex items-center justify-between p-4 rounded-2xl border ${idx === 0 ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-400 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'bg-white/5 border-white/10 text-white/80'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-inherit"><img src={roomData.players[uid]?.avatar} className="w-full h-full object-cover" /></div>
                      <span className="font-bold">{roomData.players[uid]?.name}</span>
                    </div>
                    <span className="font-mono font-black text-xl">{score} pts</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <button onClick={handleLeaveRoom} className="px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 font-bold transition-colors">返回大廳</button>
                {isHost && (
                  <button onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })} className="px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]">再來一局</button>
                )}
              </div>
            </div>
          )}

          {/* === 🎨 外部白板區 === */}
          <div className="flex-1 w-full h-full bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            
            {/* 題目提示浮窗 */}
            {gameState.status === 'drawing' && (
              <div className="absolute top-4 md:top-6 left-0 right-0 flex justify-center pointer-events-none z-20">
                <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-lg text-center">
                  <span className="text-[10px] text-white/50 block tracking-widest mb-1 uppercase">
                    {isMyTurnToDraw ? '你要畫的是' : `${roomData?.players?.[currentDrawerUid]?.name} 正在畫`}
                  </span>
                  <span className="text-xl font-black tracking-widest text-emerald-300 drop-shadow-md">
                    {isMyTurnToDraw ? currentWord : hiddenWord}
                  </span>
                </div>
              </div>
            )}

            {/* 嵌入 WBO 開源白板 */}
            <iframe 
              src={whiteboardUrl} 
              className="absolute inset-0 w-full h-full border-none z-0"
              style={{ display: 'block' }}
              title="External Whiteboard"
              allow="pointer-lock"
              scrolling="no"
            />

            {/* 🛡️ 防作弊透明盾牌：如果不是你的回合，你就點不到畫布！ */}
            {!isMyTurnToDraw && gameState.status === 'drawing' && (
              <div 
                className="absolute inset-0 z-10 bg-transparent" 
                onClick={() => alert("現在不是你的回合，不可以在白板上搗亂喔！")}
                title="只能看，不能畫！"
              />
            )}
          </div>
        </div>

        {/* 右側：玩家列表與聊天區 */}
        <div className="w-full lg:w-[260px] xl:w-[320px] bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl h-[400px] lg:h-auto z-10 relative">
          
          <div className="p-3 md:p-4 border-b border-white/5 bg-black/20 flex gap-2 overflow-x-auto scrollbar-hide">
            {alivePlayers.map((uid, index) => {
              const p = roomData.players[uid];
              const score = gameState.scores?.[uid] || 0;
              const isDrawingNow = uid === currentDrawerUid;
              const hasGuessed = gameState.correctGuesserIds?.includes(uid);
              return (
                <div key={uid} className={`flex flex-col items-center flex-shrink-0 transition-all relative ${isDrawingNow ? 'scale-110 mx-2' : 'opacity-80'}`}>
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 overflow-hidden relative ${isDrawingNow ? 'border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : (hasGuessed ? 'border-yellow-400' : 'border-white/10')}`}>
                    <img src={p?.avatar} className="w-full h-full object-cover" />
                    {hasGuessed && <div className="absolute inset-0 bg-yellow-400/30 flex items-center justify-center text-sm">💡</div>}
                    {isDrawingNow && <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center text-sm">✏️</div>}
                  </div>
                  <div className="absolute -top-2 -right-1 bg-black/80 text-[8px] font-mono border border-white/20 rounded-full w-4 h-4 flex items-center justify-center">
                    {index + 1}
                  </div>
                  <span className="text-[9px] md:text-[10px] font-bold mt-1 text-white/80">{score} pt</span>
                </div>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
            {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
              const isMe = m.senderId === user?.uid;
              const isSystem = m.senderId === 'system';
              
              if (isSystem) {
                return (
                  <div key={i} className="flex justify-center w-full">
                    <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] md:text-[11px] font-bold px-3 md:px-4 py-1 md:py-1.5 rounded-full">{m.text}</span>
                  </div>
                );
              }

              return (
                <div key={i} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/5 border border-white/10"><img src={m.avatar} className="w-full h-full object-cover" /></div>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                    {!isMe && <span className="text-[9px] md:text-[10px] text-white/40 ml-2 mb-0.5">{m.senderName}</span>}
                    <div className={`px-3 md:px-4 py-2 rounded-2xl text-xs md:text-[13px] ${isMe ? 'bg-white/20 border border-white/10 rounded-tr-none shadow-md' : 'bg-white/5 border border-white/5 rounded-tl-none'}`}>{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="p-3 md:p-4 border-t border-white/5 bg-black/20">
            <form onSubmit={handleSendMessage} className="relative">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={isMyTurnToDraw ? "畫家不可暴雷..." : "輸入猜測..."} disabled={isMyTurnToDraw && isDrawingState} className="w-full bg-white/5 border border-white/10 rounded-full py-3 md:py-4 pl-4 pr-14 outline-none focus:border-emerald-500/50 text-xs md:text-sm placeholder:text-white/20 font-light disabled:opacity-50 disabled:cursor-not-allowed" />
              <button disabled={isMyTurnToDraw && isDrawingState} className="absolute right-1.5 top-1.5 bottom-1.5 px-3 md:px-4 bg-white/10 border border-white/20 rounded-full font-bold text-[10px] md:text-xs hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">發送</button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
