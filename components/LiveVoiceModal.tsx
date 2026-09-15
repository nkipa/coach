import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Framework, Mood } from '../types';
import { SYSTEM_INSTRUCTION_BASE } from '../constants';

interface LiveVoiceModalProps {
  onClose: () => void;
  framework: Framework;
  mood: Mood | null;
}

const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({ onClose, framework, mood }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [volume, setVolume] = useState(0);
  
  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<Promise<any> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startSession = async () => {
      try {
        // Retrieve API Key safely for Vite/Browser environment
        let apiKey = '';
        try {
            // @ts-ignore
            if (typeof import.meta !== 'undefined' && import.meta.env) {
                // @ts-ignore
                apiKey = import.meta.env.VITE_API_KEY || import.meta.env.API_KEY || '';
            }
        } catch(e) {}
        
        if (!apiKey && typeof process !== 'undefined' && process.env) {
            apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
        }

        if (!apiKey) {
            console.error("API Key not found");
            setStatus('error');
            return;
        }

        const ai = new GoogleGenAI({ apiKey });
        
        // 1. Setup Audio Contexts
        // Input: 16kHz for Gemini
        const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        const inputCtx = new InputContextClass({ sampleRate: 16000 });
        inputContextRef.current = inputCtx;

        // Output: 24kHz for playback
        const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        const outputCtx = new OutputContextClass({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;
        
        // Resume contexts if suspended (browser autoplay policy)
        if (inputCtx.state === 'suspended') await inputCtx.resume();
        if (outputCtx.state === 'suspended') await outputCtx.resume();

        // 2. Get Microphone Stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 3. Prepare System Instruction
        let behaviorInstruction = "";
        if (mood) {
           behaviorInstruction = `USER MOOD: ${mood.label}. `;
           if (mood.id === 'high_energy') behaviorInstruction += "Be aggressive, fast, and push hard.";
           if (mood.id === 'neutral') behaviorInstruction += "Be clear, balanced, and steady.";
           if (mood.id === 'brain_fog') behaviorInstruction += "Speak simply. Short sentences. One idea at a time.";
           if (mood.id === 'burned_out') behaviorInstruction += "Be gentle, empathetic, and soothing.";
        }

        const systemInstruction = `
          ${SYSTEM_INSTRUCTION_BASE}
          You are in a VOICE-ONLY session. 
          Context: Framework "${framework.name}".
          ${behaviorInstruction}
          Keep responses relatively short and conversational, as this is a real-time voice chat.
        `;

        // 4. Connect to Gemini Live
        const sessionPromise = ai.live.connect({
          model: 'gemini-3.1-flash-live-preview',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: systemInstruction,
          },
          callbacks: {
            onopen: () => {
              if (isMounted) setStatus('connected');
              
              // Setup Input Processing once connected
              const source = inputCtx.createMediaStreamSource(stream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                
                // Send audio only when session is ready
                sessionPromise.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
                
                // Volume meter
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                if (isMounted) setVolume(Math.min(100, rms * 500)); 
              };

              source.connect(processor);
              processor.connect(inputCtx.destination);
              
              sourceRef.current = source;
              processorRef.current = processor;
            },
            onmessage: async (message: LiveServerMessage) => {
              // Handle Audio Output
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              
              if (base64Audio && outputCtx) {
                 try {
                    const pcmData = decodeBase64(base64Audio);
                    const audioBuffer = await createAudioBuffer(pcmData, outputCtx);
                    
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputCtx.destination);
                    
                    const currentTime = outputCtx.currentTime;
                    // Ensure we schedule after the current pointer or now, whichever is later
                    if (nextStartTimeRef.current < currentTime) {
                        nextStartTimeRef.current = currentTime;
                    }

                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    
                    audioSourcesRef.current.add(source);
                    source.onended = () => audioSourcesRef.current.delete(source);
                 } catch (e) {
                     console.error("Error decoding audio chunk", e);
                 }
              }

              // Handle Interruption
              if (message.serverContent?.interrupted) {
                 audioSourcesRef.current.forEach(src => {
                     try { src.stop(); } catch(e){}
                 });
                 audioSourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
              }
            },
            onclose: (e) => {
              if (isMounted) setStatus('closed');
            },
            onerror: (err) => {
              console.error("Gemini Live Error", err);
              if (isMounted) setStatus('error');
            }
          }
        });

        sessionRef.current = sessionPromise;

      } catch (err) {
        console.error("Setup failed", err);
        setStatus('error');
      }
    };

    startSession();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [framework, mood]);

  const cleanup = () => {
    // Stop Microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    // Stop Processing
    if (processorRef.current && inputContextRef.current) {
      processorRef.current.disconnect();
      sourceRef.current?.disconnect();
    }
    // Close Contexts
    inputContextRef.current?.close();
    audioContextRef.current?.close();
    
    // Stop Playing Audio
    audioSourcesRef.current.forEach(src => {
        try { src.stop(); } catch(e){}
    });
    audioSourcesRef.current.clear();

    // Close Session
    if (sessionRef.current) {
        sessionRef.current.then(session => {
            try { session.close(); } catch(e) { console.warn("Session close failed", e); }
        });
    }
  };

  // --- HELPERS ---

  const createPcmBlob = (data: Float32Array): { data: string, mimeType: string } => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      // Clamp and convert Float32 (-1.0 to 1.0) to Int16
      const s = Math.max(-1, Math.min(1, data[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert buffer to binary string then btoa
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return {
      data: btoa(binary),
      mimeType: 'audio/pcm;rate=16000'
    };
  };

  const decodeBase64 = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const createAudioBuffer = async (data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> => {
     // PCM Data is Int16, 24kHz (from model output)
     const sampleRate = 24000; 
     const numChannels = 1;
     const dataInt16 = new Int16Array(data.buffer);
     const frameCount = dataInt16.length;
     
     const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
     const channelData = buffer.getChannelData(0);
     
     for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
     }
     
     return buffer;
  };

  // --- RENDER ---

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
       {/* Background Pulse Effect */}
       <div 
         className="absolute rounded-full bg-trackit-accent/20 blur-3xl transition-all duration-100 ease-out"
         style={{ 
             width: `${200 + volume * 5}px`, 
             height: `${200 + volume * 5}px`,
             opacity: 0.3 + (volume / 100)
         }}
       />
       
       <div className="relative z-10 flex flex-col items-center gap-8">
           <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Live Coach</h2>
              <p className="text-slate-400 text-sm">{framework.name}</p>
           </div>

           {/* Visualizer Circle */}
           <div className="relative w-48 h-48 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border-2 ${status === 'connected' ? 'border-trackit-accent animate-pulse-slow' : 'border-red-500'}`}></div>
              <div className="text-4xl">
                 {status === 'connecting' && <span className="animate-pulse">⏳</span>}
                 {status === 'connected' && <span>🎙️</span>}
                 {status === 'error' && <span>⚠️</span>}
              </div>
           </div>

           <div className="h-8 text-center">
              {status === 'connecting' && <p className="text-slate-500 animate-pulse">Establishing secure line...</p>}
              {status === 'connected' && <p className="text-trackit-accent font-mono">LISTENING // SPEAKING</p>}
              {status === 'error' && <p className="text-red-400">Connection Failed. Check permissions.</p>}
           </div>

           <button 
             onClick={onClose}
             className="mt-8 px-8 py-4 bg-red-600/20 border border-red-600/50 text-red-100 rounded-full hover:bg-red-600 hover:text-white transition-all font-bold tracking-wider"
           >
             END CALL
           </button>
       </div>
    </div>
  );
};

export default LiveVoiceModal;