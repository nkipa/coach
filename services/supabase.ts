import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, SavedSession, VerificationResult } from '../types';

// Singleton instance to prevent "Multiple GoTrueClient instances" warning
let globalSupabaseClient: SupabaseClient | null = null;
let lastConfigKey: string | null = null;

const getClient = (config: SupabaseConfig) => {
  const currentKey = `${config.url}|${config.anonKey}`;
  
  // Reuse existing client if configuration hasn't changed
  if (globalSupabaseClient && lastConfigKey === currentKey) {
    return globalSupabaseClient;
  }

  // Create new client and update cache
  globalSupabaseClient = createClient(config.url, config.anonKey);
  lastConfigKey = currentKey;
  return globalSupabaseClient;
};

export const verifySupabaseConnection = async (config: SupabaseConfig): Promise<VerificationResult> => {
  try {
    const supabase = getClient(config);
    
    // WRITE CHECK: Try to insert a dummy record
    const TEST_SESSION_ID = 'VERIFY_CONNECTION_TEST';
    
    // Check if we can select first to verify table existence/read access
    const { error: readError } = await supabase.from(config.tableName).select('session_id').limit(1);
    if (readError) {
        if (readError.code === '42P01') return { success: false, message: `Table "${config.tableName}" does not exist.` };
        // 42501 = RLS
        if (readError.code === '42501') return { success: false, message: `Permission Denied (RLS). Check Supabase policies.` };
    }

    // Try clean up first in case previous test failed
    await supabase.from(config.tableName).delete().eq('session_id', TEST_SESSION_ID);

    // Try Insert
    const { error: writeError } = await supabase
      .from(config.tableName)
      .insert({
         user_id: 'VERIFY',
         session_id: TEST_SESSION_ID,
         content: { verify: true }
      });

    if (writeError) {
       return { success: false, message: `Write failed: ${writeError.message}` };
    }

    // CLEANUP
    await supabase.from(config.tableName).delete().eq('session_id', TEST_SESSION_ID);

    return { success: true };
  } catch (e: any) {
    return { success: false, message: e.message || "Connection failed" };
  }
};

export const fetchSupabaseHistory = async (config: SupabaseConfig, userId: string): Promise<SavedSession[]> => {
  try {
    const supabase = getClient(config);
    
    const { data, error } = await supabase
      .from(config.tableName)
      .select('content')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data) return [];

    return data.map((record: any) => {
      try {
        // Content is already JSON object in Supabase if column is jsonb, or string if text
        const content = typeof record.content === 'string' 
            ? JSON.parse(record.content) 
            : record.content;
            
        return { 
          ...content, 
          messages: content.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    console.error("Supabase fetch error", e);
    return [];
  }
};

export const saveSupabaseSession = async (config: SupabaseConfig, userId: string, session: SavedSession) => {
  try {
    const supabase = getClient(config);

    // Persist attachments by default
    const safeSession = session;

    // We strictly adhere to the schema: id, user_id, session_id, content
    // We do NOT send updated_at because it might not exist in the user's table
    const payload = {
        user_id: userId,
        session_id: safeSession.sessionId,
        content: safeSession
    };

    // Manual Upsert Logic to avoid unique constraint issues
    // 1. Check if exists
    const { data: existing } = await supabase
        .from(config.tableName)
        .select('id')
        .eq('session_id', safeSession.sessionId)
        .maybeSingle();

    if (existing) {
        // 2. Update
        const { error } = await supabase
            .from(config.tableName)
            .update(payload)
            .eq('session_id', safeSession.sessionId);
        
        if (error) {
             console.error("Supabase Update Error:", error.message, error.details || error);
        }
    } else {
        // 3. Insert
        const { error } = await supabase
            .from(config.tableName)
            .insert(payload);
        
        if (error) {
             console.error("Supabase Insert Error:", error.message, error.details || error);
        }
    }

  } catch (e) {
    console.error("Supabase save exception", e);
  }
};

export const deleteSupabaseSession = async (config: SupabaseConfig, sessionId: string) => {
  try {
    const supabase = getClient(config);
    
    const { error } = await supabase
        .from(config.tableName)
        .delete()
        .eq('session_id', sessionId);

    if (error) throw error;
  } catch (e) {
    console.error("Supabase delete error", e);
  }
};