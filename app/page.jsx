'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import { ref, onValue, set, update, push, serverTimestamp, onDisconnect, remove } from 'firebase/database';
// 💡 注意：我們把 TicTacToe 拿掉了，專心處理系統邏輯，保證不報錯！
import { auth, database, googleProvider } from '../lib/firebaseConfig';

export default function GamePlatform() {
  // --- 系統狀態 ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); // loading, login, lobby, room
  
  // --- 登入表單狀態 ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  
  // --- 房間狀態 ---
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // ==========================================
  // 1. 核心生命週期與權限監聽
  // ==========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // 如果是在載入或登入畫面，自動導向大廳
        if (view === 'loading' || view === 'login') setView('lobby');
      } else {
        setUser(null);
        setView('login');
      }
    });
    return () => unsubscribe();
  }, [view]);

  // 進入房間後的資料庫監聽與離線踢除
  useEffect(() => {
    if (view === 'room' && roomId && user) {
      const myPlayerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
      
      // 🛡️ 離線清理：關閉網頁自動退出房間
      onDisconnect(myPlayerRef).remove();

      // 寫入玩家資料
      set(myPlayerRef, {
        uid: user.uid,
        name: user.displayName || '匿名玩家',
        isReady: false,
        joinedAt: serverTimestamp()
      });

      const roomRef = ref(database, `rooms/${roomId}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setView('lobby'); // 房間被解散或不存在，退回大廳
          return;
        }

        // 👑 房長繼承邏輯：沒房長，或房長不在名單內，我就是房長
        const playersList = data.players || {};
        if (!data.info?.hostId || !playersList[data.info.hostId]) {
          update(ref(database, `rooms/${roomId}/info`), { hostId: user.uid });
        }
        
        setRoomData(data);
      });

      return () => unsubscribe();
    }
  }, [view, roomId, user]);

  // ==========================================
  // 2. 互動邏輯 (Actions)
  // ==========================================
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: nickname });
        // 強制觸發狀態更新以獲取新暱稱
        setUser({ ...res.user, displayName: nickname }); 
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) { alert("登入失敗: " + err.message); }
  };

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (err) { alert("Google 登入失敗: " + err.message); }
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    set(ref(database, `rooms/${newRoomId}/info`), {
      hostId: user.uid,
      status: 'waiting',
      createdAt: serverTimestamp()
    }).then(() => {
      setRoomId(newRoomId);
      setView('room');
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    setView('room');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    push(ref(database, `rooms/${roomId}/chat`), {
      senderId: user.uid,
      senderName: user.displayName || '玩家',
      text: chatInput,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  // 踢人功能
  const handleKickPlayer = (targetUid) => {
    remove(ref(database, `rooms/${roomId}/players/${targetUid}`));
  };

  // 離開房間
  const handleLeaveRoom = () => {
    remove(ref(database, `rooms/${roomId}/players/${user.uid}`));
    setView('lobby');
  };

  // ==========================================
  // 3. UI 渲染區塊
  // ==========================================

  if (view === 'loading') return (
    <div className="min-h-screen bg-[#05050a] flex items-center justify-center text-indigo-400 tracking-[0.5em] animate-pulse">
      系統載入中...
    </div>
  );

  // 🔴 畫面 A：登入介面 (極簡深色玻璃)
  if (view === 'login') return (
    <div className="min-h-screen bg-[#05050a] bg-[radial-gradient(circle_at_top_right,_#1e1b4b,_#05050a)] flex items-center justify-center p-6 text-white overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      
      <div className="w-full max-w-md bg-white/[0.02] border border-white/10 backdrop-blur-3xl rounded-[3.5rem] p-10 md:p-14 shadow-2xl relative z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl mx-auto mb-6 flex items-center justify-center text-3xl shadow-lg">🎮</div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-1">我的遊戲吧</h1>
          <p className="text-white/20 text-[10px] tracking-[0.4em] uppercase font-bold">登入系統核心</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && (
            <input type="text" placeholder="你的專屬暱稱" value={nickname} onChange={e => setNickname(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-4 px-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium" />
          )}
          <input type="email" placeholder="電子郵件" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-4 px-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium" />
          <input type="password" placeholder="密碼" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-4 px-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium" />
          <button className="w-full py-5 bg-white text-black rounded-[2.5rem] font-black hover:bg-indigo-50 transition-all active:scale-95 shadow-xl text-sm uppercase tracking-widest mt-4">
            {isRegister ? '建立帳號' : '進入大廳'}
          </button>
        </form>

        <div className="flex items-center my-8 gap-4">
          <div className="flex-1 h-[1px] bg-white/10"></div>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">快速入口</span>
          <div className="flex-1 h-[1px] bg-white/10"></div>
        </div>

        <button onClick={handleGoogleLogin} className="w-full py-4 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 transition-all flex items-center justify-center gap-3 text-sm font-bold">
          使用 Google 帳號登入
        </button>

        <p className="mt-8 text-center text-xs text-white/30 font-medium">
          {isRegister ? '已經有帳號了？' : '還沒有帳號嗎？'}
          <button onClick={() => setIsRegister(!isRegister)} type="button" className="ml-2 text-indigo-400 font-bold hover:text-indigo-300">
            {isRegister ? '點此登入' : '立即註冊'}
          </button>
        </p>
      </div>
    </div>
  );

  // 🟢 畫面 B：大廳介面
  if (view === 'lobby') return (
    <div className="min-h-screen bg-[#05050a] flex flex-col p-6 md:p-12 text-white">
      {/* 頂部導航欄 */}
      <div className="w-full max-w-5xl mx-auto flex justify-between items-center mb-12 bg-white/[0.02] border border-white/10 rounded-full px-8 py-4 backdrop-blur-md">
        <h1 className="font-black italic text-xl">GAME BAR</h1>
        <div className="flex items-center gap-6">
          <span className="text-sm text-white/60 font-bold">
            玩家：<span className="text-indigo-400">{user?.displayName || '未設定名稱'}</span>
          </span>
          <button onClick={() => signOut(auth)} className="text-xs text-rose-400 hover:text-rose-300 font-bold tracking-widest uppercase">登出</button>
        </div>
      </div>
      
      {/* 操作區 */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <button onClick={handleCreateRoom} className="group bg-white/[0.02] border border-white/10 backdrop-blur-3xl rounded-[3.5rem] p-12 text-left hover:bg-indigo-600/10 transition-all hover:border-indigo-500/30 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-[2rem] flex items-center justify-center text-4xl mb-8 group-hover:scale-110 transition-transform">🚀</div>
          <h2 className="text-3xl font-black mb-3 tracking-tighter">創建房間</h2>
          <p className="text-white/40 text-sm leading-relaxed">開啟一個專屬包廂，系統會生成 4 位數代碼，將代碼分享給好友即可連線。</p>
        </button>

        <div className="bg-white/[0.02] border border-white/10 backdrop-blur-3xl rounded-[3.5rem] p-12 flex flex-col justify-center shadow-2xl">
          <h2 className="text-3xl font-black mb-8 text-center tracking-tighter">加入連線</h2>
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <input 
              type="text" placeholder="輸入 4 位數房號" value={roomId} onChange={e => setRoomId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-6 px-6 outline-none focus:border-indigo-500/50 text-center font-mono text-3xl tracking-[0.5em] placeholder:tracking-normal placeholder:text-lg"
            />
            <button className="w-full py-6 bg-white text-black rounded-[2.5rem] font-black hover:bg-indigo-50 transition-all active:scale-95 text-lg shadow-xl">
              進入房間
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // 🔵 畫面 C：房間內部 (管理員與聊天系統)
  const isHost = roomData?.info?.hostId === user?.uid;

  return (
    <div className="min-h-screen bg-[#05050a] text-white p-4 md:p-10">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* 左側：玩家名單與管理 */}
        <div className="flex-1 bg-white/[0.02] border border-white/10 backdrop-blur-3xl rounded-[3.5rem] p-10 shadow-2xl">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-4xl font-black tracking-tighter italic mb-2">專屬包廂</h2>
              <p className="text-indigo-400 font-mono tracking-[0.3em] font-bold">ID: {roomId}</p>
            </div>
            <button onClick={handleLeaveRoom} className="px-6 py-3 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full text-xs font-bold border border-white/10 transition-all">
              離開房間
            </button>
          </div>

          <div className="grid gap-4">
            {roomData?.players && Object.values(roomData.players).map(p => (
              <div key={p.uid} className="flex justify-between items-center p-6 bg-white/[0.03] rounded-[2.5rem] border border-white/5 hover:bg-white/[0.06] transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center text-2xl border border-indigo-500/20">👤</div>
                  <div>
                    <span className="text-xl font-bold block mb-1">{p.name}</span>
                    {p.uid === roomData?.info?.hostId && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-black uppercase tracking-widest">房長</span>}
                  </div>
                </div>
                {/* 管理員踢人按鈕 */}
                {isHost && p.uid !== user?.uid && (
                  <button onClick={() => handleKickPlayer(p.uid)} className="px-5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-full text-[10px] font-black border border-rose-500/20 uppercase tracking-widest transition-all">
                    踢除
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 未來放遊戲按鈕的地方 */}
          {isHost && (
            <div className="mt-10 p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] text-center">
              <p className="text-indigo-300 font-bold text-sm">遊戲系統建置中...敬請期待</p>
            </div>
          )}
        </div>

        {/* 右側：聊天室 */}
        <div className="w-full lg:w-[400px] bg-white/[0.02] border border-white/10 backdrop-blur-3xl rounded-[3.5rem] p-8 flex flex-col h-[700px] shadow-2xl">
          <h3 className="text-xl font-black mb-8 text-white/50 tracking-widest uppercase">房間對話</h3>
          <div className="flex-1 overflow-y-auto space-y-5 mb-6 pr-2 scrollbar-hide">
            {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
              const isMe = m.senderId === user?.uid;
              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-[10px] text-white/30 ml-3 mb-1 font-bold">{m.senderName}</span>}
                  <div className={`px-5 py-3 rounded-[1.8rem] text-sm leading-relaxed max-w-[85%] ${isMe ? 'bg-indigo-600 rounded-tr-none' : 'bg-white/5 rounded-tl-none border border-white/5'}`}>
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-5 pl-6 pr-16 outline-none focus:border-indigo-500/50 placeholder:text-white/20"
              placeholder="說點什麼..."
            />
            <button className="absolute right-3 top-2.5 bottom-2.5 px-5 bg-white text-black rounded-2xl font-black text-xs transition-all hover:bg-indigo-50 active:scale-95">
              傳送
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
