'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut,
  updateProfile,
  linkWithPopup
} from 'firebase/auth';
import { ref, onValue, set, update, push, serverTimestamp, onDisconnect, remove, get } from 'firebase/database';
import { auth, database, googleProvider } from '../lib/firebaseConfig';

export default function GamePlatform() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // ==========================================
  // 1. 生命週期與單一房間鎖定
  // ==========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const snap = await get(ref(database, `users/${currentUser.uid}/currentRoom`));
        const activeRoom = snap.val();
        
        if (activeRoom) {
          setRoomId(activeRoom);
          setView('room');
        } else {
          setView('lobby');
        }
      } else {
        setUser(null);
        setView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  // 房間內即時監聽與「自動銷毀/踢除」機制
  useEffect(() => {
    if (view === 'room' && roomId && user) {
      const roomRef = ref(database, `rooms/${roomId}`);
      const myPlayerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
      
      // 基本保險：斷線時至少先移除自己的玩家身分
      onDisconnect(myPlayerRef).remove();

      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        
        // 🛡️ 防護 1: 房間不見了，或者「我被踢出了 (不在名單內)」
        if (!data || !data.players || !data.players[user.uid]) {
          remove(ref(database, `users/${user.uid}/currentRoom`)); // 解除玩家的房間鎖定
          onDisconnect(myPlayerRef).cancel(); // 取消斷線任務
          onDisconnect(roomRef).cancel();     // 取消炸房任務
          setRoomId('');
          setView('lobby'); // 🚀 秒回大廳
          return;
        }

        const playersList = data.players || {};
        
        // 👑 防護 2: 房長繼承 (原本房長離開了，由下一個接手)
        if (!data.info?.hostId || !playersList[data.info.hostId]) {
          update(ref(database, `rooms/${roomId}/info`), { hostId: user.uid });
        }
        
        // 💣 防護 3: 孤狼炸房機制 (只剩我一人時，我斷線就直接銷毀房間)
        const playerIds = Object.keys(playersList);
        if (playerIds.length === 1 && playerIds[0] === user.uid) {
          onDisconnect(roomRef).remove(); // 註冊：我斷線就刪除整個房間
        } else {
          onDisconnect(roomRef).cancel(); // 有其他人：取消炸房
        }

        setRoomData(data);
      });

      return () => unsubscribe();
    }
  }, [view, roomId, user]);

  // ==========================================
  // 2. 登入與基礎邏輯
  // ==========================================
  const handleAuth = async (e) => {
    e.preventDefault();
    const isValidUsername = /^[a-zA-Z0-9]+$/.test(username);
    if (!isValidUsername) return alert("帳號只能包含英文和數字！");

    const fakeEmail = `${username.toLowerCase()}@gamebar.local`;

    try {
      if (isRegister) {
        const res = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        await updateProfile(res.user, { displayName: nickname });
        setUser({ ...res.user, displayName: nickname }); 
      } else {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
      }
    } catch (err) { 
      if (err.code === 'auth/email-already-in-use') alert("這個帳號已經被別人註冊走囉！");
      else if (err.code === 'auth/invalid-credential') alert("帳號或密碼錯誤！");
      else alert("驗證失敗: " + err.message); 
    }
  };

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (err) { alert("Google 登入失敗: " + err.message); }
  };

  const handleLinkGoogle = async () => {
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      setUser({ ...result.user }); 
      alert("✅ 成功綁定 Google 帳號！");
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') alert("這個 Google 帳號已經被綁定到其他遊戲帳號了！");
      else alert("綁定失敗: " + err.message);
    }
  };

  const isGoogleLinked = user?.providerData?.some(p => p.providerId === 'google.com');

  // ==========================================
  // 3. 房間操作邏輯 (含資料庫預寫入，防 Bug)
  // ==========================================
  const handleCreateRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const updates = {};
    // 預先寫入資料，避免切換畫面時出現時間差 Bug
    updates[`rooms/${newRoomId}/info`] = { hostId: user.uid, status: 'waiting' };
    updates[`rooms/${newRoomId}/players/${user.uid}`] = { uid: user.uid, name: user.displayName || '無名氏', joinedAt: serverTimestamp() };
    updates[`users/${user.uid}/currentRoom`] = newRoomId;
    
    update(ref(database), updates).then(() => {
      setRoomId(newRoomId);
      setView('room');
    });
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinInput.trim()) return;
    const roomSnap = await get(ref(database, `rooms/${joinInput}`));
    if (!roomSnap.exists()) return alert("找不到這個房間！");
    
    const updates = {};
    updates[`rooms/${joinInput}/players/${user.uid}`] = { uid: user.uid, name: user.displayName || '無名氏', joinedAt: serverTimestamp() };
    updates[`users/${user.uid}/currentRoom`] = joinInput;
    
    update(ref(database), updates).then(() => {
      setRoomId(joinInput);
      setJoinInput('');
      setView('room');
    });
  };

  const handleLeaveRoom = async () => {
    const updates = {};
    // 💣 自動銷毀：如果我是房間裡最後一個人，我按離開就連房間一起刪掉
    if (roomData?.players && Object.keys(roomData.players).length <= 1) {
      updates[`rooms/${roomId}`] = null;
    } else {
      updates[`rooms/${roomId}/players/${user.uid}`] = null;
    }
    updates[`users/${user.uid}/currentRoom`] = null; // 解除自己的鎖定
    
    await update(ref(database), updates);
    // UI 會因為 onValue 監聽到變化而自動回大廳
  };

  const handleKickPlayer = (targetUid) => {
    const updates = {};
    updates[`rooms/${roomId}/players/${targetUid}`] = null; // 從房間移除
    updates[`users/${targetUid}/currentRoom`] = null;       // 強制解除對方的鎖定
    update(ref(database), updates);
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

  // ==========================================
  // 4. 完美 UI (Ultra Glassmorphism) 保持不變
  // ==========================================

  const AmbientBackground = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#070709]">
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[10s]"></div>
      <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full mix-blend-screen"></div>
      <div className="absolute -bottom-[20%] left-[20%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full mix-blend-screen"></div>
    </div>
  );

  if (view === 'loading') return (
    <div className="min-h-screen flex items-center justify-center text-white/50 tracking-[0.5em] text-sm relative">
      <AmbientBackground />
      <div className="relative z-10 animate-pulse font-light text-white/70">SYNCING VIBE...</div>
    </div>
  );

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white font-sans relative selection:bg-white/20">
      <AmbientBackground />
      
      <div className="w-full max-w-md bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.5)] rounded-[3rem] p-10 md:p-14 relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white/[0.05] border border-white/10 rounded-3xl mx-auto mb-6 flex items-center justify-center text-2xl shadow-inner backdrop-blur-md">✨</div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">My Game Bar</h1>
          <p className="text-white/40 text-[10px] tracking-[0.3em] uppercase">Premium Lounge</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && (
            <input type="text" placeholder="顯示暱稱" value={nickname} onChange={e => setNickname(e.target.value)} required
              className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-5 px-6 outline-none focus:border-white/30 focus:bg-black/40 transition-all text-sm font-light placeholder:text-white/30" />
          )}
          <input type="text" placeholder="登入帳號 (純英數)" value={username} onChange={e => setUsername(e.target.value)} required
            className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-5 px-6 outline-none focus:border-white/30 focus:bg-black/40 transition-all text-sm font-light placeholder:text-white/30" />
          <input type="password" placeholder="登入密碼" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-5 px-6 outline-none focus:border-white/30 focus:bg-black/40 transition-all text-sm font-light placeholder:text-white/30" />
          
          <button className="w-full py-5 bg-white text-black rounded-[2rem] font-semibold hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.15)] text-sm mt-6">
            {isRegister ? '註冊通行證' : '登入系統'}
          </button>
        </form>

        <div className="flex items-center my-8 gap-4 opacity-50">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-white/20"></div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-medium">OR</span>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-white/20"></div>
        </div>

        <button onClick={handleGoogleLogin} className="w-full py-5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-[2rem] transition-all flex items-center justify-center gap-3 text-sm font-medium shadow-inner">
          <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Google 快速登入
        </button>

        <p className="mt-8 text-center text-[11px] text-white/40 font-light">
          {isRegister ? '已有通行證？' : '首次抵達？'}
          <button onClick={() => setIsRegister(!isRegister)} type="button" className="ml-2 text-white font-medium hover:text-white/70 transition-colors">
            {isRegister ? '切換登入' : '申請註冊'}
          </button>
        </p>
      </div>
    </div>
  );

  if (view === 'lobby') return (
    <div className="min-h-screen flex flex-col p-6 md:p-12 text-white font-sans relative">
      <AmbientBackground />
      
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-12 relative z-10 px-4">
        <h1 className="font-semibold text-xl tracking-tight">GAME BAR</h1>
        <div className="flex items-center gap-4 bg-white/[0.03] backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full shadow-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>
          <span className="text-sm font-medium opacity-90 pr-4 border-r border-white/10">{user?.displayName || '無名氏'}</span>
          
          {!isGoogleLinked && (
            <button onClick={handleLinkGoogle} className="text-xs font-medium text-white/60 hover:text-white transition-colors pl-2">
              綁定 Google
            </button>
          )}
          <button onClick={() => signOut(auth)} className="text-xs font-medium text-white/60 hover:text-white transition-colors pl-4">登出</button>
        </div>
      </div>
      
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        <button onClick={handleCreateRoom} className="group bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 text-left hover:bg-white/[0.04] transition-all duration-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors"></div>
          <h2 className="text-4xl font-semibold mb-4 tracking-tight relative z-10">開創包廂</h2>
          <p className="text-white/40 text-sm leading-relaxed font-light relative z-10 max-w-sm">建立一個全新的專屬私密空間，邀請朋友一同加入連線。</p>
        </button>

        <div className="bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-12 flex flex-col justify-center relative">
          <h2 className="text-4xl font-semibold mb-8 tracking-tight">加入連線</h2>
          <form onSubmit={handleJoinRoom} className="space-y-4 relative z-10">
            <input 
              type="text" placeholder="輸入 4 位數房號" value={joinInput} onChange={e => setJoinInput(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-6 px-6 outline-none focus:border-white/30 focus:bg-black/40 text-center font-mono text-2xl tracking-[0.3em] placeholder:tracking-normal placeholder:text-sm placeholder:font-sans font-light transition-all"
            />
            <button className="w-full py-6 bg-white text-black rounded-[2rem] font-semibold hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.15)] text-sm">
              進入
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const isHost = roomData?.info?.hostId === user?.uid;

  return (
    <div className="min-h-screen text-white p-4 md:p-10 font-sans relative">
      <AmbientBackground />

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 relative z-10 h-full">
        
        {/* 左側：玩家名單 (精緻卡片) */}
        <div className="flex-1 bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-10 flex flex-col">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight mb-1">Room {roomId}</h2>
              <p className="text-white/30 text-[10px] tracking-widest uppercase font-medium">Lounge Area</p>
            </div>
            <button onClick={handleLeaveRoom} className="px-6 py-3 bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] rounded-[2rem] text-xs font-medium transition-all shadow-inner">
              離開房間
            </button>
          </div>

          <div className="grid gap-4 flex-1 overflow-y-auto pr-2">
            {roomData?.players && Object.values(roomData.players).map(p => (
              <div key={p.uid} className="flex justify-between items-center p-6 bg-black/20 rounded-[2rem] border border-white/[0.05] backdrop-blur-sm">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                    <span className="text-white/50 text-sm font-medium">{p.name?.[0]}</span>
                  </div>
                  <div>
                    <span className="text-base font-medium block">{p.name}</span>
                    {p.uid === roomData?.info?.hostId && <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Host</span>}
                  </div>
                </div>
                {isHost && p.uid !== user?.uid && (
                  <button onClick={() => handleKickPlayer(p.uid)} className="text-[11px] text-white/30 hover:text-white font-medium transition-colors border border-white/10 px-4 py-2 rounded-full hover:bg-white/5">
                    踢除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 右側：聊天室 (極簡泡泡) */}
        <div className="w-full lg:w-[420px] bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-8 flex flex-col h-[750px]">
          <h3 className="text-[11px] font-medium mb-8 text-white/40 tracking-widest uppercase">Live Chat</h3>
          <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 scrollbar-hide">
            {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
              const isMe = m.senderId === user?.uid;
              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-[10px] text-white/30 ml-4 mb-1.5 font-medium">{m.senderName}</span>}
                  <div className={`px-6 py-4 rounded-[2rem] text-[13px] leading-relaxed tracking-wide ${isMe ? 'bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-tr-none' : 'bg-black/20 border border-white/5 text-white/80 rounded-tl-none shadow-inner'}`}>
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSendMessage} className="relative mt-auto">
            <input 
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-5 pl-6 pr-20 outline-none focus:border-white/30 focus:bg-black/30 placeholder:text-white/20 text-sm font-light transition-all shadow-inner"
              placeholder="輸入訊息..."
            />
            <button className="absolute right-2 top-2 bottom-2 px-5 bg-white text-black rounded-[1.5rem] font-medium text-[11px] hover:scale-95 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
