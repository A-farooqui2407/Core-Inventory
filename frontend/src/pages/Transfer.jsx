import { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { productsApi, locationsApi, movementsApi } from '@/services/api';

function DraggableProduct({ id, product }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `product-${id}`, data: { productId: id, product } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`transfer-product-card ${isDragging ? 'dragging' : ''}`}
    >
      <span className="transfer-product-name">{product.name}</span>
      <span className="transfer-product-sku">{product.sku}</span>
      <span className="transfer-product-qty">{product.quantity} {product.unit}</span>
    </div>
  );
}

function DropZone({ toLocation, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `to-${toLocation?.id ?? 'none'}`, data: { toLocationId: toLocation?.id } });
  return (
    <div ref={setNodeRef} className={`transfer-drop-zone ${isOver ? 'over' : ''}`}>
      {toLocation ? <span className="transfer-zone-label">{toLocation.warehouse_name} – {toLocation.code}</span> : <span className="transfer-zone-label">Drop here</span>}
      {children}
    </div>
  );
}

export default function Transfer() {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    let done = 0;
    const checkDone = () => {
      done += 1;
      if (done >= 2) setLoading(false);
    };
    productsApi.list({ limit: 500 }).then((data) => { setProducts((data.data?.items ?? []).filter((p) => p.quantity > 0)); checkDone(); }).catch(checkDone);
    locationsApi.list().then((data) => {
      const list = data.data?.items ?? [];
      setLocations(list);
      if (list.length) setToLocationId((id) => id || String(list[0].id));
      checkDone();
    }).catch(checkDone);
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over?.data?.current?.toLocationId) return;
    const productId = active?.data?.current?.productId;
    const product = active?.data?.current?.product;
    if (!productId || !product) return;
    setPendingTransfer({ productId, product, toLocationId: over.data.current.toLocationId });
    setQuantity('');
    setConfirmOpen(true);
  };

  const submitTransfer = () => {
    if (!pendingTransfer || !quantity || parseFloat(quantity) <= 0) return;
    const fromId = fromLocationId ? parseInt(fromLocationId, 10) : null;
    const toId = pendingTransfer.toLocationId;
    const qty = parseFloat(quantity);
    if (qty > pendingTransfer.product.quantity) {
      setError('Quantity exceeds available stock');
      return;
    }
    setError(null);
    movementsApi.create({
      type: 'Transfer',
      product_id: pendingTransfer.productId,
      quantity: qty,
      from_location_id: fromId,
      to_location_id: toId,
      notes: 'Quick transfer (drag-and-drop)',
    }).then(() => {
      setConfirmOpen(false);
      setPendingTransfer(null);
      productsApi.list({ limit: 500 }).then((data) => setProducts((data.data?.items ?? []).filter((p) => p.quantity > 0)));
    }).catch((err) => setError(err.message));
  };

  const toLocation = locations.find((l) => l.id === (toLocationId ? parseInt(toLocationId, 10) : null)) || locations[0];

  return (
    <div className="page">
      <h1>Quick transfer</h1>
      <p className="muted">Drag a product to a destination location to create a transfer. Optionally set &quot;From&quot; location.</p>

      <div className="transfer-toolbar">
        <label>
          From location (optional)
          <select className="input" value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} style={{ maxWidth: 280 }}>
            <option value="">—</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>)}
          </select>
        </label>
        <label>
          To location (drop target)
          <select className="input" value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} style={{ maxWidth: 280 }}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.warehouse_name} – {l.code}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="transfer-area">
            <div className="transfer-products">
              <h3>Products (drag to transfer)</h3>
              <div className="transfer-product-list">
                {products.map((p) => (
                  <DraggableProduct key={p.id} id={p.id} product={p} />
                ))}
              </div>
              {products.length === 0 && <p className="muted">No products with stock.</p>}
            </div>
            <div className="transfer-drop-area">
              <h3>Drop here to transfer</h3>
              <DropZone toLocation={toLocation}>
                {pendingTransfer && confirmOpen && <span className="transfer-pending-name">{pendingTransfer.product.name}</span>}
              </DropZone>
            </div>
          </div>
        </DndContext>
      )}

      {confirmOpen && pendingTransfer && (
        <div className="modal-overlay" onClick={() => { setConfirmOpen(false); setPendingTransfer(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Confirm transfer</h2>
            <p><strong>{pendingTransfer.product.name}</strong> (max: {pendingTransfer.product.quantity} {pendingTransfer.product.unit})</p>
            <label>Quantity to transfer *</label>
            <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="0" max={pendingTransfer.product.quantity} step="any" />
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => { setConfirmOpen(false); setPendingTransfer(null); }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={submitTransfer} disabled={!quantity || parseFloat(quantity) <= 0}>Create transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
