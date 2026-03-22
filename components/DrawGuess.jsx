'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, push, update, increment, get } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

const SYSTEM_WORDS = ['蘋果', '太空人', '皮卡丘', '電腦', '珍珠奶茶', '恐龍', '自由女神', '黑洞', '馬桶', '衛生紙', '長頸鹿', '麥克風', '蒙娜麗莎', '蜘蛛人', '火鍋', '吉他', '殭屍', '獨角獸', '魔法陣', '忍者', '漢堡', '鋼鐵人', '下雨', '珍珠', '口罩', '外星人', '火箭', '鑽石', '貓咪', '企鵝'];

export default function DrawGuess({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [systemWordChoices, setSystemWordChoices] = useState([]); 

  const gameState = roomData?.gameState || { status: 'waiting' };
  const rules = roomData?.info?.rules || { drawRounds: 2, drawTime: 60 };
  const isHost = roomData?.info?.hostId === user?.uid;
  
  const alivePlayers = gameState.playerQueue || Object.keys(roomData?.players || {});
  const currentDrawerUid = gameState.playerQueue?.[gameState.currentDrawerIdx];
  const isMyTurnToDraw = currentDrawerUid === user?.uid;
  const currentWord = gameState.currentWord || '';

  // 💡 神級修復：畫布等比例縮放引擎
  const boardWrapperRef = useRef(null);
  const [boardScale, setBoardScale] = useState(1);

  useEffect(() => {
    if (!boardWrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // 我們強制把內部畫布當成 1000px，然後根據外框真實寬度進行等比例 scale 縮放
        setBoardScale(entry.contentRect.width / 1000); 
      }
    });
    observer.observe(boardWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // ⏱️ 遊戲核心計時器
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

  // 🎲 準備題目選項
  useEffect(() => {
    if (gameState.status === 'selecting' && isMyTurnToDraw) {
      const shuffled = [...SYSTEM_WORDS].sort(() => 0.5 - Math.random());
      setSystemWordChoices(shuffled.slice(0, 3));
    }
  }, [gameState.status, isMyTurnToDraw]);

  // 🎮 遊戲流程：房主按下開始按鈕
  const startGame = () => {
    const players = Object.keys(roomData.players);
    update(ref(database, `rooms/${roomId}/info/status`), 'playing');
    update(ref(database, `rooms/${roomId}/gameState`), {
      status: 'selecting',
      currentDrawerIdx: 0,
      currentRound: 1,
      playerQueue: players.sort(() => 0.5 - Math.random()), 
      scores: {}
    });
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: '🚀 遊戲開始！準備發揮你的靈魂畫技！', timestamp: Date.now() });
  };

  // ✏️ 選擇題目
  const submitWord = (word) => {
    const updates = {};
    updates[`rooms/${roomId}/gameState/status`] = 'drawing';
    updates[`rooms/${roomId}/gameState/currentWord`] = word;
    updates[`rooms/${roomId}/gameState/turnEndTime`] = Date.now() + (rules.drawTime * 1000);
    updates[`rooms/${roomId}/gameState/correctGuesserIds`] = []; 
    
    update(ref(database), updates);
    push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🎨 ${user.displayName} 已經選好題目並開始作畫！`, timestamp: Date.now() });
  };

  // 🔄 換人邏輯
  const endTurn = (extraUpdates = {}) => {
    extraUpdates[`rooms/${roomId}/gameState/status`] = 'turn_end';
    update(ref(database), extraUpdates);
    
    let nextIdx = gameState.currentDrawerIdx + 1;
    let nextRound = gameState.currentRound;
    let nextStatus = 'selecting';

    if (nextIdx >= alivePlayers.length) {
      nextIdx = 0;
      nextRound++;
      if (nextRound > (rules.drawRounds || 2)) nextStatus = 'game_over';
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

  // 💬 聊天與搶答判定
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const inputTxt = chatInput.trim();
    setChatInput('');

    if (gameState.status === 'drawing') {
      if (isMyTurnToDraw) {
        if (inputTxt.includes(currentWord)) return alert("畫家不可以洩漏答案！");
      } else {
        const hasGuessed = gameState.correctGuesserIds?.includes(user.uid);
        if (!hasGuessed && inputTxt === currentWord) {
          const points = 10 + Math.floor((timeLeft / rules.drawTime) * 20); 
          const updates = {};
          updates[`rooms/${roomId}/gameState/correctGuesserIds`] = [...(gameState.correctGuesserIds || []), user.uid];
          updates[`rooms/${roomId}/gameState/scores/${user.uid}`] = increment(points); 
          updates[`rooms/${roomId}/gameState/scores/${currentDrawerUid}`] = increment(15); 
          updates[`users/${user.uid}/score`] = increment(points); 

          push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🟢 搶答成功！${user.displayName} 猜對了！獲得 ${points} 分`, timestamp: Date.now() });
          
          endTurn(updates);
          return;
        }
      }
    }
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: inputTxt, timestamp: Date.now() });
  };

  const currentBoardId = `vibe_dg_${roomId}_r${gameState.currentRound}_p${gameState.currentDrawerIdx}`;
  const whiteboardUrl = `https://wbo.ophir.dev/boards/${currentBoardId}`;
  const hiddenWord = currentWord.replace(/./g, ' ◯ ');

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col vibe-font relative overflow-hidden">
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="flex justify-between items-center p-4 md:p-6 z-10">
        <button onClick={handleLeaveRoom} className="bg-white/5 hover:bg-white/10 px-5 py-2 rounded-full border border-white/10 text-xs font-bold transition-all backdrop-blur-md">← 退出</button>
        <div className="flex flex-col items-center">
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-6 py-2 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md">
            <span className="font-black tracking-widest text-xs text-emerald-400 uppercase">
              {gameState.status === 'waiting' ? '準備中' : gameState.status === 'selecting' ? '畫家選詞中' : gameState.status === 'drawing' ? `⏱️ 剩餘 ${timeLeft} 秒` : '回合結算'}
            </span>
          </div>
          {gameState.status !== 'waiting' && (
            <span className="text-[10px] text-white/40 font-mono mt-2 tracking-[0.3em] uppercase">Round {gameState.currentRound || 1} / {rules.drawRounds}</span>
          )}
        </div>
        <div className="w-16"></div> 
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-6 p-4 md:p-8 z-10 overflow-hidden relative max-w-[1920px] mx-auto w-full">
        
        <div className="flex-[4] flex flex-col h-full relative items-center justify-center min-h-[50vh]">
          
          {/* 💡 狀態 0: 等待房主開始 (按鈕回來了！) */}
          {gameState.status === 'waiting' && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center p-8 m-auto w-full max-w-[800px] aspect-square shadow-2xl animate-in zoom-in duration-300">
              <h2 className="text-4xl font-black mb-8 text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] tracking-widest">🎨 準備作畫</h2>
              {isHost ? (
                <button onClick={startGame} className="px-12 py-5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black text-xl rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                  開始遊戲 ({alivePlayers.length} 人)
                </button>
              ) : (
                <div className="px-10 py-4 bg-white/5 rounded-full text-white/50 font-bold border border-white/10 animate-pulse">
                  等待房主開始...
                </div>
              )}
            </div>
          )}

          {gameState.status === 'selecting' && (
            <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-xl rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center p-8 m-auto w-full max-w-[800px] aspect-square shadow-2xl">
              {isMyTurnToDraw ? (
                <div className="text-center animate-in zoom-in duration-300">
                  <h3 className="text-3xl font-black mb-2 text-emerald-400">輪到你了！</h3>
                  <p className="text-sm text-white/40 mb-10">請選擇一個題目開始作畫</p>
                  <div className="flex flex-col gap-4 w-full max-w-[250px] mx-auto">
                    {systemWordChoices.map(w => (
                      <button key={w} onClick={() => submitWord(w)} className="px-8 py-4 bg-white/5 border border-white/10 rounded-[1.5rem] font-bold hover:bg-emerald-500 hover:text-black transition-all">
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center animate-pulse">
                  <div className="text-6xl mb-6">🤔</div>
                  <h3 className="text-xl font-bold text-white/50">{roomData.players[currentDrawerUid]?.name} 正在選題...</h3>
                </div>
              )}
            </div>
          )}

          {gameState.status === 'turn_end' && (
            <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center animate-in fade-in m-auto w-full max-w-[800px] aspect-square shadow-2xl">
              <span className="text-xs font-black tracking-[0.5em] text-white/30 uppercase mb-4">本局正確答案</span>
              <h2 className="text-6xl font-black text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.5)]">{currentWord}</h2>
            </div>
          )}

          {gameState.status === 'game_over' && (
            <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-2xl rounded-[3rem] border border-white/10 flex flex-col items-center justify-center p-10 animate-in zoom-in w-full h-full">
              <h2 className="text-5xl font-black text-yellow-400 mb-10 tracking-tighter">🏆 遊戲結算 🏆</h2>
              <div className="w-full max-w-md space-y-3 mb-12">
                {Object.entries(gameState.scores || {}).sort((a,b) => b[1]-a[1]).map(([uid, score], idx) => (
                  <div key={uid} className={`flex items-center justify-between p-5 rounded-2xl border ${idx===0 ? 'bg-yellow-400/10 border-yellow-400/50 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-3">
                      <img src={roomData.players[uid]?.avatar} className="w-8 h-8 rounded-full border border-inherit" />
                      <span className="font-bold">{roomData.players[uid]?.name}</span>
                    </div>
                    <span className="font-mono font-black text-lg">{score} PTS</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <button onClick={handleLeaveRoom} className="px-10 py-4 bg-white/10 text-white hover:bg-white/20 rounded-full font-black transition-colors">返回大廳</button>
                {isHost && (
                  <button onClick={() => update(ref(database, `rooms/${roomId}/info`), { status: 'waiting' })} className="px-10 py-4 bg-emerald-600 text-white rounded-full font-black shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:bg-emerald-500 transition-colors">再來一局</button>
                )}
              </div>
            </div>
          )}

          {/* 🎨 神級縮放白板容器 */}
          <div ref={boardWrapperRef} className="w-full max-w-[800px] mx-auto aspect-square bg-white rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            {gameState.status === 'drawing' && (
              <div className="absolute top-4 md:top-6 left-0 right-0 flex justify-center pointer-events-none z-20">
                <div className="bg-black/80 backdrop-blur-md px-6 md:px-8 py-2 md:py-3 rounded-full border border-white/10 text-center shadow-xl">
                  <span className="text-[9px] md:text-[10px] text-white/40 block tracking-widest mb-1 uppercase">
                    {isMyTurnToDraw ? '你的題目是' : '正在猜測中'}
                  </span>
                  <span className="text-xl md:text-2xl font-black tracking-widest text-emerald-400">
                    {isMyTurnToDraw ? currentWord : hiddenWord}
                  </span>
                </div>
              </div>
            )}

            {/* 這裡的 transform 魔法會讓 1000px 的畫布完美縮放塞進使用者的螢幕裡 */}
            <div 
              className="absolute top-0 left-0" 
              style={{ 
                width: '1000px', 
                height: '1000px', 
                transform: `scale(${boardScale})`, 
                transformOrigin: 'top left' 
              }}
            >
              <iframe src={whiteboardUrl} className="w-full h-full border-none" scrolling="no" />
            </div>

            {!isMyTurnToDraw && gameState.status === 'drawing' && (
              <div 
                className="absolute inset-0 z-10 bg-transparent cursor-not-allowed" 
                onClick={() => alert("現在不是你的回合，只能看不能畫喔！")}
              />
            )}
          </div>
        </div>

        <div className="w-full xl:w-[350px] flex flex-col gap-4">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 flex gap-3 overflow-x-auto scrollbar-hide shadow-xl">
            {alivePlayers.map(uid => (
              <div key={uid} className={`flex flex-col items-center flex-shrink-0 transition-all ${uid === currentDrawerUid ? 'scale-110 mx-2' : 'opacity-60'}`}>
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 overflow-hidden relative ${uid === currentDrawerUid ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-white/10'}`}>
                  <img src={roomData.players[uid]?.avatar} className="w-full h-full object-cover" />
                  {uid === currentDrawerUid && <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center text-xs">✏️</div>}
                </div>
                <span className="text-[10px] font-bold mt-1 text-white/80">{gameState.scores?.[uid] || 0}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl min-h-[300px] xl:min-h-0">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
                const isMe = m.senderId === user?.uid;
                const isSystem = m.senderId === 'system';
                
                if (isSystem) return (
                  <div key={i} className="flex justify-center w-full">
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-4 py-1.5 rounded-full border border-emerald-500/20 text-center">{m.text}</span>
                  </div>
                );
                
                return (
                  <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <img src={m.avatar} className="w-8 h-8 rounded-full bg-white/10 border border-white/5 flex-shrink-0" />
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      {!isMe && <span className="text-[9px] text-white/30 ml-2 mb-1">{m.senderName}</span>}
                      <div className={`px-4 py-2.5 rounded-2xl text-[13px] ${isMe ? 'bg-emerald-600/80 text-white rounded-tr-none shadow-md' : 'bg-white/5 border border-white/5 rounded-tl-none text-white/90'}`}>{m.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-black/40">
              <div className="relative">
                <input 
                  value={chatInput} onChange={e => setChatInput(e.target.value)} 
                  placeholder={isMyTurnToDraw ? "畫家專心作畫，禁止打字暴雷..." : "輸入你的猜測..."} 
                  disabled={isMyTurnToDraw && gameState.status === 'drawing'}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-5 pr-16 text-sm outline-none focus:border-emerald-500/50 disabled:opacity-50 transition-all placeholder:text-white/20" 
                />
                <button 
                  disabled={isMyTurnToDraw && gameState.status === 'drawing'}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-full transition-colors disabled:opacity-50"
                >
                  發送
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
