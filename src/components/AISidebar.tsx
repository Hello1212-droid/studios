import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Plus, MessageSquare, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
import { Groq } from 'groq-sdk';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tabInfo?: string;
}

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentTabUrl: string;
  currentTabTitle: string;
  webviewRef?: any;
}

const AISidebar: React.FC<AISidebarProps> = ({ 
  onClose, 
  currentTabUrl, 
  currentTabTitle,
  webviewRef
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistories, setChatHistories] = useState<{ title: string; messages: Message[] }[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const groqApiKey = process.env.GROQ_API_KEY || "";
  const groq = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aiBotChat');
    if (saved) {
      const data = JSON.parse(saved);
      setChatHistories(data.histories || []);
      setMessages(data.currentMessages || []);
    }
  }, []);

  // Save to localStorage
  const saveChatHistory = useCallback((newMessages: Message[]) => {
    setMessages(newMessages);
    const data = {
      histories: chatHistories,
      currentMessages: newMessages
    };
    localStorage.setItem('aiBotChat', JSON.stringify(data));
  }, [chatHistories]);

  const captureTabScreenshot = async () => {
    if (!webviewRef) return null;
    try {
      const image = await webviewRef.capturePage();
      return image.toDataURL();
    } catch (e) {
      console.log('Screenshot capture not available in this context');
      return null;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
      tabInfo: `[Current Tab: ${currentTabTitle}] ${currentTabUrl}`
    };

    saveChatHistory([...messages, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const screenshot = await captureTabScreenshot();
      const imageContext = screenshot 
        ? `\n[Tab Screenshot captured]\n` 
        : '\n[Could not capture screenshot]\n';

      const systemPrompt = `You are a helpful AI assistant integrated into a browser. The user is asking about their current tab:
Title: ${currentTabTitle}
URL: ${currentTabUrl}
${imageContext}

Be concise, helpful, and focused on the user's question. If they ask about the webpage, use the visual context to help.`;

      let fullResponse = '';
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          })),
          {
            role: 'user',
            content: inputValue
          }
        ],
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0.7,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: true,
        stop: null
      });

      for await (const chunk of chatCompletion) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
      }

      const assistantMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now()
      };

      saveChatHistory([...messages, userMessage, assistantMessage]);
    } catch (error) {
      console.error('Groq API error:', error);
      const errorMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response from Groq API'}`,
        timestamp: Date.now()
      };
      saveChatHistory([...messages, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    if (messages.length > 0) {
      const title = messages[0]?.content?.substring(0, 30) + '...' || 'Chat';
      setChatHistories([...chatHistories, { title, messages }]);
    }
    setMessages([]);
    setSelectedHistory(null);
    localStorage.setItem('aiBotChat', JSON.stringify({
      histories: chatHistories,
      currentMessages: []
    }));
  };

  const loadChatHistory = (index: number) => {
    setSelectedHistory(index);
    setMessages(chatHistories[index].messages);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-blue-400" />
          <h2 className="text-white font-bold text-sm">Ask AI</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Chat History Tabs */}
      {chatHistories.length > 0 && (
        <div className="flex gap-2 p-2 border-b border-white/5 overflow-x-auto no-scrollbar flex-shrink-0">
          <button
            onClick={() => setSelectedHistory(null)}
            className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
              selectedHistory === null
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Current
          </button>
          {chatHistories.map((_, idx) => (
            <button
              key={idx}
              onClick={() => loadChatHistory(idx)}
              className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                selectedHistory === idx
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              Chat {idx + 1}
            </button>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-white/40 py-8">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start a conversation</p>
            <p className="text-xs opacity-60 mt-2 truncate">{currentTabTitle}</p>
          </div>
        ) : (
          messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/90'
                }`}
              >
                {msg.tabInfo && (
                  <div className="text-xs opacity-60 mb-1 truncate">
                    {msg.tabInfo}
                  </div>
                )}
                <p className="break-words">{msg.content}</p>
              </div>
            </motion.div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-white/90 px-3 py-2 rounded-lg flex items-center gap-2">
              <Loader size={16} className="animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-3 space-y-2 flex-shrink-0">
        <button
          onClick={startNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/70 text-sm transition"
        >
          <Plus size={16} />
          New Chat
        </button>
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Ask about..."
            disabled={isLoading}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 outline-none focus:bg-white/15 focus:border-blue-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 rounded-lg text-white transition"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-xs text-white/30 text-center">Groq Llama</p>
      </div>
    </>
  );
};

export default AISidebar;
