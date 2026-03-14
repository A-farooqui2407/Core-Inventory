import { useState, useEffect } from 'react';
import { suppliersApi } from '@/services/api';

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', contact: '', address: '' });

  useEffect(() => {
    suppliersApi.list().then((d) => setItems(d.data?.items ?? [])).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', contact: '', address: '' });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name ?? '', code: row.code ?? '', contact: row.contact ?? '', address: row.address ?? '' });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = { name: form.name.trim(), code: form.code.trim(), contact: form.contact?.trim() || null, address: form.address?.trim() || null };
    if (editing) {
      suppliersApi.update(editing.id, body).then(() => { setFormOpen(false); suppliersApi.list().then((d) => setItems(d.data?.items ?? [])); }).catch((err) => setError(err.message));
    } else {
      suppliersApi.create(body).then(() => { setFormOpen(false); suppliersApi.list().then((d) => setItems(d.data?.items ?? [])); }).catch((err) => setError(err.message));
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Suppliers</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add supplier</button>
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
                <th>Contact</th>
                <th>Address</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.contact || '—'}</td>
                  <td>{row.address || '—'}</td>
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
            <h2>{editing ? 'Edit supplier' : 'New supplier'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <label>Code *</label>
              <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
              <label>Contact</label>
              <input className="input" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
              <label>Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
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
