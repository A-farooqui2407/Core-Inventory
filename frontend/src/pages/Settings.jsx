import { Link } from 'react-router-dom';

export default function Settings() {
  return (
    <div className="page settings-page">
      <h1 className="settings-page-title">Settings</h1>
      <div className="settings-grid">
        <section className="settings-card">
          <h2 className="settings-card-title">Warehouse</h2>
          <p className="settings-card-desc">Manage warehouses and locations.</p>
          <div className="settings-card-actions">
            <Link to="/warehouses" className="btn btn-primary">Warehouses</Link>
            <Link to="/locations" className="btn">Locations</Link>
          </div>
        </section>
        <section className="settings-card">
          <h2 className="settings-card-title">Product categories</h2>
          <p className="settings-card-desc">Manage product categories for filtering and reordering.</p>
          <div className="settings-card-actions">
            <Link to="/categories" className="btn btn-primary">Categories</Link>
          </div>
        </section>
        <section className="settings-card">
          <h2 className="settings-card-title">Suppliers</h2>
          <p className="settings-card-desc">Manage suppliers for receipts (incoming stock).</p>
          <div className="settings-card-actions">
            <Link to="/suppliers" className="btn btn-primary">Suppliers</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
