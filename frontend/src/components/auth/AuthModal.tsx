import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Button from '@components/ui/Button';
import { Mail, Lock, User } from 'lucide-react';

export default function AuthModal() {
  const { showAuthModal, authMode, closeAuthModal, login, signup } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>(authMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (showAuthModal && mode !== authMode) setMode(authMode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all required fields.'); return; }
    if (mode === 'signup' && !name) { setError('Please enter your name.'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') await login(email, password);
      else await signup(name, email, password);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={showAuthModal}
      onClose={closeAuthModal}
      title={mode === 'signin' ? 'Welcome back' : 'Create your account'}
      subtitle={mode === 'signin' ? 'Sign in to save your trip and access it anytime.' : 'Start planning smarter trips with Triply.'}
      size="sm"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mode === 'signup' && (
          <Input label="Name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} icon={<User size={16} />} />
        )}
        <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={16} />} />
        <Input label="Password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock size={16} />} />

        {error && (
          <p style={{ fontSize: 14, color: 'var(--error)', fontWeight: 500, background: 'rgba(239,68,68,0.05)', borderRadius: 12, padding: '8px 12px' }}>{error}</p>
        )}

        <Button type="submit" fullWidth size="lg" loading={loading}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <div className="divider">
        <span className="divider-text">or continue with</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button className="social-btn">
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google
        </button>
        <button className="social-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          Apple
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--navy-500)', marginTop: 24 }}>
        {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="btn-link">
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </Modal>
  );
}
