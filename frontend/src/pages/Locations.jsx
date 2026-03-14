import { useState, useEffect } from 'react';
import { locationsApi, warehousesApi } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';

export default function Locations() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ warehouse_id: '', name: '', code: '', parent_id: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = warehouseId ? { warehouse_id: warehouseId } : {};
    locationsApi
      .list(params)
      .then((data) => setItems(data.data?.items ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    warehousesApi.list({ limit: 500 }).then((data) => setWarehouses(data.data?.items ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
      if (!cancelled) setError(null);
    });
    const params = warehouseId ? { warehouse_id: warehouseId } : {};
    locationsApi
      .list(params)
      .then((data) => { if (!cancelled) setItems(data.data?.items ?? []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [warehouseId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ warehouse_id: warehouseId || '', name: '', code: '', parent_id: '' });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      warehouse_id: row.warehouse_id,
      name: row.name ?? '',
      code: row.code ?? '',
      parent_id: row.parent_id ?? '',
    });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const wid = parseInt(form.warehouse_id, 10);
    if (!wid || !form.name?.trim() || !form.code?.trim()) return;
    const body = {
      warehouse_id: wid,
      name: form.name.trim(),
      code: form.code.trim(),
      parent_id: form.parent_id ? parseInt(form.parent_id, 10) : null,
    };
    if (editing) {
      locationsApi.update(editing.id, { name: body.name, code: body.code, parent_id: body.parent_id }).then(() => { addToast('Location updated successfully', 'success'); setFormOpen(false); load(); }).catch(() => addToast('Failed to update location', 'error'));
    } else {
      locationsApi.create(body).then(() => { addToast('Location added successfully', 'success'); setFormOpen(false); load(); }).catch(() => addToast('Failed to add location', 'error'));
    }
  };

  const handleDelete = (id) => {
    locationsApi.delete(id).then(() => { addToast('Location deleted successfully', 'success'); setDeleteConfirm(null); load(); }).catch(() => addToast('Failed to delete location', 'error'));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Locations</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>Add location</button>
      </div>

      <div className="toolbar">
        <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.code} – {w.name}</option>
          ))}
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
                  <th>Warehouse</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Parent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.warehouse_name ?? row.warehouse_id}</td>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.parent_id || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => openEdit(row)}>Edit</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(row)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edit location' : 'New location'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Warehouse *</label>
              <select className="input" value={form.warehouse_id} onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))} required disabled={!!editing}>
                <option value="">Select</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} – {w.name}</option>
                ))}
              </select>
              <label>Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <label>Code *</label>
              <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
              <label>Parent location (optional)</label>
              <select className="input" value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
                <option value="">None</option>
                {items.filter((l) => l.id !== editing?.id).map((l) => (
                  <option key={l.id} value={l.id}>{l.code} – {l.name}</option>
                ))}
              </select>
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
            <p>Delete location &quot;{deleteConfirm.name}&quot;?</p>
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
