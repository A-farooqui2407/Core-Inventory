import { useState, useEffect } from 'react';
import { productsApi } from '@/services/api';

export default function Products() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', description: '', quantity: 0, unit: 'pcs' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const limit = 20;

  function load() {
    setLoading(true);
    setError(null);
    productsApi
      .list({ page, limit, search: search || undefined })
      .then((data) => {
        setItems(data.data?.items ?? []);
        setTotal(data.data?.total ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(null);
    });
    productsApi
      .list({ page, limit, search: search || undefined })
      .then((data) => {
        if (!cancelled) {
          setItems(data.data?.items ?? []);
          setTotal(data.data?.total ?? 0);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', sku: '', description: '', quantity: 0, unit: 'pcs' });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name ?? '',
      sku: row.sku ?? '',
      description: row.description ?? '',
      quantity: row.quantity ?? 0,
      unit: row.unit ?? 'pcs',
    });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    if (!form.sku?.trim()) return;
    const body = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description?.trim() || null,
      quantity: Number(form.quantity) || 0,
      unit: form.unit?.trim() || 'pcs',
    };
    if (editing) {
      productsApi.update(editing.id, body).then(() => { setFormOpen(false); load(); });
    } else {
      productsApi.create(body).then(() => { setFormOpen(false); load(); });
    }
  };

  const handleDelete = (id) => {
    productsApi.delete(id).then(() => { setDeleteConfirm(null); load(); });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Products</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add product</button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name or SKU"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input"
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.quantity}</td>
                    <td>{row.unit}</td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => openEdit(row)}>Edit</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(row)}>Delete</button>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edit product' : 'New product'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <label>SKU *</label>
              <input className="input" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} required />
              <label>Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <label>Quantity</label>
              <input type="number" className="input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} min="0" step="any" />
              <label>Unit</label>
              <input className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <p>Delete product &quot;{deleteConfirm.name}&quot;?</p>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
