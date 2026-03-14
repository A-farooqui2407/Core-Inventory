# CoreInventory — Workflow vs PDF Specification

This document compares the **current product workflow** (implementation + PHASE_PLAN) with the **CoreInventory PDF specification**.

**Status:** The app has been updated to match the PDF workflow (see summary at end).

---

## 1. Problem Statement & Target Users

| PDF | Current | Match |
|-----|---------|--------|
| Modular IMS; replace manual registers/Excel; centralized, real-time | React + Node app; SQLite; polling (30s) for dashboard | ✅ Yes |
| Target: Inventory Managers, Warehouse Staff | Same (no role distinction in app) | ✅ Yes |

---

## 2. Authentication

| PDF | Current | Match |
|-----|---------|--------|
| User signs up / logs in | **Login only** (username/password); no signup | ⚠️ Partial |
| OTP-based password reset | Not implemented | ❌ No |
| Redirected to Inventory Dashboard after login | Redirect to `/` (Dashboard) | ✅ Yes |

**Gap:** No **sign up**; no **OTP-based password reset**.

---

## 3. Dashboard View

### 3.1 Dashboard KPIs

| PDF KPI | Current | Match |
|---------|---------|--------|
| Total Products in Stock | ✅ Products count + Total quantity | ✅ Yes |
| Low Stock / Out of Stock Items | ✅ Low stock list (configurable threshold) | ✅ Yes |
| Pending Receipts | Not as separate KPI | ❌ No |
| Pending Deliveries | Not as separate KPI | ❌ No |
| Internal Transfers Scheduled | Scheduled operations exist but not as dashboard KPI count | ⚠️ Partial |

**Gap:** Dashboard does not show **Pending Receipts**, **Pending Deliveries**, or **Internal Transfers Scheduled** as distinct KPIs. You have generic metrics (products, total qty, warehouses, movements) and low-stock items.

### 3.2 Dynamic Filters (PDF)

| PDF Filter | Current | Match |
|------------|---------|--------|
| By document type (Receipts / Delivery / Internal / Adjustments) | Available on **Movements** page only, not on dashboard | ⚠️ Partial |
| By status (Draft, Waiting, Ready, Done, Canceled) | No document lifecycle; movements are immediate. Scheduled has pending/done/cancelled | ❌ No |
| By warehouse or location | Filters on Movements/Warehouses pages, not dashboard | ⚠️ Partial |
| By product category | No product category in schema | ❌ No |

**Gap:** Dashboard has no **dynamic filters** (type, status, warehouse, category). Filtering exists on list pages only.

---

## 4. Navigation

| PDF | Current | Match |
|-----|---------|--------|
| **1. Products** (create/update, stock per location, categories, reordering rules) | Products: create/update, list; **no category, no reorder rules**; stock is **global**, not per location | ⚠️ Partial |
| **2. Operations:** Receipts | Single **Movements** page; type = Receipt | ✅ Concept |
| **2. Operations:** Delivery Orders | Same; type = Delivery | ✅ Concept |
| **2. Operations:** Inventory Adjustment | Same; type = Adjustment | ✅ Concept |
| **2. Operations:** Move History | **Movements** list = ledger / move history | ✅ Yes |
| **3. Dashboard** | ✅ Dashboard page | ✅ Yes |
| **4. Setting → Warehouse** | **Warehouses** + **Locations** as top-level nav (not under Settings) | ✅ Yes (different structure) |
| **5. Profile:** My Profile, Logout | **Logout** only; no "My Profile" page | ⚠️ Partial |

**Gap:** No **Product categories** or **reordering rules**; no **stock per location** (only global product quantity); no **My Profile**; no **Settings** section (Warehouses are top-level).

---

## 5. Core Features

### 5.1 Product Management

| PDF | Current | Match |
|-----|---------|--------|
| Name, SKU/Code, Category, Unit of Measure, Initial stock (optional) | Name, SKU, description, quantity, unit. **No category** | ⚠️ Partial |

**Gap:** **Category** is not in the product schema or UI.

### 5.2 Receipts (Incoming Goods)

| PDF | Current | Match |
|-----|---------|--------|
| Create receipt → Add supplier & products → Quantities received → Validate → stock + | Create movement type=Receipt, product, quantity, optional to_location; **no supplier**; single-step (no draft/validate) | ⚠️ Partial |

**Gap:** No **supplier** field; no **multi-line receipt** (add many products in one receipt) in the described flow; no **Draft → Validate** lifecycle.

### 5.3 Delivery Orders (Outgoing)

| PDF | Current | Match |
|-----|---------|--------|
| Pick items → Pack items → Validate → stock − | Single-step: create movement type=Delivery with product, quantity, optional from_location | ⚠️ Partial |

**Gap:** No **Pick → Pack → Validate** workflow; no document status.

### 5.4 Internal Transfers

| PDF | Current | Match |
|-----|---------|--------|
| Move between locations/warehouses; logged in ledger | Transfer movement (from_location, to_location) + **Transfer** page (drag-and-drop); all in stock_movements | ✅ Yes |

### 5.5 Stock Adjustments

| PDF | Current | Match |
|-----|---------|--------|
| Select product/location, enter counted qty, system updates and logs | Adjustment movement; product quantity updated; **no per-location balance** (adjustment is global) | ⚠️ Partial |

**Gap:** PDF implies **per-location** count; app has **global** product quantity only.

---

## 6. Additional Features (PDF)

| PDF | Current | Match |
|-----|---------|--------|
| Alerts for low stock | ✅ Low stock widget + configurable threshold | ✅ Yes |
| Multi-warehouse support | ✅ Warehouses + locations | ✅ Yes |
| SKU search & smart filters | ✅ Product search by name/SKU; filters on lists | ✅ Yes |

---

## 7. Example Flow (PDF)

| Step | PDF | Current | Match |
|------|-----|---------|--------|
| 1 | Receive 100 kg Steel → Stock +100 | Receipt movement → product quantity +100 | ✅ Yes |
| 2 | Internal transfer: Main Store → Production Rack (location updated) | Transfer movement from A to B; **total stock unchanged**; locations on movement only (no per-location ledger) | ⚠️ Partial |
| 3 | Deliver 20 steel → Stock −20 | Delivery movement → quantity −20 | ✅ Yes |
| 4 | Adjust damaged 3 kg → Stock −3 | Adjustment movement → quantity −3 | ✅ Yes |
| — | Everything logged in Stock Ledger | All in `stock_movements` | ✅ Yes |

**Gap:** **Per-location stock** is not computed or stored; only global product quantity is. So “stock at Production Rack” is not a first-class KPI.

---

## 8. Summary: Matches vs Gaps

### Matches (aligned with PDF)

- Centralized IMS with products, warehouses, locations.
- Login and redirect to dashboard (no signup/OTP).
- Dashboard with total products, total quantity, low-stock alerts, recent activity.
- Products: create/update, SKU, unit, initial stock (quantity).
- Receipts, Delivery, Internal Transfer, Stock Adjustment as movement types; stock and ledger updated.
- Internal transfers with drag-and-drop Transfer page.
- Low-stock alerts, multi-warehouse, SKU search and filters.
- End-to-end example flow (receive → transfer → deliver → adjust) works and is logged.

### Gaps (PDF not fully reflected)

1. **Auth:** No sign up; no OTP-based password reset.
2. **Dashboard KPIs:** No “Pending Receipts”, “Pending Deliveries”, “Internal Transfers Scheduled” as separate KPIs.
3. **Dashboard filters:** No dynamic filters by document type, status, warehouse, or category.
4. **Document lifecycle:** No Draft / Waiting / Ready / Done / Canceled for receipts or delivery orders.
5. **Products:** No **category**; no **reordering rules**; no **stock per location** (only global quantity).
6. **Receipts:** No **supplier**; no explicit multi-line “add supplier & products” receipt flow.
7. **Delivery:** No **Pick → Pack → Validate** workflow.
8. **Settings:** No “Settings” section (e.g. Warehouse under Settings); structure differs.
9. **Profile:** No “My Profile” page.
10. **Stock per location:** No per-location stock balance or location-level adjustments as in the PDF example.

---

## 9. Recommendation

- **Core workflow (receive, transfer, deliver, adjust)** and **ledger** match the PDF; the main conceptual gap is **per-location stock** and **document lifecycle** (draft/validate, pending receipts/deliveries).
- To align **closer to the PDF**, consider (in order of impact):
  1. Add **product category** and optional **reordering rules**.
  2. Add **dashboard KPIs**: Pending Receipts, Pending Deliveries, Internal Transfers Scheduled (e.g. from scheduled_operations and/or draft documents).
  3. Introduce **document status** (e.g. Draft/Ready/Done/Canceled) for receipts and delivery orders.
  4. Add **supplier** (e.g. on receipt or on a new table) and optionally a dedicated Receipt/Delivery UI with multi-line support.
  5. Add **stock per location** (location-level balance) if the PDF’s “stock at location” is required.
  6. Add **sign up**, **OTP-based password reset**, and **My Profile** if auth must match the PDF verbatim.

---

## 10. Post-update alignment (implemented)

The following were added so the workflow matches the PDF:

- **Auth:** Sign up (`/signup`), OTP-based password reset (`/forgot-password`, `/reset-password`). Login still supports env admin user and registered users.
- **Dashboard KPIs:** Pending Receipts, Pending Deliveries, Internal Transfers Scheduled (plus existing metrics).
- **Navigation:** Dashboard, Products, Operations (Receipts, Delivery Orders, Inventory Adjustment, Move History, Transfer, Scheduled), Settings (Warehouse + Categories + Suppliers), My Profile, Logout.
- **Products:** Category, reorder min quantity, reorder quantity; filter by category; stock per location via `stock_balances` and `/api/stock-balances`.
- **Receipts:** Document with status (draft/waiting/ready/done/canceled), supplier, multi-line products, optional to-location; Validate creates movements and updates stock.
- **Delivery orders:** Document with status and multi-line items; Validate decreases stock.
- **Inventory Adjustment:** Dedicated page and API (movement type Adjustment).
- **Move History:** Movements list (unchanged).
- **Settings:** Warehouse (Warehouses, Locations), Product categories, Suppliers.
- **My Profile:** Page showing current user.

**After pulling these changes, run `npm run init-db` in the backend to apply migration 4 (categories, suppliers, receipt/delivery documents, stock_balances, users).**

---

*Generated from codebase and `PHASE_PLAN.md` vs CoreInventory PDF.*
