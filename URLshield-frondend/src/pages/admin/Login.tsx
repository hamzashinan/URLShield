import React, { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, User, Key } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Hardcoded admin credentials
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'yodha123';
    
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
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-blue-500 rounded-full flex items-center justify-center mb-4 relative">
              <Shield className="text-white" size={32} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-white text-[10px]">C</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-text mb-2">Admin Access</h1>
            <p className="text-text-secondary">YodhaC.Ai Administrative Panel</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 text-text-secondary" size={18} />
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter admin username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 text-text-secondary" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full pl-10 pr-12 py-3 bg-bg border border-border rounded-lg text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter admin password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 text-text-secondary hover:text-primary"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Key size={18} />
              Sign In
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="text-warning flex-shrink-0 mt-0.5" size={16} />
              <div className="text-sm text-warning">
                <p className="font-medium mb-1">Authorized Access Only</p>
                <p className="text-text-secondary">
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
