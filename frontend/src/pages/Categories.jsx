import { useState, useEffect } from 'react';
import { categoriesApi } from '@/services/api';

export default function Categories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  useEffect(() => {
    categoriesApi.list().then((d) => setItems(d.data?.items ?? [])).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', description: '' });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name ?? '', code: row.code ?? '', description: row.description ?? '' });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = { name: form.name.trim(), code: form.code.trim(), description: form.description?.trim() || null };
    if (editing) {
      categoriesApi.update(editing.id, body).then(() => { setFormOpen(false); categoriesApi.list().then((d) => setItems(d.data?.items ?? [])); }).catch((err) => setError(err.message));
    } else {
      categoriesApi.create(body).then(() => { setFormOpen(false); categoriesApi.list().then((d) => setItems(d.data?.items ?? [])); }).catch((err) => setError(err.message));
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Product categories</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add category</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p>Loading…</p>}
      {!loading && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.description || '—'}</td>
                  <td><button type="button" className="btn btn-sm" onClick={() => openEdit(row)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edit category' : 'New category'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <label>Code *</label>
              <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
              <label>Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
