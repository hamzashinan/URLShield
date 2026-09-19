import React from "react";
import { Sun, Moon, User, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { useTheme } from "../contexts/ThemeContext";

interface HeaderProps {
  role: "user" | "admin";
  onRoleChange: (role: "user" | "admin") => void;
  onSearchClick?: () => void;
  onCaptureClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  onRoleChange,
  onSearchClick,
  onCaptureClick,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-surface border-b border-border px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-sm bg-surface/95">
      <Logo size="sm" />

      <div className="flex items-center gap-3">
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-text-secondary hover:text-text transition-colors"
            aria-label="Open command search"
            title="Command search"
          >
            <span className="text-xs font-medium">⌘K</span>
          </button>
        )}

        {onCaptureClick && (
          <button
            onClick={onCaptureClick}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-text-secondary hover:text-text transition-colors"
            aria-label="Open capture modal"
            title="Capture"
          >
            <span className="text-xs font-medium">Capture</span>
          </button>
        )}

        {/* Role Switch */}
        <button
          onClick={() => onRoleChange(role === "user" ? "admin" : "user")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-150 text-sm font-medium ${
            role === "user"
              ? "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20"
              : "bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20"
          }`}
          title="Switch Role"
        >
          {role === "user" ? (
            <>
              <User size={16} />
              <span>User Mode</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              <span>Admin Mode</span>
            </>
          )}
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-bg border border-border hover:border-primary/50 hover:bg-surface transition-all duration-150 text-text-secondary hover:text-text"
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
};

export default Header;