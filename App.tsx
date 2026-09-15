import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Framework, Message, SessionState, Mood, SavedSession, User, SyncConfig, Attachment } from './types';
import { FRAMEWORKS, MOODS, APP_NAME } from './constants';
import FrameworkCard from './components/FrameworkCard';
import ChatBubble from './components/ChatBubble';
import TypingIndicator from './components/TypingIndicator';
import PricingModal from './components/PricingModal';
import SyncSettings from './components/SyncSettings';
import SideMenu from './components/SideMenu';
import LiveVoiceModal from './components/LiveVoiceModal';
import EditableTitle from './components/EditableTitle';
import FrameworkInfoModal from './components/FrameworkInfoModal';
import ProviderSettingsModal from './components/ProviderSettingsModal';
import { initializeCoachingSession, sendMessageToCoach, generateSessionSummary, transcribeAudio } from './services/gemini';
import { fetchRemoteHistory, saveRemoteSession, deleteRemoteSession } from './services/storage';
import { exportSession, ExportFormat } from './services/export';
import { loadProviderConfig, PROVIDER_METADATA } from './services/providers';
import { AIProviderConfig } from './types';

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to safely save to localStorage with quota handling
const safeSaveToStorage = (key: string, data: any) => {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn(`[Storage] Quota exceeded for ${key}. Attempting to compress...`);
      try {
        // Strategy: Create a shallow copy and strip large attachment data
        const cleanData = JSON.parse(JSON.stringify(data));
        
        const stripAttachments = (messages: any[]) => {
            return messages.map(m => {
                if (m.attachments && m.attachments.length > 0) {
                    return {
                        ...m,
                        attachments: m.attachments.map((a: any) => ({
                            ...a,
                            data: '' // Remove base64 data to save space
                        }))
                    };
                }
                return m;
            });
        };

        if (Array.isArray(cleanData)) {
            // It's the History Array
            cleanData.forEach((session: any) => {
                if (session.messages) session.messages = stripAttachments(session.messages);
            });
        } else if (cleanData.messages) {
            // It's a Session Object
            cleanData.messages = stripAttachments(cleanData.messages);
        }

        // Try saving the stripped version
        localStorage.setItem(key, JSON.stringify(cleanData));
        console.log(`[Storage] Successfully saved compressed version for ${key}`);
      } catch (retryError) {
        console.error(`[Storage] Failed to save even after compression for ${key}`, retryError);
        // We catch this so the app doesn't crash, but data isn't saved locally.
      }
    } else {
        console.error(`[Storage] Unexpected error saving ${key}`, e);
    }
  }
};

const App: React.FC = () => {
  // --- THEME STATE ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('dutrakit_theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('dutrakit_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- FONT SIZE STATE ---
  const [fontSize, setFontSize] = useState<'small' | 'large'>(() => {
    return (localStorage.getItem('dutrakit_fontsize') as 'small' | 'large') || 'small';
  });

  useEffect(() => {
    localStorage.setItem('dutrakit_fontsize', fontSize);
  }, [fontSize]);

  const toggleFontSize = () => {
    setFontSize(prev => prev === 'small' ? 'large' : 'small');
  };

  // --- USER STATE ---
  const [user, setUser] = useState<User>(() => {
    try {
      const savedUser = localStorage.getItem('dutrakit_user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (e) {
      console.error("Failed to parse user data from storage", e);
    }
    
    const guestUser: User = {
      id: 'guest_' + Math.random().toString(36).substring(2, 9),
      email: 'guest@executor',
      name: 'Guest Executor',
      plan: 'free',
      sessionsUsed: 0
    };
    safeSaveToStorage('dutrakit_user', guestUser);
    return guestUser;
  });

  const HISTORY_KEY = user ? `dutrakit_history_${user.id}` : 'dutrakit_history_guest';
  const CURRENT_SESSION_KEY = user ? `dutrakit_session_${user.id}` : 'dutrakit_session_guest';
  const FRAMEWORK_ORDER_KEY = user ? `dutrakit_order_${user.id}` : 'dutrakit_order_guest';
  const DELETED_SESSION_IDS_KEY = user ? `dutrakit_deleted_${user.id}` : 'dutrakit_deleted_guest';
  const SYNC_CONFIG_KEY = `dutrakit_sync_config`;

  // --- APP STATE ---
  const [frameworks, setFrameworks] = useState<Framework[]>(FRAMEWORKS);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [history, setHistory] = useState<SavedSession[]>([]);
  const [showPricing, setShowPricing] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Rename State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  
  // Image Viewing State
  const [viewingImage, setViewingImage] = useState<Attachment | null>(null);
  
  // Sync State
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  
  // AI Provider State (Persistent API Key, Endpoint, Models)
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [providerConfig, setProviderConfig] = useState<AIProviderConfig>(() => loadProviderConfig());
  
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(() => {
    try {
      const saved = localStorage.getItem(SYNC_CONFIG_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && !parsed.type) {
          return { ...parsed, type: 'airtable' };
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse sync config", e);
      return null;
    }
  });
  const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'synced' | 'error'>('offline');

  // Live Voice State
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // File Drag State
  const [isDragging, setIsDragging] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [session, setSession] = useState<SessionState>(() => {
    return {
      sessionId: generateId(),
      isActive: false,
      framework: null,
      mood: null,
      messages: [],
      isLoading: false,
    };
  });

  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSummarized, setIsSummarized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Ref to hold current session for event listeners
  const sessionRef = useRef<SessionState>(session);

  // Update sessionRef whenever session state changes
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // --- AUTO-SAVE LOGIC ---
  useEffect(() => {
    // Save on browser close/refresh
    const handleBeforeUnload = () => {
        if (user && sessionRef.current) {
            safeSaveToStorage(CURRENT_SESSION_KEY, sessionRef.current);
        }
    };

    // Save every 60 seconds
    const autoSaveInterval = setInterval(() => {
        if (user && sessionRef.current) {
            safeSaveToStorage(CURRENT_SESSION_KEY, sessionRef.current);
        }
    }, 60000); 

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        clearInterval(autoSaveInterval);
    };
  }, [user, CURRENT_SESSION_KEY]);

  // --- HELPERS ---

  const resetSessionState = useCallback(() => {
    setSession({
      sessionId: generateId(),
      isActive: false,
      framework: null,
      mood: null,
      messages: [],
      isLoading: false,
      customTitle: undefined,
      name: undefined,
    });
    setAttachments([]);
    setIsSummarized(false);
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }, [CURRENT_SESSION_KEY]);

  const getMemoryContext = useCallback((excludeSessionId?: string) => {
    if (!history || history.length === 0) return "";
    
    // 1. Get Summary of last 5 sessions
    const relevantHistory = history
      .filter(h => h.sessionId !== excludeSessionId)
      .slice(0, 5); 
    
    if (relevantHistory.length === 0) return "";
    
    let contextString = relevantHistory.map(h => {
      const date = new Date(h.lastModified).toLocaleDateString();
      const title = h.name || h.customTitle || h.framework.name;
      return `[${date}] ${title}. Summary/Preview: "${h.preview}"`;
    }).join('\n');

    // 2. Scan for specific JSON Artifacts (Outputs) in the last session to inject directly
    // This allows "referencing in another framework" automatically.
    if (relevantHistory.length > 0) {
        const lastSession = relevantHistory[0]; // Most recent
        const lastPlanMessage = lastSession.messages
            .slice().reverse() // Search backwards
            .find(m => m.role === 'model' && m.text.includes('```json') && m.text.includes('"smart_goal"'));

        if (lastPlanMessage) {
            // Extract the JSON content roughly
            const jsonMatch = lastPlanMessage.text.match(/```json\n([\s\S]*?)```/);
            if (jsonMatch && jsonMatch[1]) {
                contextString += `\n\n📌 DETECTED RECENT OUTPUT (PLAN) FROM PREVIOUS SESSION:\n${jsonMatch[1]}\n(Use this plan if relevant to the current request.)`;
            }
        }
    }

    return contextString;
  }, [history]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startCoaching = async (framework: Framework, mood: Mood) => {
    const newSessionId = generateId();
    
    // Auto-generate title with Number and Date
    // Note: user.sessionsUsed was already incremented by incrementUsage() before calling this.
    // However, since state updates are async, 'user' here might still refer to the old state closure.
    // We safely calculate the count based on the (likely old) value + 1, which matches the new value.
    const count = (user?.sessionsUsed || 0) + 1;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sessionTitle = `${framework.name} #${count} - ${dateStr}`;

    setSession({
      sessionId: newSessionId,
      isActive: true,
      framework: framework,
      mood: mood,
      messages: [],
      isLoading: true,
      customTitle: sessionTitle,
      name: sessionTitle
    });
    setIsSummarized(false);

    setTimeout(async () => {
      try {
          const memory = getMemoryContext(newSessionId);
          // Initialize call will throw if API Key is missing
          initializeCoachingSession(framework, mood, [], memory);

          await sendMessageToCoach(
            "Start the coaching session now. Introduce yourself and ask the first question. Remember to adapt to my Mood state.",
            [], 
            (text) => {
              setSession(prev => {
                const msgs = [...prev.messages];
                if (msgs.length === 0) {
                  msgs.push({
                    id: generateId(),
                    role: 'model',
                    text: text,
                    timestamp: new Date()
                  });
                } else {
                  msgs[0].text = text;
                }
                return { ...prev, messages: msgs };
              });
            }
          );
          setSession(prev => ({ ...prev, isLoading: false }));
      } catch (error: any) {
        console.error("Failed to start session", error);
        
        let errorText = "Neural core timeout (API Error). Check your key and try again.";
        if (error.message) {
            errorText = `Error: ${error.message}`;
        }
        
        setSession(prev => ({ 
          ...prev, 
          isLoading: false, 
          messages: [...prev.messages, {
            id: generateId(),
            role: 'model',
            text: errorText,
            timestamp: new Date()
          }]
        }));
      }
    }, 100);
  };

  // --- IMPORT LOGIC ---

  const startWithContextFile = (file: File, fileData: string, mimeType: string) => {
    // 1. Default to Direct AI (General)
    const framework = frameworks.find(f => f.id === 'direct_ai') || frameworks[0];
    const mood = MOODS.find(m => m.id === 'neutral') || MOODS[0];

    const newSessionId = generateId();
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const title = `File: ${file.name} - ${dateStr}`;

    // 2. Prepare Data
    let prompt = `I have uploaded a file: "${file.name}". Please analyze it and help me.`;
    const attachmentsToSend: Attachment[] = [];

    if (mimeType === 'text/plain') {
      prompt = `Here is the content of the file "${file.name}":\n\n${fileData}\n\nPlease analyze this.`;
    } else {
      attachmentsToSend.push({
        id: generateId(),
        name: file.name,
        mimeType: mimeType,
        data: fileData
      });
    }

    // 3. Setup Session State
    setSession({
      sessionId: newSessionId,
      isActive: true,
      framework: framework,
      mood: mood,
      messages: [],
      isLoading: true,
      customTitle: title,
      name: title
    });
    setIsSummarized(false);
    setShowSideMenu(false);

    // 4. Trigger AI
    setTimeout(async () => {
      try {
         const memory = getMemoryContext(newSessionId);
         initializeCoachingSession(framework, mood, [], memory);

         // Add User Message for UI
         const userMsg: Message = {
            id: generateId(),
            role: 'user',
            text: mimeType === 'text/plain' ? `Uploaded text file: ${file.name}` : `Uploaded file: ${file.name}`,
            timestamp: new Date(),
            attachments: attachmentsToSend
         };

         setSession(prev => ({ ...prev, messages: [userMsg] }));

         // Add AI Placeholder
         const aiMsgId = generateId();
         setSession(prev => ({ ...prev, messages: [...prev.messages, { id: aiMsgId, role: 'model', text: '', timestamp: new Date() }] }));

         // Send
         await sendMessageToCoach(prompt, attachmentsToSend, (text) => {
            setSession(prev => ({
              ...prev,
              messages: prev.messages.map(msg => msg.id === aiMsgId ? { ...msg, text: text } : msg)
            }));
         });
         
         setSession(prev => ({ ...prev, isLoading: false }));

      } catch (error) {
        console.error("File analysis failed", error);
        setSession(prev => ({ 
           ...prev, 
           isLoading: false, 
           messages: [...prev.messages, { id: 'err', role: 'model', text: "Error analyzing file.", timestamp: new Date() }] 
        }));
      }
    }, 500);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importInputRef.current) importInputRef.current.value = '';
    const fileName = file.name.toLowerCase();
    
    // 1. JSON IMPORT
    if (fileName.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const fileContent = ev.target?.result as string;
                if (!fileContent || !fileContent.trim()) {
                    throw new Error("File is empty");
                }
                
                let json = JSON.parse(fileContent);
                
                // Flexible parsing: Handle nested content formats
                if (json.fields && json.fields.Content) {
                    const contentRaw = json.fields.Content;
                    json = typeof contentRaw === 'string' ? JSON.parse(contentRaw) : contentRaw;
                } else if (json.content && !json.messages) {
                    const contentRaw = json.content;
                    json = typeof contentRaw === 'string' ? JSON.parse(contentRaw) : contentRaw;
                }
                
                if (!json.sessionId || !json.messages) {
                    alert("Invalid session file format. Missing session data.");
                    return;
                }
                
                const restoredMessages = json.messages.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                const restoredSession: SessionState = {
                    ...json,
                    messages: restoredMessages,
                    isActive: true,
                    isLoading: false,
                    name: json.name || json.customTitle,
                    customTitle: json.customTitle || json.name
                };
                
                // Initialize context
                const memory = getMemoryContext(restoredSession.sessionId);
                if (restoredSession.framework && restoredSession.mood) {
                   // Wrap in try/catch to handle API Key Missing gracefully
                   try {
                       initializeCoachingSession(restoredSession.framework, restoredSession.mood, restoredMessages, memory);
                   } catch(initErr) {
                       console.warn("Could not initialize AI session during import (likely missing API key). Loaded in view-only mode.", initErr);
                   }
                }
                
                setSession(restoredSession);
                setShowSideMenu(false);
                alert("Session restored successfully.");
            } catch (err: any) {
                console.error("JSON Import Error:", err);
                alert(`Failed to load session file.\n\nError: ${err.message || "Invalid JSON format"}\n\nPlease check that you are uploading a valid session backup.`);
            }
        };
        reader.readAsText(file);
    } 
    // 2. TEXT IMPORT
    else if (fileName.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            // Basic detection if it's a report
            const frameworkMatch = text.match(/Framework:\s+(.*)/);
            const moodMatch = text.match(/Initial Mood:\s+(.*)/);
            const matchedFramework = frameworkMatch ? frameworks.find(f => f.name === frameworkMatch[1].trim()) : null;
            const matchedMood = moodMatch ? MOODS.find(m => m.label === moodMatch[1].trim()) : null;

            if (matchedFramework && matchedMood && (text.includes('YOU:') || text.includes('COACH:'))) {
                const lines = text.split('\n');
                const messages: Message[] = [];
                let currentMsg: Partial<Message> | null = null;
                lines.forEach(line => {
                    if (line.startsWith('YOU: ')) {
                        if (currentMsg) messages.push(currentMsg as Message);
                        currentMsg = { id: generateId(), role: 'user', text: line.replace('YOU: ', ''), timestamp: new Date() };
                    } else if (line.startsWith('COACH: ')) {
                        if (currentMsg) messages.push(currentMsg as Message);
                        currentMsg = { id: generateId(), role: 'model', text: line.replace('COACH: ', ''), timestamp: new Date() };
                    } else if (currentMsg && line.trim() !== '') {
                        currentMsg.text += '\n' + line;
                    }
                });
                if (currentMsg) messages.push(currentMsg as Message);
                const newSession: SessionState = {
                    sessionId: generateId(),
                    isActive: true,
                    framework: matchedFramework,
                    mood: matchedMood,
                    messages: messages,
                    isLoading: false,
                    customTitle: `Imported: ${matchedFramework.name}`,
                    name: `Imported: ${matchedFramework.name}`
                };
                
                try {
                    initializeCoachingSession(matchedFramework, matchedMood, messages, getMemoryContext());
                } catch(initErr) {
                    console.warn("Could not initialize AI session during import (likely missing API key). Loaded in view-only mode.", initErr);
                }
                
                setSession(newSession);
                setShowSideMenu(false);
                alert("Session reconstructed from Text Report.");
            } else {
                startWithContextFile(file, text, "text/plain");
            }
        };
        reader.readAsText(file);
    } 
    // 3. PDF IMPORT
    else if (fileName.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
             const base64Data = ev.target?.result as string;
             startWithContextFile(file, base64Data, "application/pdf");
        };
        reader.readAsDataURL(file);
    } else {
        alert("Unsupported file type. Please use .json, .txt, or .pdf");
    }
  };

  // --- INITIALIZATION ---

  useEffect(() => {
    const savedOrder = localStorage.getItem(FRAMEWORK_ORDER_KEY);
    if (savedOrder) {
      try {
        const orderedIds: string[] = JSON.parse(savedOrder);
        const orderedFrameworks = orderedIds
          .map(id => FRAMEWORKS.find(fw => fw.id === id))
          .filter((fw): fw is Framework => !!fw);
        const newFrameworks = FRAMEWORKS.filter(fw => !orderedIds.includes(fw.id));
        setFrameworks([...orderedFrameworks, ...newFrameworks]);
      } catch (e) {
        setFrameworks(FRAMEWORKS);
      }
    } else {
      setFrameworks(FRAMEWORKS);
    }

    if (!user) return;
    const loadAppData = async () => {
      let localHistory: SavedSession[] = [];
      const deletedIds = JSON.parse(localStorage.getItem(DELETED_SESSION_IDS_KEY) || '[]');
      
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          localHistory = parsed.map((item: any) => ({
            ...item,
            messages: item.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }))
          })).filter((h: any) => !deletedIds.includes(h.sessionId));
        } catch (e) { console.error("Corrupt history data", e); }
      }
      
      if (syncConfig) {
        setSyncStatus('syncing');
        try {
          const remoteHistory = await fetchRemoteHistory(syncConfig, user.id);
          const sessionMap = new Map<string, SavedSession>();
          [...localHistory, ...remoteHistory].forEach(s => {
            if (deletedIds.includes(s.sessionId)) return; 
            const existing = sessionMap.get(s.sessionId);
            if (!existing || s.lastModified > existing.lastModified) {
              sessionMap.set(s.sessionId, s);
            }
          });
          localHistory = Array.from(sessionMap.values());
          setSyncStatus('synced');
        } catch (e) { 
          console.error(e); 
          setSyncStatus('error');
        }
      } else {
        setSyncStatus('offline');
      }

      localHistory.sort((a, b) => b.lastModified - a.lastModified);
      setHistory(localHistory);
      // Use safe save for history updates during load
      safeSaveToStorage(HISTORY_KEY, localHistory);

      const savedSession = localStorage.getItem(CURRENT_SESSION_KEY);
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if (parsed.messages) {
            parsed.messages = parsed.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp)
            }));
          }
          setSession(parsed);
          if (parsed.messages?.length > 0) {
             const lastMsg = parsed.messages[parsed.messages.length - 1];
             if (lastMsg.text.includes("SESSION SUMMARY")) setIsSummarized(true);
          }
        } catch (e) { 
            console.error("Corrupt session data", e);
            resetSessionState(); 
        }
      }
      setIsLoaded(true);
    };
    loadAppData();
  }, [user?.id, HISTORY_KEY, CURRENT_SESSION_KEY, syncConfig, FRAMEWORK_ORDER_KEY, DELETED_SESSION_IDS_KEY]);

  useEffect(() => {
    if (user && isLoaded) {
      safeSaveToStorage(CURRENT_SESSION_KEY, session);
    }
  }, [session, user, CURRENT_SESSION_KEY, isLoaded]);

  useEffect(() => {
    if (session.isActive && session.framework && session.mood && user && isLoaded) {
      updateHistoryEntry();
    }
  }, [session.messages.length, session.isLoading, session.mood, syncConfig, session.customTitle, session.name]); 

  useEffect(() => { scrollToBottom(); }, [session.messages, session.isLoading]);

  useEffect(() => {
    if (isLoaded && session.isActive && session.framework) {
       const memory = getMemoryContext(session.sessionId);
       try {
           initializeCoachingSession(session.framework, session.mood, session.messages, memory);
       } catch(e) {
           console.error("Auto-initialization error:", e);
           // We suppress this error so it doesn't crash the whole app.
           // The user will see a specific error when they try to chat.
       }
    }
  }, [isLoaded]); 

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
    if (dragItem.current !== null && dragItem.current !== dragOverItem.current) {
      const _frameworks = [...frameworks];
      const draggedItemContent = _frameworks[dragItem.current];
      _frameworks.splice(dragItem.current, 1);
      _frameworks.splice(dragOverItem.current, 0, draggedItemContent);
      dragItem.current = dragOverItem.current;
      setFrameworks(_frameworks);
    }
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      const orderedIds = frameworks.map(f => f.id);
      safeSaveToStorage(FRAMEWORK_ORDER_KEY, orderedIds);
      setIsEditMode(false);
    } else {
      setIsEditMode(true);
    }
  };

  const startEditing = (e: React.MouseEvent, session: SavedSession) => {
    e.stopPropagation();
    setEditingSessionId(session.sessionId);
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
  };

  const handleSaveTitle = (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) {
       setEditingSessionId(null);
       return;
    }
    if (session.sessionId === sessionId) {
      setSession(prev => ({ ...prev, name: newTitle, customTitle: newTitle }));
    } 
    const newHistory = history.map(h => 
      h.sessionId === sessionId ? { ...h, name: newTitle, customTitle: newTitle } : h
    );
    setHistory(newHistory);
    safeSaveToStorage(HISTORY_KEY, newHistory);
    
    const updatedSession = newHistory.find(h => h.sessionId === sessionId);
    if (syncConfig && user && updatedSession) {
      saveRemoteSession(syncConfig, user.id, updatedSession).catch(console.error);
    }
    setEditingSessionId(null);
  };

  const handleToggleStar = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const newHistory = history.map(h => 
      h.sessionId === sessionId ? { ...h, isStarred: !h.isStarred } : h
    );
    setHistory(newHistory);
    safeSaveToStorage(HISTORY_KEY, newHistory);
    
    // Sync update
    const updated = newHistory.find(h => h.sessionId === sessionId);
    if (syncConfig && user && updated) {
        saveRemoteSession(syncConfig, user.id, updated).catch(console.error);
    }
  };

  const updateHistoryEntry = async () => {
    if (!session.framework || !session.mood) return;
    const existingSession = history.find(h => h.sessionId === session.sessionId);
    const previewText = session.messages.length > 0 
      ? session.messages[session.messages.length - 1].text.substring(0, 80) + "..." 
      : "New Session";
    const messagesForHistory = session.messages;
    const newEntry: SavedSession = {
      sessionId: session.sessionId,
      framework: session.framework!,
      mood: session.mood!,
      messages: messagesForHistory,
      lastModified: Date.now(),
      preview: previewText,
      customTitle: session.customTitle,
      name: session.name, 
      _airtableId: existingSession?._airtableId,
      isStarred: existingSession?.isStarred || false
    };

    setHistory(prev => {
      const existingIndex = prev.findIndex(h => h.sessionId === session.sessionId);
      if (existingIndex >= 0 && prev[existingIndex]._airtableId) {
          newEntry._airtableId = prev[existingIndex]._airtableId;
      }
      let updatedHistory;
      if (existingIndex >= 0) {
          updatedHistory = [...prev];
          updatedHistory[existingIndex] = newEntry;
      } else {
          updatedHistory = [newEntry, ...prev];
      }
      updatedHistory.sort((a, b) => b.lastModified - a.lastModified);
      safeSaveToStorage(HISTORY_KEY, updatedHistory);
      return updatedHistory;
    });

    if (syncConfig && user) {
      setSyncStatus('syncing');
      try {
        await saveRemoteSession(syncConfig, user.id, newEntry);
        setSyncStatus('synced');
      } catch (e) {
        console.error("Auto-save failed", e);
        setSyncStatus('error');
      }
    }
  };

  const handleManualSync = async () => {
    if (!user) return;
    if (!syncConfig) {
      setShowSyncSettings(true);
      return;
    }
    setSyncStatus('syncing');
    try {
      const deletedIds = JSON.parse(localStorage.getItem(DELETED_SESSION_IDS_KEY) || '[]');
      for (const h of history) {
        await saveRemoteSession(syncConfig, user.id, h);
      }
      const remoteHistory = await fetchRemoteHistory(syncConfig, user.id);
      const sessionMap = new Map<string, SavedSession>();
      history.forEach(h => sessionMap.set(h.sessionId, h));
      remoteHistory.forEach(remote => {
        if (deletedIds.includes(remote.sessionId)) return; 
        const local = sessionMap.get(remote.sessionId);
        if (!local || remote.lastModified > local.lastModified) {
          sessionMap.set(remote.sessionId, remote);
        }
      });
      const mergedHistory = Array.from(sessionMap.values());
      mergedHistory.sort((a, b) => b.lastModified - a.lastModified);
      setHistory(mergedHistory);
      safeSaveToStorage(HISTORY_KEY, mergedHistory);
      setSyncStatus('synced');
    } catch (e) {
      console.error("Manual sync failed", e);
      setSyncStatus('error');
    }
  };

  const handleDeleteHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmationId) return;
    const id = deleteConfirmationId;
    
    // Optimistic: Close modal immediately to prevent "unresponsive" feeling
    setDeleteConfirmationId(null);

    const deletedIds = JSON.parse(localStorage.getItem(DELETED_SESSION_IDS_KEY) || '[]');
    if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        safeSaveToStorage(DELETED_SESSION_IDS_KEY, deletedIds);
    }
    const newHistory = history.filter(h => h.sessionId !== id);
    setHistory(newHistory);
    safeSaveToStorage(HISTORY_KEY, newHistory);
    
    if (session.sessionId === id) {
        // If we are deleting the CURRENT active session:
        if (newHistory.length > 0) {
            // Load the next most recent session ("Remain here")
            loadFromHistory(newHistory[0]);
        } else {
            // If it was the last session, fallback to Dashboard ("Keep current flow")
            resetSessionState();
        }
    }

    if (syncConfig) {
        try {
            await deleteRemoteSession(syncConfig, id);
        } catch(e) { console.error("Remote delete failed", e); }
    }
  };

  const loadFromHistory = (saved: SavedSession) => {
    setSession({
      sessionId: saved.sessionId,
      isActive: true,
      framework: saved.framework,
      mood: saved.mood,
      messages: saved.messages,
      isLoading: false,
      customTitle: saved.customTitle,
      name: saved.name,
    });
    const lastMsg = saved.messages[saved.messages.length - 1];
    setIsSummarized(lastMsg && lastMsg.text.includes("SESSION SUMMARY"));
    const memory = getMemoryContext(saved.sessionId);
    // Try catch loading from history to prevent crash if API key is missing
    try {
        initializeCoachingSession(saved.framework, saved.mood, saved.messages, memory);
    } catch(e) { console.warn("Failed to init coaching session from history", e); }
    setShowMobileHistory(false);
  };

  const handleSaveSyncConfig = (config: SyncConfig) => {
    setSyncConfig(config);
    safeSaveToStorage(SYNC_CONFIG_KEY, config);
  };

  const handleSaveProviderConfig = (newConfig: AIProviderConfig) => {
    setProviderConfig(newConfig);
    if (session.framework && session.mood) {
      try {
        const memory = getMemoryContext(session.sessionId);
        initializeCoachingSession(session.framework, session.mood, session.messages, memory);
      } catch (e) {
        console.warn("Re-init coaching session with new provider config failed:", e);
      }
    }
  };

  const handleExport = (format: ExportFormat) => {
    const filename = exportSession(session, format);
    // Add system message to session to "Store in session information"
    setSession(prev => ({
        ...prev,
        messages: [
            ...prev.messages,
            {
                id: generateId(),
                role: 'model',
                text: `📄 System Generated Report: ${filename} (${format.toUpperCase()})`,
                timestamp: new Date()
            }
        ]
    }));
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(session, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${APP_NAME.replace(/\s+/g, '-')}-Session-${session.sessionId}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Log export
    setSession(prev => ({
        ...prev,
        messages: [
            ...prev.messages,
            {
                id: generateId(),
                role: 'model',
                text: `📄 System Exported JSON Backup.`,
                timestamp: new Date()
            }
        ]
    }));
  };

  const handlePrint = () => { window.print(); };

  const getSessionLimit = () => user?.customSessionLimit ?? 3;
  const getSessionsUsed = () => user?.sessionsUsed || 0;
  const checkUsageLimit = (): boolean => true;
  const incrementUsage = () => {
    setUser(prev => {
        const current = prev.sessionsUsed || 0;
        const updated = { ...prev, sessionsUsed: current + 1 };
        safeSaveToStorage('dutrakit_user', updated);
        return updated;
    });
  };

  const handleSelectFramework = (framework: Framework) => {
    if (!checkUsageLimit()) return;
    setSession({ sessionId: generateId(), framework, mood: null, isActive: false, messages: [], isLoading: false, customTitle: undefined, name: undefined });
    setIsSummarized(false);
  };

  const handleSelectMood = async (mood: Mood) => {
    if (!session.framework) return;
    if (!checkUsageLimit()) return;
    incrementUsage();
    startCoaching(session.framework, mood);
  };

  // --- FILE HANDLING ---
  const processFiles = useCallback((files: File[]) => {
    const newAttachments: Attachment[] = [];
    let processedCount = 0;
    if (files.length === 0) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          newAttachments.push({
            id: generateId(),
            name: file.name,
            mimeType: file.type,
            data: reader.result
          });
          processedCount++;
          if (processedCount === files.length) {
             setAttachments(prev => [...prev, ...newAttachments]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  // --- AUDIO HANDLING ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setSession(prev => ({ ...prev, isLoading: true }));
        try {
           const transcribedText = await transcribeAudio(audioBlob);
           setInputText(prev => (prev + " " + transcribedText).trim());
        } catch(e) {
           console.error("Transcription failed", e);
           alert("Failed to transcribe audio.");
        } finally {
           setSession(prev => ({ ...prev, isLoading: false }));
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Could not access microphone", e);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
     }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || session.isLoading) return;
    const textToSend = inputText;
    const attachmentsToSend = [...attachments];
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: textToSend, 
      timestamp: new Date(),
      attachments: attachmentsToSend 
    };
    setSession(prev => ({ ...prev, messages: [...prev.messages, userMsg], isLoading: true }));
    setInputText('');
    setAttachments([]); 
    setIsSummarized(false);
    try {
      const aiMsgId = (Date.now() + 1).toString();
      setSession(prev => ({ ...prev, messages: [...prev.messages, { id: aiMsgId, role: 'model', text: '', timestamp: new Date() }] }));
      await sendMessageToCoach(textToSend, attachmentsToSend, (streamedText) => {
        setSession(prev => ({ ...prev, messages: prev.messages.map(msg => msg.id === aiMsgId ? { ...msg, text: streamedText } : msg) }));
      });
    } catch (error: any) {
      const errorText = error.message || "Connection interruption.";
      setSession(prev => ({ ...prev, messages: [...prev.messages, { id: generateId(), role: 'model', text: errorText, timestamp: new Date() }] }));
    } finally { setSession(prev => ({ ...prev, isLoading: false })); }
  };

  const handleGenerateSummary = async () => {
    if (session.isLoading) return;
    const aiMsgId = (Date.now() + 1).toString();
    setSession(prev => ({ ...prev, messages: [...prev.messages, { id: aiMsgId, role: 'model', text: '', timestamp: new Date() }], isLoading: true }));
    try {
      await generateSessionSummary((streamedText) => {
        setSession(prev => ({ ...prev, messages: prev.messages.map(msg => msg.id === aiMsgId ? { ...msg, text: streamedText } : msg) }));
      });
      setIsSummarized(true);
    } catch (error) {
       setSession(prev => ({ ...prev, messages: prev.messages.map(msg => msg.id === aiMsgId ? { ...msg, text: "Summary failed." } : msg) }));
    } finally { setSession(prev => ({ ...prev, isLoading: false })); }
  };

  const handleReset = () => {
    if (session.isActive && session.messages.length > 0) updateHistoryEntry();
    resetSessionState();
  };

  const handleBackToFrameworks = () => setSession(prev => ({ ...prev, framework: null, mood: null }));

  const sessionsRemaining = Math.max(0, getSessionLimit() - getSessionsUsed());
  const progressPercentage = getSessionLimit() > 0 ? Math.min(100, (getSessionsUsed() / getSessionLimit()) * 100) : 0;
  
  const MenuButton = ({ className = "" }) => (
    <button onClick={() => setShowSideMenu(true)} className={`p-2 text-trackit-muted hover:text-trackit-text hover:bg-trackit-panel border border-transparent hover:border-trackit-border rounded-lg transition-all ${className}`} title="Open Menu">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
    </button>
  );

  const SyncIndicator = () => {
      if (syncStatus === 'offline') return null;
      if (syncStatus === 'syncing') return <span className="text-[10px] text-yellow-400 flex items-center gap-1"><span className="animate-pulse">☁️</span> Syncing...</span>;
      if (syncStatus === 'error') return <span className="text-[10px] text-red-400 flex items-center gap-1">☁️ Error</span>;
      return <span className="text-[10px] text-trackit-success flex items-center gap-1">☁️ Saved</span>;
  };

  const renderSidebarContent = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
      {history.length === 0 && <div className="text-center text-trackit-muted text-sm py-8">No saved sessions.</div>}
      {history.map(item => (
        <div 
          key={item.sessionId} 
          onClick={() => loadFromHistory(item)} 
          className={`p-3 rounded-lg border cursor-pointer group transition-all ${session.sessionId === item.sessionId ? 'bg-trackit-panel border-trackit-accent shadow-md' : 'bg-trackit-panel/50 border-trackit-border hover:border-trackit-muted'}`} 
          title={`Date: ${new Date(item.lastModified).toLocaleDateString()}`}
        >
          {editingSessionId === item.sessionId ? (
            <div onClick={e => e.stopPropagation()} className="w-full">
              <EditableTitle 
                initialValue={item.name || item.customTitle || item.framework.name}
                onSave={(newVal) => handleSaveTitle(item.sessionId, newVal)}
                onCancel={cancelEditing}
                inputClassName="bg-trackit-dark border border-trackit-border rounded px-2 py-1 text-xs text-trackit-text w-full focus:outline-none focus:border-trackit-accent"
              />
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-lg flex-shrink-0">{item.framework.icon}</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-trackit-text truncate text-xs">{item.name || item.customTitle || item.framework.name}</span>
                  <span className="text-[10px] text-trackit-muted truncate">{item.preview}</span>
                </div>
              </div>
              <div className="flex gap-1 items-center">
                <button 
                  onClick={(e) => handleToggleStar(e, item.sessionId)}
                  className={`p-1 rounded hover:bg-trackit-border transition-colors ${item.isStarred ? 'text-yellow-400 opacity-100' : 'text-trackit-muted hover:text-yellow-400 md:opacity-0 opacity-100 md:group-hover:opacity-100'}`}
                  title={item.isStarred ? "Unstar" : "Star"}
                >
                  {item.isStarred ? '★' : '☆'}
                </button>
                <div className="flex gap-1 md:opacity-0 opacity-100 md:group-hover:opacity-100 transition-opacity">
                    <button 
                    onClick={(e) => startEditing(e, item)}
                    className="text-trackit-muted hover:text-trackit-accent p-1 rounded hover:bg-trackit-border"
                    title="Rename"
                    >
                    ✎
                    </button>
                    <button 
                    onClick={(e) => handleDeleteHistory(e, item.sessionId)} 
                    className="text-trackit-muted hover:text-red-400 p-1 hover:bg-trackit-border rounded"
                    title="Delete"
                    >
                    🗑️
                    </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-trackit-dark overflow-hidden text-trackit-text transition-colors duration-300">
      {/* Hidden File Import Input */}
      <input 
        type="file" 
        ref={importInputRef}
        onChange={handleImportFile}
        className="hidden" 
        accept=".json,.txt,.pdf"
      />

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
      {showSyncSettings && <SyncSettings onClose={() => setShowSyncSettings(false)} onSave={handleSaveSyncConfig} initialConfig={syncConfig} />}
      {showProviderSettings && (
        <ProviderSettingsModal 
          isOpen={showProviderSettings} 
          onClose={() => setShowProviderSettings(false)} 
          onSave={handleSaveProviderConfig} 
        />
      )}
      {showInfo && <FrameworkInfoModal onClose={() => setShowInfo(false)} />}
      
      {/* IMAGE VIEWER MODAL */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setViewingImage(null)}
        >
          <button 
            className="absolute top-4 right-4 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); setViewingImage(null); }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <img 
            src={viewingImage.data} 
            alt={viewingImage.name} 
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()} 
          />
          
          <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
            <span className="inline-block px-4 py-2 bg-black/50 backdrop-blur rounded-full text-white/90 text-sm font-medium border border-white/10">
              {viewingImage.name}
            </span>
          </div>
        </div>
      )}

      {isVoiceActive && session.framework && (
        <LiveVoiceModal 
          framework={session.framework} 
          mood={session.mood} 
          onClose={() => setIsVoiceActive(false)} 
        />
      )}

      <SideMenu 
        isOpen={showSideMenu} 
        onClose={() => setShowSideMenu(false)}
        user={user}
        onNavigateToDashboard={handleReset}
        onSync={() => setShowSyncSettings(true)}
        onForceSync={handleManualSync}
        onUpgrade={() => setShowPricing(true)}
        onOpenProviders={() => setShowProviderSettings(true)}
        activeProviderBadge={PROVIDER_METADATA[providerConfig.activeProvider]?.name}
        isSessionActive={session.isActive}
        onDeleteSession={() => setDeleteConfirmationId(session.sessionId)}
        onShowHistory={() => setShowMobileHistory(true)}
        onImportSession={handleImportClick}
        onStartLiveVoice={() => setIsVoiceActive(true)}
      />
      
      {showMobileHistory && (
        <div className="fixed inset-0 z-[65] flex flex-col bg-trackit-dark animate-fade-in md:hidden">
          <div className="p-6 border-b border-trackit-border flex justify-between items-center bg-trackit-panel pt-safe">
            <h2 className="text-xl font-bold text-trackit-text flex items-center gap-2"><span>🗂️</span> Past Sessions</h2>
            <button onClick={() => setShowMobileHistory(false)} className="text-trackit-muted hover:text-trackit-text p-2">✕</button>
          </div>
          {renderSidebarContent()}
        </div>
      )}

      {deleteConfirmationId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
           <div className="bg-trackit-panel border border-trackit-border rounded-xl max-w-sm w-full p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-trackit-text mb-2">Delete Session?</h3>
              <p className="text-trackit-muted text-sm mb-6">Permanently delete this session? This cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirmationId(null)} className="px-4 py-2 rounded-lg text-trackit-muted hover:text-trackit-text hover:bg-trackit-border text-sm font-medium">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 text-sm font-medium">Delete</button>
              </div>
           </div>
        </div>
      )}
      
      {/* 1. DASHBOARD VIEW */}
      {!session.framework && (
        <div className="h-full flex flex-col md:flex-row overflow-hidden pt-safe">
          {/* NEW: Fixed Mobile Header */}
          <div className="md:hidden flex flex-col px-6 py-4 bg-trackit-dark border-b border-trackit-border z-20 shrink-0">
             <div className="flex justify-between items-start mb-4">
                 <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-trackit-accent to-purple-500">
                    {APP_NAME}
                 </h1>
                 <div className="flex gap-2">
                     <button onClick={() => setShowMobileHistory(true)} className="p-2 bg-trackit-panel rounded-lg text-trackit-muted border border-trackit-border" title="History">🗂️</button>
                     <MenuButton className="bg-trackit-panel border-trackit-border" />
                 </div>
             </div>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <SyncIndicator />
                  <button 
                    onClick={() => setShowProviderSettings(true)}
                    className="px-2 py-1 bg-trackit-panel border border-trackit-border rounded-lg text-xs font-semibold text-trackit-text hover:border-trackit-accent flex items-center gap-1.5"
                    title="Configure AI Provider"
                  >
                    <span>{PROVIDER_METADATA[providerConfig.activeProvider]?.icon || '🤖'}</span>
                    <span className="truncate max-w-[90px]">{PROVIDER_METADATA[providerConfig.activeProvider]?.name}</span>
                  </button>
                </div>
                <div className="flex gap-2">
                    {/* Guide Button Mobile */}
                    <button 
                      onClick={() => setShowInfo(true)}
                      className="p-2 bg-trackit-panel border border-trackit-border rounded-lg text-trackit-muted hover:text-trackit-text"
                    >
                      ℹ️
                    </button>
                    {/* Font Size Toggle */}
                    <button 
                      onClick={toggleFontSize}
                      className={`p-2 bg-trackit-panel border border-trackit-border rounded-lg hover:text-trackit-text font-bold transition-colors ${fontSize === 'large' ? 'text-trackit-accent' : 'text-trackit-muted'}`}
                      title={fontSize === 'large' ? "Use Normal Text" : "Use Large Text"}
                    >
                      Aa
                    </button>
                    <button 
                      onClick={toggleTheme}
                      className="p-2 bg-trackit-panel border border-trackit-border rounded-lg text-trackit-muted hover:text-trackit-text"
                    >
                      {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>
             </div>
          </div>

          <div className="flex-1 min-w-0 p-6 md:p-12 overflow-y-auto h-full pb-safe">
            <div className="max-w-[1800px] mx-auto">
              {/* Desktop Header (Hidden on Mobile) */}
              <header className="mb-6 md:mb-10 hidden md:block">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center md:block">
                       <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-trackit-accent to-purple-500 mb-2 md:mb-4">
                         {APP_NAME}
                       </h1>
                    </div>
                    <p className="text-sm md:text-xl text-trackit-muted">Execution Intelligence. Select a framework.</p>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <SyncIndicator />
                    
                    {/* AI Provider Quick Switcher Desktop */}
                    <button 
                      onClick={() => setShowProviderSettings(true)}
                      className="p-2 bg-trackit-panel border border-trackit-border rounded-lg text-trackit-text hover:border-trackit-accent transition-all flex items-center gap-2 font-medium px-3 text-xs group"
                      title={`Active AI Provider: ${PROVIDER_METADATA[providerConfig.activeProvider]?.name} (${providerConfig.providers[providerConfig.activeProvider]?.model || PROVIDER_METADATA[providerConfig.activeProvider]?.defaultModel}). Click to configure API keys & endpoints.`}
                    >
                      <span className="text-sm">{PROVIDER_METADATA[providerConfig.activeProvider]?.icon || '🤖'}</span>
                      <span className="font-semibold text-trackit-text">{PROVIDER_METADATA[providerConfig.activeProvider]?.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-trackit-dark text-trackit-muted font-mono border border-trackit-border/80">
                        {providerConfig.providers[providerConfig.activeProvider]?.model || PROVIDER_METADATA[providerConfig.activeProvider]?.defaultModel}
                      </span>
                    </button>

                    {/* Info/Guide Button Desktop */}
                    <button 
                      onClick={() => setShowInfo(true)}
                      className="p-2 bg-trackit-panel border border-trackit-border rounded-lg text-trackit-muted hover:text-trackit-text hover:border-trackit-muted transition-colors flex items-center gap-2 font-medium px-3"
                      title="Framework Guide"
                    >
                      <span>ℹ️</span> Guide
                    </button>

                    {/* Font Size Toggle Desktop */}
                    <button 
                      onClick={toggleFontSize}
                      className={`p-2 bg-trackit-panel border border-trackit-border rounded-lg hover:text-trackit-text hover:border-trackit-muted transition-colors font-bold ${fontSize === 'large' ? 'text-trackit-accent' : 'text-trackit-muted'}`}
                      title={fontSize === 'large' ? "Use Normal Text" : "Use Large Text"}
                    >
                      Aa
                    </button>

                    <button 
                      onClick={toggleTheme}
                      className="p-2 bg-trackit-panel border border-trackit-border rounded-lg text-trackit-muted hover:text-trackit-text hover:border-trackit-muted transition-colors"
                      title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                      {theme === 'dark' ? '☀️' : '🌙'}
                    </button>

                    <button 
                      onClick={toggleEditMode}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                        isEditMode 
                          ? 'bg-trackit-accent border-trackit-accent text-white shadow-lg shadow-blue-500/30' 
                          : 'bg-trackit-panel border-trackit-border text-trackit-muted hover:text-trackit-text hover:border-trackit-muted'
                      }`}
                    >
                      {isEditMode ? 'Save' : 'Customize'}
                    </button>
                    
                    <div className="hidden md:flex gap-2">
                        <MenuButton className="bg-trackit-panel border-trackit-border" />
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12 pb-20">
                {frameworks.map((fw, index) => (
                  <FrameworkCard 
                    key={fw.id} 
                    framework={fw} 
                    onSelect={handleSelectFramework}
                    isEditing={isEditMode}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="w-80 shrink-0 bg-trackit-panel border-l border-trackit-border flex flex-col h-full hidden md:flex pt-safe" id="sidebar-desktop">
             <div className="p-6 border-b border-trackit-border flex justify-between items-center">
                 <h2 className="text-lg font-bold text-trackit-text flex items-center gap-2"><span>🗂️</span> Past Sessions</h2>
                 <SyncIndicator />
             </div>
             {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* 2. MOOD SELECTION VIEW */}
      {session.framework && !session.mood && (
        <div className="h-full flex flex-col items-center justify-center p-6 animate-fade-in relative pt-safe pb-safe">
          <button onClick={handleBackToFrameworks} className="absolute top-safe-8 left-8 flex items-center gap-2 text-trackit-muted hover:text-trackit-text transition-colors mt-8">
            ← Back
          </button>
          
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-trackit-panel rounded-full text-4xl mb-6 shadow-xl border border-trackit-border">
               {session.framework.icon}
            </div>
            <h2 className="text-3xl font-bold text-trackit-text mb-2">{session.framework.name}</h2>
            <p className="text-trackit-muted">How are you entering this session?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl w-full">
            {MOODS.map(mood => (
              <button
                key={mood.id}
                onClick={() => handleSelectMood(mood)}
                className="bg-trackit-panel border border-trackit-border p-8 rounded-xl hover:border-trackit-accent hover:bg-trackit-panel/80 hover:scale-105 transition-all group flex flex-col items-center text-center shadow-lg"
              >
                <div className="text-5xl mb-4 group-hover:animate-bounce">{mood.emoji}</div>
                <h3 className="text-xl font-bold text-trackit-text mb-2">{mood.label}</h3>
                <p className="text-sm text-trackit-muted group-hover:text-trackit-text">{mood.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. CHAT VIEW */}
      {session.framework && session.mood && (
        <div className="flex h-full overflow-hidden pt-safe">
          {/* Desktop Sidebar (Collapsed state logic can be added here, for now static width) */}
          <div className="w-80 shrink-0 bg-trackit-panel border-r border-trackit-border flex flex-col h-full hidden lg:flex">
             <div className="p-4 border-b border-trackit-border flex justify-between items-center bg-trackit-dark/10">
                 <button onClick={handleReset} className="text-xs font-bold text-trackit-muted hover:text-trackit-text flex items-center gap-1">
                   ← Dashboard
                 </button>
                 <SyncIndicator />
             </div>
             {renderSidebarContent()}
          </div>

          {/* Main Chat Area */}
          <div 
            className="flex-1 min-w-0 flex flex-col bg-trackit-dark relative"
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
          >
             {isDragging && (
                 <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm pointer-events-none">
                    <div className="bg-trackit-accent/20 border-2 border-dashed border-trackit-accent rounded-xl p-12 animate-pulse">
                       <p className="text-2xl font-bold text-white">Drop files to attach</p>
                    </div>
                 </div>
              )}
            
            {/* Chat Header */}
            <div className="h-16 border-b border-trackit-border flex items-center justify-between px-3 md:px-6 bg-trackit-dark/95 backdrop-blur z-20 shrink-0">
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <button onClick={handleReset} className="lg:hidden text-trackit-muted p-2 hover:text-trackit-text rounded-full hover:bg-trackit-panel/50">←</button>
                <span className="text-xl md:text-2xl flex-shrink-0">{session.framework.icon}</span>
                <div className="flex flex-col min-w-0 flex-1">
                  {editingSessionId === session.sessionId ? (
                     <div className="flex items-center gap-2">
                         <EditableTitle 
                            initialValue={session.name || session.customTitle || session.framework.name}
                            onSave={(newVal) => handleSaveTitle(session.sessionId, newVal)}
                            onCancel={cancelEditing}
                            inputClassName="bg-transparent text-trackit-text font-bold focus:outline-none border-b border-trackit-accent w-full text-sm md:text-base"
                         />
                     </div>
                  ) : (
                    <div className="group flex items-center gap-2 max-w-full">
                        <h2 
                        className="font-bold text-trackit-text cursor-pointer hover:text-trackit-accent truncate text-sm md:text-base"
                        onClick={(e) => startEditing(e, {
                            ...session,
                            framework: session.framework!,
                            mood: session.mood!,
                            lastModified: Date.now(),
                            preview: '',
                            name: session.name
                        } as SavedSession)}
                        >
                        {session.name || session.customTitle || session.framework.name}
                        </h2>
                        <span className="text-trackit-muted opacity-0 group-hover:opacity-100 transition-opacity text-xs hidden md:inline">✎</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] md:text-xs text-trackit-muted">
                    <span>{session.mood.label}</span>
                    {session.isLoading && <span className="text-trackit-accent animate-pulse">• AI Thinking...</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                 {/* Active Provider Pill */}
                 <button 
                   onClick={() => setShowProviderSettings(true)}
                   className="px-2.5 py-1.5 bg-trackit-panel border border-trackit-border rounded-lg text-xs hover:border-trackit-accent transition-colors flex items-center gap-1.5 text-trackit-muted hover:text-trackit-text"
                   title={`Current Provider: ${PROVIDER_METADATA[providerConfig.activeProvider]?.name}. Click to change model, API key, or endpoint.`}
                 >
                   <span>{PROVIDER_METADATA[providerConfig.activeProvider]?.icon || '🤖'}</span>
                   <span className="hidden sm:inline font-medium text-trackit-text">{PROVIDER_METADATA[providerConfig.activeProvider]?.name}</span>
                   <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-trackit-dark border border-trackit-border text-trackit-muted font-mono">
                     {providerConfig.providers[providerConfig.activeProvider]?.model || PROVIDER_METADATA[providerConfig.activeProvider]?.defaultModel}
                   </span>
                 </button>

                 {/* Action Buttons */}
                 {!isSummarized && (
                    <button 
                      onClick={handleGenerateSummary} 
                      disabled={session.messages.length < 2 || session.isLoading}
                      className="hidden md:flex px-3 py-1.5 bg-trackit-panel border border-trackit-border text-trackit-muted rounded text-xs hover:bg-trackit-border hover:text-trackit-text disabled:opacity-50 gap-1 items-center"
                    >
                      <span>📝</span> Summary
                    </button>
                 )}
                 <button 
                   onClick={() => setIsVoiceActive(true)}
                   className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-full transition-colors border border-red-500/30" 
                   title="Live Voice Mode"
                 >
                   🎙️
                 </button>
                 {/* Chat View Font Toggle */}
                 <button 
                      onClick={toggleFontSize}
                      className={`p-2 hover:bg-trackit-panel rounded-full hover:text-trackit-text font-bold transition-colors ${fontSize === 'large' ? 'text-trackit-accent' : 'text-trackit-muted'}`}
                      title={fontSize === 'large' ? "Use Normal Text" : "Use Large Text"}
                  >
                      Aa
                 </button>
                 <div className="relative group">
                    <button className="p-2 text-trackit-muted hover:text-trackit-text">⋮</button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-trackit-panel border border-trackit-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all z-50 transform origin-top-right">
                       <button onClick={handleExportJSON} className="w-full text-left px-4 py-2 hover:bg-trackit-border text-sm text-trackit-muted hover:text-trackit-text border-b border-trackit-border">Backup (JSON)</button>
                       <div className="px-4 py-1 text-[10px] text-trackit-muted font-bold uppercase tracking-wider">Export As</div>
                       <button onClick={() => handleExport('doc')} className="w-full text-left px-4 py-2 hover:bg-trackit-border text-sm text-trackit-muted hover:text-trackit-text">Word (.doc)</button>
                       <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 hover:bg-trackit-border text-sm text-trackit-muted hover:text-trackit-text">PDF (Print)</button>
                       <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2 hover:bg-trackit-border text-sm text-trackit-muted hover:text-trackit-text">Text File (.txt)</button>
                       <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 hover:bg-trackit-border text-sm text-trackit-muted hover:text-trackit-text">CSV (Excel)</button>
                    </div>
                 </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 relative transition-all">
              {session.messages.map((msg, index) => (
                <ChatBubble 
                  key={msg.id ? `${msg.id}-${index}` : `msg-${index}`} 
                  message={msg} 
                  fontSize={fontSize} 
                  onImageClick={setViewingImage}
                />
              ))}
              {session.isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-trackit-dark border-t border-trackit-border relative z-20 pb-safe">
               {/* Attachment Previews */}
               {attachments.length > 0 && (
                 <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                    {attachments.map(att => (
                       <div key={att.id} className="relative group flex-shrink-0">
                          {att.mimeType.startsWith('image/') ? (
                             <img 
                               src={att.data} 
                               alt="preview" 
                               className="h-16 w-16 object-cover rounded-lg border border-trackit-border cursor-pointer hover:opacity-80 transition-opacity" 
                               onClick={() => setViewingImage(att)}
                             />
                          ) : (
                             <div className="h-16 w-16 bg-trackit-panel rounded-lg border border-trackit-border flex items-center justify-center text-2xl text-trackit-text">📄</div>
                          )}
                          <button 
                            onClick={() => removeAttachment(att.id)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600"
                          >
                            ×
                          </button>
                       </div>
                    ))}
                 </div>
               )}

               <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex gap-2 items-end">
                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef}
                    className="hidden" 
                    onChange={handleFileSelect} 
                  />
                  {/* Microphone Button */}
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'text-trackit-muted hover:text-trackit-text hover:bg-trackit-panel'}`}
                    title={isRecording ? "Stop Recording" : "Speak to Text"}
                  >
                    {isRecording ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                      </svg>
                    )}
                  </button>

                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-trackit-muted hover:text-trackit-text hover:bg-trackit-panel rounded-xl transition-all"
                    title="Attach files"
                  >
                    📎
                  </button>
                  <div className="relative flex-1">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your update..."
                      className="w-full bg-trackit-panel border border-trackit-border text-trackit-text rounded-xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-trackit-accent resize-none h-12 max-h-32 overflow-y-auto scrollbar-hide placeholder-trackit-muted/50"
                      disabled={session.isLoading}
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={(!inputText.trim() && attachments.length === 0) || session.isLoading}
                    className="p-3 bg-trackit-accent text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  </button>
               </form>
               <div className="text-center mt-2">
                 <p className="text-[10px] text-trackit-muted">AI can make mistakes. Review generated plans.</p>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;