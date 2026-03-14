import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryAll, queryOne, getLastId } from '../lib/db.js';
import { success, notFound, validationError } from '../lib/response.js';

const router = Router();

// GET /api/locations — optional ?warehouse_id=
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const warehouseId = req.query.warehouse_id ? parseInt(req.query.warehouse_id, 10) : null;
    let sql = 'SELECT l.*, w.name as warehouse_name FROM locations l JOIN warehouses w ON l.warehouse_id = w.id WHERE l.user_id = ?';
    const params = [userId];
    if (Number.isInteger(warehouseId)) {
      sql += ' AND l.warehouse_id = ?';
      params.push(warehouseId);
    }
    sql += ' ORDER BY l.warehouse_id, l.id';
    const items = queryAll(db, sql, params);
    return success(res, { items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/locations/:id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid location id');
    const row = queryOne(db, 'SELECT l.*, w.name as warehouse_name FROM locations l JOIN warehouses w ON l.warehouse_id = w.id WHERE l.id = ? AND l.user_id = ?', [id, userId]);
    if (!row) return notFound(res, 'Location');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/locations
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const { warehouse_id, name, code, parent_id } = req.body || {};
    const wid = parseInt(warehouse_id, 10);
    if (!Number.isInteger(wid)) return validationError(res, 'warehouse_id is required');
    if (!name || typeof name !== 'string' || !name.trim()) return validationError(res, 'name is required');
    if (!code || typeof code !== 'string' || !code.trim()) return validationError(res, 'code is required');
    const db = await getDbAsync();
    const parent = parent_id != null ? parseInt(parent_id, 10) : null;
    db.run(
      'INSERT INTO locations (warehouse_id, name, code, parent_id, user_id, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [wid, name.trim(), code.trim(), Number.isInteger(parent) ? parent : null, userId]
    );
    const id = getLastId(db);
    saveDb();
    const row = queryOne(db, 'SELECT l.*, w.name as warehouse_name FROM locations l JOIN warehouses w ON l.warehouse_id = w.id WHERE l.id = ?', [id]);
    return success(res, row, 201);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return validationError(res, 'Location code already exists in this warehouse');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/locations/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid location id');
    const { name, code, parent_id } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM locations WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Location');
    const n = (name != null && String(name).trim()) ? String(name).trim() : existing.name;
    const c = (code != null && String(code).trim()) ? String(code).trim() : existing.code;
    const p = parent_id !== undefined ? (Number.isInteger(parseInt(parent_id, 10)) ? parseInt(parent_id, 10) : null) : existing.parent_id;
    db.run('UPDATE locations SET name=?, code=?, parent_id=?, updated_at=datetime("now") WHERE id=? AND user_id=?', [n, c, p, id, userId]);
    saveDb();
    const row = queryOne(db, 'SELECT l.*, w.name as warehouse_name FROM locations l JOIN warehouses w ON l.warehouse_id = w.id WHERE l.id = ?', [id]);
    return success(res, row);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return validationError(res, 'Location code already exists in this warehouse');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/locations/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid location id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM locations WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Location');
    db.run('DELETE FROM locations WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
