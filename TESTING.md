# CoreInventory — Testing & Verification Guide

Use this checklist to verify CRUD, real-time behaviour, and refetching.

**Prerequisites:** Backend running (`cd backend && npm run dev`), Frontend running (`cd frontend && npm run dev`). Open http://localhost:5173.

---

## 1. CRUD operations

### Products (`/products`)

| Action | How to check |
|--------|----------------|
| **Create** | Click "Add product" → fill Name, SKU (e.g. `TEST-1`), Quantity → Create. Row appears in table. |
| **Read (list)** | Table shows all products; search by name/SKU filters list. |
| **Read (one)** | Edit opens modal with that product’s data. |
| **Update** | Click "Edit" on a row → change fields → Save. Table updates; no full reload. |
| **Delete** | Click "Delete" → confirm. Row disappears; total count updates. |

### Warehouses (`/warehouses`)

| Action | How to check |
|--------|----------------|
| **Create** | "Add warehouse" → Name, Code (e.g. `WH-TEST`) → Create. New row in table. |
| **Read** | List + search by name/code. |
| **Update** | Edit a warehouse → Save. Row updates. |
| **Delete** | Delete warehouse. Row and its locations (if any) removed. |

### Locations (`/locations`)

| Action | How to check |
|--------|----------------|
| **Create** | "Add location" → pick Warehouse, Name, Code (e.g. `A-1`) → Create. |
| **Read** | List; filter by "All warehouses" or one warehouse. |
| **Update** | Edit location → Save. |
| **Delete** | Delete location. Row disappears. |

### Stock movements (`/movements`)

| Action | How to check |
|--------|----------------|
| **Create** | "New movement" → Type (Receipt/Delivery/Transfer/Adjustment), Product, Quantity, locations if needed → Create. New row in table; product quantity changes for Receipt/Delivery/Adjustment. |
| **Read** | List; filter by type and product. |
| **Delete** | (If you add delete in UI) Movement removed. |

### Scheduled operations (`/scheduled`)

| Action | How to check |
|--------|----------------|
| **Create** | "Schedule" → Type, Due date, optional Product/Locations → Create. Row appears. |
| **Read** | List; filter by status (All/Pending/Done/Cancelled). |
| **Update** | "Done" or "Cancel" on a pending row. Status and list update. |

---

## 2. Real-time and refresh behaviour

| Feature | How to check |
|---------|----------------|
| **Dashboard polling** | Stay on Dashboard; change data in another tab (e.g. add a product or movement). Within ~30s, metrics and "Recent activity" should update without refresh. |
| **Refresh button (lists)** | On Products/Warehouses/Movements: change data in another tab or via API, then click the ↻ button. List refetches and shows new data. |
| **Refetch after mutation** | After Create/Edit/Delete on any page, the list on that page updates immediately (no manual refresh). |

---

## 3. Refetching and data consistency

| Scenario | What to verify |
|----------|----------------|
| **Create then list** | Create a product → table shows it; pagination total increases. |
| **Edit then list** | Edit a product → Save → table shows updated values. |
| **Delete then list** | Delete item → row disappears; total/count updates. |
| **Movement and product qty** | Create a Receipt for a product → product quantity increases; create Delivery → quantity decreases. |
| **Scheduled Done** | Mark a scheduled op "Done" → row status and list update. |

---

## 4. Auth (if `AUTH_ENABLED=true`)

| Check | How |
|-------|-----|
| **Protected routes** | With no token, visiting `/` redirects to `/login`. |
| **Login** | Enter admin/admin → redirect to Dashboard; nav shows "Logout". |
| **API with token** | After login, Products/Warehouses/etc. load; requests send `Authorization: Bearer <token>`. |
| **401 refetch / re-auth** | After logout or token expiry, next API call returns 401; token cleared and redirect to Login. |

---

## 5. Quick API checks (optional)

From PowerShell (backend on port 3000):

```powershell
# Health
Invoke-RestMethod -Uri "http://localhost:3000/api/health"

# Products list
Invoke-RestMethod -Uri "http://localhost:3000/api/products"

# Dashboard summary
Invoke-RestMethod -Uri "http://localhost:3000/api/dashboard/summary"
```

With auth enabled, add token:

```powershell
$token = "YOUR_JWT_TOKEN"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Headers $headers
```

---

## 6. Automated backend tests

Run the backend test suite:

```bash
cd backend
npm test
```

This checks: `GET /api/health`, `GET /api/auth/status`, `GET /api/products` (200 and response shape).

---

## Summary checklist

- [ ] Products: Create, list, search, edit, delete, sort, refresh
- [ ] Warehouses: Create, list, search, edit, delete, sort, refresh
- [ ] Locations: Create, list (with warehouse filter), edit, delete
- [ ] Movements: Create (Receipt/Delivery/Transfer/Adjustment), list with filters, sort, refresh
- [ ] Scheduled: Create, list, filter by status, Done/Cancel
- [ ] Transfer: Drag product to location, confirm qty, movement created
- [ ] Dashboard: Metrics, low stock, activity timeline, chart; auto-refresh ~30s
- [ ] Refresh buttons: Products, Warehouses, Movements refetch on ↻
- [ ] Auth (if on): Login, protected routes, logout, 401 → login
