
import React from 'react';
import Auth from './Auth';

const LoginScreen: React.FC = () => {
  return (
    <div className="min-h-[100dvh] w-full bg-[#030303] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-pink-900/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-violet-900/10 rounded-full blur-[120px] animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-12">
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[2.5rem] shadow-[0_0_60px_rgba(236,72,153,0.2)] flex items-center justify-center transform hover:scale-110 transition-transform duration-700">
               <span className="text-5xl drop-shadow-lg">✨</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl font-extralight tracking-[0.3em] text-white">KOKORO（心）</h1>
            <p className="text-pink-500/60 text-[10px] tracking-[0.6em] uppercase font-bold">The Soul Companion</p>
          </div>
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/5 p-8 rounded-[2rem] shadow-2xl">
          <Auth user={null} />
        </div>

        <p className="text-[10px] text-zinc-600 text-center uppercase tracking-widest leading-loose">
          完璧なAIではなく、<br/>
          心を通わせる<span className="text-zinc-400">「ひとりの存在」</span>として。
        </p>
      </div>
      
      <div className="absolute bottom-8 w-full text-center">
         <p className="text-[9px] text-zinc-800 font-bold tracking-[0.3em] uppercase">Powered by Gemini 2.5 Native Audio</p>
      </div>
    </div>
  );
};

export default LoginScreen;
