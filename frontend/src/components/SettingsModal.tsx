import React, { useState } from 'react';
import { AppSettings, WikiTestConnectionResponse, OllamaTestResponse } from '../types';
import { Settings, Shield, Globe, CheckCircle2, AlertCircle, X, Cpu, Server, Sparkles, ExternalLink } from 'lucide-react';
import { api } from '../api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onTestWiki: () => Promise<WikiTestConnectionResponse>;
  onLoginWiki: (credentials: { username?: string; password?: string }) => Promise<any>;
  onTestOllama?: (baseUrl?: string) => Promise<OllamaTestResponse>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTestWiki,
  onLoginWiki,
  onTestOllama
}) => {
  const [apiUrl, setApiUrl] = useState<string>(settings?.justapedia_api_url || 'https://justapedia.org/api.php');
  const [botUsername, setBotUsername] = useState<string>(settings?.justapedia_bot_username || '');
  const [botPassword, setBotPassword] = useState<string>('');
  const [safeTestMode, setSafeTestMode] = useState<boolean>(settings?.safe_test_mode ?? false);
  const [sandboxTitle, setSandboxTitle] = useState<string>(settings?.sandbox_page_title || 'Justapedia:Sandbox');

  // AI Configuration states
  const [aiProvider, setAiProvider] = useState<'ollama' | 'rule_based' | 'gemini'>(settings?.ai_provider || 'ollama');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(settings?.ollama_base_url || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState<string>(settings?.ollama_model || 'llama3.2');
  const [ollamaTestResult, setOllamaTestResult] = useState<OllamaTestResponse | null>(null);
  const [isTestingOllama, setIsTestingOllama] = useState<boolean>(false);

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

  const handleTestOllama = async () => {
    setIsTestingOllama(true);
    setOllamaTestResult(null);
    try {
      const res = onTestOllama ? await onTestOllama(ollamaBaseUrl) : await api.testOllamaConnection(ollamaBaseUrl);
      setOllamaTestResult(res);
    } catch (err: any) {
      setOllamaTestResult({
        connected: false,
        models: [],
        current_model: ollamaModel,
        base_url: ollamaBaseUrl,
        message: err.message || 'Failed to connect to Ollama'
      });
    } finally {
      setIsTestingOllama(false);
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
        safe_test_mode: safeTestMode,
        sandbox_page_title: sandboxTitle,
        ai_provider: aiProvider,
        ollama_base_url: ollamaBaseUrl,
        ollama_model: ollamaModel
      };
      if (botPassword) payload.justapedia_bot_password_masked = botPassword;

      await onUpdateSettings({
        ...payload,
        ...(botPassword ? { justapedia_has_password: true } : {})
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
            <h3 className="text-base font-bold text-slate-900">System & Engine Configuration</h3>
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
          
          {/* Section 1: AI Engine Configuration (100% Free / Ollama) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
                <Cpu className="w-4 h-4 text-emerald-600" />
                <span>AI Engine (100% Free / No Cost)</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Zero API Cost
              </span>
            </div>

            {/* Provider Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setAiProvider('ollama')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  aiProvider === 'ollama'
                    ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Server className={`w-4 h-4 ${aiProvider === 'ollama' ? 'text-sky-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-slate-800">Ollama API (Local / Free)</span>
                  </div>
                  <input 
                    type="radio" 
                    name="ai_provider" 
                    checked={aiProvider === 'ollama'} 
                    onChange={() => setAiProvider('ollama')} 
                    className="text-sky-600 focus:ring-sky-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Run open-source models (Llama 3.2, Mistral, Qwen) privately with zero API costs.
                </p>
              </div>

              <div 
                onClick={() => setAiProvider('rule_based')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  aiProvider === 'rule_based'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <Sparkles className={`w-4 h-4 ${aiProvider === 'rule_based' ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold text-slate-800">Rule-Based Synthesizer</span>
                  </div>
                  <input 
                    type="radio" 
                    name="ai_provider" 
                    checked={aiProvider === 'rule_based'} 
                    onChange={() => setAiProvider('rule_based')} 
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Uses Wikidata facts & Wikipedia citation extracts deterministically. Zero AI setup required.
                </p>
              </div>
            </div>

            {/* Ollama Settings Details */}
            {aiProvider === 'ollama' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Ollama Server URL
                    </label>
                    <input
                      type="text"
                      value={ollamaBaseUrl}
                      onChange={(e) => setOllamaBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Ollama Model
                    </label>
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3.2"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                  </div>
                </div>

                {/* Model Quick Select Pills */}
                <div>
                  <span className="text-[11px] font-medium text-slate-500 mr-2">Recommended Free Models:</span>
                  <div className="inline-flex flex-wrap gap-1.5 mt-1">
                    {['llama3.2', 'llama3.1', 'mistral', 'qwen2.5', 'phi3'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setOllamaModel(m)}
                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          ollamaModel === m 
                            ? 'bg-sky-100 border-sky-300 text-sky-800 font-bold' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Test Ollama Button */}
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTestOllama}
                    disabled={isTestingOllama}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>{isTestingOllama ? 'Testing Ollama...' : 'Test Ollama Connection'}</span>
                  </button>
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-600 hover:text-sky-800 flex items-center space-x-1"
                  >
                    <span>Download Ollama</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Ollama Test Result Badge */}
                {ollamaTestResult && (
                  <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
                    ollamaTestResult.connected ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {ollamaTestResult.connected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold">{ollamaTestResult.message}</span>
                      {ollamaTestResult.models && ollamaTestResult.models.length > 0 && (
                        <p className="mt-1 text-slate-600">
                          Installed models: <span className="font-mono">{ollamaTestResult.models.join(', ')}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Justapedia MediaWiki API */}
          <div className="space-y-3 pt-2">
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
                  placeholder="e.g. Sourav bot"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bot Password {settings?.justapedia_has_password && '(Configured)'}
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
