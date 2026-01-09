import React, { useState } from 'react';
import { Memory } from '../hooks/useChatMemory';

interface MemoryManagerProps {
  memories: Memory[];
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onAdd: (content: string) => void;
}

const MemoryManager: React.FC<MemoryManagerProps> = ({ memories, onUpdate, onDelete, onAdd }) => {
  const [newMemory, setNewMemory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemory.trim()) {
      onAdd(newMemory.trim());
      setNewMemory('');
    }
  };

  const startEdit = (m: Memory) => {
    setEditingId(m.id);
    setEditContent(m.content);
  };

  const saveEdit = () => {
    if (editingId && editContent.trim()) {
      onUpdate(editingId, editContent.trim());
      setEditingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 px-2">
        <div className="p-1.5 bg-pink-500/10 rounded-lg text-pink-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10 2a.75.75 0 01.75.75v1.5H18a.75.75 0 01.75.75v5.5a.75.75 0 01-.75.75h-7.25v1.5h2.75a.75.75 0 010 1.5H6.5a.75.75 0 010-1.5h2.75v-1.5H2a.75.75 0 01-.75-.75V5a.75.75 0 01.75-.75h7.25v-1.5A.75.75 0 0110 2z" />
          </svg>
        </div>
        <h2 className="text-zinc-200 text-sm font-bold tracking-wider">会話トピック・記憶</h2>
      </div>

      <div className="flex-grow overflow-y-auto space-y-3 mb-4 pr-1 custom-scrollbar px-1">
        {memories.length === 0 && (
          <div className="text-zinc-600 text-xs text-center py-8 border-2 border-dashed border-zinc-800 rounded-lg">
            トピックはまだありません。<br/>会話から自動で追加されます。
          </div>
        )}
        {memories.map(m => (
          <div key={m.id} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50 hover:border-pink-500/30 transition-colors group">
            {editingId === m.id ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-pink-500"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className="text-xs text-zinc-400 hover:text-white">キャンセル</button>
                  <button onClick={saveEdit} className="text-xs text-pink-400 hover:text-pink-300 font-bold">保存</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-zinc-300 leading-relaxed break-words">{m.content}</p>
                <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(m)} className="text-zinc-500 hover:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                    </svg>
                  </button>
                  <button onClick={() => onDelete(m.id)} className="text-zinc-500 hover:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newMemory}
          onChange={(e) => setNewMemory(e.target.value)}
          placeholder="新しいトピックを追加..."
          className="flex-grow bg-zinc-950/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-pink-500 placeholder-zinc-600"
        />
        <button 
          type="submit" 
          disabled={!newMemory.trim()}
          className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg disabled:opacity-50 transition-colors border border-zinc-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default MemoryManager;