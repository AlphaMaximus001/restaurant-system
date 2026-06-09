const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Self-ping Render web service to prevent cold sleep (every 10 minutes)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  const httpLib = RENDER_URL.startsWith('https') ? require('https') : require('http');
  setInterval(() => {
    httpLib.get(`${RENDER_URL}/menu`, (res) => {
      console.log(`[Ping] Self-ping status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('[Ping] Self-ping error:', err.message);
    });
  }, 10 * 60 * 1000); // 10 minutes
  console.log(`[Ping] Self-ping service started for: ${RENDER_URL}`);
}

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const corsOriginHandler = (origin, callback) => {
  if (!origin) return callback(null, true);
  
  const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
  const isVercel = /\.vercel\.app$/.test(origin);
  const isClientUrl = origin === CLIENT_URL;
  
  if (isLocal || isVercel || isClientUrl) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};

// Enable CORS for Express
app.use(cors({
  origin: corsOriginHandler,
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const MENU_FILE = path.join(__dirname, 'menu.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// In-memory data
let menu = [
  // Starters
  { id: '1', name: 'Paneer Tikka', description: 'Cottage cheese marinated in spices, grilled in tandoor', price: 220, category: 'Starters', emoji: '🧀', available: true },
  { id: '2', name: 'Veg Seekh Kebab', description: 'Minced vegetables with herbs, skewered and grilled', price: 180, category: 'Starters', emoji: '🌿', available: true },
  { id: '3', name: 'Samosa (2 pcs)', description: 'Crispy pastry filled with spiced potatoes and peas', price: 60, category: 'Starters', emoji: '🔺', available: true },
  { id: '4', name: 'Hara Bhara Kebab', description: 'Spinach and paneer patties, shallow fried', price: 160, category: 'Starters', emoji: '🟢', available: true },
  { id: '5', name: 'Chicken Tikka', description: 'Boneless chicken in yogurt and spice marinade, tandoor grilled', price: 260, category: 'Starters', emoji: '🍗', available: true },
  // Mains
  { id: '6', name: 'Dal Makhani', description: 'Slow cooked black lentils in buttery tomato gravy', price: 220, category: 'Mains', emoji: '🍲', available: true },
  { id: '7', name: 'Paneer Butter Masala', description: 'Cottage cheese in rich tomato and cashew gravy', price: 260, category: 'Mains', emoji: '🧆', available: true },
  { id: '8', name: 'Chicken Biryani', description: 'Fragrant basmati rice layered with spiced chicken', price: 320, category: 'Mains', emoji: '🍚', available: true },
  { id: '9', name: 'Mutton Rogan Josh', description: 'Slow cooked mutton in Kashmiri spices', price: 380, category: 'Mains', emoji: '🥘', available: true },
  { id: '10', name: 'Palak Paneer', description: 'Cottage cheese in spiced spinach gravy', price: 240, category: 'Mains', emoji: '🥬', available: true },
  { id: '11', name: 'Butter Naan', description: 'Leavened bread baked in tandoor with butter', price: 50, category: 'Mains', emoji: '🫓', available: true },
  { id: '12', name: 'Jeera Rice', description: 'Basmati rice tempered with cumin', price: 120, category: 'Mains', emoji: '🍙', available: true },
  // Drinks
  { id: '13', name: 'Mango Lassi', description: 'Chilled yogurt drink blended with fresh mango', price: 90, category: 'Drinks', emoji: '🥭', available: true },
  { id: '14', name: 'Masala Chai', description: 'Spiced Indian tea with milk', price: 40, category: 'Drinks', emoji: '☕', available: true },
  { id: '15', name: 'Sweet Lassi', description: 'Chilled sweetened yogurt drink', price: 70, category: 'Drinks', emoji: '🥛', available: true },
  { id: '16', name: 'Fresh Lime Soda', description: 'Chilled lime juice with soda water', price: 60, category: 'Drinks', emoji: '🍋', available: true },
  { id: '17', name: 'Rooh Afza Sharbat', description: 'Rose flavored chilled drink', price: 55, category: 'Drinks', emoji: '🌹', available: true }
];

// Active orders keyed by tableNumber
let activeOrders = {};

// Load persisted menu if it exists
if (fs.existsSync(MENU_FILE)) {
  try {
    menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
    console.log('[Persistence] Menu loaded from menu.json');
  } catch (err) {
    console.error('[Persistence] Error loading menu.json:', err.message);
  }
} else {
  try {
    fs.writeFileSync(MENU_FILE, JSON.stringify(menu, null, 2));
  } catch (err) {
    console.error('[Persistence] Error writing initial menu.json:', err.message);
  }
}

// Load persisted orders if they exist
if (fs.existsSync(ORDERS_FILE)) {
  try {
    activeOrders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    console.log('[Persistence] Active orders loaded from orders.json');
  } catch (err) {
    console.error('[Persistence] Error loading orders.json:', err.message);
  }
}

function saveMenu() {
  try {
    fs.writeFileSync(MENU_FILE, JSON.stringify(menu, null, 2));
  } catch (err) {
    console.error('[Persistence] Error saving menu.json:', err.message);
  }
}

function saveOrders() {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(activeOrders, null, 2));
  } catch (err) {
    console.error('[Persistence] Error saving orders.json:', err.message);
  }
}


// REST API
app.get('/menu', (req, res) => {
  res.json(menu);
});

app.get('/active-orders', (req, res) => {
  res.json(activeOrders);
});

// Admin REST endpoints
app.post('/menu', (req, res) => {
  const { name, description, price, category, emoji } = req.body;

  if (!name || !price || !category || !emoji) {
    return res.status(400).json({ error: 'Name, price, category, and emoji are required.' });
  }

  const newItem = {
    id: String(menu.length + 1),
    name,
    description: description || '',
    price: Number(price),
    category,
    emoji,
    available: true
  };

  menu.push(newItem);
  saveMenu();
  console.log(`[Admin] Added new menu item: ${name}`);
  res.json({ success: true, item: newItem });
});

app.post('/menu/toggle', (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Item ID is required.' });
  }

  const item = menu.find(i => i.id === String(id));

  if (!item) {
    return res.status(404).json({ error: 'Menu item not found.' });
  }

  item.available = !item.available;
  saveMenu();
  console.log(`[Admin] Toggled availability of ${item.name} to ${item.available}`);
  res.json({ success: true, item });
});

app.post('/order', (req, res) => {
  const { tableNumber, items } = req.body;

  if (!tableNumber || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'tableNumber and items array are required.' });
  }

  const tableStr = String(tableNumber);

  // If table already has active order, merge the items
  if (activeOrders[tableStr]) {
    const existingOrder = activeOrders[tableStr];
    
    // Reset status back to ordered
    existingOrder.status = 'ordered';

    items.forEach(newItem => {
      // Find matching item by ID and customization
      const existingItem = existingOrder.items.find(item => 
        item.id === newItem.id && 
        (item.customization || '') === (newItem.customization || '')
      );

      if (existingItem) {
        existingItem.qty += newItem.qty;
      } else {
        existingOrder.items.push({
          id: newItem.id,
          name: newItem.name,
          price: newItem.price,
          qty: newItem.qty,
          customization: newItem.customization || ''
        });
      }
    });
  } else {
    // Create new order
    activeOrders[tableStr] = {
      tableNumber: tableStr,
      status: 'ordered',
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        customization: item.customization || ''
      })),
      createdAt: new Date().toISOString()
    };
  }

  saveOrders();
  const currentOrder = activeOrders[tableStr];

  // Emit "new_order" to socket room "staff"
  io.to('staff').emit('new_order', currentOrder);
  // Emit "order_status_updated" to table room to notify customer devices
  io.to(`table_${tableStr}`).emit('order_status_updated', { tableNumber: tableStr, status: 'ordered', order: currentOrder });

  console.log(`[Order] Placed for Table ${tableStr}:`, JSON.stringify(currentOrder.items));

  res.json({ success: true, order: currentOrder });
});

// Retrieves the active order and bill payload (if billing requested/billed) for a table
app.get('/active-order/:tableNumber', (req, res) => {
  const tableStr = String(req.params.tableNumber);
  const order = activeOrders[tableStr];

  if (!order) {
    return res.json({ active: false });
  }

  let bill = null;
  if (order.status === 'billed' || order.status === 'bill_requested') {
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const taxRate = 0.08; // 8% tax
    const tax = Number((subtotal * taxRate).toFixed(2));
    const serviceChargeRate = 0.10; // 10% service charge
    const serviceCharge = Number((subtotal * serviceChargeRate).toFixed(2));
    const total = Number((subtotal + tax + serviceCharge).toFixed(2));
    bill = {
      tableNumber: tableStr,
      items: order.items,
      subtotal: Number(subtotal.toFixed(2)),
      tax,
      serviceCharge,
      total
    };
  }

  res.json({ active: true, order, bill });
});

// Update order status (ordered -> preparing -> ready -> served) and broadcast to rooms
app.post('/order/status', (req, res) => {
  const { tableNumber, status } = req.body;

  if (!tableNumber || !status) {
    return res.status(400).json({ error: 'tableNumber and status are required.' });
  }

  const tableStr = String(tableNumber);
  const order = activeOrders[tableStr];

  if (!order) {
    return res.status(404).json({ error: `No active order found for table ${tableStr}.` });
  }

  order.status = status;
  saveOrders();

  // Broadcast update to staff and customer table rooms
  io.to('staff').emit('order_status_updated', { tableNumber: tableStr, status });
  io.to(`table_${tableStr}`).emit('order_status_updated', { tableNumber: tableStr, status });

  console.log(`[Order] Status updated for Table ${tableStr} to ${status}`);
  res.json({ success: true, order });
});

app.post('/end-table', (req, res) => {
  const { tableNumber } = req.body;

  if (!tableNumber) {
    return res.status(400).json({ error: 'tableNumber is required.' });
  }

  const tableStr = String(tableNumber);
  const order = activeOrders[tableStr];

  if (!order) {
    return res.status(404).json({ error: `No active order found for table ${tableStr}.` });
  }

  // Calculate bill details
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const taxRate = 0.08; // 8% tax
  const tax = Number((subtotal * taxRate).toFixed(2));
  const serviceChargeRate = 0.10; // 10% service charge
  const serviceCharge = Number((subtotal * serviceChargeRate).toFixed(2));
  const total = Number((subtotal + tax + serviceCharge).toFixed(2));

  order.status = 'billed';
  saveOrders();

  const billPayload = {
    tableNumber: tableStr,
    items: order.items,
    subtotal: Number(subtotal.toFixed(2)),
    tax,
    serviceCharge,
    total
  };

  // Emit "bill_ready" to socket room "table_{tableNumber}"
  io.to(`table_${tableStr}`).emit('bill_ready', billPayload);
  // Emit "order_status_updated" to staff and table room
  io.to('staff').emit('order_status_updated', { tableNumber: tableStr, status: 'billed' });
  io.to(`table_${tableStr}`).emit('order_status_updated', { tableNumber: tableStr, status: 'billed' });

  console.log(`[Bill] Sent to Table ${tableStr}: Total = ₹${total}`);

  res.json({ success: true, bill: billPayload });
});

app.post('/payment-done', (req, res) => {
  const { tableNumber } = req.body;

  if (!tableNumber) {
    return res.status(400).json({ error: 'tableNumber is required.' });
  }

  const tableStr = String(tableNumber);

  // Emit "payment_confirmed" to room "staff" and table room
  io.to('staff').emit('payment_confirmed', { tableNumber: tableStr });
  io.to(`table_${tableStr}`).emit('payment_confirmed', { tableNumber: tableStr });

  console.log(`[Payment] Confirmed for Table ${tableStr}. Clearing order.`);

  // Delete from activeOrders
  delete activeOrders[tableStr];
  saveOrders();

  res.json({ success: true });
});

// Socket.IO Room Management
io.on('connection', (socket) => {
  const { table, role } = socket.handshake.query;

  if (table) {
    const tableRoom = `table_${table}`;
    socket.join(tableRoom);
    console.log(`[Socket] Socket ${socket.id} joined ${tableRoom}`);
  }

  if (role === 'staff' || socket.handshake.query.staff === 'true') {
    socket.join('staff');
    console.log(`[Socket] Socket ${socket.id} joined staff room`);
  }

  socket.on('disconnect', () => {
    console.log(`[Socket] Socket ${socket.id} disconnected`);
  });
});

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
