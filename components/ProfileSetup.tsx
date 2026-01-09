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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);
  
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in"></div>
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        <div className="text-center mb-6 mt-2">
          <div className="inline-block p-3 rounded-full mb-3 bg-zinc-800">
             <span className="text-2xl">⚙️</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {mode === 'initial' ? 'プロフィール設定' : '設定を変更'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            あなたの名前や性別を設定しましょう。
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
           {serverError === "QUOTA_EXCEEDED" && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 p-3 rounded-lg text-xs text-yellow-200 flex gap-2 items-start">
                  <span>⚠️</span><span>API利用制限（1分あたりの上限）に達しました。しばらく待ってから再度お試しください。</span>
              </div>
           )}

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

           <div className="pt-2 flex gap-3">
              {mode !== 'initial' && onClose && saveStatus === 'idle' && (
                <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold text-sm">キャンセル</button>
              )}
              <button type="submit" disabled={!localConfig.userName || saveStatus !== 'idle'} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white'} disabled:opacity-80`}>
                {saveStatus === 'idle' ? (mode === 'initial' ? 'はじめる' : '保存') : '処理中...'}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetup;