import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, 
  signOut, onAuthStateChanged 
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

enableIndexedDbPersistence(db).catch(() => {});

// دالة تفعيل الإعلانات المحسّنة والمؤمنة
function triggerAds() {
  setTimeout(() => {
    try {
      const adElements = document.querySelectorAll('.adsbygoogle');
      adElements.forEach(ad => {
        if (!ad.getAttribute('data-adsbygoogle-status')) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      });
    } catch (e) {
      console.warn("AdSense Trigger Error:", e);
    }
  }, 300);
}

const translations = {
  ar: {
    login: "تسجيل الدخول", register: "حساب جديد", googleAuth: "متابعة بواسطة Google",
    or: "أو", email: "البريد الإلكتروني", password: "كلمة المرور", loginBtn: "دخول التطبيق",
    storeName: "اسم النشاط / الشركة", registerBtn: "إنشاء حساب مجاني", logout: "تسجيل الخروج",
    accountDisabled: "⚠️ الحساب معطل من قبل الإدارة",
    accountDisabledDesc: "تم تعطيل رخصة هذا الحساب. يرجى التواصل مع Admin Master (haretg@gmail.com).",
    tabInvoices: "🧾 الفواتير الحية", tabProducts: "📦 المخزن", tabClients: "👥 العملاء والدفاتر", tabExpenses: "💸 الخزينة",
    totalSales: "إجمالي المبيعات", netProfit: "صافي الأرباح", expenses: "المصروفات", invoiceCount: "عدد الفواتير",
    newInvoice: "فاتورة مبيعات جديدة", invNo: "رقم الفاتورة:", clientName: "اسم العميل / الشركة",
    clientPhone: "رقم الهاتف (للواتساب)", itemTitle: "الصنف / الخدمة", qtyTitle: "الكمية", priceTitle: "السعر",
    subtotalTitle: "الإجمالي", addItem: "+ إضافة صنف جديد", subtotal: "المجموع الفرعي:", discount: "الخصم:",
    tax: "الضريبة (%):", payStatus: "حالة الدفع:", grandTotal: "الإجمالي النهائي:", saveInv: "حفظ وتسجيل الفاتورة",
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
    tabInvoices: "🧾 Live Invoices", tabProducts: "📦 Inventory", tabClients: "👥 Clients & Ledger", tabExpenses: "💸 Expenses",
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

const toggleLangBtn = document.getElementById('toggle-lang-btn');
if (toggleLangBtn) toggleLangBtn.addEventListener('click', () => applyLanguage(currentLang === 'ar' ? 'en' : 'ar'));

const authLangBtn = document.getElementById('auth-lang-btn');
if (authLangBtn) authLangBtn.addEventListener('click', () => applyLanguage(currentLang === 'ar' ? 'en' : 'ar'));

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

  const tag1 = getTlvTag(1, sellerName ? sellerName : "Store");
  const tag2 = getTlvTag(2, vatNo ? vatNo : "000000000000000");
  const tag3 = getTlvTag(3, timeStamp ? timeStamp : new Date().toISOString());
  const tag4 = getTlvTag(4, (totalAmount ? totalAmount : 0).toFixed(2));
  const tag5 = getTlvTag(5, (vatAmount ? vatAmount : 0).toFixed(2));

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
  if (!container) return;
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

const loginScreen = document.getElementById('login-screen');
const lockScreen = document.getElementById('lock-screen');
const mainApp = document.getElementById('main-app');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

let currentUser = null;
let invoicesDB = [];
let clientsDB = [];
let productsDB = [];
let expensesDB = [];
let storeProfile = { name: "GITI Enterprise ERP", phone: "01000000000", address: "", currency: "ج.م", vatNo: "", logo: "" };
let activeUnsubscribers = [];
let activeItems = [];
let activeLedgerClientName = null;
let editingInvoiceId = null;

const privacyModal = document.getElementById('privacy-modal');
const openPrivacyAuthBtn = document.getElementById('open-privacy-auth-btn');
if (openPrivacyAuthBtn) openPrivacyAuthBtn.addEventListener('click', () => { if (privacyModal) privacyModal.classList.remove('hidden'); });

const openPrivacySettingsBtn = document.getElementById('open-privacy-settings-btn');
if (openPrivacySettingsBtn) openPrivacySettingsBtn.addEventListener('click', () => {
  const settingsModalEl = document.getElementById('settings-modal');
  if (settingsModalEl) settingsModalEl.classList.add('hidden');
  if (privacyModal) privacyModal.classList.remove('hidden');
});

const closePrivacyBtn = document.getElementById('close-privacy-btn');
if (closePrivacyBtn) closePrivacyBtn.addEventListener('click', () => { if (privacyModal) privacyModal.classList.add('hidden'); });

const acceptPrivacyBtn = document.getElementById('accept-privacy-btn');
if (acceptPrivacyBtn) acceptPrivacyBtn.addEventListener('click', () => { if (privacyModal) privacyModal.classList.add('hidden'); });

const tabLoginBtn = document.getElementById('tab-login-btn');
if (tabLoginBtn) {
  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    const tabRegBtn = document.getElementById('tab-register-btn');
    if (tabRegBtn) tabRegBtn.classList.remove('active');
    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    clearAuthMsgs();
  });
}

const tabRegisterBtn = document.getElementById('tab-register-btn');
if (tabRegisterBtn) {
  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    const tabLogBtn = document.getElementById('tab-login-btn');
    if (tabLogBtn) tabLogBtn.classList.remove('active');
    if (registerForm) registerForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    clearAuthMsgs();
  });
}

function clearAuthMsgs() {
  if (authError) authError.classList.add('hidden');
  if (authSuccess) authSuccess.classList.add('hidden');
}

getRedirectResult(auth).then(async (result) => {
  if (result && result.user) {
    const u = result.user;
    const userRef = doc(db, "licenses", u.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        email: u.email,
        storeName: u.displayName ? u.displayName : "نشاط جديد",
        isActive: true,
        role: u.email === 'haretg@gmail.com' ? "admin_master" : "user",
        createdAt: new Date().toISOString()
      });
    }
  }
}).catch((err) => {
  console.error("Redirect Error:", err);
  if (authError) {
    authError.textContent = `تعذر تسجيل الدخول: (${err.code ? err.code : err.message})`;
    authError.classList.remove('hidden');
  }
});

onAuthStateChanged(auth, async (user) => {
  const adminBtn = document.getElementById('admin-btn');

  if (user) {
    currentUser = user;
    if (loginScreen) loginScreen.classList.add('hidden');
    
    const isAdmin = user.email === 'haretg@gmail.com';
    
    if (adminBtn) {
      if (isAdmin) {
        adminBtn.classList.remove('hidden');
      } else {
        adminBtn.classList.add('hidden');
      }
    }

    const userUidTag = document.getElementById('user-uid-tag');
    if (userUidTag) userUidTag.textContent = `UID: ${user.uid} ${isAdmin ? ' (ADMIN MASTER)' : ''}`;
    
    const userRef = doc(db, "licenses", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        storeName: user.displayName ? user.displayName : "نشاط تجاري جديد",
        isActive: true,
        role: isAdmin ? "admin_master" : "user",
        createdAt: new Date().toISOString()
      });
    }

    onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists() && snapshot.data().isActive === true) {
        if (lockScreen) lockScreen.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');
        attachCloudRealtimeSync(user.uid);
        triggerAds();
      } else {
        if (mainApp) mainApp.classList.add('hidden');
        if (lockScreen) lockScreen.classList.remove('hidden');
        detachCloudSync();
      }
    });
  } else {
    currentUser = null;
    
    if (adminBtn) {
      adminBtn.classList.add('hidden');
    }

    detachCloudSync();
    if (mainApp) mainApp.classList.add('hidden');
    if (lockScreen) lockScreen.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
  }
});

function attachCloudRealtimeSync(uid) {
  detachCloudSync();

  const unsubProfile = onSnapshot(doc(db, "users", uid, "data", "profile"), (snap) => {
    if (snap.exists()) {
      storeProfile = Object.assign({}, storeProfile, snap.data());
      updateHeaderUI();
    }
  });

  const unsubInvoices = onSnapshot(doc(db, "users", uid, "data", "invoices"), (snap) => {
    invoicesDB = snap.exists() && snap.data().list ? snap.data().list : [];
    renderAllModules();
  });

  const unsubClients = onSnapshot(doc(db, "users", uid, "data", "clients"), (snap) => {
    clientsDB = snap.exists() && snap.data().list ? snap.data().list : [];
    renderAllModules();
  });

  const unsubProducts = onSnapshot(doc(db, "users", uid, "data", "products"), (snap) => {
    productsDB = snap.exists() && snap.data().list ? snap.data().list : [];
    renderAllModules();
  });

  const unsubExpenses = onSnapshot(doc(db, "users", uid, "data", "expenses"), (snap) => {
    expensesDB = snap.exists() && snap.data().list ? snap.data().list : [];
    renderAllModules();
  });

  activeUnsubscribers = [unsubProfile, unsubInvoices, unsubClients, unsubProducts, unsubExpenses];
}

function detachCloudSync() {
  activeUnsubscribers.forEach(unsub => unsub());
  activeUnsubscribers = [];
}

async function syncDocToCloud(docName, payload) {
  if (!currentUser) return;
  await setDoc(doc(db, "users", currentUser.uid, "data", docName), payload);
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthMsgs();
    try {
      const emailEl = document.getElementById('login-email');
      const passEl = document.getElementById('login-password');
      await signInWithEmailAndPassword(auth, emailEl ? emailEl.value.trim() : '', passEl ? passEl.value.trim() : '');
    } catch (err) {
      if (authError) {
        authError.textContent = "بيانات الدخول غير صحيحة";
        authError.classList.remove('hidden');
      }
    }
  });
}

const googleLoginBtn = document.getElementById('google-login-btn');
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    clearAuthMsgs();
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const u = result.user;
      const userRef = doc(db, "licenses", u.uid);
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        await setDoc(userRef, {
          email: u.email,
          storeName: u.displayName ? u.displayName : "نشاط جديد",
          isActive: true,
          role: u.email === 'haretg@gmail.com' ? "admin_master" : "user",
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || /Android|iPhone/i.test(navigator.userAgent)) {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr) {
          if (authError) {
            authError.textContent = `خطأ: ${redirectErr.code}`;
            authError.classList.remove('hidden');
          }
        }
      } else {
        if (authError) {
          authError.textContent = `تعذر تسجيل الدخول بواسطة Google (${err.code ? err.code : 'خطأ غير معروف'})`;
          authError.classList.remove('hidden');
        }
      }
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthMsgs();
    const regNameEl = document.getElementById('reg-name');
    const regEmailEl = document.getElementById('reg-email');
    const regPassEl = document.getElementById('reg-password');
    const storeName = regNameEl ? regNameEl.value.trim() : '';
    const email = regEmailEl ? regEmailEl.value.trim() : '';
    const password = regPassEl ? regPassEl.value.trim() : '';

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "licenses", cred.user.uid), {
        email: email,
        storeName: storeName,
        isActive: true,
        role: email === 'haretg@gmail.com' ? "admin_master" : "user",
        createdAt: new Date().toISOString()
      });
      if (authSuccess) {
        authSuccess.textContent = "تم إنشاء وتفعيل حسابك المجاني بنجاح!";
        authSuccess.classList.remove('hidden');
      }
    } catch (err) {
      if (authError) {
        authError.textContent = err.message.includes('email-already-in-use') ? "البريد مستخدم بالفعل" : "خطأ في التسجيل";
        authError.classList.remove('hidden');
      }
    }
  });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));

const logoutLockBtn = document.getElementById('logout-lock-btn');
if (logoutLockBtn) logoutLockBtn.addEventListener('click', () => signOut(auth));

document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const targetTab = document.getElementById(`tab-${tab.dataset.tab}`);
    if (targetTab) targetTab.classList.add('active');
  });
});

function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('app_theme', themeName);
}

function updateHeaderUI() {
  const storeNameEl = document.getElementById('header-store-name');
  if (storeNameEl) storeNameEl.textContent = storeProfile.name;

  const storePhoneEl = document.getElementById('header-store-phone');
  if (storePhoneEl) storePhoneEl.textContent = storeProfile.phone;

  const currencyTagEl = document.getElementById('currency-tag-display');
  if (currencyTagEl) currencyTagEl.textContent = storeProfile.currency ? storeProfile.currency : 'ج.م';
  
  const headerLogo = document.getElementById('header-logo');
  if (headerLogo) {
    if (storeProfile.logo) {
      headerLogo.src = storeProfile.logo;
      headerLogo.classList.remove('hidden');
    } else {
      headerLogo.classList.add('hidden');
    }
  }
}

const itemsBody = document.getElementById('items-body');
const discountInput = document.getElementById('discount-input');
const taxInput = document.getElementById('tax-input');
const subtotalDisplay = document.getElementById('subtotal-val');
const grandTotalDisplay = document.getElementById('grand-total-val');
const invNumberDisplay = document.getElementById('inv-number-display');

let nextInvNum = parseInt(localStorage.getItem('last_inv_num') ? localStorage.getItem('last_inv_num') : '1001');
if (invNumberDisplay) invNumberDisplay.textContent = `#${nextInvNum}`;

const clientInput = document.getElementById('client-name');
const clientPhoneInput = document.getElementById('client-phone');
const clientSuggestions = document.getElementById('client-suggestions');

function showClientDropdown(filter = '') {
  if (!clientSuggestions) return;
  const val = filter.trim().toLowerCase();
  const filtered = val === '' ? clientsDB : clientsDB.filter(c => c.name.toLowerCase().includes(val) || (c.phone && c.phone.includes(val)));
  
  if (filtered.length === 0) {
    clientSuggestions.classList.add('hidden');
    clientSuggestions.innerHTML = '';
    return;
  }

  clientSuggestions.innerHTML = filtered.map(c => `
    <div class="suggestion-item" onmousedown="event.preventDefault(); window.selectClientItem('${c.name.replace(/'/g, "\\'")}', '${c.phone ? c.phone : ''}')" ontouchstart="window.selectClientItem('${c.name.replace(/'/g, "\\'")}', '${c.phone ? c.phone : ''}')">
      <strong>👤 ${c.name}</strong>
      <small style="color:var(--text-muted); display:block;">${c.phone ? c.phone : 'بدون رقم هاتف'}</small>
    </div>
  `).join('');
  clientSuggestions.classList.remove('hidden');
}

if (clientInput) {
  clientInput.addEventListener('input', (e) => {
    const val = e.target.value;
    const matchedClient = clientsDB.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
    if (matchedClient && matchedClient.phone && clientPhoneInput) {
      clientPhoneInput.value = matchedClient.phone;
    }
    showClientDropdown(val);
  });

  clientInput.addEventListener('focus', () => showClientDropdown(clientInput.value));
  clientInput.addEventListener('click', () => showClientDropdown(clientInput.value));
}

window.selectClientItem = (name, phone) => {
  if (clientInput) clientInput.value = name;
  if (phone && clientPhoneInput) clientPhoneInput.value = phone;
  setTimeout(() => {
    if (clientSuggestions) {
      clientSuggestions.classList.add('hidden');
      clientSuggestions.innerHTML = '';
    }
  }, 100);
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-wrapper')) {
    document.querySelectorAll('.autocomplete-dropdown').forEach(el => el.classList.add('hidden'));
  }
});

function renderItemsTable() {
  if (!itemsBody) return;
  itemsBody.innerHTML = activeItems.map((item, index) => `
    <tr>
      <td>
        <div class="autocomplete-wrapper">
          <input type="text" autocomplete="off" value="${item.name ? item.name : ''}" placeholder="أدخل أو اختر الصنف" 
                 oninput="window.handleItemInput(${index}, this.value)" 
                 onfocus="window.handleItemFocus(${index}, this.value)" 
                 onclick="window.handleItemFocus(${index}, this.value)">
          <div class="autocomplete-dropdown hidden" id="item-suggestions-${index}"></div>
        </div>
      </td>
      <td>
        <input type="number" value="${item.qty ? item.qty : 1}" min="1" oninput="window.updateItem(${index}, 'qty', this.value)">
      </td>
      <td>
        <input type="number" value="${item.price ? item.price : 0}" min="0" step="0.5" oninput="window.updateItem(${index}, 'price', this.value)">
      </td>
      <td>
        <span class="item-total-text">${(((item.qty ? item.qty : 0)) * ((item.price ? item.price : 0))).toFixed(2)}</span>
      </td>
      <td>
        <button type="button" class="btn-remove" onclick="window.removeItem(${index})" title="حذف البند">✕</button>
      </td>
    </tr>
  `).join('');
  calculateTotals();
}

function showItemDropdown(index, val) {
  const sugBox = document.getElementById(`item-suggestions-${index}`);
  if (!sugBox) return;

  const query = val.trim().toLowerCase();
  const filteredProds = query === '' ? productsDB : productsDB.filter(p => p.name.toLowerCase().includes(query));

  if (filteredProds.length === 0) {
    sugBox.classList.add('hidden');
    sugBox.innerHTML = '';
    return;
  }

  sugBox.innerHTML = filteredProds.map(p => `
    <div class="suggestion-item" onmousedown="event.preventDefault(); window.selectProductItem(${index}, '${p.name.replace(/'/g, "\\'")}', ${p.price})" ontouchstart="window.selectProductItem(${index}, '${p.name.replace(/'/g, "\\'")}', ${p.price})">
      <strong>📦 ${p.name}</strong>
      <span style="color:var(--success); font-weight:700; float:left;">${p.price} ${storeProfile.currency}</span>
    </div>
  `).join('');
  sugBox.classList.remove('hidden');
}

window.handleItemInput = (index, val) => {
  if (activeItems[index]) activeItems[index].name = val;
  const matchedProd = productsDB.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
  if (matchedProd && activeItems[index]) {
    activeItems[index].price = matchedProd.price;
    if (itemsBody) {
      const rows = itemsBody.querySelectorAll('tr');
      if (rows[index]) {
        const priceInput = rows[index].querySelectorAll('input')[2];
        if (priceInput) priceInput.value = matchedProd.price;
      }
    }
  }
  calculateTotals();
  
  if (itemsBody) {
    const rows = itemsBody.querySelectorAll('tr');
    if (rows[index]) {
      const totalSpan = rows[index].querySelector('.item-total-text');
      if (totalSpan && activeItems[index]) {
        totalSpan.textContent = (((activeItems[index].qty ? activeItems[index].qty : 0)) * ((activeItems[index].price ? activeItems[index].price : 0))).toFixed(2);
      }
    }
  }

  showItemDropdown(index, val);
};

window.handleItemFocus = (index, val) => {
  showItemDropdown(index, val);
};

window.selectProductItem = (index, name, price) => {
  if (activeItems[index]) {
    activeItems[index].name = name;
    activeItems[index].price = price;
  }
  
  if (itemsBody) {
    const rows = itemsBody.querySelectorAll('tr');
    if (rows[index]) {
      const inputs = rows[index].querySelectorAll('input');
      if (inputs.length >= 3) {
        inputs[0].value = name;
        inputs[2].value = price;
      }
      const totalSpan = rows[index].querySelector('.item-total-text');
      if (totalSpan) {
        totalSpan.textContent = (((activeItems[index].qty ? activeItems[index].qty : 1)) * price).toFixed(2);
      }
    }
  }

  setTimeout(() => {
    document.querySelectorAll('.autocomplete-dropdown').forEach(el => el.classList.add('hidden'));
  }, 100);

  calculateTotals();
};

window.updateItem = (index, key, val) => {
  if (activeItems[index] && key !== 'name') {
    activeItems[index][key] = parseFloat(val) ? parseFloat(val) : 0;
  }
  calculateTotals();
  if (itemsBody) {
    const rows = itemsBody.querySelectorAll('tr');
    if (rows[index] && activeItems[index]) {
      const totalSpan = rows[index].querySelector('.item-total-text');
      if (totalSpan) {
        totalSpan.textContent = (((activeItems[index].qty ? activeItems[index].qty : 0)) * ((activeItems[index].price ? activeItems[index].price : 0))).toFixed(2);
      }
    }
  }
};

window.removeItem = (index) => {
  activeItems.splice(index, 1);
  renderItemsTable();
};

const addItemBtn = document.getElementById('add-item-btn');
if (addItemBtn) {
  addItemBtn.addEventListener('click', () => {
    activeItems.push({ name: '', qty: 1, price: 0 });
    renderItemsTable();
  });
}

const payStatusSelect = document.getElementById('payment-status-select');
const paidAmountWrapper = document.getElementById('paid-amount-wrapper');

if (payStatusSelect) {
  payStatusSelect.addEventListener('change', () => {
    if (payStatusSelect.value === 'مدفوعة جزئياً') {
      if (paidAmountWrapper) paidAmountWrapper.classList.remove('hidden');
    } else {
      if (paidAmountWrapper) paidAmountWrapper.classList.add('hidden');
    }
  });
}

function calculateTotals() {
  if (!itemsBody) return { subtotal: 0, discount: 0, taxPercent: 0, taxAmount: 0, grandTotal: 0 };
  const rows = itemsBody.querySelectorAll('tr');
  rows.forEach((tr, idx) => {
    if (activeItems[idx]) {
      const inputs = tr.querySelectorAll('input');
      if (inputs.length >= 3) {
        activeItems[idx].name = inputs[0].value;
        activeItems[idx].qty = parseFloat(inputs[1].value) ? parseFloat(inputs[1].value) : 0;
        const parsedPrice = parseFloat(inputs[2].value);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          activeItems[idx].price = parsedPrice;
        }
      }
    }
  });

  const subtotal = activeItems.reduce((acc, item) => acc + (((item.qty ? item.qty : 0)) * ((item.price ? item.price : 0))), 0);
  const discount = discountInput ? (parseFloat(discountInput.value) ? parseFloat(discountInput.value) : 0) : 0;
  const taxPercent = taxInput ? (parseFloat(taxInput.value) ? parseFloat(taxInput.value) : 0) : 0;
  
  const discountRow = document.getElementById('discount-applied-row');
  const discountDisplay = document.getElementById('discount-amount-display');

  if (discount > 0) {
    if (discountRow) discountRow.classList.remove('hidden');
    if (discountDisplay) discountDisplay.textContent = `-${discount.toFixed(2)} ${storeProfile.currency}`;
  } else {
    if (discountRow) discountRow.classList.add('hidden');
  }

  const afterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = afterDiscount * (taxPercent / 100);
  const grandTotal = afterDiscount + taxAmount;

  if (subtotalDisplay) subtotalDisplay.textContent = `${subtotal.toFixed(2)} ${storeProfile.currency}`;
  if (grandTotalDisplay) grandTotalDisplay.textContent = `${grandTotal.toFixed(2)} ${storeProfile.currency}`;
  return { subtotal, discount, taxPercent, taxAmount, grandTotal };
}

if (discountInput) discountInput.addEventListener('input', calculateTotals);
if (taxInput) taxInput.addEventListener('input', calculateTotals);

async function saveInvoiceData() {
  const clientName = clientInput ? clientInput.value.trim() : '';
  const clientPhone = clientPhoneInput ? clientPhoneInput.value.trim() : '';
  
  calculateTotals();
  const validItems = activeItems.filter(i => (i.name ? i.name : '').trim() !== '' && i.qty > 0);

  if (!clientName) { alert('يرجى إدخال اسم العميل'); return null; }
  if (validItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل وتحديد الكمية والسعر'); return null; }

  const totals = calculateTotals();
  const isoTime = new Date().toISOString();
  const status = payStatusSelect ? payStatusSelect.value : 'مدفوعة';
  let paidVal = totals.grandTotal;

  if (status === 'آجل / غير مدفوعة') paidVal = 0;
  else if (status === 'مدفوعة جزئياً') {
    const paidInput = document.getElementById('paid-amount-input');
    paidVal = paidInput ? (parseFloat(paidInput.value) ? parseFloat(paidInput.value) : 0) : 0;
  }

  const currentInvId = editingInvoiceId ? editingInvoiceId : nextInvNum;
  const zatcaBase64 = generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, isoTime, totals.grandTotal, totals.taxAmount);

  const invoice = Object.assign({
    id: currentInvId,
    client: clientName,
    phone: clientPhone ? clientPhone : '',
    status: status,
    paidAmount: paidVal,
    dueAmount: totals.grandTotal - paidVal,
    items: validItems,
    date: new Date().toLocaleDateString('ar-EG'),
    isoTime: isoTime,
    zatcaQr: zatcaBase64
  }, totals);

  validItems.forEach(soldItem => {
    const prod = productsDB.find(p => p.name.toLowerCase() === soldItem.name.toLowerCase());
    if (prod) {
      prod.stock = Math.max(0, (prod.stock ? prod.stock : 0) - soldItem.qty);
    }
  });

  if (editingInvoiceId) {
    const idx = invoicesDB.findIndex(i => i.id === editingInvoiceId);
    if (idx !== -1) invoicesDB[idx] = invoice;
    editingInvoiceId = null;
  } else {
    invoicesDB.unshift(invoice);
    nextInvNum++;
    localStorage.setItem('last_inv_num', nextInvNum.toString());
  }

  if (invNumberDisplay) invNumberDisplay.textContent = `#${nextInvNum}`;

  let clientIndex = clientsDB.findIndex(c => c.name.toLowerCase() === clientName.toLowerCase());
  if (clientIndex === -1) {
    clientsDB.push({ name: clientName, phone: clientPhone ? clientPhone : '', openingBalance: 0, payments: [] });
  } else if (clientPhone) {
    clientsDB[clientIndex].phone = clientPhone;
  }

  Promise.all([
    syncDocToCloud('invoices', { list: invoicesDB }),
    syncDocToCloud('clients', { list: clientsDB }),
    syncDocToCloud('products', { list: productsDB })
  ]).catch(err => console.error("Cloud Sync Error:", err));

  resetForm();
  renderAllModules();
  return invoice;
}

const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    const inv = await saveInvoiceData();
    if (inv) alert('تم حفظ الفاتورة وتحديث المخزن والحسابات بنجاح');
  });
}

function sendWhatsApp(inv) {
  let phone = (inv.phone ? inv.phone : '').replace(/[^0-9]/g, '');
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
  if (inv.discount > 0) msg += `🏷️ *الخصم:* -${inv.discount.toFixed(2)} ${storeProfile.currency}\n`;
  msg += `💰 *الإجمالي النهائي:* ${inv.grandTotal.toFixed(2)} ${storeProfile.currency}\n`;
  msg += `📌 *حالة الدفع:* ${inv.status}\n\n`;
  msg += `شكراً لتعاملكم معنا!`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

const whatsappBtn = document.getElementById('whatsapp-btn');
if (whatsappBtn) {
  whatsappBtn.addEventListener('click', async () => {
    const inv = await saveInvoiceData();
    if (inv) sendWhatsApp(inv);
  });
}

let currentActiveInvoiceForPreview = null;

function openInvoicePreview(inv) {
  currentActiveInvoiceForPreview = inv;
  const vLogo = document.getElementById('v-logo');
  if (vLogo) {
    if (storeProfile.logo) {
      vLogo.src = storeProfile.logo;
      vLogo.classList.remove('hidden');
    } else {
      vLogo.classList.add('hidden');
    }
  }

  const vStoreName = document.getElementById('v-store-name');
  if (vStoreName) vStoreName.textContent = storeProfile.name;
  const vStorePhone = document.getElementById('v-store-phone');
  if (vStorePhone) vStorePhone.textContent = storeProfile.phone;
  const vStoreVat = document.getElementById('v-store-vat');
  if (vStoreVat) vStoreVat.textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';
  const vStoreAddress = document.getElementById('v-store-address');
  if (vStoreAddress) vStoreAddress.textContent = storeProfile.address;
  const vInvId = document.getElementById('v-inv-id');
  if (vInvId) vInvId.textContent = `رقم الفاتورة: #${inv.id}`;
  const vDate = document.getElementById('v-date');
  if (vDate) vDate.textContent = `التاريخ: ${inv.date}`;
  const vClientName = document.getElementById('v-client-name');
  if (vClientName) vClientName.textContent = inv.client;
  const vClientPhone = document.getElementById('v-client-phone');
  if (vClientPhone) vClientPhone.textContent = inv.phone ? inv.phone : '-';
  const vPaymentStatus = document.getElementById('v-payment-status');
  if (vPaymentStatus) vPaymentStatus.textContent = inv.status;
  const vSubtotal = document.getElementById('v-subtotal');
  if (vSubtotal) vSubtotal.textContent = `${(inv.subtotal ? inv.subtotal : 0).toFixed(2)} ${storeProfile.currency}`;
  const vDiscount = document.getElementById('v-discount');
  if (vDiscount) vDiscount.textContent = `${(inv.discount ? inv.discount : 0).toFixed(2)} ${storeProfile.currency}`;
  const vTax = document.getElementById('v-tax');
  if (vTax) vTax.textContent = `${inv.taxPercent ? inv.taxPercent : 0}%`;
  const vTotal = document.getElementById('v-total');
  if (vTotal) vTotal.textContent = `${(inv.grandTotal ? inv.grandTotal : 0).toFixed(2)} ${storeProfile.currency}`;

  const vItemsBody = document.getElementById('v-items-body');
  if (vItemsBody) {
    vItemsBody.innerHTML = (inv.items ? inv.items : []).map(item => `
      <tr><td>${item.name}</td><td>${item.qty}</td><td>${item.price.toFixed(2)}</td><td>${(item.qty * item.price).toFixed(2)}</td></tr>
    `).join('');
  }

  renderQrCode('preview-qrcode', inv.zatcaQr ? inv.zatcaQr : generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, inv.isoTime ? inv.isoTime : new Date().toISOString(), inv.grandTotal, inv.taxAmount ? inv.taxAmount : 0));

  const viewModal = document.getElementById('view-modal');
  if (viewModal) viewModal.classList.remove('hidden');
}

const closeViewBtn = document.getElementById('close-view-btn');
if (closeViewBtn) {
  closeViewBtn.addEventListener('click', () => {
    const viewModal = document.getElementById('view-modal');
    if (viewModal) viewModal.classList.add('hidden');
  });
}

const downloadImgBtn = document.getElementById('download-img-btn');
if (downloadImgBtn) {
  downloadImgBtn.addEventListener('click', () => {
    const previewCard = document.getElementById('invoice-card-preview');
    if (previewCard) {
      html2canvas(previewCard, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `E-Invoice_${currentActiveInvoiceForPreview ? currentActiveInvoiceForPreview.id : Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  });
}

const printViewBtn = document.getElementById('print-view-btn');
if (printViewBtn) {
  printViewBtn.addEventListener('click', () => {
    if (currentActiveInvoiceForPreview) printInvoice(currentActiveInvoiceForPreview);
  });
}

const printBtn = document.getElementById('print-btn');
if (printBtn) {
  printBtn.addEventListener('click', async () => {
    const inv = await saveInvoiceData();
    if (inv) printInvoice(inv);
  });
}

function printInvoice(inv) {
  const printTemplate = document.getElementById('print-template');
  if (!printTemplate) return;
  printTemplate.innerHTML = `
    <div class="print-header">
      ${storeProfile.logo ? `<img id="p-logo" class="print-logo" src="${storeProfile.logo}">` : ''}
      <h1 id="p-store-name">${storeProfile.name}</h1>
      <p id="p-store-phone">${storeProfile.phone ? 'هاتف: ' + storeProfile.phone : ''}</p>
      <p id="p-store-vat">${storeProfile.vatNo ? 'الرقم الضريبي: ' + storeProfile.vatNo : ''}</p>
      <p id="p-store-address">${storeProfile.address ? storeProfile.address : ''}</p>
      <hr>
      <p id="p-inv-id">رقم الفاتورة: #${inv.id}</p>
      <p id="p-date">التاريخ: ${inv.date}</p>
    </div>
    <div class="print-client">
      <p><strong>العميل:</strong> <span id="p-client-name">${inv.client}</span></p>
      <p><strong>الهاتف:</strong> <span id="p-client-phone">${inv.phone ? inv.phone : '-'}</span></p>
      <p><strong>حالة الدفع:</strong> <span id="p-payment-status">${inv.status}</span></p>
    </div>
    <table class="print-table">
      <thead>
        <tr>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>السعر</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody id="p-items-body">
        ${(inv.items ? inv.items : []).map(item => `
          <tr><td>${item.name}</td><td>${item.qty}</td><td>${item.price.toFixed(2)}</td><td>${(item.qty * item.price).toFixed(2)}</td></tr>
        `).join('')}
      </tbody>
    </table>
    <div class="print-footer-container">
      <div class="print-totals">
        <p>المجموع الفرعي: <span id="p-subtotal">${(inv.subtotal ? inv.subtotal : 0).toFixed(2)} ${storeProfile.currency}</span></p>
        <p>الخصم: <span id="p-discount">${(inv.discount ? inv.discount : 0).toFixed(2)} ${storeProfile.currency}</span></p>
        <p>الضريبة: <span id="p-tax">${inv.taxPercent ? inv.taxPercent : 0}%</span></p>
        <h3>الإجمالي الكلي: <span id="p-total">${(inv.grandTotal ? inv.grandTotal : 0).toFixed(2)} ${storeProfile.currency}</span></h3>
      </div>
      <div id="print-qrcode" class="qrcode-wrapper"></div>
    </div>
  `;

  renderQrCode('print-qrcode', inv.zatcaQr ? inv.zatcaQr : generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, inv.isoTime ? inv.isoTime : new Date().toISOString(), inv.grandTotal, inv.taxAmount ? inv.taxAmount : 0));

  window.print();
}

window.editInvoiceById = (id) => {
  const inv = invoicesDB.find(i => i.id === id);
  if (!inv) return;

  editingInvoiceId = inv.id;
  if (invNumberDisplay) invNumberDisplay.textContent = `#${inv.id} (تعديل)`;
  if (clientInput) clientInput.value = inv.client ? inv.client : '';
  if (clientPhoneInput) clientPhoneInput.value = inv.phone ? inv.phone : '';
  if (discountInput) discountInput.value = inv.discount ? inv.discount : 0;
  if (taxInput) taxInput.value = inv.taxPercent ? inv.taxPercent : 0;
  if (payStatusSelect) payStatusSelect.value = inv.status ? inv.status : 'مدفوعة';

  activeItems = (inv.items ? inv.items : []).map(i => Object.assign({}, i));
  renderItemsTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetForm() {
  editingInvoiceId = null;
  if (invNumberDisplay) invNumberDisplay.textContent = `#${nextInvNum}`;
  if (clientInput) clientInput.value = '';
  if (clientPhoneInput) clientPhoneInput.value = '';
  activeItems = [];
  if (discountInput) discountInput.value = 0;
  if (taxInput) taxInput.value = 14;
  const paidInput = document.getElementById('paid-amount-input');
  if (paidInput) paidInput.value = 0;
  if (paidAmountWrapper) paidAmountWrapper.classList.add('hidden');
  if (payStatusSelect) payStatusSelect.value = 'مدفوعة';
  if (addItemBtn) addItemBtn.click();
}

function renderSavedInvoices(filter = '') {
  const container = document.getElementById('invoices-container');
  if (!container) return;

  const f = (filter ? filter : '').toLowerCase();
  const filtered = invoicesDB.filter(inv => {
    const clientMatch = (inv.client ? inv.client : '').toLowerCase().includes(f);
    const idMatch = (inv.id ? inv.id : '').toString().includes(f);
    const phoneMatch = (inv.phone ? inv.phone : '').includes(f);
    return clientMatch || idMatch || phoneMatch;
  });

  container.innerHTML = filtered.map(inv => `
    <li onclick="window.viewInvoiceById(${inv.id})" style="cursor: pointer;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong>#${inv.id} - ${inv.client}</strong>
          <span class="badge ${inv.status === 'مدفوعة' ? 'badge-paid' : (inv.status === 'مدفوعة جزئياً' ? 'badge-partial' : 'badge-unpaid')}">${inv.status}</span>
        </div>
        <small style="color:var(--text-muted); display: block; margin-top: 2px;">
          📅 ${inv.date ? inv.date : ''} • 📦 ${(inv.items ? inv.items : []).length} أصناف ${inv.phone ? '• 📞 ' + inv.phone : ''}
        </small>
        <div class="inv-actions" style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;" onclick="event.stopPropagation();">
          <button class="btn-sm" style="background:var(--accent); color:#fff" onclick="window.viewInvoiceById(${inv.id})">👁️ معاينة</button>
          <button class="btn-sm" style="background:var(--warning); color:#fff" onclick="window.editInvoiceById(${inv.id})">✏️ تعديل</button>
          <button class="btn-sm" style="background:#25d366; color:#fff" onclick="window.sendWhatsAppById(${inv.id})">💬 واتساب</button>
          <button class="btn-sm" onclick="window.reprintInvoice(${inv.id})">🖨️ طباعة</button>
          <button class="btn-sm" style="color:var(--danger)" onclick="window.deleteInvoice(${inv.id})">🗑️</button>
        </div>
      </div>
      <strong style="color:var(--accent); font-size: 1.05rem; white-space: nowrap;">${(inv.grandTotal ? inv.grandTotal : 0).toFixed(2)} ${storeProfile.currency}</strong>
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

const searchInput = document.getElementById('search-input');
if (searchInput) searchInput.addEventListener('input', (e) => renderSavedInvoices(e.target.value));

const productForm = document.getElementById('product-form');
if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('p-name');
    const priceEl = document.getElementById('p-price');
    const costEl = document.getElementById('p-cost');
    const stockEl = document.getElementById('p-stock');

    const name = nameEl ? nameEl.value : '';
    const price = priceEl ? (parseFloat(priceEl.value) ? parseFloat(priceEl.value) : 0) : 0;
    const cost = costEl ? (parseFloat(costEl.value) ? parseFloat(costEl.value) : 0) : 0;
    const stock = stockEl ? (parseInt(stockEl.value) ? parseInt(stockEl.value) : 0) : 0;

    productsDB.push({ id: Date.now(), name, price, cost, stock });
    await syncDocToCloud('products', { list: productsDB });
    e.target.reset();
  });
}

function renderProducts() {
  const container = document.getElementById('products-list-container');
  if (!container) return;
  container.innerHTML = productsDB.map((p, idx) => `
    <li>
      <div>
        <strong>${p.name}</strong>
        <br><small style="color:var(--text-muted)">التكلفة: ${p.cost} ${storeProfile.currency} | المخزون: ${p.stock}</small>
      </div>
      <div>
        <strong style="color:var(--success)">${p.price} ${storeProfile.currency}</strong>
        <button class="btn-sm" style="color:var(--danger); margin-right:8px;" onclick="window.deleteProduct(${idx})">🗑️</button>
      </div>
    </li>
  `).join('');
}

window.deleteProduct = async (idx) => {
  productsDB.splice(idx, 1);
  await syncDocToCloud('products', { list: productsDB });
};

const clientForm = document.getElementById('client-form');
if (clientForm) {
  clientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cNameEl = document.getElementById('c-name');
    const cPhoneEl = document.getElementById('c-phone');
    const cBalanceEl = document.getElementById('c-balance');

    const name = cNameEl ? cNameEl.value.trim() : '';
    const phone = cPhoneEl ? cPhoneEl.value.trim() : '';
    const openingBalance = cBalanceEl ? (parseFloat(cBalanceEl.value) ? parseFloat(cBalanceEl.value) : 0) : 0;

    if (clientsDB.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      alert('العميل موجود بالفعل!');
      return;
    }

    clientsDB.push({ name, phone, openingBalance, payments: [] });
    await syncDocToCloud('clients', { list: clientsDB });
    e.target.reset();
  });
}

function getClientCalculatedLedger(clientName) {
  const clientObj = clientsDB.find(c => c.name.toLowerCase() === clientName.toLowerCase()) ? clientsDB.find(c => c.name.toLowerCase() === clientName.toLowerCase()) : { openingBalance: 0, payments: [] };
  const clientInvoices = invoicesDB.filter(i => i.client.toLowerCase() === clientName.toLowerCase());

  let totalPurchases = clientObj.openingBalance ? clientObj.openingBalance : 0;
  let totalPaid = 0;

  clientInvoices.forEach(inv => {
    totalPurchases += (inv.grandTotal ? inv.grandTotal : 0);
    totalPaid += (inv.paidAmount ? inv.paidAmount : 0);
  });

  (clientObj.payments ? clientObj.payments : []).forEach(p => {
    totalPaid += (p.amount ? p.amount : 0);
  });

  const balance = Math.max(0, totalPurchases - totalPaid);
  return { totalPurchases, totalPaid, balance, clientInvoices, payments: clientObj.payments ? clientObj.payments : [] };
}

function renderClients() {
  const container = document.getElementById('clients-list-container');
  if (!container) return;
  const searchClientsInput = document.getElementById('search-clients-input');
  const searchFilter = searchClientsInput ? searchClientsInput.value.toLowerCase() : '';
  const filtered = clientsDB.filter(c => c.name.toLowerCase().includes(searchFilter));

  container.innerHTML = filtered.map(c => {
    const stats = getClientCalculatedLedger(c.name);
    return `
      <li>
        <div>
          <strong>👤 ${c.name}</strong> <small style="color:var(--text-muted)">(${c.phone ? c.phone : 'بدون رقم'})</small>
          <br><small style="color:var(--text-muted)">إجمالي التعاملات: ${stats.totalPurchases.toFixed(2)} | المدفوع: ${stats.totalPaid.toFixed(2)}</small>
        </div>
        <div style="text-align:left;">
          <span class="badge ${stats.balance > 0 ? 'badge-unpaid' : 'badge-paid'}">
            ${stats.balance > 0 ? `مستحق: ${stats.balance.toFixed(2)}` : 'خالي المديونية'}
          </span>
          <button class="btn-sm" style="margin-right:6px; background:var(--accent); color:#fff" onclick="window.openClientLedger('${c.name}')">كشف حساب 📄</button>
        </div>
      </li>
    `;
  }).join('');
}

const searchClientsInput = document.getElementById('search-clients-input');
if (searchClientsInput) searchClientsInput.addEventListener('input', renderClients);

window.openClientLedger = (clientName) => {
  activeLedgerClientName = clientName;
  const stats = getClientCalculatedLedger(clientName);

  const ledgerTitle = document.getElementById('ledger-client-title');
  if (ledgerTitle) ledgerTitle.textContent = `👤 كشف حساب: ${clientName}`;
  const ledgerTotalSales = document.getElementById('ledger-total-sales');
  if (ledgerTotalSales) ledgerTotalSales.textContent = `${stats.totalPurchases.toFixed(2)} ${storeProfile.currency}`;
  const ledgerTotalPaid = document.getElementById('ledger-total-paid');
  if (ledgerTotalPaid) ledgerTotalPaid.textContent = `${stats.totalPaid.toFixed(2)} ${storeProfile.currency}`;
  const ledgerBalance = document.getElementById('ledger-balance');
  if (ledgerBalance) ledgerBalance.textContent = `${stats.balance.toFixed(2)} ${storeProfile.currency}`;

  const historyUl = document.getElementById('client-ledger-history');
  if (!historyUl) return;
  let historyHtml = '';

  stats.clientInvoices.forEach(inv => {
    historyHtml += `
      <li style="border-right: 4px solid var(--accent)">
        <div>فاتورة #${inv.id} (${inv.date})<br><small>${(inv.items ? inv.items : []).length} أصناف - ${inv.status}</small></div>
        <strong>${(inv.grandTotal ? inv.grandTotal : 0).toFixed(2)} ${storeProfile.currency}</strong>
      </li>
    `;
  });

  stats.payments.forEach(p => {
    historyHtml += `
      <li style="border-right: 4px solid var(--success)">
        <div>دفعة سداد 💵 (${p.date})</div>
        <strong class="text-success">-${p.amount.toFixed(2)} ${storeProfile.currency}</strong>
      </li>
    `;
  });

  historyUl.innerHTML = historyHtml ? historyHtml : '<p style="text-align:center; color:var(--text-muted)">لا توجد معاملات مسجلة</p>';
  const ledgerModal = document.getElementById('client-ledger-modal');
  if (ledgerModal) ledgerModal.classList.remove('hidden');
};

const closeLedgerBtn = document.getElementById('close-ledger-btn');
if (closeLedgerBtn) {
  closeLedgerBtn.addEventListener('click', () => {
    const ledgerModal = document.getElementById('client-ledger-modal');
    if (ledgerModal) ledgerModal.classList.add('hidden');
  });
}

const ledgerWhatsappBtn = document.getElementById('ledger-whatsapp-btn');
if (ledgerWhatsappBtn) {
  ledgerWhatsappBtn.addEventListener('click', () => {
    if (!activeLedgerClientName) return;
    const stats = getClientCalculatedLedger(activeLedgerClientName);
    const clientObj = clientsDB.find(c => c.name.toLowerCase() === activeLedgerClientName.toLowerCase());
    let phone = (clientObj && clientObj.phone ? clientObj.phone : '').replace(/[^0-9]/g, '');
    if (!phone) { alert('يرجى تسجيل رقم الهاتف للعميل أولاً في سجل العملاء'); return; }
    if (!phone.startsWith('20') && phone.length === 11) phone = '2' + phone;

    let msg = `*${storeProfile.name}*\n`;
    msg += `📄 *كشف حساب العميل:* ${activeLedgerClientName}\n`;
    msg += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
    msg += `-----------------------------------\n`;
    msg += `🛍️ *إجمالي التعاملات:* ${stats.totalPurchases.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `✅ *إجمالي المدفوعات:* ${stats.totalPaid.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `📌 *الصافي / المديونية:* ${stats.balance.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `-----------------------------------\n`;
    msg += `شكراً لتعاملكم معنا!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

const ledgerDownloadBtn = document.getElementById('ledger-download-btn');
if (ledgerDownloadBtn) {
  ledgerDownloadBtn.addEventListener('click', () => {
    const ledgerCard = document.getElementById('ledger-printable-card');
    if (ledgerCard) {
      html2canvas(ledgerCard, { scale: 2, backgroundColor: '#111827' }).then(canvas => {
        const link = document.createElement('a');
        link.download = `كشف_حساب_${activeLedgerClientName}_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  });
}

const ledgerPrintBtn = document.getElementById('ledger-print-btn');
if (ledgerPrintBtn) {
  ledgerPrintBtn.addEventListener('click', () => {
    if (!activeLedgerClientName) return;
    const stats = getClientCalculatedLedger(activeLedgerClientName);
    const printTemplate = document.getElementById('print-template');
    if (!printTemplate) return;

    printTemplate.innerHTML = `
      <div class="print-header">
        ${storeProfile.logo ? `<img class="print-logo" src="${storeProfile.logo}">` : ''}
        <h1>كشف حساب عميل</h1>
        <h2>${storeProfile.name}</h2>
        <p>${storeProfile.phone ? 'هاتف: ' + storeProfile.phone : ''}</p>
        <p>${storeProfile.address ? storeProfile.address : ''}</p>
        <hr>
        <p><strong>اسم العميل:</strong> ${activeLedgerClientName}</p>
        <p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
      </div>

      <div style="margin: 15px 0; padding: 10px; border: 1px solid #000; border-radius: 6px;">
        <p><strong>إجمالي التعاملات:</strong> ${stats.totalPurchases.toFixed(2)} ${storeProfile.currency}</p>
        <p><strong>إجمالي المدفوعات:</strong> ${stats.totalPaid.toFixed(2)} ${storeProfile.currency}</p>
        <p style="font-size: 1.1rem; font-weight: bold; margin-top: 5px;"><strong>الرصيد المتبقي / المديونية:</strong> ${stats.balance.toFixed(2)} ${storeProfile.currency}</p>
      </div>

      <h3>سجل الحركة الحسابية التفصيلي:</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th>بيان المعاملة</th>
            <th>التاريخ</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          ${stats.clientInvoices.map(inv => `
            <tr>
              <td>فاتورة مبيعات #${inv.id} (${inv.items ? inv.items.length : 0} أصناف - ${inv.status})</td>
              <td>${inv.date}</td>
              <td>${(inv.grandTotal ? inv.grandTotal : 0).toFixed(2)} ${storeProfile.currency}</td>
            </tr>
          `).join('')}
          ${stats.payments.map(p => `
            <tr>
              <td>دفعة سداد نقدي 💵</td>
              <td>${p.date}</td>
              <td>-${p.amount.toFixed(2)}${storeProfile.currency}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    window.print();
  });
}

const submitPaymentBtn = document.getElementById('submit-payment-btn');
if (submitPaymentBtn) {
  submitPaymentBtn.addEventListener('click', async () => {
    const payAmountInput = document.getElementById('pay-amount-input');
    const amount = payAmountInput ? (parseFloat(payAmountInput.value) ? parseFloat(payAmountInput.value) : 0) : 0;
    if (amount <= 0 || !activeLedgerClientName) return;

    const idx = clientsDB.findIndex(c => c.name.toLowerCase() === activeLedgerClientName.toLowerCase());
    if (idx !== -1) {
      if (!clientsDB[idx].payments) clientsDB[idx].payments = [];
      clientsDB[idx].payments.push({ amount, date: new Date().toLocaleDateString('ar-EG') });
      await syncDocToCloud('clients', { list: clientsDB });
      if (payAmountInput) payAmountInput.value = '';
      window.openClientLedger(activeLedgerClientName);
      renderAllModules();
    }
  });
}

const expenseForm = document.getElementById('expense-form');
if (expenseForm) {
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const expTitleEl = document.getElementById('exp-title');
    const expAmountEl = document.getElementById('exp-amount');
    const title = expTitleEl ? expTitleEl.value : '';
    const amount = expAmountEl ? (parseFloat(expAmountEl.value) ? parseFloat(expAmountEl.value) : 0) : 0;

    expensesDB.push({ id: Date.now(), title, amount, date: new Date().toLocaleDateString('ar-EG') });
    await syncDocToCloud('expenses', { list: expensesDB });
    e.target.reset();
  });
}

function renderExpenses() {
  const container = document.getElementById('expenses-list-container');
  if (!container) return;
  container.innerHTML = expensesDB.map((exp, idx) => `
    <li>
      <div>
        <strong>${exp.title}</strong>
        <br><small style="color:var(--text-muted)">${exp.date}</small>
      </div>
      <div>
        <strong style="color:var(--danger)">-${exp.amount.toFixed(2)} ${storeProfile.currency}</strong>
        <button class="btn-sm" style="color:var(--danger); margin-right:8px;" onclick="window.deleteExpense(${idx})">🗑️</button>
      </div>
    </li>
  `).join('');
}

window.deleteExpense = async (idx) => {
  expensesDB.splice(idx, 1);
  await syncDocToCloud('expenses', { list: expensesDB });
};

function updateDashboardStats() {
  const totalSales = invoicesDB.reduce((acc, i) => acc + (i.grandTotal ? i.grandTotal : 0), 0);
  const totalExpensesAmount = expensesDB.reduce((acc, e) => acc + (e.amount ? e.amount : 0), 0);
  const netProfit = totalSales - totalExpensesAmount;

  let totalDebts = 0;
  clientsDB.forEach(c => {
    totalDebts += getClientCalculatedLedger(c.name).balance;
  });

  const salesEl = document.getElementById('stat-total-sales');
  const debtsEl = document.getElementById('stat-total-debts');
  const profitEl = document.getElementById('stat-net-profit');
  const countEl = document.getElementById('stat-count');

  if (salesEl) salesEl.textContent = `${totalSales.toFixed(2)} ${storeProfile.currency}`;
  if (debtsEl) debtsEl.textContent = `${totalDebts.toFixed(2)} ${storeProfile.currency}`;
  if (profitEl) profitEl.textContent = `${netProfit.toFixed(2)} ${storeProfile.currency}`;
  if (countEl) countEl.textContent = invoicesDB.length;
}

const exportJsonBtn = document.getElementById('export-json-btn');
if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => {
    const data = { invoices: invoicesDB, clients: clientsDB, products: productsDB, expenses: expensesDB, storeProfile };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_cloud_${Date.now()}.json`;
    a.click();
  });
}

const exportCsvBtn = document.getElementById('export-csv-btn');
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => {
    let csv = 'رقم الفاتورة,العميل,الهاتف,الحالة,التاريخ,الإجمالي\n';
    invoicesDB.forEach(inv => {
      csv += `${inv.id},"${inv.client}","${inv.phone ? inv.phone : ''}",${inv.status},${inv.date},${inv.grandTotal}\n`;
    });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales_report_${Date.now()}.csv`;
    a.click();
  });
}

const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', () => {
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = localStorage.getItem('app_theme') ? localStorage.getItem('app_theme') : 'dark';
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) currencySelect.value = storeProfile.currency ? storeProfile.currency : 'ج.م';
    const storeNameInput = document.getElementById('store-name-input');
    if (storeNameInput) storeNameInput.value = storeProfile.name;
    const storePhoneInput = document.getElementById('store-phone-input');
    if (storePhoneInput) storePhoneInput.value = storeProfile.phone;
    const storeVatInput = document.getElementById('store-vat-input');
    if (storeVatInput) storeVatInput.value = storeProfile.vatNo ? storeProfile.vatNo : '';
    const storeAddressInput = document.getElementById('store-address-input');
    if (storeAddressInput) storeAddressInput.value = storeProfile.address;
    if (settingsModal) settingsModal.classList.remove('hidden');
  });
}

const closeSettingsBtn = document.getElementById('close-settings-btn');
if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener('click', () => {
    if (settingsModal) settingsModal.classList.add('hidden');
  });
}

const saveSettingsBtn = document.getElementById('save-settings-btn');
if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', () => {
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) applyTheme(themeSelect.value);

    const logoInput = document.getElementById('store-logo-input');
    
    const saveProfileData = async (logoBase64) => {
      const storeNameInput = document.getElementById('store-name-input');
      const storePhoneInput = document.getElementById('store-phone-input');
      const storeVatInput = document.getElementById('store-vat-input');
      const storeAddressInput = document.getElementById('store-address-input');
      const currencySelect = document.getElementById('currency-select');

      storeProfile = {
        name: storeNameInput && storeNameInput.value ? storeNameInput.value : "GITI Enterprise ERP",
        phone: storePhoneInput ? storePhoneInput.value : '',
        vatNo: storeVatInput ? storeVatInput.value.trim() : '',
        address: storeAddressInput ? storeAddressInput.value : '',
        currency: currencySelect && currencySelect.value ? currencySelect.value : "ج.م",
        logo: logoBase64 !== null ? logoBase64 : storeProfile.logo
      };
      await syncDocToCloud('profile', storeProfile);
      updateHeaderUI();
      renderAllModules();
      if (settingsModal) settingsModal.classList.add('hidden');
    };

    if (logoInput && logoInput.files && logoInput.files[0]) {
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(logoInput.files[0]);
      }).then(res => saveProfileData(res));
    } else {
      saveProfileData(null);
    }
  });
}

function renderAllModules() {
  renderSavedInvoices();
  renderProducts();
  renderClients();
  renderExpenses();
  updateDashboardStats();
}

applyTheme(localStorage.getItem('app_theme') ? localStorage.getItem('app_theme') : 'dark');
applyLanguage(currentLang);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

updateHeaderUI();
if (addItemBtn) addItemBtn.click();
