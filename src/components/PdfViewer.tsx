import React, { useState, useRef } from 'react';
import { 
  X, FileText, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PdfTab {
  id: string;
  url: string;
  title: string;
}

const PdfViewer: React.FC = () => {
  const [tabs, setTabs] = useState<PdfTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const webviewRefs = useRef<Record<string, any>>({});

  // @ts-ignore
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

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

  const addTab = (url: string, title: string = 'Loading PDF...') => {
    if (!url) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newTab = { id: newId, url, title };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setInputUrl('');
  };

  const openLocalFile = async () => {
    if (isElectron) {
      try {
        // @ts-ignore
        const filePath = await window.electronAPI.invoke('open-file-dialog');
        if (filePath) {
          const fileName = filePath.split(/[\\/]/).pop() || 'Local PDF';
          addTab(filePath, fileName);
        }
      } catch (e) {
        console.error("Local file pick failed", e);
      }
    } else {
      alert("Local File Picker is only available in the Desktop App.");
    }
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
    }
    delete webviewRefs.current[id];
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTab(inputUrl);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-white select-none overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-2 pt-2 bg-[#121216] border-b border-white/5 overflow-x-auto no-scrollbar">
        <AnimatePresence initial={false}>
          {tabs.map(tab => (
            <motion.div
              key={tab.id}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 160, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-t-xl text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                activeTabId === tab.id 
                ? 'bg-[#1a1a1f] text-white border-t border-x border-white/10' 
                : 'text-white/40 hover:bg-white/5'
              }`}
            >
              <FileText size={12} className="text-orange-400" />
              <span className="truncate flex-1">{tab.title}</span>
              <X 
                size={12} 
                className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-full p-0.5" 
                onClick={(e) => closeTab(tab.id, e)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        
        <button 
            onClick={openLocalFile}
            title="Open from Computer"
            className="p-1.5 ml-2 mb-1 hover:bg-white/10 rounded-lg text-orange-400 transition-colors"
        >
            <Monitor size={16} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-[#1c1c1e]">
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-orange-500/10 flex items-center justify-center mb-6 border border-orange-500/20">
              <FileText size={40} className="text-orange-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">Study Materials Viewer</h2>
            <p className="text-white/40 text-sm max-w-xs mb-8">
              Open your textbook or paste a link to start studying.
            </p>
            
            <div className="flex flex-col gap-4 w-full max-w-sm">
                <button 
                    onClick={openLocalFile}
                    className="flex items-center justify-center gap-3 bg-orange-600 hover:bg-orange-500 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-orange-900/20 transition-all"
                >
                    <Monitor size={18} />
                    OPEN FROM COMPUTER
                </button>
                
                <div className="flex items-center gap-4 text-white/20">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-widest">OR PASTE URL</span>
                    <div className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={handleAddSubmit} className="flex gap-2">
                    <input 
                        value={inputUrl}
                        onChange={e => setInputUrl(e.target.value)}
                        placeholder="https://static.pw.live/..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-orange-500/50"
                    />
                    <button type="submit" className="bg-white/10 hover:bg-white/20 px-4 rounded-xl font-bold text-xs transition-all">
                        LOAD
                    </button>
                </form>
            </div>
          </div>
        ) : (
          tabs.map(tab => (
            <div 
              key={tab.id} 
              className="absolute inset-0 w-full h-full"
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            >
              {isElectron ? (
                <webview
                    ref={(el) => {
                      if (el) {
                        webviewRefs.current[tab.id] = el;
                        if (!(el as any).dataset.listenerAttached) {
                          (el as any).dataset.listenerAttached = 'true';
                          (el as any).addEventListener('did-stop-loading', () => {
                            const wv = webviewRefs.current[tab.id];
                            if (wv) {
                              wv.executeJavaScript('document.title').then((title: string) => {
                                if (title && !title.includes('.pdf') && !title.includes('file://')) {
                                  setTabs((prev: PdfTab[]) => prev.map(t => t.id === tab.id ? { ...t, title } : t));
                                }
                              });
                            }
                          });
                        }
                      }
                    }}
                    src={tab.url}
                    className="w-full h-full"
                    partition="persist:studyos-v3"
                    allowpopups
                    preload={getPreloadPath()}
                    webpreferences="contextIsolation=true, nodeIntegration=false, sandbox=true, plugins=true"
                />
              ) : (
                <iframe 
                    src={tab.url} 
                    className="w-full h-full border-none bg-white" 
                    onLoad={() => setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, title: 'PDF Preview' } : t))}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
