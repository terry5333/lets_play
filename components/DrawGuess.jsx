'use client';

import { useState, useEffect, useRef } from 'react';
import { ref, push, onValue, remove } from 'firebase/database';
import { database } from '../lib/firebaseConfig';

const COLORS = [
  { name: '螢光白', hex: '#f8fafc' },
  { name: '霓虹黃', hex: '#fde047' },
  { name: '雷射粉', hex: '#f43f5e' },
  { name: '電馭紫', hex: '#a855f7' },
  { name: '量子藍', hex: '#3b82f6' },
  { name: '矩陣綠', hex: '#10b981' },
  { name: '暗物質(橡皮擦)', hex: '#000000' } // 橡皮擦用背景色代替
];

export default function DrawGuess({ user, roomId, roomData, handleLeaveRoom }) {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // 🎨 畫布狀態
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0].hex);
  const [lineWidth, setLineWidth] = useState(4);
  const currentLineRef = useRef([]); // 暫存目前正在畫的這一筆

  const gameState = roomData?.gameState || {};
  const isHost = roomData?.info?.hostId === user?.uid;

  // 🖌️ 1. 監聽 Firebase 畫布資料並重繪
  useEffect(() => {
    const linesRef = ref(database, `rooms/${roomId}/gameState/lines`);
    const unsub = onValue(linesRef, (snapshot) => {
      const lines = snapshot.val() ? Object.values(snapshot.val()) : [];
      redrawCanvas(lines);
    });
    return () => unsub();
  }, [roomId]);

  // 重繪畫布函數 (支援百分比座標轉回實際像素)
  const redrawCanvas = (lines) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    lines.forEach(line => {
      if (!line.points || line.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      // 橡皮擦放大一點比較好擦
      ctx.lineWidth = line.color === '#000000' ? line.width * 4 : line.width; 
      
      // 將 0~1 的百分比座標轉換為當前畫布的實際像素
      const startX = line.points[0].x * canvas.width;
      const startY = line.points[0].y * canvas.height;
      ctx.moveTo(startX, startY);

      for (let i = 1; i < line.points.length; i++) {
        const x = line.points[i].x * canvas.width;
        const y = line.points[i].y * canvas.height;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  };

  // 🖌️ 2. 滑鼠/手指 操作邏輯
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // 支援觸控與滑鼠
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // 計算出 0 ~ 1 的百分比座標
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x, y };
  };

  const startDrawing = (e) => {
    // 阻止預設滾動行為
    e.preventDefault(); 
    setIsDrawing(true);
    const coords = getCoordinates(e);
    currentLineRef.current = [coords];
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    currentLineRef.current.push(coords);

    // 即時在本地端預覽畫出來的線 (不透過 Firebase，保證極致流暢)
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = color === '#000000' ? lineWidth * 4 : lineWidth;

    const prevCoords = currentLineRef.current[currentLineRef.current.length - 2];
    ctx.beginPath();
    ctx.moveTo(prevCoords.x * canvas.width, prevCoords.y * canvas.height);
    ctx.lineTo(coords.x * canvas.width, coords.y * canvas.height);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // 當一筆畫完(滑鼠放開)時，將這一筆完整傳送至 Firebase
    if (currentLineRef.current.length > 1) {
      const newLine = {
        color: color,
        width: lineWidth,
        points: currentLineRef.current
      };
      push(ref(database, `rooms/${roomId}/gameState/lines`), newLine);
    }
    currentLineRef.current = [];
  };

  // 🗑️ 清空畫布
  const clearCanvas = () => {
    remove(ref(database, `rooms/${roomId}/gameState/lines`));
  };

  // 調整 Canvas 實際解析度以適應容器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // 設定畫布內部解析度 (固定比例或動態適應)
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
  }, []);

  // 💬 聊天室邏輯
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), { senderId: user.uid, senderName: user.displayName, avatar: user.photoURL || '', text: chatInput, timestamp: Date.now() });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col vibe-font relative overflow-hidden selection:bg-emerald-500/20">
      
      {/* 🌠 霓虹背景光暈 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse duration-[10s]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[100px] rounded-full animate-pulse duration-[8s]"></div>
      </div>

      {/* 頂部狀態列 */}
      <div className="flex justify-between items-center p-4 md:p-6 z-10 flex-shrink-0">
        <button onClick={handleLeaveRoom} className="flex items-center bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full backdrop-blur-md transition-colors border border-white/10 shadow-inner group">
          <span className="mr-2 text-xl font-black group-hover:-translate-x-1 transition-transform">←</span>
          <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
        </button>
        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-2 rounded-full border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <span className="font-extrabold tracking-widest text-xs drop-shadow-md text-white">
            🎨 你畫我猜：自由塗鴉模式
          </span>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner cursor-pointer hover:bg-white/10">⚙️</div>
        </div>
      </div>

      {/* 畫布與聊天佈局 */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 md:px-8 pb-8 z-10 overflow-hidden">
        
        {/* 左側：主畫布區 */}
        <div className="flex-1 flex flex-col h-full gap-4 max-h-[80vh] lg:max-h-none">
          {/* 畫布本體 (玻璃擬物) */}
          <div className="flex-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerOut={stopDrawing}
              // 支援手機觸控不滾動
              style={{ touchAction: 'none' }}
              className={`w-full h-full cursor-crosshair ${color === '#000000' ? 'cursor-cell' : ''}`}
            />
            {/* 浮動提示 */}
            <div className="absolute top-4 left-6 text-white/30 text-xs font-bold tracking-widest uppercase pointer-events-none">
              Canvas Sync Active
            </div>
          </div>

          {/* 工具列 */}
          <div className="h-20 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] flex items-center justify-between px-6 shadow-lg flex-shrink-0">
            {/* 顏色選擇器 */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pr-4">
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className={`w-10 h-10 rounded-full flex-shrink-0 transition-all border-2 ${color === c.hex ? 'scale-110 shadow-[0_0_15px_currentColor]' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.hex === '#000000' ? '#262626' : c.hex, borderColor: color === c.hex ? '#fff' : 'transparent', color: c.hex }}
                >
                  {c.hex === '#000000' && <span className="text-white text-xs block mt-2.5">Eraser</span>}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 border-l border-white/10 pl-4">
              {/* 粗細調整 */}
              <div className="flex gap-2 items-center mr-2">
                <div className="w-2 h-2 rounded-full bg-white/50"></div>
                <input 
                  type="range" min="2" max="20" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="w-24 accent-emerald-500"
                />
                <div className="w-4 h-4 rounded-full bg-white/80"></div>
              </div>
              
              {/* 清空畫布 */}
              <button onClick={clearCanvas} className="px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/50 rounded-xl text-xs font-bold transition-colors">
                🗑️ 清空
              </button>
            </div>
          </div>
        </div>

        {/* 右側：聊天/猜題區 (桌面版顯示，手機版可隱藏/彈出) */}
        <div className="w-full lg:w-[350px] bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl h-[400px] lg:h-auto">
          <div className="p-5 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <h3 className="font-black tracking-widest text-emerald-400 uppercase text-sm">💬 猜題頻道</h3>
            <span className="text-[10px] text-white/30">{Object.keys(roomData?.players || {}).length} 人在線</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
              const isMe = m.senderId === user?.uid;
              return (
                <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/5 border border-white/10"><img src={m.avatar} className="w-full h-full object-cover" /></div>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    {!isMe && <span className="text-[10px] text-white/40 ml-2 mb-1">{m.senderName}</span>}
                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] ${isMe ? 'bg-emerald-600/80 border border-emerald-500/50 rounded-tr-none shadow-md' : 'bg-white/10 rounded-tl-none'}`}>{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="p-4 border-t border-white/5 bg-black/20">
            <form onSubmit={handleSendMessage} className="relative">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="輸入你的猜測..." className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-5 pr-16 outline-none focus:border-emerald-500/50 text-sm placeholder:text-white/20 font-light" />
              <button className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-600/80 border border-emerald-500/50 rounded-full font-bold text-xs hover:bg-emerald-500 active:scale-95 transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]">發送</button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
