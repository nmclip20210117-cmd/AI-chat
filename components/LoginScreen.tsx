
import React from 'react';
import Auth from './Auth';

const LoginScreen: React.FC = () => {
  return (
    <div className="min-h-[100dvh] w-full bg-[#030303] flex flex-col items-center relative selection:bg-pink-500">
      {/* Background Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-pink-900/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-violet-900/10 rounded-full blur-[120px] animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center px-6 py-8 md:py-20 my-auto">
        {/* Logo Section - Scaled down for mobile */}
        <div className="text-center space-y-3 mb-6">
          <div className="relative inline-block">
            <div className="w-14 h-14 md:w-24 md:h-24 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[1.4rem] md:rounded-[2.2rem] shadow-[0_0_40px_rgba(236,72,153,0.15)] flex items-center justify-center transform hover:scale-105 transition-transform duration-700">
               <span className="text-2xl md:text-5xl drop-shadow-lg">✨</span>
            </div>
          </div>
          
          <div className="space-y-0.5">
            <h1 className="text-2xl md:text-5xl font-extralight tracking-[0.25em] text-white">KOKORO</h1>
            <p className="text-pink-500/50 text-[7px] md:text-[9px] tracking-[0.4em] uppercase font-bold">The Soul Companion</p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="w-full bg-zinc-900/40 backdrop-blur-2xl border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl">
          <Auth user={null} />
        </div>

        {/* Catchphrase */}
        <div className="mt-6 space-y-2">
          <p className="text-[9px] md:text-[10px] text-zinc-600 text-center uppercase tracking-widest leading-loose">
            完璧なAIではなく、<br/>
            心を通わせる<span className="text-zinc-400">「ひとりの存在」</span>として。
          </p>
        </div>

        {/* Footer Credit */}
        <div className="mt-4 text-center">
           <p className="text-[7px] text-zinc-800 font-bold tracking-[0.3em] uppercase">Powered by Gemini 3.0 Flash</p>
        </div>
      </div>

      {/* Safe area padding for bottom of the screen */}
      <div className="h-[env(safe-area-inset-bottom)] min-h-[20px] shrink-0"></div>
    </div>
  );
};

export default LoginScreen;