import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from '@pages/Home';
import Dashboard from '@pages/Dashboard';
import Account from '@pages/Account';
import { useAuthStore } from '@/store/authStore';

function App() {
  const { initAuth, isLoading } = useAuthStore();

  // Initialize Supabase auth listener on app mount
  useEffect(() => {
    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    // Optional: show nothing or a spinner while Supabase session is resolving
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/account" element={<Account />} />
    </Routes>
  );
}

export default App;
