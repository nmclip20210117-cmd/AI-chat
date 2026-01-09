import React from 'react';

interface DonationModalProps {
  onClose: () => void;
}

const DonationModal: React.FC<DonationModalProps> = ({ onClose }) => {
  // OFUSEのみ表示
  const DONATION_OPTIONS = [
    {
      id: 'ofuse',
      name: 'OFUSE (オフセ)',
      description: 'ファンレター付きで50円から気軽に支援できます。',
      icon: '💌',
      url: 'https://ofuse.me/muy0525',
      color: 'bg-gradient-to-r from-orange-400 to-pink-500 hover:brightness-110 text-white shadow-lg shadow-orange-900/20'
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        <div className="text-center mb-6">
            <span className="text-4xl mb-2 block animate-bounce">🙇</span>
            <h2 className="text-xl font-bold text-white">開発者を支援する</h2>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                本アプリは個人で開発・運営しています。<br/>
                もし気に入っていただけましたら、<br/>温かいご支援をいただけると励みになります！
            </p>
        </div>

        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
            {DONATION_OPTIONS.map((option) => (
                <a 
                    key={option.id}
                    href={option.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                        block w-full p-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-md
                        flex items-center gap-4 text-left group border border-transparent
                        ${option.color}
                    `}
                >
                    <div className="text-2xl shrink-0 group-hover:rotate-6 transition-transform">{option.icon}</div>
                    <div className="flex-grow">
                        <div className="font-bold text-sm flex items-center gap-2">
                            {option.name}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">↗</span>
                        </div>
                        <div className="text-[10px] opacity-90 leading-tight mt-0.5">{option.description}</div>
                    </div>
                </a>
            ))}
        </div>

        <button 
            onClick={onClose}
            className="mt-6 w-full bg-zinc-950 hover:bg-zinc-800 text-zinc-400 py-3 rounded-xl font-bold text-sm transition-colors border border-zinc-800"
        >
            閉じる
        </button>
      </div>
    </div>
  );
};

export default DonationModal;