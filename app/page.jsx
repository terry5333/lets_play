'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut,
  updateProfile,
  linkWithPopup // 💡 新增綁定功能
} from 'firebase/auth';
import { ref, onValue, set, update, push, serverTimestamp, onDisconnect, remove, get } from 'firebase/database';
import { auth, database, googleProvider } from '../lib/firebaseConfig';

export default function GamePlatform() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  
  // 表單狀態
  const [username, setUsername] = useState(''); // 💡 改為純帳號
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  
  // 房間狀態
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // ==========================================
  // 1. 生命週期與「單一房間」防護鎖
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

  useEffect(() => {
    if (view === 'room' && roomId && user) {
      const myPlayerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
      onDisconnect(myPlayerRef).remove();

      set(myPlayerRef, {
        uid: user.uid,
        name: user.displayName || '無名氏',
        joinedAt: serverTimestamp()
      });

      const roomRef = ref(database, `rooms/${roomId}`);
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          remove(ref(database, `users/${user.uid}/currentRoom`));
          setRoomId('');
          setView('lobby');
          return;
        }

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
  // 2. 登入與帳號綁定邏輯
  // ==========================================
  const handleAuth = async (e) => {
    e.preventDefault();
    
    // 🛡️ 檢查帳號格式：只允許英數字
    const isValidUsername = /^[a-zA-Z0-9]+$/.test(username);
    if (!isValidUsername) return alert("帳號只能包含英文和數字！");

    // 🪄 魔術：自動加上假網域騙過 Firebase
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

  // 💡 綁定 Google 帳號邏輯
  const handleLinkGoogle = async () => {
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      setUser({ ...result.user }); // 更新畫面狀態
      alert("✅ 成功綁定 Google 帳號！下次可以直接用 Google 登入。");
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') {
        alert("這個 Google 帳號已經被綁定到其他遊戲帳號了！");
      } else {
        alert("綁定失敗: " + err.message);
      }
    }
  };

  // 判斷當前帳號是否已經綁定 Google
  const isGoogleLinked = user?.providerData?.some(p => p.providerId === 'google.com');

  // ==========================================
  // 3. 房間操作邏輯
  // ==========================================
  const handleCreateRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const updates = {};
    updates[`rooms/${newRoomId}/info`] = { hostId: user.uid, status: 'waiting' };
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
    updates[`users/${user.uid}/currentRoom`] = joinInput;
    update(ref(database), updates).then(() => {
      setRoomId(joinInput);
      setJoinInput('');
      setView('room');
    });
  };

  const handleLeaveRoom = () => {
    const updates = {};
    updates[`rooms/${roomId}/players/${user.uid}`] = null;
    updates[`users/${user.uid}/currentRoom`] = null;
    update(ref(database), updates).then(() => {
      setRoomId('');
      setView('lobby');
    });
  };

  const handleKickPlayer = (targetUid) => {
    const updates = {};
    updates[`rooms/${roomId}/players/${targetUid}`] = null;
    updates[`users/${targetUid}/currentRoom`] = null;
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
  // 4. UI 渲染 (極簡純黑美學)
  // ==========================================

  if (view === 'loading') return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white/50 tracking-[0.5em] text-sm">
      系統連線中
    </div>
  );

  // --- 登入頁 ---
  if (view === 'login') return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md bg-[#111111]/80 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-12 shadow-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-center">我的遊戲吧</h1>
        <p className="text-white/40 text-xs tracking-widest uppercase mb-12 text-center">Gaming Lounge</p>

        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && (
            <input type="text" placeholder="玩家暱稱 (顯示用)" value={nickname} onChange={e => setNickname(e.target.value)} required
              className="w-full bg-black/40 border border-white/10 rounded-[3rem] py-5 px-6 outline-none focus:border-white/30 transition-all text-sm" />
          )}
          {/* 💡 改為一般 text input，提示只能輸入英數 */}
          <input type="text" placeholder="登入帳號 (純英數)" value={username} onChange={e => setUsername(e.target.value)} required
            className="w-full bg-black/40 border border-white/10 rounded-[3rem] py-5 px-6 outline-none focus:border-white/30 transition-all text-sm" />
          <input type="password" placeholder="登入密碼" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-black/40 border border-white/10 rounded-[3rem] py-5 px-6 outline-none focus:border-white/30 transition-all text-sm" />
          
          <button className="w-full py-5 bg-white text-black rounded-[3rem] font-bold hover:bg-white/90 transition-all active:scale-95 text-sm mt-4">
            {isRegister ? '註冊帳號' : '登入系統'}
          </button>
        </form>

        <div className="flex items-center my-8 gap-4">
          <div className="flex-1 h-[1px] bg-white/10"></div>
          <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">OR</span>
          <div className="flex-1 h-[1px] bg-white/10"></div>
        </div>

        <button onClick={handleGoogleLogin} className="w-full py-5 bg-white/10 hover:bg-white/20 rounded-[3rem] transition-all flex items-center justify-center gap-3 text-sm font-bold border border-white/5">
          使用 Google 登入
        </button>

        <p className="mt-8 text-center text-xs text-white/40">
          {isRegister ? '已經有帳號？' : '沒有帳號？'}
          <button onClick={() => setIsRegister(!isRegister)} type="button" className="ml-2 text-white font-bold hover:underline">
            {isRegister ? '登入' : '註冊'}
          </button>
        </p>
      </div>
    </div>
  );

  // --- 大廳頁 ---
  if (view === 'lobby') return (
    <div className="min-h-screen bg-black flex flex-col p-6 md:p-12 text-white font-sans">
      <div className="w-full max-w-5xl mx-auto flex justify-between items-center mb-16">
        <h1 className="font-bold text-xl tracking-tight">GAME BAR</h1>
        <div className="flex items-center gap-6">
          <span className="text-sm text-white/50">{user?.displayName || '無名氏'}</span>
          
          {/* 💡 綁定 Google 按鈕 (如果還沒綁定的話) */}
          {!isGoogleLinked && (
            <button onClick={handleLinkGoogle} className="text-xs px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-colors">
              綁定 Google
            </button>
          )}

          <button onClick={() => signOut(auth)} className="text-xs text-white hover:text-white/70 font-bold transition-colors">登出</button>
        </div>
      </div>
      
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <button onClick={handleCreateRoom} className="group bg-[#111111]/80 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-12 text-left hover:bg-white/5 transition-all">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">建立房間</h2>
          <p className="text-white/40 text-sm leading-relaxed">開啟一個全新的專屬遊戲包廂。</p>
        </button>

        <div className="bg-[#111111]/80 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-12 flex flex-col justify-center">
          <h2 className="text-3xl font-bold mb-8 tracking-tight">加入房間</h2>
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <input 
              type="text" placeholder="輸入房號" value={joinInput} onChange={e => setJoinInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-[3rem] py-6 px-6 outline-none focus:border-white/30 text-center font-mono text-xl tracking-[0.2em] placeholder:tracking-normal placeholder:text-sm"
            />
            <button className="w-full py-6 bg-white text-black rounded-[3rem] font-bold hover:bg-white/90 transition-all active:scale-95 text-sm">
              進入
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // --- 房間頁 ---
  const isHost = roomData?.info?.hostId === user?.uid;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        <div className="flex-1 bg-[#111111]/80 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-10">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1">房間 {roomId}</h2>
              <p className="text-white/40 text-xs tracking-widest uppercase">Room Lounge</p>
            </div>
            <button onClick={handleLeaveRoom} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-[3rem] text-xs font-bold transition-all">
              離開房間
            </button>
          </div>

          <div className="grid gap-3">
            {roomData?.players && Object.values(roomData.players).map(p => (
              <div key={p.uid} className="flex justify-between items-center p-6 bg-black/40 rounded-[2.5rem] border border-white/5">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-base font-bold block">{p.name}</span>
                    {p.uid === roomData?.info?.hostId && <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">房長</span>}
                  </div>
                </div>
                {isHost && p.uid !== user?.uid && (
                  <button onClick={() => handleKickPlayer(p.uid)} className="text-xs text-white/40 hover:text-white font-bold transition-colors">
                    踢除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-[400px] bg-[#111111]/80 border border-white/10 backdrop-blur-3xl rounded-[3rem] p-8 flex flex-col h-[700px]">
          <h3 className="text-sm font-bold mb-8 text-white/40 tracking-widest uppercase">對話紀錄</h3>
          <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 scrollbar-hide">
            {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
              const isMe = m.senderId === user?.uid;
              return (
                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <span className="text-[10px] text-white/30 ml-4 mb-1">{m.senderName}</span>}
                  <div className={`px-5 py-3 rounded-[2rem] text-sm ${isMe ? 'bg-white text-black' : 'bg-black/40 border border-white/5'}`}>
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-[3rem] py-5 pl-6 pr-20 outline-none focus:border-white/30 placeholder:text-white/20 text-sm"
              placeholder="輸入訊息..."
            />
            <button className="absolute right-2 top-2 bottom-2 px-5 bg-white text-black rounded-[2.5rem] font-bold text-xs hover:bg-white/90 transition-all">
              傳送
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
