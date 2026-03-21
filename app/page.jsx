'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signInWithPopup, onAuthStateChanged, signOut, updateProfile, linkWithPopup
} from 'firebase/auth';
import { ref, onValue, set, update, push, serverTimestamp, onDisconnect, remove, get, query, orderByChild, limitToLast, increment } from 'firebase/database';
import { auth, database, googleProvider } from '../lib/firebaseConfig';

import Lobby from '../components/Lobby';
import WaitingRoom from '../components/WaitingRoom';
import BoomCat from '../components/BoomCat';

export default function GamePlatform() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('loading'); 
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myScore, setMyScore] = useState(0); 

  useEffect(() => {
    let userScoreUnsub; 
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        let activeAvatar = currentUser.photoURL;
        const googleData = currentUser.providerData.find(p => p.providerId === 'google.com');
        if (googleData && googleData.photoURL) {
          activeAvatar = googleData.photoURL.replace('=s96-c', '=s400-c'); 
          if (currentUser.photoURL !== activeAvatar) await updateProfile(currentUser, { photoURL: activeAvatar });
        }
        if (!activeAvatar) activeAvatar = `https://api.dicebear.com/7.x/micah/svg?seed=${currentUser.uid}&backgroundColor=transparent`;

        setUser({ ...currentUser, photoURL: activeAvatar });
        
        const userRef = ref(database, `users/${currentUser.uid}`);
        const userSnap = await get(userRef);
        const userData = userSnap.val() || {};
        
        const updates = { name: currentUser.displayName || '無名氏', avatar: activeAvatar };
        if (userData.score === undefined) updates.score = 0;
        await update(userRef, updates);

        userScoreUnsub = onValue(userRef, (snap) => {
          if (snap.exists()) setMyScore(snap.val().score || 0);
        });

        const activeRoom = userData.currentRoom;
        if (activeRoom) {
          setRoomId(activeRoom);
          setView('room');
        } else {
          setView('lobby');
        }
      } else {
        setUser(null);
        setView('login');
        if (userScoreUnsub) userScoreUnsub();
      }
    });
    return () => { unsubscribe(); if (userScoreUnsub) userScoreUnsub(); };
  }, []);

  useEffect(() => {
    if (view === 'lobby') {
      const topUsersQuery = query(ref(database, 'users'), orderByChild('score'), limitToLast(10));
      const unsub = onValue(topUsersQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const sortedList = Object.values(data).filter(u => u.score !== undefined).sort((a, b) => b.score - a.score);
          setLeaderboard(sortedList);
        }
      });
      return () => unsub();
    }
  }, [view]);

  useEffect(() => {
    if (view === 'room' && roomId && user) {
      const roomRef = ref(database, `rooms/${roomId}`);
      const myPlayerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
      
      onDisconnect(myPlayerRef).remove();
      set(myPlayerRef, { uid: user.uid, name: user.displayName, avatar: user.photoURL, joinedAt: serverTimestamp() });

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
        
        // 🔥 神級修復：使用精準路徑更新 hostId，絕對不覆蓋 status！
        if (!data.info?.hostId || !playersList[data.info.hostId]) {
          update(ref(database), { [`rooms/${roomId}/info/hostId`]: user.uid });
        }
        
        const playerIds = Object.keys(playersList);
        if (playerIds.length === 1 && playerIds[0] === user.uid) onDisconnect(roomRef).remove();
        else onDisconnect(roomRef).cancel();

        setRoomData(data);
      });
      return () => unsubscribe();
    }
  }, [view, roomId, user]);

  const handleAuth = async (e) => {
    e.preventDefault();
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
    } catch (err) { alert("驗證失敗"); }
  };

  const handleGoogleLogin = async () => {
    try { 
      const res = await signInWithPopup(auth, googleProvider); 
      let hdPhoto = res.user.providerData.find(p => p.providerId === 'google.com')?.photoURL;
      if (hdPhoto) hdPhoto = hdPhoto.replace('=s96-c', '=s400-c');
      if (hdPhoto && res.user.photoURL !== hdPhoto) await updateProfile(res.user, { photoURL: hdPhoto });
      setUser({ ...res.user, photoURL: hdPhoto || res.user.photoURL });
    } catch (err) { alert("Google 登入失敗"); }
  };

  const handleLinkGoogle = async () => {
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      setUser({ ...result.user }); 
      alert("✅ 成功綁定 Google 帳號！");
    } catch (err) { alert("綁定失敗"); }
  };

  const changeAvatar = async () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/micah/svg?seed=${randomSeed}&backgroundColor=transparent`;
    await updateProfile(user, { photoURL: newAvatar });
    setUser({ ...user, photoURL: newAvatar });
    update(ref(database, `users/${user.uid}`), { avatar: newAvatar });
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const updates = {};
    updates[`rooms/${newRoomId}/info`] = { hostId: user.uid, status: 'waiting' };
    updates[`rooms/${newRoomId}/players/${user.uid}`] = { uid: user.uid, name: user.displayName, avatar: user.photoURL, joinedAt: serverTimestamp() };
    updates[`users/${user.uid}/currentRoom`] = newRoomId;
    update(ref(database), updates).then(() => { setRoomId(newRoomId); setView('room'); });
  };

  const handleJoinRoom = async (joinInput) => {
    const roomSnap = await get(ref(database, `rooms/${joinInput}`));
    if (!roomSnap.exists()) return alert("找不到房間！");
    const updates = {};
    updates[`rooms/${joinInput}/players/${user.uid}`] = { uid: user.uid, name: user.displayName, avatar: user.photoURL, joinedAt: serverTimestamp() };
    updates[`users/${user.uid}/currentRoom`] = joinInput;
    update(ref(database), updates).then(() => { setRoomId(joinInput); setView('room'); });
  };

  const handleLeaveRoom = async () => {
    const updates = {};
    if (roomData?.players && Object.keys(roomData.players).length <= 1) updates[`rooms/${roomId}`] = null;
    else updates[`rooms/${roomId}/players/${user.uid}`] = null;
    updates[`users/${user.uid}/currentRoom`] = null;
    await update(ref(database), updates);
  };

  const handleWinGameDemo = () => update(ref(database, `users/${user.uid}`), { score: increment(50) });

  const AmbientBackground = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#070709]">
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[10s]"></div>
      <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full mix-blend-screen"></div>
      <div className="absolute -bottom-[20%] left-[20%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full mix-blend-screen"></div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&family=Outfit:wght@300;400;500;700;900&display=swap'); .vibe-font { font-family: 'Outfit', 'Noto Sans TC', sans-serif; }`}} />
      <div className="vibe-font min-h-screen relative selection:bg-white/20">
        
        {['loading', 'login', 'lobby'].includes(view) && <AmbientBackground />}

        {view === 'loading' && (
          <div className="h-screen flex items-center justify-center relative z-10">
            <div className="animate-pulse font-light text-white/70 tracking-[0.5em] text-sm">SYNCING VIBE...</div>
          </div>
        )}

        {view === 'login' && (
          <div className="h-screen flex items-center justify-center p-6 relative z-10 text-white">
            <div className="w-full max-w-md bg-white/[0.02] backdrop-blur-[40px] border border-white/[0.08] shadow-2xl rounded-[3rem] p-10 md:p-14">
              <div className="text-center mb-10"><h1 className="text-3xl font-bold tracking-tight mb-2">My Game Bar</h1></div>
              <form onSubmit={handleAuth} className="space-y-4">
                {isRegister && <input type="text" placeholder="顯示暱稱" value={nickname} onChange={e => setNickname(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-5 px-6 outline-none focus:border-white/30 text-sm font-light" />}
                <input type="text" placeholder="登入帳號 (純英數)" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-5 px-6 outline-none focus:border-white/30 text-sm font-light" />
                <input type="password" placeholder="登入密碼" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-[2rem] py-5 px-6 outline-none focus:border-white/30 text-sm font-light" />
                <button className="w-full py-5 bg-white text-black rounded-[2rem] font-semibold hover:scale-[0.98] transition-transform text-sm mt-6">{isRegister ? '註冊通行證' : '登入系統'}</button>
              </form>
              <div className="flex items-center my-6 gap-4 opacity-50"><div className="flex-1 h-[1px] bg-white/20"></div><span className="text-[10px] uppercase">OR</span><div className="flex-1 h-[1px] bg-white/20"></div></div>
              <button onClick={handleGoogleLogin} className="w-full py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-[2rem] transition-all text-sm font-medium">Google 快速登入</button>
              <p className="mt-6 text-center text-[11px] text-white/40"><button onClick={() => setIsRegister(!isRegister)} type="button" className="text-white hover:text-white/70">{isRegister ? '切換登入' : '申請註冊'}</button></p>
            </div>
          </div>
        )}

        {view === 'lobby' && (
          <Lobby 
            user={user} myScore={myScore} leaderboard={leaderboard} 
            isGoogleLinked={user?.providerData?.some(p => p.providerId === 'google.com')}
            handleLinkGoogle={handleLinkGoogle} changeAvatar={changeAvatar} 
            handleWinGameDemo={handleWinGameDemo} handleCreateRoom={handleCreateRoom} 
            handleJoinRoom={handleJoinRoom} 
          />
        )}

        {view === 'room' && roomData?.info?.status === 'waiting' && (
          <WaitingRoom 
            user={user} roomId={roomId} roomData={roomData} 
            isHost={roomData?.info?.hostId === user?.uid} 
            handleLeaveRoom={handleLeaveRoom} 
          />
        )}

        {view === 'room' && roomData?.info?.status === 'playing' && (
          <BoomCat 
            user={user} roomId={roomId} roomData={roomData} 
            handleLeaveRoom={handleLeaveRoom} 
          />
        )}

      </div>
    </>
  );
}
