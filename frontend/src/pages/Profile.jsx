import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ username: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.sub) {
      queueMicrotask(() => {
        setProfile({ username: '—', email: '' });
        setLoading(false);
      });
      return;
    }
    authApi.me()
      .then((data) => setProfile({ username: data.data?.username ?? user.sub, email: data.data?.email ?? '' }))
      .catch((err) => { setError(err.message); setProfile({ username: user.sub, email: '' }); })
      .finally(() => setLoading(false));
  }, [user?.sub]);

  if (loading) {
    return (
      <div className="page">
        <h1>My Profile</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>My Profile</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="profile-cards">
        <div className="settings-card profile-field-card">
          <label className="profile-field-label" htmlFor="profile-username">Username</label>
          <input
            id="profile-username"
            type="text"
            className="input"
            value={profile.username}
            readOnly
            disabled
            aria-label="Username"
          />
        </div>
        <div className="settings-card profile-field-card">
          <label className="profile-field-label" htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            type="email"
            className="input"
            value={profile.email || '—'}
            readOnly
            disabled
            aria-label="Email"
          />
        </div>
        <div className="settings-card profile-field-card">
          <label className="profile-field-label" htmlFor="profile-password">Password</label>
          <input
            id="profile-password"
            type="password"
            className="input"
            value="••••••••"
            readOnly
            disabled
            autoComplete="off"
            aria-label="Password"
          />
          <p className="profile-change-password">
            <Link to="/forgot-password">Change password</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
