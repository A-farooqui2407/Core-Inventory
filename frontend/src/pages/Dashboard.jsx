import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, movementsApi } from '@/services/api';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(10);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(null);
    });
    dashboardApi
      .summary({ low_stock_threshold: threshold })
      .then((data) => {
        if (!cancelled) setSummary(data.data);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [threshold]);

  useEffect(() => {
    const load = () => {
      movementsApi.list({ limit: 15 }).then((data) => setRecentMovements(data.data?.items ?? [])).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!summary) return;
    const interval = setInterval(() => {
      dashboardApi.summary({ low_stock_threshold: threshold }).then((data) => setSummary(data.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [summary, threshold]);

  if (loading && !summary) {
    return (
      <div className="page">
        <h1>Dashboard</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Dashboard</h1>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  const d = summary || {};
  const metrics = [
    { label: 'Products', value: d.productsCount, sub: 'SKUs' },
    { label: 'Total quantity', value: d.totalQuantity, sub: 'units' },
    { label: 'Warehouses', value: d.warehousesCount, sub: 'sites' },
    { label: 'Movements', value: d.movementsCount, sub: 'total' },
  ];

  const lowStock = d.lowStockItems ?? [];
  const typeCounts = (recentMovements.length > 0
    ? recentMovements.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {})
    : {});

  return (
    <div className="page dashboard-page">
      <h1>Dashboard</h1>

      <section className="dashboard-metrics">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <span className="metric-value">{m.value}</span>
            <span className="metric-label">{m.label}</span>
            <span className="metric-sub">{m.sub}</span>
          </div>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-section low-stock-section">
          <div className="section-head">
            <h2>Low stock alerts</h2>
            <label className="threshold-control">
              Alert when &lt;{' '}
              <input
                type="number"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value) || 0)}
                className="input input-sm"
              />
            </label>
          </div>
          {lowStock.length === 0 ? (
            <p className="muted">No products below threshold.</p>
          ) : (
            <ul className="low-stock-list">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link to={`/products`} className="low-stock-link">
                    <span className="low-stock-name">{p.name}</span>
                    <span className="low-stock-qty">{p.quantity} {p.unit}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {lowStock.length > 0 && (
            <Link to="/products" className="btn btn-sm section-link">View all products</Link>
          )}
        </section>

        <section className="dashboard-section">
          <h2>Recent activity</h2>
          {recentMovements.length === 0 ? (
            <p className="muted">No movements yet.</p>
          ) : (
            <ul className="activity-timeline">
              {recentMovements.map((m) => (
                <li key={m.id} className="activity-item">
                  <span className={`activity-type activity-type-${m.type.toLowerCase()}`}>{m.type}</span>
                  <span className="activity-desc">
                    {m.product_sku} – {m.quantity} {m.from_location_name && `from ${m.from_location_name}`} {m.to_location_name && `to ${m.to_location_name}`}
                  </span>
                  <span className="activity-date">{m.created_at}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/movements" className="btn btn-sm section-link">View all movements</Link>
        </section>
      </div>

      {Object.keys(typeCounts).length > 0 && (
        <section className="dashboard-section chart-section">
          <h2>Movement types (recent)</h2>
          <div className="chart-bars">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type} className="chart-bar-row">
                <span className="chart-bar-label">{type}</span>
                <div className="chart-bar-wrap">
                  <div
                    className="chart-bar"
                    style={{
                      width: `${(count / Math.max(...Object.values(typeCounts))) * 100}%`,
                    }}
                  />
                </div>
                <span className="chart-bar-value">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
