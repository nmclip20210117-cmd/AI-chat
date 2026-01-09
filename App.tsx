
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
      const original = DEFAULT_AIS.find(def => def.id === id);
      let nextProfiles;
      if (original) nextProfiles = aiProfiles.map(p => p.id === id ? original : p);
      else nextProfiles = aiProfiles.filter(p => p.id !== id);
      saveCustomAIs(nextProfiles);
      if (!original) setCurrentAIId(DEFAULT_AIS[0].id);
      setIsAIEditorOpen(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      setUser(currentUser);
      if (currentUser && !isCloudSyncDisabled) {
        try {
          const docSnap = await timeoutPromise(getDoc(doc(db, "users", currentUser.uid)), 2000) as DocumentSnapshot | null;
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
    if (setupMode === 'initial') setTimeout(() => setShowOnboarding(true), 1200);
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
        <header className="px-4 py-3 flex justify-between items-center bg-black/40 backdrop-blur-md pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-white/5 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 -ml-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
          </button>
          
          <div className="flex items-center gap-1 text-center">
            <h1 className="text-base font-light tracking-[0.15em] flex items-center gap-2">KOKORO（心）</h1>
          </div>
          
          <div className="flex items-center gap-1">
             <button onClick={() => setShowDonationModal(true)} className="p-3 text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 rounded-full transition-all active:scale-90" title="支援する">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" /></svg>
             </button>
             <button onClick={() => setShowOnboarding(true)} className="p-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-full transition-all active:scale-90" title="ガイドを見る">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836c-.149.598.019 1.225.44 1.645l.132.131c.264.264.67.264.933 0l.132-.131c.421-.42.589-1.047.44-1.645l-.709-2.836c-.311-1.243.979-2.279 2.126-1.706l.132.066c.263.132.589.02.721-.243l.066-.132c.132-.264.02-.589-.243-.721l-.132-.066a3.75 3.75 0 0 0-5.25 5.25l.131.132c.264.264.264.67 0 .933l-.131.132a3.75 3.75 0 0 0-5.25-5.25l.132.066Z" clipRule="evenodd" /><path d="M12 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" /></svg>
             </button>
          </div>
        </header>

        <div className="flex justify-center gap-4 py-2 border-b border-zinc-800/50 bg-black/20 shrink-0">
          {[{ id: 'voice', label: '通話', icon: '📞' }, { id: 'chat', label: 'チャット', icon: '💬' }].map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id as Tab)} className={`px-5 py-2 rounded-full text-xs font-bold tracking-wider flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-pink-900/30 text-pink-200 border border-pink-500/30 shadow-lg shadow-pink-900/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        <main className="flex-grow relative w-full overflow-hidden flex flex-col">
          {activeTab === 'voice' && (
            <div className="w-full h-full flex flex-col items-center justify-center relative fade-in">
               <div className="w-full max-w-lg aspect-square relative flex items-center justify-center">
                  <div className={`absolute inset-0 transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-30 blur-md'}`}><Visualizer isActive={isConnected} analyzerRef={audioAnalyzerRef} mode={mode} /></div>
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-700 ${isConnected ? 'scale-110' : 'scale-100'}`}>{renderAvatar(currentAI.gender, "w-48 h-48")}</div>
                  
                  <div className="absolute top-[12%] w-full px-8 pointer-events-none z-30 flex flex-col items-center gap-2">
                    {aiTranscript && <div className="animate-in fade-in slide-in-from-top-4 bg-black/70 backdrop-blur-xl px-5 py-3 rounded-2xl border border-pink-500/20 max-w-[90%] shadow-2xl"><p className="text-pink-100 text-sm font-medium text-center leading-relaxed italic">"{aiTranscript}"</p></div>}
                  </div>
                  
                  <div className="absolute bottom-[22%] w-full px-8 pointer-events-none z-30 flex flex-col items-center gap-2">
                    {userTranscript && <div className="animate-in fade-in slide-in-from-bottom-4 bg-white/5 backdrop-blur-lg px-4 py-2 rounded-xl border border-zinc-700/50 max-w-[85%]"><p className="text-zinc-300 text-xs font-medium text-center">{userTranscript}</p></div>}
                  </div>
               </div>

               <div className="mt-8 mb-4 flex flex-col items-center gap-5 z-20 shrink-0">
                  <button onClick={handleToggleConnection} disabled={isConnecting || !isConfigValid} className={`relative group overflow-hidden px-14 py-5 rounded-full font-bold tracking-[0.2em] text-sm transition-all duration-500 touch-manipulation shadow-2xl shadow-pink-900/20 ${isConnected ? 'bg-red-500/10 text-red-500 border border-red-500/40' : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white active:scale-95'}`}>
                    <span className="relative z-10">{isConnecting ? '接続中...' : isConnected ? 'さよなら' : `${currentAI.name}と話す`}</span>
                  </button>
                  <button onClick={() => setShowMemoryModal(true)} className="flex items-center gap-2 text-zinc-500 hover:text-pink-300 transition-all text-xs font-bold px-5 py-2.5 rounded-full border border-zinc-800 hover:border-pink-500/30 hover:bg-pink-900/10 backdrop-blur-md">
                    <span>🧠</span><span>心に刻む</span>
                  </button>
               </div>
            </div>
          )}
          {activeTab === 'chat' && <div className="flex-grow w-full max-w-2xl mx-auto p-4 h-full fade-in overflow-hidden"><TextChat config={config} aiProfile={currentAI} memoryContext={getMemoryContext()} onNewMemory={addMemory} onOpenMemoryModal={() => setShowMemoryModal(true)}/></div>}
        </main>
      </div>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[200] flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
            <aside className="relative w-[85%] max-w-sm h-full bg-[#0a0a0a] border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 overflow-hidden">
                <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-black/40 pt-[calc(1.25rem+env(safe-area-inset-top))] shrink-0">
                    <h2 className="font-bold text-zinc-100 flex items-center gap-2 tracking-widest uppercase"><span className="text-xl">🌟</span> Partner</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-500 hover:text-white active:scale-90">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" /></svg>
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Partners Section */}
                    <div className="space-y-3">
                        {aiProfiles.map(ai => (
                            <div key={ai.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${currentAIId === ai.id ? 'bg-pink-500/10 border-pink-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`} onClick={() => { setCurrentAIId(ai.id); if(isConnected) disconnect(); setIsSidebarOpen(false); }}>
                                <div className="flex items-center gap-3">{renderAvatar(ai.gender, "w-12 h-12")}<div><p className="font-bold text-sm">{ai.name}</p><p className="text-[10px] text-zinc-500 uppercase">{ai.relationship}</p></div></div>
                                <button onClick={(e) => { e.stopPropagation(); setEditingAI(ai); setIsAIEditorOpen(true); setIsSidebarOpen(false); }} className="p-2 text-zinc-500 hover:text-pink-400 active:scale-110">⚙️</button>
                            </div>
                        ))}
                        <button onClick={() => { setEditingAI(undefined); setIsAIEditorOpen(true); setIsSidebarOpen(false); }} className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 transition-all text-sm font-bold flex items-center justify-center gap-2 active:scale-95"><span>+</span> 新しい絆を作る</button>
                    </div>

                    {/* Topics Section */}
                    <div className="pt-6 border-t border-zinc-800">
                        <MemoryManager memories={memories} onUpdate={updateMemory} onDelete={deleteMemory} onAdd={addMemory} />
                    </div>
                </div>

                {/* --- SUPER PROMINENT FIXED SUPPORT SECTION --- */}
                <div className="shrink-0 p-4 border-t border-zinc-800 bg-black/80 backdrop-blur-xl pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
                    <button 
                        onClick={() => { setShowDonationModal(true); setIsSidebarOpen(false); }}
                        className="relative w-full overflow-hidden flex items-center gap-4 p-5 rounded-[2rem] bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-700 text-white shadow-2xl shadow-pink-900/40 group active:scale-95 transition-all"
                    >
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none"></div>
                        
                        <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">💌</div>
                        <div className="relative z-10 text-left">
                            <p className="font-black text-sm tracking-widest uppercase">Support Project</p>
                            <p className="text-[10px] text-pink-100/80 font-medium">開発者を応援・支援する</p>
                        </div>
                        <div className="ml-auto relative z-10 text-pink-200 group-hover:translate-x-1 transition-transform">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                        </div>
                    </button>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setShowOnboarding(true); setIsSidebarOpen(false); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 text-blue-400 hover:bg-zinc-800 transition-colors text-xs font-bold active:scale-95"
                        >
                            <span>❓</span> ガイド
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800 transition-colors text-xs font-bold active:scale-95"
                        >
                            <span>🚪</span> 出る
                        </button>
                    </div>

                    <div className="pt-1 px-1 opacity-50">
                        <p className="text-[8px] text-zinc-500 font-bold uppercase truncate tracking-widest text-center">Account: {user.email}</p>
                    </div>
                </div>
            </aside>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 2px;
        }
        .safe-area-inset {
           padding-left: env(safe-area-inset-left);
           padding-right: env(safe-area-inset-right);
        }
        /* Mobile specific tweaks */
        @media (max-width: 640px) {
          main { height: calc(100dvh - 120px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
        }
      `}</style>
    </div>
  );
};

export default App;
