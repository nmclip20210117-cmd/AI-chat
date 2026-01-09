import React from 'react';

interface OnboardingModalProps {
  onClose: () => void;
  onOpenDonation: () => void;
  aiName: string;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose, onOpenDonation, aiName }) => {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-500"></div>
      
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="p-6 pb-2 text-center bg-gradient-to-b from-pink-900/20 to-zinc-900">
            <div className="text-4xl mb-2 animate-bounce">👋</div>
            <h2 className="text-xl font-bold text-white">Rina AIへようこそ！</h2>
            <p className="text-sm text-zinc-400 mt-1">
                {aiName}との生活をはじめるためのガイドです。
            </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-6 pt-2 space-y-6 custom-scrollbar">
            
            {/* Step 1: Voice */}
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                <h3 className="text-pink-300 font-bold mb-2 flex items-center gap-2">
                    <span>📞</span> 声で話しかける
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                    マイクをオンにして話しかけてみてください。まるで人間のように、感情豊かに返事をしてくれます。<br/>
                    <span className="text-zinc-500 mt-1 block">※ 会話の途中で遮っても大丈夫です。自然に反応します。</span>
                </p>
            </div>

            {/* Step 2: Memory */}
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
                <h3 className="text-blue-300 font-bold mb-2 flex items-center gap-2">
                    <span>🧠</span> 記憶を教える
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                    「私はコーヒーが好き」「誕生日は5月」など、あなたのことを話すとAIはそれを記憶します。<br/>
                    メニューの「記憶」から、AIが覚えていることを確認・編集できます。
                </p>
            </div>

            {/* Step 3: Donation Request */}
            <div className="bg-gradient-to-br from-yellow-900/30 to-zinc-800 p-4 rounded-xl border border-yellow-600/30 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-6xl opacity-10 grayscale">☕</div>
                <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                    <span>🎁</span> 開発者を応援してください
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                    このアプリは個人で開発・運営しています。<br/>
                    もし気に入っていただけたら、ご支援いただけるとサーバー代や今後の開発の励みになります！
                </p>
                <button 
                    onClick={onOpenDonation}
                    className="w-full py-2 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-200 border border-yellow-600/50 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                    <span>☕</span> 支援メニューを見る
                </button>
            </div>

        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900">
            <button 
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95"
            >
                はじめる
            </button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingModal;