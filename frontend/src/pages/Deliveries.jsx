import { useState, useEffect } from 'react';
import { deliveriesApi, productsApi, locationsApi } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];

export default function Deliveries() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ reference: '', notes: '', lines: [{ product_id: '', quantity: '', from_location_id: '' }] });
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;

  useEffect(() => {
    productsApi.list({ limit: 500 }).then((d) => setProducts(d.data?.items ?? [])).catch(() => {});
    locationsApi.list().then((d) => setLocations(d.data?.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    const params = { page, limit };
    if (statusFilter) params.status = statusFilter;
    deliveriesApi
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
  }, [page, statusFilter, refreshKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ reference: '', notes: '', lines: [{ product_id: '', quantity: '', from_location_id: '' }] });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    deliveriesApi.get(row.id).then((data) => {
      const d = data.data;
      setForm({
        reference: d.reference ?? '',
        notes: d.notes ?? '',
        lines: (d.lines ?? []).length ? d.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, from_location_id: l.from_location_id ?? '' })) : [{ product_id: '', quantity: '', from_location_id: '' }],
      });
      setFormOpen(true);
    }).catch(() => setError('Failed to load delivery'));
  };

  const addLine = () => {
    setForm((f) => ({ ...f, lines: [...f.lines, { product_id: '', quantity: '', from_location_id: '' }] }));
  };

  const removeLine = (idx) => {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  };

  const updateLine = (idx, field, value) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const lines = form.lines.filter((l) => l.product_id && Number(l.quantity) > 0).map((l) => ({
      product_id: parseInt(l.product_id, 10),
      quantity: parseFloat(l.quantity),
      from_location_id: l.from_location_id ? parseInt(l.from_location_id, 10) : null,
    }));
    const body = { reference: form.reference || null, notes: form.notes || null, lines };
    if (editing) {
      deliveriesApi.update(editing.id, body).then(() => { addToast('Delivery order updated successfully', 'success'); setFormOpen(false); setRefreshKey((k) => k + 1); }).catch(() => addToast('Failed to update delivery', 'error'));
    } else {
      deliveriesApi.create(body).then(() => { addToast('Delivery order created successfully', 'success'); setFormOpen(false); setRefreshKey((k) => k + 1); }).catch(() => addToast('Failed to create delivery', 'error'));
    }
  };

  const handleValidate = (id) => {
    if (!confirm('Validate this delivery? Stock will be decreased.')) return;
    deliveriesApi.validate(id).then(() => setRefreshKey((k) => k + 1)).catch((err) => setError(err.message));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Delivery Orders (Outgoing Stock)</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>New delivery order</button>
      </div>

      <div className="toolbar">
        <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
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
                  <th>ID</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td><span className={`badge badge-${row.status}`}>{row.status}</span></td>
                    <td>{row.reference || '—'}</td>
                    <td>{row.created_at}</td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => openEdit(row)}>Edit</button>
                      {row.status !== 'done' && row.status !== 'canceled' && (
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => handleValidate(row.id)}>Validate</button>
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
            <h2>{editing ? 'Edit delivery order' : 'New delivery order'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Reference</label>
              <input className="input" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
              <label>Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <div className="form-section">
                <div className="form-section-head">
                  <strong>Pick items</strong>
                  <button type="button" className="btn btn-sm" onClick={addLine}>Add line</button>
                </div>
                {form.lines.map((line, idx) => (
                  <div key={idx} className="form-row form-row-inline">
                    <select className="input" value={line.product_id} onChange={(e) => updateLine(idx, 'product_id', e.target.value)}>
                      <option value="">Product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.sku} – {p.name} (stock: {p.quantity})</option>
                      ))}
                    </select>
                    <input type="number" className="input" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} step="any" min="0" />
                    <select className="input" value={line.from_location_id} onChange={(e) => updateLine(idx, 'from_location_id', e.target.value)}>
                      <option value="">From location</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm" onClick={() => removeLine(idx)} disabled={form.lines.length <= 1}>×</button>
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
