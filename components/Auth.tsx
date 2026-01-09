
import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User 
} from 'firebase/auth';
import TermsModal from './TermsModal';

interface AuthProps {
  user: User | null;
  onClose?: () => void;
}

const Auth: React.FC<AuthProps> = ({ user, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  const [msg, setMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!isLogin && !isReset) {
       if (password !== passwordConfirm) {
           setMsg({ type: 'error', text: 'パスワードが一致しません。' });
           return;
       }
       if (!agreedToTerms) {
           setMsg({ type: 'error', text: '利用規約への同意が必要です。' });
           return;
       }
    }
    
    setLoading(true);

    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        setMsg({ type: 'success', text: 'メールを送信しました。確認してください。' });
        setIsReset(false);
      } else if (isLogin) {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      if (!isReset) {
         setPassword('');
         setPasswordConfirm('');
      }
    } catch (err: any) {
      let errorMessage = "エラーが発生しました。";
      if (err.code === 'auth/invalid-email') errorMessage = "メールアドレスの形式が変だよ。";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') errorMessage = "メールかパスワードが間違ってるみたい。";
      if (err.code === 'auth/email-already-in-use') errorMessage = "このメールアドレスはもう使われてるよ。";
      if (err.code === 'auth/weak-password') errorMessage = "パスワードは6文字以上にしてね。";
      
      setMsg({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMsg({ type: 'success', text: 'ログアウトしました。' });
    } catch (error) {
      console.error(error);
    }
  };

  if (user) {
    return (
      <div className="flex flex-col gap-3 animate-in fade-in">
        <div className="bg-zinc-800/40 p-4 rounded-2xl border border-zinc-700/50">
          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 tracking-widest">Logged in as</p>
          <p className="text-white text-xs font-medium break-all">{user.email}</p>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl text-xs font-bold border border-zinc-700 transition-all active:scale-95"
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Tabs */}
        {!isReset && (
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button 
                  onClick={() => { setIsLogin(true); setMsg(null); }}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${isLogin ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
              >
                  ログイン
              </button>
              <button 
                  onClick={() => { setIsLogin(false); setMsg(null); }}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${!isLogin ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
              >
                  新規登録
              </button>
          </div>
        )}

        <div className="space-y-1">
            <h3 className="text-base font-bold text-white text-center">
            {isReset ? "パスワード再設定" : (isLogin ? "おかえりなさい" : "初めまして")}
            </h3>
        </div>

        {msg && (
          <div className={`text-[10px] font-bold p-2.5 rounded-xl animate-in slide-in-from-top-2 ${msg.type === 'error' ? 'bg-red-950/30 text-red-400 border border-red-500/20' : 'bg-green-950/30 text-green-400 border border-green-500/20'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="space-y-1">
            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Email</label>
            <input 
              type="email" 
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 focus:outline-none transition-all placeholder:text-zinc-800"
              placeholder="example@mail.com"
            />
          </div>
          
          {!isReset && (
              <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Password</label>
              <input 
                  type="password" 
                  required
                  minLength={6}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 focus:outline-none transition-all placeholder:text-zinc-800"
                  placeholder="••••••••"
              />
              </div>
          )}

          {!isReset && !isLogin && (
              <div className="space-y-1 animate-in fade-in">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Confirm Password</label>
                  <input 
                      type="password" 
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className={`w-full bg-black/40 border rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 focus:outline-none transition-all placeholder:text-zinc-800
                        ${passwordConfirm && password !== passwordConfirm ? 'border-red-500/30' : 'border-white/5'}
                      `}
                      placeholder="もう一度入力"
                  />
              </div>
          )}

          {!isReset && !isLogin && (
              <div className="flex items-start gap-2 mt-1 animate-in fade-in">
                  <input 
                      type="checkbox" 
                      id="agreedToTerms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-white/10 bg-black text-pink-600 focus:ring-pink-500 focus:ring-offset-0"
                  />
                  <label htmlFor="agreedToTerms" className="text-[9px] text-zinc-500 select-none leading-tight">
                      <button type="button" onClick={() => setShowTerms(true)} className="text-pink-400 hover:underline font-bold">利用規約</button>
                      に同意して開始
                  </label>
              </div>
          )}

          {!isReset && isLogin && (
            <div className="flex items-center gap-2">
              <input 
                  type="checkbox" 
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-black text-pink-600 focus:ring-pink-500 focus:ring-offset-0"
              />
              <label htmlFor="rememberMe" className="text-[9px] text-zinc-500 select-none cursor-pointer">
                  ログイン状態を保持
              </label>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || (!isLogin && !isReset && (!agreedToTerms || password !== passwordConfirm))}
            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white py-3.5 rounded-2xl font-bold text-sm mt-2 disabled:opacity-30 transition-all shadow-xl shadow-pink-900/20 active:scale-95"
          >
            {loading ? "..." : (isReset ? "再設定メールを送信" : (isLogin ? "ログイン" : "新しく始める"))}
          </button>

          <div className="flex flex-col gap-2 mt-1">
            {!isReset && isLogin && (
                <button 
                    type="button"
                    onClick={() => { setIsReset(true); setMsg(null); }}
                    className="text-[9px] text-zinc-600 hover:text-zinc-400 text-center transition-colors font-bold uppercase tracking-widest"
                >
                    Forgot Password?
                </button>
            )}
            {isReset && (
                <button 
                    type="button"
                    onClick={() => { setIsReset(false); setMsg(null); }}
                    className="text-[9px] text-zinc-600 hover:text-zinc-400 text-center transition-colors font-bold uppercase tracking-widest"
                >
                    Back to Login
                </button>
            )}
          </div>
        </form>
      </div>

      {showTerms && (
          <TermsModal onClose={() => setShowTerms(false)} />
      )}
    </>
  );
};

export default Auth;
