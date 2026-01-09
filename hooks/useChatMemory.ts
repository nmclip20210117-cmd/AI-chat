
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export interface Memory {
  id: string;
  content: string;
  timestamp: number;
}

const RINA_INIT_MEMORIES: Memory[] = [
  { id: 'rina-1', content: '莉奈は「カフェ巡り」が趣味。クリームソーダの色にこだわりがある。', timestamp: Date.now() },
  { id: 'rina-2', content: '莉奈は猫が大好きだが、ペット禁止なので動画を見るのが日課。', timestamp: Date.now() },
  { id: 'rina-3', content: '莉奈はフィルムカメラに興味がある。', timestamp: Date.now() },
  { id: 'rina-4', content: '莉奈は夜にLo-fi Hip Hopやシティポップを聴くのが好き。', timestamp: Date.now() },
  { id: 'rina-5', content: '莉奈の好きな食べ物はオムライス（ふわとろ派）。', timestamp: Date.now() },
];

const TAKUMI_INIT_MEMORIES: Memory[] = [
  { id: 'takumi-1', content: 'タクミはバイクいじりが趣味。休日はツーリングに行くことが多い。', timestamp: Date.now() },
  { id: 'takumi-2', content: 'タクミはコーヒーにうるさい。豆から挽いて淹れる派。', timestamp: Date.now() },
  { id: 'takumi-3', content: 'タクミは昔バンドでベースをやっていた。', timestamp: Date.now() },
];

export const useChatMemory = (targetAIId: string, isCloudSyncDisabled: boolean) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(isCloudSyncDisabled);

  useEffect(() => {
    if (isCloudSyncDisabled) setIsOfflineMode(true);
  }, [isCloudSyncDisabled]);

  const getLocalMemories = useCallback((uid: string | null, aiId: string): Memory[] => {
    const key = uid ? `rina_memories_${uid}_${aiId}` : `rina_memories_guest_${aiId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return []; }
    }
    if (aiId === 'rina-default') return RINA_INIT_MEMORIES;
    if (aiId === 'takumi-default') return TAKUMI_INIT_MEMORIES;
    return [];
  }, []);

  const saveLocalMemories = useCallback((uid: string | null, aiId: string, newMemories: Memory[]) => {
    const key = uid ? `rina_memories_${uid}_${aiId}` : `rina_memories_guest_${aiId}`;
    localStorage.setItem(key, JSON.stringify(newMemories));
    setMemories(newMemories);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setMemories(getLocalMemories(null, targetAIId));
    });
    return () => unsubscribe();
  }, [targetAIId, getLocalMemories]);

  useEffect(() => {
    setMemories([]); 
    if (!user || isOfflineMode) {
        setMemories(getLocalMemories(user?.uid || null, targetAIId));
        return;
    }

    const collectionPath = `users/${user.uid}/ais/${targetAIId}/memories`;
    let q;
    try {
        q = query(collection(db, collectionPath), orderBy('timestamp', 'asc'));
    } catch (e) {
        setIsOfflineMode(true);
        setMemories(getLocalMemories(user.uid, targetAIId));
        return;
    }
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedMemories: Memory[] = snapshot.docs.map(doc => ({
          id: doc.id,
          content: doc.data().content,
          timestamp: doc.data().timestamp
        }));
        setMemories(fetchedMemories);
        localStorage.setItem(`rina_memories_${user.uid}_${targetAIId}`, JSON.stringify(fetchedMemories));
      },
      (error) => {
        // Silently fail to offline mode for common project/permission errors
        if (error.code === 'permission-denied' || error.message.includes('disabled')) {
            console.debug("Firestore API disabled or permission denied, entering offline mode.");
            setIsOfflineMode(true);
            setMemories(getLocalMemories(user.uid, targetAIId));
        }
      }
    );

    return () => unsubscribe();
  }, [user, targetAIId, isOfflineMode, getLocalMemories]);

  const addMemory = useCallback(async (content: string) => {
    if (!content.trim()) return;
    const timestamp = Date.now();
    const tempId = `temp-${Date.now()}`;
    if (user && !isOfflineMode) {
      try {
        await addDoc(collection(db, `users/${user.uid}/ais/${targetAIId}/memories`), { content, timestamp });
      } catch (e) {
        setIsOfflineMode(true);
        const current = getLocalMemories(user.uid, targetAIId);
        saveLocalMemories(user.uid, targetAIId, [...current, { id: tempId, content, timestamp }]);
      }
    } else {
      const uid = user ? user.uid : null;
      const current = getLocalMemories(uid, targetAIId);
      saveLocalMemories(uid, targetAIId, [...current, { id: tempId, content, timestamp }]);
    }
  }, [user, isOfflineMode, targetAIId, getLocalMemories, saveLocalMemories]);

  const updateMemory = useCallback(async (id: string, content: string) => {
    if (user && !isOfflineMode) {
      try {
        await updateDoc(doc(db, `users/${user.uid}/ais/${targetAIId}/memories`, id), { content });
      } catch(e) {
        setIsOfflineMode(true);
        const current = getLocalMemories(user.uid, targetAIId);
        saveLocalMemories(user.uid, targetAIId, current.map(m => m.id === id ? { ...m, content } : m));
      }
    } else {
      const uid = user ? user.uid : null;
      const current = getLocalMemories(uid, targetAIId);
      saveLocalMemories(uid, targetAIId, current.map(m => m.id === id ? { ...m, content } : m));
    }
  }, [user, isOfflineMode, targetAIId, getLocalMemories, saveLocalMemories]);

  const deleteMemory = useCallback(async (id: string) => {
    if (user && !isOfflineMode) {
      try {
        await deleteDoc(doc(db, `users/${user.uid}/ais/${targetAIId}/memories`, id));
      } catch(e) { 
        setIsOfflineMode(true);
        const current = getLocalMemories(user.uid, targetAIId);
        saveLocalMemories(user.uid, targetAIId, current.filter(m => m.id !== id));
      }
    } else {
      const uid = user ? user.uid : null;
      const current = getLocalMemories(uid, targetAIId);
      saveLocalMemories(uid, targetAIId, current.filter(m => m.id !== id));
    }
  }, [user, isOfflineMode, targetAIId, getLocalMemories, saveLocalMemories]);

  const getMemoryContext = useCallback(() => {
    if (memories.length === 0) return "特になし";
    return memories.map(m => `- ${m.content}`).join('\n');
  }, [memories]);

  return { memories, addMemory, updateMemory, deleteMemory, getMemoryContext };
};
