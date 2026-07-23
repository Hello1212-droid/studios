import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, ArrowRight, RotateCw, Home, Lock, X, Plus, Globe, FileText, AlertCircle, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AISidebar from './AISidebar';

interface Tab {
  id: string;
  url: string;
  title: string;
  loading: boolean;
  isPdf: boolean;
  error?: string;
}

const Browser: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', url: 'https://www.google.com', title: 'Google', loading: false, isPdf: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [addressInput, setAddressInput] = useState('https://www.google.com');
  const [isAIOpen, setIsAIOpen] = useState(false);

  const webviewRefs = useRef<Record<string, any>>({});
  
  // @ts-ignore
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

  const getPreloadPath = () => {
    if (!isElectron) return '';
    try {
        // @ts-ignore
        if (window.electronAPI && window.electronAPI.getPreloadPath) {
          // @ts-ignore
          return window.electronAPI.getPreloadPath();
        }
        return '';
    } catch (e) {
        return '';
    }
  };

  const addTab = useCallback((url = 'https://www.google.com') => {
    const isPdf = url.toLowerCase().includes('.pdf');
    const newId = Math.random().toString(36).substr(2, 9);
    setTabs(prev => [...prev, { id: newId, url, title: isPdf ? 'PDF Viewer' : 'New Tab', loading: true, isPdf }]);
    setActiveTabId(newId);
    setAddressInput(url);
  }, []);

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      const nextTab = newTabs[newTabs.length - 1];
      setActiveTabId(nextTab.id);
      setAddressInput(nextTab.url);
    }
    delete webviewRefs.current[id];
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = addressInput.trim();
    if (!targetUrl) return;
    if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
      if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    } else {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
    }
    
    // Load directly — no Google auth interception
    if (isElectron) {
      webviewRefs.current[activeTabId]?.loadURL(targetUrl);
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, url: targetUrl, title: 'Loading...', error: undefined, loading: true } : t));
    } else {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, url: targetUrl, title: 'Loading...', error: undefined } : t));
    }
  };

  useEffect(() => {
    if (isElectron) {
      // @ts-ignore
      if (window.electronAPI && window.electronAPI.onNewTab) {
        // @ts-ignore
        window.electronAPI.onNewTab((url: string) => {
          addTab(url);
        });
      }
    }
  }, [addTab, isElectron]);

  const clearError = (tabId: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, error: undefined } : t));
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-white select-none">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-2 pt-2 bg-[#121216] border-b border-white/5 overflow-x-auto no-scrollbar">
        <AnimatePresence initial={false}>
          {tabs.map(tab => (
            <motion.div
              key={tab.id}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 180, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              onClick={() => { setActiveTabId(tab.id); setAddressInput(tab.url); }}
              className={`group flex items-center gap-2 px-3 py-2 rounded-t-xl text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                activeTabId === tab.id 
                ? 'bg-[#1a1a1f] text-white border-t border-x border-white/10' 
                : 'text-white/40 hover:bg-white/5'
              }`}
              title={tab.title}
            >
              {tab.isPdf ? <FileText size={12} className="text-orange-400" /> : 
               <Globe size={12} className={tab.loading ? 'animate-spin' : ''} />}
              <span className="truncate flex-1">{tab.title}</span>
              <X size={12} className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-full p-0.5 cursor-pointer" onClick={(e) => closeTab(tab.id, e)} />
            </motion.div>
          ))}
        </AnimatePresence>
        <button onClick={() => addTab()} className="p-1.5 ml-1 mb-1 hover:bg-white/10 rounded-lg text-white/40" title="New Tab"><Plus size={16} /></button>
        
        {/* Ask AI Button */}
        <motion.button
          onClick={() => setIsAIOpen(!isAIOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`p-1.5 ml-2 mb-1 rounded-lg transition-all ${
            isAIOpen 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' 
              : 'hover:bg-white/10 text-white/60 hover:text-white'
          }`}
          title="Ask AI about current tab"
        >
          <Sparkles size={16} />
        </motion.button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 p-2 bg-[#1a1a1f] border-b border-white/5">
        <div className="flex items-center gap-1">
          <button onClick={() => isElectron && webviewRefs.current[activeTabId]?.goBack()} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70" title="Back"><ArrowLeft size={16} /></button>
          <button onClick={() => isElectron && webviewRefs.current[activeTabId]?.goForward()} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70" title="Forward"><ArrowRight size={16} /></button>
          <button onClick={() => isElectron && webviewRefs.current[activeTabId]?.reload()} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70" title="Reload"><RotateCw size={16} /></button>
        </div>
        
        <form onSubmit={handleNavigate} className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 focus-within:bg-white/10 focus-within:border-blue-500/50">
          <Lock size={12} className="text-green-400 mr-2 opacity-70" />
          <input 
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-full text-white/90"
            spellCheck={false}
            placeholder="Enter URL or search..."
          />
        </form>

        <button onClick={() => isElectron && webviewRefs.current[activeTabId]?.loadURL('https://www.google.com')} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60" title="Home"><Home size={16} /></button>
      </div>

      {/* Error Banner */}
      {activeTab?.error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border-b border-red-500/30 text-red-200 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1">{activeTab.error}</span>
          <button onClick={() => clearError(activeTabId)} className="text-red-300 hover:text-red-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content Area with Webview + AI Sidebar */}
      <div className="flex flex-1 relative bg-white overflow-hidden">
        {/* Webview Container */}
        <div className="flex-1 relative">
          {tabs.map(tab => (
            <div key={tab.id} className="absolute inset-0 w-full h-full" style={{ display: tab.id === activeTabId ? 'block' : 'none' }}>
              {isElectron ? (
                 <webview
                  ref={(el: any) => {
                    if (el) {
                      webviewRefs.current[tab.id] = el;
                      if (!el.dataset.listenerAttached) {
                        el.dataset.listenerAttached = 'true';

                        el.addEventListener('new-window', (e: any) => {
                          e.preventDefault();
                          addTab(e.url);
                        });
                        
                        el.addEventListener('console-message', (e: any) => {
                          console.log(`[Tab ${tab.id}] ${e.message}`);
                        });
                        
                        el.addEventListener('did-stop-loading', () => {
                          const wv = webviewRefs.current[tab.id];
                          if (wv) {
                            const currentUrl = wv.getURL();
                            wv.executeJavaScript('document.title').then((title: string) => {
                              setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, loading: false, title: title || 'Page', url: currentUrl } : t));
                              if (tab.id === activeTabId) setAddressInput(currentUrl);
                            }).catch(() => {});
                          }
                        });

                        el.addEventListener('did-fail-load', (e: any) => {
                          if (e.errorCode !== -3 && e.errorCode !== -6) {
                            setTabs(prev => prev.map(t => t.id === tab.id ? { 
                              ...t, 
                              loading: false, 
                              error: `Failed to load: ${e.errorDescription || 'Unknown error'}` 
                            } : t));
                          }
                        });

                        el.addEventListener('crashed', () => {
                          setTabs(prev => prev.map(t => t.id === tab.id ? { 
                            ...t, 
                            error: 'Webview crashed. Try reloading.' 
                          } : t));
                        });
                      }
                    } else {
                      delete webviewRefs.current[tab.id];
                    }
                  }}
                  src={tab.url}
                  className="w-full h-full bg-[#121216]"
                  partition="persist:studyos-v3"
                  allowpopups
                  useragent={CHROME_UA}
                  preload={getPreloadPath()}
                />
              ) : (
                <iframe 
                  src={tab.url} 
                  className="w-full h-full border-none" 
                  onLoad={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, loading: false, title: 'Web Preview' } : t))}
                />
              )}
            </div>
          ))}
        </div>

        {/* AI Sidebar - Contained within Browser Window */}
        <AnimatePresence>
          {isAIOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 384, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="border-l border-white/10 bg-gradient-to-b from-[#1a1a1f] to-[#0a0a0c] flex flex-col overflow-hidden"
            >
              <AISidebar
                isOpen={true}
                onClose={() => setIsAIOpen(false)}
                currentTabUrl={tabs.find(t => t.id === activeTabId)?.url || ''}
                currentTabTitle={tabs.find(t => t.id === activeTabId)?.title || 'Page'}
                webviewRef={webviewRefs.current[activeTabId]}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Browser;
