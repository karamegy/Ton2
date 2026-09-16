import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. إعدادات Firebase ونظام التحكم بالحساب (Kill-Switch)
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

// المراقبة اللحظية لصلاحية الاستخدام من Firestore
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

// 2. حالة الفاتورة الحالية والعناصر
let activeItems = [];
const itemsBody = document.getElementById('items-body');
const addItemBtn = document.getElementById('add-item-btn');
const discountInput = document.getElementById('discount-input');
const taxInput = document.getElementById('tax-input');
const subtotalDisplay = document.getElementById('subtotal-val');
const grandTotalDisplay = document.getElementById('grand-total-val');
const invNumberDisplay = document.getElementById('inv-number-display');

// توليد رقم الفاتورة التلقائي
let nextInvNum = parseInt(localStorage.getItem('last_inv_num') || '1001');
invNumberDisplay.textContent = `#${nextInvNum}`;

// 3. إدارة جدول الأصناف المباشر
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

// 4. حساب المجموع والخصم والضريبة
function calculateTotals() {
  const subtotal = activeItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const discount = parseFloat(discountInput.value) || 0;
  const taxPercent = parseFloat(taxInput.value) || 0;
  
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = afterDiscount * (taxPercent / 100);
  const grandTotal = afterDiscount + taxAmount;

  subtotalDisplay.textContent = `${subtotal.toFixed(2)} ج.م`;
  grandTotalDisplay.textContent = `${grandTotal.toFixed(2)} ج.م`;
  return { subtotal, discount, taxPercent, grandTotal };
}

discountInput.addEventListener('input', calculateTotals);
taxInput.addEventListener('input', calculateTotals);

// 5. حفظ وطباعة الفاتورة
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
  return invoice;
}

document.getElementById('save-btn').addEventListener('click', () => {
  if (saveInvoiceData()) alert('تم حفظ الفاتورة بنجاح محلياً');
});

document.getElementById('print-btn').addEventListener('click', () => {
  const inv = saveInvoiceData();
  if (!inv) return;

  document.getElementById('p-inv-id').textContent = `رقم الفاتورة: #${inv.id}`;
  document.getElementById('p-date').textContent = `التاريخ: ${inv.date}`;
  document.getElementById('p-client-name').textContent = inv.client;
  document.getElementById('p-client-phone').textContent = inv.phone || '-';
  document.getElementById('p-subtotal').textContent = `${inv.subtotal.toFixed(2)} ج.م`;
  document.getElementById('p-discount').textContent = `${inv.discount.toFixed(2)} ج.م`;
  document.getElementById('p-tax').textContent = `${inv.taxPercent}%`;
  document.getElementById('p-total').textContent = `${inv.grandTotal.toFixed(2)} ج.م`;

  document.getElementById('p-items-body').innerHTML = inv.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>${(item.qty * item.price).toFixed(2)}</td>
    </tr>
  `).join('');

  window.print();
});

function resetForm() {
  document.getElementById('client-name').value = '';
  document.getElementById('client-phone').value = '';
  activeItems = [];
  discountInput.value = 0;
  taxInput.value = 0;
  addItemBtn.click();
}

// 6. عرض وسجل الفواتير المحفوظة والبحث
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
      </div>
      <strong style="color:#38bdf8">${inv.grandTotal.toFixed(2)} ج.م</strong>
    </li>
  `).join('');
}

document.getElementById('search-input').addEventListener('input', (e) => {
  renderSavedInvoices(e.target.value);
});

// تسجيل Service Worker للعمل أوفلاين
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// التشغيل المبدئي
addItemBtn.click();
renderSavedInvoices();
