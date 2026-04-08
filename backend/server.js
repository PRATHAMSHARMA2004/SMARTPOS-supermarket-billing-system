const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const BILLS_FILE = path.join(__dirname, 'data', 'bills.json');
const INVENTORY_FILE = path.join(__dirname, 'data', 'inventory.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Ensure data directory and files exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(BILLS_FILE)) {
  fs.writeFileSync(BILLS_FILE, '[]', 'utf8');
}
if (!fs.existsSync(INVENTORY_FILE)) {
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify([
    { id: 'INV001', name: 'Organic Milk', category: 'Dairy', price: 4.99, quantity: 120, unit: 'ltr' },
    { id: 'INV002', name: 'Whole Wheat Bread', category: 'Bakery', price: 3.49, quantity: 85, unit: 'pcs' },
    { id: 'INV003', name: 'Fresh Eggs (12pk)', category: 'Dairy', price: 5.99, quantity: 60, unit: 'pcs' },
    { id: 'INV004', name: 'Basmati Rice 5kg', category: 'Grains', price: 12.99, quantity: 45, unit: 'kg' },
    { id: 'INV005', name: 'Olive Oil Extra Virgin', category: 'Oils', price: 8.49, quantity: 30, unit: 'ltr' },
    { id: 'INV006', name: 'Chicken Breast', category: 'Meat', price: 9.99, quantity: 40, unit: 'kg' },
    { id: 'INV007', name: 'Hass Avocado', category: 'Produce', price: 2.49, quantity: 100, unit: 'pcs' },
    { id: 'INV008', name: 'Greek Yogurt', category: 'Dairy', price: 6.29, quantity: 55, unit: 'pcs' },
    { id: 'INV009', name: 'Sparkling Water', category: 'Beverages', price: 1.99, quantity: 200, unit: 'pcs' },
    { id: 'INV010', name: 'Dark Chocolate 70%', category: 'Snacks', price: 4.29, quantity: 70, unit: 'pcs' }
  ], null, 2), 'utf8');
}

// Helper functions
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ─── BILLS API ───
app.get('/api/bills', (req, res) => {
  const bills = readJSON(BILLS_FILE);
  res.json(bills);
});

app.post('/api/bills', (req, res) => {
  const bills = readJSON(BILLS_FILE);
  const inventory = readJSON(INVENTORY_FILE);
  const bill = req.body;

  // Generate invoice ID
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayBills = bills.filter(b => b.invoiceId && b.invoiceId.startsWith(`SM-${today}`));
  bill.invoiceId = `SM-${today}-${String(todayBills.length + 1).padStart(4, '0')}`;
  bill.createdAt = new Date().toISOString();

  // Deduct quantities from inventory
  if (bill.items && Array.isArray(bill.items)) {
    bill.items.forEach(item => {
      const invItem = inventory.find(i => i.id === item.id);
      if (invItem) {
        invItem.quantity = Math.max(0, invItem.quantity - item.qty);
      }
    });
    writeJSON(INVENTORY_FILE, inventory);
  }

  bills.push(bill);
  writeJSON(BILLS_FILE, bills);
  res.json({ success: true, bill });
});

// ─── INVENTORY API ───
app.get('/api/inventory', (req, res) => {
  const inventory = readJSON(INVENTORY_FILE);
  res.json(inventory);
});

app.post('/api/inventory', (req, res) => {
  const inventory = readJSON(INVENTORY_FILE);
  const item = req.body;
  item.id = 'INV' + String(Date.now()).slice(-6);
  inventory.push(item);
  writeJSON(INVENTORY_FILE, inventory);
  res.json({ success: true, item });
});

app.put('/api/inventory/:id', (req, res) => {
  const inventory = readJSON(INVENTORY_FILE);
  const idx = inventory.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  inventory[idx] = { ...inventory[idx], ...req.body };
  writeJSON(INVENTORY_FILE, inventory);
  res.json({ success: true, item: inventory[idx] });
});

app.delete('/api/inventory/:id', (req, res) => {
  let inventory = readJSON(INVENTORY_FILE);
  inventory = inventory.filter(i => i.id !== req.params.id);
  writeJSON(INVENTORY_FILE, inventory);
  res.json({ success: true });
});

// ─── DASHBOARD API ───
app.get('/api/dashboard', (req, res) => {
  const bills = readJSON(BILLS_FILE);
  const inventory = readJSON(INVENTORY_FILE);
  const today = new Date().toISOString().slice(0, 10);

  const totalRevenue = bills.reduce((sum, b) => sum + (b.total || 0), 0);
  const todayBills = bills.filter(b => b.createdAt && b.createdAt.startsWith(today));
  const todaySales = todayBills.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalItems = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const totalProducts = inventory.length;
  const totalBills = bills.length;

  // Revenue last 7 days
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const dayRevenue = bills
      .filter(b => b.createdAt && b.createdAt.startsWith(ds))
      .reduce((s, b) => s + (b.total || 0), 0);
    last7.push({ date: ds, revenue: dayRevenue });
  }

  res.json({
    totalRevenue,
    todaySales,
    totalItems,
    totalProducts,
    totalBills,
    todayBillsCount: todayBills.length,
    last7Days: last7,
    recentBills: bills.slice(-5).reverse()
  });
});

app.listen(PORT, () => {
  console.log(`\n  🚀 SmartMart POS Server running at http://localhost:${PORT}\n`);
});
