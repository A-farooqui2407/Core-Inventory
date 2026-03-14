import { Router } from 'express';
import { getDbAsync } from '../db/connection.js';
import { queryOne, queryAll } from '../lib/db.js';
import { success } from '../lib/response.js';

const router = Router();
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];

// GET /api/dashboard/summary — key metrics and low-stock list (optional filters: status, category_id)
router.get('/summary', async (req, res) => {
  try {
    const db = await getDbAsync();
    const threshold = Math.max(0, parseInt(req.query.low_stock_threshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD);
    const status = (req.query.status || '').trim();
    const statusFilter = status && STATUSES.includes(status) ? status : null;
    const category_id = req.query.category_id ? parseInt(req.query.category_id, 10) : null;

    let productsCountSql = 'SELECT COUNT(*) as c FROM products';
    let totalQtySql = 'SELECT COALESCE(SUM(quantity), 0) as total FROM products';
    const productParams = [];
    const productConditions = [];
    if (Number.isInteger(category_id)) {
      productConditions.push('category_id = ?');
      productParams.push(category_id);
    }
    if (productConditions.length) {
      productsCountSql += ' WHERE ' + productConditions.join(' AND ');
      totalQtySql += ' WHERE ' + productConditions.join(' AND ');
    }
    const productsCount = queryOne(db, productsCountSql, productParams)?.c ?? 0;
    const totalQty = queryOne(db, totalQtySql, productParams)?.total ?? 0;

    const warehousesCount = queryOne(db, 'SELECT COUNT(*) as c FROM warehouses')?.c ?? 0;
    const movementsCount = queryOne(db, 'SELECT COUNT(*) as c FROM stock_movements')?.c ?? 0;

    let pendingReceiptsCount = 0;
    let pendingDeliveriesCount = 0;
    let scheduledTransfersCount = 0;
    try {
      if (statusFilter) {
        pendingReceiptsCount = queryOne(db, 'SELECT COUNT(*) as c FROM receipt_documents WHERE status = ?', [statusFilter])?.c ?? 0;
        pendingDeliveriesCount = queryOne(db, 'SELECT COUNT(*) as c FROM delivery_documents WHERE status = ?', [statusFilter])?.c ?? 0;
      } else {
        pendingReceiptsCount = queryOne(db, "SELECT COUNT(*) as c FROM receipt_documents WHERE status NOT IN ('done','canceled')")?.c ?? 0;
        pendingDeliveriesCount = queryOne(db, "SELECT COUNT(*) as c FROM delivery_documents WHERE status NOT IN ('done','canceled')")?.c ?? 0;
      }
      scheduledTransfersCount = queryOne(db, "SELECT COUNT(*) as c FROM scheduled_operations WHERE type = 'Transfer' AND status = 'pending'")?.c ?? 0;
    } catch (_) { /* tables may not exist before migration 4 */ }

    let lowStockSql = 'SELECT id, name, sku, quantity, unit FROM products WHERE quantity <= ?';
    const lowStockParams = [threshold];
    if (Number.isInteger(category_id)) {
      lowStockSql += ' AND category_id = ?';
      lowStockParams.push(category_id);
    }
    lowStockSql += ' ORDER BY quantity ASC';
    const lowStockItems = queryAll(db, lowStockSql, lowStockParams);

    return success(res, {
      productsCount,
      totalQuantity: totalQty,
      warehousesCount,
      movementsCount,
      pendingReceiptsCount,
      pendingDeliveriesCount,
      scheduledTransfersCount,
      lowStockThreshold: threshold,
      lowStockCount: lowStockItems.length,
      lowStockItems,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
