'use client';

import { useState, useEffect } from 'react';
import { ref, push, update, get } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

export default function EvilFills({ user, roomId, roomData, handleLeaveRoom }) {
  const [fillInput, setFillInput] = useState('');
  const [customPromptInput, setCustomPromptInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const gameState = roomData?.gameState || { status: 'loading' };
  const rules = roomData?.info?.rules || { fillTime: 60, promptMode: 'turn', evilRounds: 3 };
  const isHost = roomData?.info?.hostId === user?.uid;
  const players = roomData?.players || {};
  
  const playerQueue = gameState.playerQueue || [];
  const currentDealerUid = playerQueue[gameState.currentRoundIdx % playerQueue.length];
  const isMyTurnToDeal = currentDealerUid === user?.uid;
  
  const currentPrompt = gameState.currentPrompt || "";
  const allAnswers = gameState.playerAnswers || {};

  // 💡 銜接 WaitingRoom：接收到 init 訊號自動切換狀態
  useEffect(() => {
    if (isHost && gameState.status === 'init') {
      const uids = Object.keys(players);
      const updates = {};
      updates[`rooms/${roomId}/gameState`] = {
        status: 'deciding', // 進入決策階段
        currentRoundIdx: 0,
        playerQueue: uids.sort(() => 0.5 - Math.random()),
        scores: {}
      };
      update(ref(database), updates);
    }
  }, [isHost, gameState.status, players, roomId]);

  // ⏱️ 核心計時器
  useEffect(() => {
    if ((gameState.status === 'answering' || gameState.status === 'voting') && gameState.timerEnd) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((gameState.timerEnd - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0 && isHost) {
          if (gameState.status === 'answering') goToVoting();
          if (gameState.status === 'voting') nextTurn();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState.status, gameState.timerEnd, isHost]);

  const selectAISelection = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generatePrompts', { method: 'POST' });
      const data = await response.json();
      const randomPrompt = data.prompts[Math.floor(Math.random() * data.prompts.length)];
      startAnswering(randomPrompt);
    } catch (e) {
      startAnswering("如果我可以送給房主一個禮物，我會送「___」");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectCustomSelection = () => {
    if (!customPromptInput.includes('___')) return alert("題目必須包含「___」供大家填空喔！");
    startAnswering(customPromptInput);
    setCustomPromptInput('');
  };

  const startAnswering = (promptText) => {
    const updates = {};
    updates[`rooms/${roomId}/gameState/status`] = 'answering';
    updates[`rooms/${roomId}/gameState/currentPrompt`] = promptText;
    updates[`rooms/${roomId}/gameState/playerAnswers`] = {};
    updates[`rooms/${roomId}/gameState/timerEnd`] = Date.now() + (rules.fillTime * 1000);
    update(ref(database), updates);
  };

  const goToVoting = () => {
    update(ref(database, `rooms/${roomId}/gameState`), {
      status: 'voting', timerEnd: Date.now() + (20 * 1000), votes: {}
    });
  };

  const nextTurn = () => {
    const nextIdx = gameState.currentRoundIdx + 1;
    if (nextIdx >= (rules.evilRounds * playerQueue.length)) {
      update(ref(database, `rooms/${roomId}/gameState/status`), 'game_over');
    } else {
      update(ref(database, `rooms/${roomId}/gameState`), {
        status: 'deciding', currentRoundIdx: nextIdx, playerAnswers: {}, votes: {}, currentPrompt: ""
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col vibe-font relative overflow-hidden">
      <div className="flex justify-between items-center p-6 z-10 border-b border-white/5">
        <button onClick={handleLeaveRoom} className="bg-white/5 hover:bg-white/10 px-5 py-2 rounded-full border border-white/10 text-xs font-bold transition-all">← 退出</button>
        <div className="flex flex-col items-center">
          <div className="bg-yellow-500/10 border border-yellow-500/30 px-6 py-2 rounded-full">
            <span className="font-black tracking-widest text-xs text-yellow-400 uppercase">
              {gameState.status === 'init' ? '啟動中...' : gameState.status === 'deciding' ? '莊家決策中' : gameState.status === 'answering' ? `🖊️ 全員惡搞中 (${timeLeft}s)` : gameState.status === 'voting' ? `🗳️ 投票中 (${timeLeft}s)` : '遊戲結束'}
            </span>
          </div>
        </div>
        <div className="bg-white/10 border border-white/10 px-4 py-1.5 rounded-full"><span className="font-mono font-black text-sm tracking-widest text-white">{roomId}</span></div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-8 z-10">
        
        {gameState.status === 'deciding' && (
          <div className="w-full max-w-2xl text-center space-y-8 animate-in fade-in">
            <div className="flex flex-col items-center mb-10">
              <img src={players[currentDealerUid]?.avatar} className="w-20 h-20 rounded-full border-4 border-yellow-500 mb-4 shadow-[0_0_20px_rgba(234,179,8,0.5)]" />
              <h3 className="text-2xl font-black"><span className="text-yellow-400">{players[currentDealerUid]?.name}</span> 正在主宰這回合...</h3>
            </div>
            
            {isMyTurnToDeal ? (
              <div className="grid grid-cols-1 gap-6">
                <button onClick={selectAISelection} disabled={isGenerating} className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-yellow-500 hover:text-black transition-all group">
                  <div className="text-4xl mb-2">🤖</div>
                  <div className="text-xl font-black">{isGenerating ? 'AI 思索中...' : '呼叫 Gemini 出題'}</div>
                </button>
                <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] space-y-4">
                  <div className="text-4xl">✍️</div>
                  <div className="text-xl font-black">我要親自出題</div>
                  <input type="text" placeholder="輸入題目，必須包含 ___ (例如：校長最怕___)" value={customPromptInput} onChange={e => setCustomPromptInput(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-yellow-500" />
                  <button onClick={selectCustomSelection} className="w-full py-3 bg-yellow-500 text-black font-black rounded-xl">發布自訂題目</button>
                </div>
              </div>
            ) : (
              <div className="text-white/20 text-xl font-bold animate-pulse italic">等待莊家決定要 AI 還是自己來...</div>
            )}
          </div>
        )}

        {gameState.status === 'answering' && (
          <div className="w-full max-w-4xl space-y-10 animate-in zoom-in">
            <div className="bg-white/5 border border-white/10 p-12 rounded-[3.5rem] text-center shadow-2xl relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-6 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">情境題</div>
              <h2 className="text-3xl md:text-5xl font-black leading-tight tracking-tight">{currentPrompt}</h2>
            </div>
            {allAnswers[user.uid] ? (
              <div className="text-center py-10 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] text-emerald-400 font-bold animate-pulse">答案已傳輸！等待其他特工...</div>
            ) : (
              <div className="relative group">
                <textarea value={fillInput} onChange={e => setFillInput(e.target.value)} placeholder="輸入最靠北的答案..." className="w-full bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-10 text-3xl font-black outline-none focus:border-yellow-500 focus:bg-white/5 transition-all min-h-[200px]" />
                <button onClick={() => { update(ref(database, `rooms/${roomId}/gameState/playerAnswers/${user.uid}`), fillInput); setFillInput(''); }} className="absolute right-8 bottom-8 px-10 py-4 bg-yellow-500 text-black font-black rounded-full hover:scale-105 transition-all">提交</button>
              </div>
            )}
          </div>
        )}

        {gameState.status === 'voting' && (
          <div className="w-full max-w-5xl space-y-8 animate-in fade-in">
             <div className="text-center mb-10">
                <h2 className="text-2xl font-bold text-white/50">{currentPrompt}</h2>
                <p className="text-sm text-yellow-500 font-bold mt-2">點擊最讚的答案 (不能投自己)</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(allAnswers).map(([uid, ans]) => (
                  <button 
                    key={uid} onClick={() => { if(uid!==user.uid) update(ref(database, `rooms/${roomId}/gameState/votes/${user.uid}`), uid); }}
                    disabled={uid === user.uid || gameState.votes?.[user.uid]}
                    className={`p-10 rounded-[2.5rem] border-2 text-left transition-all ${gameState.votes?.[user.uid] === uid ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-white/5 border-white/10 hover:border-yellow-500'}`}
                  >
                    <div className="text-3xl font-black">“ {ans} ”</div>
                  </button>
                ))}
             </div>
          </div>
        )}

        {gameState.status === 'game_over' && (
          <div className="text-center animate-in zoom-in">
            <h2 className="text-5xl font-black text-yellow-400 mb-8">🏆 遊戲結束</h2>
            <button onClick={handleLeaveRoom} className="px-10 py-4 bg-white text-black rounded-full font-black">返回大廳</button>
          </div>
        )}
      </main>
    </div>
  );
}
