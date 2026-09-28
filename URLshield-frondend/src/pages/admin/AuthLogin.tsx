import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, User, Key, ArrowLeft } from 'lucide-react';

interface AuthLoginProps {
  onLoginSuccess?: () => void;
  onBackToDashboard?: () => void;
}

export const AuthLogin: React.FC<AuthLoginProps> = ({ onLoginSuccess, onBackToDashboard }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Hardcoded admin credentials
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'urlshield123';
    
    // Validate credentials
    if (credentials.username === ADMIN_USERNAME && credentials.password === ADMIN_PASSWORD) {
      console.log('Admin login successful:', credentials.username);
      
      // Call login success callback
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      
      // Reset form
      setCredentials({ username: '', password: '' });
    } else {
      console.log('Login failed: invalid credentials');
      alert('Invalid username or password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0A0F1F' }}>
      <div className="w-full max-w-md">
        <div className="rounded-lg shadow-2xl p-8" style={{
          background: 'rgba(10, 15, 31, 0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 0 40px rgba(59, 130, 246, 0.15)'
        }}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 relative" style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
              boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)'
            }}>
              <Shield className="text-white" size={32} style={{ filter: 'drop-shadow(0 0 10px rgba(96, 165, 250, 0.5))' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-white text-[10px]" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.5)' }}>C</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#60A5FA', textShadow: '0 0 20px rgba(59, 130, 246, 0.3)' }}>Admin Authentication</h1>
            <p className="text-sm" style={{ color: '#94A3B8' }}>URLShield Administrative Panel</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94A3B8' }}>
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2" size={18} style={{ color: '#60A5FA' }} />
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(10, 15, 31, 0.6)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    boxShadow: '0 0 15px rgba(59, 130, 246, 0.1)'
                  }}
                  placeholder="Enter admin username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94A3B8' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2" size={18} style={{ color: '#60A5FA' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full pl-10 pr-12 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(10, 15, 31, 0.6)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    boxShadow: '0 0 15px rgba(59, 130, 246, 0.1)'
                  }}
                  placeholder="Enter admin password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 hover:text-blue-400 transition-colors"
                  style={{ color: '#60A5FA' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 font-medium"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
                color: 'white',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
              }}
            >
              <Key size={18} />
              Sign In
            </button>
          </form>

          {/* Back to Dashboard */}
          {onBackToDashboard && (
            <div className="mt-6 text-center">
              <button
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-2 text-sm transition-colors"
                style={{ color: '#60A5FA' }}
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-4 rounded-lg" style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div className="flex items-start gap-3">
              <Shield className="flex-shrink-0 mt-0.5" size={16} style={{ color: '#60A5FA' }} />
              <div className="text-sm" style={{ color: '#94A3B8' }}>
                <p className="font-medium mb-1" style={{ color: '#60A5FA' }}>Authorized Access Only</p>
                <p>
                  This administrative panel is restricted to authorized personnel. 
                  All access attempts are logged and monitored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
