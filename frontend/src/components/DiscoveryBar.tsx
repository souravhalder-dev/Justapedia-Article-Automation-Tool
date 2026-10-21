import React, { useState } from 'react';
import { Skull, FolderSearch, FileEdit, Search, PlusCircle, Filter } from 'lucide-react';

interface DiscoveryBarProps {
  onDiscoverDeceased: (category: string, limit: number, incompleteOnly: boolean) => Promise<void>;
  onDiscoverCategory: (category: string, limit: number, incompleteOnly: boolean) => Promise<void>;
  onAddSpecificArticles: (titles: string[]) => Promise<void>;
  isLoading: boolean;
}

export const DiscoveryBar: React.FC<DiscoveryBarProps> = ({
  onDiscoverDeceased,
  onDiscoverCategory,
  onAddSpecificArticles,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'deceased' | 'category' | 'specific'>('deceased');
  
  // Deceased Mode States
  const [deceasedCategory, setDeceasedCategory] = useState<string>('Category:2024 deaths');
  const [deceasedLimit, setDeceasedLimit] = useState<number>(50);
  const [deceasedIncompleteOnly, setDeceasedIncompleteOnly] = useState<boolean>(true);

  // Category Mode States
  const [customCategory, setCustomCategory] = useState<string>('');
  const [categoryLimit, setCategoryLimit] = useState<number>(20);
  const [categoryIncompleteOnly, setCategoryIncompleteOnly] = useState<boolean>(false);

  // Specific Article Mode States
  const [manualTitles, setManualTitles] = useState<string>('');

  const handleDeceasedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDiscoverDeceased(deceasedCategory, deceasedLimit, deceasedIncompleteOnly);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCategory.trim()) return;
    onDiscoverCategory(customCategory.trim(), categoryLimit, categoryIncompleteOnly);
  };

  const handleSpecificSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const titles = manualTitles
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    if (titles.length === 0) return;
    onAddSpecificArticles(titles);
    setManualTitles('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      {/* Mode Tab Buttons */}
      <div className="flex border-b border-slate-200 bg-slate-50/80">
        <button
          onClick={() => setActiveTab('deceased')}
          className={`flex-1 py-3.5 px-4 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'deceased'
              ? 'border-sky-600 text-sky-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Skull className="w-4 h-4 text-rose-500" />
          <span>Deceased Individuals Mode</span>
        </button>

        <button
          onClick={() => setActiveTab('category')}
          className={`flex-1 py-3.5 px-4 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'category'
              ? 'border-sky-600 text-sky-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <FolderSearch className="w-4 h-4 text-indigo-500" />
          <span>Category Scan Mode</span>
        </button>

        <button
          onClick={() => setActiveTab('specific')}
          className={`flex-1 py-3.5 px-4 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'specific'
              ? 'border-sky-600 text-sky-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <FileEdit className="w-4 h-4 text-emerald-500" />
          <span>Specific Article Mode</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-5">
        {/* Deceased Individuals Mode */}
        {activeTab === 'deceased' && (
          <form onSubmit={handleDeceasedSubmit} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Year Categories:</span>
              {['2024 deaths', '2023 deaths', '2025 deaths', '2022 deaths'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDeceasedCategory(`Category:${preset}`)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    deceasedCategory === `Category:${preset}`
                      ? 'bg-rose-50 border-rose-400 text-rose-700 font-medium'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Justapedia Death Category
                </label>
                <input
                  type="text"
                  value={deceasedCategory}
                  onChange={(e) => setDeceasedCategory(e.target.value)}
                  placeholder="e.g. Category:2024 deaths"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Article Limit
                </label>
                <select
                  value={deceasedLimit}
                  onChange={(e) => setDeceasedLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value={10}>10 articles</option>
                  <option value={20}>20 articles</option>
                  <option value={35}>35 articles</option>
                  <option value={50}>50 articles</option>
                  <option value={100}>100 articles</option>
                </select>
              </div>

              <div className="md:col-span-3 flex items-center h-10">
                <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={deceasedIncompleteOnly}
                    onChange={(e) => setDeceasedIncompleteOnly(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Only Articles Needing Updates (Death, Birth, Gaps)</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Discover</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Scans Justapedia for up to your requested limit of articles needing updates (missing death/birth dates, causes/places of death, living category contradictions, or stubs). Complete and already-saved articles are skipped.
            </p>
          </form>
        )}

        {/* Category Scan Mode */}
        {activeTab === 'category' && (
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-7">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Justapedia Category Name
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Category:American television actresses or Category:Pulitzer Prize winners"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Limit
                </label>
                <select
                  value={categoryLimit}
                  onChange={(e) => setCategoryLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value={15}>15 articles</option>
                  <option value={30}>30 articles</option>
                  <option value={50}>50 articles</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={isLoading || !customCategory.trim()}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <FolderSearch className="w-4 h-4" />
                  <span>Scan Category</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Retrieves all category members from Justapedia Wiki and audits each page for missing references, section gaps, and outdated facts.
            </p>
          </form>
        )}

        {/* Specific Article Mode */}
        {activeTab === 'specific' && (
          <form onSubmit={handleSpecificSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Article Titles (Enter one per line for batch research or creation)
              </label>
              <textarea
                value={manualTitles}
                onChange={(e) => setManualTitles(e.target.value)}
                rows={3}
                placeholder="e.g.&#10;Shannen Doherty&#10;Shelley Duvall&#10;Richard Simmons"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Supports both existing articles to research & update, as well as brand new articles to research & create.
              </span>
              <button
                type="submit"
                disabled={isLoading || !manualTitles.trim()}
                className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Articles to Queue</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
