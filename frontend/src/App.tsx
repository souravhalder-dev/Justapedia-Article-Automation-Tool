import React, { useState, useEffect } from 'react';
import { ArticleJob, AppSettings, WikiTestConnectionResponse, SaveToWikiResponse } from './types';
import { api } from './api';
import { Navbar } from './components/Navbar';
import { DiscoveryBar } from './components/DiscoveryBar';
import { ArticleQueue } from './components/ArticleQueue';
import { ArticleStudio } from './components/ArticleStudio';
import { SaveModal } from './components/SaveModal';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [articles, setArticles] = useState<ArticleJob[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [connection, setConnection] = useState<WikiTestConnectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

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
        setArticles(artList.value);
        if (artList.value.length > 0 && !selectedArticleId) {
          setSelectedArticleId(artList.value[0].id);
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
    loadInitialData();
  }, []);

  const selectedArticle = articles.find(a => a.id === selectedArticleId) || null;

  // Refresh single article in state
  const refreshArticle = async (id: number) => {
    try {
      const updated = await api.getArticle(id);
      setArticles(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error('Failed to refresh article', err);
    }
  };

  // Handlers for discovery
  const handleDiscoverDeceased = async (category: string, limit: number, incompleteOnly: boolean) => {
    setIsLoading(true);
    try {
      const newArticles = await api.discoverDeceased(category, limit, incompleteOnly);
      await loadInitialData();
      if (newArticles.length > 0) {
        setSelectedArticleId(newArticles[0].id);
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
      const newArticles = await api.discoverCategory(category, limit, incompleteOnly);
      await loadInitialData();
      if (newArticles.length > 0) {
        setSelectedArticleId(newArticles[0].id);
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
      await loadInitialData();
      if (added.length > 0) {
        setSelectedArticleId(added[0].id);
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
      const updated = await api.researchArticle(id);
      setArticles(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err: any) {
      alert(`Research failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (id: number) => {
    setIsLoading(true);
    try {
      const updated = await api.generateDraft(id);
      setArticles(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err: any) {
      alert(`Draft generation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDraft = async (id: number, wikitext: string) => {
    setIsLoading(true);
    try {
      const updated = await api.updateDraft(id, wikitext);
      setArticles(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err: any) {
      alert(`Failed to update draft: ${err.message}`);
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
    if (!selectedArticleId) throw new Error("No article selected");
    setIsLoading(true);
    try {
      const res = await api.saveToJustapedia(selectedArticleId, options);
      await refreshArticle(selectedArticleId);
      return res;
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

  const handleBatchResearch = async (ids: number[]) => {
    try {
      await api.batchResearch(ids);
      alert(`Queued background research for ${ids.length} articles!`);
      setTimeout(loadInitialData, 2000);
    } catch (err: any) {
      alert(`Batch research failed: ${err.message}`);
    }
  };

  const handleBatchGenerate = async (ids: number[]) => {
    try {
      await api.batchGenerate(ids);
      alert(`Queued background draft generation for ${ids.length} articles!`);
      setTimeout(loadInitialData, 2000);
    } catch (err: any) {
      alert(`Batch generation failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      
      {/* Top Navigation */}
      <Navbar
        settings={settings}
        connection={connection}
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
              onOpenSaveModal={() => setIsSaveModalOpen(true)}
              onSkip={handleSkip}
              isLoading={isLoading}
            />
          </div>

        </div>

      </main>

      {/* Save to Justapedia Modal Dialog */}
      {selectedArticle && (
        <SaveModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          article={selectedArticle}
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
      />

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
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-500 hover:text-slate-800 hover:underline"
            >
              Settings & Credentials
            </button>
            <span>•</span>
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
