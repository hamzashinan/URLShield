import React, { useState, useEffect } from 'react';
import { Shield, Lock, UserPlus, ArrowRight, Mail, Eye, EyeOff, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface AuthPageProps {
  onLoginSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (activeTab === 'signup') {
        await apiClient.register(username, email, password);
        setActiveTab('login');
        setSuccess('Account created successfully! Please sign in.');
      } else {
        await apiClient.login(email, password);
        onLoginSuccess?.();
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-[#0A0F1C] text-slate-200">
      
      {/* ── Background Animations & Glows ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-space-breathe"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] mix-blend-screen animate-space-breathe" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-primary/10 rounded-full animate-orbit-cw"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] border border-primary/5 rounded-full animate-orbit-ccw" style={{ animationDirection: 'reverse' }}></div>
      </div>

      <div className="w-full max-w-lg relative z-10 animate-slide-up">
        {/* ── Main Glassmorphism Card ── */}
        <div className="rounded-[2rem] border border-white/10 shadow-premium-lg overflow-hidden backdrop-blur-2xl bg-slate-900/60">
          
          {/* Header */}
          <div className="p-8 pb-6 text-center relative border-b border-white/5">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
            
            <div className="flex justify-center mb-6">
              <div className="relative group cursor-pointer animate-float">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/40 transition-colors duration-500"></div>
                <div className="relative w-16 h-16 bg-surface/80 rounded-2xl border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Shield size={32} className="text-primary group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-bold text-primary group-hover:text-white text-xs mt-0.5 ml-0.5 transition-colors duration-300">C</span>
                  </div>
                </div>
              </div>
            </div>
            
            <h1 className="text-3xl font-display font-bold text-slate-200 mb-2 tracking-tight">URLShield</h1>
            <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
              <Sparkles size={14} className="text-primary/70" />
              AI-Powered Phishing Intelligence
            </p>
          </div>

          <div className="p-8 pt-6">
            {/* ── Tabs ── */}
            <div className="flex p-1 gap-1 bg-black/20 rounded-xl mb-8 border border-white/5 shadow-inner">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  activeTab === 'login'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Lock size={16} />
                Sign In
              </button>
              <button
                onClick={() => setActiveTab('signup')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  activeTab === 'signup'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <UserPlus size={16} />
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-danger/10 border border-danger/20 flex items-start gap-3 animate-in">
                <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-3 rounded-lg bg-success/10 border border-success/20 flex items-start gap-3 animate-in">
                <Shield size={16} className="text-success shrink-0 mt-0.5" />
                <p className="text-sm text-success">{success}</p>
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} className="space-y-5 animate-in">
              {activeTab === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative group">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Choose a username"
                      minLength={3}
                      maxLength={100}
                      className="w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-slate-200 placeholder-slate-400/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-slate-200 placeholder-slate-400/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                  {activeTab === 'login' && (
                    <a href="#" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">Forgot password?</a>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={activeTab === 'login' ? "Enter your password" : "Create a strong password"}
                    className="w-full pl-11 pr-12 py-3.5 bg-black/20 border border-white/10 rounded-xl text-slate-200 placeholder-slate-400/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full relative group overflow-hidden py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      {activeTab === 'login' ? 'Sign In to Dashboard' : 'Create Free Account'}
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </form>

            {/* Security Note */}
            <div className="mt-8 p-3 rounded-lg bg-success/5 border border-success/10 flex items-start gap-3">
              <Shield size={16} className="text-success shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-slate-400">
                Your connection is securely encrypted. We use industry-standard protocols to ensure your data and analysis history remain private and protected at all times.
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer Link */}
        <div className="mt-6 text-center flex justify-center items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
          <AlertCircle size={14} />
          <span>Need help accessing your account?</span>
          <button className="text-primary hover:text-primary/80 font-medium transition-colors ml-1">Contact Support</button>
        </div>
      </div>
    </div>
  );
};
