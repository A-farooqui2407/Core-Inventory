## Summary
This PR aligns CoreInventory with the **PDF workflow spec**, adds **auth (signup + OTP reset)**, and introduces **UI polish**: iOS-style bubbles/pills, premium black dark mode, and a dark blue sidebar.

---

## PDF workflow alignment
- **Receipts:** Document with supplier, multi-line products, status (draft → done). Validate creates movements and updates stock.
- **Delivery orders:** Document with multi-line items; validate decreases stock.
- **Categories & suppliers:** New entities; products have category and reorder rules.
- **Stock per location:** `stock_balances` table; updated by movements with from/to location.
- **Dashboard KPIs:** Pending receipts, Pending deliveries, Internal transfers scheduled (plus existing metrics).
- **Navigation:** Dashboard, Products, Operations (dropdown: Receipts, Delivery Orders, Inventory Adjustment), Move History, Transfer, Schedule, Settings. Profile menu in left sidebar (My Profile, Logout).
- **Settings page:** Warehouses, Locations, Categories, Suppliers (cards + spacing).
- **Inventory Adjustment:** Dedicated page; Move History shows type badges (Receipt/Delivery/Transfer/Adjustment) with distinct colors.

## Auth
- **Sign up:** `/signup` — create account, then redirect to dashboard.
- **OTP password reset:** `/forgot-password` (sends OTP; dev returns OTP in response), `/reset-password` (username + OTP + new password).
- **Users table** created at server startup if missing; login supports env admin and registered users.

## Backend
- **DB (migration 4):** `categories`, `suppliers`, `users`, `receipt_documents`, `receipt_lines`, `delivery_documents`, `delivery_lines`, `stock_balances`; products get `category_id`, `reorder_min_quantity`, `reorder_quantity`.
- **Startup:** `ensureAllTables()` creates any missing PDF-workflow tables so app works without running `init-db` first.
- **New APIs:** `/api/categories`, `/api/suppliers`, `/api/receipts` (CRUD + `POST :id/validate`), `/api/deliveries` (CRUD + validate), `/api/stock-balances`.
- **Movements** update `stock_balances` when `from_location_id` / `to_location_id` are set.

## UI
- **iOS-style:** Pill-shaped nav, buttons, inputs, badges; bubble-shaped cards, modals, settings sections; chart bars and type badges with distinct colors (Receipt=green, Delivery=red, Transfer=blue, Adjustment=amber).
- **Dark mode:** Premium black palette (`#0a0a0a` bg); theme toggle in header and on login page; preference stored in `localStorage`; follows system if not set.
- **Sidebar:** Full sidebar dark blue (button color); white text; hover/active overlays.
- **Dashboard:** Compact title and spacing; movement-type colors in activity and chart.

## Docs
- **WORKFLOW_VS_PDF.md:** Comparison of implementation vs PDF; lists gaps and recommendations.

## How to test
1. `cd backend && npm install && npm run dev` (tables ensured on startup).
2. `cd frontend && npm install && npm run dev`.
3. Sign up, create categories/suppliers, add products with category/reorder, create receipts/deliveries and validate, use Move History and Adjustments. Toggle dark mode; check sidebar and layout.
