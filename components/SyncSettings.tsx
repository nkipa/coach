import React, { useState } from 'react';
import { SyncConfig, AirtableConfig, SupabaseConfig } from '../types';
import { verifyConnection } from '../services/storage';

interface SyncSettingsProps {
  onClose: () => void;
  onSave: (config: SyncConfig) => void;
  initialConfig?: SyncConfig | null;
}

const SyncSettings: React.FC<SyncSettingsProps> = ({ onClose, onSave, initialConfig }) => {
  const [provider, setProvider] = useState<'airtable' | 'supabase'>(initialConfig?.type || 'airtable');
  
  // Airtable State
  const [apiKey, setApiKey] = useState(initialConfig?.type === 'airtable' ? initialConfig.apiKey : '');
  const [baseId, setBaseId] = useState(initialConfig?.type === 'airtable' ? initialConfig.baseId : '');
  const [atTableName, setAtTableName] = useState(initialConfig?.type === 'airtable' ? initialConfig.tableName : 'Sessions');
  
  // Supabase State
  const [sbUrl, setSbUrl] = useState(initialConfig?.type === 'supabase' ? initialConfig.url : '');
  const [sbKey, setSbKey] = useState(initialConfig?.type === 'supabase' ? initialConfig.anonKey : '');
  const [sbTableName, setSbTableName] = useState(initialConfig?.type === 'supabase' ? initialConfig.tableName : 'sessions');

  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<React.ReactNode>('');
  const [showRlsHelp, setShowRlsHelp] = useState(false);

  const handleTestAndSave = async () => {
    setStatus('testing');
    setErrorMessage('');
    setShowRlsHelp(false);
    
    let config: SyncConfig;

    if (provider === 'airtable') {
        config = { 
            type: 'airtable',
            apiKey: apiKey.trim(), 
            baseId: baseId.trim(), 
            tableName: atTableName.trim() 
        };
    } else {
        config = {
            type: 'supabase',
            url: sbUrl.trim(),
            anonKey: sbKey.trim(),
            tableName: sbTableName.trim()
        };
    }

    const result = await verifyConnection(config);
    
    if (result.success) {
      setStatus('success');
      setTimeout(() => {
        onSave(config);
        onClose();
      }, 1000);
    } else {
      setStatus('error');
      setErrorMessage(result.message || 'Connection failed.');
      
      // Detect RLS Error
      if (provider === 'supabase' && result.message && result.message.toLowerCase().includes('row-level security')) {
          setShowRlsHelp(true);
      }
    }
  };

  const copySqlToClipboard = () => {
    const sql = `create policy "Allow Public Access" on public.${sbTableName || 'sessions'} for all using (true) with check (true);`;
    navigator.clipboard.writeText(sql);
    alert("SQL copied to clipboard! Run this in your Supabase SQL Editor.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-trackit-panel border border-slate-700 rounded-2xl max-w-lg w-full p-8 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">✕</button>

        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          ☁️ Cloud Sync
        </h2>

        {/* Provider Toggle */}
        <div className="flex bg-slate-800 p-1 rounded-lg mb-6">
            <button 
                onClick={() => { setProvider('airtable'); setStatus('idle'); setShowRlsHelp(false); }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${provider === 'airtable' ? 'bg-trackit-panel text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
                Airtable
            </button>
            <button 
                onClick={() => { setProvider('supabase'); setStatus('idle'); setShowRlsHelp(false); }}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${provider === 'supabase' ? 'bg-green-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
                Supabase
            </button>
        </div>
        
        {provider === 'airtable' ? (
             <div className="space-y-4 animate-fade-in">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Personal Access Token</label>
                    <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="pat..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-trackit-accent focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Base ID</label>
                    <input 
                    type="text"
                    value={baseId}
                    onChange={(e) => setBaseId(e.target.value)}
                    placeholder="app..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-trackit-accent focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Table Name</label>
                    <input 
                    type="text"
                    value={atTableName}
                    onChange={(e) => setAtTableName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-trackit-accent focus:outline-none"
                    />
                </div>
             </div>
        ) : (
            <div className="space-y-4 animate-fade-in">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Project URL</label>
                    <input 
                    type="text"
                    value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)}
                    placeholder="https://xyz.supabase.co"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-green-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Anon Key</label>
                    <input 
                    type="password"
                    value={sbKey}
                    onChange={(e) => setSbKey(e.target.value)}
                    placeholder="ey..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-green-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Table Name</label>
                    <input 
                    type="text"
                    value={sbTableName}
                    onChange={(e) => setSbTableName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-green-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Requires table with columns: id, user_id, session_id, content (jsonb)</p>
                </div>
            </div>
        )}

        {status === 'error' && (
          <div className="mt-6 p-4 bg-red-950/40 border border-red-500/30 rounded-lg text-red-200 text-sm break-words leading-relaxed animate-fade-in">
            <strong>Connection Failed:</strong><br/>
            {errorMessage}
          </div>
        )}

        {showRlsHelp && (
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg animate-fade-in">
                <h4 className="text-blue-200 font-bold text-sm mb-2">Fix Row-Level Security (RLS)</h4>
                <p className="text-slate-400 text-xs mb-3">
                    Your database is blocking writes. Since this app manages its own users, you need to allow access for the Anon Key.
                </p>
                <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[10px] text-green-400 overflow-x-auto mb-3">
                    create policy "Allow Public Access" on public.{sbTableName || 'sessions'} for all using (true) with check (true);
                </div>
                <button 
                    onClick={copySqlToClipboard}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-medium transition-colors"
                >
                    Copy SQL & Run in Supabase
                </button>
            </div>
        )}

        {status === 'success' && (
          <div className="mt-4 p-3 bg-green-900/20 border border-green-500/50 rounded-lg text-green-400 text-xs flex items-center gap-2">
            <span>✅</span> Connection verified! Saving...
          </div>
        )}

        <button 
          onClick={handleTestAndSave}
          disabled={status === 'testing'}
          className={`w-full mt-6 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2 ${provider === 'supabase' ? 'bg-green-700 hover:bg-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
          {status === 'testing' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Verifying Connection...</span>
            </>
          ) : 'Connect & Sync'}
        </button>

      </div>
    </div>
  );
};

export default SyncSettings;