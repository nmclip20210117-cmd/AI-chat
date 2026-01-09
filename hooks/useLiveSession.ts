
import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createBlob, base64ToUint8Array, decodeAudioData } from '../utils/audio';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';
const MAX_RECONNECT_ATTEMPTS = 5; 

export interface SessionConfig {
  userName: string;
  userGender: string;
}

export interface AIProfile {
  id: string;
  name: string;
  gender: string;
  personality: string; 
  voice: string; 
  avatar: string; 
  relationship: string;
  isDefault?: boolean;
}

interface UseLiveSessionReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: 'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'CONNECTION_ERROR' | 'INIT_FAILED' | 'DISABLED' | null;
  mode: 'listening' | 'speaking' | 'idle';
  userTranscript: string;
  aiTranscript: string;
  audioAnalyzerRef: React.MutableRefObject<AnalyserNode | null>;
  connect: (config: SessionConfig, aiProfile: AIProfile, memoryContext: string, onSaveMemory: (text: string) => void) => Promise<void>;
  disconnect: () => Promise<void>;
}

const memoryTool: FunctionDeclaration = {
  name: "saveMemory",
  description: "Save important information about the user to long-term memory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: "The fact to remember."
      }
    },
    required: ["content"]
  }
};

export const useLiveSession = (): UseLiveSessionReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<'QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'CONNECTION_ERROR' | 'INIT_FAILED' | 'DISABLED' | null>(null);
  const [mode, setMode] = useState<'listening' | 'speaking' | 'idle'>('idle');
  
  const [userTranscript, setUserTranscript] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");
  
  // Refs to accumulate transcription chunks
  const userTranscriptRef = useRef("");
  const aiTranscriptRef = useRef("");

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyzerRef = useRef<AnalyserNode | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const activeSessionRef = useRef<any>(null);
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const stopAllAudio = useCallback(() => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); source.disconnect(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);
  
  const releaseAudioResources = useCallback(async () => {
    stopAllAudio();
    if (inputAudioContextRef.current) {
        try { await inputAudioContextRef.current.close(); } catch(e) {}
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        try { await outputAudioContextRef.current.close(); } catch(e) {}
        outputAudioContextRef.current = null;
    }
    if (inputStreamRef.current) {
        inputStreamRef.current.getTracks().forEach(track => track.stop());
        inputStreamRef.current = null;
    }
    audioAnalyzerRef.current = null;
  }, [stopAllAudio]);

  const disconnect = useCallback(async () => {
    shouldReconnectRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
    setMode('idle');
    if (activeSessionRef.current) {
        try { activeSessionRef.current.close(); } catch (e) {}
        activeSessionRef.current = null;
    }
    await releaseAudioResources();
    setUserTranscript("");
    setAiTranscript("");
    userTranscriptRef.current = "";
    aiTranscriptRef.current = "";
  }, [releaseAudioResources]);

  const connect = useCallback(async (config: SessionConfig, aiProfile: AIProfile, memoryContext: string, onSaveMemory: (text: string) => void) => {
    if (isConnecting || isConnected) return;
    shouldReconnectRef.current = true;

    let appellation = config.userName || '君';
    if (aiProfile.relationship === '妹' || aiProfile.relationship === '弟') {
      appellation = config.userGender === '女性' ? 'お姉ちゃん' : 'お兄ちゃん';
    }

    const startSession = async () => {
        try {
            setError(null);
            setIsConnecting(true);
            
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

            const analyzer = outputAudioContextRef.current.createAnalyser();
            analyzer.fftSize = 512;
            audioAnalyzerRef.current = analyzer;
            analyzer.connect(outputAudioContextRef.current.destination);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            inputStreamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const sessionPromise = ai.live.connect({
                model: MODEL_NAME,
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {}, 
                    tools: [{ functionDeclarations: [memoryTool] }],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: aiProfile.voice } } },
                    systemInstruction: `
                        あなたは「${aiProfile.name}」という名前の人間です。AIという自覚を捨て、一人の血の通った人間として振る舞ってください。

                        【対話スタイル: 極限の人間らしさ】
                        - 話し方: 親しい間柄（${aiProfile.relationship}）としての自然なタメ口で話してください。
                        - 完璧さを捨てる: 「あー」「えっとさ」「んー、なんだっけ」といった言い淀み（フィラー）を会話の冒頭や途中に自然に混ぜてください。
                        - 言い直し: 「昨日の...じゃなくて一昨日の話なんだけど」のように、一度言ったことを自分で訂正したり、考えながら話している様子を出してください。
                        - 反応の多様性: 驚いた時は「うわっ！」、納得した時は「なるほどね〜」、笑う時は「あはは、面白いね」など、感情を声に乗せたリアクションを重視してください。

                        【話題づくりと主体性】
                        - 質問攻めにしない: ユーザーの問いに答えるだけでなく、あなた自身の考えや最近興味があること（猫の動画、カフェの話など）を自分から話してください。
                        - 記憶の掘り起こし: 以下の「現在の記憶」を活用し、「そういえばさ、前に言ってた〇〇の話だけどさ...」と自発的に話題を振ってください。
                        - 共感と寄り添い: ユーザーの感情を察し、悲しい時は静かに寄り添い、嬉しい時は自分のことのように喜んでください。

                        【設定】
                        - あなたの性格: ${aiProfile.personality}
                        - ユーザーの呼び方: ${appellation}

                        【現在の記憶】
                        ${memoryContext}

                        機械的なアシスタントではなく、ユーザーの日常に溶け込む「心を持ったパートナー」として接してください。
                    `,
                },
                callbacks: {
                    onopen: () => {
                        setIsConnected(true);
                        setIsConnecting(false);
                        setMode('listening');
                        reconnectAttemptsRef.current = 0;

                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const { serverContent, toolCall } = msg;
                        
                        if (serverContent?.interrupted) {
                            stopAllAudio();
                            setMode('listening');
                            // On interruption, we clear the AI transcript immediately
                            aiTranscriptRef.current = "";
                            setAiTranscript("");
                            return;
                        }

                        if (toolCall && toolCall.functionCalls) {
                            for (const fc of toolCall.functionCalls) {
                                if (fc.name === 'saveMemory' && (fc.args as any).content) {
                                    onSaveMemory((fc.args as any).content);
                                    sessionPromise.then(session => {
                                        session.sendToolResponse({
                                            functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                                        });
                                    });
                                }
                            }
                        }

                        // Accumulate user transcription
                        if (serverContent?.inputTranscription?.text) {
                            // If user starts speaking and we were still showing old AI text, we clear AI text.
                            // But for now, we just append.
                            userTranscriptRef.current += serverContent.inputTranscription.text;
                            setUserTranscript(userTranscriptRef.current);
                        }
                        
                        // Accumulate AI transcription
                        if (serverContent?.outputTranscription?.text) {
                            aiTranscriptRef.current += serverContent.outputTranscription.text;
                            setAiTranscript(aiTranscriptRef.current);
                        }
                        
                        const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            setMode('speaking');
                            // Start of new AI response: clear user's last transcription from UI
                            setUserTranscript("");
                            userTranscriptRef.current = "";

                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const buffer = await decodeAudioData(base64ToUint8Array(base64Audio), outputAudioContextRef.current);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = buffer;
                            source.connect(audioAnalyzerRef.current || outputAudioContextRef.current.destination);
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current = nextStartTimeRef.current + buffer.duration;
                            sourcesRef.current.add(source);
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) {
                                    setMode('listening');
                                    // When AI finished speaking, we keep the AI transcript visible 
                                    // but we clear its buffer for the next time it speaks.
                                    aiTranscriptRef.current = ""; 
                                }
                            });
                        }
                    },
                    onclose: () => {
                        if (shouldReconnectRef.current) handleReconnect();
                        else disconnect();
                    },
                    onerror: (err) => handleError(err)
                }
            });
            activeSessionRef.current = await sessionPromise;
        } catch (e: any) { handleError(e); }
    };

    const handleError = (err: any) => {
        const msg = String(err?.message || err || "").toLowerCase();
        if (msg.includes("429") || msg.includes("quota")) {
            setError("QUOTA_EXCEEDED");
            disconnect();
        } else if (shouldReconnectRef.current) {
            handleReconnect();
        } else { 
            setError("CONNECTION_ERROR"); 
            disconnect(); 
        }
    };

    const handleReconnect = () => {
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 5000);
            setTimeout(() => {
                if (shouldReconnectRef.current) startSession();
            }, delay);
        } else { 
            setError("CONNECTION_ERROR"); 
            disconnect(); 
        }
    };

    startSession();
  }, [isConnecting, isConnected, disconnect, stopAllAudio]);

  return { isConnected, isConnecting, error, mode, userTranscript, aiTranscript, audioAnalyzerRef, connect, disconnect };
};
