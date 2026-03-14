import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryAll, queryOne, getLastId } from '../lib/db.js';
import { success, notFound, validationError } from '../lib/response.js';

const router = Router();
const TYPES = ['Receipt', 'Delivery', 'Transfer', 'Pick', 'Stocktake'];
const STATUSES = ['pending', 'done', 'cancelled'];

function parseQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const status = (req.query.status || '').trim();
  const sort = (req.query.sort || 'due_date').trim();
  const order = (req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const validSort = ['due_date', 'created_at', 'type', 'status'].includes(sort) ? sort : 'due_date';
  return { page, limit, offset, status, sort: validSort, order };
}

// GET /api/scheduled
router.get('/', async (req, res) => {
  try {
    const db = await getDbAsync();
    const { limit, offset, status, sort, order } = parseQuery(req);
    let sql = `
      SELECT s.*, p.name as product_name, p.sku as product_sku,
        fl.name as from_location_name, tl.name as to_location_name
      FROM scheduled_operations s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN locations fl ON s.from_location_id = fl.id
      LEFT JOIN locations tl ON s.to_location_id = tl.id
    `;
    const params = [];
    if (status && STATUSES.includes(status)) {
      sql += ' WHERE s.status = ?';
      params.push(status);
    }
    sql += ` ORDER BY s.${sort} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const items = queryAll(db, sql, params);
    let countSql = 'SELECT COUNT(*) as total FROM scheduled_operations s';
    if (status && STATUSES.includes(status)) countSql += ' WHERE s.status = ?';
    const countRow = queryOne(db, countSql, status && STATUSES.includes(status) ? [status] : []);
    const total = countRow?.total ?? 0;
    return success(res, { items, total, limit, offset });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/scheduled/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid id');
    const row = queryOne(db, `
      SELECT s.*, p.name as product_name, p.sku as product_sku,
        fl.name as from_location_name, tl.name as to_location_name
      FROM scheduled_operations s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN locations fl ON s.from_location_id = fl.id
      LEFT JOIN locations tl ON s.to_location_id = tl.id
      WHERE s.id = ?
    `, [id]);
    if (!row) return notFound(res, 'Scheduled operation');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/scheduled
router.post('/', async (req, res) => {
  try {
    const { type, product_id, quantity, from_location_id, to_location_id, due_date, reference, notes } = req.body || {};
    if (!TYPES.includes(type)) return validationError(res, `type must be one of: ${TYPES.join(', ')}`);
    if (!due_date || !String(due_date).trim()) return validationError(res, 'due_date is required');
    const db = await getDbAsync();
    const pid = product_id != null ? parseInt(product_id, 10) : null;
    const fromId = from_location_id != null ? parseInt(from_location_id, 10) : null;
    const toId = to_location_id != null ? parseInt(to_location_id, 10) : null;
    const qty = quantity != null ? parseFloat(quantity) : null;
    db.run(`
      INSERT INTO scheduled_operations (type, product_id, quantity, from_location_id, to_location_id, due_date, status, reference, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
    `, [type, Number.isInteger(pid) ? pid : null, qty, Number.isInteger(fromId) ? fromId : null, Number.isInteger(toId) ? toId : null, String(due_date).trim(), reference?.trim() ?? null, notes?.trim() ?? null]);
    const id = getLastId(db);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM scheduled_operations WHERE id = ?', [id]);
    return success(res, row, 201);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/scheduled/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid id');
    const { status, due_date, notes } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM scheduled_operations WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Scheduled operation');
    const newStatus = status && STATUSES.includes(status) ? status : existing.status;
    const newDue = (due_date != null && String(due_date).trim()) ? String(due_date).trim() : existing.due_date;
    const newNotes = notes !== undefined ? (notes && String(notes).trim()) || null : existing.notes;
    db.run('UPDATE scheduled_operations SET status = ?, due_date = ?, notes = ?, updated_at = datetime("now") WHERE id = ?', [newStatus, newDue, newNotes, id]);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM scheduled_operations WHERE id = ?', [id]);
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/scheduled/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM scheduled_operations WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Scheduled operation');
    db.run('DELETE FROM scheduled_operations WHERE id = ?', [id]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
