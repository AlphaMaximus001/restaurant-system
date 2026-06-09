# Gourmet Bistro - Restaurant Management System

A real-time, full-stack Restaurant Management System built from scratch.

## Tech Stack
- **Frontend**: React (Vite) + Plain CSS (Custom cream/amber and dark-slate dashboard design)
- **Backend**: Node.js + Express + Socket.IO (In-memory server state)
- **Routing**: Client-side routing with `react-router-dom`

---

## Setup & Running the System

To run the system locally, you must start both the backend server and the frontend Vite development server.

### 1. Start the Backend Server
1. Navigate to the `server` directory.
2. Install the Node.js packages.
3. Start the server.
```bash
cd server
npm install
node index.js
```
The server will start and listen on port **`4000`**.

### 2. Start the Frontend Application
1. Open a new terminal window/tab.
2. Navigate to the `client` directory.
3. Install the frontend dependencies.
4. Run the Vite development server.
```bash
cd client
npm install
npm run dev
```
The client Vite application will start and run on **`http://localhost:5173/`**.

---

## Demo URLs

- **Welcome Landing & Test Hub**: [http://localhost:5173/](http://localhost:5173/)
- **Customer Tablet Screen (Table 3)**: [http://localhost:5173/?table=3](http://localhost:5173/?table=3)
- **Staff Control Dashboard**: [http://localhost:5173/staff](http://localhost:5173/staff)

---

## Real-Time Testing Walkthrough

Follow these steps to experience the real-time order-to-checkout pipeline:

1. **Open Side-by-Side Windows**:
   - Open [http://localhost:5173/?table=3](http://localhost:5173/?table=3) in browser tab 1 (Tablet Customer view).
   - Open [http://localhost:5173/staff](http://localhost:5173/staff) in browser tab 2 (Staff Dashboard control).
2. **Customer places an order**:
   - In tab 1, select items (e.g. Garlic Bread, Classic Beef Burger).
   - Add quantities, include customization notes (e.g., "no onions"), and click **Place Order 🍽️**.
   - The Customer Screen transitions to a full-screen cooking status.
3. **Staff processes the order**:
   - In tab 2, watch the toast notification "New order from Table 3! 🍳" trigger.
   - The order card for Table 3 appears in the dark professional dashboard showing the item list, customizations, and subtotal.
   - Click **Mark Preparing** (status badge changes to blue).
   - Click **Mark Ready** (status badge changes to green; checkout options appear).
   - Click **End Table & Bill 🧾**.
4. **Customer receives the bill**:
   - Instantly observe that tab 1 (Customer view) transitions to a monospace thermal receipt displaying the subtotal, tax calculations, service charge, and grand total.
5. **Customer completes payment**:
   - In tab 1, click **Pay Now ✅**.
   - Tab 1 transitions to a thank you screen.
   - In tab 2, check that the staff toast "Table 3 — Paid ✅" fires. Table 3 card flashes green then disappears, clearing the session.
