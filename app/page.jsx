'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signInWithPopup, onAuthStateChanged, signOut, updateProfile
} from 'firebase/auth';
import { ref, onValue, set, update, push, serverTimestamp, onDisconnect, remove, get, query, orderByChild, limitToLast } from 'firebase/database';
import { auth, database, googleProvider } from '../lib/firebaseConfig';

// 子元件
import Lobby from '../components/Lobby';
import WaitingRoom from '../components/WaitingRoom';
import BoomCat from '../components/BoomCat';
import DrawGuess from '../components/DrawGuess';
import Bingo from '../components/Bingo';
import EvilFills from '../components/EvilFills';

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

  // 🎇 環繞背景元件
  const AmbientBackground = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#070709]">
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[10s]"></div>
      <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full mix-blend-screen"></div>
      <div className="absolute -bottom-[20%] left-[20%] w-[40%] h-[40%] bg-purple-600/10 blur-[100px] rounded-full mix-blend-screen"></div>
    </div>
  );

  useEffect(() => {
    let userScoreUnsub; 
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const activeAvatar = currentUser.photoURL || `https://api.dicebear.com/7.x/micah/svg?seed=${currentUser.uid}`;
        setUser({ ...currentUser, photoURL: activeAvatar });
        
        const userRef = ref(database, `users/${currentUser.uid}`);
        const userSnap = await get(userRef);
        const userData = userSnap.val() || {};
        
        await update(userRef, { 
          name: currentUser.displayName || '無名氏', 
          avatar: activeAvatar, 
          score: userData.score ?? 0 
        });

        userScoreUnsub = onValue(userRef, (snap) => {
          if (snap.exists()) setMyScore(snap.val().score || 0);
        });

        if (userData.currentRoom) {
          setRoomId(userData.currentRoom);
          setView('room');
        } else {
          setView('lobby');
        }
      } else {
        setUser(null);
        setView('login');
      }
    });
    return () => { unsubscribe(); if (userScoreUnsub) userScoreUnsub(); };
  }, []);

  useEffect(() => {
    if (view === 'lobby') {
      const topUsersQuery = query(ref(database, 'users'), orderByChild('score'), limitToLast(10));
      return onValue(topUsersQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.values(data).sort((a, b) => b.score - a.score);
          setLeaderboard(list);
        }
      });
    }
  }, [view]);

  useEffect(() => {
    if (view === 'room' && roomId && user) {
      const roomRef = ref(database, `rooms/${roomId}`);
      const myPlayerRef = ref(database, `rooms/${roomId}/players/${user.uid}`);
      onDisconnect(myPlayerRef).remove();
      set(myPlayerRef, { uid: user.uid, name: user.displayName, avatar: user.photoURL, joinedAt: serverTimestamp() });
      
      return onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.players?.[user.uid]) {
          update(ref(database, `users/${user.uid}`), { currentRoom: null });
          setRoomId('');
          setView('lobby');
        } else {
          setRoomData(data);
        }
      });
    }
  }, [view, roomId, user]);

  const handleJoinRoom = async (joinInput) => {
    const roomSnap = await get(ref(database, `rooms/${joinInput}`));
    if (!roomSnap.exists()) return alert("找不到此包廂！");
    const data = roomSnap.val();
    const isPlaying = data.info?.status === 'playing';
    const isFull = Object.keys(data.players || {}).length >= (data.info?.rules?.maxPlayers || 99);
    const isReconnecting = !!data.players?.[user.uid];

    if (!isReconnecting && (isPlaying || isFull)) return alert(isPlaying ? "遊戲已開始，無法加入！" : "包廂已滿！");

    const updates = { 
      [`rooms/${joinInput}/players/${user.uid}`]: { uid: user.uid, name: user.displayName, avatar: user.photoURL, joinedAt: serverTimestamp() }, 
      [`users/${user.uid}/currentRoom`]: joinInput 
    };
    update(ref(database), updates).then(() => { setRoomId(joinInput); setView('room'); });
  };

  const handleCreateRoom = (gameMode, rules) => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    const updates = {
      [`rooms/${newRoomId}/info`]: { hostId: user.uid, status: 'waiting', gameMode, rules, createdAt: serverTimestamp() },
      [`rooms/${newRoomId}/players/${user.uid}`]: { uid: user.uid, name: user.displayName, avatar: user.photoURL, joinedAt: serverTimestamp() },
      [`users/${user.uid}/currentRoom`]: newRoomId
    };
    update(ref(database), updates).then(() => { setRoomId(newRoomId); setView('room'); });
  };

  const handleLeaveRoom = async () => {
    const updates = { [`users/${user.uid}/currentRoom`]: null };
    if (roomData && Object.keys(roomData.players || {}).length <= 1) updates[`rooms/${roomId}`] = null;
    else updates[`rooms/${roomId}/players/${user.uid}`] = null;
    await update(ref(database), updates);
  };

  return (
    <div className="vibe-font min-h-screen bg-[#070709] text-white selection:bg-white/20">
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700;900&family=Outfit:wght@300;400;500;700;900&display=swap'); .vibe-font { font-family: 'Outfit', 'Noto Sans TC', sans-serif; }`}} />
      
      {['loading', 'login', 'lobby'].includes(view) && <AmbientBackground />}

      {view === 'loading' && (
        <div className="h-screen flex items-center justify-center relative z-10">
          <div className="animate-pulse font-light text-white/70 tracking-[0.5em] text-sm">SYNCING VIBE...</div>
        </div>
      )}

      {view === 'login' && (
        <div className="h-screen flex items-center justify-center p-6 relative z-10">
          <div className="w-full max-w-md bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 shadow-2xl">
            <h1 className="text-3xl font-black mb-8 text-center tracking-widest italic uppercase">Game Bar</h1>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const email = `${username.toLowerCase()}@gamebar.local`;
              try {
                if (isRegister) {
                  const res = await createUserWithEmailAndPassword(auth, email, password);
                  await updateProfile(res.user, { displayName: nickname });
                } else {
                  await signInWithEmailAndPassword(auth, email, password);
                }
              } catch(err) { alert("驗證失敗"); }
            }} className="space-y-4">
              {isRegister && <input type="text" placeholder="顯示暱稱" value={nickname} onChange={e=>setNickname(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-full py-4 px-6 outline-none" />}
              <input type="text" placeholder="帳號" value={username} onChange={e=>setUsername(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-full py-4 px-6 outline-none" />
              <input type="password" placeholder="密碼" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full bg-black/20 border border-white/10 rounded-full py-4 px-6 outline-none" />
              <button className="w-full py-4 bg-white text-black rounded-full font-black uppercase shadow-lg shadow-white/10">{isRegister ? '註冊通行證' : '進入系統'}</button>
            </form>
            <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-xs text-white/30 hover:text-white transition-colors">{isRegister ? '返回登入' : '申請加入遊戲城'}</button>
          </div>
        </div>
      )}

      {view === 'lobby' && (
        <Lobby 
          user={user} myScore={myScore} leaderboard={leaderboard} 
          handleCreateRoom={handleCreateRoom} handleJoinRoom={handleJoinRoom} 
        />
      )}

      {view === 'room' && (
        <div className="relative z-10 h-screen overflow-hidden">
          {roomData?.info?.status === 'waiting' ? (
            <WaitingRoom user={user} roomId={roomId} roomData={roomData} isHost={roomData?.info?.hostId === user?.uid} handleLeaveRoom={handleLeaveRoom} />
          ) : (
            <>
              {roomData?.info?.gameMode === 'boomcat' && <BoomCat user={user} roomId={roomId} roomData={roomData} handleLeaveRoom={handleLeaveRoom} />}
              {roomData?.info?.gameMode === 'drawguess' && <DrawGuess user={user} roomId={roomId} roomData={roomData} handleLeaveRoom={handleLeaveRoom} />}
              {roomData?.info?.gameMode === 'bingo' && <Bingo user={user} roomId={roomId} roomData={roomData} handleLeaveRoom={handleLeaveRoom} />}
              {roomData?.info?.gameMode === 'evilfills' && <EvilFills user={user} roomId={roomId} roomData={roomData} handleLeaveRoom={handleLeaveRoom} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
