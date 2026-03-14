import { useState, useEffect } from 'react';
import { movementsApi, productsApi, locationsApi } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

const TYPES = ['Receipt', 'Delivery', 'Transfer', 'Adjustment'];

export default function Movements() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'Receipt',
    product_id: '',
    quantity: '',
    from_location_id: '',
    to_location_id: '',
    reference: '',
    notes: '',
  });
  const [sort, setSort] = useState('id');
  const [order, setOrder] = useState('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;

  function load() {
    setLoading(true);
    setError(null);
    const params = { page, limit };
    if (typeFilter) params.type = typeFilter;
    if (productId) params.product_id = productId;
    movementsApi
      .list(params)
      .then((data) => {
        setItems(data.data?.items ?? []);
        setTotal(data.data?.total ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    productsApi.list({ limit: 500 }).then((data) => setProducts(data.data?.items ?? []));
  }, []);
  useEffect(() => {
    locationsApi.list().then((data) => setLocations(data.data?.items ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(null);
    });
    const params = { page, limit, sort, order };
    if (typeFilter) params.type = typeFilter;
    if (productId) params.product_id = productId;
    movementsApi
      .list(params)
      .then((data) => {
        if (!cancelled) {
          setItems(data.data?.items ?? []);
          setTotal(data.data?.total ?? 0);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, typeFilter, productId, sort, order, refreshKey]);

  const openCreate = () => {
    setForm({
      type: 'Receipt',
      product_id: '',
      quantity: '',
      from_location_id: '',
      to_location_id: '',
      reference: '',
      notes: '',
    });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const pid = parseInt(form.product_id, 10);
    const qty = parseFloat(form.quantity);
    if (!pid || !qty) return;
    const body = {
      type: form.type,
      product_id: pid,
      quantity: form.type === 'Delivery' ? -Math.abs(qty) : qty,
      from_location_id: form.from_location_id ? parseInt(form.from_location_id, 10) : null,
      to_location_id: form.to_location_id ? parseInt(form.to_location_id, 10) : null,
      reference: form.reference?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    movementsApi.create(body).then(() => { addToast('Stock movement recorded successfully', 'success'); setFormOpen(false); load(); }).catch((err) => { setError(err.message); addToast('Failed to record stock movement', 'error'); });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Stock movements</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>New movement</button>
      </div>

      <div className="toolbar">
        <select className="input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className="input" value={productId} onChange={(e) => { setProductId(e.target.value); setPage(1); }}>
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.sku} – {p.name}</option>
          ))}
        </select>
        <select className="input" value={`${sort}-${order}`} onChange={(e) => { const v = e.target.value.split('-'); setSort(v[0]); setOrder(v[1]); setPage(1); }} style={{ maxWidth: 160 }}>
          <option value="id-desc">Newest first</option>
          <option value="created_at-desc">Date (newest)</option>
          <option value="created_at-asc">Date (oldest)</option>
          <option value="type-asc">Type (A–Z)</option>
        </select>
        <button type="button" className="btn" onClick={() => setRefreshKey((k) => k + 1)} title="Refresh">↻</button>
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
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reference</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td><span className={`type-badge type-${row.type.toLowerCase()}`}>{row.type}</span></td>
                    <td>{row.product_sku} – {row.product_name}</td>
                    <td>{row.quantity}</td>
                    <td>{row.from_location_name || '—'}</td>
                    <td>{row.to_location_name || '—'}</td>
                    <td>{row.reference || '—'}</td>
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
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <h2>New movement</h2>
            <form onSubmit={handleSubmit}>
              <label>Type *</label>
              <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} required>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label>Product *</label>
              <select className="input" value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))} required>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} – {p.name} (qty: {p.quantity})</option>
                ))}
              </select>
              <label>Quantity * (positive for Receipt/Adjustment; for Delivery use positive amount to deduct)</label>
              <input type="number" className="input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} required step="any" />
              {form.type === 'Transfer' && (
                <>
                  <label>From location *</label>
                  <select className="input" value={form.from_location_id} onChange={(e) => setForm((f) => ({ ...f, from_location_id: e.target.value }))}>
                    <option value="">Select</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>
                    ))}
                  </select>
                  <label>To location *</label>
                  <select className="input" value={form.to_location_id} onChange={(e) => setForm((f) => ({ ...f, to_location_id: e.target.value }))}>
                    <option value="">Select</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>
                    ))}
                  </select>
                </>
              )}
              {(form.type === 'Receipt' || form.type === 'Adjustment') && (
                <>
                  <label>To location (optional)</label>
                  <select className="input" value={form.to_location_id} onChange={(e) => setForm((f) => ({ ...f, to_location_id: e.target.value }))}>
                    <option value="">None</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>
                    ))}
                  </select>
                </>
              )}
              {form.type === 'Delivery' && (
                <>
                  <label>From location (optional)</label>
                  <select className="input" value={form.from_location_id} onChange={(e) => setForm((f) => ({ ...f, from_location_id: e.target.value }))}>
                    <option value="">None</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>
                    ))}
                  </select>
                </>
              )}
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
