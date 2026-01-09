
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { SessionConfig, AIProfile } from '../hooks/useLiveSession';

interface TextChatProps {
  config: SessionConfig;
  aiProfile: AIProfile;
  memoryContext: string;
  onNewMemory: (text: string) => void;
  onOpenMemoryModal: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  groundingMetadata?: any; 
}

const TextChat: React.FC<TextChatProps> = ({ config, aiProfile, memoryContext, onNewMemory, onOpenMemoryModal }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = `rina_chat_history_${aiProfile.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) { console.error(e); }
    } else { setMessages([]); }
  }, [aiProfile.id]);

  useEffect(() => {
    const key = `rina_chat_history_${aiProfile.id}`;
    localStorage.setItem(key, JSON.stringify(messages));
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, aiProfile.id]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.debug("Location access denied", err),
        { timeout: 10000 }
      );
    }
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const now = new Date().toLocaleString('ja-JP', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      
      const systemPrompt = `
        あなたは「${aiProfile.name}」です。
        現在時刻: ${now}
        
        ユーザー情報: 名前=${config.userName}, 関係=${aiProfile.relationship}
        
        【性格・設定（重要）】
        ${aiProfile.personality}

        【ユーザーに関する記憶リスト】
        ${memoryContext}

        【指示】
        - 指定された性格になりきり、短くテンポよく返信してください。
        - 関係性（${aiProfile.relationship}）に相応しい口調・距離感を保ってください。
        - **Google Mapsの使用について**:
          - ユーザーから場所の提案を求められた時のみ、Google Mapsツールを使ってください。
        - **人間らしさ**: フィラー（えっと、んー等）を適宜混ぜてください。
        
        【記憶の保存】
        - ユーザーの重要な新しい情報を得たら、文末に「[MEMORY: 内容]」と出力してください。
      `;

      const history = messages.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.text }] }));

      const chatWithLocation = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemPrompt,
          tools: [{ googleMaps: {} }],
          toolConfig: location ? { retrievalConfig: { latLng: { latitude: location.lat, longitude: location.lng } } } : undefined
        },
        history: history
      });

      const result = await chatWithLocation.sendMessage({ message: userMsg });
      const responseText = result.text || "";
      const groundingMetadata = result.candidates?.[0]?.groundingMetadata;

      let cleanText = responseText;
      const memoryMatch = responseText.match(/\[MEMORY: (.*?)\]/);
      if (memoryMatch) {
        onNewMemory(memoryMatch[1]);
        cleanText = responseText.replace(/\[MEMORY: .*?\]/, '').trim();
      }

      setMessages(prev => [...prev, { role: 'model', text: cleanText, groundingMetadata }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', text: "ごめんね、電波が悪いかも..." }]);
    } finally { setIsLoading(false); }
  };

  const renderGroundingSource = (metadata: any) => {
    if (!metadata || !metadata.groundingChunks) return null;
    const mapChunks = metadata.groundingChunks.filter((c: any) => c.web?.uri || c.maps?.uri);
    if (mapChunks.length === 0) return null;
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">参考情報・地図</p>
        <div className="flex flex-wrap gap-2">
          {mapChunks.map((chunk: any, i: number) => {
            const uri = chunk.web?.uri || chunk.maps?.uri;
            const title = chunk.web?.title || chunk.maps?.title || "Google Maps";
            return (
              <a key={i} href={uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-pink-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors">
                <span>📍</span><span className="truncate max-w-[150px]">{title}</span>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAvatar = (gender: string) => (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 ${gender === 'Male' ? 'bg-blue-900/50 border-blue-500/50 text-blue-300' : 'bg-pink-900/50 border-pink-500/50 text-pink-300'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
        </svg>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center gap-4 bg-black/40">
         {renderAvatar(aiProfile.gender)}
         <div className="flex flex-col">
            <p className="text-base font-bold text-white">{aiProfile.name}</p>
            <p className="text-[10px] text-zinc-400">{aiProfile.relationship}</p>
         </div>
      </div>
      <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-zinc-800 text-white rounded-br-none' : 'bg-pink-900/40 text-pink-100 border border-pink-500/20 rounded-bl-none'}`}>
              {msg.text}
            </div>
            {msg.role === 'model' && msg.groundingMetadata && (
               <div className="max-w-[85%] w-full">{renderGroundingSource(msg.groundingMetadata)}</div>
            )}
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="bg-pink-900/20 px-4 py-2 rounded-2xl rounded-bl-none animate-pulse">...</div></div>}
      </div>
      <form onSubmit={handleSend} className="p-3 bg-black/40 border-t border-zinc-800 flex gap-2">
        <button type="button" onClick={onOpenMemoryModal} className="p-2 text-zinc-500 hover:text-pink-300 transition-colors bg-zinc-800/50 rounded-full">🧠</button>
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="メッセージを入力..." className="flex-grow bg-zinc-800 text-white text-sm rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-pink-500" />
        <button type="submit" disabled={!input.trim() || isLoading} className="bg-pink-600 text-white p-2 rounded-full disabled:opacity-50">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
        </button>
      </form>
    </div>
  );
};

export default TextChat;
