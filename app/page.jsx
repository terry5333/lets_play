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
  // 1. 生命週期與邏輯
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
      const roomRef = ref(database, `rooms/${roomId}`);
      const myPlayerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
      
      onDisconnect(myPlayerRef).remove();

      // 寫入房間時，優先使用 user.photoURL
      set(myPlayerRef, {
        uid: user.uid,
        name: user.displayName || '無名氏',
        avatar: user.photoURL || `https://api.dicebear.com/7.x/micah/svg?seed=${user.uid}&backgroundColor=transparent`,
        joinedAt: serverTimestamp()
      });

      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        
        if (!data || !data.players || !data.players[user.uid]) {
          remove(ref(database, `users/${user.uid}/currentRoom`));
          onDisconnect(myPlayerRef).cancel();
          onDisconnect(roomRef).cancel();
          setRoomId('');
          setView('lobby');
          return;
        }

        const playersList = data.players || {};
        if (!data.info?.hostId || !playersList[data.info.hostId]) {
          update(ref(database, `rooms/${roomId}/info`), { hostId: user.uid });
        }
        
        const playerIds = Object.keys(playersList);
        if (playerIds.length === 1 && playerIds[0] === user.uid) {
          onDisconnect(roomRef).remove();
        } else {
          onDisconnect(roomRef).cancel();
        }

        setRoomData(data);
      });

      return () => unsubscribe();
    }
  }, [view, roomId, user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    const isValidUsername = /^[a-zA-Z0-9]+$/.test(username);
    if (!isValidUsername) return alert("帳號只能包含英文和數字！");

    const fakeEmail = `${username.toLowerCase()}@gamebar.local`;

    try {
      if (isRegister) {
        const res = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        const defaultAvatar = `https://api.dicebear.com/7.x/micah/svg?seed=${nickname}&backgroundColor=transparent`;
        await updateProfile(res.user, { displayName: nickname, photoURL: defaultAvatar });
        setUser({ ...res.user, displayName: nickname, photoURL: defaultAvatar }); 
      } else {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
      }
    } catch (err) { 
      if (err.code === 'auth/email-already-in-use') alert("帳號被註冊走囉！");
      else if (err.code === 'auth/invalid-credential') alert("帳號或密碼錯誤！");
      else alert("驗證失敗: " + err.message); 
    }
  };

  const extractAndUpgradeGoogleAvatar = async (currentUser) => {
    const googleData = currentUser.providerData.find(p => p.providerId === 'google.com');
    if (googleData && googleData.photoURL) {
      const hdPhoto = googleData.photoURL.replace('=s96-c', '=s400-c');
      if (currentUser.photoURL !== hdPhoto) {
        await updateProfile(currentUser, { photoURL: hdPhoto });
        return { ...currentUser, photoURL: hdPhoto };
      }
    }
    return currentUser;
  };

  const handleGoogleLogin = async () => {
    try { 
      const res = await signInWithPopup(auth, googleProvider); 
      const upgradedUser = await extractAndUpgradeGoogleAvatar(res.user);
      setUser(upgradedUser);
    } 
    catch (err) { alert("Google 登入失敗: " + err.message); }
  };

  const handleLinkGoogle = async () => {
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      const upgradedUser = await extractAndUpgradeGoogleAvatar(result.user);
      setUser(upgradedUser); 
      alert("✅ 成功綁定 Google 帳號！頭像已自動同步。");
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') alert("這組 Google 已被綁定！");
      else alert("綁定失敗: " + err.message);
    }
  };

  const isGoogleLinked = user?.providerData?.some(p => p.providerId === 'google.com');

  const changeAvatar = async () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/micah/svg?seed=${randomSeed}&backgroundColor=transparent`;
    await updateProfile(user, { photoURL: newAvatar });
    setUser({ ...user, photoURL: newAvatar });
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const updates = {};
    updates[`rooms/${newRoomId}/info`] = { hostId: user.uid, status: 'waiting' };
    updates[`rooms/${newRoomId}/players/${user.uid}`] = { 
      uid: user.uid, 
      name: user.displayName || '無名氏', 
      avatar: user.photoURL || `https://api.dicebear.com/7.x/micah/svg?seed=${user.uid}&backgroundColor=transparent`,
      joinedAt: serverTimestamp() 
    };
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
    if (!roomSnap.exists()) return alert("找不到房間！");
    
    const updates = {};
    updates[`rooms/${joinInput}/players/${user.uid}`] = { 
      uid: user.uid, 
      name: user.displayName || '無名氏', 
      avatar: user.photoURL || `https://api.dicebear.com/7.x/micah/svg?seed=${user.uid}&backgroundColor=transparent`,
      joinedAt: serverTimestamp() 
    };
    updates[`users/${user.uid}/currentRoom`] = joinInput;
    
    update(ref(database), updates).then(() => {
      setRoomId(joinInput);
      setJoinInput('');
      setView('room');
    });
  };

  const handleLeaveRoom = async () => {
    const updates = {};
    if (roomData?.players && Object.keys(roomData.players).length <= 1) {
      updates[`rooms/${roomId}`] = null;
    } else {
      updates[`rooms/${roomId}/players/${user.uid}`] = null;
    }
    updates[`users/${user.uid}/currentRoom`] = null;
    await update(ref(database), updates);
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
      avatar: user.photoURL || '',
      text: chatInput,
      timestamp: Date.now()
    });
    setChatInput('');
  };

  // 💡 補回的關鍵變數！
  const isHost = roomData?.info?.hostId === user?.uid;

  // ==========================================
  // 2. UI 渲染保持極致美學
  // ==========================================

  const AmbientBackground = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#070709]">
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[10s]"></div>
      <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full mix-blend-screen"></div>
      <div className="absolute -bottom-[20%] left-[20%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full mix-blend-screen"></div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Outfit:wght@300;400;500;700;900&display=swap');
        .vibe-font { font-family: 'Outfit', 'Noto Sans TC', sans-serif; }
      `}} />

      <div className="vibe-font min-h-screen text-white relative selection:bg-white/20">
        <AmbientBackground />

        {view === 'loading' && (
          <div className="h-screen flex items-center justify-center relative z-10">
            <div className="animate-pulse font-light text-white/70 tracking-[0.5em] text-sm">SYNCING VIBE...</div>
          </div>
        )}

        {view === 'login' && (
          <div className="h-screen flex items-center justify-center p-6 relative z-10">
            <div className="w-full max-w-md bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.5)] rounded-[3rem] p-10 md:p-14">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-white/[0.05] border border-white/10 rounded-3xl mx-auto mb-6 flex items-center justify-center text-2xl shadow-inner backdrop-blur-md">✨</div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">My Game Bar</h1>
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
        )}

        {view === 'lobby' && (
          <div className="min-h-screen flex flex-col p-6 md:p-12 relative z-10">
            <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-12 px-4">
              <h1 className="font-semibold text-xl tracking-tight">GAME BAR</h1>
              
              <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-2 pr-6 rounded-full shadow-lg">
                <button onClick={changeAvatar} title="點擊更換頭像" className="relative group w-10 h-10 rounded-full bg-white/5 border border-white/10 overflow-hidden hover:border-white/40 transition-all cursor-pointer">
                  <img src={user?.photoURL || `https://api.dicebear.com/7.x/micah/svg?seed=${user?.uid}`} alt="avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">更換</div>
                </button>
                <div className="flex flex-col justify-center">
                  <span className="text-sm font-medium opacity-90 leading-tight">{user?.displayName || '無名氏'}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>
                    <span className="text-[9px] text-white/40 tracking-widest uppercase">Online</span>
                  </div>
                </div>
                
                <div className="h-6 w-px bg-white/10 mx-2"></div>
                
                {!isGoogleLinked && (
                  <button onClick={handleLinkGoogle} className="text-[11px] font-medium text-white/60 hover:text-white transition-colors mr-2">綁定 Google</button>
                )}
                <button onClick={() => signOut(auth)} className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors">登出</button>
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
                  <input type="text" placeholder="輸入 4 位數房號" value={joinInput} onChange={e => setJoinInput(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-6 px-6 outline-none focus:border-white/30 focus:bg-black/40 text-center font-mono text-2xl tracking-[0.3em] placeholder:tracking-normal placeholder:text-sm placeholder:font-sans font-light transition-all" />
                  <button className="w-full py-6 bg-white text-black rounded-[2rem] font-semibold hover:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.15)] text-sm">
                    進入
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {view === 'room' && (
          <div className="min-h-screen p-4 md:p-10 relative z-10">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 h-[85vh]">
              
              {/* 左側：玩家名單 */}
              <div className="flex-1 bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-10 flex flex-col">
                <div className="flex justify-between items-center mb-12">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight mb-1">Room {roomId}</h2>
                    <p className="text-white/30 text-[10px] tracking-widest uppercase font-medium">Lounge Area</p>
                  </div>
                  <button onClick={handleLeaveRoom} className="px-6 py-3 bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] rounded-[2rem] text-xs font-medium transition-all shadow-inner text-rose-200 hover:text-rose-400">
                    離開房間
                  </button>
                </div>

                <div className="grid gap-4 flex-1 overflow-y-auto pr-2">
                  {roomData?.players && Object.values(roomData.players).map(p => (
                    <div key={p.uid} className="flex justify-between items-center p-6 bg-black/20 rounded-[2rem] border border-white/[0.05] backdrop-blur-sm group">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 overflow-hidden shadow-inner flex-shrink-0">
                          <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <span className="text-lg font-medium block">{p.name}</span>
                          {p.uid === roomData?.info?.hostId && <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full mt-1 inline-block">Host</span>}
                        </div>
                      </div>
                      {isHost && p.uid !== user?.uid && (
                        <button onClick={() => handleKickPlayer(p.uid)} className="text-[11px] text-white/30 hover:text-white font-medium transition-colors border border-white/10 px-4 py-2 rounded-full hover:bg-white/5 opacity-0 group-hover:opacity-100">
                          踢除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 右側：聊天室 */}
              <div className="w-full lg:w-[420px] bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-8 flex flex-col">
                <h3 className="text-[11px] font-medium mb-8 text-white/40 tracking-widest uppercase">Live Chat</h3>
                <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 scrollbar-hide">
                  {roomData?.chat && Object.values(roomData.chat).sort((a,b) => a.timestamp - b.timestamp).map((m, i) => {
                    const isMe = m.senderId === user?.uid;
                    return (
                      <div key={i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 mt-1">
                          <img src={m.avatar || `https://api.dicebear.com/7.x/micah/svg?seed=${m.senderId}`} alt="avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                          {!isMe && <span className="text-[10px] text-white/30 ml-2 mb-1.5 font-medium">{m.senderName}</span>}
                          <div className={`px-5 py-3 rounded-[1.5rem] text-[13px] leading-relaxed tracking-wide ${isMe ? 'bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-tr-none' : 'bg-black/20 border border-white/5 text-white/80 rounded-tl-none shadow-inner'}`}>
                            {m.text}
                          </div>
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
        )}
      </div>
    </>
  );
}
