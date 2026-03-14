# Core-Inventory
Real-time inventory management system for tracking products, stock movements, and warehouse operations.
1. Project Title
CoreInventory
2. Short Description
CoreInventory is a modular inventory management system that helps businesses track products, manage stock movements, schedule warehouse operations, and monitor inventory in real time.
3. Features

Example:

• Product Management (Create, update, track products)
• Warehouse & location tracking
• Stock movements (Receipts, Deliveries, Transfers, Adjustments)
• Scheduling of inventory operations
• Drag-and-drop warehouse movement
• Inventory dashboard with key metrics
• Low stock alerts
• Activity timeline for stock movements
4. Tech Stack
Frontend
React + Vite

Backend
Node.js + Express

Database
PostgreSQL / SQLite

Libraries
dnd-kit (Drag and Drop)
Axios
React Router
5. Project Structure
coreinventory
 ├ frontend
 │   ├ src
 │   ├ components
 │   ├ pages
 │   └ services
 │
 ├ backend
 │   ├ routes
 │   ├ controllers
 │   ├ models
 │   └ server.js
6. Installation

**Backend (from repo root):**
```bash
cd backend
npm install
npm run init-db   # creates SQLite DB at backend/data/coreinventory.db
npm run dev       # http://localhost:3000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173, proxies /api to backend
```

**Verify:** Open `http://localhost:3000/api/health` and `http://localhost:3000/api/health/db` for API and DB status.
7. Future Improvements
• AI demand forecasting
• Barcode scanning
• Mobile warehouse interface
• Advanced analytics

8. system architecture diagram:

React Frontend
      ↓
REST API
      ↓
Node.js + Express
      ↓
Database

