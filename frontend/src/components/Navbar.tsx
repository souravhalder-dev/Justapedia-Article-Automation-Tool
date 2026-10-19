import React from 'react';
import { AppSettings, WikiTestConnectionResponse } from '../types';
import { BookOpen, ShieldCheck, Settings as SettingsIcon, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface NavbarProps {
  settings: AppSettings | null;
  connection: WikiTestConnectionResponse | null;
  onOpenSettings: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  connection,
  onOpenSettings,
  onRefresh,
  isLoading
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">Justapedia</span>
              <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-medium border border-sky-400/30">
                Editorial Studio
              </span>
            </div>
            <p className="text-xs text-slate-400">Article Research, Deceased Updates & Creation</p>
          </div>
        </div>

        {/* Status Indicators & Quick Actions */}
        <div className="flex items-center space-x-3 text-xs">
          
          {/* Wiki Connection Status */}
          <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border ${
            connection?.connected 
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}>
            {connection?.connected ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>
              {connection?.connected 
                ? (connection.logged_in ? `Logged in: ${connection.username || 'Bot'}` : 'Justapedia Online')
                : 'Wiki Disconnected'}
            </span>
          </div>


          {/* Safe Mode Badge */}
          {settings?.safe_test_mode && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-amber-950/40 border border-amber-500/40 text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium">Sandbox Mode Active</span>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh queue and status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
          >
            <SettingsIcon className="w-4 h-4 text-slate-300" />
            <span>Settings</span>
          </button>

        </div>
      </div>
    </header>
  );
};
