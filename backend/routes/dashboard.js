import { Router } from 'express';
import { getDbAsync } from '../db/connection.js';
import { queryOne, queryAll } from '../lib/db.js';
import { success } from '../lib/response.js';

const router = Router();
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

// GET /api/dashboard/summary — key metrics and low-stock list
router.get('/summary', async (req, res) => {
  try {
    const db = await getDbAsync();
    const threshold = Math.max(0, parseInt(req.query.low_stock_threshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD);

    const productsCount = queryOne(db, 'SELECT COUNT(*) as c FROM products');
    const totalQty = queryOne(db, 'SELECT COALESCE(SUM(quantity), 0) as total FROM products');
    const warehousesCount = queryOne(db, 'SELECT COUNT(*) as c FROM warehouses');
    const movementsCount = queryOne(db, 'SELECT COUNT(*) as c FROM stock_movements');
    let pendingReceiptsCount = 0;
    let pendingDeliveriesCount = 0;
    let scheduledTransfersCount = 0;
    try {
      pendingReceiptsCount = queryOne(db, "SELECT COUNT(*) as c FROM receipt_documents WHERE status NOT IN ('done','canceled')")?.c ?? 0;
      pendingDeliveriesCount = queryOne(db, "SELECT COUNT(*) as c FROM delivery_documents WHERE status NOT IN ('done','canceled')")?.c ?? 0;
      scheduledTransfersCount = queryOne(db, "SELECT COUNT(*) as c FROM scheduled_operations WHERE type = 'Transfer' AND status = 'pending'")?.c ?? 0;
    } catch (_) { /* tables may not exist before migration 4 */ }

    const lowStockItems = queryAll(
      db,
      'SELECT id, name, sku, quantity, unit FROM products WHERE quantity <= ? ORDER BY quantity ASC',
      [threshold]
    );

    return success(res, {
      productsCount: productsCount?.c ?? 0,
      totalQuantity: totalQty?.total ?? 0,
      warehousesCount: warehousesCount?.c ?? 0,
      movementsCount: movementsCount?.c ?? 0,
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
