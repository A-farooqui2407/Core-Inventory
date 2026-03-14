import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryAll, queryOne, getLastId } from '../lib/db.js';
import { success, notFound, validationError } from '../lib/response.js';

const router = Router();

/** Indian mobile: 10 digits, starts with 6,7,8,9. Accepts with or without +91/91 prefix. Returns normalized 10 digits or null if invalid/empty. */
function normalizeIndianMobile(value) {
  if (value == null || typeof value !== 'string') return null;
  const stripped = value.trim().replace(/^\+91\s*|-/g, '').replace(/\s/g, '').replace(/^91/, '');
  if (stripped === '' || !/^[6-9]\d{9}$/.test(stripped)) return null;
  return stripped;
}

router.get('/', async (_req, res) => {
  try {
    const db = await getDbAsync();
    const items = queryAll(db, 'SELECT * FROM suppliers ORDER BY name');
    return success(res, { items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid supplier id');
    const row = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!row) return notFound(res, 'Supplier');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, code, contact, address } = req.body || {};
    if (!name || !String(name).trim()) return validationError(res, 'name is required');
    if (!code || !String(code).trim()) return validationError(res, 'code is required');
    const contactVal = contact != null && String(contact).trim() ? normalizeIndianMobile(String(contact).trim()) : null;
    if (contact != null && String(contact).trim() && !contactVal) return validationError(res, 'Please enter a valid Indian mobile number');
    const db = await getDbAsync();
    db.run(
      'INSERT INTO suppliers (name, code, contact, address, updated_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [name.trim(), code.trim(), contactVal ?? null, address?.trim() ?? null]
    );
    const id = getLastId(db);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    return success(res, row, 201);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return validationError(res, 'Supplier code already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid supplier id');
    const { name, code, contact, address } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Supplier');
    const n = (name != null && String(name).trim()) ? name.trim() : existing.name;
    const c = (code != null && String(code).trim()) ? code.trim() : existing.code;
    let ct = existing.contact;
    if (contact !== undefined) {
      if (contact == null || !String(contact).trim()) ct = null;
      else {
        const normalized = normalizeIndianMobile(String(contact).trim());
        if (!normalized) return validationError(res, 'Please enter a valid Indian mobile number');
        ct = normalized;
      }
    }
    const a = address !== undefined ? (address?.trim() || null) : existing.address;
    db.run('UPDATE suppliers SET name=?, code=?, contact=?, address=?, updated_at=datetime("now") WHERE id=?', [n, c, ct, a, id]);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM suppliers WHERE id = ?', [id]);
    return success(res, row);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return validationError(res, 'Supplier code already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid supplier id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM suppliers WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Supplier');
    db.run('UPDATE receipt_documents SET supplier_id = NULL WHERE supplier_id = ?', [id]);
    db.run('DELETE FROM suppliers WHERE id = ?', [id]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
