import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Globe,
  FileImage,
  Eye,
  Settings,
  Search,
  History,
  BarChart3,
  Users,
  Key,
  Server,
  Database,
  Bell,
} from 'lucide-react';

interface SidebarProps {
  role: 'user' | 'admin';
  currentPage: string;
  onPageChange: (page: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  dividerBefore?: boolean;
  sectionLabel?: string;
}

const userMenu: MenuItem[] = [
  { id: 'analysis', label: 'URL Analysis', icon: Search },
  { id: 'evidence', label: 'Evidence Review', icon: FileImage },
  { id: 'scan-history', label: 'Scan History', icon: History },
  { id: 'watchlist', label: 'Watchlist', icon: Eye },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle }
];

const adminMenu: MenuItem[] = [
  // Core
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, sectionLabel: 'Core' },
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'training', label: 'Model Training', icon: BarChart3 },
  // Management
  { id: 'users', label: 'Users', icon: Users, dividerBefore: true, sectionLabel: 'Management' },
  // Operations
  { id: 'monitoring', label: 'Monitoring', icon: Server, dividerBefore: true, sectionLabel: 'Operations' },
  { id: 'alert-rules', label: 'Alert Rules', icon: Bell },
  { id: 'api-management', label: 'API Management', icon: Key },
  { id: 'data-management', label: 'Data Management', icon: Database },
  // System
  { id: 'settings', label: 'Settings', icon: Settings, dividerBefore: true, sectionLabel: 'System' },
];

export const Sidebar: React.FC<SidebarProps> = ({ role, currentPage, onPageChange }) => {
  const menuItems = role === 'user' ? userMenu : adminMenu;

  return (
    <aside className="w-64 bg-surface border-r border-border flex-shrink-0" style={{ height: 'calc(100vh - 4rem)' }}>
      <nav className="p-4 space-y-0.5 overflow-y-auto h-full custom-scrollbar">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <React.Fragment key={item.id}>
              {item.dividerBefore && (
                <div className="pt-3 pb-1">
                  <div className="border-t border-border/20" />
                </div>
              )}
              {item.sectionLabel && (
                <p className="px-4 pt-2 pb-1 text-[9px] font-semibold text-text-secondary/50 uppercase tracking-[0.2em]">
                  {item.sectionLabel}
                </p>
              )}
              <button
                onClick={() => onPageChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-text-secondary hover:text-text hover:bg-bg border border-transparent'
                  }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}


      </nav>
    </aside>
  );
};
