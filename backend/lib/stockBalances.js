/**
 * Update stock_balances when movements have from_location_id or to_location_id.
 * product.quantity remains the global total; stock_balances tracks per-location.
 */
export function applyLocationBalance(db, productId, locationId, delta) {
  if (!locationId || !productId) return;
  const existing = db.prepare('SELECT quantity FROM stock_balances WHERE product_id = ? AND location_id = ?').get(productId, locationId);
  const newQty = (existing?.quantity ?? 0) + delta;
  if (newQty <= 0) {
    db.run('DELETE FROM stock_balances WHERE product_id = ? AND location_id = ?', [productId, locationId]);
  } else if (existing) {
    db.run('UPDATE stock_balances SET quantity = ?, updated_at = datetime("now") WHERE product_id = ? AND location_id = ?', [newQty, productId, locationId]);
  } else {
    db.run('INSERT INTO stock_balances (product_id, location_id, quantity, updated_at) VALUES (?, ?, ?, datetime("now"))', [productId, locationId, newQty]);
  }
}
