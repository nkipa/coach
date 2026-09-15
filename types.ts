export enum PersonaType {
  BUSINESS = 'Business Architect',
  LIFE = 'Life Strategist',
  CAREER = 'Career Accelerator',
  STARTUP = 'Startup Founder',
  GENERAL = 'Strategic Partner',
  RESEARCH = 'Deep Research Analyst',
  PRODUCT = 'Product Visionary',
  CREATIVE = 'Creative Catalyst',
  ARCHITECT = 'System Architect',
  AUDITOR = 'System Auditor',
  ASSISTANT = 'AI Assistant'
}

export interface User {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'business';
  sessionsUsed: number; // New field to track usage
  customSessionLimit?: number; // Optional override for specific users
}

export interface Framework {
  id: string;
  name: string;
  description: string;
  steps: string[];
  persona: PersonaType;
  icon: string; // Emoji
}

export type MoodId = 'high_energy' | 'neutral' | 'brain_fog' | 'burned_out';

export interface Mood {
  id: MoodId;
  label: string;
  emoji: string;
  description: string;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
  attachments?: Attachment[];
}

export interface SessionState {
  sessionId: string; // Unique ID for persistence
  isActive: boolean;
  framework: Framework | null;
  mood: Mood | null;
  messages: Message[];
  isLoading: boolean;
  customTitle?: string; // Legacy support
  name?: string; // User-defined title for the session
}

export interface SavedSession {
  sessionId: string;
  framework: Framework;
  mood: Mood;
  messages: Message[];
  lastModified: number;
  preview: string;
  customTitle?: string; // Legacy support
  name?: string; // User-defined title for the session
  _airtableId?: string; // Internal ID for sync
  isStarred?: boolean; // New field
}

export interface AirtableConfig {
  type: 'airtable';
  apiKey: string;
  baseId: string;
  tableName: string;
}

export interface SupabaseConfig {
  type: 'supabase';
  url: string;
  anonKey: string;
  tableName: string;
}

export type SyncConfig = AirtableConfig | SupabaseConfig;

export interface VerificationResult {
  success: boolean;
  message?: string;
  missingFields?: boolean;
}

export type ProviderId = 
  | 'gemini' 
  | 'openai' 
  | 'openrouter' 
  | 'groq' 
  | 'deepseek' 
  | 'anthropic' 
  | 'ollama' 
  | 'custom';

export interface ProviderSetting {
  apiKey: string;
  endpoint: string;
  model: string;
}

export interface AIProviderConfig {
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderSetting>;
}

export interface ProviderMetadata {
  id: ProviderId;
  name: string;
  badge: string;
  icon: string;
  defaultEndpoint: string;
  defaultModel: string;
  suggestedModels: string[];
  placeholderKey: string;
  keyHelpUrl?: string;
  description: string;
  requiresKey: boolean;
}
