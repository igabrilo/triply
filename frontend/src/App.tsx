import { useEffect } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import Home from '@pages/Home';
import Dashboard from '@pages/Dashboard';
import Account from '@pages/Account';
import { useAuthStore } from '@/store/authStore';

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback, fetchCurrentUser, isAuthenticated, user } = useAuthStore();

  // Restore user from token on app load
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchCurrentUser();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    const intent = searchParams.get('intent');
    const error = searchParams.get('error');
    
    if (token) {
      handleOAuthCallback(token).then(() => {
        // Clear URL params
        setSearchParams({});
        
        // Navigate based on intent from backend
        if (intent === 'generate_trip') {
          // User was generating a trip - stay on home page
          // (Home.tsx will auto-trigger trip generation)
          navigate('/');
        } else {
          // Normal sign-in - go to account page
          navigate('/account');
        }
      }).catch((err) => {
        console.error('OAuth callback failed:', err);
        setSearchParams({ error: 'auth_failed' });
      });
    } else if (error) {
      console.error('OAuth error:', error);
    }
  }, [searchParams, handleOAuthCallback, navigate, setSearchParams]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/account" element={<Account />} />
    </Routes>
  );
}

export default App;
