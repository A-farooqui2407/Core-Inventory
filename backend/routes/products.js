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
  const validSort = ['id', 'name', 'sku', 'quantity', 'created_at', 'category_name'].includes(sort) ? sort : 'id';
  return { page, limit, offset, search, sort: validSort, order };
}

// GET /api/products — list with pagination, search, sort, category filter
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const { limit, offset, search, sort, order } = parseQuery(req);
    const category_id = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    let sql = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
    const params = [];
    const conditions = ['p.user_id = ?'];
    params.push(userId);
    if (search) {
      conditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (Number.isInteger(category_id)) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }
    sql += ' WHERE ' + conditions.join(' AND ');
    const sortCol = sort === 'category_name' ? 'c.name' : `p.${sort}`;
    sql += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const items = queryAll(db, sql, params);
    let countSql = 'SELECT COUNT(*) as total FROM products p';
    countSql += ' WHERE ' + conditions.join(' AND ');
    const countRow = queryOne(db, countSql, params.slice(0, -2));
    const total = countRow?.total ?? 0;
    return success(res, { items, total, limit, offset });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid product id');
    const row = queryOne(db, 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? AND p.user_id = ?', [id, userId]);
    if (!row) return notFound(res, 'Product');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const { name, sku, description, quantity, unit, category_id, reorder_min_quantity, reorder_quantity } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim())
      return validationError(res, 'name is required');
    if (!sku || typeof sku !== 'string' || !sku.trim())
      return validationError(res, 'sku is required');
    const db = await getDbAsync();
    const qty = Number(quantity);
    const u = (unit && String(unit).trim()) || 'pcs';
    const catId = category_id != null ? parseInt(category_id, 10) : null;
    const reorderMin = reorder_min_quantity != null ? parseFloat(reorder_min_quantity) : null;
    const reorderQty = reorder_quantity != null ? parseFloat(reorder_quantity) : null;
    db.run(
      'INSERT INTO products (name, sku, description, quantity, unit, category_id, reorder_min_quantity, reorder_quantity, user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))',
      [name.trim(), sku.trim(), description?.trim() ?? null, Number.isNaN(qty) ? 0 : qty, u, Number.isInteger(catId) ? catId : null, Number.isFinite(reorderMin) ? reorderMin : null, Number.isFinite(reorderQty) ? reorderQty : null, userId]
    );
    const id = getLastId(db);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    return success(res, row, 201);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return validationError(res, 'SKU already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid product id');
    const { name, sku, description, quantity, unit, category_id, reorder_min_quantity, reorder_quantity } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM products WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Product');
    const n = (name != null && String(name).trim()) ? String(name).trim() : existing.name;
    const s = (sku != null && String(sku).trim()) ? String(sku).trim() : existing.sku;
    const d = description !== undefined ? (description && String(description).trim()) || null : existing.description;
    const qty = quantity !== undefined ? (Number(quantity) || 0) : existing.quantity;
    const u = (unit != null && String(unit).trim()) ? String(unit).trim() : (existing.unit || 'pcs');
    const catId = category_id !== undefined ? (parseInt(category_id, 10) || null) : (existing.category_id ?? null);
    const reorderMin = reorder_min_quantity !== undefined ? (parseFloat(reorder_min_quantity) || null) : (existing.reorder_min_quantity ?? null);
    const reorderQty = reorder_quantity !== undefined ? (parseFloat(reorder_quantity) || null) : (existing.reorder_quantity ?? null);
    db.run(
      'UPDATE products SET name=?, sku=?, description=?, quantity=?, unit=?, category_id=?, reorder_min_quantity=?, reorder_quantity=?, updated_at=datetime("now") WHERE id=? AND user_id=?',
      [n, s, d, qty, u, Number.isInteger(catId) ? catId : null, Number.isFinite(reorderMin) ? reorderMin : null, Number.isFinite(reorderQty) ? reorderQty : null, id, userId]
    );
    saveDb();
    const row = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    return success(res, row);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return validationError(res, 'SKU already exists');
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid product id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM products WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Product');
    db.run('DELETE FROM products WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
