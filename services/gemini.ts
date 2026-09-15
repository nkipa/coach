import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { Framework, Message, Mood, Attachment, ProviderId } from "../types";
import { SYSTEM_INSTRUCTION_BASE, MOOD_INSTRUCTIONS, FRAMEWORK_PROMPTS } from "../constants";
import { loadProviderConfig, PROVIDER_METADATA } from "./providers";

let chatInstance: Chat | null = null;

// Multi-provider state
interface GenericChatState {
  providerId: ProviderId;
  apiKey: string;
  endpoint: string;
  model: string;
  systemInstruction: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: any }>;
}

let genericChatState: GenericChatState | null = null;

// --- API KEY MANAGEMENT ---

const getApiKey = (): string | undefined => {
  // Check provider settings first
  const config = loadProviderConfig();
  if (config.providers.gemini?.apiKey) {
    return config.providers.gemini.apiKey;
  }

  // Check process.env first (Standard/System Preference)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.API_KEY) return process.env.API_KEY;
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  }
  
  // Check Vite specific env vars (Client-side fallback)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
       // @ts-ignore
       if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
       // @ts-ignore
       if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
       // @ts-ignore
       if (import.meta.env.GEMINI_API_KEY) return import.meta.env.GEMINI_API_KEY;
       // @ts-ignore
       if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    }
  } catch (e) {}

  return undefined;
};


// --- AUDIO PLAYER STATE MANAGEMENT ---
interface AudioPlayerState {
  audioCtx: AudioContext | null;
  sourceNode: AudioBufferSourceNode | null;
  audioBuffer: AudioBuffer | null;
  currentText: string | null;
  startTime: number;     // When the current playback segment started (context time)
  pausedAt: number;      // How much audio has already been played (seconds)
  isPaused: boolean;
  activeCallbacks: {
    onPlay?: () => void;
    onPause?: () => void;
    onEnd?: () => void;
  } | null;
}

const playerState: AudioPlayerState = {
  audioCtx: null,
  sourceNode: null,
  audioBuffer: null,
  currentText: null,
  startTime: 0,
  pausedAt: 0,
  isPaused: false,
  activeCallbacks: null
};

// --- COACHING LOGIC ---

export const initializeCoachingSession = (
  framework: Framework, 
  mood: Mood | null, 
  historyMessages: Message[] = [],
  userMemoryContext: string = ""
) => {
  const config = loadProviderConfig();
  const activeProvider = config.activeProvider;
  const providerMeta = PROVIDER_METADATA[activeProvider] || PROVIDER_METADATA.gemini;
  const setting = config.providers[activeProvider] || config.providers.gemini;

  // 1. Get Mood Instruction
  let behaviorInstruction = "";
  if (mood && MOOD_INSTRUCTIONS[mood.id]) {
      behaviorInstruction = MOOD_INSTRUCTIONS[mood.id];
  }

  // 2. Get Framework Specific Instruction
  let frameworkSpecificInstruction = FRAMEWORK_PROMPTS[framework.id] || "";

  // 3. Construct System Instruction
  const systemInstruction = `
    ${SYSTEM_INSTRUCTION_BASE}
    
    ${userMemoryContext ? `
    🧠 LONG-TERM MEMORY (CONTEXT FROM PAST SESSIONS):
    The following is a summary of past interactions with this user. Use this to personalize advice, reference past goals, and maintain continuity.
    ${userMemoryContext}
    ` : ''}

    CURRENT CONTEXT:
    - Persona: ${framework.persona}
    - Framework: ${framework.name}
    - Steps to follow: ${framework.steps.join(', ')}
    
    ${behaviorInstruction}

    ${frameworkSpecificInstruction}
    
    INSTRUCTIONS:
    1. Start immediately with the first step.
    2. Wait for user input before moving to the next step.
    3. If the user goes off-track, gently bring them back to the framework.
    4. At the end, summarize the session as a structured Action Plan.
    5. Be actionable, concise, and direct in your executive coaching.
  `;

  // Check if active provider is Gemini
  if (activeProvider === 'gemini') {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please set your key in AI Providers settings or .env file.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const history = historyMessages.map(msg => ({
        role: msg.role,
        parts: [
          { text: msg.text },
          ...(msg.attachments?.length ? [{ text: `[User attached ${msg.attachments.length} files]` }] : [])
        ]
      }));

      const modelName = setting.model || 'gemini-3.8-flash';

      chatInstance = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
        history: history
      });

      genericChatState = null;
      return chatInstance;
    } catch (error) {
      console.error("Failed to initialize Gemini coaching session:", error);
      chatInstance = null;
      throw error;
    }
  }

  // Non-Gemini Providers (OpenAI, OpenRouter, Groq, DeepSeek, Anthropic, Ollama, Custom)
  const endpoint = (setting.endpoint || providerMeta.defaultEndpoint).trim().replace(/\/+$/, '');
  const apiKey = setting.apiKey?.trim() || '';
  const model = (setting.model || providerMeta.defaultModel).trim();

  if (providerMeta.requiresKey && !apiKey) {
    throw new Error(`API Key is missing for ${providerMeta.name}. Please configure your API key in AI Providers settings.`);
  }

  // Initialize generic chat state
  genericChatState = {
    providerId: activeProvider,
    apiKey,
    endpoint,
    model,
    systemInstruction,
    messages: historyMessages.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.text
    }))
  };

  chatInstance = null;
  return genericChatState;
};

export const sendMessageToCoach = async (
  text: string, 
  attachments: Attachment[] = [],
  onStreamChunk: (text: string) => void
): Promise<string> => {
  if (!chatInstance && !genericChatState) {
    throw new Error("Coach not initialized. Please restart the session.");
  }

  let fullResponse = "";

  // 1. GEMINI SDK FLOW
  if (chatInstance) {
    try {
      const parts: any[] = [{ text: text }];

      if (attachments.length > 0) {
        attachments.forEach(att => {
          const base64Data = att.data.includes('base64,') 
            ? att.data.split('base64,')[1] 
            : att.data;

          const isInlineSupported = 
               att.mimeType.startsWith('image/') ||
               att.mimeType.startsWith('audio/') ||
               att.mimeType.startsWith('video/') ||
               att.mimeType === 'application/pdf';

          if (isInlineSupported) {
              parts.push({
                inlineData: {
                  mimeType: att.mimeType,
                  data: base64Data
                }
              });
          } else if (
              att.mimeType.startsWith('text/') || 
              att.mimeType === 'application/json' ||
              att.mimeType.includes('json') || 
              att.mimeType.includes('xml') ||
              att.mimeType.includes('csv') ||
              att.mimeType.includes('script')
          ) {
              try {
                  const binString = atob(base64Data);
                  const bytes = Uint8Array.from(binString, c => c.charCodeAt(0));
                  const textContent = new TextDecoder().decode(bytes);
                  parts.push({ 
                      text: `\n\n--- ATTACHED FILE: ${att.name} (${att.mimeType}) ---\n${textContent}\n--- END ATTACHMENT ---\n` 
                  });
              } catch (e) {
                  parts.push({ text: `\n[System: Failed to decode text file "${att.name}".]\n` });
              }
          } else {
              parts.push({ 
                  text: `\n[System: User attached file "${att.name}" (${att.mimeType}).]\n` 
              });
          }
        });
      }

      const responseStream = await chatInstance.sendMessageStream({ 
        message: parts.length > 1 ? parts : text 
      });

      let groundingMetadata: any = null;

      for await (const chunk of responseStream) {
        const chunkText = chunk.text; 
        if (chunkText) {
          fullResponse += chunkText;
          onStreamChunk(fullResponse);
        }
        
        if (chunk.candidates?.[0]?.groundingMetadata) {
            groundingMetadata = chunk.candidates[0].groundingMetadata;
        }
      }

      if (groundingMetadata?.groundingChunks) {
          const sources = groundingMetadata.groundingChunks
              .map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null)
              .filter((s: any) => s && s.uri);

          if (sources.length > 0) {
              const uniqueSources = Array.from(new Map(sources.map((s:any) => [s.uri, s])).values());
              let sourceText = "\n\n🔍 **Sources:**\n";
              uniqueSources.forEach((s: any) => {
                  sourceText += `- [${s.title || new URL(s.uri).hostname}](${s.uri})\n`;
              });
              fullResponse += sourceText;
              onStreamChunk(fullResponse);
          }
      }

      return fullResponse;

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      let errorMsg = " [Connection Error: Please check your internet or API Key.] ";
      if (JSON.stringify(error).includes("404")) {
          errorMsg = " [Error: Model not found or unavailable. Please try again later.] ";
      } else if (error.message) {
          errorMsg = ` [Error: ${error.message}] `;
      }
      
      if (fullResponse.length === 0) {
          throw error;
      } else {
          onStreamChunk(fullResponse + errorMsg);
          return fullResponse + errorMsg;
      }
    }
  }

  // 2. GENERIC MULTI-PROVIDER FLOW (OpenAI, OpenRouter, Groq, DeepSeek, Anthropic, Ollama, Custom)
  if (genericChatState) {
    const { providerId, apiKey, endpoint, model, systemInstruction, messages } = genericChatState;
    
    // Format message text and attachments
    let augmentedText = text;
    const imageParts: Array<{ type: 'image_url'; image_url: { url: string } }> = [];

    if (attachments.length > 0) {
      attachments.forEach((att) => {
        if (att.mimeType.startsWith('image/')) {
          imageParts.push({
            type: 'image_url',
            image_url: { url: att.data },
          });
        } else if (
          att.mimeType.startsWith('text/') ||
          att.mimeType.includes('json') ||
          att.mimeType.includes('csv')
        ) {
          try {
            const rawBase64 = att.data.includes('base64,') ? att.data.split('base64,')[1] : att.data;
            const decoded = atob(rawBase64);
            augmentedText += `\n\n[Attached File: ${att.name}]\n${decoded}\n[End Attachment]\n`;
          } catch (e) {}
        }
      });
    }

    // A. ANTHROPIC MESSAGES API
    if (providerId === 'anthropic') {
      try {
        const url = endpoint.endsWith('/messages') ? endpoint : `${endpoint}/messages`;
        
        let userContent: any = augmentedText;
        if (imageParts.length > 0) {
          userContent = [
            { type: 'text', text: augmentedText },
            ...imageParts.map(img => {
              const [header, base64] = img.image_url.url.split(';base64,');
              const mediaType = header.replace('data:', '') || 'image/jpeg';
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                }
              };
            })
          ];
        }

        const anthropicMessages = [
          ...messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
          { role: 'user', content: userContent }
        ];

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'dangerously-allow-browser': 'true',
          },
          body: JSON.stringify({
            model,
            system: systemInstruction,
            messages: anthropicMessages,
            max_tokens: 4096,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || response.statusText || `HTTP ${response.status}`;
          throw new Error(`Anthropic (${response.status}): ${errMsg}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Anthropic response body stream unavailable");

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  fullResponse += parsed.delta.text;
                  onStreamChunk(fullResponse);
                }
              } catch (e) {}
            }
          }
        }

        // Add to history
        genericChatState.messages.push({ role: 'user', content: augmentedText });
        genericChatState.messages.push({ role: 'assistant', content: fullResponse });
        return fullResponse;

      } catch (err: any) {
        console.error("Anthropic error:", err);
        throw err;
      }
    }

    // B. OPENAI-COMPATIBLE STREAMING (OpenAI, OpenRouter, Groq, DeepSeek, Ollama, Custom)
    try {
      const url = endpoint.endsWith('/chat/completions') 
        ? endpoint 
        : `${endpoint}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (providerId === 'openrouter') {
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'AGi Boss Zero II';
      }

      let userContent: any = augmentedText;
      if (imageParts.length > 0) {
        userContent = [
          { type: 'text', text: augmentedText },
          ...imageParts
        ];
      }

      const formattedMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userContent }
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          stream: true,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || errData.message || response.statusText || `HTTP ${response.status}`;
        throw new Error(`${PROVIDER_METADATA[providerId]?.name || 'Provider'} (${response.status}): ${errMsg}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming response unavailable");

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta;
              if (delta) {
                // If reasoning content exists (e.g. DeepSeek-R1 / O-models)
                const contentText = delta.content || '';
                if (contentText) {
                  fullResponse += contentText;
                  onStreamChunk(fullResponse);
                }
              }
            } catch (e) {}
          }
        }
      }

      // Add to conversation memory
      genericChatState.messages.push({ role: 'user', content: augmentedText });
      genericChatState.messages.push({ role: 'assistant', content: fullResponse });
      return fullResponse;

    } catch (err: any) {
      console.error("Multi-provider chat error:", err);
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error(`Failed to connect to ${endpoint}. Check endpoint URL and CORS settings.`);
      }
      throw err;
    }
  }

  return fullResponse;
};


export const generateSessionSummary = async (
  onStreamChunk: (text: string) => void
): Promise<string> => {
  const summaryPrompt = `
    Please provide a structured summary of our session so far.
    
    Use the following format clearly:
    
    📋 SESSION SUMMARY
    
    💡 KEY INSIGHTS
    • (List key realizations)
    
    ✅ DECISIONS MADE
    • (List agreements)
    
    📝 ACTION PLAN
    • (List actionable steps with implicit deadlines if discussed)
    
    🔮 NEXT STEPS
    • (What to focus on next session)
    
    Keep it professional, encouraging, and high-impact.
  `;
  
  return sendMessageToCoach(summaryPrompt, [], onStreamChunk);
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });
    
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
        resolve(base64);
      };
    });
    reader.readAsDataURL(audioBlob);
    const base64Data = await base64Promise;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          { 
              inlineData: { 
                  mimeType: audioBlob.type, 
                  data: base64Data 
              } 
          },
          { text: "Transcribe the spoken audio exactly into text. Do not add any conversational filler, intro, or outro." }
        ]
      }
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

// --- ADVANCED AUDIO CONTROLS ---

// Internal helper to get/create context
const getAudioContext = () => {
  if (!playerState.audioCtx) {
    playerState.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return playerState.audioCtx;
};

// Internal helper to play buffer from offset
const playBufferFromOffset = (offset: number) => {
  const ctx = getAudioContext();
  if (!playerState.audioBuffer) return;

  // Stop existing source if any
  if (playerState.sourceNode) {
    try { playerState.sourceNode.stop(); } catch(e) {}
    playerState.sourceNode = null;
  }

  // Create new source
  const source = ctx.createBufferSource();
  source.buffer = playerState.audioBuffer;
  source.connect(ctx.destination);

  // Start
  source.start(0, offset); // start(when, offset)
  
  playerState.sourceNode = source;
  playerState.startTime = ctx.currentTime;
  playerState.pausedAt = offset;
  playerState.isPaused = false;

  // Fire callback
  if (playerState.activeCallbacks?.onPlay) playerState.activeCallbacks.onPlay();

  // Handle End
  source.onended = () => {
    // Only fire onEnd if it wasn't a manual pause
    if (!playerState.isPaused && playerState.sourceNode === source) {
       // Reset state because it finished naturally
       playerState.pausedAt = 0;
       if (playerState.activeCallbacks?.onEnd) playerState.activeCallbacks.onEnd();
    }
  };
};

export const stopSpeech = () => {
  if (playerState.sourceNode) {
      try { playerState.sourceNode.stop(); } catch (e) {}
      playerState.sourceNode = null;
  }
  playerState.pausedAt = 0;
  playerState.isPaused = false;
  playerState.currentText = null;
  // Note: We don't clear audioBuffer here so we could restart if we wanted, 
  // but usually stop means "reset UI".
  if (playerState.activeCallbacks?.onEnd) playerState.activeCallbacks.onEnd();
};

export const pauseSpeech = () => {
  const ctx = getAudioContext();
  if (playerState.sourceNode && !playerState.isPaused) {
    // Calculate elapsed time since start
    const elapsed = ctx.currentTime - playerState.startTime;
    playerState.pausedAt += elapsed;
    playerState.isPaused = true;
    
    try { playerState.sourceNode.stop(); } catch(e) {}
    playerState.sourceNode = null;

    if (playerState.activeCallbacks?.onPause) playerState.activeCallbacks.onPause();
  }
};

export const resumeSpeech = () => {
  if (playerState.audioBuffer && playerState.isPaused) {
    // Resume from pausedAt
    playBufferFromOffset(playerState.pausedAt);
  }
};

export const restartSpeech = () => {
  if (playerState.audioBuffer) {
    playBufferFromOffset(0);
  }
};

export const playText = async (
    text: string, 
    callbacks: { onPlay?: () => void, onPause?: () => void, onEnd?: () => void }
) => {
  const ctx = getAudioContext();
  
  // Resume context if suspended
  if (ctx.state === 'suspended') await ctx.resume();

  // Check if we are playing the same text and it's paused
  if (playerState.currentText === text && playerState.isPaused && playerState.audioBuffer) {
     playerState.activeCallbacks = callbacks; // Update callbacks just in case
     resumeSpeech();
     return;
  }

  // If different text or not paused, we need to start over
  stopSpeech(); // Stop previous audio and trigger its cleanup
  playerState.currentText = text;
  playerState.activeCallbacks = callbacks;

  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: { parts: [{ text }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
        }
    });

    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) {
        // Error handling
        if (callbacks.onEnd) callbacks.onEnd();
        return;
    }

    // Decode
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for(let i=0; i<dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }

    playerState.audioBuffer = buffer;
    
    // Play from start
    playBufferFromOffset(0);

  } catch (error) {
    console.warn("Gemini TTS generation error, falling back to browser speech:", error);
    
    // Fallback to browser SpeechSynthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#_`>]/g, '').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        utterance.onstart = () => {
          if (callbacks.onPlay) callbacks.onPlay();
        };
        utterance.onend = () => {
          if (callbacks.onEnd) callbacks.onEnd();
        };
        utterance.onerror = () => {
          if (callbacks.onEnd) callbacks.onEnd();
        };
        
        window.speechSynthesis.speak(utterance);
        return;
      } catch (synthErr) {
        console.error("Browser speech synthesis failed", synthErr);
      }
    }

    if (callbacks.onEnd) callbacks.onEnd();
  }
};

// Deprecated wrapper for backward compatibility if needed, but we'll use playText in UI
export const generateAndPlaySpeech = async (text: string, onStart?: () => void, onEnd?: () => void) => {
    return playText(text, { onPlay: onStart, onEnd: onEnd });
};