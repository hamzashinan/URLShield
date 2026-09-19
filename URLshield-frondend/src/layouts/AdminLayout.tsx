import React from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { Footer } from '../components/admin/Footer';
import { CommandSearch } from '../components/CommandSearch';
import { DiffViewer } from '../components/DiffViewer';
import { CaptureModal } from '../components/CaptureModal';

interface AdminLayoutProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onRoleChange: (role: 'user' | 'admin') => void;
  children: React.ReactNode;
  // Modal states
  isSearchOpen: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
  isDiffViewerOpen: boolean;
  onDiffViewerClose: () => void;
  isCaptureModalOpen: boolean;
  onCaptureModalOpen: () => void;
  onCaptureModalClose: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentPage,
  onPageChange,
  onRoleChange,
  children,
  isSearchOpen,
  onSearchOpen,
  onSearchClose,
  isDiffViewerOpen,
  onDiffViewerClose,
  isCaptureModalOpen,
  onCaptureModalOpen,
  onCaptureModalClose,
}) => {
  return (
    <div className="min-h-screen bg-bg">
      <Header
        role="admin"
        onRoleChange={onRoleChange}
        onSearchClick={onSearchOpen}
        onCaptureClick={onCaptureModalOpen}
      />

      <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        <div className="flex flex-1">
          <Sidebar role="admin" currentPage={currentPage} onPageChange={onPageChange} />
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </div>
        <Footer />
      </div>

      <CommandSearch isOpen={isSearchOpen} onClose={onSearchClose} />
      <CaptureModal isOpen={isCaptureModalOpen} onClose={onCaptureModalClose} />
      <DiffViewer
        isOpen={isDiffViewerOpen}
        onClose={onDiffViewerClose}
        leftImage=""
        rightImage=""
        leftLabel="suspicious-site.com - Oct 15"
        rightLabel="suspicious-site.com - Oct 17"
      />
    </div>
  );
};
