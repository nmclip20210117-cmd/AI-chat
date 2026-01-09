
import React from 'react';

interface DonationModalProps {
  onClose: () => void;
}

const DonationModal: React.FC<DonationModalProps> = ({ onClose }) => {
  const DONATION_OPTIONS = [
    {
      id: 'ofuse',
      name: 'OFUSE (オフセ)',
      description: 'ファンレター付きで100円から気軽に支援できます。',
      icon: '💌',
      url: 'https://ofuse.me/muy0525',
      color: 'bg-gradient-to-r from-orange-400 to-pink-500 hover:brightness-110 text-white shadow-lg shadow-orange-900/20'
    }
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-4xl shadow-xl mx-auto mb-4 animate-bounce">💌</div>
            <h2 className="text-2xl font-black text-white tracking-tight">開発者を支援する</h2>
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
                KOKORO（心）は個人で開発・運営しています。<br/>
                温かいご支援が、AIの知能向上と<br/>サーバー維持の大きな助けになります。
            </p>
        </div>

        <div className="space-y-4">
            {DONATION_OPTIONS.map((option) => (
                <a 
                    key={option.id}
                    href={option.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                        block w-full p-6 rounded-2xl transition-all transform hover:scale-[1.03] active:scale-95 shadow-xl
                        flex items-center gap-5 text-left group border border-white/10
                        ${option.color}
                    `}
                >
                    <div className="text-3xl shrink-0 group-hover:rotate-12 transition-transform">{option.icon}</div>
                    <div className="flex-grow">
                        <div className="font-black text-lg flex items-center gap-2">
                            {option.name}
                            <span className="text-xs opacity-70">↗</span>
                        </div>
                        <div className="text-xs opacity-90 font-medium leading-tight mt-1">{option.description}</div>
                    </div>
                </a>
            ))}
        </div>

        <button 
            onClick={onClose}
            className="mt-8 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-4 rounded-2xl font-bold text-sm transition-all border border-zinc-700"
        >
            閉じる
        </button>
      </div>
    </div>
  );
};

export default DonationModal;
