import { ReactNode } from 'react';
import Navbar from './Navbar';
import AuthModal from '@components/auth/AuthModal';

interface LayoutProps {
  children: ReactNode;
  showBlobs?: boolean;
  fullViewport?: boolean;
}

export default function Layout({ children, showBlobs = true, fullViewport = false }: LayoutProps) {
  return (
    <div className="relative min-h-screen">
      {/* Background Blobs */}
      {showBlobs && (
        <>
          <div className="bg-blob bg-blob-1" aria-hidden />
          <div className="bg-blob bg-blob-2" aria-hidden />
        </>
      )}

      <Navbar />

      {/* Main Content */}
      <main className={`relative z-10${fullViewport ? '' : ' pt-16'}`}>
        {children}
      </main>

      {/* Auth Modal (global) */}
      <AuthModal />
    </div>
  );
}
