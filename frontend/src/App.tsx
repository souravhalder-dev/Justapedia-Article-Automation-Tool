import React, { useState, useEffect, useRef } from 'react';
import { ArticleJob, AppSettings, WikiTestConnectionResponse, SaveToWikiResponse, AuthUser } from './types';
import { api } from './api';
import { Navbar } from './components/Navbar';
import { DiscoveryBar } from './components/DiscoveryBar';
import { ArticleQueue } from './components/ArticleQueue';
import { ArticleStudio } from './components/ArticleStudio';
import { SaveModal } from './components/SaveModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { Sparkles, Search, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

interface BatchProgressState {
  isOpen: boolean;
  type: 'generate' | 'research';
  total: number;
  current: number;
  currentTitle: string;
  successCount: number;
  errorCount: number;
  isComplete: boolean;
  errors: { title: string; error: string }[];
}

export function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [articles, setArticles] = useState<ArticleJob[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [connection, setConnection] = useState<WikiTestConnectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveModalArticle, setSaveModalArticle] = useState<ArticleJob | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | null>(null);
  const batchCancelRef = useRef<boolean>(false);

  // Check auth and load initial data
  const checkAuthAndLoad = async () => {
    setIsAuthChecking(true);
    try {
      const user = await api.getMe();
      if (user.logged_in) {
        setAuthUser(user);
        await loadInitialData();
      } else {
        setAuthUser(null);
      }
    } catch (e) {
      setAuthUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleLoginSuccess = async (username: string) => {
    setAuthUser({ logged_in: true, username });
    await loadInitialData();
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthUser(null);
    setArticles([]);
    setSelectedArticleId(null);
    localStorage.removeItem('justapedia_queue');
  };

  // Load initial data
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [artList, currentSettings, wikiConn] = await Promise.allSettled([
        api.getArticles(),
        api.getSettings(),
        api.testWikiConnection()
      ]);

      if (artList.status === 'fulfilled') {
        let savedList: string[] = [];
        try { savedList = JSON.parse(localStorage.getItem('justapedia_saved_titles') || '[]'); } catch {}
        let list = artList.value.filter(a => a.status !== 'saved' && !savedList.includes(a.title));
        if (list.length === 0) {
          const cached = localStorage.getItem('justapedia_queue');
          if (cached) {
            try { 
              const parsed = JSON.parse(cached);
              list = parsed.filter((a: any) => a.status !== 'saved' && !savedList.includes(a.title));
            } catch {}
          }
        }
        setArticles(list);
        if (list.length > 0 && !selectedArticleId) {
          setSelectedArticleId(list[0].id);
        }
      }
      if (currentSettings.status === 'fulfilled') {
        setSettings(currentSettings.value);
      }
      if (wikiConn.status === 'fulfilled') {
        setConnection(wikiConn.value);
      }
    } catch (e) {
      console.error('Error loading initial data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const selectedArticle = articles.find(a => a.id === selectedArticleId) || null;

  // Refresh single article in state
  const refreshArticle = async (id: number) => {
    try {
      const art = articles.find(a => a.id === id);
      const updated = await api.getArticle(id, art?.title);
      setArticles(prev => {
        const next = prev.map(a => a.id === id ? updated : a);
        localStorage.setItem('justapedia_queue', JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error('Failed to refresh article', err);
    }
  };

  // Handlers for discovery
  const handleDiscoverDeceased = async (category: string, limit: number, incompleteOnly: boolean) => {
    setIsLoading(true);
    try {
      let savedList: string[] = [];
      try { savedList = JSON.parse(localStorage.getItem('justapedia_saved_titles') || '[]'); } catch {}
      const newArticles = await api.discoverDeceased(category, limit, incompleteOnly, savedList);
      const filtered = newArticles.filter(a => a.status !== 'saved' && !savedList.includes(a.title));
      if (filtered.length > 0) {
        setArticles(filtered);
        localStorage.setItem('justapedia_queue', JSON.stringify(filtered));
        setSelectedArticleId(filtered[0].id);
      } else {
        await loadInitialData();
      }
    } catch (err: any) {
      alert(`Discovery failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscoverCategory = async (category: string, limit: number, incompleteOnly: boolean) => {
    setIsLoading(true);
    try {
      let savedList: string[] = [];
      try { savedList = JSON.parse(localStorage.getItem('justapedia_saved_titles') || '[]'); } catch {}
      const newArticles = await api.discoverCategory(category, limit, incompleteOnly, savedList);
      const filtered = newArticles.filter(a => a.status !== 'saved' && !savedList.includes(a.title));
      if (filtered.length > 0) {
        setArticles(filtered);
        localStorage.setItem('justapedia_queue', JSON.stringify(filtered));
        setSelectedArticleId(filtered[0].id);
      } else {
        await loadInitialData();
      }
    } catch (err: any) {
      alert(`Category scan failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSpecificArticles = async (titles: string[]) => {
    setIsLoading(true);
    try {
      const added = await api.addSpecificArticles(titles);
      if (added.length > 0) {
        setArticles(prev => {
          const next = [...added, ...prev.filter(p => !added.some(a => a.id === p.id))];
          localStorage.setItem('justapedia_queue', JSON.stringify(next));
          return next;
        });
        setSelectedArticleId(added[0].id);
      } else {
        await loadInitialData();
      }
    } catch (err: any) {
      alert(`Failed to add articles: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for editorial actions
  const handleResearch = async (id: number) => {
    setIsLoading(true);
    try {
      const art = articles.find(a => a.id === id);
      const updated = await api.researchArticle(id, art?.title);
      setArticles(prev => {
        const next = prev.map(a => a.id === id ? updated : a);
        localStorage.setItem('justapedia_queue', JSON.stringify(next));
        return next;
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('session expired') || err.message.toLowerCase().includes('authentication required'))) {
        setAuthUser(null);
        localStorage.removeItem('justapedia_auth_token');
        alert("Your Justapedia session has expired. Please sign in again.");
      } else {
        alert(`Research failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (id: number) => {
    setIsLoading(true);
    try {
      const art = articles.find(a => a.id === id);
      const updated = await api.generateDraft(id, art?.title);
      setArticles(prev => {
        const next = prev.map(a => a.id === id ? updated : a);
        localStorage.setItem('justapedia_queue', JSON.stringify(next));
        return next;
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('session expired') || err.message.toLowerCase().includes('authentication required'))) {
        setAuthUser(null);
        localStorage.removeItem('justapedia_auth_token');
        alert("Your Justapedia session has expired. Please sign in again.");
      } else {
        alert(`Draft generation failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDraft = async (id: number, wikitext: string) => {
    setIsLoading(true);
    try {
      const art = articles.find(a => a.id === id);
      const updated = await api.updateDraft(id, wikitext, art?.title);
      setArticles(prev => {
        const next = prev.map(a => a.id === id ? updated : a);
        localStorage.setItem('justapedia_queue', JSON.stringify(next));
        return next;
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('session expired') || err.message.toLowerCase().includes('authentication required'))) {
        setAuthUser(null);
        localStorage.removeItem('justapedia_auth_token');
        alert("Your Justapedia session has expired. Please sign in again.");
      } else {
        alert(`Failed to update draft: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSave = async (options: {
    custom_title?: string;
    wikitext: string;
    edit_summary: string;
    is_minor?: boolean;
    is_bot?: boolean;
    use_sandbox?: boolean;
  }): Promise<SaveToWikiResponse> => {
    const targetArticle = saveModalArticle || selectedArticle;
    if (!targetArticle) throw new Error("No article selected");
    setIsLoading(true);
    try {
      const res = await api.saveToJustapedia(targetArticle.id, options, targetArticle.title);
      
      if (res.success) {
        // Once successfully updated and saved, record in persistent storage so it is permanently excluded
        try {
          const savedList: string[] = JSON.parse(localStorage.getItem('justapedia_saved_titles') || '[]');
          if (targetArticle.title && !savedList.includes(targetArticle.title)) {
            savedList.push(targetArticle.title);
            localStorage.setItem('justapedia_saved_titles', JSON.stringify(savedList));
          }
        } catch {}

        // Remove from current queue and advance to next article seamlessly
        const remaining = articles.filter(a => a.id !== targetArticle.id);
        setArticles(remaining);
        localStorage.setItem('justapedia_queue', JSON.stringify(remaining));
        if (remaining.length > 0) {
          setSelectedArticleId(remaining[0].id);
        } else {
          setSelectedArticleId(null);
        }
      } else {
        await refreshArticle(targetArticle.id);
      }
      return res;
    } catch (err: any) {
      if (err.message && (err.message.includes('401') || err.message.toLowerCase().includes('session expired') || err.message.toLowerCase().includes('authentication required'))) {
        setAuthUser(null);
        localStorage.removeItem('justapedia_auth_token');
        throw new Error("Your Justapedia session has expired. Please sign in again.");
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async (id: number) => {
    try {
      const updated = await api.skipArticle(id);
      setArticles(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err: any) {
      alert(`Failed to skip: ${err.message}`);
    }
  };

  const handleDeleteArticle = async (id: number) => {
    if (!confirm("Remove this article from your queue?")) return;
    try {
      await api.deleteArticle(id);
      setArticles(prev => prev.filter(a => a.id !== id));
      if (selectedArticleId === id) {
        setSelectedArticleId(null);
      }
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const startBatchProcess = async (ids: number[], type: 'generate' | 'research') => {
    if (ids.length === 0) return;
    batchCancelRef.current = false;
    
    setBatchProgress({
      isOpen: true,
      type,
      total: ids.length,
      current: 0,
      currentTitle: 'Starting batch...',
      successCount: 0,
      errorCount: 0,
      isComplete: false,
      errors: []
    });

    let currentSuccess = 0;
    let currentErrors = 0;
    const errorsList: { title: string; error: string }[] = [];

    for (let i = 0; i < ids.length; i++) {
      if (batchCancelRef.current) break;
      const id = ids[i];
      const art = articles.find(a => a.id === id);
      const title = art?.title || `Article #${id}`;

      setBatchProgress(prev => prev ? ({
        ...prev,
        current: i + 1,
        currentTitle: title
      }) : null);

      try {
        let updated: ArticleJob;
        if (type === 'generate') {
          updated = await api.generateDraft(id, art?.title);
        } else {
          updated = await api.researchArticle(id, art?.title);
        }

        currentSuccess++;
        setArticles(prev => {
          const next = prev.map(a => a.id === id ? updated : a);
          localStorage.setItem('justapedia_queue', JSON.stringify(next));
          return next;
        });
      } catch (err: any) {
        currentErrors++;
        errorsList.push({ title, error: err.message || 'Processing failed' });
      }

      setBatchProgress(prev => prev ? ({
        ...prev,
        successCount: currentSuccess,
        errorCount: currentErrors,
        errors: errorsList
      }) : null);
    }

    setBatchProgress(prev => prev ? ({
      ...prev,
      isComplete: true,
      currentTitle: batchCancelRef.current ? 'Batch stopped by user.' : 'Batch processing complete!'
    }) : null);
  };

  const handleBatchResearch = (ids: number[]) => startBatchProcess(ids, 'research');
  const handleBatchGenerate = (ids: number[]) => startBatchProcess(ids, 'generate');

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center space-x-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
          <span className="text-sm font-medium">Verifying Justapedia authentication...</span>
        </div>
      </div>
    );
  }

  if (!authUser || !authUser.logged_in) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      
      {/* Top Navigation */}
      <Navbar
        settings={settings}
        connection={connection}
        currentUser={authUser.username || 'Editor'}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefresh={loadInitialData}
        isLoading={isLoading}
      />

      {/* Main Workspace Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Discovery Bar */}
        <DiscoveryBar
          onDiscoverDeceased={handleDiscoverDeceased}
          onDiscoverCategory={handleDiscoverCategory}
          onAddSpecificArticles={handleAddSpecificArticles}
          isLoading={isLoading}
        />

        {/* Two-Column Editorial Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Queue & Batch Manager (4 cols) */}
          <div className="lg:col-span-4">
            <ArticleQueue
              articles={articles}
              selectedArticleId={selectedArticleId}
              onSelectArticle={(id) => setSelectedArticleId(id)}
              onDeleteArticle={handleDeleteArticle}
              onBatchResearch={handleBatchResearch}
              onBatchGenerate={handleBatchGenerate}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column: Studio & Review Workspace (8 cols) */}
          <div className="lg:col-span-8">
            <ArticleStudio
              article={selectedArticle}
              onResearch={handleResearch}
              onGenerate={handleGenerate}
              onUpdateDraft={handleUpdateDraft}
              onOpenSaveModal={() => {
                if (selectedArticle) {
                  setSaveModalArticle(selectedArticle);
                  setIsSaveModalOpen(true);
                }
              }}
              onSkip={handleSkip}
              isLoading={isLoading}
            />
          </div>

        </div>

      </main>

      {/* Save to Justapedia Modal Dialog */}
      {(saveModalArticle || selectedArticle) && (
        <SaveModal
          isOpen={isSaveModalOpen}
          onClose={() => {
            setIsSaveModalOpen(false);
            setSaveModalArticle(null);
          }}
          article={saveModalArticle || selectedArticle!}
          settings={settings}
          onConfirmSave={handleConfirmSave}
          isLoading={isLoading}
        />
      )}

      {/* Settings & Credentials Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={async (newSettings) => {
          await api.updateSettings(newSettings);
          const updated = await api.getSettings();
          setSettings(updated);
        }}
        onTestWiki={api.testWikiConnection}
        onLoginWiki={api.loginWiki}
        onTestOllama={api.testOllamaConnection}
      />

      {/* Batch Processing Interactive Modal */}
      {batchProgress && batchProgress.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                  {batchProgress.type === 'generate' ? <Sparkles className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {batchProgress.type === 'generate' ? 'Batch Draft Generation' : 'Batch Research'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {batchProgress.isComplete ? 'Operation finished' : `Processing article ${batchProgress.current} of ${batchProgress.total}`}
                  </p>
                </div>
              </div>
              {batchProgress.isComplete && (
                <button
                  onClick={() => setBatchProgress(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Progress Bar & Current Label */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span className="truncate max-w-[280px]">
                  {!batchProgress.isComplete ? `Current: ${batchProgress.currentTitle}` : batchProgress.currentTitle}
                </span>
                <span>{batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    batchProgress.isComplete ? 'bg-emerald-500' : 'bg-sky-500'
                  }`}
                  style={{ width: `${batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Stats Counter */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <div className="text-lg font-bold text-emerald-800">{batchProgress.successCount}</div>
                  <div className="text-xs font-medium text-emerald-600">Processed Ready</div>
                </div>
              </div>
              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3 flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <div>
                  <div className="text-lg font-bold text-rose-800">{batchProgress.errorCount}</div>
                  <div className="text-xs font-medium text-rose-600">Errors</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              {!batchProgress.isComplete ? (
                <button
                  onClick={() => { batchCancelRef.current = true; }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Stop Batch
                </button>
              ) : (
                <button
                  onClick={() => setBatchProgress(null)}
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5">
            <span>Developed by <strong>Sourav</strong></span>
            <span>•</span>
            <a 
              href="mailto:skhsouravhalder@gmail.com" 
              className="text-sky-600 hover:text-sky-800 hover:underline font-medium"
            >
              skhsouravhalder@gmail.com
            </a>
            <span>•</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200">
              GPL-3.0+
            </span>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <a
              href="https://justapedia.org"
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-slate-800 hover:underline"
            >
              Justapedia.org
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
