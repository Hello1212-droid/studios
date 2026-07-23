import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Brain, Loader2, History, Plus, MessageSquare, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { chatWithNeela } from '../utils/neelaBrain';
import { StudyState, processNeelaAction, updateChatSession, ChatSession, ChatMessage } from '../utils/studyStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  studyState: StudyState;
  setStudyState: React.Dispatch<React.SetStateAction<StudyState>>;
}

const AureliusAI: React.FC<Props> = ({ studyState, setStudyState }) => {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load latest session on mount if exists
  useEffect(() => {
    if (studyState.chatHistory && studyState.chatHistory.length > 0 && !currentSessionId) {
      const latest = studyState.chatHistory[0];
      setCurrentSessionId(latest.id);
      setMessages(latest.messages);
    } else if (!currentSessionId) {
      createNewSession();
    }
  }, []);

  const createNewSession = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const newSession: ChatSession = {
      id,
      timestamp: new Date().toISOString(),
      title: 'New Strategy Session',
      messages: [{ role: 'assistant', content: '# Mission Control Online\nNeela is active. Report your status.', timestamp: new Date().toISOString() }]
    };
    setCurrentSessionId(id);
    setMessages(newSession.messages);
    setStudyState(prev => updateChatSession(prev, newSession));
  };

  const selectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
  };

  const sendMessage = async () => {
    if (!aiInput.trim()) return;
    const userMsg: ChatMessage = { 
      role: 'user', 
      content: aiInput, 
      timestamp: new Date().toISOString() 
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setAiInput('');
    setLoading(true);

    // Sync session to store
    if (currentSessionId) {
      const session = studyState.chatHistory.find(s => s.id === currentSessionId);
      if (session) {
        setStudyState(prev => updateChatSession(prev, { ...session, messages: updatedMessages }));
      }
    }

    try {
      const result = await chatWithNeela(aiInput, studyState, navigator.onLine);
      
      const assistantMsg: ChatMessage = { 
        role: 'assistant', 
        content: result.response, 
        timestamp: new Date().toISOString() 
      };
      
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // AGENTIC EXECUTION: Check for [ACTION] blocks
      let newState = processNeelaAction(studyState, result.response);
      
      // Update session title if it's the first user message
      const session = newState.chatHistory.find(s => s.id === currentSessionId);
      if (session && session.title === 'New Strategy Session') {
        session.title = aiInput.slice(0, 30) + (aiInput.length > 30 ? '...' : '');
      }

      if (currentSessionId && session) {
        newState = updateChatSession(newState, { ...session, messages: finalMessages });
      }
      
      setStudyState(newState);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '## Error\nFailed to sync with the neural core.', timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-[#0a0a0c] text-white select-text overflow-hidden">
      {/* Sidebar History */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full bg-[#121218] border-r border-white/5 flex flex-col"
          >
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                <History size={14} /> History
              </h3>
              <button 
                onClick={createNewSession}
                className="p-1.5 rounded-lg hover:bg-white/5 text-blue-400 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {studyState.chatHistory.map(session => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 group ${
                    currentSessionId === session.id ? 'bg-blue-600/10 border border-blue-500/20' : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <MessageSquare size={16} className={`mt-0.5 ${currentSessionId === session.id ? 'text-blue-400' : 'text-white/20 group-hover:text-white/40'}`} />
                  <div className="flex-1 overflow-hidden">
                    <div className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-white' : 'text-white/60'}`}>
                      {session.title}
                    </div>
                    <div className="text-[10px] text-white/20 mt-0.5">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Quick Stats in Sidebar */}
            <div className="p-4 bg-white/5 border-t border-white/5">
               <div className="flex items-center gap-3 mb-3">
                  <BarChart2 size={16} className="text-purple-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Real JEE Scale</span>
               </div>
               <div className="space-y-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">Current Equivalent</span>
                    <span className="text-blue-400 font-bold">{studyState.testResults?.[0]?.jeeEquivalentPercentile || '0.00'}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${studyState.testResults?.[0]?.jeeEquivalentPercentile || 0}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40">Next Target</span>
                    <span className="text-purple-400 font-bold">{studyState.testResults?.[0]?.targetPercentile || '99.50'}%</span>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Toggle Sidebar Button */}
        <button 
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-12 bg-[#121218] border border-l-0 border-white/10 rounded-r-xl flex items-center justify-center text-white/20 hover:text-white/60 transition-all shadow-2xl"
        >
          {showSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#121218] border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Brain size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white/90">Neela Agent</h2>
              <p className="text-[10px] font-bold text-blue-400/60 uppercase tracking-tighter">Direct Control: Active</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
                <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">Context Stability</div>
                <div className="text-[10px] font-bold text-green-500 uppercase tracking-widest">100.0% PERSISTENT</div>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl p-4 shadow-2xl ${
                  m.role === 'user' 
                  ? 'bg-blue-600 text-white font-medium' 
                  : 'bg-white/5 border border-white/10 text-white/90'
                }`}>
                  {m.role === 'assistant' ? (
                    <div className="markdown-content space-y-3 text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/g, '')}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Neela is syncronizing...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="p-6 bg-[#0c0c10] border-t border-white/5">
          <div className="flex gap-3 max-w-4xl mx-auto relative">
            <input 
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Talk to Neela..."
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-blue-500/50 transition-all"
            />
            <button 
              onClick={sendMessage} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 px-6 rounded-2xl transition-all shadow-xl shadow-blue-600/20"
            >
              <Zap size={18} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .markdown-content h1 { font-size: 1.5rem; font-weight: 900; color: #fff; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
        .markdown-content h2 { font-size: 1.1rem; font-weight: 800; color: #60a5fa; margin-top: 1.5rem; margin-bottom: 0.75rem; text-transform: uppercase; }
        .markdown-content p { margin-bottom: 1rem; }
        .markdown-content li { margin-bottom: 0.5rem; list-style: disc; margin-left: 1rem; }
        .markdown-content strong { color: #fff; font-weight: 800; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
};

export default AureliusAI;
