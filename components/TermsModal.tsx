import React from 'react';

interface TermsModalProps {
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95">
        <h2 className="text-xl font-bold text-white mb-4">利用規約</h2>
        <div className="flex-grow overflow-y-auto text-xs text-zinc-300 space-y-4 pr-2 custom-scrollbar border bg-zinc-950/50 border-zinc-800 rounded-lg p-4 leading-relaxed">
            <p><strong>第1条（はじめに）</strong><br/>
            本利用規約（以下「本規約」）は、Rina AI（以下「本サービス」）の利用条件を定めるものです。利用者の皆様には、本規約に従って本サービスをご利用いただきます。</p>
            
            <p><strong>第2条（APIキーの管理・料金）</strong><br/>
            1. 本サービスはGoogle Gemini APIを利用します。利用者は自身の責任においてAPIキーを取得・管理するものとします。<br/>
            2. 本サービスに入力されたAPIキーは、利用者のブラウザ内（ローカルストレージ）および利用者の個人データベース領域にのみ保存され、開発者が不正に利用することはありません。<br/>
            3. Google Gemini APIには無料利用枠が存在します。無料枠の範囲内であれば料金は発生しません。<br/>
            4. 利用者がGoogle Cloud Platformで有料アカウント設定を行わない限り、自動的に課金されることはありません。</p>

            <p><strong>第3条（禁止事項）</strong><br/>
            利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。<br/>
            1. 法令または公序良俗に違反する行為<br/>
            2. 犯罪行為に関連する行為<br/>
            3. AIに対して過度に暴力的、性的、差別的なコンテンツを生成させる行為</p>

            <p><strong>第4条（免責事項）</strong><br/>
            1. 本サービスのAIによる応答の正確性、完全性について保証するものではありません。<br/>
            2. 本サービス利用中に生じた、いかなる損害についても、開発者は一切の責任を負いません。</p>
            
            <p><strong>第5条（データの保存）</strong><br/>
            本サービスは、会話内容や設定をクラウド（Firebase）に保存しますが、これは利用者の利便性（履歴の復元など）のためであり、これらのデータを第三者に販売・提供することはありません。</p>
        </div>
        <button 
            onClick={onClose}
            className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition-colors"
        >
            閉じる
        </button>
      </div>
    </div>
  );
};

export default TermsModal;