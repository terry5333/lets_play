'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, push, update, increment, get } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

const SYSTEM_WORDS = ['蘋果', '太空人', '皮卡丘', '電腦', '珍珠奶茶', '恐龍', '自由女神', '黑洞', '馬桶', '衛生紙', '長頸鹿', '麥克風', '蒙娜麗莎', '蜘蛛人', '火鍋'];

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

  const boardWrapperRef = useRef(null);
  const [boardScale, setBoardScale] = useState(1);

  useEffect(() => {
    if (!boardWrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) setBoardScale(entry.contentRect.width / 1000); 
    });
    observer.observe(boardWrapperRef.current);
    return () => observer.disconnect();
  }, []);

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
    if (isHost && gameState.status === 'init') {
      update(ref(database, `rooms/${roomId}/gameState`), {
        status: 'selecting', currentDrawerIdx: 0, currentRound: 1,
        playerQueue: Object.keys(roomData.players).sort(() => 0.5 - Math.random()), scores: {}
      });
    }
  }, [isHost, gameState.status, roomId]);

  useEffect(() => {
    if (gameState.status === 'selecting' && isMyTurnToDraw) {
      setSystemWordChoices([...SYSTEM_WORDS].sort(() => 0.5 - Math.random()).slice(0, 3));
    }
  }, [gameState.status, isMyTurnToDraw]);

  const submitWord = (word) => {
    update(ref(database), {
      [`rooms/${roomId}/gameState/status`]: 'drawing',
      [`rooms/${roomId}/gameState/currentWord`]: word,
      [`rooms/${roomId}/gameState/turnEndTime`]: Date.now() + (rules.drawTime * 1000),
      [`rooms/${roomId}/gameState/correctGuesserIds`]: []
    });
  };

  const endTurn = (extraUpdates = {}) => {
    extraUpdates[`rooms/${roomId}/gameState/status`] = 'turn_end';
    update(ref(database), extraUpdates);
    
    let nextIdx = gameState.currentDrawerIdx + 1;
    let nextRound = gameState.currentRound;
    let nextStatus = 'selecting';

    if (nextIdx >= alivePlayers.length) {
      nextIdx = 0; nextRound++;
      if (nextRound > (rules.drawRounds || 2)) nextStatus = 'game_over';
    }

    setTimeout(async () => {
      const snap = await get(ref(database, `rooms/${roomId}/gameState/status`));
      if (snap.val() === 'turn_end') {
        update(ref(database, `rooms/${roomId}/gameState`), {
          status: nextStatus, currentDrawerIdx: nextIdx, currentRound: nextRound, correctGuesserIds: []
        });
      }
    }, 4000); 
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const inputTxt = chatInput.trim();
    setChatInput('');

    if (gameState.status === 'drawing' && !isMyTurnToDraw && inputTxt === currentWord) {
        if (!gameState.correctGuesserIds?.includes(user.uid)) {
          const points = 10 + Math.floor((timeLeft / rules.drawTime) * 20); 
          const updates = {
            [`rooms/${roomId}/gameState/correctGuesserIds`]: [...(gameState.correctGuesserIds || []), user.uid],
            [`rooms/${roomId}/gameState/scores/${user.uid}`]: increment(points),
            [`rooms/${roomId}/gameState/scores/${currentDrawerUid}`]: increment(15),
            [`users/${user.uid}/score`]: increment(points)
          };
          push(ref(database, `rooms/${roomId}/chat`), { senderId: 'system', senderName: '系統', text: `🟢 ${user.displayName} 猜對了！獲得 ${points} 分`, timestamp: Date.now() });
          endTurn(updates);
          return;
        }
    }
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: inputTxt, timestamp: Date.now() });
  };

  const currentBoardId = `vibe_dg_${roomId}_r${gameState.currentRound}_p${gameState.currentDrawerIdx}`;
  const whiteboardUrl = `https://wbo.ophir.dev/boards/${currentBoardId}`;

  return (
    // 💡 修復重點：改為 h-full
    <div className="h-full bg-[#0a0a0b] text-white flex flex-col vibe-font relative overflow-hidden">
      <div className="flex justify-between items-center p-3 md:p-6 z-10 flex-shrink-0 border-b border-white/5">
        <button onClick={handleLeaveRoom} className="bg-white/5 px-4 py-2 rounded-full text-xs font-bold">← 退出</button>
        <div className="bg-emerald-500/10 border border-emerald-500/30 px-6 py-1.5 rounded-full text-center">
          <span className="font-black text-xs text-emerald-400">{gameState.status === 'selecting' ? '選詞中' : gameState.status === 'drawing' ? `剩餘 ${timeLeft} 秒` : '結算'}</span>
          {gameState.status !== 'waiting' && <span className="block text-[9px] text-white/40 mt-1">Round {gameState.currentRound}/{rules.drawRounds}</span>}
        </div>
        <div className="bg-white/10 px-4 py-1.5 rounded-full"><span className="font-mono text-sm text-white">{roomId}</span></div>
      </div>

      {/* 💡 修復重點：加入 min-h-0 防止 flex 子元素撐爆父元素 */}
      <div className="flex-1 flex flex-col xl:flex-row gap-4 p-4 z-10 min-h-0 max-w-[1920px] mx-auto w-full">
        
        {/* 畫布區塊 */}
        <div className="flex-[3] flex flex-col relative items-center justify-center min-h-0 bg-black/20 rounded-[2.5rem] border border-white/5 p-4 overflow-hidden">
          {gameState.status === 'selecting' && (
            <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center p-8 rounded-[2.5rem]">
              {isMyTurnToDraw ? (
                <div className="text-center">
                  <h3 className="text-2xl font-black mb-6 text-emerald-400">請選擇題目</h3>
                  <div className="flex flex-col gap-3 w-64">
                    {systemWordChoices.map(w => <button key={w} onClick={() => submitWord(w)} className="p-4 bg-white/10 rounded-xl font-bold hover:bg-emerald-500 hover:text-black">{w}</button>)}
                  </div>
                </div>
              ) : (
                <div className="text-xl font-bold animate-pulse text-white/50">{roomData.players[currentDrawerUid]?.name} 正在選題...</div>
              )}
            </div>
          )}
          {gameState.status === 'turn_end' && (
            <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center rounded-[2.5rem]">
              <span className="text-xs font-black text-white/30 uppercase mb-4">正確答案</span>
              <h2 className="text-5xl font-black text-emerald-400">{currentWord}</h2>
            </div>
          )}
          {gameState.status === 'game_over' && (
            <div className="absolute inset-0 z-40 bg-black/95 flex flex-col items-center justify-center rounded-[2.5rem]">
              <h2 className="text-4xl font-black text-yellow-400 mb-8">遊戲結算</h2>
              <button onClick={handleLeaveRoom} className="px-8 py-3 bg-white text-black rounded-full font-black">返回大廳</button>
            </div>
          )}

          <div ref={boardWrapperRef} className="w-full max-w-[700px] mx-auto aspect-square bg-white rounded-3xl relative overflow-hidden group shadow-lg">
            {gameState.status === 'drawing' && (
              <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-20">
                <div className="bg-black/80 px-6 py-2 rounded-full text-center shadow-lg border border-white/20">
                  <span className="text-xl font-black text-emerald-400 tracking-widest">{isMyTurnToDraw ? currentWord : currentWord.replace(/./g, '◯')}</span>
                </div>
              </div>
            )}
            <div className="absolute top-0 left-0" style={{ width: '1000px', height: '1000px', transform: `scale(${boardScale})`, transformOrigin: 'top left' }}>
              <iframe src={whiteboardUrl} className="w-full h-full border-none pointer-events-auto" scrolling="no" />
            </div>
            {!isMyTurnToDraw && gameState.status === 'drawing' && <div className="absolute inset-0 z-10 bg-transparent cursor-not-allowed" />}
          </div>
        </div>

        {/* 聊天與計分區 */}
        <div className="flex-1 xl:w-[350px] flex flex-col gap-4 min-h-0">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
            {alivePlayers.map(uid => (
              <div key={uid} className={`flex flex-col items-center flex-shrink-0 ${uid === currentDrawerUid ? 'scale-110' : 'opacity-60'}`}>
                <img src={roomData.players[uid]?.avatar} className={`w-10 h-10 rounded-full border-2 ${uid === currentDrawerUid ? 'border-emerald-400' : 'border-white/10'}`} />
                <span className="text-[10px] font-bold mt-1">{gameState.scores?.[uid] || 0}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => (
                <div key={i} className={`flex ${m.senderId === 'system' ? 'justify-center' : m.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                  <span className={`px-3 py-1.5 rounded-xl text-xs ${m.senderId === 'system' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : m.senderId === user?.uid ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white'}`}>{m.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="猜測..." disabled={isMyTurnToDraw && gameState.status === 'drawing'} className="w-full bg-black/40 border border-white/10 rounded-full py-3 px-4 text-sm outline-none" />
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
