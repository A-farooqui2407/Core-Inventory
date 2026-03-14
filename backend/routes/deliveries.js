import { Router } from 'express';
import { getDbAsync, saveDb } from '../db/connection.js';
import { queryAll, queryOne, getLastId } from '../lib/db.js';
import { success, notFound, validationError } from '../lib/response.js';
import { applyLocationBalance } from '../lib/stockBalances.js';

const router = Router();
const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];

function parseQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const status = (req.query.status || '').trim();
  return { page, limit, offset, status };
}

// GET /api/deliveries
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const { limit, offset, status } = parseQuery(req);
    let sql = 'SELECT * FROM delivery_documents WHERE user_id = ?';
    const params = [userId];
    if (status && STATUSES.includes(status)) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const items = queryAll(db, sql, params);
    let countSql = 'SELECT COUNT(*) as total FROM delivery_documents WHERE user_id = ?';
    const countParams = [userId];
    if (status && STATUSES.includes(status)) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const countRow = queryOne(db, countSql, countParams);
    const total = countRow?.total ?? 0;
    return success(res, { items, total, limit, offset });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/deliveries/:id (with lines)
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid delivery id');
    const doc = queryOne(db, 'SELECT * FROM delivery_documents WHERE id = ? AND user_id = ?', [id, userId]);
    if (!doc) return notFound(res, 'Delivery order');
    const lines = queryAll(db, `
      SELECT dl.*, p.name as product_name, p.sku as product_sku, p.unit, p.quantity as product_total_qty,
        l.name as from_location_name, l.code as from_location_code
      FROM delivery_lines dl
      JOIN products p ON dl.product_id = p.id
      LEFT JOIN locations l ON dl.from_location_id = l.id
      WHERE dl.delivery_id = ?
    `, [id]);
    return success(res, { ...doc, lines });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/deliveries
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const { reference, notes, lines } = req.body || {};
    const db = await getDbAsync();
    db.run(
      'INSERT INTO delivery_documents (status, reference, notes, user_id, updated_at) VALUES (?, ?, ?, ?, datetime("now"))',
      ['draft', reference?.trim() ?? null, notes?.trim() ?? null, userId]
    );
    const deliveryId = getLastId(db);
    if (Array.isArray(lines) && lines.length > 0) {
      for (const line of lines) {
        const pid = parseInt(line.product_id, 10);
        const qty = parseFloat(line.quantity);
        const fromLocId = line.from_location_id != null ? parseInt(line.from_location_id, 10) : null;
        if (!Number.isInteger(pid) || !Number.isFinite(qty) || qty <= 0) continue;
        db.run(
          'INSERT INTO delivery_lines (delivery_id, product_id, quantity, from_location_id) VALUES (?, ?, ?, ?)',
          [deliveryId, pid, qty, Number.isInteger(fromLocId) ? fromLocId : null]
        );
      }
    }
    saveDb();
    const row = queryOne(db, 'SELECT * FROM delivery_documents WHERE id = ?', [deliveryId]);
    return success(res, row, 201);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/deliveries/:id
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid delivery id');
    const { reference, notes, status, lines } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM delivery_documents WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Delivery order');
    if (existing.status === 'done') return validationError(res, 'Cannot edit a validated delivery');
    const ref = reference !== undefined ? (reference?.trim() || null) : existing.reference;
    const n = notes !== undefined ? (notes?.trim() || null) : existing.notes;
    const newStatus = status && STATUSES.includes(status) ? status : existing.status;
    db.run('UPDATE delivery_documents SET reference=?, notes=?, status=?, updated_at=datetime("now") WHERE id=? AND user_id=?', [ref, n, newStatus, id, userId]);
    if (Array.isArray(lines)) {
      db.run('DELETE FROM delivery_lines WHERE delivery_id = ?', [id]);
      for (const line of lines) {
        const pid = parseInt(line.product_id, 10);
        const qty = parseFloat(line.quantity);
        const fromLocId = line.from_location_id != null ? parseInt(line.from_location_id, 10) : null;
        if (!Number.isInteger(pid) || !Number.isFinite(qty) || qty <= 0) continue;
        db.run('INSERT INTO delivery_lines (delivery_id, product_id, quantity, from_location_id) VALUES (?, ?, ?, ?)', [id, pid, qty, Number.isInteger(fromLocId) ? fromLocId : null]);
      }
    }
    saveDb();
    const row = queryOne(db, 'SELECT * FROM delivery_documents WHERE id = ?', [id]);
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/deliveries/:id/validate — set status=done, create movements, decrease stock
router.post('/:id/validate', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid delivery id');
    const db = await getDbAsync();
    const doc = queryOne(db, 'SELECT * FROM delivery_documents WHERE id = ? AND user_id = ?', [id, userId]);
    if (!doc) return notFound(res, 'Delivery order');
    if (doc.status === 'done') return validationError(res, 'Delivery already validated');
    const lines = queryAll(db, 'SELECT * FROM delivery_lines WHERE delivery_id = ?', [id]);
    if (lines.length === 0) return validationError(res, 'Delivery has no lines');
    for (const line of lines) {
      const product = queryOne(db, 'SELECT id, quantity FROM products WHERE id = ? AND user_id = ?', [line.product_id, userId]);
      if (!product) return validationError(res, `Product id ${line.product_id} not found`);
      const qty = Math.abs(line.quantity);
      if (product.quantity < qty) return validationError(res, `Insufficient stock for product id ${line.product_id} (has ${product.quantity}, need ${qty})`);
      db.run(
        'INSERT INTO stock_movements (type, product_id, quantity, from_location_id, to_location_id, reference, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['Delivery', line.product_id, qty, line.from_location_id, null, doc.reference, `Delivery #${id}`, userId]
      );
      const newQty = product.quantity - qty;
      db.run('UPDATE products SET quantity = ?, updated_at = datetime("now") WHERE id = ?', [newQty, line.product_id]);
      if (line.from_location_id) applyLocationBalance(db, line.product_id, line.from_location_id, -qty, userId);
    }
    db.run("UPDATE delivery_documents SET status = 'done', updated_at = datetime('now') WHERE id = ? AND user_id = ?", [id, userId]);
    saveDb();
    const row = queryOne(db, 'SELECT * FROM delivery_documents WHERE id = ?', [id]);
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/deliveries/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid delivery id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM delivery_documents WHERE id = ? AND user_id = ?', [id, userId]);
    if (!existing) return notFound(res, 'Delivery order');
    if (existing.status === 'done') return validationError(res, 'Cannot delete a validated delivery');
    db.run('DELETE FROM delivery_lines WHERE delivery_id = ?', [id]);
    db.run('DELETE FROM delivery_documents WHERE id = ? AND user_id = ?', [id, userId]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
