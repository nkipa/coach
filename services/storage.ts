import { SyncConfig, SavedSession, VerificationResult } from '../types';
import * as airtable from './airtable';
import * as supabase from './supabase';

export const verifyConnection = async (config: SyncConfig): Promise<VerificationResult> => {
    if (config.type === 'supabase') {
        return supabase.verifySupabaseConnection(config);
    } else {
        return airtable.verifyAirtableConnection(config);
    }
};

export const fetchRemoteHistory = async (config: SyncConfig, userId: string): Promise<SavedSession[]> => {
    if (config.type === 'supabase') {
        return supabase.fetchSupabaseHistory(config, userId);
    } else {
        return airtable.fetchRemoteHistory(config, userId);
    }
};

export const saveRemoteSession = async (config: SyncConfig, userId: string, session: SavedSession) => {
    if (config.type === 'supabase') {
        return supabase.saveSupabaseSession(config, userId, session);
    } else {
        return airtable.saveRemoteSession(config, userId, session);
    }
};

export const deleteRemoteSession = async (config: SyncConfig, sessionId: string) => {
    if (config.type === 'supabase') {
        return supabase.deleteSupabaseSession(config, sessionId);
    } else {
        return airtable.deleteRemoteSession(config, sessionId);
    }
};