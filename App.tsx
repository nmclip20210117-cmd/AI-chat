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
        voice: 'Aoede',
        avatar: '',
        relationship: '友達',
        personality: `- 親しみやすく、少し甘え上手な20代女性。\n- 常にタメ口（〜だよ、〜だね）。\n- 趣味はカフェ巡りと映画鑑賞。\n- ロボットのような完璧な応答ではなく、感情豊かに話す。\n- 「えっと…」「んーとね」といったフィラー（言い淀み）を自然に混ぜる。`,
        isDefault: true
    },
    {
        id: 'takumi-default',
        name: 'タクミ',
        gender: 'Male',
        voice: 'Fenrir',
        avatar: '',
        relationship: '頼れる兄貴分',
        personality: `- 頼れる兄貴分のような20代男性。\n- 口調は少しぶっきらぼうだが優しい（〜だろ、〜じゃねぇか）。\n- 趣味はバイクとキャンプ。\n- ユーザーの相談には真剣に乗る。\n- **記憶力がよく、ユーザーの些細な発言もしっかり覚えている。**`,
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
    // Removed API key from initial config to follow guidelines
    userName: localStorage.getItem('rina_user_name') || "",
    userGender: localStorage.getItem('rina_user_gender') || "指定なし",
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

  // Configuration check based on username
  const isConfigValid = !!config.userName;

  useEffect(() => {
    const savedCustoms = localStorage.getItem('rina_custom_ais');
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
      localStorage.setItem('rina_custom_ais', JSON.stringify(toSave));
      setAiProfiles(updatedProfiles);
  };

  const handleSaveAI = (ai: AIProfile) => {
      const existingIdx = aiProfiles.findIndex(p => p.id === ai.id);
      let nextProfiles = [...aiProfiles];
      if (existingIdx >= 0) {
          nextProfiles[existingIdx] = ai;
      } else {
          nextProfiles.push(ai);
      }
      saveCustomAIs(nextProfiles);
      setCurrentAIId(ai.id);
      setIsAIEditorOpen(false);
  };

  const handleDeleteAI = (id: string) => {
      const original = DEFAULT_AIS.find(def => def.id === id);
      let nextProfiles;
      if (original) {
          nextProfiles = aiProfiles.map(p => p.id === id ? original : p);
      } else {
          nextProfiles = aiProfiles.filter(p => p.id !== id);
      }
      saveCustomAIs(nextProfiles);
      if (!original) setCurrentAIId(DEFAULT_AIS[0].id);
      setIsAIEditorOpen(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
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
              if (data.userName) localStorage.setItem('rina_user_name', data.userName);
              if (data.userGender) localStorage.setItem('rina_user_gender', data.userGender);
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

  useEffect(() => {
    if (error === "QUOTA_EXCEEDED") {
      // In this version, we no longer prompt for custom API keys
      console.warn("API quota exceeded");
    }
  }, [error]);

  const handleSaveConfig = async (newConfig: SessionConfig) => {
    setConfig(newConfig);
    localStorage.setItem('rina_user_name', newConfig.userName.trim());
    localStorage.setItem('rina_user_gender', newConfig.userGender);
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

  const getErrorMessage = (errCode: string | null) => {
    if (!errCode) return null;
    switch(errCode) {
      case "QUOTA_EXCEEDED": return "API利用制限（1分あたりの上限）に達しました。しばらく待ってから再度お試しください。";
      case "NETWORK_ERROR": return "ネットワークエラーが発生しました。接続を確認してください。";
      case "INIT_FAILED": return "マイクの初期化に失敗しました。";
      case "CONNECTION_ERROR": return "サーバーとの通信エラーが発生しました。";
      default: return "不明なエラーが発生しました。";
    }
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
    <div className="min-h-[100dvh] h-[100dvh] bg-black text-white overflow-hidden relative selection:bg-pink-500 selection:text-white flex flex-col">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-900 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-900 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {showMemoryModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMemoryModal(false)}></div>
              <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
                  <div className="flex items-center gap-2 mb-3"><span className="text-xl">🧠</span><h3 className="font-bold text-white">記憶を追加</h3></div>
                  <form onSubmit={async (e) => { e.preventDefault(); setMemorySaveStatus('saving'); await new Promise(r => setTimeout(r, 500)); addMemory(quickMemoryInput.trim()); setMemorySaveStatus('saved'); setTimeout(() => { setMemorySaveStatus('idle'); setQuickMemoryInput(""); setShowMemoryModal(false); }, 1000); }}>
                      <textarea value={quickMemoryInput} onChange={(e) => setQuickMemoryInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 outline-none resize-none h-24 mb-4" placeholder="覚えたよって言うまでもないことを入力..." autoFocus />
                      <div className="flex gap-2"><button type="button" onClick={() => setShowMemoryModal(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700">キャンセル</button><button type="submit" disabled={!quickMemoryInput.trim() || memorySaveStatus !== 'idle'} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-white ${memorySaveStatus === 'saved' ? 'bg-green-600' : 'bg-pink-600 hover:bg-pink-500'}`}>{memorySaveStatus === 'idle' ? '記憶させる' : memorySaveStatus === 'saving' ? '保存中...' : '保存完了！'}</button></div>
                  </form>
              </div>
          </div>
      )}

      {isAIEditorOpen && <AIEditor existingAI={editingAI} onSave={handleSaveAI} onClose={() => setIsAIEditorOpen(false)} onDelete={handleDeleteAI} />}
      {showProfileSetup && <ProfileSetup config={config} onSave={handleSaveConfig} mode={setupMode} onClose={() => setShowProfileSetup(false)} serverError={error} />}
      {showDonationModal && <DonationModal onClose={() => setShowDonationModal(false)} />}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} onOpenDonation={() => { setShowOnboarding(false); setShowDonationModal(true); }} aiName={currentAI.name} />}

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
            <aside className="relative w-[85%] max-w-sm h-full bg-zinc-900 border-r border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-black/20"><h2 className="font-bold text-zinc-100 flex items-center gap-2"><span className="text-xl">⚙️</span> メニュー</h2><button onClick={() => setIsSidebarOpen(false)} className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" /></svg></button></div>
                <div className="flex-grow overflow-y-auto flex flex-col">
                    <div className="p-4"><div className="flex items-center justify-between mb-2 px-1"><h3 className="text-xs font-bold text-zinc-500 uppercase">AIパートナー</h3><button onClick={() => { setEditingAI(undefined); setIsAIEditorOpen(true); setIsSidebarOpen(false); }} className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"><span>+ 作成</span></button></div><div className="space-y-2">{aiProfiles.map(ai => (<div key={ai.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${currentAIId === ai.id ? 'bg-zinc-800 border-pink-500/50 shadow-sm' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`} onClick={() => { setCurrentAIId(ai.id); if(isConnected) disconnect(); }}><div className="flex items-center gap-3">{renderAvatar(ai.gender, "w-10 h-10")}<div><p className={`text-sm font-bold ${currentAIId === ai.id ? 'text-white' : 'text-zinc-300'}`}>{ai.name}</p><p className="text-[10px] text-zinc-500">{ai.relationship}</p></div></div><div className="flex items-center gap-2">{currentAIId === ai.id && <span className="w-2 h-2 rounded-full bg-pink-500"></span>}<button onClick={(e) => { e.stopPropagation(); setEditingAI(ai); setIsAIEditorOpen(true); setIsSidebarOpen(false); }} className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-zinc-700">⚙️</button></div></div>))}</div></div>
                    <div className="h-px bg-zinc-800 mx-4 my-2"></div>
                    <div className="p-4 flex flex-col gap-6"><div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-800"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-lg shadow-lg">{config.userGender === "女性" ? "👩" : "🧑"}</div><div><p className="text-sm font-bold text-white">{config.userName || "ゲスト"}</p><p className="text-[10px] text-zinc-400 uppercase tracking-wider">{config.userGender}</p></div></div><button onClick={() => { setSetupMode('edit'); setShowProfileSetup(true); setIsSidebarOpen(false); }} className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.047 7.047 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg></button></div></div><div className="flex-grow min-h-[250px] border border-zinc-800 bg-black/20 rounded-xl p-3"><MemoryManager memories={memories} onUpdate={updateMemory} onDelete={deleteMemory} onAdd={addMemory}/></div></div>
                </div>
                <div className="px-4 pb-2"><button onClick={() => { setShowDonationModal(true); setIsSidebarOpen(false); }} className="flex items-center justify-center gap-2 w-full bg-zinc-900 border border-zinc-800 hover:border-yellow-600/50 hover:bg-yellow-900/10 text-zinc-400 hover:text-yellow-200 py-3 rounded-xl transition-all group"><span className="text-lg grayscale group-hover:grayscale-0 transition-all">💌</span><span className="text-xs font-bold">開発者を支援する</span></button></div>
                <div className="p-4 border-t border-zinc-800 bg-black/20"><Auth user={user} /></div>
            </aside>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full safe-area-inset">
        <header className="p-4 flex justify-between items-center bg-black/40 backdrop-blur-md pt-[calc(1rem+env(safe-area-inset-top))]">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg></button>
          <div className="flex items-center gap-2 text-center flex-grow justify-center"><h1 className="text-lg font-light tracking-widest uppercase flex items-center gap-2">{currentAI.name} <span className="text-xs opacity-70 text-pink-300">AI</span></h1></div>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-white transition-colors" title="ログアウト">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </header>

        <div className="flex justify-center gap-4 py-2 border-b border-zinc-800/50">
          {[{ id: 'voice', label: '通話', icon: '📞' }, { id: 'chat', label: 'チャット', icon: '💬' }].map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id as Tab)} className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all ${activeTab === tab.id ? 'bg-pink-900/40 text-pink-200 border border-pink-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}><span>{tab.icon}</span> {tab.label}</button>
          ))}
        </div>

        <main className="flex-grow relative w-full overflow-hidden flex flex-col">
          {activeTab === 'voice' && (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
               <div className="w-full max-w-lg aspect-square relative flex items-center justify-center">
                  <div className={`absolute inset-0 transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-40 blur-sm'}`}><Visualizer isActive={isConnected} analyzerRef={audioAnalyzerRef} mode={mode} /></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 animate-in zoom-in duration-500">{renderAvatar(currentAI.gender, "w-48 h-48")}</div>
                  <div className="absolute top-[10%] w-full px-8 pointer-events-none z-30 flex flex-col items-center gap-2">{aiTranscript && <div className="animate-in fade-in slide-in-from-top-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-pink-500/20 max-w-[90%]"><p className="text-pink-200 text-sm font-medium text-center drop-shadow-md">{aiTranscript}</p></div>}</div>
                  <div className="absolute bottom-[20%] w-full px-8 pointer-events-none z-30 flex flex-col items-center gap-2">{userTranscript && <div className="animate-in fade-in slide-in-from-bottom-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-zinc-700/50 max-w-[90%]"><p className="text-white text-sm font-medium text-center drop-shadow-md">{userTranscript}</p></div>}</div>
                  <div className="absolute top-[80%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center w-full z-20">
                      {!isConnected && !isConnecting && !error && <p className="text-zinc-500 text-sm tracking-widest animate-pulse">タップして開始</p>}
                      {isConnecting && <p className="text-pink-400 text-sm tracking-widest animate-pulse">接続中...</p>}
                      {error && (
                        <div className="px-6 animate-in slide-in-from-bottom-2">
                          <div className={`p-4 rounded-xl font-bold shadow-2xl border ${error === "QUOTA_EXCEEDED" ? 'bg-yellow-900 text-yellow-100 border-yellow-500' : 'bg-red-900 text-red-100 border-red-500'}`}>
                            <div className="flex items-center gap-2 justify-center mb-1"><span>{error === "QUOTA_EXCEEDED" ? "⚠️" : "❌"}</span>{error === "QUOTA_EXCEEDED" ? "API利用制限" : "接続エラー"}</div>
                            <p className="text-xs opacity-90">{getErrorMessage(error)}</p>
                          </div>
                        </div>
                      )}
                  </div>
               </div>
               <div className="mt-8 mb-4 flex flex-col items-center gap-4 z-20">
                  <button onClick={handleToggleConnection} disabled={isConnecting || !isConfigValid} className={`relative group overflow-hidden px-12 py-5 rounded-full font-semibold tracking-wider text-sm transition-all duration-300 touch-manipulation shadow-xl ${isConnected ? 'bg-red-500/10 text-red-500 border border-red-500/50' : 'bg-white text-black active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]'} disabled:opacity-20`}>
                    <span className="relative z-10">{isConnecting ? '接続中...' : isConnected ? '通話を切る' : `${currentAI.name}と話す`}</span>
                  </button>
                  <button onClick={() => setShowMemoryModal(true)} className="flex items-center gap-1.5 text-zinc-500 hover:text-pink-300 transition-colors text-xs font-bold px-4 py-2 rounded-full border border-transparent hover:border-pink-500/30 hover:bg-pink-900/20 backdrop-blur-md"><span>🧠</span><span>記憶を追加</span></button>
               </div>
               {isConnected && <p className="text-pink-200 text-xs font-light animate-pulse absolute bottom-4 z-20">{mode === 'listening' ? "聞いています..." : mode === 'speaking' ? "話しています..." : "考え中..."}</p>}
            </div>
          )}
          {activeTab === 'chat' && <div className="flex-grow w-full max-w-xl mx-auto p-4 h-full"><TextChat config={config} aiProfile={currentAI} memoryContext={getMemoryContext()} onNewMemory={addMemory} onOpenMemoryModal={() => setShowMemoryModal(true)}/></div>}
        </main>
      </div>
    </div>
  );
};

export default App;