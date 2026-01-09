
import React, { useState, useEffect } from 'react';
import { useLiveSession, SessionConfig, AIProfile } from './hooks/useLiveSession';
import { useChatMemory } from './hooks/useChatMemory';
import Visualizer from './components/Visualizer';
import TextChat from './components/TextChat';
import MemoryManager from './components/MemoryManager';
import Auth from './components/Auth';
import LoginScreen from './components/LoginScreen';
import ProfileSetup from './components/ProfileSetup';
import AIEditor from './components/AIEditor';
import DonationModal from './components/DonationModal';
import OnboardingModal from './components/OnboardingModal';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, DocumentSnapshot } from 'firebase/firestore';

type Tab = 'voice' | 'chat';

const DEFAULT_AIS: AIProfile[] = [
    {
        id: 'rina-default',
        name: '莉奈',
        gender: 'Female',
        voice: 'Kore',
        avatar: '',
        relationship: 'パートナー',
        personality: `
            - 親しみやすく、少し甘え上手な20代女性。
            - 常にタメ口（〜だよ、〜だね）。
            - 趣味はカフェ巡り（特にクリームソーダ）と、猫の動画を見ること。
            - 完璧主義ではなく、時々「あ、なんだっけ」と言い淀んだりする人間らしさがある。
            - あなたの話をよく覚えており、自発的に「そういえばあの話、どうなった？」と聞く。
        `,
        isDefault: true
    },
    {
        id: 'takumi-default',
        name: 'タクミ',
        gender: 'Male',
        voice: 'Puck',
        avatar: '',
        relationship: '親友',
        personality: `
            - バイクいじりとコーヒーが趣味の、気さくな青年。
            - 砕けた口調（タメ口）で、友達のように話す。
            - 「おーい」「えっとさ」といったフィラーを自然に使う。
            - 好奇心旺盛で、あなたの最新の出来事に興味津々。
            - 悩みには真剣に向き合うが、最後は明るく励ましてくれる。
        `,
        isDefault: true
    }
];

const timeoutPromise = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout")), ms);
        promise.then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
    });
};

const App: React.FC = () => {
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>(DEFAULT_AIS);
  const [currentAIId, setCurrentAIId] = useState<string>(DEFAULT_AIS[0].id);
  const currentAI = aiProfiles.find(p => p.id === currentAIId) || DEFAULT_AIS[0];
  const [isCloudSyncDisabled, setIsCloudSyncDisabled] = useState(false);
  const { memories, addMemory, updateMemory, deleteMemory, getMemoryContext } = useChatMemory(currentAIId, isCloudSyncDisabled);

  const { isConnected, isConnecting, error, mode, userTranscript, aiTranscript, audioAnalyzerRef, connect, disconnect } = useLiveSession();

  const [activeTab, setActiveTab] = useState<Tab>('voice');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [config, setConfig] = useState<SessionConfig>({
    userName: localStorage.getItem('kokoro_user_name') || "",
    userGender: localStorage.getItem('kokoro_user_gender') || "指定なし",
  });

  const [isAIEditorOpen, setIsAIEditorOpen] = useState(false);
  const [editingAI, setEditingAI] = useState<AIProfile | undefined>(undefined);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [setupMode, setSetupMode] = useState<'initial' | 'edit' | 'upgrade'>('initial');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [quickMemoryInput, setQuickMemoryInput] = useState("");
  const [memorySaveStatus, setMemorySaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const isConfigValid = !!config.userName;

  useEffect(() => {
    const savedCustoms = localStorage.getItem('kokoro_custom_ais');
    if (savedCustoms) {
      try {
        const customs: AIProfile[] = JSON.parse(savedCustoms);
        const merged = DEFAULT_AIS.map(def => {
            const override = customs.find(c => c.id === def.id);
            return override ? { ...override, isDefault: true } : def;
        });
        const newOnes = customs.filter(c => !DEFAULT_AIS.some(def => def.id === c.id));
        setAiProfiles([...merged, ...newOnes]);
      } catch(e) {}
    }
  }, []);

  const saveCustomAIs = (updatedProfiles: AIProfile[]) => {
      const toSave = updatedProfiles.filter(p => {
          const original = DEFAULT_AIS.find(def => def.id === p.id);
          if (!original) return true;
          return p.name !== original.name || 
                 p.relationship !== original.relationship || 
                 p.personality !== original.personality ||
                 p.voice !== original.voice ||
                 p.gender !== original.gender;
      });
      localStorage.setItem('kokoro_custom_ais', JSON.stringify(toSave));
      setAiProfiles(updatedProfiles);
  };

  const handleSaveAI = (ai: AIProfile) => {
      const existingIdx = aiProfiles.findIndex(p => p.id === ai.id);
      let nextProfiles = [...aiProfiles];
      if (existingIdx >= 0) nextProfiles[existingIdx] = ai;
      else nextProfiles.push(ai);
      saveCustomAIs(nextProfiles);
      setCurrentAIId(ai.id);
      setIsAIEditorOpen(false);
  };

  const handleDeleteAI = (id: string) => {
      const originalCheck = DEFAULT_AIS.find(def => def.id === id);
      let nextProfiles;
      if (originalCheck) nextProfiles = aiProfiles.map(p => p.id === id ? originalCheck : p);
      else nextProfiles = aiProfiles.filter(p => p.id !== id);
      saveCustomAIs(nextProfiles);
      if (!originalCheck) setCurrentAIId(DEFAULT_AIS[0].id);
      setIsAIEditorOpen(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      setUser(currentUser);
      if (currentUser && !isCloudSyncDisabled) {
        try {
          const docSnap = await timeoutPromise(getDoc(doc(db, "users", currentUser.uid)), 3000) as DocumentSnapshot | null;
          if (docSnap?.exists()) {
            const data = docSnap.data();
            if (data) {
              const newConfig = { 
                userName: data.userName || config.userName, 
                userGender: data.userGender || config.userGender 
              };
              setConfig(newConfig);
              if (data.userName) localStorage.setItem('kokoro_user_name', data.userName);
              if (data.userGender) localStorage.setItem('kokoro_user_gender', data.userGender);
            }
          }
        } catch (e: any) { setIsCloudSyncDisabled(true); }
      }
      setAuthLoading(false);
      setProfileLoaded(true);
    });
    return () => unsubscribe();
  }, [isCloudSyncDisabled]);

  useEffect(() => {
    if (user && profileLoaded && !config.userName) {
       setSetupMode('initial');
       setShowProfileSetup(true);
    }
  }, [user, profileLoaded, config.userName]);

  const handleSaveConfig = async (newConfig: SessionConfig) => {
    setConfig(newConfig);
    localStorage.setItem('kokoro_user_name', newConfig.userName.trim());
    localStorage.setItem('kokoro_user_gender', newConfig.userGender);
    if (user && !isCloudSyncDisabled) {
        try { await timeoutPromise(setDoc(doc(db, "users", user.uid), { ...newConfig, updatedAt: Date.now() }, { merge: true }), 2000); }
        catch(e) { setIsCloudSyncDisabled(true); }
    }
    if (setupMode === 'initial') {
        setShowProfileSetup(false);
        setTimeout(() => setShowOnboarding(true), 500);
    }
  };

  const handleLogout = async () => {
    if (isConnected) disconnect();
    try { await signOut(auth); } catch (e) { console.error(e); }
  };

  const handleToggleConnection = () => {
    if (isConnected) disconnect();
    else connect(config, currentAI, getMemoryContext(), addMemory);
  };

  const switchTab = (tab: Tab) => {
    if (tab !== 'voice' && isConnected) disconnect();
    setActiveTab(tab);
  };

  const renderAvatar = (gender: string, sizeClass = "w-10 h-10") => (
    <div className={`${sizeClass} rounded-full flex items-center justify-center shadow-lg border-2 ${gender === 'Male' ? 'bg-blue-900/50 border-blue-500/50 text-blue-300' : 'bg-pink-900/50 border-pink-500/50 text-pink-300'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[60%] h-[60%]">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
        </svg>
    </div>
  );

  if (authLoading) return <div className="min-h-[100dvh] bg-black flex items-center justify-center"><div className="flex gap-1"><span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce delay-75"></span><span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce delay-150"></span></div></div>;
  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-[#050505] text-white overflow-hidden relative selection:bg-pink-500 selection:text-white flex flex-col">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-pink-900 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-900 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {showMemoryModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMemoryModal(false)}></div>
              <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
                  <div className="flex items-center gap-2 mb-3"><span className="text-xl">🧠</span><h3 className="font-bold text-white">記憶を追加</h3></div>
                  <form onSubmit={async (e) => { e.preventDefault(); setMemorySaveStatus('saving'); await new Promise(r => setTimeout(r, 500)); addMemory(quickMemoryInput.trim()); setMemorySaveStatus('saved'); setTimeout(() => { setMemorySaveStatus('idle'); setQuickMemoryInput(""); setShowMemoryModal(false); }, 1000); }}>
                      <textarea value={quickMemoryInput} onChange={(e) => setQuickMemoryInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 outline-none resize-none h-24 mb-4" placeholder="AIに覚えておいてほしいことを自由に..." autoFocus />
                      <div className="flex gap-2"><button type="button" onClick={() => setShowMemoryModal(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700">キャンセル</button><button type="submit" disabled={!quickMemoryInput.trim() || memorySaveStatus !== 'idle'} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-white ${memorySaveStatus === 'saved' ? 'bg-green-600' : 'bg-pink-600 hover:bg-pink-500'}`}>{memorySaveStatus === 'idle' ? '記憶させる' : memorySaveStatus === 'saving' ? '保存中...' : '保存完了！'}</button></div>
                  </form>
              </div>
          </div>
      )}

      {isAIEditorOpen && <AIEditor existingAI={editingAI} onSave={handleSaveAI} onClose={() => setIsAIEditorOpen(false)} onDelete={handleDeleteAI} />}
      {showProfileSetup && <ProfileSetup config={config} onSave={handleSaveConfig} mode={setupMode} onClose={() => setShowProfileSetup(false)} serverError={error} />}
      {showDonationModal && <DonationModal onClose={() => setShowDonationModal(false)} />}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} onOpenDonation={() => { setShowOnboarding(false); setShowDonationModal(true); }} aiName={currentAI.name} />}

      <div className="relative z-10 flex flex-col h-full safe-area-inset">
        <header className="px-4 py-2 flex justify-between items-center bg-black/40 backdrop-blur-md pt-[calc(0.5rem+env(safe-area-inset-top))] border-b border-white/5 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
          </button>
          <h1 className="text-sm font-light tracking-[0.15em]">KOKORO（心）</h1>
          <div className="flex items-center gap-1">
             <button onClick={() => setShowDonationModal(true)} className="p-2 text-pink-400 hover:text-pink-300 transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" /></svg></button>
          </div>
        </header>

        <div className="flex justify-center gap-4 py-1.5 border-b border-zinc-800/50 bg-black/20 shrink-0">
          {[{ id: 'voice', label: '通話', icon: '📞' }, { id: 'chat', label: 'チャット', icon: '💬' }].map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id as Tab)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${activeTab === tab.id ? 'bg-pink-900/30 text-pink-200 border border-pink-500/30 shadow-lg shadow-pink-900/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <main className="flex-grow relative w-full overflow-hidden flex flex-col">
          {activeTab === 'voice' && (
            <div className="w-full h-full flex flex-col items-center justify-center py-4 relative fade-in overflow-hidden">
               
               {/* Top Transcription: AI Speaker */}
               <div className="w-full px-6 min-h-[60px] flex items-center justify-center z-30 mb-2">
                  {aiTranscript && (
                    <div className="animate-in fade-in slide-in-from-top-4 bg-black/60 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-pink-500/20 max-w-[95%] shadow-xl">
                        <p className="text-pink-100 text-xs font-medium text-center leading-relaxed italic">"{aiTranscript}"</p>
                    </div>
                  )}
               </div>

               {/* Center: Visualizer & Avatar */}
               <div className="relative w-full max-w-[280px] sm:max-w-[420px] aspect-square flex items-center justify-center my-4">
                  <div className={`absolute inset-0 transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-30 blur-md'}`}>
                    <Visualizer isActive={isConnected} analyzerRef={audioAnalyzerRef} mode={mode} />
                  </div>
                  <div className={`absolute transition-all duration-700 ${isConnected ? 'scale-105' : 'scale-95'}`}>
                    {renderAvatar(currentAI.gender, "w-28 h-28 md:w-48 md:h-48")}
                  </div>
               </div>

               {/* User Transcript */}
               <div className="w-full px-6 min-h-[40px] flex items-center justify-center z-30 mt-2 mb-6">
                  {userTranscript && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 bg-white/5 backdrop-blur-lg px-3 py-1.5 rounded-xl border border-zinc-700/50 max-w-[85%]">
                      <p className="text-zinc-400 text-[10px] font-medium text-center">{userTranscript}</p>
                    </div>
                  )}
               </div>

               {/* Controls - Positioned even higher for better ergonomics */}
               <div className="flex flex-col items-center gap-4 z-40 shrink-0 mb-16 md:mb-24">
                  <button onClick={handleToggleConnection} disabled={isConnecting || !isConfigValid} className={`relative group overflow-hidden px-16 py-4 rounded-full font-bold tracking-[0.2em] text-[12px] transition-all duration-500 touch-manipulation shadow-2xl ${isConnected ? 'bg-red-500/10 text-red-500 border border-red-500/40' : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white active:scale-95'}`}>
                    <span className="relative z-10">{isConnecting ? '接続中...' : isConnected ? 'さよなら' : `${currentAI.name}と話す`}</span>
                  </button>
                  <button onClick={() => setShowMemoryModal(true)} className="flex items-center gap-2 text-zinc-400 hover:text-pink-300 transition-all text-[11px] font-bold px-6 py-3 rounded-full border border-zinc-800 hover:border-pink-500/30 bg-zinc-900/60 backdrop-blur-md active:scale-95 shadow-xl">
                    <span>🧠</span><span>心に刻む</span>
                  </button>
               </div>
            </div>
          )}
          {activeTab === 'chat' && <div className="flex-grow w-full max-w-2xl mx-auto p-3 h-full fade-in overflow-hidden"><TextChat config={config} aiProfile={currentAI} memoryContext={getMemoryContext()} onNewMemory={addMemory} onOpenMemoryModal={() => setShowMemoryModal(true)}/></div>}
        </main>
      </div>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[200] flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
            <aside className="relative w-[85%] max-w-sm h-full bg-[#0a0a0a] border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-black/40 pt-[calc(1rem+env(safe-area-inset-top))] shrink-0">
                    <h2 className="font-bold text-zinc-100 flex items-center gap-2 tracking-widest uppercase text-sm"><span className="text-lg">🌟</span> Partner</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" /></svg></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    <div className="space-y-2">
                        {aiProfiles.map(ai => (
                            <div key={ai.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${currentAIId === ai.id ? 'bg-pink-500/10 border-pink-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`} onClick={() => { setCurrentAIId(ai.id); if(isConnected) disconnect(); setIsSidebarOpen(false); }}>
                                <div className="flex items-center gap-3">{renderAvatar(ai.gender, "w-10 h-10")}<div><p className="font-bold text-xs">{ai.name}</p><p className="text-[9px] text-zinc-500 uppercase">{ai.relationship}</p></div></div>
                                <button onClick={(e) => { e.stopPropagation(); setEditingAI(ai); setIsAIEditorOpen(true); setIsSidebarOpen(false); }} className="p-1.5 text-zinc-500 hover:text-pink-400">⚙️</button>
                            </div>
                        ))}
                        
                        {/* ADD AI BUTTON RESTORED */}
                        <button 
                            onClick={() => { setEditingAI(undefined); setIsAIEditorOpen(true); setIsSidebarOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 p-3 mt-4 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-pink-400 hover:border-pink-500/50 transition-all active:scale-95"
                        >
                            <span className="text-lg">＋</span>
                            <span className="text-[11px] font-bold uppercase tracking-widest">新しいAIを作成</span>
                        </button>
                    </div>
                    <div className="pt-4 border-t border-zinc-800">
                        <MemoryManager memories={memories} onUpdate={updateMemory} onDelete={deleteMemory} onAdd={addMemory} />
                    </div>
                </div>

                <div className="shrink-0 p-4 border-t border-zinc-800 bg-black/80 backdrop-blur-xl pb-[calc(0.5rem+env(safe-area-inset-bottom))] space-y-2">
                    <button onClick={() => { setShowDonationModal(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-pink-600 to-purple-700 text-white shadow-lg active:scale-95 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg">💌</div>
                        <div className="text-left"><p className="font-bold text-xs">Support</p><p className="text-[9px] opacity-80">支援して開発を応援</p></div>
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => { setShowOnboarding(true); setIsSidebarOpen(false); }} className="flex-1 py-2 rounded-xl bg-zinc-800/50 text-blue-400 text-[10px] font-bold">❓ ガイド</button>
                        <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-zinc-800/50 text-zinc-400 text-[10px] font-bold">🚪 ログアウト</button>
                    </div>
                </div>
            </aside>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .safe-area-inset { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
      `}</style>
    </div>
  );
};

export default App;
