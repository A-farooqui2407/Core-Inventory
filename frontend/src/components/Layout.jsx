import { Link, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
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
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
