
import React, { useState, useEffect } from 'react';
import { AIProfile } from '../hooks/useLiveSession';
import { GoogleGenAI, Type } from '@google/genai';

interface AIEditorProps {
  existingAI?: AIProfile;
  onSave: (ai: AIProfile) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

const VOICES = [
  // Fix: Replaced 'Aoede' with 'Zephyr' to match standard available voices.
  { id: 'Zephyr', label: 'Zephyr (女性/元気)', gender: 'Female' },
  { id: 'Kore', label: 'Kore (女性/穏やか)', gender: 'Female' },
  { id: 'Fenrir', label: 'Fenrir (男性/深い)', gender: 'Male' },
  { id: 'Charon', label: 'Charon (男性/威厳)', gender: 'Male' },
  { id: 'Puck', label: 'Puck (男性/遊び心)', gender: 'Male' },
];

const RELATIONSHIPS = ['友達', '親友', '恋人', '妹', '弟', '兄', '姉', '後輩', '先輩', '先生', '執事/メイド'];

const AIEditor: React.FC<AIEditorProps> = ({ existingAI, onSave, onClose, onDelete }) => {
  const [name, setName] = useState(existingAI?.name || '');
  const [gender, setGender] = useState(existingAI?.gender || 'Female');
  const [voice, setVoice] = useState(existingAI?.voice || 'Zephyr');
  const [relationship, setRelationship] = useState(existingAI?.relationship || '友達');
  const [personality, setPersonality] = useState(existingAI?.personality || '');

  // Generator States
  const [magicPrompt, setMagicPrompt] = useState('');
  const [isMagicGenerating, setIsMagicGenerating] = useState(false);

  // Default personality template if empty
  useEffect(() => {
    if (!personality && !existingAI) {
      setPersonality(
        `- 親しみやすく、少し甘え上手な20代女性。\n` +
        `- 常にタメ口（〜だよ、〜だね）。\n` +
        `- 趣味はカフェ巡りと映画鑑賞。`
      );
    }
  }, []);

  const handleMagicGenerate = async () => {
      if (!magicPrompt.trim()) return;
      setIsMagicGenerating(true);

      try {
        // Exclusively use process.env.API_KEY as per guidelines
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // Generate Profile Text (JSON)
        const profileResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Create a persona for a conversational AI based on this request: "${magicPrompt}".
                The output must be a valid JSON object.
                
                Available Voices:
                - Zephyr: Female, Energetic, High pitch
                - Kore: Female, Calm, Soothing
                - Fenrir: Male, Deep, Strong
                - Charon: Male, Dignified, Low
                - Puck: Male, Playful, Mischievous

                Determine the best Name, Gender, Voice ID (one of above), Relationship (one of: ${RELATIONSHIPS.join(', ')}), and a detailed Japanese System Instruction (Personality).
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        gender: { type: Type.STRING, enum: ["Female", "Male"] },
                        voice: { type: Type.STRING, enum: ["Zephyr", "Kore", "Fenrir", "Charon", "Puck"] },
                        relationship: { type: Type.STRING },
                        personality: { type: Type.STRING, description: "System instruction in Japanese" }
                    },
                    required: ["name", "gender", "voice", "relationship", "personality"]
                }
            }
        });

        const profileData = JSON.parse(profileResponse.text || "{}");
        
        if (profileData.name) setName(profileData.name);
        if (profileData.gender) setGender(profileData.gender);
        if (profileData.voice) setVoice(profileData.voice);
        if (profileData.relationship) setRelationship(profileData.relationship);
        if (profileData.personality) setPersonality(profileData.personality);

      } catch (e: any) {
          console.error("Magic Generation failed:", e);
          alert("自動生成に失敗しました。しばらく待ってから再度お試しください。");
      } finally {
          setIsMagicGenerating(false);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: existingAI?.id || `custom-${Date.now()}`,
      name,
      gender,
      voice,
      relationship,
      avatar: '', 
      personality,
      isDefault: existingAI?.isDefault
    });
  };

  const renderPreviewAvatar = () => {
     const isMale = gender === 'Male';
     return (
        <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-2 ${isMale ? 'bg-blue-900/50 border-blue-500/50 text-blue-300' : 'bg-pink-900/50 border-pink-500/50 text-pink-300'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
            </svg>
        </div>
     );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90dvh]">
        
        <div className="text-center mb-4 shrink-0">
          <h2 className="text-xl font-bold text-white">
            {existingAI ? (existingAI.isDefault ? `${existingAI.name}を編集` : 'AIを編集') : '新しいAIを作成'}
          </h2>
        </div>

        {!existingAI && (
            <div className="mb-6 bg-gradient-to-br from-pink-900/20 to-purple-900/20 border border-pink-500/30 rounded-xl p-4">
                <label className="text-[10px] text-pink-300 font-bold uppercase flex items-center gap-1 mb-2">
                    <span>✨ AI自動生成 (Magic Create)</span>
                </label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={magicPrompt}
                        onChange={(e) => setMagicPrompt(e.target.value)}
                        placeholder="例: ツンデレな幼馴染、落ち着いた執事..."
                        className="flex-grow bg-black/50 border border-pink-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleMagicGenerate()}
                    />
                    <button 
                        onClick={handleMagicGenerate}
                        disabled={isMagicGenerating || !magicPrompt.trim()}
                        className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50 whitespace-nowrap transition-colors"
                    >
                        {isMagicGenerating ? '生成中...' : '生成'}
                    </button>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-grow overflow-y-auto pr-2 custom-scrollbar">
          
          <div className="flex gap-4">
             <div className="flex flex-col gap-2 shrink-0 items-center">
                 <label className="text-[10px] text-zinc-500 font-bold uppercase">プレビュー</label>
                 {renderPreviewAvatar()}
             </div>
             
             <div className="flex-grow space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">名前</label>
                    <input 
                    type="text" 
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 outline-none"
                    placeholder="例: タクミ"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">関係性</label>
                        <select 
                        value={relationship}
                        onChange={e => setRelationship(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-pink-500 outline-none"
                        >
                            {RELATIONSHIPS.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">性別</label>
                        <select 
                        value={gender}
                        onChange={e => setGender(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-pink-500 outline-none"
                        >
                            <option value="Female">女性</option>
                            <option value="Male">男性</option>
                            <option value="Other">その他</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase">声</label>
                    <select 
                    value={voice}
                    onChange={e => setVoice(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-pink-500 outline-none"
                    >
                        {VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                    </select>
                </div>
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] text-zinc-500 font-bold uppercase flex justify-between">
                <span>性格・カスタム指示</span>
                <span className="text-pink-400">最重要</span>
             </label>
             <textarea 
               required
               value={personality}
               onChange={e => setPersonality(e.target.value)}
               className="w-full h-40 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-pink-500 outline-none leading-relaxed"
               placeholder="性格や話し方を入力..."
             />
          </div>

        </form>

        <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-3 shrink-0">
            <button onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-bold text-sm transition-colors">
                キャンセル
            </button>
            <button onClick={handleSubmit} className="flex-1 bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-lg">
                保存する
            </button>
        </div>
        
        {existingAI && onDelete && (
            <button onClick={() => onDelete(existingAI.id)} className="mt-2 text-xs text-red-500 hover:text-red-400 underline text-center">
                {existingAI.isDefault ? '設定を初期状態にリセットする' : 'このAIを削除する'}
            </button>
        )}
      </div>
    </div>
  );
};

export default AIEditor;
