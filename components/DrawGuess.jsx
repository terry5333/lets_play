'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, push, onValue, update, increment } from 'firebase/database';
import { database } from '../lib/firebaseConfig';
import { ReactSketchCanvas } from 'react-sketch-canvas'; // 🎨 載入神級 SVG 畫布

const COLORS = [
  { name: '螢光白', hex: '#f8fafc' },
  { name: '霓虹黃', hex: '#fde047' },
  { name: '雷射粉', hex: '#f43f5e' },
  { name: '電馭紫', hex: '#a855f7' },
  { name: '量子藍', hex: '#3b82f6' },
  { name: '矩陣綠', hex: '#10b981' },
  { name: '橡皮擦', hex: 'eraser' } // 獨立標記
];

const SYSTEM_WORDS = ['蘋果', '太空人', '皮卡丘', '電腦', '珍珠奶茶', '恐龍', '自由女神', '黑洞', '馬桶', '衛生紙', '長頸鹿', '麥克風', '蒙娜麗莎', '蜘蛛人', '火鍋', '吉他', '殭屍', '獨角獸', '魔法陣', '忍者'];

export default function DrawGuess({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // 🎨 神級畫布狀態
  const canvasRef = useRef(null);
  const [color, setColor] = useState(COLORS[0].hex);
  const [lineWidth, setLineWidth] = useState(4);
  const [eraserMode, setEraserMode] = useState(false);

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

  // 🖌️ 1. 監聽畫布路徑 (Paths) 資料
  useEffect(() => {
    const pathsRef = ref(database, `rooms/${roomId}/gameState/paths`);
    const unsub = onValue(pathsRef, (snapshot) => {
      const paths = snapshot.val() || [];
      // 只有猜題者才需要不斷載入遠端路徑；畫家自己畫就好，免得被 Firebase 迴音打斷
      if (!isMyTurnToDraw) {
        if (paths.length === 0) canvasRef.current?.clearCanvas();
        else canvasRef.current?.loadPaths(paths);
      } else {
        // 如果畫家收到空陣列 (例如回合重置或點擊清空)，則強制清空
        if (paths.length === 0) canvasRef.current?.clearCanvas();
      }
    });
    return () => unsub();
  }, [roomId, isMyTurnToDraw]);

  // 🖌️ 2. 畫家筆跡改變時，自動推送到 Firebase
  const handleStroke = (updatedPaths) => {
    if (isMyTurnToDraw && isDrawingState) {
      update(ref(database), { [`rooms/${roomId}/gameState/paths`]: updatedPaths });
    }
  };

  const clearCanvas = () => {
    if (isMyTurnToDraw) {
      canvasRef.current?.clearCanvas();
      update(ref(database), { [`rooms/${roomId}/gameState/paths`]: [] }); // 推送空陣列讓所有人清空
    }
  };

  // ⏱️ 3. 計時器與狀態導播引擎
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

  useEffect(() => {
    if (gameState.status === 'selecting' && isMyTurnToDraw) {
      const shuffled = [...SYSTEM_WORDS].sort(() => 0.5 - Math.random());
      setSystemWordChoices(shuffled.slice(0, 3));
    }
  }, [gameState.status, isMyTurnToDraw]);

  // 🎮 4. 遊戲流程控制
  const startGame = () => {
    const players = Object.keys(roomData.players);
    if (players.length < 2) return alert("至少需要 2 人才能開始！");
    
    update(ref(database), {
      [`rooms/${roomId}/gameState`]: {
        status: 'selecting',
        currentDrawerIdx: 0,
        currentRound: 1,
        playerQueue: players.sort(() => 0.5 - Math.random()), 
        scores: {},
        paths: []
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
    updates[`rooms/${roomId}/gameState/paths`] = []; // 開局清空畫布
    
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
        nextUpdates[`rooms/${roomId}/gameState/paths`] = [];
        nextUpdates[`rooms/${roomId}/gameState/correctGuesserIds`] = [];
        update(ref(database), nextUpdates);
      }
    }, 4000);
  };

  // 💬 5. 聊天與秒殺搶答
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-emerald-500/20">
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse duration-[10s]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[100px] rounded-full animate-pulse duration-[8s]"></div>
      </div>

      <div className="flex justify-between items-center p-3 md:p-5 z-10 flex-shrink-0">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10 shadow-inner group">
          <span className="mr-2 text-xl font-black group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
        </button>
        
        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-2 rounded-full border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <span className="font-extrabold tracking-widest text-xs drop-shadow-md text-white">
            {gameState.status === 'waiting' && '等待房長開始'}
            {gameState.status === 'selecting' && '畫家選詞中...'}
            {gameState.status === 'drawing' && `第 ${gameState.currentRound}/${rules.drawRounds} 回合 ⏱️ ${timeLeft}s`}
            {gameState.status === 'turn_end' && '回合結束'}
            {gameState.status === 'game_over' && '遊戲結算'}
          </span>
        </div>
        
        <div className="flex gap-3 items-center">
          <span className="text-xs font-bold text-white/50 tracking-widest hidden md:block">回合 {gameState.currentRound || 0}/{rules.drawRounds}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-2 md:p-6 pb-6 z-10 overflow-hidden relative w-full max-w-[1920px] mx-auto">
        
        <div className="flex-[3] lg:flex-[4] xl:flex-[5] flex flex-col h-full gap-3 relative min-h-[55vh] md:min-h-[70vh]">
          
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
                      <button className="w-full py-4 rounded-2xl bg-emerald-600 font-bold hover:bg-emerald-500 transition-colors">確認題目</button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {systemWordChoices.map((w, i) => (
                        <button key={i} onClick={() => submitWord(w)} className="py-4 rounded-2xl bg-white/5 border border-white/10 font-bold hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-400 transition-all">
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
              <p className="text-sm text-white/30 animate-pulse">準備進入下一回合...</p>
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

          {/* 🎨 神級 SVG 畫布 (React Sketch Canvas) */}
          <div className="flex-1 w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            {gameState.status === 'drawing' && (
              <div className="absolute top-4 md:top-6 left-0 right-0 flex justify-center pointer-events-none z-10">
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

            <div className={`w-full h-full ${!isMyTurnToDraw || !isDrawingState ? 'pointer-events-none' : ''}`}>
              <ReactSketchCanvas
                ref={canvasRef}
                strokeWidth={lineWidth}
                strokeColor={color}
                eraserWidth={lineWidth * 3}
                canvasColor="transparent"
                onChange={handleStroke}
                style={{ border: 'none', cursor: isMyTurnToDraw && isDrawingState ? (eraserMode ? 'cell' : 'crosshair') : 'default' }}
              />
            </div>
          </div>

          {/* 工具列 */}
          <div className={`h-16 md:h-20 w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between px-4 md:px-6 shadow-lg flex-shrink-0 transition-opacity ${!isMyTurnToDraw ? 'opacity-30 pointer-events-none' : ''}`}>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pr-2">
              {COLORS.map(c => (
                <button
                  key={c.hex} 
                  onClick={() => {
                    if (c.hex === 'eraser') {
                      setEraserMode(true);
                      canvasRef.current?.eraseMode(true);
                    } else {
                      setEraserMode(false);
                      canvasRef.current?.eraseMode(false);
                      setColor(c.hex);
                    }
                  }}
                  title={c.name}
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 transition-all border-2 ${(!eraserMode && color === c.hex) || (eraserMode && c.hex === 'eraser') ? 'scale-110 shadow-[0_0_15px_currentColor]' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.hex === 'eraser' ? '#262626' : c.hex, borderColor: ((!eraserMode && color === c.hex) || (eraserMode && c.hex === 'eraser')) ? '#fff' : 'transparent', color: c.hex === 'eraser' ? '#fff' : c.hex }}
                >
                  {c.hex === 'eraser' && <span className="text-white text-[9px] md:text-[10px] font-bold block mt-2 md:mt-2.5">橡皮</span>}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 border-l border-white/10 pl-3">
              <div className="flex gap-2 items-center mr-1 hidden sm:flex">
                <div className="w-2 h-2 rounded-full bg-white/50"></div>
                <input type="range" min="2" max="20" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="w-16 md:w-20 accent-emerald-500" />
                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-white/80"></div>
              </div>
              <button onClick={clearCanvas} className="px-3 md:px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/50 rounded-xl text-[10px] md:text-xs font-bold transition-colors whitespace-nowrap">
                🗑️ 清空
              </button>
            </div>
          </div>
        </div>

        {/* 右側：玩家列表與聊天區 */}
        <div className="w-full lg:w-[260px] xl:w-[320px] bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl h-[400px] lg:h-auto z-10 relative">
          
          <div className="p-3 md:p-4 border-b border-white/5 bg-black/20 flex gap-2 overflow-x-auto scrollbar-hide">
            {alivePlayers.map(uid => {
              const p = roomData.players[uid];
              const score = gameState.scores?.[uid] || 0;
              const isDrawingNow = uid === currentDrawerUid;
              const hasGuessed = gameState.correctGuesserIds?.includes(uid);
              return (
                <div key={uid} className={`flex flex-col items-center flex-shrink-0 transition-all ${isDrawingNow ? 'scale-110 mx-2' : 'opacity-80'}`}>
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 overflow-hidden relative ${isDrawingNow ? 'border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : (hasGuessed ? 'border-yellow-400' : 'border-white/10')}`}>
                    <img src={p?.avatar} className="w-full h-full object-cover" />
                    {hasGuessed && <div className="absolute inset-0 bg-yellow-400/30 flex items-center justify-center text-sm">💡</div>}
                    {isDrawingNow && <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center text-sm">✏️</div>}
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
