import { useState, useEffect } from 'react';
import { warehousesApi } from '@/services/api';

export default function Warehouses() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', address: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sort, setSort] = useState('id');
  const [order, setOrder] = useState('desc');
  const [refreshKey, setRefreshKey] = useState(0);

  const limit = 20;

  function load() {
    setLoading(true);
    setError(null);
    warehousesApi
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
    warehousesApi
      .list({ page, limit, search: search || undefined, sort, order })
      .then((data) => {
        if (!cancelled) {
          setItems(data.data?.items ?? []);
          setTotal(data.data?.total ?? 0);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, search, sort, order, refreshKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', address: '' });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name ?? '', code: row.code ?? '', address: row.address ?? '' });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.code?.trim()) return;
    const body = { name: form.name.trim(), code: form.code.trim(), address: form.address?.trim() || null };
    if (editing) {
      warehousesApi.update(editing.id, body).then(() => { setFormOpen(false); load(); });
    } else {
      warehousesApi.create(body).then(() => { setFormOpen(false); load(); });
    }
  };

  const handleDelete = (id) => {
    warehousesApi.delete(id).then(() => { setDeleteConfirm(null); load(); });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Warehouses</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add warehouse</button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name or code"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input"
        />
        <select className="input" value={`${sort}-${order}`} onChange={(e) => { const v = e.target.value.split('-'); setSort(v[0]); setOrder(v[1]); setPage(1); }} style={{ maxWidth: 160 }}>
          <option value="id-desc">Newest</option>
          <option value="name-asc">Name (A–Z)</option>
          <option value="code-asc">Code (A–Z)</option>
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
                  <th>Code</th>
                  <th>Name</th>
                  <th>Address</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.address || '—'}</td>
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
            <h2>{editing ? 'Edit warehouse' : 'New warehouse'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <label>Code *</label>
              <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
              <label>Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
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
            <p>Delete warehouse &quot;{deleteConfirm.name}&quot;? Locations will be removed.</p>
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
