
import React, { useState, useEffect } from 'react';
import { SessionConfig } from '../hooks/useLiveSession';

interface ProfileSetupProps {
  config: SessionConfig;
  onSave: (newConfig: SessionConfig) => Promise<void>;
  mode: 'initial' | 'edit' | 'upgrade';
  onClose?: () => void;
  serverError: string | null;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ config, onSave, mode, onClose, serverError }) => {
  const [localConfig, setLocalConfig] = useState<SessionConfig>(config);
  const [expandApiKey, setExpandApiKey] = useState(mode === 'upgrade');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isDefaultKey = !localStorage.getItem('gemini_api_key') && localConfig.apiKey === process.env.API_KEY;
  const shouldShowApiKeyInput = expandApiKey || !localConfig.apiKey || mode === 'upgrade';

  useEffect(() => {
    setLocalConfig(config);
    if (mode === 'upgrade') setExpandApiKey(true);
  }, [config, mode]);
  
  const handleChange = (field: keyof SessionConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localConfig.userName) {
      setSaveStatus('saving');
      try {
        await onSave(localConfig);
        setSaveStatus('saved');
        setTimeout(() => { if (onClose) onClose(); }, 1000);
      } catch (err) { setSaveStatus('idle'); }
    }
  };

  const handleRevertToDefault = () => {
    if (process.env.API_KEY) {
        handleChange('apiKey', process.env.API_KEY);
        setExpandApiKey(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in"></div>
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        <div className="text-center mb-6 mt-2">
          <div className={`inline-block p-3 rounded-full mb-3 ${mode === 'upgrade' ? 'bg-yellow-900/30' : 'bg-zinc-800'}`}>
             <span className="text-2xl">{mode === 'upgrade' ? '🔑' : '⚙️'}</span>
          </div>
          <h2 className={`text-xl font-bold ${mode === 'upgrade' ? 'text-yellow-400' : 'text-white'}`}>
            {mode === 'initial' ? 'プロフィール設定' : (mode === 'upgrade' ? 'APIキー設定' : '設定を変更')}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {mode === 'upgrade' ? '独自のAPIキーを設定して、制限なしで利用します。' : '共通設定はいつでも変更可能です。'}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
           {serverError === "QUOTA_EXCEEDED" && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 p-3 rounded-lg text-xs text-yellow-200 flex gap-2 items-start">
                  <span>⚠️</span><span>無料版の利用上限です。APIキーを設定してください。</span>
              </div>
           )}

           <div className="space-y-3">
             <div className="flex items-center justify-between">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Gemini API Key</label>
                {shouldShowApiKeyInput && !isDefaultKey && process.env.API_KEY && (
                    <button type="button" onClick={handleRevertToDefault} className="text-[10px] text-zinc-500 hover:text-white underline">標準キーに戻す</button>
                )}
             </div>

             {shouldShowApiKeyInput ? (
                <div className="space-y-4 animate-in fade-in">
                    <input type="password" value={localConfig.apiKey} onChange={(e) => handleChange('apiKey', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 outline-none font-mono" placeholder="AIza..." />
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700 text-zinc-400 text-xs leading-relaxed">
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2"><span>🚀</span> キーの取得</h4>
                        <ol className="list-decimal pl-4 space-y-2">
                            <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline font-bold">Google AI Studio</a>へアクセス。</li>
                            <li>"Create API key"をクリックしてキーを作成。</li>
                        </ol>
                    </div>
                </div>
             ) : (
                <button type="button" onClick={() => setExpandApiKey(true)} className="w-full text-left text-xs bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-400 flex justify-between items-center group">
                    <div className="flex flex-col">
                        <span className="text-zinc-300 font-bold">標準キーを使用中 (制限あり)</span>
                        <span className="text-[10px]">独自のキーを設定して制限を解除する</span>
                    </div>
                    <span className="text-[10px] bg-zinc-700 px-3 py-1 rounded-full group-hover:bg-zinc-600">設定する</span>
                </button>
             )}
           </div>

           {mode !== 'upgrade' && (
               <div className="space-y-4 pt-4 border-t border-zinc-800">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">あなたの名前</label>
                        <input type="text" required value={localConfig.userName} onChange={(e) => handleChange('userName', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 outline-none" placeholder="例: たかし" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">性別</label>
                        <select value={localConfig.userGender} onChange={(e) => handleChange('userGender', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 outline-none appearance-none">
                            <option value="指定なし">指定なし</option>
                            <option value="男性">男性</option>
                            <option value="女性">女性</option>
                        </select>
                    </div>
               </div>
           )}

           <div className="pt-2 flex gap-3">
              {mode !== 'initial' && onClose && saveStatus === 'idle' && (
                <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold text-sm">キャンセル</button>
              )}
              <button type="submit" disabled={!localConfig.userName || saveStatus !== 'idle'} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${saveStatus === 'saved' ? 'bg-green-600 text-white' : (mode === 'upgrade' ? 'bg-yellow-600 hover:bg-yellow-500 text-black' : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white')} disabled:opacity-80`}>
                {saveStatus === 'idle' ? (mode === 'initial' ? 'はじめる' : '保存') : '処理中...'}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetup;
