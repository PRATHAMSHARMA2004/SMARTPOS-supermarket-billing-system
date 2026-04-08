/* ══════════════════════════════════════════════════════════════
   SmartMart POS – Application Logic
   ══════════════════════════════════════════════════════════════ */

const API = 'http://localhost:3000/api';

// ─── State ───
let cart = [];
let inventory = [];
let bills = [];
let currentPage = 'dashboard';
let chartInstance = null;

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    initDate();
    initTheme();
    initNav();
    initBillingSearch();
    initInventorySearch();
    initHistoryFilters();
    initInventoryModal();
    initCheckout();
    initMenuToggle();
    initDashboardCards();
    loadDashboard();
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 800);
});

// ─── Date ───
function initDate() {
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('topbarDate').textContent = now.toLocaleDateString('en-US', opts);
    document.getElementById('billDate').valueAsDate = now;
}

// ─── Theme ───
function initTheme() {
    const saved = localStorage.getItem('smartmart-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    document.getElementById('themeToggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('smartmart-theme', next);
        updateThemeIcon(next);
    });
}

function updateThemeIcon(theme) {
    document.getElementById('themeIcon').textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
}

// ─── Mobile Menu ───
function initMenuToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });
}

// ─── Navigation ───
function initNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const page = el.dataset.page;
            navigateTo(page);

            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
            document.querySelector('.sidebar-overlay')?.classList.remove('show');
        });
    });
}

function navigateTo(page) {
    currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Update topbar
    const titles = {
        dashboard: ['Dashboard', 'Overview & Analytics'],
        billing: ['Billing', 'Point of Sale'],
        inventory: ['Inventory', 'Manage Products'],
        history: ['History', 'Transaction Records']
    };
    document.getElementById('pageTitle').textContent = titles[page][0];
    document.getElementById('pageBreadcrumb').textContent = titles[page][1];

    // Load data
    if (page === 'dashboard') loadDashboard();
    else if (page === 'billing') loadBillingProducts();
    else if (page === 'inventory') loadInventory();
    else if (page === 'history') loadHistory();
}

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
async function loadDashboard() {
    try {
        const res = await fetch(`${API}/dashboard`);
        const data = await res.json();

        animateCounter('statRevenue', data.totalRevenue, true);
        animateCounter('statItems', data.totalItems, false);
        animateCounter('statTodaySales', data.todaySales, true);
        animateCounter('statBills', data.totalBills, false);

        renderChart(data.last7Days);
        renderRecentBills(data.recentBills);
    } catch (err) {
        console.error('Dashboard error:', err);
    }
}

function animateCounter(id, target, isCurrency) {
    const el = document.getElementById(id);
    const start = 0;
    const duration = 1000;
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = start + (target - start) * eased;

        el.textContent = isCurrency ? `$${value.toFixed(2)}` : Math.round(value).toString();

        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function renderChart(data) {
    const canvas = document.getElementById('revenueChart');
    const ctx = canvas.getContext('2d');

    // Resize canvas
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const w = canvas.width;
    const h = canvas.height;
    const padding = { top: 30, right: 20, bottom: 50, left: 60 };

    const maxVal = Math.max(...data.map(d => d.revenue), 10);
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // Get theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9d9db8' : '#5c5c7a';
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = textColor;
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        const val = maxVal - (maxVal / 4) * i;
        ctx.fillText(`$${val.toFixed(0)}`, padding.left - 10, y + 4);
    }

    // Bar width
    const barW = Math.min(chartW / data.length * 0.5, 40);
    const gap = chartW / data.length;

    // Draw bars with animation
    data.forEach((d, i) => {
        const x = padding.left + gap * i + (gap - barW) / 2;
        const barH = (d.revenue / maxVal) * chartH;
        const y = padding.top + chartH - barH;

        // Gradient bar
        const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
        grad.addColorStop(0, '#6C5CE7');
        grad.addColorStop(1, 'rgba(108,92,231,0.2)');
        ctx.fillStyle = grad;

        // Rounded top
        const radius = Math.min(barW / 2, 6);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
        ctx.lineTo(x + barW, padding.top + chartH);
        ctx.lineTo(x, padding.top + chartH);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();

        // X-axis labels
        ctx.fillStyle = textColor;
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        const label = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
        ctx.fillText(label, x + barW / 2, padding.top + chartH + 22);

        // Value on top
        if (d.revenue > 0) {
            ctx.fillStyle = isDark ? '#a29bfe' : '#6C5CE7';
            ctx.font = 'bold 11px Inter';
            ctx.fillText(`$${d.revenue.toFixed(0)}`, x + barW / 2, y - 8);
        }
    });
}

function renderRecentBills(bills) {
    const el = document.getElementById('recentBillsList');
    if (!bills || bills.length === 0) {
        el.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-round">receipt_long</span>
        <p>No recent transactions</p>
      </div>`;
        return;
    }

    el.innerHTML = bills.map(b => `
    <div class="recent-item">
      <div class="recent-item-left">
        <span class="recent-item-id">${b.invoiceId || '—'}</span>
        <span class="recent-item-customer">${b.customerName || 'Walk-in'}</span>
      </div>
      <span class="recent-item-amount">$${(b.total || 0).toFixed(2)}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════
//  INVENTORY
// ═══════════════════════════════════════
async function loadInventory() {
    try {
        const res = await fetch(`${API}/inventory`);
        inventory = await res.json();
        renderInventoryTable(inventory);
    } catch (err) {
        console.error('Inventory error:', err);
        toast('Failed to load inventory', 'error');
    }
}

function renderInventoryTable(items) {
    document.getElementById('inventoryCount').textContent = items.length;
    const tbody = document.getElementById('inventoryBody');
    tbody.innerHTML = items.map(item => `
    <tr>
      <td><span style="color:var(--primary-light);font-weight:600">${item.id}</span></td>
      <td style="font-weight:600">${item.name}</td>
      <td><span style="opacity:0.7">${item.category}</span></td>
      <td style="font-weight:600">$${Number(item.price).toFixed(2)}</td>
      <td>
        <span class="${item.quantity <= 10 ? 'product-card-stock low-stock' : 'product-card-stock in-stock'}"
              style="display:inline-block">${item.quantity}</span>
      </td>
      <td>${item.unit}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="editItem('${item.id}')">
            <span class="material-icons-round" style="font-size:16px">edit</span>
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}')">
            <span class="material-icons-round" style="font-size:16px">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function initInventorySearch() {
    document.getElementById('inventorySearch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = inventory.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q) ||
            i.id.toLowerCase().includes(q)
        );
        renderInventoryTable(filtered);
    });
}

function initInventoryModal() {
    document.getElementById('addItemBtn').addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Add New Item';
        document.getElementById('modalSaveBtn').textContent = 'Add Item';
        document.getElementById('inventoryForm').reset();
        document.getElementById('editItemId').value = '';
        document.getElementById('inventoryModal').classList.remove('hidden');
    });

    document.getElementById('inventoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('editItemId').value;
        const data = {
            name: document.getElementById('itemName').value,
            category: document.getElementById('itemCategory').value,
            unit: document.getElementById('itemUnit').value,
            price: parseFloat(document.getElementById('itemPrice').value),
            quantity: parseInt(document.getElementById('itemQty').value)
        };

        try {
            if (editId) {
                await fetch(`${API}/inventory/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                toast('Item updated successfully', 'success');
            } else {
                await fetch(`${API}/inventory`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                toast('Item added successfully', 'success');
            }
            closeInventoryModal();
            loadInventory();
        } catch (err) {
            toast('Failed to save item', 'error');
        }
    });
}

function editItem(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('modalTitle').textContent = 'Edit Item';
    document.getElementById('modalSaveBtn').textContent = 'Update Item';
    document.getElementById('editItemId').value = id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemUnit').value = item.unit;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemQty').value = item.quantity;
    document.getElementById('inventoryModal').classList.remove('hidden');
}

async function deleteItem(id) {
    if (!confirm('Delete this item from inventory?')) return;
    try {
        await fetch(`${API}/inventory/${id}`, { method: 'DELETE' });
        toast('Item deleted', 'info');
        loadInventory();
    } catch (err) {
        toast('Failed to delete item', 'error');
    }
}

function closeInventoryModal() {
    document.getElementById('inventoryModal').classList.add('hidden');
}

// ═══════════════════════════════════════
//  BILLING
// ═══════════════════════════════════════
async function loadBillingProducts() {
    try {
        const res = await fetch(`${API}/inventory`);
        inventory = await res.json();
        renderBillingProducts(inventory);
    } catch (err) {
        console.error('Billing products error:', err);
    }
}

function renderBillingProducts(items) {
    const grid = document.getElementById('billingProductGrid');
    grid.innerHTML = items.map(item => {
        let stockClass = 'in-stock';
        let stockLabel = `${item.quantity} left`;
        if (item.quantity === 0) {
            stockClass = 'out-stock';
            stockLabel = 'Out of stock';
        } else if (item.quantity <= 10) {
            stockClass = 'low-stock';
            stockLabel = `${item.quantity} left`;
        }

        return `
      <div class="product-card ${item.quantity === 0 ? 'disabled' : ''}" 
           onclick="${item.quantity > 0 ? `addToCart('${item.id}')` : ''}">
        <div class="product-card-name">${item.name}</div>
        <div class="product-card-category">${item.category}</div>
        <div class="product-card-bottom">
          <span class="product-card-price">$${Number(item.price).toFixed(2)}</span>
          <span class="product-card-stock ${stockClass}">${stockLabel}</span>
        </div>
      </div>
    `;
    }).join('');
}

function initBillingSearch() {
    document.getElementById('billingSearch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = inventory.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        );
        renderBillingProducts(filtered);
    });
}

function addToCart(id) {
    const item = inventory.find(i => i.id === id);
    if (!item || item.quantity === 0) return;

    const existing = cart.find(c => c.id === id);
    if (existing) {
        if (existing.qty >= item.quantity) {
            toast('Maximum stock reached', 'error');
            return;
        }
        existing.qty++;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: 1,
            maxQty: item.quantity
        });
        toast(`${item.name} added to cart`, 'success');
    }
    renderCart();
}

function removeFromCart(id) {
    cart = cart.filter(c => c.id !== id);
    renderCart();
}

function updateCartQty(id, delta) {
    const item = cart.find(c => c.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(id);
        return;
    }
    if (item.qty > item.maxQty) {
        item.qty = item.maxQty;
        toast('Maximum stock reached', 'error');
    }
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (cart.length === 0) {
        container.innerHTML = `
      <div class="cart-empty">
        <span class="material-icons-round">add_shopping_cart</span>
        <p>Add items to start billing</p>
      </div>`;
        checkoutBtn.disabled = true;
        updateCartTotals(0, 0, 0);
        return;
    }

    checkoutBtn.disabled = false;

    container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${item.price.toFixed(2)} ea</div>
      </div>
      <div class="cart-item-qty">
        <button onclick="updateCartQty('${item.id}', -1)">−</button>
        <span>${item.qty}</span>
        <button onclick="updateCartQty('${item.id}', 1)">+</button>
      </div>
      <span class="cart-item-total">$${(item.price * item.qty).toFixed(2)}</span>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">
        <span class="material-icons-round">close</span>
      </button>
    </div>
  `).join('');

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    updateCartTotals(subtotal, tax, total);
}

function updateCartTotals(subtotal, tax, total) {
    document.getElementById('cartSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartTax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('cartTotal').textContent = `$${total.toFixed(2)}`;
}

function initCheckout() {
    document.getElementById('checkoutBtn').addEventListener('click', checkout);
}

async function checkout() {
    if (cart.length === 0) return;

    const customerName = document.getElementById('customerName').value || 'Walk-in Customer';
    const billDate = document.getElementById('billDate').value || new Date().toISOString().slice(0, 10);

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    const bill = {
        customerName,
        date: billDate,
        items: cart.map(c => ({
            id: c.id,
            name: c.name,
            price: c.price,
            qty: c.qty,
            subtotal: c.price * c.qty
        })),
        subtotal,
        tax,
        total
    };

    try {
        const res = await fetch(`${API}/bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bill)
        });
        const result = await res.json();

        if (result.success) {
            toast('Invoice generated successfully!', 'success');
            showInvoice(result.bill);
            cart = [];
            renderCart();
            document.getElementById('customerName').value = '';
            loadBillingProducts();
        }
    } catch (err) {
        toast('Failed to generate invoice', 'error');
    }
}

// ═══════════════════════════════════════
//  INVOICE
// ═══════════════════════════════════════
function showInvoice(bill) {
    const el = document.getElementById('invoiceContent');
    el.innerHTML = `
    <div class="invoice-header">
      <h2>SmartMart POS</h2>
      <p>Premium Retail Billing System</p>
    </div>
    <div class="invoice-meta">
      <div><span>Invoice:</span> <strong>${bill.invoiceId}</strong></div>
      <div><span>Date:</span> <strong>${new Date(bill.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
      <div><span>Customer:</span> <strong>${bill.customerName}</strong></div>
      <div><span>Time:</span> <strong>${new Date(bill.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong></div>
    </div>
    <table class="invoice-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th>Price</th>
          <th>Qty</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${bill.items.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${item.name}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>${item.qty}</td>
            <td style="text-align:right;font-weight:600">$${item.subtotal.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="invoice-totals">
      <div class="row"><span>Subtotal</span><span>$${bill.subtotal.toFixed(2)}</span></div>
      <div class="row"><span>Tax (8%)</span><span>$${bill.tax.toFixed(2)}</span></div>
      <div class="row grand-total"><span>Total</span><span>$${bill.total.toFixed(2)}</span></div>
    </div>
    <div class="invoice-footer">
      <p>Thank you for shopping with SmartMart!</p>
      <p>This is a computer-generated invoice.</p>
    </div>
  `;
    document.getElementById('invoiceOverlay').classList.remove('hidden');
}

function closeInvoice() {
    document.getElementById('invoiceOverlay').classList.add('hidden');
}

// ═══════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════
async function loadHistory() {
    try {
        const res = await fetch(`${API}/bills`);
        bills = await res.json();
        renderHistory(bills);
    } catch (err) {
        console.error('History error:', err);
        toast('Failed to load history', 'error');
    }
}

function renderHistory(items) {
    const tbody = document.getElementById('historyBody');
    const empty = document.getElementById('historyEmpty');

    if (items.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    // Sort newest first
    const sorted = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    tbody.innerHTML = sorted.map(bill => `
    <tr>
      <td><span style="color:var(--primary-light);font-weight:600">${bill.invoiceId || '—'}</span></td>
      <td style="font-weight:500">${bill.customerName || 'Walk-in'}</td>
      <td>${bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
      <td>${bill.items ? bill.items.length : 0} items</td>
      <td style="font-weight:700">$${(bill.total || 0).toFixed(2)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick='viewBill(${JSON.stringify(bill).replace(/'/g, "\\'")})'>
          <span class="material-icons-round" style="font-size:16px">visibility</span> View
        </button>
      </td>
    </tr>
  `).join('');
}

function viewBill(bill) {
    showInvoice(bill);
}

function initHistoryFilters() {
    document.getElementById('historySearch').addEventListener('input', filterHistory);
    document.getElementById('historyDateFilter').addEventListener('change', filterHistory);
}

function filterHistory() {
    const q = document.getElementById('historySearch').value.toLowerCase();
    const dateVal = document.getElementById('historyDateFilter').value;

    let filtered = bills;

    if (q) {
        filtered = filtered.filter(b =>
            (b.customerName || '').toLowerCase().includes(q) ||
            (b.invoiceId || '').toLowerCase().includes(q)
        );
    }

    if (dateVal) {
        filtered = filtered.filter(b =>
            b.createdAt && b.createdAt.startsWith(dateVal)
        );
    }

    renderHistory(filtered);
}

// ═══════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════
function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info'
    };

    el.innerHTML = `
    <span class="material-icons-round">${icons[type] || 'info'}</span>
    <span>${message}</span>
  `;

    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ═══════════════════════════════════════
//  WINDOW RESIZE (Chart)
// ═══════════════════════════════════════
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (currentPage === 'dashboard') loadDashboard();
    }, 250);
});

// ═══════════════════════════════════════
//  DASHBOARD CARD DETAILS
// ═══════════════════════════════════════
function initDashboardCards() {
    document.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.detail;
            openCardDetail(type);
        });
    });

    // Close on overlay click
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDetailModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetailModal();
    });
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

async function openCardDetail(type) {
    const modal = document.getElementById('detailModal');
    const titleEl = document.getElementById('detailTitle');
    const iconEl = document.getElementById('detailIcon');
    const bodyEl = document.getElementById('detailBody');

    bodyEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner"></div><p style="margin-top:16px">Loading data…</p></div>';
    modal.classList.remove('hidden');

    try {
        if (type === 'revenue') await renderRevenueDetail(titleEl, iconEl, bodyEl);
        else if (type === 'inventory') await renderInventoryDetail(titleEl, iconEl, bodyEl);
        else if (type === 'todaySales') await renderTodaySalesDetail(titleEl, iconEl, bodyEl);
        else if (type === 'transactions') await renderTransactionsDetail(titleEl, iconEl, bodyEl);
    } catch (err) {
        bodyEl.innerHTML = '<div class="empty-state"><span class="material-icons-round">error</span><p>Failed to load data</p></div>';
        console.error('Detail modal error:', err);
    }
}

// ── 1. REVENUE DETAIL ──
async function renderRevenueDetail(titleEl, iconEl, bodyEl) {
    titleEl.textContent = 'Revenue Breakdown';
    iconEl.textContent = 'payments';

    const [billsRes, dashRes] = await Promise.all([
        fetch(`${API}/bills`), fetch(`${API}/dashboard`)
    ]);
    const allBills = await billsRes.json();
    const dash = await dashRes.json();

    // Group by date
    const byDate = {};
    allBills.forEach(b => {
        const d = b.createdAt ? b.createdAt.slice(0, 10) : 'Unknown';
        if (!byDate[d]) byDate[d] = { total: 0, count: 0 };
        byDate[d].total += (b.total || 0);
        byDate[d].count++;
    });

    const dateEntries = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
    const avgPerTx = allBills.length > 0 ? dash.totalRevenue / allBills.length : 0;

    bodyEl.innerHTML = `
        <div class="detail-summary">
            <div class="detail-summary-card">
                <span class="detail-summary-label">Total Revenue</span>
                <span class="detail-summary-value">$${dash.totalRevenue.toFixed(2)}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Total Transactions</span>
                <span class="detail-summary-value">${allBills.length}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Avg per Transaction</span>
                <span class="detail-summary-value">$${avgPerTx.toFixed(2)}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Active Days</span>
                <span class="detail-summary-value">${dateEntries.length}</span>
            </div>
        </div>
        <div class="detail-section-title"><span class="material-icons-round">calendar_today</span> Revenue by Date</div>
        ${dateEntries.length === 0 ? '<div class="empty-state"><span class="material-icons-round">payments</span><p>No revenue data yet</p></div>' : `
        <table class="detail-table">
            <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th></tr></thead>
            <tbody>${dateEntries.map(([date, data]) => `
                <tr>
                    <td style="font-weight:600">${new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>${data.count}</td>
                    <td style="font-weight:700;color:var(--primary-light)">$${data.total.toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
        </table>`}
        ${allBills.length > 0 ? `
        <div class="detail-section-title" style="margin-top:24px"><span class="material-icons-round">receipt</span> All Transactions</div>
        <table class="detail-table">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Total</th></tr></thead>
            <tbody>${[...allBills].reverse().map(b => `
                <tr>
                    <td style="color:var(--primary-light);font-weight:600">${b.invoiceId || '—'}</td>
                    <td>${b.customerName || 'Walk-in'}</td>
                    <td>${b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                    <td style="font-weight:700">$${(b.total || 0).toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
        </table>` : ''}
    `;
}

// ── 2. INVENTORY DETAIL ──
async function renderInventoryDetail(titleEl, iconEl, bodyEl) {
    titleEl.textContent = 'Full Inventory';
    iconEl.textContent = 'inventory_2';

    const res = await fetch(`${API}/inventory`);
    const items = await res.json();

    const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalValue = items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const lowStock = items.filter(i => i.quantity <= 10).length;
    const categories = [...new Set(items.map(i => i.category))].length;

    bodyEl.innerHTML = `
        <div class="detail-summary">
            <div class="detail-summary-card">
                <span class="detail-summary-label">Total Products</span>
                <span class="detail-summary-value">${items.length}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Total Units</span>
                <span class="detail-summary-value">${totalQty}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Inventory Value</span>
                <span class="detail-summary-value">$${totalValue.toFixed(2)}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Low Stock Items</span>
                <span class="detail-summary-value" style="color:var(--warning)">${lowStock}</span>
            </div>
        </div>
        <div class="detail-search-wrap">
            <div class="search-box">
                <span class="material-icons-round">search</span>
                <input type="text" id="detailInvSearch" placeholder="Search products…">
            </div>
        </div>
        <table class="detail-table" id="detailInvTable">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Qty</th><th>Value</th></tr></thead>
            <tbody id="detailInvBody"></tbody>
        </table>
    `;

    function renderInvRows(list) {
        document.getElementById('detailInvBody').innerHTML = list.map(i => `
            <tr>
                <td style="font-weight:600">${i.name}</td>
                <td style="opacity:.7">${i.category}</td>
                <td>$${Number(i.price).toFixed(2)}</td>
                <td><span class="${i.quantity <= 10 ? 'product-card-stock low-stock' : 'product-card-stock in-stock'}" style="display:inline-block">${i.quantity}</span></td>
                <td style="font-weight:600">$${(i.price * i.quantity).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    renderInvRows(items);

    document.getElementById('detailInvSearch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderInvRows(items.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)));
    });
}

// ── 3. TODAY'S SALES DETAIL ──
async function renderTodaySalesDetail(titleEl, iconEl, bodyEl) {
    titleEl.textContent = "Today's Sales Details";
    iconEl.textContent = 'today';

    const res = await fetch(`${API}/bills`);
    const allBills = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    const todayBills = allBills.filter(b => b.createdAt && b.createdAt.startsWith(today));

    const todayTotal = todayBills.reduce((s, b) => s + (b.total || 0), 0);
    const totalItemsSold = todayBills.reduce((s, b) => s + (b.items ? b.items.reduce((ss, i) => ss + i.qty, 0) : 0), 0);

    // Build sold items breakdown
    const itemMap = {};
    todayBills.forEach(b => {
        (b.items || []).forEach(it => {
            if (!itemMap[it.name]) itemMap[it.name] = { qty: 0, revenue: 0 };
            itemMap[it.name].qty += it.qty;
            itemMap[it.name].revenue += it.subtotal || (it.price * it.qty);
        });
    });
    const soldItems = Object.entries(itemMap).sort((a, b) => b[1].revenue - a[1].revenue);

    bodyEl.innerHTML = `
        <div class="detail-summary">
            <div class="detail-summary-card">
                <span class="detail-summary-label">Today's Revenue</span>
                <span class="detail-summary-value">$${todayTotal.toFixed(2)}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Transactions</span>
                <span class="detail-summary-value">${todayBills.length}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Items Sold</span>
                <span class="detail-summary-value">${totalItemsSold}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Unique Products</span>
                <span class="detail-summary-value">${soldItems.length}</span>
            </div>
        </div>
        ${soldItems.length > 0 ? `
        <div class="detail-section-title"><span class="material-icons-round">shopping_bag</span> Items Sold Today</div>
        <table class="detail-table">
            <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
            <tbody>${soldItems.map(([name, data]) => `
                <tr>
                    <td style="font-weight:600">${name}</td>
                    <td>${data.qty}</td>
                    <td style="font-weight:700;color:var(--primary-light)">$${data.revenue.toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
        </table>` : ''}
        <div class="detail-section-title" style="margin-top:24px"><span class="material-icons-round">schedule</span> Time-based Sales</div>
        ${todayBills.length === 0 ? '<div class="empty-state"><span class="material-icons-round">today</span><p>No sales today yet</p></div>' : `
        <table class="detail-table">
            <thead><tr><th>Time</th><th>Customer</th><th>Items</th><th>Total</th></tr></thead>
            <tbody>${[...todayBills].reverse().map(b => `
                <tr>
                    <td style="font-weight:600">${b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>${b.customerName || 'Walk-in'}</td>
                    <td>${b.items ? b.items.length : 0} items</td>
                    <td style="font-weight:700;color:var(--primary-light)">$${(b.total || 0).toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
        </table>`}
    `;
}

// ── 4. TRANSACTIONS DETAIL ──
async function renderTransactionsDetail(titleEl, iconEl, bodyEl) {
    titleEl.textContent = 'All Transactions';
    iconEl.textContent = 'receipt_long';

    const res = await fetch(`${API}/bills`);
    const allBills = await res.json();
    const sorted = [...allBills].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalRev = sorted.reduce((s, b) => s + (b.total || 0), 0);
    const totalItems = sorted.reduce((s, b) => s + (b.items ? b.items.length : 0), 0);
    const uniqueCustomers = new Set(sorted.map(b => b.customerName || 'Walk-in')).size;

    bodyEl.innerHTML = `
        <div class="detail-summary">
            <div class="detail-summary-card">
                <span class="detail-summary-label">Total Transactions</span>
                <span class="detail-summary-value">${sorted.length}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Total Revenue</span>
                <span class="detail-summary-value">$${totalRev.toFixed(2)}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Total Items Sold</span>
                <span class="detail-summary-value">${totalItems}</span>
            </div>
            <div class="detail-summary-card">
                <span class="detail-summary-label">Unique Customers</span>
                <span class="detail-summary-value">${uniqueCustomers}</span>
            </div>
        </div>
        <div class="detail-search-wrap">
            <div class="search-box">
                <span class="material-icons-round">search</span>
                <input type="text" id="detailTxSearch" placeholder="Search by customer or invoice…">
            </div>
        </div>
        ${sorted.length === 0 ? '<div class="empty-state"><span class="material-icons-round">receipt_long</span><p>No transactions yet</p></div>' : `
        <table class="detail-table" id="detailTxTable">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th></th></tr></thead>
            <tbody id="detailTxBody"></tbody>
        </table>`}
    `;

    if (sorted.length > 0) {
        function renderTxRows(list) {
            document.getElementById('detailTxBody').innerHTML = list.map(b => `
                <tr>
                    <td style="color:var(--primary-light);font-weight:600">${b.invoiceId || '—'}</td>
                    <td style="font-weight:500">${b.customerName || 'Walk-in'}</td>
                    <td>${b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td>${b.items ? b.items.map(i => i.name).join(', ') : '—'}</td>
                    <td style="font-weight:700">$${(b.total || 0).toFixed(2)}</td>
                    <td><button class="btn btn-ghost btn-sm" onclick='viewBill(${JSON.stringify(b).replace(/'/g, "\\\\'")})'>
                        <span class="material-icons-round" style="font-size:14px">visibility</span>
                    </button></td>
                </tr>
            `).join('');
        }

        renderTxRows(sorted);

        document.getElementById('detailTxSearch').addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            renderTxRows(sorted.filter(b =>
                (b.customerName || '').toLowerCase().includes(q) ||
                (b.invoiceId || '').toLowerCase().includes(q)
            ));
        });
    }
}
