import { useState, useEffect } from 'react';
import { scheduledApi, productsApi, locationsApi } from '@/services/api';

const TYPES = ['Receipt', 'Delivery', 'Transfer', 'Pick', 'Stocktake'];
const STATUSES = [{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'done', label: 'Done' }, { value: 'cancelled', label: 'Cancelled' }];

export default function Scheduled() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('due_date');
  const [order, setOrder] = useState('asc');
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ type: 'Transfer', product_id: '', quantity: '', from_location_id: '', to_location_id: '', due_date: '', reference: '', notes: '' });
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;
  function refetch() { setRefreshKey((k) => k + 1); }

  useEffect(() => {
    productsApi.list({ limit: 500 }).then((data) => setProducts(data.data?.items ?? []));
    locationsApi.list().then((data) => setLocations(data.data?.items ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); if (!cancelled) setError(null); });
    scheduledApi
      .list({ page, limit, status: statusFilter || undefined, sort, order })
      .then((data) => {
        if (!cancelled) {
          setItems(data.data?.items ?? []);
          setTotal(data.data?.total ?? 0);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, statusFilter, sort, order, refreshKey]);

  const openCreate = () => {
    setForm({ type: 'Transfer', product_id: '', quantity: '', from_location_id: '', to_location_id: '', due_date: new Date().toISOString().slice(0, 16), reference: '', notes: '' });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.due_date?.trim()) return;
    const body = {
      type: form.type,
      product_id: form.product_id ? parseInt(form.product_id, 10) : null,
      quantity: form.quantity ? parseFloat(form.quantity) : null,
      from_location_id: form.from_location_id ? parseInt(form.from_location_id, 10) : null,
      to_location_id: form.to_location_id ? parseInt(form.to_location_id, 10) : null,
      due_date: form.due_date.trim(),
      reference: form.reference?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    scheduledApi.create(body).then(() => { setFormOpen(false); refetch(); });
  };

  const setStatus = (id, status) => {
    scheduledApi.update(id, { status }).then(refetch);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Scheduled operations</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Schedule</button>
      </div>

      <div className="toolbar">
        <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ maxWidth: 140 }}>
          {STATUSES.map((s) => (
            <option key={s.value || 'all'} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select className="input" value={`${sort}-${order}`} onChange={(e) => { const v = e.target.value.split('-'); setSort(v[0]); setOrder(v[1]); }} style={{ maxWidth: 180 }}>
          <option value="due_date-asc">Due date (asc)</option>
          <option value="due_date-desc">Due date (desc)</option>
          <option value="created_at-desc">Newest first</option>
          <option value="type-asc">Type (A–Z)</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Product</th>
                  <th>From → To</th>
                  <th>Qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.type}</td>
                    <td>{row.due_date}</td>
                    <td><span className={`badge badge-${row.status}`}>{row.status}</span></td>
                    <td>{row.product_sku ? `${row.product_sku} – ${row.product_name}` : '—'}</td>
                    <td>{row.from_location_name || '—'} → {row.to_location_name || '—'}</td>
                    <td>{row.quantity ?? '—'}</td>
                    <td>
                      {row.status === 'pending' && (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => setStatus(row.id, 'done')}>Done</button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => setStatus(row.id, 'cancelled')}>Cancel</button>
                        </>
                      )}
                    </td>
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
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <h2>Schedule operation</h2>
            <form onSubmit={handleSubmit}>
              <label>Type *</label>
              <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} required>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label>Due date *</label>
              <input type="datetime-local" className="input" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} required />
              <label>Product</label>
              <select className="input" value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
                <option value="">—</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} – {p.name}</option>)}
              </select>
              <label>Quantity</label>
              <input type="number" className="input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} step="any" />
              <label>From location</label>
              <select className="input" value={form.from_location_id} onChange={(e) => setForm((f) => ({ ...f, from_location_id: e.target.value }))}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>)}
              </select>
              <label>To location</label>
              <select className="input" value={form.to_location_id} onChange={(e) => setForm((f) => ({ ...f, to_location_id: e.target.value }))}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>)}
              </select>
              <label>Reference</label>
              <input className="input" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
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
