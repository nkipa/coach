import React from 'react';
import { User } from '../types';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onNavigateToDashboard: () => void;
  onSync: () => void;
  onForceSync: () => void;
  onUpgrade: () => void;
  onOpenProviders?: () => void;
  activeProviderBadge?: string;
  isSessionActive?: boolean;
  onDeleteSession?: () => void;
  onShowHistory?: () => void;
  onImportSession?: () => void;
  onStartLiveVoice?: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  onNavigateToDashboard, 
  onSync, 
  onForceSync,
  onUpgrade, 
  onOpenProviders,
  activeProviderBadge,
  isSessionActive,
  onDeleteSession,
  onShowHistory,
  onImportSession,
  onStartLiveVoice
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Menu Panel */}
      <div className="relative w-64 h-full bg-trackit-panel border-l border-trackit-border shadow-2xl p-6 flex flex-col animate-slide-in-right">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-trackit-muted hover:text-trackit-text"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-8 mt-2">
          <h2 className="text-xl font-bold text-trackit-text">Menu</h2>
          {user && (
            <p className="text-sm text-trackit-muted truncate">{user.email}</p>
          )}
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => { onNavigateToDashboard(); onClose(); }}
            className="w-full text-left px-4 py-3 rounded-lg bg-trackit-dark/50 hover:bg-trackit-dark text-trackit-text hover:text-trackit-text transition-all flex items-center gap-3 font-medium"
          >
            <span className="text-xl">🏠</span> Dashboard
          </button>

          <button 
            onClick={() => { if(onShowHistory) onShowHistory(); onClose(); }}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-trackit-dark text-trackit-muted hover:text-trackit-text transition-all flex items-center gap-3 font-medium md:hidden"
          >
            <span className="text-xl">🗂️</span> Past Sessions
          </button>
          
          <div className="py-2 border-t border-b border-trackit-border my-2 space-y-1">
             {onOpenProviders && (
                <button 
                    onClick={() => { onOpenProviders(); onClose(); }}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-trackit-dark text-trackit-text transition-all flex items-center justify-between font-medium group"
                >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🤖</span>
                      <div>
                        <div>AI Providers</div>
                        <div className="text-[11px] text-trackit-muted group-hover:text-trackit-accent">API Keys & Endpoints</div>
                      </div>
                    </div>
                    {activeProviderBadge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-trackit-accent/20 text-trackit-accent font-mono font-bold">
                        {activeProviderBadge}
                      </span>
                    )}
                </button>
             )}
             {onImportSession && (
                <button 
                    onClick={() => { onImportSession(); onClose(); }}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-trackit-dark text-trackit-muted hover:text-trackit-text transition-all flex items-center gap-3 font-medium"
                >
                    <span className="text-xl">📥</span> Import Session
                </button>
             )}
            <button 
                onClick={() => { onSync(); onClose(); }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-trackit-dark text-trackit-muted hover:text-trackit-text transition-all flex items-center gap-3 font-medium"
            >
                <span className="text-xl">⚙️</span> Sync Settings
            </button>
            <button 
                onClick={() => { onForceSync(); onClose(); }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-green-900/30 text-green-400 hover:text-green-300 transition-all flex items-center gap-3 font-medium"
            >
                <span className="text-xl">🔄</span> Sync All Now
            </button>
          </div>
          
          {isSessionActive && onStartLiveVoice && (
            <button 
                onClick={() => { onClose(); onStartLiveVoice(); }}
                className="w-full text-left px-4 py-3 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-300 hover:text-red-100 border border-red-900/30 transition-all flex items-center gap-3 font-medium animate-pulse-slow"
            >
                <span className="text-xl">🎙️</span> Live Voice Mode
            </button>
          )}

          <button 
            disabled
            className="w-full text-left px-4 py-3 rounded-lg text-trackit-muted cursor-not-allowed flex items-center gap-3 font-medium mt-2"
          >
             <span className="text-xl grayscale opacity-50">👑</span> Upgrade Plan
          </button>

          {isSessionActive && onDeleteSession && (
             <button 
              onClick={() => { onClose(); onDeleteSession(); }}
              className="w-full text-left px-4 py-3 rounded-lg border border-red-900/30 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-all flex items-center gap-3 font-medium mt-4"
            >
              <span className="text-xl">🗑️</span> Delete Chat
            </button>
          )}
        </nav>
      </div>
    </div>
  );
};

export default SideMenu;