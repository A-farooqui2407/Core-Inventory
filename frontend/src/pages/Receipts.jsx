import { useState, useEffect } from 'react';
import { receiptsApi, suppliersApi, productsApi, locationsApi } from '@/services/api';

const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];

export default function Receipts() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ supplier_id: '', reference: '', notes: '', lines: [{ product_id: '', quantity: '', to_location_id: '' }] });
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;

  useEffect(() => {
    suppliersApi.list().then((d) => setSuppliers(d.data?.items ?? [])).catch(() => {});
    productsApi.list({ limit: 500 }).then((d) => setProducts(d.data?.items ?? [])).catch(() => {});
    locationsApi.list().then((d) => setLocations(d.data?.items ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit };
    if (statusFilter) params.status = statusFilter;
    receiptsApi
      .list(params)
      .then((data) => {
        setItems(data.data?.items ?? []);
        setTotal(data.data?.total ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter, refreshKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ supplier_id: '', reference: '', notes: '', lines: [{ product_id: '', quantity: '', to_location_id: '' }] });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    receiptsApi.get(row.id).then((data) => {
      const d = data.data;
      setForm({
        supplier_id: d.supplier_id ?? '',
        reference: d.reference ?? '',
        notes: d.notes ?? '',
        lines: (d.lines ?? []).length ? d.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, to_location_id: l.to_location_id ?? '' })) : [{ product_id: '', quantity: '', to_location_id: '' }],
      });
      setFormOpen(true);
    }).catch(() => setError('Failed to load receipt'));
  };

  const addLine = () => {
    setForm((f) => ({ ...f, lines: [...f.lines, { product_id: '', quantity: '', to_location_id: '' }] }));
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
      to_location_id: l.to_location_id ? parseInt(l.to_location_id, 10) : null,
    }));
    const body = { supplier_id: form.supplier_id ? parseInt(form.supplier_id, 10) : null, reference: form.reference || null, notes: form.notes || null, lines };
    if (editing) {
      receiptsApi.update(editing.id, body).then(() => { setFormOpen(false); setRefreshKey((k) => k + 1); }).catch((err) => setError(err.message));
    } else {
      receiptsApi.create(body).then(() => { setFormOpen(false); setRefreshKey((k) => k + 1); }).catch((err) => setError(err.message));
    }
  };

  const handleValidate = (id) => {
    if (!confirm('Validate this receipt? Stock will be increased.')) return;
    receiptsApi.validate(id).then(() => setRefreshKey((k) => k + 1)).catch((err) => setError(err.message));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Receipts (Incoming Stock)</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>New receipt</button>
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
                  <th>Supplier</th>
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
                    <td>{row.supplier_name || row.supplier_code || '—'}</td>
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
            <h2>{editing ? 'Edit receipt' : 'New receipt'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Supplier</label>
              <select className="input" value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">— Select —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} – {s.name}</option>
                ))}
              </select>
              <label>Reference</label>
              <input className="input" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
              <label>Notes</label>
              <input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <div className="form-section">
                <div className="form-section-head">
                  <strong>Products</strong>
                  <button type="button" className="btn btn-sm" onClick={addLine}>Add line</button>
                </div>
                {form.lines.map((line, idx) => (
                  <div key={idx} className="form-row form-row-inline">
                    <select className="input" value={line.product_id} onChange={(e) => updateLine(idx, 'product_id', e.target.value)}>
                      <option value="">Product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.sku} – {p.name}</option>
                      ))}
                    </select>
                    <input type="number" className="input" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} step="any" min="0" />
                    <select className="input" value={line.to_location_id} onChange={(e) => updateLine(idx, 'to_location_id', e.target.value)}>
                      <option value="">To location</option>
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
