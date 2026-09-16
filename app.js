import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. Firebase License Check (Kill Switch)
const firebaseConfig = {
  apiKey: "AIzaSyDqFZjs7m93mB5XsnO_bAQV49O7g2FQkZc",
  authDomain: "giti-68750.firebaseapp.com",
  projectId: "giti-68750",
  storageBucket: "giti-68750.firebasestorage.app",
  messagingSenderId: "753885709520",
  appId: "1:753885709520:web:eda57cd4efdb5c4ef48ad5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const DEVICE_ID = localStorage.getItem('device_id') || 'USER_DEVICE_001';
localStorage.setItem('device_id', DEVICE_ID);

const lockScreen = document.getElementById('lock-screen');
const statusBadge = document.getElementById('account-status');

onSnapshot(doc(db, "licenses", DEVICE_ID), (snapshot) => {
  if (snapshot.exists() && snapshot.data().isActive === true) {
    lockScreen.classList.add('hidden');
    statusBadge.textContent = "الحساب مفعل";
    statusBadge.style.background = "#22c55e";
  } else {
    lockScreen.classList.remove('hidden');
    statusBadge.textContent = "الحساب معطل";
    statusBadge.style.background = "#ef4444";
  }
});

// 2. إعدادات النشاط التجاري (Store Settings)
let storeProfile = JSON.parse(localStorage.getItem('store_profile') || JSON.stringify({
  name: "نظام الفواتير الذكي",
  phone: "إدارة الفواتير محلياً",
  address: "",
  currency: "ج.م"
}));

function updateHeaderUI() {
  document.getElementById('header-store-name').textContent = storeProfile.name;
  document.getElementById('header-store-phone').textContent = storeProfile.phone;
}

// 3. حالة عناصر الفاتورة والحسابات
let activeItems = [];
const itemsBody = document.getElementById('items-body');
const addItemBtn = document.getElementById('add-item-btn');
const discountInput = document.getElementById('discount-input');
const taxInput = document.getElementById('tax-input');
const subtotalDisplay = document.getElementById('subtotal-val');
const grandTotalDisplay = document.getElementById('grand-total-val');
const invNumberDisplay = document.getElementById('inv-number-display');

let nextInvNum = parseInt(localStorage.getItem('last_inv_num') || '1001');
invNumberDisplay.textContent = `#${nextInvNum}`;

function renderItemsTable() {
  itemsBody.innerHTML = activeItems.map((item, index) => `
    <tr>
      <td><input type="text" value="${item.name}" placeholder="اسم الصنف" onchange="updateItem(${index}, 'name', this.value)"></td>
      <td><input type="number" value="${item.qty}" min="1" onchange="updateItem(${index}, 'qty', this.value)"></td>
      <td><input type="number" value="${item.price}" min="0" step="0.5" onchange="updateItem(${index}, 'price', this.value)"></td>
      <td><strong>${(item.qty * item.price).toFixed(2)}</strong></td>
      <td><button type="button" class="btn-remove" onclick="removeItem(${index})">✕</button></td>
    </tr>
  `).join('');
  calculateTotals();
}

window.updateItem = (index, key, val) => {
  activeItems[index][key] = key === 'name' ? val : parseFloat(val) || 0;
  renderItemsTable();
};

window.removeItem = (index) => {
  activeItems.splice(index, 1);
  renderItemsTable();
};

addItemBtn.addEventListener('click', () => {
  activeItems.push({ name: '', qty: 1, price: 0 });
  renderItemsTable();
});

function calculateTotals() {
  const subtotal = activeItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const discount = parseFloat(discountInput.value) || 0;
  const taxPercent = parseFloat(taxInput.value) || 0;
  
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = afterDiscount * (taxPercent / 100);
  const grandTotal = afterDiscount + taxAmount;

  subtotalDisplay.textContent = `${subtotal.toFixed(2)} ${storeProfile.currency}`;
  grandTotalDisplay.textContent = `${grandTotal.toFixed(2)} ${storeProfile.currency}`;
  return { subtotal, discount, taxPercent, grandTotal };
}

discountInput.addEventListener('input', calculateTotals);
taxInput.addEventListener('input', calculateTotals);

// 4. حفظ وإدارة الفواتير
function saveInvoiceData() {
  const clientName = document.getElementById('client-name').value.trim();
  if (!clientName) { alert('يرجى إدخال اسم العميل'); return null; }
  if (activeItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return null; }

  const totals = calculateTotals();
  const invoice = {
    id: nextInvNum,
    client: clientName,
    phone: document.getElementById('client-phone').value,
    items: [...activeItems],
    ...totals,
    date: new Date().toLocaleDateString('ar-EG')
  };

  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  invoices.unshift(invoice);
  localStorage.setItem('invoices_db', JSON.stringify(invoices));

  nextInvNum++;
  localStorage.setItem('last_inv_num', nextInvNum.toString());
  invNumberDisplay.textContent = `#${nextInvNum}`;

  resetForm();
  renderSavedInvoices();
  updateDashboardStats();
  return invoice;
}

document.getElementById('save-btn').addEventListener('click', () => {
  if (saveInvoiceData()) alert('تم حفظ الفاتورة بنجاح محلياً');
});

document.getElementById('print-btn').addEventListener('click', () => {
  const inv = saveInvoiceData();
  if (inv) printInvoice(inv);
});

function printInvoice(inv) {
  document.getElementById('p-store-name').textContent = storeProfile.name;
  document.getElementById('p-store-phone').textContent = storeProfile.phone;
  document.getElementById('p-store-address').textContent = storeProfile.address;
  document.getElementById('p-inv-id').textContent = `رقم الفاتورة: #${inv.id}`;
  document.getElementById('p-date').textContent = `التاريخ: ${inv.date}`;
  document.getElementById('p-client-name').textContent = inv.client;
  document.getElementById('p-client-phone').textContent = inv.phone || '-';
  document.getElementById('p-subtotal').textContent = `${inv.subtotal.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('p-discount').textContent = `${inv.discount.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('p-tax').textContent = `${inv.taxPercent}%`;
  document.getElementById('p-total').textContent = `${inv.grandTotal.toFixed(2)} ${storeProfile.currency}`;

  document.getElementById('p-items-body').innerHTML = inv.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>${(item.qty * item.price).toFixed(2)}</td>
    </tr>
  `).join('');

  window.print();
}

function resetForm() {
  document.getElementById('client-name').value = '';
  document.getElementById('client-phone').value = '';
  activeItems = [];
  discountInput.value = 0;
  taxInput.value = 0;
  addItemBtn.click();
}

// 5. سجل الفواتير، البحث، والحذف
function renderSavedInvoices(filter = '') {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const container = document.getElementById('invoices-container');
  
  const filtered = invoices.filter(inv => 
    inv.client.toLowerCase().includes(filter.toLowerCase()) || 
    inv.id.toString().includes(filter)
  );

  container.innerHTML = filtered.map(inv => `
    <li>
      <div>
        <strong>#${inv.id} - ${inv.client}</strong>
        <br><small style="color:#94a3b8">${inv.date} • ${inv.items.length} أصناف</small>
        <div class="inv-actions">
          <button class="btn-sm" onclick="reprintInvoice(${inv.id})">🖨️ طباعة</button>
          <button class="btn-sm" style="color:#ef4444" onclick="deleteInvoice(${inv.id})">🗑️ حذف</button>
        </div>
      </div>
      <strong style="color:#38bdf8">${inv.grandTotal.toFixed(2)} ${storeProfile.currency}</strong>
    </li>
  `).join('');
}

window.reprintInvoice = (id) => {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const inv = invoices.find(i => i.id === id);
  if (inv) printInvoice(inv);
};

window.deleteInvoice = (id) => {
  if (!confirm('هل أنت تأكد من حذف هذه الفاتورة؟')) return;
  let invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  invoices = invoices.filter(i => i.id !== id);
  localStorage.setItem('invoices_db', JSON.stringify(invoices));
  renderSavedInvoices();
  updateDashboardStats();
};

document.getElementById('search-input').addEventListener('input', (e) => {
  renderSavedInvoices(e.target.value);
});

// 6. الإحصائيات (Stats Dashboard)
function updateDashboardStats() {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const totalSales = invoices.reduce((acc, i) => acc + i.grandTotal, 0);
  const count = invoices.length;
  const avg = count > 0 ? totalSales / count : 0;

  document.getElementById('stat-total-sales').textContent = `${totalSales.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('stat-count').textContent = count;
  document.getElementById('stat-avg').textContent = `${avg.toFixed(2)} ${storeProfile.currency}`;
}

// 7. النسخ الاحتياطي وتصدير CSV
document.getElementById('export-json-btn').addEventListener('click', () => {
  const invoices = localStorage.getItem('invoices_db') || '[]';
  const blob = new Blob([invoices], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `invoices_backup_${Date.now()}.json`;
  a.click();
});

document.getElementById('export-csv-btn').addEventListener('click', () => {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  let csv = 'رقم الفاتورة,العميل,الهاتف,التاريخ,الإجمالي\n';
  invoices.forEach(inv => {
    csv += `${inv.id},"${inv.client}","${inv.phone}",${inv.date},${inv.grandTotal}\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sales_report_${Date.now()}.csv`;
  a.click();
});

// 8. إدارة الإعدادات (Modal)
const settingsModal = document.getElementById('settings-modal');
document.getElementById('open-settings-btn').addEventListener('click', () => {
  document.getElementById('store-name-input').value = storeProfile.name;
  document.getElementById('store-phone-input').value = storeProfile.phone;
  document.getElementById('store-address-input').value = storeProfile.address;
  document.getElementById('currency-symbol-input').value = storeProfile.currency;
  settingsModal.classList.remove('hidden');
});

document.getElementById('close-settings-btn').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

document.getElementById('save-settings-btn').addEventListener('click', () => {
  storeProfile = {
    name: document.getElementById('store-name-input').value || "نظام الفواتير الذكي",
    phone: document.getElementById('store-phone-input').value,
    address: document.getElementById('store-address-input').value,
    currency: document.getElementById('currency-symbol-input').value || "ج.م"
  };
  localStorage.setItem('store_profile', JSON.stringify(storeProfile));
  updateHeaderUI();
  calculateTotals();
  renderSavedInvoices();
  updateDashboardStats();
  settingsModal.classList.add('hidden');
});

// تسجيل PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// البدء الأول
updateHeaderUI();
addItemBtn.click();
renderSavedInvoices();
updateDashboardStats();
