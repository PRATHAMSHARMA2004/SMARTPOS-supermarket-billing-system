const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// ✅ FIXED PORT (IMPORTANT)
const PORT = process.env.PORT || 3000;

const BILLS_FILE = path.join(__dirname, 'data', 'bills.json');
const INVENTORY_FILE = path.join(__dirname, 'data', 'inventory.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ✅ ROOT ROUTE (Railway check ke liye)
app.get('/', (req, res) => {
  res.send("Backend working 🚀");
});

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
    { id: 'INV002', name: 'Whole Wheat Bread', category: 'Bakery', price: 3.49, quantity: 85, unit: 'pcs' }
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

// APIs
app.get('/api/bills', (req, res) => {
  res.json(readJSON(BILLS_FILE));
});

app.post('/api/bills', (req, res) => {
  const bills = readJSON(BILLS_FILE);
  const bill = req.body;
  bill.createdAt = new Date().toISOString();
  bills.push(bill);
  writeJSON(BILLS_FILE, bills);
  res.json({ success: true });
});

app.get('/api/inventory', (req, res) => {
  res.json(readJSON(INVENTORY_FILE));
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});