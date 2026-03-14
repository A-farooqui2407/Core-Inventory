import { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';

const OPERATIONS_LINKS = [
  { path: '/receipts', label: 'Receipts' },
  { path: '/deliveries', label: 'Delivery Orders' },
  { path: '/adjustments', label: 'Inventory Adjustment' },
];

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  const { authEnabled, logout } = useAuth();
  const { isDark, setTheme } = useTheme();
  const { addToast } = useToast();
  const [operationsOpen, setOperationsOpen] = useState(false);
  const operationsRef = useRef(null);

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  const isOperationsActive = OPERATIONS_LINKS.some(({ path }) => isActive(path));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (operationsRef.current && !operationsRef.current.contains(e.target)) {
        setOperationsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="app-layout">
      <a href="#app-main" className="skip-link">Skip to main content</a>
      <header className="app-header">
        <Link to="/" className="app-brand">CoreInventory</Link>
        <nav className="app-nav">
          <Link to="/" className={isActive('/') && location.pathname === '/' ? 'active' : ''}>Dashboard</Link>
          <Link to="/products" className={isActive('/products') ? 'active' : ''}>Products</Link>
          <div className="nav-dropdown" ref={operationsRef}>
            <button
              type="button"
              className={`nav-dropdown-trigger ${operationsOpen || isOperationsActive ? 'active' : ''}`}
              onClick={() => setOperationsOpen((o) => !o)}
              aria-expanded={operationsOpen}
              aria-haspopup="true"
            >
              Operations ▾
            </button>
            {operationsOpen && (
              <ul className="nav-dropdown-menu" role="menu">
                {OPERATIONS_LINKS.map(({ path, label }) => (
                  <li key={path} role="none">
                    <Link to={path} role="menuitem" onClick={() => setOperationsOpen(false)} className={isActive(path) ? 'active' : ''}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link to="/movements" className={isActive('/movements') ? 'active' : ''}>Move History</Link>
          <Link to="/transfer" className={isActive('/transfer') ? 'active' : ''}>Transfer</Link>
          <Link to="/scheduled" className={isActive('/scheduled') ? 'active' : ''}>Schedule</Link>
          <Link to="/settings" className={isActive('/settings') ? 'active' : ''}>Settings</Link>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </nav>
      </header>
      <div className="app-body">
        {authEnabled && (
          <aside className="app-sidebar" aria-label="Profile menu">
            <nav className="sidebar-nav">
              <h2 className="sidebar-title">Profile</h2>
              <ul className="sidebar-menu">
                <li>
                  <Link to="/profile" className={isActive('/profile') ? 'active' : ''}>My Profile</Link>
                </li>
                <li>
                  <button type="button" className="sidebar-logout" onClick={() => { logout(); addToast('Logged out successfully', 'success'); }}>Logout</button>
                </li>
              </ul>
            </nav>
          </aside>
        )}
        <main id="app-main" className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
