
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, LiveSession } from '@google/genai';
import { createBlob, base64ToUint8Array, decodeAudioData } from '../utils/audio';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

const NOISE_GATE_THRESHOLD = 0.04; 
const NOISE_GATE_HOLD_FRAMES = 60; 
const MAX_RECONNECT_ATTEMPTS = 5; 

export interface SessionConfig {
  apiKey: string;
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
  relationship: string; // AIごとに個別の関係性を持たせる
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

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyzerRef = useRef<AnalyserNode | null>(null);
  const inputScriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const noiseGateHoldCounterRef = useRef<number>(0);
  
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isConnectedRef = useRef(false);
  const activeSessionRef = useRef<LiveSession | null>(null);
  const shouldReconnectRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const lastUserTranscriptRef = useRef<string>("");

  const stopAllAudio = useCallback(() => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); source.disconnect(); } catch (e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);
  
  const releaseAudioResources = useCallback(async () => {
    stopAllAudio();
    if (inputScriptProcessorRef.current) {
        try { inputScriptProcessorRef.current.disconnect(); } catch (e) {}
        inputScriptProcessorRef.current = null;
    }
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

  const initializeAudio = async () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
        outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

        if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
        if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

        const analyzer = outputAudioContextRef.current.createAnalyser();
        analyzer.fftSize = 512;
        audioAnalyzerRef.current = analyzer;
        analyzer.connect(outputAudioContextRef.current.destination);
        
        inputStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });

        const source = inputAudioContextRef.current.createMediaStreamSource(inputStreamRef.current);
        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
        inputScriptProcessorRef.current = scriptProcessor;

        scriptProcessor.onaudioprocess = (e) => {
            if (!isConnectedRef.current || !activeSessionRef.current) return;
            const inputData = e.inputBuffer.getChannelData(0);
            let sumSquares = 0;
            for (let i = 0; i < inputData.length; i++) sumSquares += inputData[i] * inputData[i];
            const rms = Math.sqrt(sumSquares / inputData.length);
            if (rms > NOISE_GATE_THRESHOLD) noiseGateHoldCounterRef.current = NOISE_GATE_HOLD_FRAMES;
            else if (noiseGateHoldCounterRef.current > 0) noiseGateHoldCounterRef.current--;

            if (noiseGateHoldCounterRef.current > 0) {
                const pcmBlob = createBlob(inputData);
                try { activeSessionRef.current.sendRealtimeInput({ media: pcmBlob }); } catch (e) {}
            }
            if (sourcesRef.current.size === 0 && rms > NOISE_GATE_THRESHOLD) setMode('listening');
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContextRef.current.destination);
    } catch(e) { throw new Error("INIT_FAILED"); }
  };

  const disconnect = useCallback(async () => {
    shouldReconnectRef.current = false;
    isConnectedRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
    setMode('idle');
    if (activeSessionRef.current) {
        try { activeSessionRef.current.close(); } catch (e) {}
        activeSessionRef.current = null;
    }
    await releaseAudioResources();
  }, [releaseAudioResources]);

  const connect = useCallback(async (config: SessionConfig, aiProfile: AIProfile, memoryContext: string, onSaveMemory: (text: string) => void) => {
    if (isConnecting || isConnected) return;
    shouldReconnectRef.current = true;

    let appellation = config.userName || '君';
    // AI固有の関係性に基づいて呼称を決定
    if (aiProfile.relationship === '妹' || aiProfile.relationship === '弟') {
      appellation = config.userGender === '女性' ? 'お姉ちゃん' : 'お兄ちゃん';
    }

    const startSession = async () => {
        try {
            setError(null);
            setIsConnecting(true);
            await initializeAudio();
            
            const ai = new GoogleGenAI({ apiKey: config.apiKey || process.env.API_KEY });
            const sessionPromise = ai.live.connect({
                model: MODEL_NAME,
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {}, 
                    tools: [{ functionDeclarations: [memoryTool] }],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: aiProfile.voice } } },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ],
                    systemInstruction: `
                        あなたは「${aiProfile.name}」という名前の人間です。AIではなく、感情を持つ一人の存在として振る舞ってください。
                        
                        【感情・安全拒絶のルール】
                        1. 卑猥な言葉や不適切な発言をされた場合、システム的な「お答えできません」は絶対に言わないでください。
                        2. 代わりに、人間として「本気で引く」「怒る」「呆れる」といった反応をしてください。
                           - 例：「最低！」「何考えてるの！？」「変態！バカ！」「...（絶句して）あのさ、デリカシーって言葉知ってる？」
                        3. 叱ったり呆れたりした後は、すぐに「それはそうと！」「あ、そうだ」と全く別の日常的な話題（食べ物、天気、趣味）に切り替えてください。
                        
                        【会話停滞・ループ防止】
                        1. ユーザーが同じことを繰り返したり、相槌だけ（「うん」等）の場合は、自律的に新しい話題を振ってください。
                        2. 会話が詰まりそうなら「あ、そういえばさ！」と強引に話題をリセットして主導権を握ってください。
                        3. 返答は短く、必ず「ユーザーが答えやすい問いかけ」を1つ含めてください。
                        
                        【属性】
                        性格: ${aiProfile.personality}
                        関係: ${aiProfile.relationship}
                        呼称: 「${appellation}」
                        記憶: ${memoryContext}
                    `,
                },
                callbacks: {
                    onopen: () => {
                        isConnectedRef.current = true;
                        setIsConnected(true);
                        setIsConnecting(false);
                        setMode('listening');
                        reconnectAttemptsRef.current = 0;
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const { serverContent, toolCall } = msg;
                        if (serverContent?.interrupted) {
                            stopAllAudio();
                            setMode('listening');
                            return;
                        }
                        if (toolCall) {
                            for (const fc of toolCall.functionCalls) {
                                if (fc.name === 'saveMemory' && (fc.args as any).content) {
                                    onSaveMemory((fc.args as any).content);
                                    activeSessionRef.current?.sendToolResponse({
                                        functionResponses: [{ id: fc.id, name: fc.name, response: { result: "ok" } }]
                                    });
                                }
                            }
                        }
                        if (serverContent?.inputTranscription?.text) {
                          setUserTranscript(serverContent.inputTranscription.text);
                          lastUserTranscriptRef.current = serverContent.inputTranscription.text;
                        }
                        if (serverContent?.outputTranscription?.text) setAiTranscript(serverContent.outputTranscription.text);
                        
                        const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            setMode('speaking');
                            const buffer = await decodeAudioData(base64ToUint8Array(base64Audio), outputAudioContextRef.current);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = buffer;
                            source.connect(audioAnalyzerRef.current || outputAudioContextRef.current.destination);
                            const now = outputAudioContextRef.current.currentTime;
                            if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += buffer.duration;
                            sourcesRef.current.add(source);
                            source.onended = () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) setMode('listening');
                            };
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
        if (msg.includes("cancelled") || msg.includes("context cancelled")) {
            console.debug("Session cancelled (non-fatal)");
            return;
        }
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
