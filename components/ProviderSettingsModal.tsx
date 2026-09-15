import React, { useState } from 'react';
import { ProviderId, AIProviderConfig } from '../types';
import { 
  PROVIDER_METADATA, 
  loadProviderConfig, 
  saveProviderConfig, 
  testProviderConnection 
} from '../services/providers';

interface ProviderSettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSave?: (config: AIProviderConfig) => void;
}

const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({ isOpen = true, onClose, onSave }) => {
  if (isOpen === false) return null;

  const [config, setConfig] = useState<AIProviderConfig>(() => loadProviderConfig());
  const [activeTab, setActiveTab] = useState<ProviderId>(config.activeProvider);
  
  // Current tab settings
  const currentMeta = PROVIDER_METADATA[activeTab];
  const currentSetting = config.providers[activeTab] || {
    apiKey: '',
    endpoint: currentMeta.defaultEndpoint,
    model: currentMeta.defaultModel,
  };

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Field change handlers
  const updateCurrentSetting = (field: 'apiKey' | 'endpoint' | 'model', value: string) => {
    setTestResult(null);
    setSavedSuccess(false);
    setConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [activeTab]: {
          ...prev.providers[activeTab],
          [field]: value,
        },
      },
    }));
  };

  const handleSetActiveProvider = (providerId: ProviderId) => {
    setSavedSuccess(false);
    setConfig((prev) => ({
      ...prev,
      activeProvider: providerId,
    }));
  };

  const handleResetEndpoint = () => {
    updateCurrentSetting('endpoint', currentMeta.defaultEndpoint);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testProviderConnection(
        activeTab,
        currentSetting.endpoint || currentMeta.defaultEndpoint,
        currentSetting.apiKey,
        currentSetting.model || currentMeta.defaultModel
      );
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `Unexpected error: ${e.message || 'Check network connection'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveProviderConfig(config);
    setSavedSuccess(true);
    if (onSave) {
      onSave(config);
    }
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const providerList = Object.values(PROVIDER_METADATA);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-trackit-panel border border-trackit-border rounded-2xl max-w-2xl w-full p-6 md:p-8 relative shadow-2xl max-h-[92vh] flex flex-col">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-5 right-5 text-trackit-muted hover:text-trackit-text p-2 rounded-lg hover:bg-trackit-dark transition-colors"
          title="Close modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl md:text-3xl">🤖</span>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-trackit-text">
                AI Providers & Endpoint Settings
              </h2>
              <p className="text-xs md:text-sm text-trackit-muted">
                Configure your model providers, API keys, and custom endpoints. Remembered automatically every session.
              </p>
            </div>
          </div>
        </div>

        {/* Provider Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide border-b border-trackit-border shrink-0">
          {providerList.map((p) => {
            const isTabActive = activeTab === p.id;
            const isCurrentlyActiveProvider = config.activeProvider === p.id;
            const hasCustomKey = Boolean(config.providers[p.id]?.apiKey?.trim());

            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveTab(p.id);
                  setTestResult(null);
                  setSavedSuccess(false);
                }}
                className={`px-3 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-all shrink-0 border ${
                  isTabActive
                    ? 'bg-trackit-dark border-trackit-accent text-trackit-accent shadow-sm'
                    : 'bg-trackit-panel border-transparent text-trackit-muted hover:text-trackit-text hover:bg-trackit-dark/40'
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.badge}</span>
                {isCurrentlyActiveProvider && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Active Provider" />
                )}
                {!isCurrentlyActiveProvider && hasCustomKey && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-70" title="Configured" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content - Scrollable Form */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          
          {/* Active Provider Indicator & Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-trackit-dark/50 border border-trackit-border">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currentMeta.icon}</span>
              <div>
                <h3 className="font-bold text-sm md:text-base text-trackit-text flex items-center gap-2">
                  {currentMeta.name}
                  {config.activeProvider === activeTab && (
                    <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 rounded-full font-bold">
                      ACTIVE PROVIDER
                    </span>
                  )}
                </h3>
                <p className="text-xs text-trackit-muted">{currentMeta.description}</p>
              </div>
            </div>

            {config.activeProvider !== activeTab ? (
              <button
                onClick={() => handleSetActiveProvider(activeTab)}
                className="px-3 py-1.5 bg-trackit-accent hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
              >
                Set as Active
              </button>
            ) : (
              <span className="text-xs font-semibold text-green-400 flex items-center gap-1 shrink-0">
                ✓ In Use
              </span>
            )}
          </div>

          {/* API Key Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs md:text-sm font-semibold text-trackit-text flex items-center gap-1.5">
                <span>🔑 API Key</span>
                {currentMeta.requiresKey ? (
                  <span className="text-[10px] text-amber-400 font-normal">(Required)</span>
                ) : (
                  <span className="text-[10px] text-trackit-muted font-normal">(Optional)</span>
                )}
              </label>

              {currentMeta.keyHelpUrl && (
                <a
                  href={currentMeta.keyHelpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-trackit-accent hover:underline flex items-center gap-1"
                >
                  Get API Key ↗
                </a>
              )}
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={currentSetting.apiKey}
                onChange={(e) => updateCurrentSetting('apiKey', e.target.value)}
                placeholder={currentMeta.placeholderKey}
                className="w-full px-3.5 py-2.5 bg-trackit-dark border border-trackit-border rounded-lg text-sm text-trackit-text placeholder-trackit-muted/50 focus:outline-none focus:border-trackit-accent font-mono pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-trackit-muted hover:text-trackit-text px-2 py-1 rounded bg-trackit-panel"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-trackit-muted mt-1">
              {activeTab === 'gemini' 
                ? 'Leave blank to use default application key, or enter your personal Google AI Studio key.' 
                : 'Stored securely in your local browser storage; remembered across all chat sessions.'}
            </p>
          </div>

          {/* Endpoint (Base URL) Field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs md:text-sm font-semibold text-trackit-text flex items-center gap-1.5">
                <span>🌐 API Endpoint (Base URL)</span>
              </label>
              
              {currentSetting.endpoint !== currentMeta.defaultEndpoint && (
                <button
                  type="button"
                  onClick={handleResetEndpoint}
                  className="text-xs text-trackit-accent hover:underline"
                >
                  Reset to default
                </button>
              )}
            </div>

            <input
              type="text"
              value={currentSetting.endpoint}
              onChange={(e) => updateCurrentSetting('endpoint', e.target.value)}
              placeholder={currentMeta.defaultEndpoint}
              className="w-full px-3.5 py-2.5 bg-trackit-dark border border-trackit-border rounded-lg text-sm text-trackit-text placeholder-trackit-muted/50 focus:outline-none focus:border-trackit-accent font-mono"
            />
            <p className="text-[11px] text-trackit-muted mt-1">
              Default: <code className="text-trackit-text font-mono text-[10px] bg-trackit-dark px-1 py-0.5 rounded">{currentMeta.defaultEndpoint}</code>. Custom proxies or local endpoints are remembered persistently.
            </p>
          </div>

          {/* Model Name Selection */}
          <div>
            <label className="block text-xs md:text-sm font-semibold text-trackit-text mb-1.5">
              <span>🧠 Model</span>
            </label>

            <div className="flex gap-1.5 flex-wrap mb-2">
              {currentMeta.suggestedModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateCurrentSetting('model', m)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors border ${
                    currentSetting.model === m
                      ? 'bg-trackit-accent text-white border-trackit-accent'
                      : 'bg-trackit-dark text-trackit-muted hover:text-trackit-text border-trackit-border'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={currentSetting.model}
              onChange={(e) => updateCurrentSetting('model', e.target.value)}
              placeholder={currentMeta.defaultModel}
              className="w-full px-3.5 py-2 bg-trackit-dark border border-trackit-border rounded-lg text-sm text-trackit-text placeholder-trackit-muted/50 focus:outline-none focus:border-trackit-accent font-mono"
            />
          </div>

          {/* Test Connection Output */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs md:text-sm flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-green-950/40 border-green-800 text-green-300'
                  : 'bg-red-950/40 border-red-800 text-red-300'
              }`}
            >
              <span className="text-base shrink-0">{testResult.success ? '✅' : '❌'}</span>
              <div className="flex-1 break-words">{testResult.message}</div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-xl border bg-green-950/40 border-green-800 text-green-300 text-xs md:text-sm flex items-center gap-2">
              <span>✅</span>
              <span>Settings saved! Active provider updated and remembered.</span>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="pt-4 mt-4 border-t border-trackit-border flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-trackit-dark border border-trackit-border hover:bg-trackit-dark/80 text-trackit-text rounded-lg text-xs md:text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? (
              <>
                <span className="animate-spin inline-block">⏳</span>
                <span>Testing...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Test Connection</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold text-trackit-muted hover:text-trackit-text hover:bg-trackit-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-trackit-accent hover:bg-blue-600 text-white rounded-lg text-xs md:text-sm font-bold transition-all shadow-md hover:shadow-blue-500/20"
            >
              Save & Remember
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProviderSettingsModal;
