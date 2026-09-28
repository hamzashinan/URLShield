import React, { useState } from 'react';
import { Shield, Menu, X, Sun, Moon, User } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface UserNavbarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const navLinks = [
  { id: 'home', label: 'Home' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'scan-history', label: 'History' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'alerts', label: 'Alerts' },
  
];

export const UserNavbar: React.FC<UserNavbarProps> = ({
  currentPage,
  onPageChange,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => onPageChange('home')}
            className="flex items-center gap-2.5 group"
          >
            <div className="relative">
              <Shield
                size={28}
                className="text-blue-500 group-hover:text-blue-600 transition-colors"
                strokeWidth={2.5}
                fill="currentColor"
                fillOpacity={0.1}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-blue-500 text-[10px]">C</span>
              </div>
            </div>
            <span className="text-xl font-bold text-text">
              URLShield
            </span>
          </button>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = currentPage === link.id;

              return (
                <button
                  key={link.id}
                  onClick={() => onPageChange(link.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text hover:bg-surface'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}

            {/* Admin */}
            <button
              onClick={() => {
                window.location.href = '/admin';
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text hover:bg-surface transition-all duration-200"
            >
              Admin
            </button>
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-all duration-200"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            <button
              onClick={() => onPageChange('auth')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 text-sm font-bold shadow-lg ${
                currentPage === 'auth'
                  ? 'bg-primary text-white shadow-primary/30 scale-105'
                  : 'bg-surface border border-border text-text hover:border-primary/50 hover:bg-primary/5 hover:text-primary'
              }`}
            >
              <User size={16} />
              {currentPage === 'auth' ? 'Signing In...' : 'Sign In'}
            </button>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:bg-surface transition-colors"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = currentPage === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    onPageChange(link.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-surface'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
            {/* Admin */}
          <button
            onClick={() => {
              window.location.href = '/admin';
              setMobileOpen(false);
            }}
            className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface hover:text-text transition-all duration-200"
          >
            Admin
          </button>
            <div className="border-t border-border pt-4 mt-4">
              <button
                onClick={() => {
                  onPageChange('auth');
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-bold ${
                  currentPage === 'auth'
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-text'
                }`}
              >
                <User size={18} />
                Sign In 
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
