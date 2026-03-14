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
  const warehouse_id = req.query.warehouse_id ? parseInt(req.query.warehouse_id, 10) : null;
  return { page, limit, offset, status, warehouse_id };
}

// GET /api/receipts
router.get('/', async (req, res) => {
  try {
    const db = await getDbAsync();
    const { limit, offset, status, warehouse_id } = parseQuery(req);
    let sql = `
      SELECT r.*, s.name as supplier_name, s.code as supplier_code
      FROM receipt_documents r
      LEFT JOIN suppliers s ON r.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (status && STATUSES.includes(status)) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY r.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const items = queryAll(db, sql, params);
    let countSql = 'SELECT COUNT(*) as total FROM receipt_documents r WHERE 1=1';
    const countParams = [];
    if (status && STATUSES.includes(status)) {
      countSql += ' AND r.status = ?';
      countParams.push(status);
    }
    const countRow = queryOne(db, countSql, countParams);
    const total = countRow?.total ?? 0;
    return success(res, { items, total, limit, offset });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/receipts/:id (with lines)
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid receipt id');
    const doc = queryOne(db, `
      SELECT r.*, s.name as supplier_name, s.code as supplier_code
      FROM receipt_documents r LEFT JOIN suppliers s ON r.supplier_id = s.id WHERE r.id = ?
    `, [id]);
    if (!doc) return notFound(res, 'Receipt');
    const lines = queryAll(db, `
      SELECT rl.*, p.name as product_name, p.sku as product_sku, p.unit,
        l.name as to_location_name, l.code as to_location_code
      FROM receipt_lines rl
      JOIN products p ON rl.product_id = p.id
      LEFT JOIN locations l ON rl.to_location_id = l.id
      WHERE rl.receipt_id = ?
    `, [id]);
    return success(res, { ...doc, lines });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/receipts
router.post('/', async (req, res) => {
  try {
    const { supplier_id, reference, notes, lines } = req.body || {};
    const db = await getDbAsync();
    const supId = supplier_id != null ? parseInt(supplier_id, 10) : null;
    db.run(
      'INSERT INTO receipt_documents (supplier_id, status, reference, notes, updated_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [Number.isInteger(supId) ? supId : null, 'draft', reference?.trim() ?? null, notes?.trim() ?? null]
    );
    const receiptId = getLastId(db);
    if (Array.isArray(lines) && lines.length > 0) {
      for (const line of lines) {
        const pid = parseInt(line.product_id, 10);
        const qty = parseFloat(line.quantity);
        const toLocId = line.to_location_id != null ? parseInt(line.to_location_id, 10) : null;
        if (!Number.isInteger(pid) || !Number.isFinite(qty) || qty <= 0) continue;
        db.run(
          'INSERT INTO receipt_lines (receipt_id, product_id, quantity, to_location_id) VALUES (?, ?, ?, ?)',
          [receiptId, pid, qty, Number.isInteger(toLocId) ? toLocId : null]
        );
      }
    }
    saveDb();
    const row = queryOne(db, 'SELECT r.*, s.name as supplier_name FROM receipt_documents r LEFT JOIN suppliers s ON r.supplier_id = s.id WHERE r.id = ?', [receiptId]);
    return success(res, row, 201);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/receipts/:id — only when status is draft
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid receipt id');
    const { supplier_id, reference, notes, status, lines } = req.body || {};
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM receipt_documents WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Receipt');
    if (existing.status === 'done') return validationError(res, 'Cannot edit a validated receipt');
    const supId = supplier_id !== undefined ? (parseInt(supplier_id, 10) || null) : existing.supplier_id;
    const ref = reference !== undefined ? (reference?.trim() || null) : existing.reference;
    const n = notes !== undefined ? (notes?.trim() || null) : existing.notes;
    const newStatus = status && STATUSES.includes(status) ? status : existing.status;
    db.run('UPDATE receipt_documents SET supplier_id=?, reference=?, notes=?, status=?, updated_at=datetime("now") WHERE id=?', [Number.isInteger(supId) ? supId : null, ref, n, newStatus, id]);
    if (Array.isArray(lines)) {
      db.run('DELETE FROM receipt_lines WHERE receipt_id = ?', [id]);
      for (const line of lines) {
        const pid = parseInt(line.product_id, 10);
        const qty = parseFloat(line.quantity);
        const toLocId = line.to_location_id != null ? parseInt(line.to_location_id, 10) : null;
        if (!Number.isInteger(pid) || !Number.isFinite(qty) || qty <= 0) continue;
        db.run('INSERT INTO receipt_lines (receipt_id, product_id, quantity, to_location_id) VALUES (?, ?, ?, ?)', [id, pid, qty, Number.isInteger(toLocId) ? toLocId : null]);
      }
    }
    saveDb();
    const row = queryOne(db, 'SELECT r.*, s.name as supplier_name FROM receipt_documents r LEFT JOIN suppliers s ON r.supplier_id = s.id WHERE r.id = ?', [id]);
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/receipts/:id/validate — set status=done, create movements, update stock
router.post('/:id/validate', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid receipt id');
    const db = await getDbAsync();
    const doc = queryOne(db, 'SELECT * FROM receipt_documents WHERE id = ?', [id]);
    if (!doc) return notFound(res, 'Receipt');
    if (doc.status === 'done') return validationError(res, 'Receipt already validated');
    const lines = queryAll(db, 'SELECT * FROM receipt_lines WHERE receipt_id = ?', [id]);
    if (lines.length === 0) return validationError(res, 'Receipt has no lines');
    for (const line of lines) {
      const product = queryOne(db, 'SELECT id, quantity FROM products WHERE id = ?', [line.product_id]);
      if (!product) return validationError(res, `Product id ${line.product_id} not found`);
      const qty = line.quantity;
      const toLocId = line.to_location_id;
      db.run(
        'INSERT INTO stock_movements (type, product_id, quantity, from_location_id, to_location_id, reference, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['Receipt', line.product_id, qty, null, toLocId, doc.reference, `Receipt #${id}`]
      );
      const newQty = product.quantity + qty;
      db.run('UPDATE products SET quantity = ?, updated_at = datetime("now") WHERE id = ?', [newQty, line.product_id]);
      if (toLocId) applyLocationBalance(db, line.product_id, toLocId, qty);
    }
    db.run("UPDATE receipt_documents SET status = 'done', updated_at = datetime('now') WHERE id = ?", [id]);
    saveDb();
    const row = queryOne(db, 'SELECT r.*, s.name as supplier_name FROM receipt_documents r LEFT JOIN suppliers s ON r.supplier_id = s.id WHERE r.id = ?', [id]);
    return success(res, row);
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/receipts/:id — only draft
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid receipt id');
    const db = await getDbAsync();
    const existing = queryOne(db, 'SELECT * FROM receipt_documents WHERE id = ?', [id]);
    if (!existing) return notFound(res, 'Receipt');
    if (existing.status === 'done') return validationError(res, 'Cannot delete a validated receipt');
    db.run('DELETE FROM receipt_lines WHERE receipt_id = ?', [id]);
    db.run('DELETE FROM receipt_documents WHERE id = ?', [id]);
    saveDb();
    return success(res, { deleted: id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
