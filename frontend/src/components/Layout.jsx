import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Layout() {
  const location = useLocation();
  const { authEnabled, logout } = useAuth();
  const nav = [
    { path: '/', label: 'Dashboard' },
    { path: '/products', label: 'Products' },
    { path: '/warehouses', label: 'Warehouses' },
    { path: '/locations', label: 'Locations' },
    { path: '/movements', label: 'Movements' },
    { path: '/scheduled', label: 'Scheduled' },
    { path: '/transfer', label: 'Transfer' },
  ];

  return (
    <div className="app-layout">
      <a href="#app-main" className="skip-link">Skip to main content</a>
      <header className="app-header">
        <Link to="/" className="app-brand">CoreInventory</Link>
        <nav className="app-nav">
          {nav.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={location.pathname === path || (path !== '/' && location.pathname.startsWith(path)) ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
          {authEnabled && (
            <button type="button" className="btn btn-sm" onClick={logout} style={{ marginLeft: 'auto' }}>Logout</button>
          )}
        </nav>
      </header>
      <main id="app-main" className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
