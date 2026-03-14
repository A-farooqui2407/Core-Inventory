import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryAll, queryOne, getLastId } from '../lib/db.js';
import { success, notFound, validationError } from '../lib/response.js';
import { applyLocationBalance } from '../lib/stockBalances.js';

const TYPES = ['Receipt', 'Delivery', 'Transfer', 'Adjustment'];

const router = Router();

function parseQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const type = (req.query.type || '').trim();
  const product_id = req.query.product_id ? parseInt(req.query.product_id, 10) : null;
  const location_id = req.query.location_id ? parseInt(req.query.location_id, 10) : null;
  const warehouse_id = req.query.warehouse_id ? parseInt(req.query.warehouse_id, 10) : null;
  const category_id = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
  const sort = (req.query.sort || 'id').trim();
  const order = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const validSort = ['id', 'created_at', 'type', 'quantity'].includes(sort) ? sort : 'id';
  return { page, limit, offset, type, product_id, location_id, warehouse_id, category_id, sort: validSort, order };
}

// GET /api/movements
router.get('/', async (req, res) => {
  try {
    const db = await getDbAsync();
    const { limit, offset, type, product_id, location_id, warehouse_id, category_id, sort, order } = parseQuery(req);
    let sql = `
      SELECT m.*, p.name as product_name, p.sku as product_sku,
        fl.name as from_location_name, tl.name as to_location_name
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN locations fl ON m.from_location_id = fl.id
      LEFT JOIN locations tl ON m.to_location_id = tl.id
    `;
    const params = [];
    const conditions = [];
    if (type && TYPES.includes(type)) {
      conditions.push('m.type = ?');
      params.push(type);
    }
    if (Number.isInteger(product_id)) {
      conditions.push('m.product_id = ?');
      params.push(product_id);
    }
    if (Number.isInteger(location_id)) {
      conditions.push('(m.from_location_id = ? OR m.to_location_id = ?)');
      params.push(location_id, location_id);
    }
    if (Number.isInteger(warehouse_id)) {
      conditions.push('(fl.warehouse_id = ? OR tl.warehouse_id = ?)');
      params.push(warehouse_id, warehouse_id);
    }
    if (Number.isInteger(category_id)) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ` ORDER BY m.${sort} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const items = queryAll(db, sql, params);
    let countSql = `
      SELECT COUNT(*) as total FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN locations fl ON m.from_location_id = fl.id
      LEFT JOIN locations tl ON m.to_location_id = tl.id
    `;
    if (conditions.length) countSql += ' WHERE ' + conditions.join(' AND ');
    const countParams = conditions.length ? params.slice(0, -2) : [];
    const countRow = queryOne(db, countSql, countParams);
    const total = countRow?.total ?? 0;
    return success(res, { items, total, limit, offset });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/movements/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid movement id');
    const row = queryOne(db, `
      SELECT m.*, p.name as product_name, p.sku as product_sku,
        fl.name as from_location_name, tl.name as to_location_name
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN locations fl ON m.from_location_id = fl.id
      LEFT JOIN locations tl ON m.to_location_id = tl.id
      WHERE m.id = ?
    `, [id]);
    if (!row) return notFound(res, 'Stock movement');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/movements
router.post('/', async (req, res) => {
  try {
    const { type, product_id, quantity, from_location_id, to_location_id, reference, notes } = req.body || {};
    if (!TYPES.includes(type)) return validationError(res, `type must be one of: ${TYPES.join(', ')}`);
    const pid = parseInt(product_id, 10);
    if (!Number.isInteger(pid)) return validationError(res, 'product_id is required');
    const qty = parseFloat(quantity);
    if (Number.isNaN(qty) || qty === 0) return validationError(res, 'quantity is required and non-zero');
    const db = await getDbAsync();
    const product = queryOne(db, 'SELECT id, quantity FROM products WHERE id = ?', [pid]);
    if (!product) return notFound(res, 'Product');
    const fromId = from_location_id != null ? parseInt(from_location_id, 10) : null;
    const toId = to_location_id != null ? parseInt(to_location_id, 10) : null;
    if (type === 'Transfer') {
      if (!Number.isInteger(fromId) || !Number.isInteger(toId)) return validationError(res, 'Transfer requires from_location_id and to_location_id');
    }
    // Apply quantity delta to product
    let delta = 0;
    if (type === 'Receipt') delta = qty;
    else if (type === 'Delivery') delta = -Math.abs(qty);
    else if (type === 'Adjustment') delta = qty;
    // Transfer doesn't change total product quantity
    const newQty = product.quantity + delta;
    if (newQty < 0) return validationError(res, 'Insufficient product quantity');
    db.run(
      `INSERT INTO stock_movements (type, product_id, quantity, from_location_id, to_location_id, reference, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [type, pid, qty, Number.isInteger(fromId) ? fromId : null, Number.isInteger(toId) ? toId : null, reference?.trim() ?? null, notes?.trim() ?? null]
    );
    const id = getLastId(db);
    db.run('UPDATE products SET quantity = ?, updated_at = datetime("now") WHERE id = ?', [newQty, pid]);
    if (type === 'Receipt' && Number.isInteger(toId)) applyLocationBalance(db, pid, toId, qty);
    if (type === 'Delivery' && Number.isInteger(fromId)) applyLocationBalance(db, pid, fromId, -Math.abs(qty));
    if (type === 'Transfer' && Number.isInteger(fromId) && Number.isInteger(toId)) {
      applyLocationBalance(db, pid, fromId, -Math.abs(qty));
      applyLocationBalance(db, pid, toId, qty);
    }
    saveDb();
    const row = queryOne(db, `
      SELECT m.*, p.name as product_name, p.sku as product_sku,
        fl.name as from_location_name, tl.name as to_location_name
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN locations fl ON m.from_location_id = fl.id
      LEFT JOIN locations tl ON m.to_location_id = tl.id
      WHERE m.id = ?
    `, [id]);
    return success(res, row, 201);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/movements/:id — optional: allow delete and reverse product quantity for audit integrity you might disallow
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid movement id');
    const db = await getDbAsync();
    const row = queryOne(db, 'SELECT * FROM stock_movements WHERE id = ?', [id]);
    if (!row) return notFound(res, 'Stock movement');
    db.run('DELETE FROM stock_movements WHERE id = ?', [id]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
