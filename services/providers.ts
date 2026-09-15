import { ProviderId, ProviderMetadata, ProviderSetting, AIProviderConfig } from '../types';

export const PROVIDER_METADATA: Record<ProviderId, ProviderMetadata> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Gemini',
    icon: '✨',
    defaultEndpoint: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-3.8-flash',
    suggestedModels: [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ],
    placeholderKey: 'AIzaSy...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Fast, high-context multimodal reasoning powered by Google DeepMind.',
    requiresKey: true,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    badge: 'OpenAI',
    icon: '🟢',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    suggestedModels: [
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo'
    ],
    placeholderKey: 'sk-proj-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    description: 'Flagship reasoning and instruction-following models from OpenAI.',
    requiresKey: true,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: 'OpenRouter',
    icon: '🟣',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    suggestedModels: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'google/gemini-2.5-flash'
    ],
    placeholderKey: 'sk-or-v1-...',
    keyHelpUrl: 'https://openrouter.ai/keys',
    description: 'Unified gateway to 100+ models from Anthropic, Meta, Mistral & more.',
    requiresKey: true,
  },
  groq: {
    id: 'groq',
    name: 'Groq (LPU Speed)',
    badge: 'Groq',
    icon: '⚡',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'deepseek-r1-distill-llama-70b',
      'mixtral-8x7b-32768'
    ],
    placeholderKey: 'gsk_...',
    keyHelpUrl: 'https://console.groq.com/keys',
    description: 'Ultra-low latency inference using Groq LPU technology.',
    requiresKey: true,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    badge: 'DeepSeek',
    icon: '🐋',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: [
      'deepseek-chat',
      'deepseek-reasoner'
    ],
    placeholderKey: 'sk-...',
    keyHelpUrl: 'https://platform.deepseek.com/api_keys',
    description: 'Powerful coding and general reasoning at ultra-efficient pricing.',
    requiresKey: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Claude',
    icon: '🟠',
    defaultEndpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    suggestedModels: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ],
    placeholderKey: 'sk-ant-api03-...',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Deep analytical and executive reasoning via Claude 3.5 series.',
    requiresKey: true,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local AI)',
    badge: 'Ollama',
    icon: '🦙',
    defaultEndpoint: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    suggestedModels: [
      'llama3.2',
      'llama3.1',
      'mistral',
      'deepseek-r1',
      'qwen2.5',
      'phi4'
    ],
    placeholderKey: 'No key needed for local Ollama',
    keyHelpUrl: 'https://ollama.com',
    description: 'Run local open-source models completely offline on your own machine.',
    requiresKey: false,
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    badge: 'Custom',
    icon: '⚙️',
    defaultEndpoint: 'http://localhost:8000/v1',
    defaultModel: 'custom-model',
    suggestedModels: [
      'custom-model',
      'default'
    ],
    placeholderKey: 'Optional API Key or Bearer Token',
    description: 'Connect any OpenAI-compatible proxy, vLLM, LM Studio, or private gateway.',
    requiresKey: false,
  },
};

export const PROVIDER_STORAGE_KEY = 'agi_boss_provider_config_v1';

// Initial default settings
export const createDefaultProviderConfig = (): AIProviderConfig => {
  const envGeminiKey = (typeof process !== 'undefined' && (process.env.GEMINI_API_KEY || process.env.API_KEY)) || '';
  
  const providers: Record<ProviderId, ProviderSetting> = {
    gemini: {
      apiKey: envGeminiKey,
      endpoint: PROVIDER_METADATA.gemini.defaultEndpoint,
      model: PROVIDER_METADATA.gemini.defaultModel,
    },
    openai: {
      apiKey: '',
      endpoint: PROVIDER_METADATA.openai.defaultEndpoint,
      model: PROVIDER_METADATA.openai.defaultModel,
    },
    openrouter: {
      apiKey: '',
      endpoint: PROVIDER_METADATA.openrouter.defaultEndpoint,
      model: PROVIDER_METADATA.openrouter.defaultModel,
    },
    groq: {
      apiKey: '',
      endpoint: PROVIDER_METADATA.groq.defaultEndpoint,
      model: PROVIDER_METADATA.groq.defaultModel,
    },
    deepseek: {
      apiKey: '',
      endpoint: PROVIDER_METADATA.deepseek.defaultEndpoint,
      model: PROVIDER_METADATA.deepseek.defaultModel,
    },
    anthropic: {
      apiKey: '',
      endpoint: PROVIDER_METADATA.anthropic.defaultEndpoint,
      model: PROVIDER_METADATA.anthropic.defaultModel,
    },
    ollama: {
      apiKey: 'ollama',
      endpoint: PROVIDER_METADATA.ollama.defaultEndpoint,
      model: PROVIDER_METADATA.ollama.defaultModel,
    },
    custom: {
      apiKey: '',
      endpoint: PROVIDER_METADATA.custom.defaultEndpoint,
      model: PROVIDER_METADATA.custom.defaultModel,
    },
  };

  return {
    activeProvider: 'gemini',
    providers,
  };
};

/**
 * Loads the active provider configuration from localStorage.
 * Guaranteed to remember API and Endpoint across all sessions.
 */
export const loadProviderConfig = (): AIProviderConfig => {
  const defaults = createDefaultProviderConfig();

  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    const activeProvider = (parsed.activeProvider in PROVIDER_METADATA) 
      ? (parsed.activeProvider as ProviderId) 
      : 'gemini';

    const mergedProviders = { ...defaults.providers };

    if (parsed.providers && typeof parsed.providers === 'object') {
      (Object.keys(defaults.providers) as ProviderId[]).forEach((pid) => {
        if (parsed.providers[pid]) {
          mergedProviders[pid] = {
            apiKey: parsed.providers[pid].apiKey ?? defaults.providers[pid].apiKey,
            endpoint: parsed.providers[pid].endpoint || defaults.providers[pid].endpoint,
            model: parsed.providers[pid].model || defaults.providers[pid].model,
          };
        }
      });
    }

    // If Gemini key is empty in storage but environment key is present, populate it
    if (!mergedProviders.gemini.apiKey && defaults.providers.gemini.apiKey) {
      mergedProviders.gemini.apiKey = defaults.providers.gemini.apiKey;
    }

    return {
      activeProvider,
      providers: mergedProviders,
    };
  } catch (e) {
    console.warn('Failed to parse provider config from storage, using defaults', e);
    return defaults;
  }
};

/**
 * Persists provider config to localStorage so it's remembered in every session.
 */
export const saveProviderConfig = (config: AIProviderConfig): void => {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save provider config to localStorage', e);
  }
};

/**
 * Get active provider setting and metadata in one call.
 */
export const getActiveProviderInfo = () => {
  const config = loadProviderConfig();
  const meta = PROVIDER_METADATA[config.activeProvider] || PROVIDER_METADATA.gemini;
  const setting = config.providers[config.activeProvider] || config.providers.gemini;
  return {
    config,
    providerId: config.activeProvider,
    meta,
    setting,
  };
};

/**
 * Tests connection with a quick ping to the specified provider endpoint.
 */
export const testProviderConnection = async (
  providerId: ProviderId,
  endpoint: string,
  apiKey: string,
  model: string
): Promise<{ success: boolean; message: string }> => {
  const cleanEndpoint = endpoint.trim().replace(/\/+$/, '');
  const cleanKey = apiKey.trim();
  const cleanModel = model.trim();

  if (PROVIDER_METADATA[providerId].requiresKey && !cleanKey) {
    return { success: false, message: 'Please provide an API Key for this provider.' };
  }

  try {
    // 1. ANTHROPIC TEST
    if (providerId === 'anthropic') {
      const url = cleanEndpoint.endsWith('/messages') ? cleanEndpoint : `${cleanEndpoint}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: cleanModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || response.statusText || `HTTP ${response.status}`;
        return { success: false, message: `Anthropic Error (${response.status}): ${errMsg}` };
      }

      return { success: true, message: `Connected to Anthropic (${cleanModel}) successfully!` };
    }

    // 2. GEMINI TEST
    if (providerId === 'gemini') {
      // Use standard Gemini REST generateContent ping
      const base = cleanEndpoint || 'https://generativelanguage.googleapis.com';
      const url = `${base}/v1beta/models/${cleanModel}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.error?.message || response.statusText || `HTTP ${response.status}`;
        return { success: false, message: `Gemini Error (${response.status}): ${errMsg}` };
      }

      return { success: true, message: `Connected to Gemini (${cleanModel}) successfully!` };
    }

    // 3. OPENAI-COMPATIBLE TEST (OpenAI, OpenRouter, Groq, DeepSeek, Ollama, Custom)
    const url = cleanEndpoint.endsWith('/chat/completions') 
      ? cleanEndpoint 
      : `${cleanEndpoint}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (cleanKey) {
      headers['Authorization'] = `Bearer ${cleanKey}`;
    }

    if (providerId === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'AGi Boss Zero II';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cleanModel,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errMsg = errJson.error?.message || errJson.message || response.statusText || `HTTP ${response.status}`;
      return { success: false, message: `${PROVIDER_METADATA[providerId].name} Error (${response.status}): ${errMsg}` };
    }

    return { 
      success: true, 
      message: `Connected to ${PROVIDER_METADATA[providerId].name} (${cleanModel}) successfully!` 
    };

  } catch (err: any) {
    console.error('Provider connection test error:', err);
    if (err.message && err.message.includes('Failed to fetch')) {
      return {
        success: false,
        message: 'Network / CORS error: Unable to reach endpoint. Verify URL and make sure CORS is enabled (or use an authorized proxy).',
      };
    }
    return {
      success: false,
      message: `Connection failed: ${err.message || 'Unknown network error'}`,
    };
  }
};
