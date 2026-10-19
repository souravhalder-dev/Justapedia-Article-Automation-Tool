import React, { useState } from 'react';
import { AppSettings, WikiTestConnectionResponse } from '../types';
import { Settings, Shield, Cpu, Key, Globe, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onTestWiki: () => Promise<WikiTestConnectionResponse>;
  onLoginWiki: (credentials: { username?: string; password?: string }) => Promise<any>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTestWiki,
  onLoginWiki
}) => {
  const [apiUrl, setApiUrl] = useState<string>(settings?.justapedia_api_url || 'https://justapedia.org/api.php');
  const [botUsername, setBotUsername] = useState<string>(settings?.justapedia_bot_username || '');
  const [botPassword, setBotPassword] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<string>(settings?.gemini_model || 'gemini-2.5-flash');
  const [safeTestMode, setSafeTestMode] = useState<boolean>(settings?.safe_test_mode ?? false);
  const [sandboxTitle, setSandboxTitle] = useState<string>(settings?.sandbox_page_title || 'Justapedia:Sandbox');

  const [testResult, setTestResult] = useState<WikiTestConnectionResponse | null>(null);
  const [loginResult, setLoginResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestWiki = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestWiki();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        connected: false,
        logged_in: false,
        can_write: false,
        message: err.message || 'Connection test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleLogin = async () => {
    if (!botUsername || !botPassword) return;
    setIsLoggingIn(true);
    setLoginResult(null);
    try {
      const res = await onLoginWiki({ username: botUsername, password: botPassword });
      setLoginResult(res);
    } catch (err: any) {
      setLoginResult({ success: false, message: err.message || 'Login failed' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload: Partial<AppSettings> = {
        justapedia_api_url: apiUrl,
        justapedia_bot_username: botUsername,
        gemini_model: geminiModel,
        safe_test_mode: safeTestMode,
        sandbox_page_title: sandboxTitle
      };
      if (botPassword) payload.justapedia_bot_password_masked = botPassword; // Will be set on backend
      if (geminiKey) payload.gemini_key_masked = geminiKey;

      await onUpdateSettings({
        ...payload,
        ...(botPassword ? { justapedia_has_password: true } : {}),
        ...(geminiKey ? { gemini_has_key: true } : {})
      });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">System & API Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSaveSettings} className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Section 1: Justapedia MediaWiki API */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
              <Globe className="w-4 h-4 text-sky-600" />
              <span>Justapedia Wiki API Settings</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                MediaWiki API Endpoint
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://justapedia.org/api.php"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bot Username / Account
                </label>
                <input
                  type="text"
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                  placeholder="e.g. MyBot or Username@BotName"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bot Password {settings?.justapedia_has_password && '(Password is configured)'}
                </label>
                <input
                  type="password"
                  value={botPassword}
                  onChange={(e) => setBotPassword(e.target.value)}
                  placeholder={settings?.justapedia_has_password ? '••••••••••••' : 'Enter Bot Password'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
            </div>

            {/* Test and Login Buttons */}
            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={handleTestWiki}
                disabled={isTesting}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoggingIn || !botUsername || !botPassword}
                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isLoggingIn ? 'Logging in...' : 'Login Account'}
              </button>
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                testResult.connected ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {testResult.connected ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />}
                <div>
                  <span className="font-bold">{testResult.message}</span>
                  {testResult.connected && (
                    <p className="mt-0.5 text-slate-600">
                      Sitename: {testResult.sitename} | Generator: {testResult.generator} | Write API: {testResult.can_write ? 'Enabled' : 'Disabled'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Login Result */}
            {loginResult && (
              <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                loginResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {loginResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />}
                <span className="font-bold">{loginResult.message}</span>
              </div>
            )}
          </div>

          {/* Section 2: AI & LLM Engine */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>Google Gemini AI Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gemini API Key {settings?.gemini_has_key && '(Active Key Set)'}
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder={settings?.gemini_has_key ? '••••••••••••' : 'AIzaSy...'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gemini Model
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Latest & Recommended)</option>
                  <option value="gemini-3.8-pro">Gemini 3.8 Pro (Deep Reasoning & Analysis)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              If left blank, the studio uses its built-in rule-based encyclopedia synthesizer with Wikidata and Wikipedia citation extracts.
            </p>
          </div>

          {/* Section 3: Safe Test Mode & Sandbox */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>Safety & Sandbox Redirection</span>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={safeTestMode}
                  onChange={(e) => setSafeTestMode(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-amber-900">
                  Enable Safe Test Mode by default
                </span>
              </label>
              <p className="text-xs text-amber-800 pl-6">
                When enabled, saving an article automatically redirects edits to the sandbox page so you can safely verify your bot and formatting without altering live articles.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sandbox Page Title
              </label>
              <input
                type="text"
                value={sandboxTitle}
                onChange={(e) => setSandboxTitle(e.target.value)}
                placeholder="Justapedia:Sandbox"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>

          {saveMessage && (
            <div className="p-3 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {saveMessage}
            </div>
          )}

          {/* Footer Save Button */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving Settings...' : 'Save Settings'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
