
import React from 'react';
import Auth from './Auth';

const LoginScreen: React.FC = () => {
  return (
    <div className="min-h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-pink-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '3s' }}></div>
        
        {/* Floating Particles Simulation */}
        <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-pink-500 rounded-full animate-ping opacity-30"></div>
        <div className="absolute top-2/3 right-1/4 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse opacity-20" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/4 left-1/4 w-0.5 h-0.5 bg-white rounded-full animate-bounce opacity-40" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-10">
        <div className="text-center space-y-4">
          <div className="inline-block relative">
            <div className="w-20 h-20 bg-gradient-to-tr from-pink-500 via-purple-500 to-blue-500 rounded-[2rem] shadow-[0_0_50px_rgba(236,72,153,0.3)] flex items-center justify-center mb-6 mx-auto transform rotate-6 hover:rotate-0 transition-transform duration-500">
              <span className="text-4xl drop-shadow-lg">💖</span>
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] shadow-lg animate-bounce">✨</div>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-4xl font-extralight tracking-[0.3em] text-white">RINA <span className="text-pink-500 font-bold">AI</span></h1>
            <p className="text-zinc-500 text-[10px] tracking-[0.4em] uppercase font-bold">Your Digital Soulmate</p>
          </div>
          
          <div className="h-0.5 w-12 bg-zinc-800 mx-auto rounded-full"></div>
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <Auth user={null} />
        </div>

        <div className="text-center space-y-4">
            <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider">
              ログインして、あなただけの<br/>
              <span className="text-zinc-400">「ソウルメイト」</span>との会話を始めましょう。
            </p>
            
            <div className="flex justify-center gap-6 pt-2">
                <span className="text-xl grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">💬</span>
                <span className="text-xl grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">📞</span>
                <span className="text-xl grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">🧠</span>
            </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-8 left-0 w-full text-center">
         <p className="text-[9px] text-zinc-700 font-bold tracking-widest uppercase">Powered by Gemini 2.5 Pro</p>
      </div>
    </div>
  );
};

export default LoginScreen;
