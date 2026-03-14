import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryAll, queryOne, getLastId } from '../lib/db.js';
import { success, notFound, validationError } from '../lib/response.js';

const router = Router();

function parseQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const search = (req.query.search || '').trim();
  const sort = (req.query.sort || 'id').trim();
  const order = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const validSort = ['id', 'name', 'code', 'created_at'].includes(sort) ? sort : 'id';
  return { limit, offset, search, sort: validSort, order };
}

// GET /api/warehouses
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const { limit, offset, search, sort, order } = parseQuery(req);
    let sql = 'SELECT * FROM warehouses WHERE user_id = ?';
    const params = [userId];
    if (search) {
      sql += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const items = queryAll(db, sql, params);
    let countSql = 'SELECT COUNT(*) as total FROM warehouses WHERE user_id = ?';
    const countParams = [userId];
    if (search) {
      countSql += ' AND (name LIKE ? OR code LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const countRow = queryOne(db, countSql, countParams);
    const total = countRow?.total ?? 0;
    return success(res, { items, total, limit, offset });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/warehouses/:id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid warehouse id');
    const row = queryOne(db, 'SELECT * FROM warehouses WHERE id = ? AND user_id = ?', [id, userId]);
    if (!row) return notFound(res, 'Warehouse');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/warehouses
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const { name, code, address } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) return validationError(res, 'name is required');
    if (!code || typeof code !== 'string' || !code.trim()) return validationError(res, 'code is required');
    const db = await getDbAsync();
    db.run(
      'INSERT INTO warehouses (name, code, address, user_id, updated_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [name.trim(), code.trim(), address?.trim() ?? null, userId]
    );
    const id = getLastId(db);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM warehouses WHERE id = ?', [id]);
    return success(res, row, 201);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return validationError(res, 'Warehouse code already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/warehouses/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid warehouse id');
    const { name, code, address } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM warehouses WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Warehouse');
    const n = (name != null && String(name).trim()) ? String(name).trim() : existing.name;
    const c = (code != null && String(code).trim()) ? String(code).trim() : existing.code;
    const a = address !== undefined ? (address && String(address).trim()) || null : existing.address;
    db.run('UPDATE warehouses SET name=?, code=?, address=?, updated_at=datetime("now") WHERE id=? AND user_id=?', [n, c, a, id, userId]);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM warehouses WHERE id = ?', [id]);
    return success(res, row);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return validationError(res, 'Warehouse code already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/warehouses/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid warehouse id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM warehouses WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Warehouse');
    db.run('DELETE FROM locations WHERE warehouse_id = ? AND user_id = ?', [id, userId]);
    db.run('DELETE FROM warehouses WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
