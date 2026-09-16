import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const auth = getAuth(app);

const loginScreen = document.getElementById('login-screen');
const lockScreen = document.getElementById('lock-screen');
const mainApp = document.getElementById('main-app');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

// 1. إدارة تبويبات الدخول والتسجيل
document.getElementById('tab-login-btn').addEventListener('click', (e) => {
  document.getElementById('tab-login-btn').classList.add('active');
  document.getElementById('tab-register-btn').classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  clearAuthMsgs();
});

document.getElementById('tab-register-btn').addEventListener('click', (e) => {
  document.getElementById('tab-register-btn').classList.add('active');
  document.getElementById('tab-login-btn').classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  clearAuthMsgs();
});

function clearAuthMsgs() {
  authError.classList.add('hidden');
  authSuccess.classList.add('hidden');
}

// 2. معالجة التسجيل الحقيقي للحساب وإلغاء ثغرة المعرف الموحد
let licenseUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.classList.add('hidden');
    document.getElementById('user-uid-tag').textContent = `كود الحساب (UID): ${user.uid}`;
    
    // مراقبة ترخيص UID الخاص بالمستخدم مباشرة لمنع الاختراق
    if (licenseUnsubscribe) licenseUnsubscribe();
    licenseUnsubscribe = onSnapshot(doc(db, "licenses", user.uid), (snapshot) => {
      if (snapshot.exists() && snapshot.data().isActive === true) {
        lockScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
      } else {
        mainApp.classList.add('hidden');
        lockScreen.classList.remove('hidden');
      }
    });

  } else {
    if (licenseUnsubscribe) licenseUnsubscribe();
    mainApp.classList.add('hidden');
    lockScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }
});

// نموذج الدخول
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthMsgs();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    authError.textContent = "بيانات الدخول غير صحيحة";
    authError.classList.remove('hidden');
  }
});

// نموذج إنشاء حساب جديد (يتم إخضاع الحساب لانتظار التفعيل آلياً)
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthMsgs();
  const storeName = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // تسجيل بيانات المستخدم في Firestore بـ (isActive: false) حتى يفعله الأدمن
    await setDoc(doc(db, "licenses", cred.user.uid), {
      email: email,
      storeName: storeName,
      isActive: false,
      createdAt: new Date().toISOString()
    });
    
    authSuccess.textContent = "تم إنشاء الحساب بنجاح! بانتظار تفعيل الأدمن.";
    authSuccess.classList.remove('hidden');
  } catch (err) {
    authError.textContent = err.message.includes('email-already-in-use') ? "البريد مستخدم بالفعل" : "خطأ في إنشاء الحساب";
    authError.classList.remove('hidden');
  }
});

// تسجيل الخروج
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('logout-lock-btn').addEventListener('click', () => signOut(auth));

// 3. إدارة التبويبات والمظهر
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('app_theme', themeName);
}

// 4. قاعدة البيانات المحلية والنظام
let storeProfile = JSON.parse(localStorage.getItem('store_profile') || JSON.stringify({
  name: "نظام إدارة الأعمال",
  phone: "01000000000",
  address: "",
  currency: "ج.م",
  logo: ""
}));
let products = JSON.parse(localStorage.getItem('products_db') || '[]');
let expenses = JSON.parse(localStorage.getItem('expenses_db') || '[]');
let currentActiveInvoiceForPreview = null;

function updateHeaderUI() {
  document.getElementById('header-store-name').textContent = storeProfile.name;
  document.getElementById('header-store-phone').textContent = storeProfile.phone;
  
  const headerLogo = document.getElementById('header-logo');
  if (storeProfile.logo) {
    headerLogo.src = storeProfile.logo;
    headerLogo.classList.remove('hidden');
  } else {
    headerLogo.classList.add('hidden');
  }
}

// 5. إدارة الفواتير
let activeItems = [];
const itemsBody = document.getElementById('items-body');
const discountInput = document.getElementById('discount-input');
const taxInput = document.getElementById('tax-input');
const subtotalDisplay = document.getElementById('subtotal-val');
const grandTotalDisplay = document.getElementById('grand-total-val');
const invNumberDisplay = document.getElementById('inv-number-display');

let nextInvNum = parseInt(localStorage.getItem('last_inv_num') || '1001');
invNumberDisplay.textContent = `#${nextInvNum}`;

function updateProductsDatalist() {
  const datalist = document.getElementById('products-datalist');
  datalist.innerHTML = products.map(p => `<option value="${p.name}">${p.price} ${storeProfile.currency}</option>`).join('');
}

function renderItemsTable() {
  itemsBody.innerHTML = activeItems.map((item, index) => `
    <tr>
      <td><input type="text" list="products-datalist" value="${item.name}" placeholder="اسم الصنف" onchange="onItemNameChange(${index}, this.value)"></td>
      <td><input type="number" value="${item.qty}" min="1" onchange="updateItem(${index}, 'qty', this.value)"></td>
      <td><input type="number" value="${item.price}" min="0" step="0.5" onchange="updateItem(${index}, 'price', this.value)"></td>
      <td><strong>${(item.qty * item.price).toFixed(2)}</strong></td>
      <td><button type="button" class="btn-remove" onclick="removeItem(${index})">✕</button></td>
    </tr>
  `).join('');
  calculateTotals();
}

window.onItemNameChange = (index, val) => {
  activeItems[index].name = val;
  const matchedProd = products.find(p => p.name === val);
  if (matchedProd) activeItems[index].price = matchedProd.price;
  renderItemsTable();
};

window.updateItem = (index, key, val) => {
  activeItems[index][key] = key === 'name' ? val : parseFloat(val) || 0;
  renderItemsTable();
};

window.removeItem = (index) => {
  activeItems.splice(index, 1);
  renderItemsTable();
};

document.getElementById('add-item-btn').addEventListener('click', () => {
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

function saveInvoiceData() {
  const clientName = document.getElementById('client-name').value.trim();
  if (!clientName) { alert('يرجى إدخال اسم العميل'); return null; }
  if (activeItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return null; }

  const totals = calculateTotals();
  const invoice = {
    id: nextInvNum,
    client: clientName,
    phone: document.getElementById('client-phone').value.trim(),
    status: document.getElementById('payment-status-select').value,
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
  renderAllModules();
  return invoice;
}

document.getElementById('save-btn').addEventListener('click', () => {
  const inv = saveInvoiceData();
  if (inv) alert('تم حفظ الفاتورة بنجاح');
});

// 6. الميزات (واتساب، معاينة، صور)
function sendWhatsApp(inv) {
  let phone = inv.phone.replace(/[^0-9]/g, '');
  if (!phone) { alert('يرجى كتابة رقم الهاتف لإرسال الفاتورة عبر واتساب'); return; }
  if (!phone.startsWith('20') && phone.length === 11) phone = '2' + phone;

  let msg = `*${storeProfile.name}*\n`;
  msg += `🧾 *فاتورة مبيعات رقم:* #${inv.id}\n`;
  msg += `👤 *العميل:* ${inv.client}\n`;
  msg += `📅 *التاريخ:* ${inv.date}\n`;
  msg += `-----------------------------------\n`;
  inv.items.forEach(i => {
    msg += `• ${i.name} (×${i.qty}) = ${(i.qty * i.price).toFixed(2)} ${storeProfile.currency}\n`;
  });
  msg += `-----------------------------------\n`;
  msg += `💰 *الإجمالي النهائي:* ${inv.grandTotal.toFixed(2)} ${storeProfile.currency}\n`;
  msg += `📌 *حالة الدفع:* ${inv.status}\n\n`;
  msg += `شكراً لتعاملكم معنا!`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

document.getElementById('whatsapp-btn').addEventListener('click', () => {
  const inv = saveInvoiceData();
  if (inv) sendWhatsApp(inv);
});

function openInvoicePreview(inv) {
  currentActiveInvoiceForPreview = inv;
  const vLogo = document.getElementById('v-logo');
  if (storeProfile.logo) {
    vLogo.src = storeProfile.logo;
    vLogo.classList.remove('hidden');
  } else {
    vLogo.classList.add('hidden');
  }

  document.getElementById('v-store-name').textContent = storeProfile.name;
  document.getElementById('v-store-phone').textContent = storeProfile.phone;
  document.getElementById('v-store-address').textContent = storeProfile.address;
  document.getElementById('v-inv-id').textContent = `رقم الفاتورة: #${inv.id}`;
  document.getElementById('v-date').textContent = `التاريخ: ${inv.date}`;
  document.getElementById('v-client-name').textContent = inv.client;
  document.getElementById('v-client-phone').textContent = inv.phone || '-';
  document.getElementById('v-payment-status').textContent = inv.status;
  document.getElementById('v-subtotal').textContent = `${inv.subtotal.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('v-discount').textContent = `${inv.discount.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('v-tax').textContent = `${inv.taxPercent}%`;
  document.getElementById('v-total').textContent = `${inv.grandTotal.toFixed(2)} ${storeProfile.currency}`;

  document.getElementById('v-items-body').innerHTML = inv.items.map(item => `
    <tr><td>${item.name}</td><td>${item.qty}</td><td>${item.price.toFixed(2)}</td><td>${(item.qty * item.price).toFixed(2)}</td></tr>
  `).join('');

  document.getElementById('view-modal').classList.remove('hidden');
}

document.getElementById('close-view-btn').addEventListener('click', () => {
  document.getElementById('view-modal').classList.add('hidden');
});

document.getElementById('download-img-btn').addEventListener('click', () => {
  const previewCard = document.getElementById('invoice-card-preview');
  html2canvas(previewCard, { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Invoice_${currentActiveInvoiceForPreview ? currentActiveInvoiceForPreview.id : Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});

document.getElementById('print-view-btn').addEventListener('click', () => {
  if (currentActiveInvoiceForPreview) printInvoice(currentActiveInvoiceForPreview);
});

document.getElementById('print-btn').addEventListener('click', () => {
  const inv = saveInvoiceData();
  if (inv) printInvoice(inv);
});

function printInvoice(inv) {
  const printLogo = document.getElementById('p-logo');
  if (storeProfile.logo) {
    printLogo.src = storeProfile.logo;
    printLogo.classList.remove('hidden');
  } else {
    printLogo.classList.add('hidden');
  }

  document.getElementById('p-store-name').textContent = storeProfile.name;
  document.getElementById('p-store-phone').textContent = storeProfile.phone;
  document.getElementById('p-store-address').textContent = storeProfile.address;
  document.getElementById('p-inv-id').textContent = `رقم الفاتورة: #${inv.id}`;
  document.getElementById('p-date').textContent = `التاريخ: ${inv.date}`;
  document.getElementById('p-client-name').textContent = inv.client;
  document.getElementById('p-client-phone').textContent = inv.phone || '-';
  document.getElementById('p-payment-status').textContent = inv.status;
  document.getElementById('p-subtotal').textContent = `${inv.subtotal.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('p-discount').textContent = `${inv.discount.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('p-tax').textContent = `${inv.taxPercent}%`;
  document.getElementById('p-total').textContent = `${inv.grandTotal.toFixed(2)} ${storeProfile.currency}`;

  document.getElementById('p-items-body').innerHTML = inv.items.map(item => `
    <tr><td>${item.name}</td><td>${item.qty}</td><td>${item.price.toFixed(2)}</td><td>${(item.qty * item.price).toFixed(2)}</td></tr>
  `).join('');
  window.print();
}

function resetForm() {
  document.getElementById('client-name').value = '';
  document.getElementById('client-phone').value = '';
  activeItems = [];
  discountInput.value = 0;
  taxInput.value = 0;
  document.getElementById('add-item-btn').click();
}

// 7. عرض باقي البيانات والإعدادات
function renderSavedInvoices(filter = '') {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const container = document.getElementById('invoices-container');
  const filtered = invoices.filter(inv => inv.client.toLowerCase().includes(filter.toLowerCase()) || inv.id.toString().includes(filter) || inv.phone.includes(filter));

  container.innerHTML = filtered.map(inv => `
    <li>
      <div>
        <strong>#${inv.id} - ${inv.client}</strong> (${inv.status})
        <br><small style="color:var(--text-muted)">${inv.date} • ${inv.items.length} أصناف</small>
        <div class="inv-actions">
          <button class="btn-sm" style="background:var(--accent); color:#0f172a" onclick='viewInvoiceById(${inv.id})'>👁️ معاينة</button>
          <button class="btn-sm" style="background:#25d366; color:#fff" onclick='sendWhatsAppById(${inv.id})'>💬 واتساب</button>
          <button class="btn-sm" onclick="reprintInvoice(${inv.id})">🖨️ طباعة</button>
          <button class="btn-sm" style="color:var(--danger)" onclick="deleteInvoice(${inv.id})">🗑️</button>
        </div>
      </div>
      <strong style="color:var(--accent)">${inv.grandTotal.toFixed(2)} ${storeProfile.currency}</strong>
    </li>
  `).join('');
}

window.viewInvoiceById = (id) => {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const inv = invoices.find(i => i.id === id);
  if (inv) openInvoicePreview(inv);
};

window.sendWhatsAppById = (id) => {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const inv = invoices.find(i => i.id === id);
  if (inv) sendWhatsApp(inv);
};

window.reprintInvoice = (id) => {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const inv = invoices.find(i => i.id === id);
  if (inv) printInvoice(inv);
};

window.deleteInvoice = (id) => {
  if (!confirm('تأكيد حذف الفاتورة؟')) return;
  let invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  invoices = invoices.filter(i => i.id !== id);
  localStorage.setItem('invoices_db', JSON.stringify(invoices));
  renderAllModules();
};

document.getElementById('search-input').addEventListener('input', (e) => renderSavedInvoices(e.target.value));

document.getElementById('product-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('p-name').value;
  const price = parseFloat(document.getElementById('p-price').value) || 0;
  const cost = parseFloat(document.getElementById('p-cost').value) || 0;
  const stock = parseInt(document.getElementById('p-stock').value) || 0;

  products.push({ id: Date.now(), name, price, cost, stock });
  localStorage.setItem('products_db', JSON.stringify(products));
  e.target.reset();
  renderProducts();
  updateProductsDatalist();
});

function renderProducts() {
  const container = document.getElementById('products-list-container');
  container.innerHTML = products.map((p, idx) => `
    <li>
      <div>
        <strong>${p.name}</strong>
        <br><small style="color:var(--text-muted)">التكلفة: ${p.cost} ${storeProfile.currency} | المخزون: ${p.stock}</small>
      </div>
      <div>
        <strong style="color:var(--success)">${p.price} ${storeProfile.currency}</strong>
        <button class="btn-sm" style="color:var(--danger); margin-right:8px;" onclick="deleteProduct(${idx})">🗑️</button>
      </div>
    </li>
  `).join('');
}

window.deleteProduct = (idx) => {
  products.splice(idx, 1);
  localStorage.setItem('products_db', JSON.stringify(products));
  renderProducts();
  updateProductsDatalist();
};

function renderClients() {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const clientsMap = {};

  invoices.forEach(inv => {
    if (!clientsMap[inv.client]) clientsMap[inv.client] = { phone: inv.phone, totalPurchases: 0, unpaid: 0 };
    clientsMap[inv.client].totalPurchases += inv.grandTotal;
    if (inv.status !== 'مدفوعة') clientsMap[inv.client].unpaid += inv.grandTotal;
  });

  const container = document.getElementById('clients-list-container');
  const datalist = document.getElementById('clients-datalist');

  datalist.innerHTML = Object.keys(clientsMap).map(c => `<option value="${c}">${clientsMap[c].phone}</option>`).join('');
  container.innerHTML = Object.keys(clientsMap).map(cName => `
    <li>
      <div>
        <strong>👤 ${cName}</strong> (${clientsMap[cName].phone || 'بدون هاتف'})
        <br><small style="color:var(--text-muted)">إجمالي التعاملات: ${clientsMap[cName].totalPurchases.toFixed(2)} ${storeProfile.currency}</small>
      </div>
      <div>
        <span style="color:${clientsMap[cName].unpaid > 0 ? 'var(--danger)' : 'var(--success)'}">
          ${clientsMap[cName].unpaid > 0 ? `مستحق: ${clientsMap[cName].unpaid.toFixed(2)}` : 'خالي المديونية'}
        </span>
      </div>
    </li>
  `).join('');
}

document.getElementById('expense-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('exp-title').value;
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;

  expenses.push({ id: Date.now(), title, amount, date: new Date().toLocaleDateString('ar-EG') });
  localStorage.setItem('expenses_db', JSON.stringify(expenses));
  e.target.reset();
  renderExpenses();
  updateDashboardStats();
});

function renderExpenses() {
  const container = document.getElementById('expenses-list-container');
  container.innerHTML = expenses.map((exp, idx) => `
    <li>
      <div>
        <strong>${exp.title}</strong>
        <br><small style="color:var(--text-muted)">${exp.date}</small>
      </div>
      <div>
        <strong style="color:var(--danger)">-${exp.amount.toFixed(2)} ${storeProfile.currency}</strong>
        <button class="btn-sm" style="color:var(--danger); margin-right:8px;" onclick="deleteExpense(${idx})">🗑️</button>
      </div>
    </li>
  `).join('');
}

window.deleteExpense = (idx) => {
  expenses.splice(idx, 1);
  localStorage.setItem('expenses_db', JSON.stringify(expenses));
  renderExpenses();
  updateDashboardStats();
};

function updateDashboardStats() {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  const totalSales = invoices.reduce((acc, i) => acc + i.grandTotal, 0);
  const totalExpensesAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalSales - totalExpensesAmount;

  document.getElementById('stat-total-sales').textContent = `${totalSales.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('stat-expenses').textContent = `${totalExpensesAmount.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('stat-net-profit').textContent = `${netProfit.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('stat-count').textContent = invoices.length;
}

document.getElementById('export-json-btn').addEventListener('click', () => {
  const data = { invoices: JSON.parse(localStorage.getItem('invoices_db') || '[]'), products, expenses, storeProfile };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_${Date.now()}.json`;
  a.click();
});

document.getElementById('export-csv-btn').addEventListener('click', () => {
  const invoices = JSON.parse(localStorage.getItem('invoices_db') || '[]');
  let csv = 'رقم الفاتورة,العميل,الهاتف,الحالة,التاريخ,الإجمالي\n';
  invoices.forEach(inv => {
    csv += `${inv.id},"${inv.client}","${inv.phone}",${inv.status},${inv.date},${inv.grandTotal}\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sales_report_${Date.now()}.csv`;
  a.click();
});

const settingsModal = document.getElementById('settings-modal');
document.getElementById('open-settings-btn').addEventListener('click', () => {
  document.getElementById('theme-select').value = localStorage.getItem('app_theme') || 'dark';
  document.getElementById('store-name-input').value = storeProfile.name;
  document.getElementById('store-phone-input').value = storeProfile.phone;
  document.getElementById('store-address-input').value = storeProfile.address;
  document.getElementById('currency-symbol-input').value = storeProfile.currency;
  settingsModal.classList.remove('hidden');
});

document.getElementById('close-settings-btn').addEventListener('click', () => settingsModal.classList.add('hidden'));

document.getElementById('save-settings-btn').addEventListener('click', () => {
  const selectedTheme = document.getElementById('theme-select').value;
  applyTheme(selectedTheme);

  const logoInput = document.getElementById('store-logo-input');
  
  const saveProfileData = (logoBase64) => {
    storeProfile = {
      name: document.getElementById('store-name-input').value || "نظام إدارة الأعمال",
      phone: document.getElementById('store-phone-input').value,
      address: document.getElementById('store-address-input').value,
      currency: document.getElementById('currency-symbol-input').value || "ج.م",
      logo: logoBase64 !== null ? logoBase64 : storeProfile.logo
    };
    localStorage.setItem('store_profile', JSON.stringify(storeProfile));
    updateHeaderUI();
    renderAllModules();
    settingsModal.classList.add('hidden');
  };

  if (logoInput.files && logoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      saveProfileData(e.target.result);
    };
    reader.readAsDataURL(logoInput.files[0]);
  } else {
    saveProfileData(null);
  }
});

function renderAllModules() {
  renderSavedInvoices();
  renderProducts();
  renderClients();
  renderExpenses();
  updateProductsDatalist();
  updateDashboardStats();
}

const savedTheme = localStorage.getItem('app_theme') || 'dark';
applyTheme(savedTheme);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

updateHeaderUI();
document.getElementById('add-item-btn').click();
renderAllModules();
