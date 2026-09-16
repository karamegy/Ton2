import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const googleProvider = new GoogleAuthProvider();

// 1. تفعيل التخزين والمزامنة غير المتصلة (Offline-First Architecture)
enableIndexedDbPersistence(db).catch(() => {});

// 2. محرك الترجمة متعدد اللغات (i18n Engine)
const translations = {
  ar: {
    login: "تسجيل الدخول", register: "حساب جديد", googleAuth: "متابعة بواسطة Google",
    or: "أو", email: "البريد الإلكتروني", password: "كلمة المرور", loginBtn: "دخول التطبيق",
    storeName: "اسم النشاط / الشركة", registerBtn: "إنشاء حساب تلقائي مجاني", logout: "تسجيل الخروج",
    accountDisabled: "⚠️ الحساب معطل من قبل الإدارة",
    accountDisabledDesc: "تم تعطيل رخصة هذا الحساب. يرجى التواصل مع Admin Master (haretg@gmail.com).",
    tabInvoices: "🧾 الفواتير", tabProducts: "📦 المخزن", tabClients: "👥 العملاء", tabExpenses: "💸 الخزينة",
    totalSales: "إجمالي المبيعات", netProfit: "صافي الأرباح", expenses: "المصروفات", invoiceCount: "عدد الفواتير",
    newInvoice: "فاتورة مبيعات جديدة", invNo: "رقم الفاتورة:", clientName: "اسم العميل / الشركة",
    clientPhone: "رقم الهاتف (للواتساب)", itemTitle: "الصنف / الخدمة", qtyTitle: "الكمية", priceTitle: "السعر",
    subtotalTitle: "الإجمالي", addItem: "+ إضافة صنف جديد", subtotal: "المجموع الفرعي:", discount: "الخصم:",
    tax: "الضريبة (%):", payStatus: "حالة الدفع:", grandTotal: "الإجمالي النهائي:", saveInv: "حفظ الفاتورة",
    sendWhatsApp: "واتساب 💬", print: "طباعة 🖨️", invHistory: "سجل الفواتير السحابي", addProduct: "إضافة منتج للمخزن",
    pName: "اسم المنتج", pPrice: "سعر البيع", pCost: "سعر التكلفة", pStock: "الكمية بالمخزن", saveProduct: "حفظ المنتج",
    productList: "قائمة المنتجات المخزنة", clientDb: "سجل العملاء والمديونيات", addExpense: "تسجيل مصروف جديد",
    expTitle: "بند المصروف", expAmount: "المبلغ", saveExpense: "تسجيل المصروف", expList: "سجل المصروفات",
    previewTitle: "👁️ معاينة الفاتورة الإلكترونية", downloadImg: "تحميل كصورة 🖼️", settingsTitle: "⚙️ إعدادات المنشأة والعملة",
    theme: "مظهر التطبيق", currency: "العملة الرئيسية", vatNo: "الرقم الضريبي للمنشأة (VAT)", logo: "شعار الشركة", address: "العنوان", saveSettings: "حفظ التغييرات السحابية"
  },
  en: {
    login: "Sign In", register: "Register", googleAuth: "Continue with Google",
    or: "OR", email: "Email Address", password: "Password", loginBtn: "Access App",
    storeName: "Business Name", registerBtn: "Create Free Instant Account", logout: "Sign Out",
    accountDisabled: "⚠️ Account Disabled by Admin",
    accountDisabledDesc: "This license has been suspended. Contact Admin Master (haretg@gmail.com).",
    tabInvoices: "🧾 Invoices", tabProducts: "📦 Inventory", tabClients: "👥 Clients", tabExpenses: "💸 Expenses",
    totalSales: "Total Sales", netProfit: "Net Profit", expenses: "Expenses", invoiceCount: "Total Invoices",
    newInvoice: "New Sales Invoice", invNo: "Invoice #:", clientName: "Client / Company Name",
    clientPhone: "Client Phone (WhatsApp)", itemTitle: "Item / Service", qtyTitle: "Qty", priceTitle: "Price",
    subtotalTitle: "Total", addItem: "+ Add Item", subtotal: "Subtotal:", discount: "Discount:",
    tax: "VAT (%):", payStatus: "Payment Status:", grandTotal: "Grand Total:", saveInv: "Save Invoice",
    sendWhatsApp: "WhatsApp 💬", print: "Print 🖨️", invHistory: "Cloud Invoice Logs", addProduct: "Add Product",
    pName: "Product Name", pPrice: "Selling Price", pCost: "Cost Price", pStock: "Stock Quantity", saveProduct: "Save Product",
    productList: "Stocked Items", clientDb: "Client Accounts", addExpense: "Add Expense",
    expTitle: "Expense Category", expAmount: "Amount", saveExpense: "Record Expense", expList: "Expense Log",
    previewTitle: "👁️ E-Invoice Preview", downloadImg: "Download Image 🖼️", settingsTitle: "⚙️ Enterprise Settings",
    theme: "UI Theme", currency: "Base Currency", vatNo: "VAT Number", logo: "Company Logo", address: "Address", saveSettings: "Save Cloud Settings"
  }
};

let currentLang = localStorage.getItem('app_lang') || 'ar';

function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('app_lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

document.getElementById('toggle-lang-btn').addEventListener('click', () => applyLanguage(currentLang === 'ar' ? 'en' : 'ar'));
document.getElementById('auth-lang-btn').addEventListener('click', () => applyLanguage(currentLang === 'ar' ? 'en' : 'ar'));

// 3. خوارزمية تشفير الفاتورة الإلكترونية ZATCA / ETA TLV Base64
function generateZatcaTlvBase64(sellerName, vatNo, timeStamp, totalAmount, vatAmount) {
  function getTlvTag(tag, value) {
    const encoder = new TextEncoder();
    const valBytes = encoder.encode(value);
    const buf = new Uint8Array(2 + valBytes.length);
    buf[0] = tag;
    buf[1] = valBytes.length;
    buf.set(valBytes, 2);
    return buf;
  }

  const tag1 = getTlvTag(1, sellerName || "Store");
  const tag2 = getTlvTag(2, vatNo || "000000000000000");
  const tag3 = getTlvTag(3, timeStamp || new Date().toISOString());
  const tag4 = getTlvTag(4, totalAmount.toFixed(2));
  const tag5 = getTlvTag(5, vatAmount.toFixed(2));

  const combined = new Uint8Array(tag1.length + tag2.length + tag3.length + tag4.length + tag5.length);
  let offset = 0;
  [tag1, tag2, tag3, tag4, tag5].forEach(tag => {
    combined.set(tag, offset);
    offset += tag.length;
  });

  let binary = '';
  combined.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function renderQrCode(containerId, dataText) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (typeof QRCode !== 'undefined' && dataText) {
    new QRCode(container, {
      text: dataText,
      width: 90,
      height: 90,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

// 4. عناصر الواجهة الأساسية
const loginScreen = document.getElementById('login-screen');
const lockScreen = document.getElementById('lock-screen');
const mainApp = document.getElementById('main-app');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

let currentUser = null;
let invoicesDB = [];
let productsDB = [];
let expensesDB = [];
let storeProfile = { name: "نظام إدارة الأعمال", phone: "01000000000", address: "", currency: "ج.م", vatNo: "", logo: "" };
let activeUnsubscribers = [];

document.getElementById('tab-login-btn').addEventListener('click', () => {
  document.getElementById('tab-login-btn').classList.add('active');
  document.getElementById('tab-register-btn').classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  clearAuthMsgs();
});

document.getElementById('tab-register-btn').addEventListener('click', () => {
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

// 5. إدارة الجلسات ومراقبة التراخيص الفورية
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    loginScreen.classList.add('hidden');
    const isAdmin = user.email === 'haretg@gmail.com';
    document.getElementById('user-uid-tag').textContent = `UID: ${user.uid} ${isAdmin ? ' (ADMIN MASTER)' : ''}`;
    
    // فحص رخصة المستخدم تلقائياً
    const userRef = doc(db, "licenses", user.uid);
    const docSnap = await getDoc(userRef);

    // إنشاء الرخصة المفعلة تلقائياً مجاناً إذا لم تكن موجودة
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        storeName: user.displayName || "نشاط تجاري مجاني",
        isActive: true,
        role: isAdmin ? "admin_master" : "user",
        createdAt: new Date().toISOString()
      });
    }

    onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists() && snapshot.data().isActive === true) {
        lockScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        attachCloudRealtimeSync(user.uid);
      } else {
        mainApp.classList.add('hidden');
        lockScreen.classList.remove('hidden');
        detachCloudSync();
      }
    });
  } else {
    currentUser = null;
    detachCloudSync();
    mainApp.classList.add('hidden');
    lockScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }
});

function attachCloudRealtimeSync(uid) {
  detachCloudSync();

  const unsubProfile = onSnapshot(doc(db, "users", uid, "data", "profile"), (snap) => {
    if (snap.exists()) {
      storeProfile = { ...storeProfile, ...snap.data() };
      updateHeaderUI();
    }
  });

  const unsubInvoices = onSnapshot(doc(db, "users", uid, "data", "invoices"), (snap) => {
    invoicesDB = snap.exists() ? snap.data().list || [] : [];
    renderAllModules();
  });

  const unsubProducts = onSnapshot(doc(db, "users", uid, "data", "products"), (snap) => {
    productsDB = snap.exists() ? snap.data().list || [] : [];
    renderAllModules();
  });

  const unsubExpenses = onSnapshot(doc(db, "users", uid, "data", "expenses"), (snap) => {
    expensesDB = snap.exists() ? snap.data().list || [] : [];
    renderAllModules();
  });

  activeUnsubscribers = [unsubProfile, unsubInvoices, unsubProducts, unsubExpenses];
}

function detachCloudSync() {
  activeUnsubscribers.forEach(unsub => unsub());
  activeUnsubscribers = [];
}

async function syncDocToCloud(docName, payload) {
  if (!currentUser) return;
  await setDoc(doc(db, "users", currentUser.uid, "data", docName), payload);
}

// تسجيل الدخول بالبريد
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthMsgs();
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('login-email').value.trim(), document.getElementById('login-password').value.trim());
  } catch (err) {
    authError.textContent = "بيانات الدخول غير صحيحة";
    authError.classList.remove('hidden');
  }
});

// تسجيل الدخول بواسطة Google مع التفعيل المجاني التلقائي
document.getElementById('google-login-btn').addEventListener('click', async () => {
  clearAuthMsgs();
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const u = result.user;
    const userRef = doc(db, "licenses", u.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        email: u.email,
        storeName: u.displayName || "نشاط جديد",
        isActive: true,
        role: u.email === 'haretg@gmail.com' ? "admin_master" : "user",
        createdAt: new Date().toISOString()
      });
    }
  } catch (err) {
    authError.textContent = "تعذر تسجيل الدخول بواسطة Google";
    authError.classList.remove('hidden');
  }
});

// إنشاء حساب جديد وتفعيله مجاناً وبشكل فوري
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthMsgs();
  const storeName = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "licenses", cred.user.uid), {
      email: email,
      storeName: storeName,
      isActive: true,
      role: email === 'haretg@gmail.com' ? "admin_master" : "user",
      createdAt: new Date().toISOString()
    });
    authSuccess.textContent = "تم إنشاء وتفعيل حسابك المجاني بنجاح!";
    authSuccess.classList.remove('hidden');
  } catch (err) {
    authError.textContent = err.message.includes('email-already-in-use') ? "البريد مستخدم بالفعل" : "خطأ في التسجيل";
    authError.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('logout-lock-btn').addEventListener('click', () => signOut(auth));

// 6. إدارة التبويبات والمظهر
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

// 7. محرك الفواتير والحسابات
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
  datalist.innerHTML = productsDB.map(p => `<option value="${p.name}">${p.price} ${storeProfile.currency}</option>`).join('');
}

function renderItemsTable() {
  itemsBody.innerHTML = activeItems.map((item, index) => `
    <tr class="item-row">
      <td class="col-name">
        <label class="mobile-label">${translations[currentLang].itemTitle}</label>
        <input type="text" list="products-datalist" value="${item.name}" placeholder="اسم الصنف" onchange="onItemNameChange(${index}, this.value)">
      </td>
      <td class="col-qty">
        <label class="mobile-label">${translations[currentLang].qtyTitle}</label>
        <input type="number" value="${item.qty}" min="1" onchange="updateItem(${index}, 'qty', this.value)">
      </td>
      <td class="col-price">
        <label class="mobile-label">${translations[currentLang].priceTitle}</label>
        <input type="number" value="${item.price}" min="0" step="0.5" onchange="updateItem(${index}, 'price', this.value)">
      </td>
      <td class="col-total">
        <span class="mobile-label">${translations[currentLang].subtotalTitle}:</span>
        <span class="total-amount">${(item.qty * item.price).toFixed(2)} ${storeProfile.currency}</span>
      </td>
      <td class="col-action">
        <button type="button" class="btn-remove" onclick="removeItem(${index})" title="حذف">✕</button>
      </td>
    </tr>
  `).join('');
  calculateTotals();
}

window.onItemNameChange = (index, val) => {
  activeItems[index].name = val;
  const matchedProd = productsDB.find(p => p.name === val);
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
  return { subtotal, discount, taxPercent, taxAmount, grandTotal };
}

discountInput.addEventListener('input', calculateTotals);
taxInput.addEventListener('input', calculateTotals);

async function saveInvoiceData() {
  const clientName = document.getElementById('client-name').value.trim();
  if (!clientName) { alert('يرجى إدخال اسم العميل'); return null; }
  if (activeItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return null; }

  const totals = calculateTotals();
  const isoTime = new Date().toISOString();
  
  const zatcaBase64 = generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, isoTime, totals.grandTotal, totals.taxAmount);

  const invoice = {
    id: nextInvNum,
    client: clientName,
    phone: document.getElementById('client-phone').value.trim(),
    status: document.getElementById('payment-status-select').value,
    items: [...activeItems],
    ...totals,
    date: new Date().toLocaleDateString('ar-EG'),
    isoTime: isoTime,
    zatcaQr: zatcaBase64
  };

  invoicesDB.unshift(invoice);
  await syncDocToCloud('invoices', { list: invoicesDB });

  nextInvNum++;
  localStorage.setItem('last_inv_num', nextInvNum.toString());
  invNumberDisplay.textContent = `#${nextInvNum}`;

  resetForm();
  renderAllModules();
  return invoice;
}

document.getElementById('save-btn').addEventListener('click', async () => {
  const inv = await saveInvoiceData();
  if (inv) alert('تم حفظ الفاتورة سحابياً بنجاح');
});

// 8. ميزات المعاينة، الطباعة والواتساب
function sendWhatsApp(inv) {
  let phone = inv.phone.replace(/[^0-9]/g, '');
  if (!phone) { alert('يرجى كتابة رقم الهاتف لإرسال الفاتورة عبر واتساب'); return; }
  if (!phone.startsWith('20') && phone.length === 11) phone = '2' + phone;

  let msg = `*${storeProfile.name}*\n`;
  msg += `🧾 *فاتورة مبيعات إلكترونية رقم:* #${inv.id}\n`;
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

document.getElementById('whatsapp-btn').addEventListener('click', async () => {
  const inv = await saveInvoiceData();
  if (inv) sendWhatsApp(inv);
});

let currentActiveInvoiceForPreview = null;

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
  document.getElementById('v-store-vat').textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';
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

  renderQrCode('preview-qrcode', inv.zatcaQr || generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, inv.isoTime || new Date().toISOString(), inv.grandTotal, inv.taxAmount || 0));

  document.getElementById('view-modal').classList.remove('hidden');
}

document.getElementById('close-view-btn').addEventListener('click', () => {
  document.getElementById('view-modal').classList.add('hidden');
});

document.getElementById('download-img-btn').addEventListener('click', () => {
  const previewCard = document.getElementById('invoice-card-preview');
  html2canvas(previewCard, { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = `E-Invoice_${currentActiveInvoiceForPreview ? currentActiveInvoiceForPreview.id : Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});

document.getElementById('print-view-btn').addEventListener('click', () => {
  if (currentActiveInvoiceForPreview) printInvoice(currentActiveInvoiceForPreview);
});

document.getElementById('print-btn').addEventListener('click', async () => {
  const inv = await saveInvoiceData();
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
  document.getElementById('p-store-vat').textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';
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

  renderQrCode('print-qrcode', inv.zatcaQr || generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, inv.isoTime || new Date().toISOString(), inv.grandTotal, inv.taxAmount || 0));

  window.print();
}

function resetForm() {
  document.getElementById('client-name').value = '';
  document.getElementById('client-phone').value = '';
  activeItems = [];
  discountInput.value = 0;
  taxInput.value = 14;
  document.getElementById('add-item-btn').click();
}

// 9. وحدة الإدارة والعرض السحابي
function renderSavedInvoices(filter = '') {
  const container = document.getElementById('invoices-container');
  const filtered = invoicesDB.filter(inv => inv.client.toLowerCase().includes(filter.toLowerCase()) || inv.id.toString().includes(filter) || inv.phone.includes(filter));

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
  const inv = invoicesDB.find(i => i.id === id);
  if (inv) openInvoicePreview(inv);
};

window.sendWhatsAppById = (id) => {
  const inv = invoicesDB.find(i => i.id === id);
  if (inv) sendWhatsApp(inv);
};

window.reprintInvoice = (id) => {
  const inv = invoicesDB.find(i => i.id === id);
  if (inv) printInvoice(inv);
};

window.deleteInvoice = async (id) => {
  if (!confirm('تأكيد حذف الفاتورة؟')) return;
  invoicesDB = invoicesDB.filter(i => i.id !== id);
  await syncDocToCloud('invoices', { list: invoicesDB });
};

document.getElementById('search-input').addEventListener('input', (e) => renderSavedInvoices(e.target.value));

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('p-name').value;
  const price = parseFloat(document.getElementById('p-price').value) || 0;
  const cost = parseFloat(document.getElementById('p-cost').value) || 0;
  const stock = parseInt(document.getElementById('p-stock').value) || 0;

  productsDB.push({ id: Date.now(), name, price, cost, stock });
  await syncDocToCloud('products', { list: productsDB });
  e.target.reset();
});

function renderProducts() {
  const container = document.getElementById('products-list-container');
  container.innerHTML = productsDB.map((p, idx) => `
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

window.deleteProduct = async (idx) => {
  productsDB.splice(idx, 1);
  await syncDocToCloud('products', { list: productsDB });
};

function renderClients() {
  const clientsMap = {};

  invoicesDB.forEach(inv => {
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

document.getElementById('expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('exp-title').value;
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;

  expensesDB.push({ id: Date.now(), title, amount, date: new Date().toLocaleDateString('ar-EG') });
  await syncDocToCloud('expenses', { list: expensesDB });
  e.target.reset();
});

function renderExpenses() {
  const container = document.getElementById('expenses-list-container');
  container.innerHTML = expensesDB.map((exp, idx) => `
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

window.deleteExpense = async (idx) => {
  expensesDB.splice(idx, 1);
  await syncDocToCloud('expenses', { list: expensesDB });
};

function updateDashboardStats() {
  const totalSales = invoicesDB.reduce((acc, i) => acc + i.grandTotal, 0);
  const totalExpensesAmount = expensesDB.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalSales - totalExpensesAmount;

  document.getElementById('stat-total-sales').textContent = `${totalSales.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('stat-expenses').textContent = `${totalExpensesAmount.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('stat-net-profit').textContent = `${netProfit.toFixed(2)} ${storeProfile.currency}`;
  document.getElementById('stat-count').textContent = invoicesDB.length;
}

document.getElementById('export-json-btn').addEventListener('click', () => {
  const data = { invoices: invoicesDB, products: productsDB, expenses: expensesDB, storeProfile };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_cloud_${Date.now()}.json`;
  a.click();
});

document.getElementById('export-csv-btn').addEventListener('click', () => {
  let csv = 'رقم الفاتورة,العميل,الهاتف,الحالة,التاريخ,الإجمالي\n';
  invoicesDB.forEach(inv => {
    csv += `${inv.id},"${inv.client}","${inv.phone}",${inv.status},${inv.date},${inv.grandTotal}\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.href = URL.createObjectURL(blob);
  a.download = `sales_report_${Date.now()}.csv`;
  a.click();
});

const settingsModal = document.getElementById('settings-modal');
document.getElementById('open-settings-btn').addEventListener('click', () => {
  document.getElementById('theme-select').value = localStorage.getItem('app_theme') || 'dark';
  document.getElementById('currency-select').value = storeProfile.currency || 'ج.م';
  document.getElementById('store-name-input').value = storeProfile.name;
  document.getElementById('store-phone-input').value = storeProfile.phone;
  document.getElementById('store-vat-input').value = storeProfile.vatNo || '';
  document.getElementById('store-address-input').value = storeProfile.address;
  settingsModal.classList.remove('hidden');
});

document.getElementById('close-settings-btn').addEventListener('click', () => settingsModal.classList.add('hidden'));

document.getElementById('save-settings-btn').addEventListener('click', () => {
  applyTheme(document.getElementById('theme-select').value);

  const logoInput = document.getElementById('store-logo-input');
  
  const saveProfileData = async (logoBase64) => {
    storeProfile = {
      name: document.getElementById('store-name-input').value || "نظام إدارة الأعمال",
      phone: document.getElementById('store-phone-input').value,
      vatNo: document.getElementById('store-vat-input').value.trim(),
      address: document.getElementById('store-address-input').value,
      currency: document.getElementById('currency-select').value || "ج.م",
      logo: logoBase64 !== null ? logoBase64 : storeProfile.logo
    };
    await syncDocToCloud('profile', storeProfile);
    updateHeaderUI();
    renderAllModules();
    settingsModal.classList.add('hidden');
  };

  if (logoInput.files && logoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) { saveProfileData(e.target.result); };
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

applyTheme(localStorage.getItem('app_theme') || 'dark');
applyLanguage(currentLang);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

updateHeaderUI();
document.getElementById('add-item-btn').click();
