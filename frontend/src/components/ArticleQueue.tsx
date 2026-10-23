import React, { useState } from 'react';
import { ArticleJob } from '../types';
import { 
  Skull, Folder, FileText, CheckCircle2, AlertTriangle, 
  Clock, ArrowRight, Trash2, Search, Play, Sparkles, Filter
} from 'lucide-react';

interface ArticleQueueProps {
  articles: ArticleJob[];
  selectedArticleId: number | null;
  onSelectArticle: (id: number) => void;
  onDeleteArticle: (id: number) => void;
  onBatchResearch: (ids: number[]) => void;
  onBatchGenerate: (ids: number[]) => void;
  isLoading: boolean;
}

export const ArticleQueue: React.FC<ArticleQueueProps> = ({
  articles,
  selectedArticleId,
  onSelectArticle,
  onDeleteArticle,
  onBatchResearch,
  onBatchGenerate,
  isLoading
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [hideDone, setHideDone] = useState<boolean>(true);

  // Filtering
  const filteredArticles = articles.filter(a => {
    let savedList: string[] = [];
    try {
      savedList = JSON.parse(localStorage.getItem('justapedia_saved_titles') || '[]');
    } catch {}
    // Once an article is saved, never display it in the list of articles needing updates
    if (savedList.includes(a.title)) return false;
    if (a.status === 'saved') return false;
    if (hideDone && (!a.audit_flags || a.audit_flags.length === 0)) return false;

    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.category && a.category.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'ready') return a.status === 'draft_ready';
    if (filterStatus === 'errors') return a.status === 'error';
    if (filterStatus === 'pending') return a.status === 'discovered' || a.status === 'analyzed';
    return a.status === filterStatus;
  });

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredArticles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredArticles.map(a => a.id));
    }
  };

  const handleToggleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">HIGH PRIORITY</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'saved':
        return <span className="flex items-center text-xs font-semibold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Published</span>;
      case 'draft_ready':
        return <span className="flex items-center text-xs font-semibold text-sky-600"><Sparkles className="w-3.5 h-3.5 mr-1" /> Draft Ready</span>;
      case 'researching':
        return <span className="flex items-center text-xs text-indigo-600 animate-pulse"><Clock className="w-3.5 h-3.5 mr-1" /> Researching...</span>;
      case 'analyzed':
        return <span className="flex items-center text-xs text-indigo-600"><Clock className="w-3.5 h-3.5 mr-1" /> Researched</span>;
      case 'error':
        return <span className="flex items-center text-xs font-medium text-rose-600"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Error</span>;
      case 'skipped':
        return <span className="text-xs text-slate-400">Skipped</span>;
      default:
        return <span className="text-xs text-slate-500">Discovered</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[750px]">
      
      {/* Queue Header & Filters */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="font-bold text-slate-900 text-base">Editorial Queue</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              {filteredArticles.length} of {articles.length}
            </span>
          </div>

          {/* Batch Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onBatchResearch(selectedIds)}
                disabled={isLoading}
                className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-md font-medium flex items-center space-x-1"
              >
                <Search className="w-3 h-3" />
                <span>Research ({selectedIds.length})</span>
              </button>
              <button
                onClick={() => onBatchGenerate(selectedIds)}
                disabled={isLoading}
                className="px-2.5 py-1 text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-md font-medium flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate ({selectedIds.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search queue by title or category..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Needing Updates' },
            { id: 'pending', label: 'Pending Research' },
            { id: 'ready', label: 'Draft Ready' },
            { id: 'errors', label: 'Errors' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                filterStatus === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Select All Checkbox Bar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filteredArticles.length > 0 && selectedIds.length > 0 && selectedIds.length === filteredArticles.length}
            onChange={handleToggleSelectAll}
            className="rounded text-sky-600 focus:ring-sky-500"
          />
          <span>Select All Visible ({selectedIds.length})</span>
        </label>
        <label className="flex items-center space-x-1.5 cursor-pointer text-slate-600 hover:text-slate-900">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="rounded text-sky-600 focus:ring-sky-500"
          />
          <span className="font-medium">Hide Completed</span>
        </label>
      </div>

      {/* Article List Scrollable Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredArticles.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No articles in this view</p>
            <p className="text-xs text-slate-400 mt-1">Use the Discovery bar above to find or add articles.</p>
          </div>
        ) : (
          filteredArticles.map(article => {
            const isSelected = selectedArticleId === article.id;
            const isChecked = selectedIds.includes(article.id);

            return (
              <div
                key={article.id}
                onClick={() => onSelectArticle(article.id)}
                className={`p-3.5 hover:bg-sky-50/50 cursor-pointer transition-colors relative ${
                  isSelected ? 'bg-sky-50/80 border-l-4 border-sky-600' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  
                  {/* Left: Checkbox + Title */}
                  <div className="flex items-start space-x-2.5 flex-1 pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(e) => handleToggleSelectOne(article.id, e)}
                      className="mt-1 rounded text-sky-600 focus:ring-sky-500"
                    />

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-1.5">
                        {article.mode === 'deceased' ? (
                          <span title="Deceased Mode"><Skull className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" /></span>
                        ) : article.mode === 'category' ? (
                          <span title="Category Mode"><Folder className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" /></span>
                        ) : (
                          <span title="Specific Article Mode"><FileText className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /></span>
                        )}
                        <span className="font-semibold text-slate-900 text-sm leading-tight hover:text-sky-600">
                          {article.title}
                        </span>
                        {!article.page_exists && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                            NEW
                          </span>
                        )}
                      </div>

                      {/* Audit Summary */}
                      {article.audit_summary && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {article.audit_summary}
                        </p>
                      )}

                      {/* Flags Tags */}
                      {article.audit_flags && article.audit_flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {article.audit_flags.map((flag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                            >
                              {flag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Badges & Delete */}
                  <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                    {getPriorityBadge(article.priority)}
                    {getStatusBadge(article.status)}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteArticle(article.id);
                      }}
                      className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
