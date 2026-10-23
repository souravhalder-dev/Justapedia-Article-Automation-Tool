import React, { useState, useEffect } from 'react';
import { ArticleJob, DiffChunk } from '../types';
import { 
  Sparkles, Search, Save, SkipForward, ExternalLink, 
  GitCompare, FileCode, Eye, CheckCircle2, AlertTriangle, 
  RefreshCw, Info, Link as LinkIcon, HelpCircle, ShieldAlert
} from 'lucide-react';

interface ArticleStudioProps {
  article: ArticleJob | null;
  onResearch: (id: number) => Promise<void>;
  onGenerate: (id: number) => Promise<void>;
  onUpdateDraft: (id: number, text: string) => Promise<void>;
  onOpenSaveModal: () => void;
  onSkip: (id: number) => Promise<void>;
  isLoading: boolean;
}

export const ArticleStudio: React.FC<ArticleStudioProps> = ({
  article,
  onResearch,
  onGenerate,
  onUpdateDraft,
  onOpenSaveModal,
  onSkip,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'editor' | 'preview' | 'sources'>('diff');
  const [editorText, setEditorText] = useState<string>('');
  const [isEditorDirty, setIsEditorDirty] = useState<boolean>(false);

  // Sync editor text when article or draft changes
  useEffect(() => {
    if (article) {
      const draft = article.user_edited_draft || article.generated_draft || article.original_wikitext || '';
      setEditorText(draft);
      setIsEditorDirty(false);
      // Auto-switch to diff when draft is ready, or sources if pending research
      if (article.generated_draft || article.diff_json) {
        setActiveTab('diff');
      } else {
        setActiveTab('sources');
      }
    }
  }, [article?.id, article?.generated_draft, article?.user_edited_draft]);

  if (!article) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-[750px] flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <FileCode className="w-16 h-16 text-slate-300 mb-3" />
        <h3 className="text-lg font-semibold text-slate-700">No Article Selected</h3>
        <p className="text-sm text-slate-400 max-w-sm mt-1">
          Select an article from the queue on the left, or use the Discovery Bar to find outdated Justapedia articles.
        </p>
      </div>
    );
  }

  const handleSaveEditor = async () => {
    await onUpdateDraft(article.id, editorText);
    setIsEditorDirty(false);
  };

  const handleInsertMarkup = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('wikitext-editor-area') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editorText.substring(start, end);
    const replacement = prefix + (selected || 'text') + suffix;
    const nextText = editorText.substring(0, start) + replacement + editorText.substring(end);
    setEditorText(nextText);
    setIsEditorDirty(true);
  };

  // Helper to render basic wikitext preview into HTML
  const renderWikiMarkup = (wikitext: string) => {
    if (!wikitext) return <p className="text-slate-400 italic">No content available for preview.</p>;

    // Simple robust MediaWiki preview parser
    const lines = wikitext.split('\n');
    const renderedElements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];

    // Extract Infobox if present (any biographical infobox)
    const infoboxMatch = wikitext.match(/\{\{Infobox\s+([A-Za-z0-9_ ]+)([\s\S]*?)\n\}\}/i);
    let infoboxParams: Record<string, string> = {};
    if (infoboxMatch) {
      const paramLines = infoboxMatch[2].split('\n');
      paramLines.forEach(pl => {
        const parts = pl.split('=');
        if (parts.length >= 2 && parts[0].trim().startsWith('|')) {
          const key = parts[0].trim().replace(/^\|\s*/, '');
          const val = parts.slice(1).join('=').trim().replace(/[{}[\]]/g, '');
          if (val) infoboxParams[key] = val;
        }
      });
    }

    // Extract Short Description
    const shortDescMatch = wikitext.match(/\{\{short description\|([^}]+)\}\}/i);
    const shortDescription = shortDescMatch ? shortDescMatch[1].trim() : null;

    const flushParagraph = (key: number) => {
      if (currentParagraph.length > 0) {
        let pText = currentParagraph.join(' ');
        // Format bold '''text'''
        pText = pText.replace(/'''(.*?)'''/g, '<strong>$1</strong>');
        // Format italic ''text''
        pText = pText.replace(/''(.*?)''/g, '<em>$1</em>');
        // Format internal links [[Link|Label]] or [[Link]]
        pText = pText.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="https://justapedia.org/$1" target="_blank" class="text-sky-600 underline">$2</a>');
        pText = pText.replace(/\[\[([^\]]+)\]\]/g, '<a href="https://justapedia.org/$1" target="_blank" class="text-sky-600 underline">$1</a>');
        // Format citations <ref>...</ref> into [1]
        let refIndex = 1;
        pText = pText.replace(/<ref[^>]*>([\s\S]*?)<\/ref>/gi, () => {
          return `<sup class="text-sky-600 font-bold px-0.5 cursor-pointer">[${refIndex++}]</sup>`;
        });

        renderedElements.push(
          <p key={`p-${key}`} className="mb-3 text-slate-800 leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: pText }} />
        );
        currentParagraph = [];
      }
    };

    let pKey = 0;
    let insideInfobox = false;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Skip infobox block in main text flow (rendered separately as card)
      if (trimmed.startsWith('{{Infobox')) {
        insideInfobox = true;
        return;
      }
      if (insideInfobox) {
        if (trimmed.endsWith('}}') || trimmed === '}}') {
          insideInfobox = false;
        }
        return;
      }

      // Skip short description and maintenance templates in body
      if (trimmed.startsWith('{{short description') || trimmed.startsWith('{{Use American English') || trimmed.startsWith('{{Use mdy dates')) {
        return;
      }

      // Headers == Header ==
      const header2 = trimmed.match(/^==\s*([^=]+?)\s*==$/);
      const header3 = trimmed.match(/^===\s*([^=]+?)\s*===$/);

      if (header2) {
        flushParagraph(pKey++);
        renderedElements.push(
          <h2 key={`h2-${idx}`} className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-1 mt-5 mb-2.5">
            {header2[1]}
          </h2>
        );
      } else if (header3) {
        flushParagraph(pKey++);
        renderedElements.push(
          <h3 key={`h3-${idx}`} className="text-base font-semibold text-slate-800 mt-4 mb-2">
            {header3[1]}
          </h3>
        );
      } else if (trimmed.startsWith('[[Category:')) {
        // Categories handled at end
      } else if (trimmed === '{{reflist}}' || trimmed === '<references />') {
        flushParagraph(pKey++);
        renderedElements.push(
          <div key={`refs-${idx}`} className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1 my-2">
            <span className="font-semibold text-slate-700 block mb-1">Citations & References:</span>
            {article.sources.map((s, sidx) => (
              <div key={sidx} className="flex items-start space-x-2 text-slate-600">
                <span className="font-bold text-sky-600">{sidx + 1}.</span>
                <span>
                  "{s.title}" — <em>{s.publisher || 'Web'}</em>. <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-600 underline">Source URL</a>
                </span>
              </div>
            ))}
          </div>
        );
      } else if (trimmed.length > 0) {
        currentParagraph.push(trimmed);
      } else {
        flushParagraph(pKey++);
      }
    });

    flushParagraph(pKey++);

    // Extract categories
    const categories = wikitext.match(/\[\[Category:([^\]]+)\]\]/g) || [];

    return (
      <div className="relative">
        {/* Render Floated Infobox Card with Short Description directly above it */}
        {Object.keys(infoboxParams).length > 0 && (
          <div className="float-right w-72 ml-4 mb-4 p-3.5 bg-slate-50 border border-slate-300 rounded-lg shadow-sm text-xs">
            {shortDescription && (
              <div className="mb-2 pb-1.5 border-b border-slate-200 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Short Description</span>
                <span className="text-xs italic text-slate-700 font-medium">{shortDescription}</span>
              </div>
            )}
            <div className="text-center font-bold text-sm text-slate-900 border-b border-slate-200 pb-1.5 mb-2 bg-slate-200/50 -mx-3.5 -mt-3.5 p-2 rounded-t-lg">
              {infoboxParams.name || article.title}
            </div>
            <div className="space-y-1.5">
              {infoboxParams.birth_date && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="font-semibold text-slate-600">Born:</span>
                  <span className="text-slate-800 text-right">{infoboxParams.birth_date}</span>
                </div>
              )}
              {infoboxParams.birth_place && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="font-semibold text-slate-600">Birthplace:</span>
                  <span className="text-slate-800 text-right">{infoboxParams.birth_place}</span>
                </div>
              )}
              {infoboxParams.death_date && (
                <div className="flex justify-between border-b border-slate-100 pb-1 bg-rose-50/50 p-1 rounded">
                  <span className="font-semibold text-rose-700">Died:</span>
                  <span className="text-rose-900 font-medium text-right">{infoboxParams.death_date}</span>
                </div>
              )}
              {infoboxParams.death_place && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="font-semibold text-slate-600">Place of Death:</span>
                  <span className="text-slate-800 text-right">{infoboxParams.death_place}</span>
                </div>
              )}
              {infoboxParams.death_cause && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="font-semibold text-slate-600">Cause of death:</span>
                  <span className="text-slate-800 text-right">{infoboxParams.death_cause}</span>
                </div>
              )}
              {infoboxParams.occupation && (
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="font-semibold text-slate-600">Occupation:</span>
                  <span className="text-slate-800 text-right">{infoboxParams.occupation}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Render Formatted Body */}
        <div className="prose prose-slate max-w-none clear-left">
          {renderedElements}
        </div>

        {/* Categories Bar */}
        {categories.length > 0 && (
          <div className="mt-8 pt-3 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-700">Categories:</span>
            {categories.map((cat, cidx) => {
              const clean = cat.replace(/\[\[Category:|\]\]/g, '');
              return (
                <span key={cidx} className="px-2 py-0.5 rounded bg-slate-100 text-sky-700 border border-slate-200">
                  {clean}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[750px]">
      
      {/* Studio Header & Primary Action Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{article.title}</h1>
              <a
                href={article.saved_url || `https://justapedia.org/${article.title.replace(/ /g, '_')}`}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 hover:text-sky-700 text-xs flex items-center space-x-0.5"
                title="View live on Justapedia"
              >
                <span>Live Justapedia Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {article.audit_summary || 'Article ready for research and review'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            
            {/* Research Button */}
            <button
              onClick={() => onResearch(article.id)}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-sm disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Research Subject</span>
            </button>

            {/* Generate Draft Button */}
            <button
              onClick={() => onGenerate(article.id)}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Generate Draft</span>
            </button>

            {/* Skip Button */}
            <button
              onClick={() => onSkip(article.id)}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Skip</span>
            </button>

            {/* Save to Justapedia Button (PRIMARY EXPLICIT ACTION) */}
            <button
              onClick={onOpenSaveModal}
              disabled={isLoading || (!article.generated_draft && !article.user_edited_draft)}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>Save to Justapedia</span>
            </button>

          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 -mb-4 pt-1 space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('diff')}
            className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'diff'
                ? 'border-sky-600 text-sky-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Before & After Diff</span>
            {article.diff_json && (
              <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 text-[10px]">
                +{article.diff_json.lines_added} / -{article.diff_json.lines_removed}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'editor'
                ? 'border-sky-600 text-sky-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Wikitext Editor</span>
            {isEditorDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved manual changes" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-sky-600 text-sky-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Rendered Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'sources'
                ? 'border-sky-600 text-sky-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Verified Sources ({article.sources.length})</span>
            {article.discrepancies && article.discrepancies.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                {article.discrepancies.length} Flagged
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Panes */}
      <div className="flex-1 overflow-y-auto p-5">
        
        {/* TAB 1: VISUAL DIFF */}
        {activeTab === 'diff' && (
          <div className="space-y-4">
            
            {/* Diff Summary Header Card */}
            {article.diff_summary && (
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-sky-900">
                  <Info className="w-4 h-4 text-sky-600" />
                  <span>AI Proposed Changes Summary:</span>
                </div>
                <p className="text-slate-700">{article.diff_summary}</p>
                {article.diff_json?.added_sections && article.diff_json.added_sections.length > 0 && (
                  <div className="flex items-center space-x-1 pt-1">
                    <span className="text-slate-500 font-medium">Added sections:</span>
                    {article.diff_json.added_sections.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Side-by-Side Diff Panels */}
            {article.diff_json?.chunks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                
                {/* Left: Original Justapedia Article */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 font-sans font-bold text-slate-700 flex justify-between">
                    <span>Original Justapedia Content</span>
                    <span className="text-slate-400 font-normal">
                      {article.page_exists ? `Rev #${article.original_revid || 'current'}` : 'Does Not Exist'}
                    </span>
                  </div>
                  <div className="p-3 max-h-[500px] overflow-y-auto space-y-0.5">
                    {article.diff_json.chunks.map((chunk, cidx) => {
                      if (chunk.type === 'insert') return null;
                      const bg = chunk.type === 'delete' ? 'bg-rose-100 text-rose-900' :
                                 chunk.type === 'modify' ? 'bg-amber-100 text-amber-900' : 'text-slate-700';
                      return (
                        <div key={cidx} className={`px-1 py-0.5 rounded ${bg} whitespace-pre-wrap break-all`}>
                          {chunk.orig_lines.join('\n')}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Proposed Draft with Citations */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 font-sans font-bold text-emerald-800 flex justify-between">
                    <span>Proposed Researched Draft</span>
                    <span className="text-emerald-600 font-semibold">Ready for Review</span>
                  </div>
                  <div className="p-3 max-h-[500px] overflow-y-auto space-y-0.5">
                    {article.diff_json.chunks.map((chunk, cidx) => {
                      if (chunk.type === 'delete') return null;
                      const bg = chunk.type === 'insert' ? 'bg-emerald-100 text-emerald-900 font-medium' :
                                 chunk.type === 'modify' ? 'bg-sky-100 text-sky-900' : 'text-slate-700';
                      return (
                        <div key={cidx} className={`px-1 py-0.5 rounded ${bg} whitespace-pre-wrap break-all`}>
                          {chunk.prop_lines.join('\n')}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <GitCompare className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-700">No diff generated yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "Generate Draft" above to generate verified content and view diff.</p>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: WIKITEXT EDITOR */}
        {activeTab === 'editor' && (
          <div className="space-y-3 flex flex-col h-full">
            
            {/* Quick Markup Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleInsertMarkup("== ", " ==")}
                  className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 font-bold text-slate-700"
                  title="Section Header"
                >
                  == Header ==
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertMarkup("'''", "'''")}
                  className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 font-bold text-slate-700"
                  title="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertMarkup("''", "''")}
                  className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 italic text-slate-700"
                  title="Italic"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertMarkup("[[", "]]")}
                  className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                  title="Internal Wiki Link"
                >
                  [[Link]]
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertMarkup("<ref>{{cite web |url=https:// |title=Title |publisher=Publisher |date=2026}}</ref>")}
                  className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                  title="Insert Web Citation"
                >
                  &lt;ref&gt;
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertMarkup("{{reflist}}")}
                  className="px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                  title="Insert References Section"
                >
                  &#123;&#123;reflist&#125;&#125;
                </button>
              </div>

              {/* Save manual edits button */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-500 font-mono">
                  {editorText.length} chars | {editorText.split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  type="button"
                  onClick={handleSaveEditor}
                  disabled={isLoading || !isEditorDirty}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded font-medium text-xs transition-colors shadow-sm"
                >
                  Save Manual Edits
                </button>
              </div>
            </div>

            {/* Wikitext Textarea */}
            <textarea
              id="wikitext-editor-area"
              value={editorText}
              onChange={(e) => {
                setEditorText(e.target.value);
                setIsEditorDirty(true);
              }}
              className="w-full flex-1 min-h-[460px] p-4 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed resize-y"
              placeholder="Wikitext content..."
            />
          </div>
        )}

        {/* TAB 3: LIVE RENDERED PREVIEW */}
        {activeTab === 'preview' && (
          <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-inner min-h-[500px]">
            <h1 className="text-2xl font-serif font-bold text-slate-900 border-b border-slate-300 pb-2 mb-4">
              {article.title}
            </h1>
            {renderWikiMarkup(editorText || article.generated_draft || article.original_wikitext || '')}
          </div>
        )}

        {/* TAB 4: VERIFIED SOURCES & DISCREPANCY INSPECTOR */}
        {activeTab === 'sources' && (
          <div className="space-y-4">
            
            {/* Discrepancy Warnings Card */}
            {article.discrepancies && article.discrepancies.length > 0 && (
              <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg space-y-2">
                <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <span>Conflicting or Uncertain Claims Flagged for Human Review</span>
                </div>
                <p className="text-xs text-amber-700">
                  The AI detected contradictory information between research sources. Please review before finalizing:
                </p>
                <div className="space-y-2 pt-1">
                  {article.discrepancies.map((disc, didx) => (
                    <div key={didx} className="bg-white/80 p-2.5 rounded border border-amber-200 text-xs">
                      <span className="font-semibold text-amber-900 uppercase tracking-wide text-[11px] block">
                        Field: {disc.field}
                      </span>
                      <p className="text-slate-800 mt-0.5">{disc.issue}</p>
                      {disc.sources_involved && disc.sources_involved.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Sources involved: {disc.sources_involved.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Structured Facts */}
            {article.researched_facts && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                <h4 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verified Biographical Attributes</span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Birth Date</span>
                    <span className="font-semibold text-slate-800">{article.researched_facts.birth_date || 'N/A'}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Death Date</span>
                    <span className="font-semibold text-rose-700">{article.researched_facts.death_date || 'Living / N/A'}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Cause of Death</span>
                    <span className="font-semibold text-slate-800">{article.researched_facts.cause_of_death || 'Not specified'}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Occupation</span>
                    <span className="font-semibold text-slate-800">
                      {Array.isArray(article.researched_facts.occupations) 
                        ? article.researched_facts.occupations.join(', ')
                        : article.researched_facts.occupations || 'Biographical Subject'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sources List */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-sm">
                Research Sources & Evidence ({article.sources.length})
              </h4>
              
              {article.sources.length === 0 ? (
                <div className="p-6 text-center text-slate-400 border border-dashed border-slate-300 rounded-lg">
                  <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-medium">No sources retrieved yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Click "Research Subject" to query reliable news, obituaries, and Wikidata.</p>
                </div>
              ) : (
                article.sources.map((source, sidx) => (
                  <div key={sidx} className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs hover:border-slate-300 transition-colors space-y-1.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-sm text-sky-700 hover:underline flex items-center space-x-1"
                        >
                          <span>{source.title}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                          <span className="font-medium text-slate-700">{source.publisher || 'Web Source'}</span>
                          <span>•</span>
                          <span className="text-[11px] text-slate-400 truncate max-w-sm">{source.url}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{source.reliability_score}% Reliable</span>
                      </div>
                    </div>

                    {source.snippet && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 italic leading-relaxed">
                        "{source.snippet}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
