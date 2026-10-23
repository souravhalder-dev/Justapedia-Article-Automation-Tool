import React, { useState } from 'react';
import { api } from '../api';
import { Lock, AlertCircle, Loader2, UserCheck, ExternalLink } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          
          <div className="mb-6 pb-3 border-b border-slate-700">
            <h3 className="text-base font-semibold text-white flex items-center">
              <UserCheck className="w-4 h-4 mr-2 text-sky-400" />
              Account Login
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Enter your Justapedia username and password to authenticate.
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Direct Account Login Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1">
                Justapedia Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="e.g. Sourav"
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
                autoComplete="current-password"
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
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors cursor-pointer"
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
                Tip: You can log in with your primary Justapedia account password or an account-specific Bot Password generated at{' '}
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

        </div>
      </div>
    </div>
  );
};
