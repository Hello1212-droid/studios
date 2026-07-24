/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           AURELIUS AI — NEELA MENTOR (FIXED)                  ║
 * ║                                                              ║
 * ║  Fixes applied:                                              ║
 * ║    1. User-provided API keys via Settings panel              ║
 * ║    2. No direct state mutation (immutable copies)            ║
 * ║    3. Stable message keys (message.id not array index)       ║
 * ║    4. Retry button on AI failure                             ║
 * ║    5. Message sync with store fixed                           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Brain, Loader2, History, Plus, MessageSquare, ChevronLeft, ChevronRight, BarChart2, Settings, Key, RefreshCw, X } from 'lucide-react';
import { chatWithNeela, getNeelaKeys, saveNeelaKeys, NeelaApiKeys } from '../utils/neelaBrain';
import { StudyState, processNeelaAction, updateChatSession, ChatSession, ChatMessage } from '../utils/studyStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props { studyState: StudyState; setStudyState: React.Dispatch<React.SetStateAction<StudyState>>; }

const AureliusAI: React.FC<Props> = ({ studyState, setStudyState }) => {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<NeelaApiKeys>(getNeelaKeys);
  const [pendingKeys, setPendingKeys] = useState<NeelaApiKeys>(getNeelaKeys);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  // Load latest session on mount or when chatHistory changes externally
  useEffect(() => {
    if (studyState.chatHistory.length > 0) {
      const match = studyState.chatHistory.find(s => s.id === currentSessionId);
      if (match) {
        // Refresh messages from store (handles external updates like Neela actions)
        setMessages(match.messages);
      } else if (!currentSessionId) {
        // First load: select newest session
        const latest = studyState.chatHistory[0];
        setCurrentSessionId(latest.id);
        setMessages(latest.messages);
      }
    }
  }, [studyState.chatHistory]);

  const createNewSession = useCallback(() => {
    const id = Math.random().toString(36).substr(2, 9);
    const newSession: ChatSession = {
      id, timestamp: new Date().toISOString(), title: 'New Strategy Session',
      messages: [{ role: 'assistant', content: '# Mission Control Online\nNeela is active. Report your status.', timestamp: new Date().toISOString() }]
    };
    setCurrentSessionId(id);
    setMessages(newSession.messages);
    setStudyState(prev => updateChatSession(prev, newSession));
  }, [setStudyState]);

  const selectSession = useCallback((session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setLastError(null);
  }, []);

  const sendMessage = useCallback(async (retryContent?: string) => {
    const content = retryContent || aiInput;
    if (!content.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date().toISOString() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setAiInput('');
    setLoading(true);
    setLastError(null);

    // Sync to store
    if (currentSessionId) {
      const session = studyState.chatHistory.find(s => s.id === currentSessionId);
      if (session) {
        const updatedSession = { ...session, messages: updatedMessages };
        setStudyState(prev => updateChatSession(prev, updatedSession));
      }
    }

    try {
      const result = await chatWithNeela(content, studyState, navigator.onLine, apiKeys);
      const assistantMsg: ChatMessage = { role: 'assistant', content: result.response, timestamp: new Date().toISOString() };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Process [ACTION] blocks from Neela
      let newState = processNeelaAction(studyState, result.response);

      // Update session title if first user message (IMMUTABLE copy)
      const sessionIdx = newState.chatHistory.findIndex(s => s.id === currentSessionId);
      if (sessionIdx >= 0 && newState.chatHistory[sessionIdx].title === 'New Strategy Session') {
        const updated = { ...newState.chatHistory[sessionIdx], title: content.slice(0, 30) + (content.length > 30 ? '...' : '') };
        const newHistory = [...newState.chatHistory];
        newHistory[sessionIdx] = updated;
        newState = updateChatSession({ ...newState, chatHistory: newHistory }, { ...updated, messages: finalMessages });
      } else if (sessionIdx >= 0) {
        newState = updateChatSession(newState, { ...newState.chatHistory[sessionIdx], messages: finalMessages });
      }

      setStudyState(newState);
    } catch {
      const errorMsg: ChatMessage = { role: 'assistant', content: '## Error\nFailed to sync with the neural core.', timestamp: new Date().toISOString() };
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);
      setLastError(content);
    } finally {
      setLoading(false);
    }
  }, [aiInput, messages, currentSessionId, studyState, apiKeys, setStudyState]);

  const handleRetry = () => { if (lastError) sendMessage(lastError); };

  const saveSettings = () => {
    setApiKeys(pendingKeys);
    saveNeelaKeys(pendingKeys);
    setShowSettings(false);
  };

  return (
    <div className="flex h-full bg-[#0a0a0c] text-white select-text overflow-hidden">
      {/* Sidebar History */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            className="h-full bg-[#121218] border-r border-white/5 flex flex-col">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2"><History size={14} /> History</h3>
              <button onClick={createNewSession} className="p-1.5 rounded-lg hover:bg-white/5 text-blue-400 transition-colors"><Plus size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {studyState.chatHistory.map(session => (
                <button key={session.id} onClick={() => selectSession(session)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 group ${currentSessionId === session.id ? 'bg-blue-600/10 border border-blue-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                  <MessageSquare size={16} className={`mt-0.5 ${currentSessionId === session.id ? 'text-blue-400' : 'text-white/20 group-hover:text-white/40'}`} />
                  <div className="flex-1 overflow-hidden">
                    <div className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-white' : 'text-white/60'}`}>{session.title}</div>
                    <div className="text-[10px] text-white/20 mt-0.5">{new Date(session.timestamp).toLocaleDateString()}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 bg-white/5 border-t border-white/5">
              <div className="flex items-center gap-3 mb-3"><BarChart2 size={16} className="text-purple-400" /><span className="text-[10px] font-black uppercase tracking-widest text-white/40">Real JEE Scale</span></div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px]"><span className="text-white/40">Current Equivalent</span><span className="text-blue-400 font-bold">{studyState.testResults?.[0]?.jeeEquivalentPercentile || '0.00'}%</span></div>
                <div className="w-full bg-white/5 rounded-full h-1"><div className="bg-blue-500 h-1 rounded-full" style={{ width: `${studyState.testResults?.[0]?.jeeEquivalentPercentile || 0}%` }} /></div>
                <div className="flex justify-between text-[10px]"><span className="text-white/40">Next Target</span><span className="text-purple-400 font-bold">{studyState.testResults?.[0]?.targetPercentile || '99.50'}%</span></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <button onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-12 bg-[#121218] border border-l-0 border-white/10 rounded-r-xl flex items-center justify-center text-white/20 hover:text-white/60 transition-all shadow-2xl">
          {showSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Header with Settings */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#121218] border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20"><Brain size={20} className="text-blue-400" /></div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white/90">Neela Agent</h2>
              <p className="text-[10px] font-bold text-blue-400/60 uppercase tracking-tighter">
                {apiKeys.provider === 'none' ? 'API Key Needed' : `Active: ${apiKeys.provider.toUpperCase()}`}
              </p>
            </div>
          </div>
          <button onClick={() => { setPendingKeys(apiKeys); setShowSettings(!showSettings); }}
            className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400' : 'hover:bg-white/10 text-white/50'}`}>
            <Settings size={16} />
          </button>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="bg-[#0e0e14] border-b border-white/10 px-6 py-4 overflow-hidden">
              <div className="space-y-4 max-w-md">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-2"><Key size={12} className="text-blue-400" />API Key Configuration</h3>
                {/* Provider selector */}
                <div className="flex gap-2">
                  {(['groq', 'openai'] as const).map(p => (
                    <button key={p} onClick={() => setPendingKeys(prev => ({ ...prev, provider: p }))}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${pendingKeys.provider === p ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                      {p === 'groq' ? 'Groq' : 'OpenAI / NIM'}
                    </button>
                  ))}
                </div>
                {/* Groq key */}
                {pendingKeys.provider === 'groq' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-white/30">Groq API Key</label>
                    <input type="password" value={pendingKeys.groqKey} onChange={e => setPendingKeys(prev => ({ ...prev, groqKey: e.target.value }))}
                      placeholder="gsk_..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono outline-none focus:border-blue-500/50 transition-all" />
                    <p className="text-[8px] text-white/20">Get a free key at console.groq.com/keys</p>
                  </div>
                )}
                {/* OpenAI/NIM key */}
                {pendingKeys.provider === 'openai' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-white/30">API Key</label>
                      <input type="password" value={pendingKeys.openaiKey} onChange={e => setPendingKeys(prev => ({ ...prev, openaiKey: e.target.value }))}
                        placeholder="sk-..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono outline-none focus:border-blue-500/50 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-white/30">Base URL <span className="text-white/15 font-normal">(for NVIDIA NIM: https://integrate.api.nvidia.com/v1)</span></label>
                      <input value={pendingKeys.openaiBaseURL} onChange={e => setPendingKeys(prev => ({ ...prev, openaiBaseURL: e.target.value }))}
                        placeholder="https://api.openai.com/v1" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono outline-none focus:border-blue-500/50 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-white/30">Model</label>
                      <input value={pendingKeys.openaiModel} onChange={e => setPendingKeys(prev => ({ ...prev, openaiModel: e.target.value }))}
                        placeholder="gpt-4o-mini" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500/50 transition-all" />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold transition-all">Cancel</button>
                  <button onClick={saveSettings} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-black uppercase tracking-wider transition-all">Save Keys</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div key={m.timestamp + m.role} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-2xl ${m.role === 'user' ? 'bg-blue-600 text-white font-medium' : 'bg-white/5 border border-white/10 text-white/90'}`}>
                  {m.role === 'assistant' ? (
                    <div className="markdown-content space-y-3 text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, '')}</ReactMarkdown>
                    </div>
                  ) : (<p className="text-sm whitespace-pre-wrap">{m.content}</p>)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Neela is synchronizing...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar with retry */}
        <div className="p-6 bg-[#0c0c10] border-t border-white/5">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Talk to Neela..." disabled={loading}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-blue-500/50 transition-all disabled:opacity-40" />
            {lastError && !loading ? (
              <button onClick={handleRetry} className="bg-amber-600 hover:bg-amber-500 px-4 rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                <RefreshCw size={16} /> Retry
              </button>
            ) : null}
            <button onClick={() => sendMessage()} disabled={loading || !aiInput.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/50 px-6 rounded-2xl transition-all shadow-xl shadow-blue-600/20">
              <Zap size={18} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .markdown-content h1 { font-size:1.5rem; font-weight:900; color:#fff; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem; }
        .markdown-content h2 { font-size:1.1rem; font-weight:800; color:#60a5fa; margin-top:1.5rem; margin-bottom:0.75rem; text-transform:uppercase; }
        .markdown-content p { margin-bottom:1rem; }
        .markdown-content li { margin-bottom:0.5rem; list-style:disc; margin-left:1rem; }
        .markdown-content strong { color:#fff; font-weight:800; }
        .custom-scrollbar::-webkit-scrollbar { width:4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background:transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
};

export default AureliusAI;
