import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function Navbar() {
  const location = useLocation();
  const { isAuthenticated, user, openAuthModal, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isHome = location.pathname === '/';

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="navbar"
    >
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div className="navbar-logo-dot" />
          <span className="navbar-logo-text">Triply</span>
        </Link>

        {/* Desktop Nav Links */}
        {isHome ? (
          <div className="navbar-links hide-mobile">
            <a href="#how-it-works" className="navbar-link">How it works</a>
            <a href="#pricing" className="navbar-link">Pricing</a>
          </div>
        ) : (
          <div className="navbar-links hide-mobile">
            <Link to="/#how-it-works" className="navbar-link">How it works</Link>
            <Link to="/#pricing" className="navbar-link">Pricing</Link>
          </div>
        )}

        {/* Desktop Auth */}
        <div className="navbar-actions hide-mobile">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="navbar-link">My Trips</Link>
              <button onClick={logout} className="navbar-link">Sign out</button>
              <div className="avatar avatar-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => openAuthModal('signin')} className="navbar-link">
                Sign in
              </button>
              <button onClick={() => openAuthModal('signup')} className="btn btn-primary btn-sm">
                Get started
              </button>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="icon-btn show-mobile-only"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mobile-menu"
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isHome ? (
                <>
                  <a href="#how-it-works" className="navbar-link" onClick={() => setMobileOpen(false)}>How it works</a>
                  <a href="#pricing" className="navbar-link" onClick={() => setMobileOpen(false)}>Pricing</a>
                </>
              ) : (
                <>
                  <Link to="/#how-it-works" className="navbar-link" onClick={() => setMobileOpen(false)}>How it works</Link>
                  <Link to="/#pricing" className="navbar-link" onClick={() => setMobileOpen(false)}>Pricing</Link>
                </>
              )}
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="navbar-link">My Trips</Link>
                  <button onClick={logout} className="navbar-link">Sign out</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { openAuthModal('signin'); setMobileOpen(false); }}
                    className="navbar-link"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => { openAuthModal('signup'); setMobileOpen(false); }}
                    className="btn btn-primary btn-md btn-full"
                  >
                    Get started
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
