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
  const validSort = ['id', 'name', 'sku', 'quantity', 'created_at'].includes(sort) ? sort : 'id';
  return { page, limit, offset, search, sort: validSort, order };
}

// GET /api/products — list with pagination, search, sort
router.get('/', async (req, res) => {
  try {
    const db = await getDbAsync();
    const { limit, offset, search, sort, order } = parseQuery(req);
    let sql = 'SELECT * FROM products';
    const params = [];
    if (search) {
      sql += ' WHERE name LIKE ? OR sku LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const items = queryAll(db, sql, params);
    const countRow = queryOne(
      db,
      search
        ? 'SELECT COUNT(*) as total FROM products WHERE name LIKE ? OR sku LIKE ?'
        : 'SELECT COUNT(*) as total FROM products',
      search ? [`%${search}%`, `%${search}%`] : []
    );
    const total = countRow?.total ?? 0;
    return success(res, { items, total, limit, offset });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid product id');
    const row = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    if (!row) return notFound(res, 'Product');
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { name, sku, description, quantity, unit } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim())
      return validationError(res, 'name is required');
    if (!sku || typeof sku !== 'string' || !sku.trim())
      return validationError(res, 'sku is required');
    const db = await getDbAsync();
    const qty = Number(quantity);
    const u = (unit && String(unit).trim()) || 'pcs';
    db.run(
      'INSERT INTO products (name, sku, description, quantity, unit, updated_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [name.trim(), sku.trim(), description?.trim() ?? null, Number.isNaN(qty) ? 0 : qty, u]
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
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid product id');
    const { name, sku, description, quantity, unit } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Product');
    const n = (name != null && String(name).trim()) ? String(name).trim() : existing.name;
    const s = (sku != null && String(sku).trim()) ? String(sku).trim() : existing.sku;
    const d = description !== undefined ? (description && String(description).trim()) || null : existing.description;
    const qty = quantity !== undefined ? (Number(quantity) || 0) : existing.quantity;
    const u = (unit != null && String(unit).trim()) ? String(unit).trim() : (existing.unit || 'pcs');
    db.run(
      'UPDATE products SET name=?, sku=?, description=?, quantity=?, unit=?, updated_at=datetime("now") WHERE id=?',
      [n, s, d, qty, u, id]
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
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid product id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT id FROM products WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Product');
    db.run('DELETE FROM products WHERE id = ?', [id]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
