import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from '@pages/Home';
import { useAuthStore } from '@/store/authStore';

const Dashboard = lazy(() => import('@pages/Dashboard'));
const Account = lazy(() => import('@pages/Account'));

function App() {
  const { initAuth, isLoading } = useAuthStore();

  // Initialize Supabase auth listener on app mount
  useEffect(() => {
    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/account" element={<Account />} />
      </Routes>
    </Suspense>
  );
}

export default App;
