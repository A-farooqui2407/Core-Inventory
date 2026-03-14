import { useState, useEffect } from 'react';
import { productsApi, categoriesApi } from '@/services/api';

export default function Products() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', description: '', quantity: 0, unit: 'pcs', category_id: '', reorder_min_quantity: '', reorder_quantity: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sort, setSort] = useState('id');
  const [order, setOrder] = useState('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;

  useEffect(() => {
    categoriesApi.list().then((d) => setCategories(d.data?.items ?? [])).catch(() => {});
  }, []);

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
    const params = { page, limit, search: search || undefined, sort, order };
    if (categoryFilter) params.category_id = categoryFilter;
    productsApi
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
  }, [page, search, categoryFilter, sort, order, refreshKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', sku: '', description: '', quantity: 0, unit: 'pcs', category_id: '', reorder_min_quantity: '', reorder_quantity: '' });
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
      category_id: row.category_id ?? '',
      reorder_min_quantity: row.reorder_min_quantity ?? '',
      reorder_quantity: row.reorder_quantity ?? '',
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
      category_id: form.category_id ? parseInt(form.category_id, 10) : null,
      reorder_min_quantity: form.reorder_min_quantity !== '' ? parseFloat(form.reorder_min_quantity) : null,
      reorder_quantity: form.reorder_quantity !== '' ? parseFloat(form.reorder_quantity) : null,
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
        <select className="input" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} style={{ maxWidth: 160 }}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="input" value={`${sort}-${order}`} onChange={(e) => { const v = e.target.value.split('-'); setSort(v[0]); setOrder(v[1]); setPage(1); }} style={{ maxWidth: 160 }}>
          <option value="id-desc">Newest</option>
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="sku-asc">SKU (A–Z)</option>
          <option value="quantity-desc">Qty (high first)</option>
          <option value="quantity-asc">Qty (low first)</option>
          <option value="category_name-asc">Category (A–Z)</option>
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
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Reorder</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.category_name || '—'}</td>
                    <td>{row.quantity}</td>
                    <td>{row.unit}</td>
                    <td>{row.reorder_min_quantity != null ? `min ${row.reorder_min_quantity}` : ''} {row.reorder_quantity != null ? `→ ${row.reorder_quantity}` : ''}</td>
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
              <label>Category</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <label>Reorder min quantity (alert when below)</label>
              <input type="number" className="input" value={form.reorder_min_quantity} onChange={(e) => setForm((f) => ({ ...f, reorder_min_quantity: e.target.value }))} min="0" step="any" placeholder="Optional" />
              <label>Reorder quantity (suggested order size)</label>
              <input type="number" className="input" value={form.reorder_quantity} onChange={(e) => setForm((f) => ({ ...f, reorder_quantity: e.target.value }))} min="0" step="any" placeholder="Optional" />
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
