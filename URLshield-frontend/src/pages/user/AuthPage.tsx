import React, { useState } from 'react';
import { Shield, Lock, UserPlus, ArrowRight, Globe } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  const handleGoogleSignIn = () => {
    // UI placeholder for Google Sign-In
    console.log('Google Sign-In initiated');
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        {/* Card Container */}
        <div className="bg-surface/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden">
          
          {/* Header/Branding */}
          <div className="p-10 pb-6 text-center border-b border-white/5 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Shield size={64} className="text-primary" strokeWidth={2.5} fill="currentColor" fillOpacity={0.1} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-bold text-primary text-lg">C</span>
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-text mb-2">Welcome to URLShield</h1>
            <p className="text-sm text-text-secondary">AI-Powered Phishing Intelligence</p>
          </div>

          {/* Tabs */}
          <div className="flex p-2 gap-2 bg-surface-secondary/30 mx-8 mt-8 rounded-2xl border border-white/5">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeTab === 'login'
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'text-text-secondary hover:text-text hover:bg-surface/50'
              }`}
            >
              <Lock size={16} />
              Login
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeTab === 'signup'
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'text-text-secondary hover:text-text hover:bg-surface/50'
              }`}
            >
              <UserPlus size={16} />
              Signup
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-10 pt-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-text mb-3">
                {activeTab === 'login' ? 'Welcome Back!' : 'Create an Account'}
              </h2>
              <p className="text-sm text-text-secondary">
                {activeTab === 'login' 
                  ? 'Sign in with your Google account to access your analysis history.' 
                  : 'Join URLShield to protect yourself from phishing threats.'}
              </p>
            </div>

            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-white text-slate-900 font-bold text-base hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-xl group"
            >
              <Globe size={20} className="text-blue-500" />
              <span>Continue with Google</span>
              <ArrowRight size={18} className="ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </button>

            {/* Footer Note */}
            <div className="mt-8 pt-8 border-t border-white/5 text-center">
              <p className="text-[10px] uppercase tracking-widest text-text-secondary/60 font-bold mb-4">Secure Authentication</p>
              <div className="flex justify-center gap-4 opacity-40">
                <Shield size={20} className="text-text" />
                <div className="w-px h-5 bg-text/20" />
                <span className="text-xs font-mono">End-to-End Encryption</span>
              </div>
            </div>
          </div>
        </div>

        {/* Support Link */}
        <p className="text-center mt-8 text-xs text-text-secondary/60">
          Need help? <button className="text-primary hover:underline font-bold">Contact Support</button>
        </p>
      </div>
    </div>
  );
};
