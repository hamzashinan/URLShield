import { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { UserLayout } from './layouts/UserLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { ExportDrawer } from './components/ExportDrawer';

// Admin pages
import { Overview } from './pages/admin/Overview';
import { Domains } from './pages/admin/Domains';
import { Settings } from './pages/admin/Settings';
import { ModelTraining } from './pages/admin/ModelTraining';
import { UserManagement } from './pages/admin/UserManagement';
import { APIManagement } from './pages/admin/APIManagement';
import { SystemMonitoring } from './pages/admin/SystemMonitoring';
import { DataManagement } from './pages/admin/DataManagement';
import { AlertRules } from './pages/admin/AlertRules';
import { AdminLogin } from './pages/admin/Login';
import { AuthLogin } from './pages/admin/AuthLogin';

// User pages
import { HomePage } from './pages/user/HomePage';
import { Evidence } from './pages/user/Evidence';
import { ScanHistory } from './pages/user/ScanHistory';
import { Watchlist } from './pages/user/Watchlist';
import { Alerts } from './pages/user/Alerts';
import { AuthPage } from './pages/user/AuthPage';

function App() {
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [currentPage, setCurrentPage] = useState('home');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Check URL for admin mode on mount
  useEffect(() => {
    if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) {
      setRole('admin');
      setCurrentPage('login'); // Show login page first
    }
  }, []);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState(false);
  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);

  // Sync default page when role changes
  useEffect(() => {
    setCurrentPage(role === 'user' ? 'home' : 'overview');
  }, [role]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── User Mode ────────────────────────────────────────────────────────────
  if (role === 'user') {
    const renderUserPage = () => {
      switch (currentPage) {
        case 'home':
          return <HomePage />;
        case 'evidence':
          return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <Evidence />
            </div>
          );
        case 'scan-history':
          return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <ScanHistory />
            </div>
          );
        case 'watchlist':
          return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <Watchlist />
            </div>
          );
        case 'alerts':
          return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <Alerts onNavigateToEvidence={(domain, timestamp) => {
                setCurrentPage('evidence');
                // Store the selected alert info for Evidence page to filter
                sessionStorage.setItem('evidence_filter_domain', domain);
                sessionStorage.setItem('evidence_filter_timestamp', timestamp);
              }} />
            </div>
          );
        case 'auth':
          return <AuthPage />;
        default:
          return <HomePage />;
      }
    };

    return (
      <ThemeProvider>
        <UserLayout
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        >
          {renderUserPage()}
        </UserLayout>
      </ThemeProvider>
    );
  }

  // ─── Admin Mode ─────────────────────────────────────────────────────────────
  const renderAdminPage = () => {
    // Check authentication for admin pages (except login page)
    if (currentPage !== 'login' && currentPage !== 'auth-login' && !isAdminAuthenticated) {
      setCurrentPage('login');
      return null;
    }

    switch (currentPage) {
      case 'login':
        return <AdminLogin onLoginSuccess={() => {
          setIsAdminAuthenticated(true);
          setCurrentPage('overview');
        }} />;
      case 'auth-login':
        return <AuthLogin onLoginSuccess={() => {
          setIsAdminAuthenticated(true);
          setCurrentPage('overview');
        }} onBackToDashboard={() => setCurrentPage('overview')} />;
      case 'overview':
        return <Overview />;
      case 'training':
        return <ModelTraining />;
      case 'domains':
        return <Domains />;
      case 'users':
        return <UserManagement />;
      case 'api-management':
        return <APIManagement />;
      case 'monitoring':
        return <SystemMonitoring />;
      case 'data-management':
        return <DataManagement />;
      case 'alert-rules':
        return <AlertRules />;
      case 'settings':
        return <Settings />;
      default:
        return <Overview />;
    }
  };

  // Render login page without AdminLayout (no sidebar)
  if (currentPage === 'login' || currentPage === 'auth-login') {
    return (
      <ThemeProvider>
        {renderAdminPage()}
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AdminLayout
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onRoleChange={setRole}
        isSearchOpen={isSearchOpen}
        onSearchOpen={() => setIsSearchOpen(true)}
        onSearchClose={() => setIsSearchOpen(false)}
        isDiffViewerOpen={isDiffViewerOpen}
        onDiffViewerClose={() => setIsDiffViewerOpen(false)}
        isCaptureModalOpen={isCaptureModalOpen}
        onCaptureModalOpen={() => setIsCaptureModalOpen(true)}
        onCaptureModalClose={() => setIsCaptureModalOpen(false)}
      >
        {renderAdminPage()}
      </AdminLayout>

      <ExportDrawer isOpen={isExportDrawerOpen} onClose={() => setIsExportDrawerOpen(false)} />
    </ThemeProvider>
  );
}

export default App;
