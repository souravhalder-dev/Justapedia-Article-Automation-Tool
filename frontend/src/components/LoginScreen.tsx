import React, { useState } from 'react';
import { api } from '../api';
import { Lock, KeyRound, ExternalLink, ShieldCheck, AlertCircle, Loader2, Sparkles, UserCheck } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'oauth'>('credentials');
  
  // Credentials mode state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // OAuth mode state
  const [oauthStep, setOauthStep] = useState<1 | 2>(1);
  const [oauthToken, setOauthToken] = useState('');
  const [oauthVerifier, setOauthVerifier] = useState('');
  const [isInitiatingOAuth, setIsInitiatingOAuth] = useState(false);
  const [isVerifyingOAuth, setIsVerifyingOAuth] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both your Justapedia username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.loginCredentials(username.trim(), password.trim());
      if (res.success) {
        onLoginSuccess(res.username);
      } else {
        setErrorMessage('Authentication failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your username and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartOAuth = async () => {
    setIsInitiatingOAuth(true);
    setErrorMessage(null);

    try {
      const res = await api.initiateOAuth();
      if (res.success && res.oauth_token && res.authorize_url) {
        setOauthToken(res.oauth_token);
        setOauthStep(2);
        // Open authorization page in new tab
        window.open(res.authorize_url, '_blank', 'noopener,noreferrer');
      } else {
        setErrorMessage('Failed to initiate OAuth session with Justapedia.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not start OAuth session with Justapedia.');
    } finally {
      setIsInitiatingOAuth(false);
    }
  };

  const handleCompleteOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthVerifier.trim()) {
      setErrorMessage('Please paste the verification code shown on Justapedia.');
      return;
    }

    setIsVerifyingOAuth(true);
    setErrorMessage(null);

    try {
      const res = await api.completeOAuth(oauthToken, oauthVerifier.trim());
      if (res.success) {
        onLoginSuccess(res.username);
      } else {
        setErrorMessage('Verification failed. Please check the verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'OAuth verification failed.');
    } finally {
      setIsVerifyingOAuth(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center items-center space-x-3 mb-3">
          <div className="p-3 bg-sky-500/10 rounded-xl border border-sky-500/30 text-sky-400">
            <Lock className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Justapedia Editorial Studio
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with your Justapedia account to access the research and editorial tools.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800 py-8 px-4 shadow-xl border border-slate-700 sm:rounded-xl sm:px-10">
          
          {/* Auth Method Tabs */}
          <div className="flex border-b border-slate-700 mb-6">
            <button
              type="button"
              onClick={() => { setActiveTab('credentials'); setErrorMessage(null); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 text-center transition-colors ${
                activeTab === 'credentials'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Account Login
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('oauth'); setErrorMessage(null); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 text-center transition-colors ${
                activeTab === 'oauth'
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              OAuth 1.0a Authorization
            </button>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tab 1: Direct Account Login */}
          {activeTab === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Justapedia Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sourav or Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                  Password or Bot Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Authenticating with Justapedia...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 mr-2" />
                      Log In to Studio
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700/60 text-xs text-slate-400 space-y-1">
                <p>
                  Tip: You can use your main Justapedia account password or generate a Bot Password at{' '}
                  <a
                    href="https://justapedia.org/Special:BotPasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline inline-flex items-center"
                  >
                    Special:BotPasswords <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>.
                </p>
              </div>
            </form>
          )}

          {/* Tab 2: OAuth 1.0a Login */}
          {activeTab === 'oauth' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs text-slate-300 space-y-1">
                <div className="flex items-center text-sky-400 font-semibold mb-1">
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Official OAuth Consumer Active
                </div>
                <p>
                  Connect securely using your Justapedia account without typing your password.
                </p>
              </div>

              {oauthStep === 1 ? (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    disabled={isInitiatingOAuth}
                    className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
                  >
                    {isInitiatingOAuth ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting to Justapedia OAuth...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Step 1: Authorize on Justapedia
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 text-center">
                    This will open Justapedia in a new tab to confirm access.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCompleteOAuth} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                      Verification Code from Justapedia
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Paste verification code here"
                      value={oauthVerifier}
                      onChange={(e) => setOauthVerifier(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingOAuth}
                    className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    {isVerifyingOAuth ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying OAuth Token...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Step 2: Complete Sign In
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOauthStep(1); setOauthVerifier(''); }}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-200 pt-1"
                  >
                    Start over
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
