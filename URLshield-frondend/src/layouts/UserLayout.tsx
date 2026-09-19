import React from 'react';
import { UserNavbar } from '../components/user/Navbar';
import { Footer } from '../components/user/Footer';

interface UserLayoutProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  children: React.ReactNode;
}

export const UserLayout: React.FC<UserLayoutProps> = ({
  currentPage,
  onPageChange,
  children,
}) => {
  return (
    <div className="user-theme min-h-screen flex flex-col bg-bg">
      <UserNavbar
        currentPage={currentPage}
        onPageChange={onPageChange}
      />

      <main className="flex-1">
        {children}
      </main>

      <Footer currentPage={currentPage} onPageChange={onPageChange} />
    </div>
  );
};
