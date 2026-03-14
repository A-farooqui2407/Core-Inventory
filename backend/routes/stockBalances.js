import { Router } from 'express';
import { getDbAsync } from '../db/connection.js';
import { queryAll, queryOne } from '../lib/db.js';
import { success, validationError } from '../lib/response.js';

const router = Router();

// GET /api/stock-balances — list with optional product_id, location_id, warehouse_id
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const product_id = req.query.product_id ? parseInt(req.query.product_id, 10) : null;
    const location_id = req.query.location_id ? parseInt(req.query.location_id, 10) : null;
    const warehouse_id = req.query.warehouse_id ? parseInt(req.query.warehouse_id, 10) : null;
    let sql = `
      SELECT sb.*, p.name as product_name, p.sku as product_sku, p.unit,
        l.name as location_name, l.code as location_code, l.warehouse_id,
        w.name as warehouse_name
      FROM stock_balances sb
      JOIN products p ON sb.product_id = p.id AND p.user_id = ?
      JOIN locations l ON sb.location_id = l.id
      JOIN warehouses w ON l.warehouse_id = w.id
      WHERE sb.quantity > 0 AND (sb.user_id = ? OR sb.user_id IS NULL)
    `;
    const params = [userId, userId];
    if (Number.isInteger(product_id)) {
      sql += ' AND sb.product_id = ?';
      params.push(product_id);
    }
    if (Number.isInteger(location_id)) {
      sql += ' AND sb.location_id = ?';
      params.push(location_id);
    }
    if (Number.isInteger(warehouse_id)) {
      sql += ' AND l.warehouse_id = ?';
      params.push(warehouse_id);
    }
    sql += ' ORDER BY p.name, w.name, l.code';
    const items = queryAll(db, sql, params);
    return success(res, { items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/stock-balances/product/:id — stock per location for one product
router.get('/product/:id', async (req, res) => {
  try {
    const userId = req.user?.userId ?? 1;
    const db = await getDbAsync();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return validationError(res, 'Invalid product id');
    const product = queryOne(db, 'SELECT * FROM products WHERE id = ? AND user_id = ?', [id, userId]);
    if (!product) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    const items = queryAll(db, `
      SELECT sb.*, l.name as location_name, l.code as location_code, w.name as warehouse_name
      FROM stock_balances sb
      JOIN locations l ON sb.location_id = l.id
      JOIN warehouses w ON l.warehouse_id = w.id
      WHERE sb.product_id = ? AND sb.quantity > 0 AND (sb.user_id = ? OR sb.user_id IS NULL)
      ORDER BY w.name, l.code
    `, [id, userId]);
    return success(res, { product, items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
