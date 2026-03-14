import { useState, useEffect } from 'react';
import { movementsApi, productsApi, locationsApi } from '@/services/api';

export default function Adjustments() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', quantity: '', to_location_id: '', notes: '' });
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;

  useEffect(() => {
    productsApi.list({ limit: 500 }).then((d) => setProducts(d.data?.items ?? [])).catch(() => {});
    locationsApi.list().then((d) => setLocations(d.data?.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    movementsApi
      .list({ page, limit, type: 'Adjustment' })
      .then((data) => {
        setItems(data.data?.items ?? []);
        setTotal(data.data?.total ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, refreshKey]);

  const openCreate = () => {
    setForm({ product_id: '', quantity: '', to_location_id: '', notes: '' });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const pid = parseInt(form.product_id, 10);
    const qty = parseFloat(form.quantity);
    if (!pid || !Number.isFinite(qty)) return;
    movementsApi.create({
      type: 'Adjustment',
      product_id: pid,
      quantity: qty,
      to_location_id: form.to_location_id ? parseInt(form.to_location_id, 10) : null,
      notes: form.notes || null,
    }).then(() => { setFormOpen(false); setRefreshKey((k) => k + 1); }).catch((err) => setError(err.message));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Inventory Adjustment</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>New adjustment</button>
      </div>
      <p className="muted">Set counted quantity: enter the difference (positive to add, negative to subtract) or use Move History for full ledger.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>To location</th>
                  <th>Notes</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.product_sku} – {row.product_name}</td>
                    <td>{row.quantity}</td>
                    <td>{row.to_location_name || '—'}</td>
                    <td>{row.notes || '—'}</td>
                    <td>{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {Math.ceil(total / limit)}</span>
              <button type="button" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New adjustment</h2>
            <form onSubmit={handleSubmit}>
              <label>Product *</label>
              <select className="input" value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))} required>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} – {p.name} (current: {p.quantity})</option>
                ))}
              </select>
              <label>Quantity delta * (positive = add, negative = subtract)</label>
              <input type="number" className="input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} required step="any" />
              <label>To location (optional)</label>
              <select className="input" value={form.to_location_id} onChange={(e) => setForm((f) => ({ ...f, to_location_id: e.target.value }))}>
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>
                ))}
              </select>
              <label>Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
