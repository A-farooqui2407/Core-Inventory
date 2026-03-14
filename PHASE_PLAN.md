# CoreInventory — Phase-wise Plan

Single reference document for the implementation roadmap of the CoreInventory real-time inventory management system.

---

## Phase 1 — Foundation & Setup

| # | Task | Status | Notes |
|---|------|--------|--------|
| 1.1 | Initialize project structure (frontend + backend) | Done | `frontend/`, `backend/` |
| 1.2 | Frontend: React + Vite setup, base config | Done | ESLint, path alias `@/`, proxy `/api` → 3000 |
| 1.3 | Backend: Node.js + Express server, health route | Done | `/api/health`, `/api/health/db`, CORS, port from env |
| 1.4 | Database: Choose and connect (PostgreSQL or SQLite) | Done | SQLite via better-sqlite3, `npm run init-db` |
| 1.5 | Environment config (.env, env.example) | Done | `frontend/.env.example`, `backend/.env.example` |

**Deliverable:** App runs locally; backend responds; DB connection verified.

---

## Phase 2 — Core Data & API

| # | Task | Status | Notes |
|---|------|--------|--------|
| 2.1 | Products: DB model/schema, CRUD API | Done | Name, SKU, quantity, unit, description |
| 2.2 | Warehouses & locations: model + API | Done | `warehouses` + `locations` (parent_id), CRUD |
| 2.3 | Stock movements: model + types (Receipt, Delivery, Transfer, Adjustment) | Done | Audit trail; product quantity updated on create |
| 2.4 | API routes: `/products`, `/warehouses`, `/movements` | Done | Pagination (page, limit), search/type/product_id filters |
| 2.5 | Request validation & error handling | Done | `lib/response.js` + validation in routes |

**Deliverable:** Full CRUD for products, warehouses, and stock movements via API.

---

## Phase 3 — Frontend Core

| # | Task | Status | Notes |
|---|------|--------|--------|
| 3.1 | React Router setup, layout, nav | Done | Layout + nav; Dashboard, Products, Warehouses, Locations, Movements |
| 3.2 | API service layer (Axios), base URL, interceptors | Done | `services/api.js`; response unwrap, error message extraction |
| 3.3 | Product Management: list, create, edit, delete | Done | Table, search, pagination, modal forms, delete confirm |
| 3.4 | Warehouse & location: list, create, edit | Done | Warehouses CRUD; Locations with warehouse filter, parent optional |
| 3.5 | Stock movements: list, create (by type) | Done | List with type/product filters; create modal (Receipt, Delivery, Transfer, Adjustment) |

**Deliverable:** Users can manage products, warehouses, and record movements from the UI.

---

## Phase 4 — Dashboard & Alerts

| # | Task | Status | Notes |
|---|------|--------|--------|
| 4.1 | Dashboard page: key metrics (total stock, value, movement counts) | | Summary API if needed |
| 4.2 | Low stock alerts: threshold config, list/widget | | Backend rule or query |
| 4.3 | Activity timeline: recent stock movements | | Time-ordered list/feed |
| 4.4 | Charts or simple visualizations (optional) | | Stock levels, movement trends |

**Deliverable:** Dashboard with metrics, low-stock alerts, and activity timeline.

---

## Phase 5 — Warehouse Operations & UX

| # | Task | Status | Notes |
|---|------|--------|--------|
| 5.1 | Scheduling of inventory operations (due dates, tasks) | | Model + API + UI |
| 5.2 | Drag-and-drop warehouse movement (dnd-kit) | | Move items between locations |
| 5.3 | Real-time or polling updates for stock changes | | Optional WebSocket or refresh |
| 5.4 | Search, filters, sort on main lists | | Products, movements, warehouses |

**Deliverable:** Scheduled operations, drag-and-drop movements, improved list UX.

---

## Phase 6 — Polish & Deploy

| # | Task | Status | Notes |
|---|------|--------|--------|
| 6.1 | Auth (optional): login, roles, protect routes | | JWT or sessions |
| 6.2 | Error boundaries, loading states, toasts | | Consistent UX |
| 6.3 | Responsive layout, accessibility basics | | Mobile-friendly lists/forms |
| 6.4 | Backend tests (critical routes) | | Jest or similar |
| 6.5 | Frontend build & backend run in prod mode | | Env checks |
| 6.6 | Deploy: frontend (static host), backend (Node host), DB | | Docs for deploy steps |

**Deliverable:** Stable, deployable app with optional auth and better UX.

---

## Phase 7 — Future Improvements (Backlog)

| # | Idea | Priority | Notes |
|---|------|----------|--------|
| 7.1 | AI demand forecasting | Medium | Historical data + model |
| 7.2 | Barcode scanning | High | Mobile or web camera API |
| 7.3 | Mobile warehouse interface | Medium | PWA or native |
| 7.4 | Advanced analytics & reports | Medium | Export, charts, KPIs |

---

## Quick Reference

- **Tech stack:** React (Vite), Node.js + Express, PostgreSQL/SQLite, dnd-kit, Axios, React Router  
- **Repo structure:** `frontend/` (src, components, pages, services), `backend/` (routes, controllers, models, server.js)  
- **Doc updated:** Use this file as the single source of truth; update Status as tasks complete.

---

*Use the Status column: leave blank, or set to In Progress / Done / Blocked as you go.*
