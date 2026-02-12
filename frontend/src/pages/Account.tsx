import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin,
  Plus,
  Calendar,
  Users,
  Settings,
  LogOut,
  Plane,
  ChevronRight,
  Mail,
  Crown,
} from 'lucide-react';
import Layout from '@components/layout/Layout';
import Button from '@components/ui/Button';
import { useAuthStore } from '@/store/authStore';

/* ─── Mock past trips (will be replaced with API call) ─── */
const mockPastTrips = [
  {
    id: 'trip_1',
    destination: 'Paris',
    startDate: '2026-03-15',
    endDate: '2026-03-20',
    travelers: 2,
    status: 'ready' as const,
    daysCount: 5,
  },
  {
    id: 'trip_2',
    destination: 'Barcelona',
    startDate: '2025-12-01',
    endDate: '2025-12-06',
    travelers: 4,
    status: 'ready' as const,
    daysCount: 5,
  },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Account() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated || !user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Layout showBlobs={false}>
      <div className="page-container" style={{ paddingTop: 100, paddingBottom: 80, maxWidth: 860, margin: '0 auto' }}>
        {/* ─── Profile Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="card"
          style={{ padding: 32, marginBottom: 24 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div className="avatar avatar-lg" style={{ width: 64, height: 64, fontSize: 24 }}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
              ) : (
                user.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-900)', margin: 0, lineHeight: 1.3 }}>
                {user.name}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--navy-500)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Mail size={14} /> {user.email}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button variant="ghost" size="sm" icon={<Settings size={14} />} onClick={() => {}}>
                Settings
              </Button>
              <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--navy-100)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plane size={16} style={{ color: 'var(--primary-600)' }} />
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900)', lineHeight: 1 }}>{mockPastTrips.length}</p>
                <p style={{ fontSize: 12, color: 'var(--navy-500)' }}>Trips planned</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Crown size={16} style={{ color: 'var(--primary-600)' }} />
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900)', lineHeight: 1 }}>Free</p>
                <p style={{ fontSize: 12, color: 'var(--navy-500)' }}>Current plan</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── My Trips Section ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>My Trips</h2>
            <Link to="/">
              <Button size="sm" icon={<Plus size={14} />}>New trip</Button>
            </Link>
          </div>

          {mockPastTrips.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mockPastTrips.map((trip, idx) => (
                <motion.div
                  key={trip.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.12 + idx * 0.06 }}
                  className="card card-interactive"
                  style={{ padding: 20, cursor: 'pointer' }}
                  onClick={() => navigate('/dashboard')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Destination icon */}
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <MapPin size={22} style={{ color: 'var(--primary-600)' }} />
                    </div>

                    {/* Trip info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>
                          {trip.destination}
                        </h3>
                        <span className={`badge ${trip.status === 'ready' ? 'badge-success' : 'badge-warning'}`}>
                          {trip.status === 'ready' ? 'Complete' : 'Draft'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--navy-500)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} />
                          {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={12} />
                          {trip.travelers} traveler{trip.travelers !== 1 ? 's' : ''}
                        </span>
                        <span>{trip.daysCount} days</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight size={18} style={{ color: 'var(--navy-300)', flexShrink: 0 }} />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'var(--primary-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <MapPin size={28} style={{ color: 'var(--primary-400)' }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy-900)', marginBottom: 8 }}>No trips yet</h3>
              <p style={{ fontSize: 14, color: 'var(--navy-500)', marginBottom: 20 }}>
                Start planning your first trip and it will show up here.
              </p>
              <Link to="/">
                <Button icon={<Plus size={14} />}>Plan your first trip</Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
