import React, { useState, useEffect } from 'react';
import { Message, Attachment } from '../types';
import { playText, pauseSpeech, resumeSpeech, restartSpeech, stopSpeech } from '../services/gemini';

interface ChatBubbleProps {
  message: Message;
  fontSize?: 'small' | 'large';
  onImageClick?: (attachment: Attachment) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, fontSize = 'small', onImageClick }) => {
  const isUser = message.role === 'user';
  const [isCopied, setIsCopied] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');

  // Define text size classes
  const textSizeClass = fontSize === 'large' 
    ? 'text-xl md:text-2xl leading-relaxed' 
    : 'text-sm md:text-base leading-relaxed';

  const codeSizeClass = fontSize === 'large' 
    ? 'text-base md:text-lg' 
    : 'text-xs md:text-sm';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // We don't globally stop speech on unmount of a single bubble to prevent clipping during scroll,
      // but the service handles single-source playback.
    };
  }, []);

  const handlePlay = async () => {
      if (playbackStatus === 'playing') {
          handlePause();
          return;
      }
      if (playbackStatus === 'paused') {
          resumeSpeech();
          setPlaybackStatus('playing');
          return;
      }

      setPlaybackStatus('loading');
      
      try {
          await playText(
              message.text,
              {
                  onPlay: () => setPlaybackStatus('playing'),
                  onPause: () => setPlaybackStatus('paused'),
                  onEnd: () => setPlaybackStatus('idle')
              }
          );
      } catch (e) {
          console.error(e);
          setPlaybackStatus('idle');
      }
  };

  const handlePause = () => {
      pauseSpeech();
      setPlaybackStatus('paused');
  };

  const handleRestart = () => {
      if (playbackStatus === 'idle') return;
      restartSpeech();
      setPlaybackStatus('playing');
  };

  const handleStop = () => {
      stopSpeech();
      setPlaybackStatus('idle');
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadCode = (code: string, language: string) => {
    const mimeType = language === 'json' ? 'application/json' : 'text/plain';
    const extension = language === 'json' ? 'json' : 'txt';
    const blob = new Blob([code], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `output-${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Helper to parse markdown links [text](url)
  const formatText = (text: string) => {
    // Split by markdown link regex
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            return (
                <a 
                    key={index}
                    href={linkMatch[2]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                >
                    {linkMatch[1]}
                </a>
            );
        }
        return part;
    });
  };

  // Helper to parse markdown code blocks
  const renderContent = (text: string) => {
    const parts = text.split(/```(\w+)?\n([\s\S]*?)```/g);
    
    if (parts.length === 1) return <div className={`whitespace-pre-wrap ${textSizeClass}`}>{formatText(text)}</div>;

    const elements: React.ReactNode[] = [];
    
    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 0) {
            if (parts[i]) {
                elements.push(
                    <div key={i} className={`whitespace-pre-wrap mb-2 ${textSizeClass}`}>
                        {formatText(parts[i])}
                    </div>
                );
            }
        } 
        else if (i % 3 === 1) {
            const lang = parts[i] || 'text';
            const code = parts[i + 1];
            
            elements.push(
                <div key={i} className="my-3 rounded-lg overflow-hidden border border-trackit-border bg-trackit-dark shadow-lg">
                    <div className="flex items-center justify-between px-3 py-2 bg-trackit-panel border-b border-trackit-border">
                        <span className="text-xs font-mono text-trackit-muted uppercase">{lang} Output</span>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => copyToClipboard(code)}
                                className="text-xs text-trackit-muted hover:text-trackit-text flex items-center gap-1 hover:bg-trackit-border px-2 py-1 rounded transition-colors"
                             >
                                📋 Copy
                             </button>
                             {lang === 'json' && (
                                <button 
                                    onClick={() => downloadCode(code, lang)}
                                    className="text-xs bg-trackit-accent text-white hover:bg-blue-600 flex items-center gap-1 px-2 py-1 rounded transition-colors font-bold shadow-sm"
                                >
                                    ⬇️ Download
                                </button>
                             )}
                        </div>
                    </div>
                    <div className="p-3 overflow-x-auto bg-[#0d1117] dark:bg-[#0d1117]">
                        <pre className={`${codeSizeClass} font-mono text-green-400 font-medium`}>
                            {code}
                        </pre>
                    </div>
                </div>
            );
            i++; 
        }
    }
    return elements;
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div 
        className={`max-w-[95%] md:max-w-[80%] rounded-2xl px-6 py-4 shadow-md ${
          isUser 
            ? 'bg-trackit-accent text-white rounded-br-none' 
            : 'bg-trackit-panel text-trackit-text border border-trackit-border rounded-bl-none'
        }`}
      >
        {/* Render Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {message.attachments.map((att, idx) => (
              <div key={idx} className="relative group">
                {att.mimeType.startsWith('image/') ? (
                  <img 
                    src={att.data} 
                    alt={att.name} 
                    onClick={() => onImageClick?.(att)}
                    className="max-w-full h-auto max-h-48 rounded-lg border border-white/20 cursor-pointer hover:opacity-90 transition-opacity" 
                  />
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
                    <span className="text-xl">📄</span>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold truncate max-w-[150px]">{att.name}</span>
                      <span className="text-[10px] opacity-70 uppercase">{att.mimeType.split('/')[1]}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="w-full overflow-hidden">
            {renderContent(message.text)}
        </div>

        <div className={`flex items-center justify-between mt-2 opacity-50 ${isUser ? 'text-blue-100' : 'text-trackit-muted'}`}>
          <span className="text-[10px]">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          
          {/* Action Icons for AI Messages */}
          {!isUser && (
              <div className="flex items-center gap-3">
                  <button onClick={handleCopyMessage} className="hover:text-trackit-text transition-colors flex items-center gap-1" title="Copy Message">
                      {isCopied ? (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-green-400">
                                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[10px] text-green-400">Copied</span>
                        </>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                           <path fillRule="evenodd" d="M10.5 3A1.501 1.501 0 009 4.5h6A1.501 1.501 0 0013.5 3h-3zm-2.693.178A3 3 0 0110.5 1.5h3a3 3 0 012.694 1.678c.497.042.992.092 1.486.15 1.495.173 2.57 1.46 2.57 2.929V19.5a3 3 0 01-3 3H6.75a3 3 0 01-3-3V6.257c0-1.47 1.075-2.756 2.57-2.93.493-.057.989-.107 1.487-.149z" clipRule="evenodd" />
                        </svg>
                      )}
                  </button>
                  
                  {/* Audio Controls */}
                  <div className="flex items-center gap-1 bg-trackit-dark/30 rounded-lg p-1 border border-transparent hover:border-trackit-border transition-all">
                      {playbackStatus === 'loading' ? (
                          <div className="w-4 h-4 m-1 border-2 border-trackit-muted border-t-trackit-text rounded-full animate-spin"></div>
                      ) : (
                          <>
                            {(playbackStatus === 'idle' || playbackStatus === 'paused') && (
                                <button 
                                    onClick={handlePlay} 
                                    className="p-1 hover:text-white hover:bg-trackit-accent rounded transition-colors text-trackit-muted" 
                                    title={playbackStatus === 'paused' ? "Resume" : "Read Aloud"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                                        <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                                    </svg>
                                </button>
                            )}

                            {playbackStatus === 'playing' && (
                                <button 
                                    onClick={handlePause} 
                                    className="p-1 hover:text-white hover:bg-trackit-accent rounded transition-colors text-trackit-muted" 
                                    title="Pause"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}

                            {(playbackStatus === 'playing' || playbackStatus === 'paused') && (
                                <>
                                    <button 
                                        onClick={handleRestart} 
                                        className="p-1 hover:text-white hover:bg-trackit-accent rounded transition-colors text-trackit-muted" 
                                        title="Restart"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                            <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button 
                                        onClick={handleStop} 
                                        className="p-1 hover:text-white hover:bg-red-500 rounded transition-colors text-trackit-muted" 
                                        title="Stop"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                        </svg>
                                    </button>
                                </>
                            )}
                          </>
                      )}
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;