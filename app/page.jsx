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
import { auth, googleProvider } from './lib/firebaseConfig';

export default function LoginPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  // 1. 監聽登入狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 帳號密碼登入/註冊
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        // 註冊時順便設定暱稱
        await updateProfile(res.user, { displayName: nickname });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      alert("驗證失敗: " + err.message);
    }
  };

  // 3. Google 一鍵登入
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      alert("Google 登入失敗: " + err.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020205] flex items-center justify-center text-indigo-400 tracking-[1em] animate-pulse">
      載入中
    </div>
  );

  // 如果已登入，顯示歡迎訊息（之後這裡會跳轉到大廳）
  if (user) return (
    <div className="min-h-screen bg-[#05050a] flex flex-col items-center justify-center text-white p-10">
      <div className="bg-white/5 backdrop-blur-3xl p-12 rounded-[3.5rem] border border-white/10 text-center shadow-2xl">
        <h2 className="text-3xl font-black mb-4 tracking-tighter italic">歡迎回來, {user.displayName || '新玩家'}</h2>
        <p className="text-white/30 mb-10 text-sm">準備好開始一場遊戲了嗎？</p>
        <div className="flex gap-4">
          <button className="px-10 py-4 bg-white text-black rounded-full font-black">進入大廳</button>
          <button onClick={() => signOut(auth)} className="px-10 py-4 bg-white/5 border border-white/10 rounded-full font-bold">登出</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#05050a] bg-[radial-gradient(circle_at_top_right,_#1e1b4b,_#05050a)] flex items-center justify-center p-6 text-white overflow-hidden">
      
      {/* 裝飾光暈 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/[0.02] border border-white/10 backdrop-blur-3xl rounded-[3.5rem] p-10 md:p-14 shadow-2xl relative z-10">
        
        {/* 品牌標誌區域 */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-3xl mx-auto mb-6 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/20">
            🎮
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-1">我的遊戲吧</h1>
          <p className="text-white/20 text-[10px] tracking-[0.4em] uppercase font-bold">Next-Gen Gaming Lounge</p>
        </div>

        {/* 登入表單 */}
        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && (
            <input 
              type="text" placeholder="玩家暱稱" value={nickname} onChange={e => setNickname(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-4 px-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium"
            />
          )}
          <input 
            type="email" placeholder="電子郵件" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-4 px-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium"
          />
          <input 
            type="password" placeholder="密碼" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] py-4 px-6 outline-none focus:border-indigo-500/50 transition-all text-sm font-medium"
          />
          <button className="w-full py-5 bg-white text-black rounded-[2.5rem] font-black hover:bg-indigo-50 transition-all active:scale-95 shadow-xl text-sm uppercase tracking-widest mt-4">
            {isRegister ? '建立帳號' : '進入包廂'}
          </button>
        </form>

        {/* 分隔線 */}
        <div className="flex items-center my-10 gap-4">
          <div className="flex-1 h-[1px] bg-white/10"></div>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">快速入口</span>
          <div className="flex-1 h-[1px] bg-white/10"></div>
        </div>

        {/* 社交登入按鈕 */}
        <button 
          onClick={handleGoogleLogin}
          className="w-full py-4 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 transition-all flex items-center justify-center gap-3 text-sm font-bold group"
        >
          <span className="opacity-60 group-hover:opacity-100 transition-opacity">G</span>
          使用 Google 帳號繼續
        </button>

        {/* 切換註冊/登入 */}
        <p className="mt-10 text-center text-xs text-white/30 font-medium">
          {isRegister ? '已經有帳號了？' : '第一次來到這裡嗎？'}
          <button 
            onClick={() => setIsRegister(!isRegister)} 
            className="ml-2 text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
          >
            {isRegister ? '點此登入' : '立即註冊'}
          </button>
        </p>
      </div>
    </div>
  );
}
