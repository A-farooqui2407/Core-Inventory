import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, movementsApi, warehousesApi, locationsApi, categoriesApi } from '@/services/api';

const DOCUMENT_TYPES = [
  { value: '', label: 'All types' },
  { value: 'Receipt', label: 'Receipts' },
  { value: 'Delivery', label: 'Delivery' },
  { value: 'Transfer', label: 'Internal' },
  { value: 'Adjustment', label: 'Adjustments' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'ready', label: 'Ready' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentMovements, setRecentMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(10);
  const [documentType, setDocumentType] = useState('');
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    warehousesApi.list({ limit: 500 }).then((d) => setWarehouses(d.data?.items ?? [])).catch(() => {});
    locationsApi.list().then((d) => setLocations(d.data?.items ?? [])).catch(() => {});
    categoriesApi.list().then((d) => setCategories(d.data?.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(null);
    });
    const params = { low_stock_threshold: threshold };
    if (status) params.status = status;
    if (categoryId) params.category_id = categoryId;
    dashboardApi
      .summary(params)
      .then((data) => {
        if (!cancelled) setSummary(data.data);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [threshold, status, categoryId]);

  useEffect(() => {
    const load = () => {
      const params = { limit: 15 };
      if (documentType) params.type = documentType;
      if (warehouseId) params.warehouse_id = warehouseId;
      if (locationId) params.location_id = locationId;
      if (categoryId) params.category_id = categoryId;
      movementsApi.list(params).then((data) => setRecentMovements(data.data?.items ?? [])).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [documentType, warehouseId, locationId, categoryId]);

  useEffect(() => {
    if (!summary) return;
    const interval = setInterval(() => {
      const params = { low_stock_threshold: threshold };
      if (status) params.status = status;
      if (categoryId) params.category_id = categoryId;
      dashboardApi.summary(params).then((data) => setSummary(data.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [summary, threshold, status, categoryId]);

  const locationsForWarehouse = warehouseId
    ? locations.filter((l) => String(l.warehouse_id) === String(warehouseId))
    : locations;

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
    { label: 'Products in stock', value: d.productsCount, sub: 'SKUs' },
    { label: 'Total quantity', value: d.totalQuantity, sub: 'units' },
    { label: 'Low / out of stock', value: d.lowStockCount ?? 0, sub: 'items' },
    { label: 'Pending receipts', value: d.pendingReceiptsCount ?? 0, sub: '' },
    { label: 'Pending deliveries', value: d.pendingDeliveriesCount ?? 0, sub: '' },
    { label: 'Internal transfers scheduled', value: d.scheduledTransfersCount ?? 0, sub: '' },
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

      <div className="dashboard-filters">
        <label className="dashboard-filter">
          <span className="dashboard-filter-label">Document type</span>
          <select
            className="input"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            aria-label="Filter by document type"
          >
            {DOCUMENT_TYPES.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="dashboard-filter">
          <span className="dashboard-filter-label">Status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="dashboard-filter">
          <span className="dashboard-filter-label">Warehouse</span>
          <select
            className="input"
            value={warehouseId}
            onChange={(e) => { setWarehouseId(e.target.value); setLocationId(''); }}
            aria-label="Filter by warehouse"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} – {w.name}</option>
            ))}
          </select>
        </label>
        <label className="dashboard-filter">
          <span className="dashboard-filter-label">Location</span>
          <select
            className="input"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            aria-label="Filter by location"
          >
            <option value="">All locations</option>
            {locationsForWarehouse.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.code} – {loc.name}</option>
            ))}
          </select>
        </label>
        <label className="dashboard-filter">
          <span className="dashboard-filter-label">Category</span>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Filter by product category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
            ))}
          </select>
        </label>
      </div>

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
                    className={`chart-bar chart-bar-${type.toLowerCase()}`}
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
