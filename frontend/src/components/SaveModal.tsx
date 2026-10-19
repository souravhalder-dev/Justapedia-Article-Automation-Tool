import React, { useState } from 'react';
import { ArticleJob, AppSettings, SaveToWikiResponse } from '../types';
import { Save, AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck, X } from 'lucide-react';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: ArticleJob;
  settings: AppSettings | null;
  onConfirmSave: (options: {
    custom_title?: string;
    wikitext: string;
    edit_summary: string;
    is_minor?: boolean;
    is_bot?: boolean;
    use_sandbox?: boolean;
  }) => Promise<SaveToWikiResponse>;
  isLoading: boolean;
}

export const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  onClose,
  article,
  settings,
  onConfirmSave,
  isLoading
}) => {
  const [editSummary, setEditSummary] = useState<string>(
    'Update biographical details, death dates, and reliable citations via Justapedia Editorial Studio'
  );
  const [isMinor, setIsMinor] = useState<boolean>(false);
  const [isBot, setIsBot] = useState<boolean>(true);
  const [useSandbox, setUseSandbox] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<SaveToWikiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaveResult(null);

    const wikitext = article.user_edited_draft || article.generated_draft || article.original_wikitext || '';
    if (!wikitext) {
      setErrorMessage('Wikitext is empty. Cannot save.');
      return;
    }

    try {
      const res = await onConfirmSave({
        custom_title: article.title,
        wikitext,
        edit_summary: editSummary,
        is_minor: isMinor,
        is_bot: isBot,
        use_sandbox: useSandbox
      });
      setSaveResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save to Justapedia Wiki.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Save className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              Publish to Justapedia Wiki
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          
          {/* Target Article Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Target Article:</span>
              <span className="font-bold text-slate-900 text-sm">{article.title}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Target Wiki:</span>
              <span className="text-sky-600">justapedia.org</span>
            </div>
            {article.original_revid && (
              <div className="flex justify-between items-center text-slate-500">
                <span>Base Revision Protection:</span>
                <span>Rev #{article.original_revid} (prevents edit conflicts)</span>
              </div>
            )}
          </div>

          {/* Sandbox Toggle */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={useSandbox}
                onChange={(e) => setUseSandbox(e.target.checked)}
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
              />
              <div className="text-xs">
                <span className="font-bold text-amber-900 flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Save safely to Sandbox ({settings?.sandbox_page_title || 'Justapedia:Sandbox'})
                </span>
                <p className="text-amber-700 mt-0.5">
                  Protects live article by publishing draft as a sandbox test revision first. Recommended for testing.
                </p>
              </div>
            </label>
          </div>

          {/* Edit Summary Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Edit Summary (MediaWiki revision history log)
            </label>
            <input
              type="text"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          {/* Flags */}
          <div className="flex items-center space-x-6 text-xs text-slate-700">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMinor}
                onChange={(e) => setIsMinor(e.target.checked)}
                className="rounded text-sky-600"
              />
              <span>Mark as minor edit</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBot}
                onChange={(e) => setIsBot(e.target.checked)}
                className="rounded text-sky-600"
              />
              <span>Mark as bot edit</span>
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Save Failure Banner */}
          {saveResult && !saveResult.success && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-rose-900 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Save to Justapedia Failed</span>
              </div>
              <p>{saveResult.message}</p>
            </div>
          )}

          {/* Success Banner */}
          {saveResult && saveResult.success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-emerald-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveResult.message}</span>
              </div>
              {saveResult.revid && (
                <p>New Revision ID: <span className="font-mono font-bold">#{saveResult.revid}</span></p>
              )}
              {saveResult.url && (
                <a
                  href={saveResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-sky-700 hover:underline font-semibold"
                >
                  <span>Open published article on Justapedia</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {saveResult?.success ? 'Close' : 'Cancel'}
            </button>

            {!saveResult?.success && (
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Publishing...' : 'Confirm & Publish'}</span>
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};
