// ==========================================
// Firebase & Core Application Engine Imports
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection, deleteDoc, getDocs,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  GoogleAuthProvider, signInWithPopup, signInWithCredential, 
  signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, indexedDBLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ==========================================
// Capacitor & Native Integration Helpers
// ==========================================
const isCapacitorNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

async function saveOrShareFile(fileDataUrlOrBlob, fileName, mimeType, shareTitle) {
  try {
    let base64Data = '';
    let blob;

    if (typeof fileDataUrlOrBlob === 'string') {
      if (fileDataUrlOrBlob.startsWith('data:')) {
        base64Data = fileDataUrlOrBlob.split(',')[1];
        const res = await fetch(fileDataUrlOrBlob);
        blob = await res.blob();
      } else {
        base64Data = fileDataUrlOrBlob;
        blob = new Blob([base64Data], { type: mimeType || 'application/octet-stream' });
      }
    } else if (fileDataUrlOrBlob instanceof Blob) {
      blob = fileDataUrlOrBlob;
      base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
    }

    if (isCapacitorNative && window.Capacitor.Plugins) {
      const Filesystem = window.Capacitor.Plugins.Filesystem;
      const Share = window.Capacitor.Plugins.Share;

      if (Filesystem && Share) {
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: 'CACHE'
        });

        await Share.share({
          title: shareTitle || fileName,
          text: shareTitle || fileName,
          url: savedFile.uri,
          dialogTitle: shareTitle || fileName
        });
        return true;
      }
    }

    const file = new File([blob], fileName, { type: mimeType || blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: shareTitle || fileName,
          text: shareTitle || fileName
        });
        return true;
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') return true;
      }
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 2000);

    return true;
  } catch (err) {
    console.warn("File save/share error:", err);
    alert("⚠️ تعذر تنزيل المستند مباشرة.");
    return false;
  }
}

async function generateAndExportPdf(elementId, fileName, shareTitle) {
  const element = document.getElementById(elementId);
  if (!element) return false;

  // إظهار كرت المعاينة المخصص للتصدير في الخلفية
  element.classList.add('rendering-active');
  
  // زيادة وقت الانتظار قليلاً لضمان تحميل الصور والـ DOM بالكامل على الموبايل
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    // المحاولة الأولى: استخدام مكتبة html2pdf لتوليد ملف PDF احترافي
    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin:       [5, 5, 5, 5],
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.92 }, // تقليل الجودة قليلاً لمنع استهلاك الذاكرة
        html2canvas:  { 
          scale: 1.5,     // تم التعديل من 2 إلى 1.5 لحل مشكلة انهيار الذاكرة على الهواتف وتطبيقات Capacitor
          useCORS: true, 
          logging: false, 
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      try {
        const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
        element.classList.remove('rendering-active');
        return await saveOrShareFile(pdfBlob, fileName, 'application/pdf', shareTitle);
      } catch (e) {
        console.warn("html2pdf error, falling back to canvas:", e);
      }
    }

    // المحاولة الثانية: إذا فشل الـ PDF، يتم التحويل لصورة PNG (لتشغيل زر تحميل الصورة)
    if (typeof html2canvas !== 'undefined') {
      try {
        const canvas = await html2canvas(element, { 
          scale: 1.5,     // تقليل الـ scale هنا أيضاً لحماية الذاكرة العشوائية للموبايل
          useCORS: true, 
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0
        });
        const imgData = canvas.toDataURL('image/png');
        element.classList.remove('rendering-active');
        return await saveOrShareFile(imgData, fileName.replace('.pdf', '.png'), 'image/png', shareTitle);
      } catch (e) {
        console.error("Canvas export failed:", e);
      }
    }

    // المحاولة الأخيرة: كحل بديل ومضمون 100% في حال تعذر المكتبات
    element.classList.remove('rendering-active');
    window.print();
    return true;

  } catch (err) {
    element.classList.remove('rendering-active');
    console.error("Export Error:", err);
    return false;
  }
}


function initCapacitorBridge() {
  if (isCapacitorNative) {
    if (window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) {
      window.Capacitor.Plugins.GoogleAuth.initialize({
        clientId: '753885709520-r09nngge8556ndmg0ampdu266iota0lv.apps.googleusercontent.com',
        serverClientId: '753885709520-r09nngge8556ndmg0ampdu266iota0lv.apps.googleusercontent.com',
        grantOfflineAccess: true,
        scopes: ['profile', 'email']
      }).catch(err => console.warn("GoogleAuth init warning:", err));
    }
    
    if (window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
        const activeModals = document.querySelectorAll('.modal:not(.hidden)');
        if (activeModals.length > 0) {
          activeModals.forEach(modal => modal.classList.add('hidden'));
        } else if (canGoBack) {
          window.history.back();
        } else {
          window.Capacitor.Plugins.App.exitApp();
        }
      });
    }

    if (window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {
      setTimeout(() => {
        window.Capacitor.Plugins.SplashScreen.hide();
      }, 500);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCapacitorBridge);
} else {
  initCapacitorBridge();
}

// ==========================================
// Firebase Initialization & Config
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDqFZjs7m93mB5XsnO_bAQV49O7g2FQkZc",
  authDomain: "giti-68750.firebaseapp.com",
  projectId: "giti-68750",
  storageBucket: "giti-68750.firebasestorage.app",
  messagingSenderId: "753885709520",
  appId: "1:753885709520:web:eda57cd4efdb5c4ef48ad5"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const auth = getAuth(app);
auth.languageCode = 'ar';

setPersistence(auth, indexedDBLocalPersistence).catch(() => {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Auth Persistence Error:", error);
  });
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function triggerAds() {
  setTimeout(() => {
    try {
      const adElements = document.querySelectorAll('.adsbygoogle');
      adElements.forEach(ad => {
        if (!ad.getAttribute('data-adsbygoogle-status')) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      });
    } catch (e) {}
  }, 300);
}

// ==========================================
// Translations & UI State Management
// ==========================================
const translations = {
  ar: {
    login: "تسجيل الدخول", register: "حساب جديد", googleAuth: "متابعة بواسطة Google",
    or: "أو", email: "البريد الإلكتروني", password: "كلمة المرور", loginBtn: "دخول التطبيق",
    storeName: "اسم النشاط / الشركة", registerBtn: "إنشاء حساب مجاني", logout: "تسجيل الخروج",
    accountDisabled: "⚠️ الحساب معطل من قبل الإدارة",
    accountDisabledDesc: "تم تعطيل رخصة هذا الحساب. يرجى التواصل مع Admin Master (haretg@gmail.com).",
    tabInvoices: "🧾 الفواتير الحية", tabProducts: "📦 المخزن", tabClients: "👥 العملاء والدفاتر", tabSuppliers: "🏭 الموردين والشركات", tabExpenses: "💸 الخزينة",
    totalSales: "إجمالي المبيعات", netProfit: "صافي الأرباح", expenses: "المصروفات", invoiceCount: "عدد الفواتير",
    newInvoice: "فاتورة مبيعات جديدة", invNo: "رقم الفاتورة:", clientName: "اسم العميل / الشركة",
    clientPhone: "رقم الهاتف (للواتساب)", itemTitle: "الصنف / الخدمة", qtyTitle: "الكمية", priceTitle: "السعر",
    subtotalTitle: "الإجمالي", addItem: "+ إضافة صنف جديد", subtotal: "المجموع الفرعي:", discount: "الخصم:",
    tax: "الضريبة (%):", payStatus: "حالة الدفع:", grandTotal: "الإجمالي النهائي:", saveInv: "حفظ وتسجيل الفاتورة",
    sendWhatsApp: "واتساب 💬", print: "طباعة / PDF 🖨️", invHistory: "سجل الفواتير السحابي", addProduct: "إضافة منتج للمخزن",
    pName: "اسم المنتج", pPrice: "سعر البيع", pCost: "سعر التكلفة", pStock: "الكمية بالمخزن", saveProduct: "حفظ المنتج",
    productList: "قائمة المنتجات المخزنة", clientDb: "سجل العملاء والمديونيات", addExpense: "تسجيل مصروف جديد",
    expTitle: "بند المصروف", expAmount: "المبلغ", saveExpense: "تسجيل المصروف", expList: "سجل المصروفات",
    previewTitle: "👁️ معاينة الفاتورة الإلكترونية", downloadImg: "حفظ كصورة 🖼️", settingsTitle: "⚙️ إعدادات المنشأة والعملة",
    theme: "مظهر التطبيق", currency: "العملة الرئيسية", vatNo: "الرقم الضريبي للمنشأة (VAT)", logo: "شعار الشركة", address: "العنوان", saveSettings: "حفظ التغييرات السحابية"
  },
  en: {
    login: "Sign In", register: "Register", googleAuth: "Continue with Google",
    or: "OR", email: "Email Address", password: "Password", loginBtn: "Access App",
    storeName: "Business Name", registerBtn: "Create Free Instant Account", logout: "Sign Out",
    accountDisabled: "⚠️ Account Disabled by Admin",
    accountDisabledDesc: "This license has been suspended. Contact Admin Master (haretg@gmail.com).",
    tabInvoices: "🧾 Live Invoices", tabProducts: "📦 Inventory", tabClients: "👥 Clients & Ledger", tabSuppliers: "🏭 Suppliers", tabExpenses: "💸 Expenses",
    totalSales: "Total Sales", netProfit: "Net Profit", expenses: "Expenses", invoiceCount: "Total Invoices",
    newInvoice: "New Sales Invoice", invNo: "Invoice #:", clientName: "Client / Company Name",
    clientPhone: "Client Phone (WhatsApp)", itemTitle: "Item / Service", qtyTitle: "Qty", priceTitle: "Price",
    subtotalTitle: "Total", addItem: "+ Add Item", subtotal: "Subtotal:", discount: "Discount:",
    tax: "VAT (%):", payStatus: "Payment Status:", grandTotal: "Grand Total:", saveInv: "Save Invoice",
    sendWhatsApp: "WhatsApp 💬", print: "Print / PDF 🖨️", invHistory: "Cloud Invoice Logs", addProduct: "Add Product",
    pName: "Product Name", pPrice: "Selling Price", pCost: "Cost Price", pStock: "Stock Quantity", saveProduct: "Save Product",
    productList: "Stocked Items", clientDb: "Client Accounts", addExpense: "Add Expense",
    expTitle: "Expense Category", expAmount: "Amount", saveExpense: "Record Expense", expList: "Expense Log",
    previewTitle: "👁️ E-Invoice Preview", downloadImg: "Save Image 🖼️", settingsTitle: "⚙️ Enterprise Settings",
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
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

const toggleLangBtn = document.getElementById('toggle-lang-btn');
if (toggleLangBtn) toggleLangBtn.addEventListener('click', () => applyLanguage(currentLang === 'ar' ? 'en' : 'ar'));

const authLangBtn = document.getElementById('auth-lang-btn');
if (authLangBtn) authLangBtn.addEventListener('click', () => applyLanguage(currentLang === 'ar' ? 'en' : 'ar'));

const notificationBtn = document.getElementById('notification-btn');
const notificationModal = document.getElementById('notification-modal');
const closeNotificationBtn = document.getElementById('close-notification-btn');
const dismissNotificationBtn = document.getElementById('dismiss-notification-btn');
const notificationBadge = document.getElementById('notification-badge');

if (notificationBtn) {
  notificationBtn.addEventListener('click', () => {
    if (notificationModal) notificationModal.classList.remove('hidden');
    if (notificationBadge) notificationBadge.classList.add('hidden');
  });
}

if (closeNotificationBtn) {
  closeNotificationBtn.addEventListener('click', () => {
    if (notificationModal) notificationModal.classList.add('hidden');
  });
}

if (dismissNotificationBtn) {
  dismissNotificationBtn.addEventListener('click', () => {
    if (notificationModal) notificationModal.classList.add('hidden');
    if (currentUser) {
      localStorage.setItem(`giti_${currentUser.uid}_notif_read`, 'true');
    }
  });
}

// ==========================================
// ZATCA QR Code Generator
// ==========================================
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

// ==========================================
// Application Core Variables & Storage
// ==========================================
const loginScreen = document.getElementById('login-screen');
const lockScreen = document.getElementById('lock-screen');
const mainApp = document.getElementById('main-app');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

let currentUser = null;
let invoicesDB = [];
let archivedInvoicesDB = [];
let clientsDB = [];
let suppliersDB = [];
let purchasesDB = [];
let productsDB = [];
let expensesDB = [];
let storeProfile = { name: "GITI Enterprise ERP", phone: "01000000000", address: "", currency: "ج.م", vatNo: "", logo: "" };
let activeUnsubscribers = [];
let licenseUnsubscriber = null;
let activeItems = [];
let activePurchaseItems = [];
let activeLedgerClientName = null;
let activeLedgerSupplierName = null;
let editingInvoiceId = null;
let editingProductId = null;
let editingSupplierId = null;

function saveLocalData(uid, key, data) {
  try {
    localStorage.setItem(`giti_${uid}_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn("Local storage save error:", e);
  }
}

function getLocalData(uid, key, fallback = []) {
  try {
    const data = localStorage.getItem(`giti_${uid}_${key}`);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.warn("Local storage read error:", e);
    return fallback;
  }
}

async function ensureUserLicense(user) {
  if (!user) return;
  const userRef = doc(db, "licenses", user.uid);
  try {
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      const defaultLicense = {
        email: user.email,
        storeName: user.displayName ? user.displayName : "نشاط تجاري جديد",
        isActive: true,
        role: user.email === 'haretg@gmail.com' ? "admin_master" : "user",
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, defaultLicense);
      localStorage.setItem(`giti_license_${user.uid}`, JSON.stringify(defaultLicense));
    } else {
      localStorage.setItem(`giti_license_${user.uid}`, JSON.stringify(docSnap.data()));
    }
  } catch (e) {}
}

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

// ==========================================
// Authentication State Observer
// ==========================================
onAuthStateChanged(auth, async (user) => {
  const adminBtn = document.getElementById('admin-btn');

  if (user) {
    currentUser = user;
    if (loginScreen) loginScreen.classList.add('hidden');
    
    const isAdmin = user.email === 'haretg@gmail.com';
    if (adminBtn) {
      if (isAdmin) adminBtn.classList.remove('hidden');
      else adminBtn.classList.add('hidden');
    }

    const userUidTag = document.getElementById('user-uid-tag');
    if (userUidTag) userUidTag.textContent = `UID: ${user.uid} ${isAdmin ? ' (ADMIN MASTER)' : ''}`;
    
    if (lockScreen) lockScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    loadDataLocallyAndSync(user.uid);

    const userRef = doc(db, "licenses", user.uid);

    if (licenseUnsubscriber) {
      licenseUnsubscriber();
      licenseUnsubscriber = null;
    }

    try {
      const cachedLicenseStr = localStorage.getItem(`giti_license_${user.uid}`);
      if (cachedLicenseStr) {
        const licenseData = JSON.parse(cachedLicenseStr);
        applyLicenseData(licenseData);
      }
    } catch (e) {}

    licenseUnsubscriber = onSnapshot(userRef, async (snapshot) => {
      if (!snapshot.exists()) {
        await ensureUserLicense(user);
        return;
      }

      const licenseData = snapshot.data();
      if (licenseData) {
        localStorage.setItem(`giti_license_${user.uid}`, JSON.stringify(licenseData));
        applyLicenseData(licenseData);
      }
    }, (err) => {
      console.warn("License Snapshot Offline Fallback:", err);
    });

  } else {
    currentUser = null;
    if (adminBtn) adminBtn.classList.add('hidden');

    if (licenseUnsubscriber) {
      licenseUnsubscriber();
      licenseUnsubscriber = null;
    }

    detachCloudSync();
    if (mainApp) mainApp.classList.add('hidden');
    if (lockScreen) lockScreen.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
  }
});

function applyLicenseData(licenseData) {
  const adminNote = licenseData.adminNotes || licenseData.note || licenseData.notification;
  const notifContentEl = document.getElementById('notification-content-text');
  const notifBadgeEl = document.getElementById('notification-badge');
  
  if (notifContentEl) {
    if (adminNote) {
      notifContentEl.textContent = adminNote;
      const isRead = currentUser ? localStorage.getItem(`giti_${currentUser.uid}_notif_read`) : null;
      if (!isRead && notifBadgeEl) notifBadgeEl.classList.remove('hidden');
    } else {
      notifContentEl.textContent = "لا توجد ملاحظات جديدة من الإدارة حالياً.";
      if (notifBadgeEl) notifBadgeEl.classList.add('hidden');
    }
  }

  if (licenseData.isActive !== false) {
    if (lockScreen) lockScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    triggerAds();
  } else {
    if (mainApp) mainApp.classList.add('hidden');
    if (lockScreen) lockScreen.classList.remove('hidden');
    detachCloudSync();
  }
}

function loadDataLocallyAndSync(uid) {
  detachCloudSync();

  invoicesDB = getLocalData(uid, 'invoices', []);
  archivedInvoicesDB = getLocalData(uid, 'archived_invoices', []);
  clientsDB = getLocalData(uid, 'clients', []);
  suppliersDB = getLocalData(uid, 'suppliers', []);
  purchasesDB = getLocalData(uid, 'purchases', []);
  productsDB = getLocalData(uid, 'products', []);
  expensesDB = getLocalData(uid, 'expenses', []);
  
  const localProfile = getLocalData(uid, 'profile', null);
  if (localProfile) {
    storeProfile = Object.assign({}, storeProfile, localProfile);
    updateHeaderUI();
  }
  invoicesDB.sort((a, b) => b.id - a.id);
  archivedInvoicesDB.sort((a, b) => b.id - a.id);
  purchasesDB.sort((a, b) => b.id - a.id);
  updateNextInvoiceNumber();
  renderAllModules();
}

function detachCloudSync() {
  activeUnsubscribers.forEach(unsub => unsub());
  activeUnsubscribers = [];
}

async function syncDocToCloud(docName, payload) {
  if (!currentUser) return;
  saveLocalData(currentUser.uid, docName, payload);
  setDoc(doc(db, "users", currentUser.uid, "data", docName), payload).catch(() => {});
}

async function fetchAllDataFromCloud() {
  if (!currentUser) {
    alert('يرجى تسجيل الدخول أولاً لجلب البيانات.');
    return;
  }

  try {
    const uid = currentUser.uid;
    const invSnap = await getDocs(collection(db, "users", uid, "invoices"));
    invoicesDB = [];
    invSnap.forEach(d => invoicesDB.push(d.data()));
    invoicesDB.sort((a, b) => b.id - a.id);
    saveLocalData(uid, 'invoices', invoicesDB);

    const archSnap = await getDocs(collection(db, "users", uid, "archive"));
    archivedInvoicesDB = [];
    archSnap.forEach(d => archivedInvoicesDB.push(d.data()));
    archivedInvoicesDB.sort((a, b) => b.id - a.id);
    saveLocalData(uid, 'archived_invoices', archivedInvoicesDB);

    const clientSnap = await getDocs(collection(db, "users", uid, "clients"));
    clientsDB = [];
    clientSnap.forEach(d => clientsDB.push(d.data()));
    saveLocalData(uid, 'clients', clientsDB);

    const supplierSnap = await getDocs(collection(db, "users", uid, "suppliers"));
    suppliersDB = [];
    supplierSnap.forEach(d => suppliersDB.push(d.data()));
    saveLocalData(uid, 'suppliers', suppliersDB);

    const purchaseSnap = await getDocs(collection(db, "users", uid, "purchases"));
    purchasesDB = [];
    purchaseSnap.forEach(d => purchasesDB.push(d.data()));
    purchasesDB.sort((a, b) => b.id - a.id);
    saveLocalData(uid, 'purchases', purchasesDB);

    const prodSnap = await getDocs(collection(db, "users", uid, "products"));
    productsDB = [];
    prodSnap.forEach(d => productsDB.push(d.data()));
    saveLocalData(uid, 'products', productsDB);

    const expSnap = await getDocs(collection(db, "users", uid, "expenses"));
    expensesDB = [];
    expSnap.forEach(d => expensesDB.push(d.data()));
    saveLocalData(uid, 'expenses', expensesDB);

    const profSnap = await getDoc(doc(db, "users", uid, "data", "profile"));
    if (profSnap && profSnap.exists()) {
      storeProfile = Object.assign({}, storeProfile, profSnap.data());
      saveLocalData(uid, 'profile', storeProfile);
      updateHeaderUI();
    }

    updateNextInvoiceNumber();
    renderAllModules();
    alert('✅ تم جلب وتحديث جميع الفواتير والحسابات بنجاح من السحابة!');
  } catch (err) {
    console.error("Fetch Cloud Error:", err);
    alert('❌ تعذر جلب البيانات من السحابة (جاري العمل على البيانات المحلية المخزنة).');
  }
}

const fetchCloudBtn = document.getElementById('fetch-cloud-btn');
if (fetchCloudBtn) fetchCloudBtn.addEventListener('click', fetchAllDataFromCloud);

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
      if (isCapacitorNative && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) {
        try {
          const googleUser = await window.Capacitor.Plugins.GoogleAuth.signIn();
          const idToken = googleUser && googleUser.authentication ? googleUser.authentication.idToken : (googleUser ? googleUser.idToken : null);
          if (idToken) {
            const credential = GoogleAuthProvider.credential(idToken);
            const result = await signInWithCredential(auth, credential);
            await ensureUserLicense(result.user);
            return;
          }
        } catch (nativeErr) {
          if (authError) {
            authError.textContent = "فشل تسجيل الدخول عبر Google Auth.";
            authError.classList.remove('hidden');
          }
          return;
        }
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        if (result && result.user) await ensureUserLicense(result.user);
      }
    } catch (err) {
      if (authError) {
        authError.textContent = "فشل تسجيل الدخول. تأكد من اتصال الإنترنت.";
        authError.classList.remove('hidden');
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
      const newLicense = {
        email: email,
        storeName: storeName,
        isActive: true,
        role: email === 'haretg@gmail.com' ? "admin_master" : "user",
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "licenses", cred.user.uid), newLicense);
      localStorage.setItem(`giti_license_${cred.user.uid}`, JSON.stringify(newLicense));
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
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  if (isCapacitorNative && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) {
    try { await window.Capacitor.Plugins.GoogleAuth.signOut(); } catch (e) {}
  }
  signOut(auth);
});

const logoutLockBtn = document.getElementById('logout-lock-btn');
if (logoutLockBtn) logoutLockBtn.addEventListener('click', async () => {
  if (isCapacitorNative && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) {
    try { await window.Capacitor.Plugins.GoogleAuth.signOut(); } catch (e) {}
  }
  signOut(auth);
});

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

// ==========================================
// Sales Invoices System Engine
// ==========================================
const itemsBody = document.getElementById('items-body');
const discountInput = document.getElementById('discount-input');
const taxInput = document.getElementById('tax-input');
const subtotalDisplay = document.getElementById('subtotal-val');
const grandTotalDisplay = document.getElementById('grand-total-val');
const invNumberDisplay = document.getElementById('inv-number-display');

let nextInvNum = 1001;

function updateNextInvoiceNumber() {
  if (invoicesDB && invoicesDB.length > 0) {
    const validIds = invoicesDB.map(i => parseInt(i.id)).filter(id => !isNaN(id));
    const maxId = validIds.length > 0 ? Math.max(...validIds) : 1000;
    nextInvNum = maxId >= 1001 ? maxId + 1 : 1001;
  } else {
    nextInvNum = 1001;
  }
  localStorage.setItem('last_inv_num', nextInvNum.toString());
  if (invNumberDisplay && !editingInvoiceId) {
    invNumberDisplay.textContent = `#${nextInvNum}`;
  }
}

updateNextInvoiceNumber();

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
  const matchedProd = productsDB.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
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

window.handleItemFocus = (index, val) => showItemDropdown(index, val);

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

  const uid = currentUser ? currentUser.uid : 'local';

  let clientObj = clientsDB.find(c => c.name.toLowerCase() === clientName.toLowerCase());
  let assignedClientId = null;

  if (!clientObj) {
    assignedClientId = Date.now();
    clientObj = { id: assignedClientId, name: clientName, phone: clientPhone ? clientPhone : '', openingBalance: 0, payments: [] };
    clientsDB.push(clientObj);
  } else {
    if (!clientObj.id) clientObj.id = Date.now();
    assignedClientId = clientObj.id;
    if (clientPhone) clientObj.phone = clientPhone;
  }

  const totals = calculateTotals();
  const isoTime = new Date().toISOString();
  const status = payStatusSelect ? payStatusSelect.value : 'مدفوعة';
  let paidVal = totals.grandTotal;

  if (status === 'آجل / غير مدفوعة') paidVal = 0;
  else if (status === 'مدفوعة جزئياً') {
    const paidInput = document.getElementById('paid-amount-input');
    paidVal = paidInput ? (parseFloat(paidInput.value) ? parseFloat(paidInput.value) : 0) : 0;
  }

  const validIds = invoicesDB.map(i => parseInt(i.id)).filter(id => !isNaN(id));
  const maxId = validIds.length > 0 ? Math.max(...validIds) : 1000;
  const currentInvId = editingInvoiceId ? editingInvoiceId : (maxId >= 1001 ? maxId + 1 : 1001);
  const zatcaBase64 = generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, isoTime, totals.grandTotal, totals.taxAmount);

  const invoice = Object.assign({
    id: currentInvId,
    clientId: assignedClientId,
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
    const cleanSoldName = (soldItem.name || '').trim().toLowerCase();
    const prod = productsDB.find(p => (p.name || '').trim().toLowerCase() === cleanSoldName);
    if (prod) {
      prod.stock = Math.max(0, (parseFloat(prod.stock) || 0) - (parseFloat(soldItem.qty) || 0));
    }
  });

  if (editingInvoiceId) {
    invoicesDB = invoicesDB.map(i => i.id === editingInvoiceId ? invoice : i);
    editingInvoiceId = null;
  } else {
    invoicesDB.unshift(invoice);
  }

  saveLocalData(uid, 'invoices', invoicesDB);
  saveLocalData(uid, 'clients', clientsDB);
  saveLocalData(uid, 'products', productsDB);

  resetForm();
  renderAllModules();

  if (currentUser) {
    try {
      setDoc(doc(db, "users", uid, "invoices", String(invoice.id)), invoice).catch(() => {});
      setDoc(doc(db, "users", uid, "clients", String(clientObj.id)), clientObj).catch(() => {});
      validItems.forEach(soldItem => {
        const cleanSoldName = (soldItem.name || '').trim().toLowerCase();
        const prod = productsDB.find(p => (p.name || '').trim().toLowerCase() === cleanSoldName);
        if (prod) {
          setDoc(doc(db, "users", uid, "products", String(prod.id)), prod).catch(() => {});
        }
      });
    } catch (err) {}
  }

  return invoice;
}

const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    const inv = await saveInvoiceData();
    if (inv) alert('✅ تم حفظ الفاتورة وتحديث المخزن والحسابات بنجاح!');
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
  if (inv.discount > 0) msg += `🏷 *الخصم:* -${inv.discount.toFixed(2)} ${storeProfile.currency}\n`;
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

function populatePrintableInvoice(inv) {
  const prLogo = document.getElementById('pr-v-logo');
  if (prLogo) {
    if (storeProfile.logo) {
      prLogo.src = storeProfile.logo;
      prLogo.classList.remove('hidden');
    } else {
      prLogo.classList.add('hidden');
    }
  }

  const prStoreName = document.getElementById('pr-v-store-name');
  if (prStoreName) prStoreName.textContent = storeProfile.name;
  const prStorePhone = document.getElementById('pr-v-store-phone');
  if (prStorePhone) prStorePhone.textContent = storeProfile.phone ? `هاتف: ${storeProfile.phone}` : '';
  const prStoreVat = document.getElementById('pr-v-store-vat');
  if (prStoreVat) prStoreVat.textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';
  const prStoreAddress = document.getElementById('pr-v-store-address');
  if (prStoreAddress) prStoreAddress.textContent = storeProfile.address ? `العنوان: ${storeProfile.address}` : '';

  const prInvId = document.getElementById('pr-v-inv-id');
  if (prInvId) prInvId.textContent = `#${inv.id}`;
  const prDate = document.getElementById('pr-v-date');
  if (prDate) prDate.textContent = inv.date;
  const prClientName = document.getElementById('pr-v-client-name');
  if (prClientName) prClientName.textContent = inv.client;
  const prClientPhone = document.getElementById('pr-v-client-phone');
  if (prClientPhone) prClientPhone.textContent = inv.phone ? inv.phone : '-';
  const prPaymentStatus = document.getElementById('pr-v-payment-status');
  if (prPaymentStatus) prPaymentStatus.textContent = inv.status;

  const prSubtotal = document.getElementById('pr-v-subtotal');
  if (prSubtotal) prSubtotal.textContent = `${(inv.subtotal ? inv.subtotal : 0).toFixed(2)} ${storeProfile.currency}`;
  const prDiscount = document.getElementById('pr-v-discount');
  if (prDiscount) prDiscount.textContent = `${(inv.discount ? inv.discount : 0).toFixed(2)} ${storeProfile.currency}`;
  const prTax = document.getElementById('pr-v-tax');
  if (prTax) prTax.textContent = `${inv.taxPercent ? inv.taxPercent : 0}%`;
  const prTotal = document.getElementById('pr-v-total');
  if (prTotal) prTotal.textContent = `${(inv.grandTotal ? inv.grandTotal : 0).toFixed(2)} ${storeProfile.currency}`;

  const prItemsBody = document.getElementById('pr-v-items-body');
  if (prItemsBody) {
    prItemsBody.innerHTML = (inv.items ? inv.items : []).map(item => `
      <tr><td>${item.name}</td><td>${item.qty}</td><td>${item.price.toFixed(2)}</td><td>${(item.qty * item.price).toFixed(2)}</td></tr>
    `).join('');
  }

  renderQrCode('pr-preview-qrcode', inv.zatcaQr ? inv.zatcaQr : generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, inv.isoTime ? inv.isoTime : new Date().toISOString(), inv.grandTotal, inv.taxAmount ? inv.taxAmount : 0));
}

function openInvoicePreview(inv) {
  currentActiveInvoiceForPreview = inv;
  
  const viewModal = document.getElementById('view-modal');
  if (viewModal) viewModal.classList.remove('hidden');

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
  
  populatePrintableInvoice(inv);
}

const closeViewBtn = document.getElementById('close-view-btn');
if (closeViewBtn) {
  closeViewBtn.addEventListener('click', () => {
    const viewModal = document.getElementById('view-modal');
    if (viewModal) viewModal.classList.add('hidden');
  });
}

// ==========================================
// Image & PDF Export Controls
// ==========================================
const downloadImgBtn = document.getElementById('download-img-btn');
if (downloadImgBtn) {
  downloadImgBtn.addEventListener('click', async () => {
    if (!currentActiveInvoiceForPreview) return;
    const printableCard = document.getElementById('invoice-printable-card');
    if (!printableCard) return;

    if (typeof html2canvas === 'undefined') {
      alert('مكتبة معالجة الصور جاري تحميلها، يرجى إعادة المحاولة.');
      return;
    }

    try {
      downloadImgBtn.disabled = true;
      downloadImgBtn.textContent = 'جاري التجهيز... ⏳';

      populatePrintableInvoice(currentActiveInvoiceForPreview);
      printableCard.classList.add('rendering-active');
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvas = await html2canvas(printableCard, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: false, 
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        logging: false 
      });

      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `E-Invoice_${currentActiveInvoiceForPreview.id}.png`;

      await saveOrShareFile(dataUrl, fileName, 'image/png', 'الفاتورة الإلكترونية');

    } catch (err) {
      console.error("HTML2Canvas Render Error:", err);
      alert('حدث خطأ أثناء استخراج الصورة.');
    } finally {
      if (printableCard) printableCard.classList.remove('rendering-active');
      downloadImgBtn.disabled = false;
      downloadImgBtn.textContent = translations[currentLang]?.downloadImg || 'حفظ كصورة 🖼️';
    }
  });
}

const printViewBtn = document.getElementById('print-view-btn');
if (printViewBtn) {
  printViewBtn.addEventListener('click', async () => {
    if (currentActiveInvoiceForPreview) {
      populatePrintableInvoice(currentActiveInvoiceForPreview);
      await generateAndExportPdf('invoice-printable-card', `Invoice_${currentActiveInvoiceForPreview.id}.pdf`, `فاتورة مبيعات #${currentActiveInvoiceForPreview.id}`);
    }
  });
}

const printBtn = document.getElementById('print-btn');
if (printBtn) {
  printBtn.addEventListener('click', async () => {
    const inv = await saveInvoiceData();
    if (inv) {
      openInvoicePreview(inv);
      await generateAndExportPdf('invoice-printable-card', `Invoice_${inv.id}.pdf`, `فاتورة مبيعات #${inv.id}`);
    }
  });
}

function printInvoice(inv) {
  openInvoicePreview(inv);
  generateAndExportPdf('invoice-printable-card', `Invoice_${inv.id}.pdf`, `فاتورة مبيعات #${inv.id}`);
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
  updateNextInvoiceNumber();
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
          <button class="btn-sm" style="background:var(--warning); color:#fff" onclick="window.archiveInvoice(${inv.id})" title="أرشفة الفاتورة">📦 أرشفة</button>
          <button class="btn-sm" style="background:#25d366; color:#fff" onclick="window.sendWhatsAppById(${inv.id})">💬 واتساب</button>
          <button class="btn-sm" onclick="window.reprintInvoice(${inv.id})">🖨 طباعة / PDF</button>
          <button class="btn-sm" style="color:var(--danger)" onclick="window.deleteInvoice(${inv.id})">🗑️</button>
        </div>
      </div>
      <strong style="color:var(--accent); font-size: 1.05rem; white-space: nowrap;">${(inv.grandTotal ? inv.grandTotal : 0).toFixed(2)} ${storeProfile.currency}</strong>
    </li>
  `).join('');
}

// ==========================================
// Invoices Archive Module
// ==========================================
const openArchiveModalBtn = document.getElementById('open-archive-modal-btn');
const archiveModal = document.getElementById('archive-modal');
const closeArchiveModalBtn = document.getElementById('close-archive-modal-btn');

if (openArchiveModalBtn) {
  openArchiveModalBtn.addEventListener('click', () => {
    if (archiveModal) archiveModal.classList.remove('hidden');
    renderArchivedInvoices();
  });
}

if (closeArchiveModalBtn) {
  closeArchiveModalBtn.addEventListener('click', () => {
    if (archiveModal) archiveModal.classList.add('hidden');
  });
}

function renderArchivedInvoices(filter = '') {
  const container = document.getElementById('archive-invoices-container');
  if (!container) return;

  const f = (filter ? filter : '').toLowerCase();
  const filtered = archivedInvoicesDB.filter(inv => {
    const clientMatch = (inv.client ? inv.client : '').toLowerCase().includes(f);
    const idMatch = (inv.id ? inv.id : '').toString().includes(f);
    return clientMatch || idMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد فواتير مؤرشفة مطابقة.</p>';
    return;
  }

  container.innerHTML = filtered.map(inv => `
    <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 8px;">
      <div>
        <strong>#${inv.id} - ${inv.client}</strong>
        <br><small style="color:var(--text-muted);">📅 ${inv.date} • ${(inv.items ? inv.items : []).length} أصناف - ${(inv.grandTotal || 0).toFixed(2)} ${storeProfile.currency}</small>
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="btn-sm" style="background:var(--accent); color:#fff" onclick="window.viewArchivedInvoice(${inv.id})">👁️ معاينة</button>
        <button class="btn-sm" style="background:var(--success); color:#fff" onclick="window.restoreInvoice(${inv.id})">📂 استرجاع</button>
      </div>
    </li>
  `).join('');
}

const searchArchiveInput = document.getElementById('search-archive-input');
if (searchArchiveInput) {
  searchArchiveInput.addEventListener('input', (e) => renderArchivedInvoices(e.target.value));
}

window.viewArchivedInvoice = (id) => {
  const inv = archivedInvoicesDB.find(i => i.id === id);
  if (inv) openInvoicePreview(inv);
};

window.archiveInvoice = async (id) => {
  if (!confirm('هل تريد أرشفة هذه الفاتورة؟')) return;
  
  const invIndex = invoicesDB.findIndex(i => i.id === id);
  if (invIndex !== -1) {
    const invToArchive = invoicesDB.splice(invIndex, 1)[0];
    archivedInvoicesDB.unshift(invToArchive);

    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'invoices', invoicesDB);
    saveLocalData(uid, 'archived_invoices', archivedInvoicesDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "archive", String(invToArchive.id)), invToArchive).catch(() => {});
      deleteDoc(doc(db, "users", currentUser.uid, "invoices", String(id))).catch(() => {});
    }

    renderSavedInvoices();
    renderArchivedInvoices();
    alert('✅ تم أرشفة الفاتورة بنجاح!');
  }
};

window.restoreInvoice = async (id) => {
  if (!confirm('هل تريد استرجاع هذه الفاتورة إلى الفواتير الحية؟')) return;

  const archIndex = archivedInvoicesDB.findIndex(i => i.id === id);
  if (archIndex !== -1) {
    const invToRestore = archivedInvoicesDB.splice(archIndex, 1)[0];
    invoicesDB.unshift(invToRestore);
    invoicesDB.sort((a, b) => b.id - a.id);

    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'invoices', invoicesDB);
    saveLocalData(uid, 'archived_invoices', archivedInvoicesDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "invoices", String(invToRestore.id)), invToRestore).catch(() => {});
      deleteDoc(doc(db, "users", currentUser.uid, "archive", String(id))).catch(() => {});
    }

    renderSavedInvoices();
    renderArchivedInvoices();
    alert('✅ تم استرجاع الفاتورة إلى القائمة الرئيسية بنجاح!');
  }
};

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
  try {
    invoicesDB = invoicesDB.filter(i => i.id !== id);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'invoices', invoicesDB);

    if (currentUser) {
      deleteDoc(doc(db, "users", currentUser.uid, "invoices", String(id))).catch(() => {});
    }
    updateNextInvoiceNumber();
    renderAllModules();
  } catch (err) {
    console.error("Delete Invoice Error:", err);
  }
};

const searchInput = document.getElementById('search-input');
if (searchInput) searchInput.addEventListener('input', (e) => renderSavedInvoices(e.target.value));

// ==========================================
// Inventory / Products Management
// ==========================================
const productForm = document.getElementById('product-form');
if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('p-name');
    const priceEl = document.getElementById('p-price');
    const costEl = document.getElementById('p-cost');
    const stockEl = document.getElementById('p-stock');

    const name = nameEl ? nameEl.value.trim() : '';
    const price = priceEl ? (parseFloat(priceEl.value) ? parseFloat(priceEl.value) : 0) : 0;
    const cost = costEl ? (parseFloat(costEl.value) ? parseFloat(costEl.value) : 0) : 0;
    const stock = stockEl ? (parseInt(stockEl.value) ? parseInt(stockEl.value) : 0) : 0;

    if (!name) {
      alert('يرجى إدخال اسم المنتج');
      return;
    }

    let prodToSave;
    if (editingProductId !== null) {
      const idx = productsDB.findIndex(p => p.id === editingProductId);
      if (idx !== -1) {
        productsDB[idx] = Object.assign({}, productsDB[idx], { name, price, cost, stock });
        prodToSave = productsDB[idx];
      }
      editingProductId = null;
      
      const submitBtn = productForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = translations[currentLang]?.saveProduct || 'حفظ المنتج';
      
      const cancelBtn = document.getElementById('cancel-edit-prod-btn');
      if (cancelBtn) cancelBtn.remove();
    } else {
      prodToSave = { id: Date.now(), name, price, cost, stock };
      productsDB.push(prodToSave);
    }

    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'products', productsDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "products", String(prodToSave.id)), prodToSave).catch(() => {});
    }
    e.target.reset();
    renderAllModules();
    alert(editingProductId !== null ? '✅ تم تحديث بيانات المنتج بنجاح!' : '✅ تم حفظ المنتج في المخزن بنجاح!');
  });
}

function renderProducts() {
  const container = document.getElementById('products-list-container');
  if (!container) return;
  container.innerHTML = productsDB.map((p, idx) => `
    <li>
      <div style="flex: 1;">
        <strong>📦 ${p.name}</strong>
        <br><small style="color:var(--text-muted)">التكلفة: ${p.cost} ${storeProfile.currency} | المخزون: ${p.stock}</small>
      </div>
      <div style="text-align:left; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <strong style="color:var(--success)">${p.price} ${storeProfile.currency}</strong>
        <button class="btn-sm" style="background:var(--warning); color:#fff; padding: 4px 8px;" onclick="window.editProduct(${idx})" title="تعديل المنتج">✏️</button>
        <button class="btn-sm" style="color:var(--danger); padding: 4px 8px;" onclick="window.deleteProduct(${idx})" title="حذف المنتج">🗑️</button>
      </div>
    </li>
  `).join('');
}

window.editProduct = (index) => {
  const p = productsDB[index];
  if (!p) return;

  editingProductId = p.id;

  const nameEl = document.getElementById('p-name');
  const priceEl = document.getElementById('p-price');
  const costEl = document.getElementById('p-cost');
  const stockEl = document.getElementById('p-stock');

  if (nameEl) nameEl.value = p.name;
  if (priceEl) priceEl.value = p.price;
  if (costEl) costEl.value = p.cost;
  if (stockEl) stockEl.value = p.stock;

  const submitBtn = productForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = currentLang === 'ar' ? 'تحديث بيانات المنتج' : 'Update Product';

  if (!document.getElementById('cancel-edit-prod-btn')) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancel-edit-prod-btn';
    cancelBtn.className = 'btn-sm';
    cancelBtn.style.cssText = 'background: var(--danger); color: #fff; margin-top: 8px; width: 100%; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer;';
    cancelBtn.textContent = currentLang === 'ar' ? 'إلغاء التعديل ✕' : 'Cancel Edit ✕';
    cancelBtn.onclick = () => {
      editingProductId = null;
      if (productForm) productForm.reset();
      if (submitBtn) submitBtn.textContent = translations[currentLang]?.saveProduct || 'حفظ المنتج';
      cancelBtn.remove();
    };
    productForm.appendChild(cancelBtn);
  }

  productForm.scrollIntoView({ behavior: 'smooth' });
};

window.deleteProduct = async (idx) => {
  const p = productsDB[idx];
  if (!p || !confirm('⚠️ هل أنت متأكد من حذف هذا المنتج من المخزن؟')) return;
  try {
    productsDB.splice(idx, 1);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'products', productsDB);

    if (currentUser) {
      deleteDoc(doc(db, "users", currentUser.uid, "products", String(p.id))).catch(() => {});
    }
    renderAllModules();
  } catch (err) {
    console.error("Delete Product Error:", err);
  }
};

// ==========================================
// Clients & Ledger Management
// ==========================================
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

    const newClient = { id: Date.now(), name, phone, openingBalance, payments: [] };
    clientsDB.push(newClient);

    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'clients', clientsDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "clients", String(newClient.id)), newClient).catch(() => {});
    }
    e.target.reset();
    renderAllModules();
    alert('✅ تم حفظ العميل بنجاح');
  });
}

function getClientCalculatedLedger(clientParam) {
  let clientObj = null;
  if (typeof clientParam === 'string') {
    clientObj = clientsDB.find(c => c.name.toLowerCase() === clientParam.toLowerCase());
  } else if (clientParam && typeof clientParam === 'object') {
    clientObj = clientParam;
  }

  if (!clientObj) {
    clientObj = { name: typeof clientParam === 'string' ? clientParam : '', openingBalance: 0, payments: [] };
  }

  const clientInvoices = invoicesDB.filter(i => 
    (clientObj.id && i.clientId === clientObj.id) || 
    (i.client && clientObj.name && i.client.toLowerCase() === clientObj.name.toLowerCase())
  );

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

  container.innerHTML = filtered.map((c, index) => {
    const stats = getClientCalculatedLedger(c);
    const safeName = (c.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `
      <li>
        <div style="flex: 1;">
          <strong>👤 ${c.name}</strong> <small style="color:var(--text-muted)">(${c.phone ? c.phone : 'بدون رقم'})</small>
          <br><small style="color:var(--text-muted)">إجمالي التعاملات: ${stats.totalPurchases.toFixed(2)} | المدفوع: ${stats.totalPaid.toFixed(2)}</small>
        </div>
        <div style="text-align:left; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="badge ${stats.balance > 0 ? 'badge-unpaid' : 'badge-paid'}">
            ${stats.balance > 0 ? `مستحق: ${stats.balance.toFixed(2)}` : 'خالي المديونية'}
          </span>
          <button class="btn-sm" style="background:var(--accent); color:#fff" onclick="window.openClientLedger('${safeName}')">كشف 📄</button>
          <button class="btn-sm" style="background:var(--warning); color:#fff" onclick="window.editClient(${index})" title="تعديل العميل">✏️</button>
          <button class="btn-sm" style="color:var(--danger)" onclick="window.deleteClient(${index})" title="حذف العميل">🗑️</button>
        </div>
      </li>
    `;
  }).join('');
}

const searchClientsInput = document.getElementById('search-clients-input');
if (searchClientsInput) searchClientsInput.addEventListener('input', renderClients);

window.editClient = async (index) => {
  const client = clientsDB[index];
  if (!client) return;

  const newName = prompt('تعديل اسم العميل / الشركة:', client.name);
  if (newName === null) return;

  const newPhone = prompt('تعديل رقم الهاتف:', client.phone || '');
  if (newPhone === null) return;

  const newBalanceStr = prompt('تعديل الرصيد الافتتاحي (مديونية سابقة):', client.openingBalance || 0);
  if (newBalanceStr === null) return;

  const newBalance = parseFloat(newBalanceStr);
  if (isNaN(newBalance)) {
    alert('يرجى إدخال رقم صحيح للرصيد.');
    return;
  }

  const trimmedName = newName.trim();
  if (!trimmedName) {
    alert('اسم العميل لا يمكن أن يكون فارغاً.');
    return;
  }

  const exists = clientsDB.some((c, i) => i !== index && c.name.toLowerCase() === trimmedName.toLowerCase());
  if (exists) {
    alert('يوجد عميل آخر بنفس الاسم بالفعل!');
    return;
  }

  clientsDB[index] = Object.assign({}, client, {
    name: trimmedName,
    phone: newPhone.trim(),
    openingBalance: newBalance
  });

  const uid = currentUser ? currentUser.uid : 'local';
  saveLocalData(uid, 'clients', clientsDB);

  if (currentUser) {
    setDoc(doc(db, "users", currentUser.uid, "clients", String(clientsDB[index].id)), clientsDB[index]).catch(() => {});
  }
  renderAllModules();
  alert('✅ تم تعديل بيانات العميل بنجاح!');
};

window.deleteClient = async (index) => {
  const client = clientsDB[index];
  if (!client) return;

  if (!confirm(`⚠️ هل أنت متأكد من حذف العميل "${client.name}"؟`)) return;

  try {
    clientsDB.splice(index, 1);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'clients', clientsDB);

    if (currentUser) {
      deleteDoc(doc(db, "users", currentUser.uid, "clients", String(client.id))).catch(() => {});
    }
    renderAllModules();
  } catch (err) {
    console.error("Delete Client Error:", err);
  }
};

window.openClientLedger = (clientName) => {
  try {
    const clientObj = clientsDB.find(c => c.name.toLowerCase() === (clientName || '').toLowerCase());
    if (!clientObj) {
      alert('تعذر العثور على بيانات العميل!');
      return;
    }

    activeLedgerClientName = clientObj.name;
    const stats = getClientCalculatedLedger(clientObj);

    const ledgerTitle = document.getElementById('ledger-client-title');
    if (ledgerTitle) ledgerTitle.textContent = `👤 كشف حساب: ${clientObj.name}`;
    
    const ledgerTotalSales = document.getElementById('ledger-total-sales');
    if (ledgerTotalSales) ledgerTotalSales.textContent = `${stats.totalPurchases.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    
    const ledgerTotalPaid = document.getElementById('ledger-total-paid');
    if (ledgerTotalPaid) ledgerTotalPaid.textContent = `${stats.totalPaid.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    
    const ledgerBalance = document.getElementById('ledger-balance');
    if (ledgerBalance) ledgerBalance.textContent = `${stats.balance.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;

    const cardsList = document.getElementById('client-ledger-cards-list');
    if (cardsList) {
      let cardsHtml = '';

      if (clientObj.openingBalance && clientObj.openingBalance > 0) {
        cardsHtml += `
          <div class="ledger-item-card">
            <div class="lic-main">
              <div class="lic-title">رصيد افتتاحي (مديونية سابقة)</div>
            </div>
            <strong class="lic-price text-danger">${clientObj.openingBalance.toFixed(2)} ${storeProfile.currency || 'ج.م'}</strong>
          </div>
        `;
      }

      stats.clientInvoices.forEach(inv => {
        cardsHtml += `
          <div class="ledger-item-card" onclick="window.viewInvoiceById(${inv.id})" style="cursor:pointer;">
            <div class="lic-main">
              <div class="lic-title">فاتورة #${inv.id} <small style="color:#64748b;">(${inv.date || ''})</small></div>
              <div class="lic-sub">${(inv.items ? inv.items.length : 0)} أصناف - <span style="font-weight:bold;">${inv.status}</span></div>
            </div>
            <strong class="lic-price">${(inv.grandTotal || 0).toFixed(2)} ${storeProfile.currency || 'ج.م'}</strong>
          </div>
        `;
      });

      stats.payments.forEach((p, pIndex) => {
        const safeClientName = (clientObj.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        cardsHtml += `
          <div class="ledger-item-card pay-card">
            <div class="lic-main">
              <div class="lic-title text-success">دفعة سداد نقدي 💵 <small style="color:#64748b;">(${p.date || ''})</small></div>
              <div class="lic-sub" style="margin-top:4px;">
                <button class="btn-sm" style="background:#f59e0b; color:#fff; padding: 2px 6px;" onclick="event.stopPropagation(); window.editClientPayment('${safeClientName}', ${pIndex})">✏️</button>
                <button class="btn-sm" style="background:#ef4444; color:#fff; padding: 2px 6px;" onclick="event.stopPropagation(); window.deleteClientPayment('${safeClientName}', ${pIndex})">🗑️</button>
              </div>
            </div>
            <strong class="lic-price text-success">-${(p.amount || 0).toFixed(2)} ${storeProfile.currency || 'ج.م'}</strong>
          </div>
        `;
      });

      cardsList.innerHTML = cardsHtml ? cardsHtml : '<p style="text-align:center; color:#64748b; padding:15px;">لا توجد معاملات مسجلة</p>';
    }

    const clPrintSales = document.getElementById('cl-print-total-sales');
    if (clPrintSales) clPrintSales.textContent = `${stats.totalPurchases.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    const clPrintPaid = document.getElementById('cl-print-total-paid');
    if (clPrintPaid) clPrintPaid.textContent = `${stats.totalPaid.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    const clPrintBal = document.getElementById('cl-print-balance');
    if (clPrintBal) clPrintBal.textContent = `${stats.balance.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;

    const clLogo = document.getElementById('cl-logo');
    if (clLogo) {
      if (storeProfile.logo) {
        clLogo.src = storeProfile.logo;
        clLogo.classList.remove('hidden');
      } else {
        clLogo.classList.add('hidden');
      }
    }

    const clStoreName = document.getElementById('cl-store-name');
    if (clStoreName) clStoreName.textContent = storeProfile.name || 'اسم المنشأة';

    const clStorePhone = document.getElementById('cl-store-phone');
    if (clStorePhone) clStorePhone.textContent = storeProfile.phone ? `هاتف: ${storeProfile.phone}` : '';

    const clStoreVat = document.getElementById('cl-store-vat');
    if (clStoreVat) clStoreVat.textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';

    const clStoreAddress = document.getElementById('cl-store-address');
    if (clStoreAddress) clStoreAddress.textContent = storeProfile.address ? `العنوان: ${storeProfile.address}` : '';

    const clDate = document.getElementById('cl-date');
    if (clDate) clDate.textContent = new Date().toLocaleDateString('ar-EG');

    const clClientName = document.getElementById('cl-client-name');
    if (clClientName) clClientName.textContent = clientObj.name;

    const tableBody = document.getElementById('client-ledger-table-body');
    if (tableBody) {
      let rowsHtml = '';

      if (clientObj.openingBalance && clientObj.openingBalance > 0) {
        rowsHtml += `
          <tr>
            <td>رصيد افتتاحي (مديونية سابقة)</td>
            <td>-</td>
            <td>${clientObj.openingBalance.toFixed(2)} ${storeProfile.currency || 'ج.م'}</td>
          </tr>
        `;
      }

      stats.clientInvoices.forEach(inv => {
        rowsHtml += `
          <tr>
            <td>فاتورة مبيعات #${inv.id} (${(inv.items ? inv.items.length : 0)} أصناف - ${inv.status})</td>
            <td>${inv.date || '-'}</td>
            <td>${(inv.grandTotal || 0).toFixed(2)} ${storeProfile.currency || 'ج.م'}</td>
          </tr>
        `;
      });

      stats.payments.forEach((p) => {
        rowsHtml += `
          <tr style="background-color: #f0fdf4 !important;">
            <td>دفعة سداد نقدي 💵</td>
            <td>${p.date || '-'}</td>
            <td style="color:#059669; font-weight:bold;">-${p.amount.toFixed(2)} ${storeProfile.currency || 'ج.م'}</td>
          </tr>
        `;
      });

      tableBody.innerHTML = rowsHtml ? rowsHtml : '<tr><td colspan="3" style="text-align:center; color:#6b7280;">لا توجد معاملات مسجلة في كشف الحساب</td></tr>';
    }

    const ledgerModal = document.getElementById('client-ledger-modal');
    if (ledgerModal) ledgerModal.classList.remove('hidden');
  } catch (err) {
    console.error("Error in openClientLedger:", err);
  }
};

window.deleteClientPayment = async (clientName, paymentIndex) => {
  if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;
  const idx = clientsDB.findIndex(c => c.name.toLowerCase() === clientName.toLowerCase());
  if (idx !== -1 && clientsDB[idx].payments) {
    clientsDB[idx].payments.splice(paymentIndex, 1);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'clients', clientsDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "clients", String(clientsDB[idx].id)), clientsDB[idx]).catch(() => {});
    }
    window.openClientLedger(clientName);
    renderAllModules();
  }
};

window.editClientPayment = async (clientName, paymentIndex) => {
  const idx = clientsDB.findIndex(c => c.name.toLowerCase() === clientName.toLowerCase());
  if (idx !== -1 && clientsDB[idx].payments && clientsDB[idx].payments[paymentIndex]) {
    const currentAmount = clientsDB[idx].payments[paymentIndex].amount;
    const newAmountStr = prompt('تعديل قيمة الدفعة:', currentAmount);
    if (newAmountStr !== null) {
      const newAmount = parseFloat(newAmountStr);
      if (!isNaN(newAmount) && newAmount > 0) {
        clientsDB[idx].payments[paymentIndex].amount = newAmount;
        const uid = currentUser ? currentUser.uid : 'local';
        saveLocalData(uid, 'clients', clientsDB);

        if (currentUser) {
          setDoc(doc(db, "users", currentUser.uid, "clients", String(clientsDB[idx].id)), clientsDB[idx]).catch(() => {});
        }
        window.openClientLedger(clientName);
        renderAllModules();
      }
    }
  }
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
    const clientObj = clientsDB.find(c => c.name.toLowerCase() === activeLedgerClientName.toLowerCase());
    if (!clientObj) return;
    const stats = getClientCalculatedLedger(clientObj);
    let phone = (clientObj.phone ? clientObj.phone : '').replace(/[^0-9]/g, '');
    if (!phone) { alert('يرجى تسجيل رقم الهاتف للعميل أولاً في سجل العملاء'); return; }
    if (!phone.startsWith('20') && phone.length === 11) phone = '2' + phone;

    let msg = `*${storeProfile.name}*\n`;
    msg += `📄 *كشف حساب العميل:* ${activeLedgerClientName}\n`;
    msg += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
    msg += `-----------------------------------\n`;
    msg += `🛍 *إجمالي التعاملات:* ${stats.totalPurchases.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `✅ *إجمالي المدفوعات:* ${stats.totalPaid.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `📌 *الصافي / المديونية:* ${stats.balance.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `-----------------------------------\n`;
    msg += `شكراً لتعاملكم معنا!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

const ledgerDownloadBtn = document.getElementById('ledger-download-btn');
if (ledgerDownloadBtn) {
  ledgerDownloadBtn.addEventListener('click', async () => {
    const ledgerCard = document.getElementById('ledger-printable-card');
    if (ledgerCard && typeof html2canvas !== 'undefined') {
      try {
        ledgerDownloadBtn.disabled = true;
        ledgerDownloadBtn.textContent = 'جاري التجهيز... ⏳';

        ledgerCard.classList.add('rendering-active');
        await new Promise(resolve => setTimeout(resolve, 200));

        const canvas = await html2canvas(ledgerCard, { 
          scale: 2, 
          backgroundColor: '#ffffff', 
          useCORS: true, 
          allowTaint: false,
          width: 794,
          windowWidth: 794
        });

        const dataUrl = canvas.toDataURL('image/png');
        const fileName = `Statement_${activeLedgerClientName || 'Client'}_${Date.now()}.png`;

        await saveOrShareFile(dataUrl, fileName, 'image/png', `كشف حساب العميل: ${activeLedgerClientName}`);
      } catch (err) {
        console.error("Ledger Image Error:", err);
        alert("حدث خطأ أثناء تنزيل الصورة.");
      } finally {
        ledgerCard.classList.remove('rendering-active');
        ledgerDownloadBtn.disabled = false;
        ledgerDownloadBtn.textContent = 'صورة 🖼️';
      }
    }
  });
}

const ledgerPrintBtn = document.getElementById('ledger-print-btn');
if (ledgerPrintBtn) {
  ledgerPrintBtn.addEventListener('click', async () => {
    const ledgerCard = document.getElementById('ledger-printable-card');
    if (!activeLedgerClientName || !ledgerCard) return;

    try {
      ledgerCard.classList.add('rendering-active');
      await new Promise(resolve => setTimeout(resolve, 200));

      await generateAndExportPdf('ledger-printable-card', `Statement_${activeLedgerClientName}.pdf`, `كشف حساب العميل: ${activeLedgerClientName}`);
    } finally {
      ledgerCard.classList.remove('rendering-active');
    }
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
      
      if (payAmountInput) payAmountInput.value = '';
      window.openClientLedger(activeLedgerClientName);
      renderAllModules();

      const uid = currentUser ? currentUser.uid : 'local';
      saveLocalData(uid, 'clients', clientsDB);

      if (currentUser) {
        setDoc(doc(db, "users", currentUser.uid, "clients", String(clientsDB[idx].id)), clientsDB[idx]).catch(() => {});
      }
    }
  });
}

// ==========================================
// Suppliers & Purchasing Engine
// ==========================================
const supplierForm = document.getElementById('supplier-form');
if (supplierForm) {
  supplierForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sNameEl = document.getElementById('s-name');
    const sPhoneEl = document.getElementById('s-phone');
    const sBalanceEl = document.getElementById('s-balance');

    const name = sNameEl ? sNameEl.value.trim() : '';
    const phone = sPhoneEl ? sPhoneEl.value.trim() : '';
    const openingBalance = sBalanceEl ? (parseFloat(sBalanceEl.value) ? parseFloat(sBalanceEl.value) : 0) : 0;

    if (!name) { alert('يرجى إدخال اسم المورد'); return; }

    let supplierToSave;

    if (editingSupplierId !== null) {
      const idx = suppliersDB.findIndex(s => s.id === editingSupplierId);
      if (idx !== -1) {
        const exists = suppliersDB.some((s, i) => i !== idx && s.name.toLowerCase() === name.toLowerCase());
        if (exists) { alert('يوجد مورد آخر بنفس الاسم بالفعل!'); return; }
        suppliersDB[idx] = Object.assign({}, suppliersDB[idx], { name, phone, openingBalance });
        supplierToSave = suppliersDB[idx];
      }
      editingSupplierId = null;
      
      const submitBtn = supplierForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'حفظ بيانات المورد';
      const cancelBtn = document.getElementById('cancel-edit-supplier-btn');
      if (cancelBtn) cancelBtn.remove();
    } else {
      if (suppliersDB.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        alert('المورد موجود بالفعل!');
        return;
      }
      supplierToSave = { id: Date.now(), name, phone, openingBalance, payments: [] };
      suppliersDB.push(supplierToSave);
    }

    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'suppliers', suppliersDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "suppliers", String(supplierToSave.id)), supplierToSave).catch(() => {});
    }
    e.target.reset();
    renderAllModules();
    alert(editingSupplierId !== null ? '✅ تم تحديث بيانات المورد بنجاح!' : '✅ تم إضافة المورد بنجاح');
  });
}

function getSupplierCalculatedLedger(supplierParam) {
  let supplierObj = null;
  if (typeof supplierParam === 'string') {
    supplierObj = suppliersDB.find(s => s.name && s.name.toLowerCase() === supplierParam.toLowerCase());
  } else if (supplierParam && typeof supplierParam === 'object') {
    supplierObj = supplierParam;
  }

  if (!supplierObj) {
    supplierObj = { name: typeof supplierParam === 'string' ? supplierParam : '', openingBalance: 0, payments: [] };
  }

  const supplierPurchases = (purchasesDB || []).filter(p => 
    (supplierObj.id && p.supplierId === supplierObj.id) || 
    (p.supplier && supplierObj.name && p.supplier.toLowerCase() === supplierObj.name.toLowerCase())
  );

  let totalPurchases = parseFloat(supplierObj.openingBalance) || 0;
  let totalPaid = 0;

  supplierPurchases.forEach(p => {
    totalPurchases += (parseFloat(p.grandTotal) || 0);
    totalPaid += (parseFloat(p.paidAmount) || 0);
  });

  (supplierObj.payments || []).forEach(pay => {
    totalPaid += (parseFloat(pay.amount) || 0);
  });

  const balance = Math.max(0, totalPurchases - totalPaid);
  return { totalPurchases, totalPaid, balance, supplierPurchases, payments: supplierObj.payments || [] };
}

function renderSuppliers() {
  const container = document.getElementById('suppliers-list-container');
  if (!container) return;
  const searchSuppliersInput = document.getElementById('search-suppliers-input');
  const searchFilter = searchSuppliersInput ? searchSuppliersInput.value.toLowerCase() : '';
  const filtered = suppliersDB.filter(s => s.name && s.name.toLowerCase().includes(searchFilter));

  container.innerHTML = filtered.map((s, index) => {
    const stats = getSupplierCalculatedLedger(s);
    const safeName = (s.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
    return `
      <li>
        <div style="flex: 1;">
          <strong>🏭 ${s.name}</strong> <small style="color:var(--text-muted)">(${s.phone ? s.phone : 'بدون رقم'})</small>
          <br><small style="color:var(--text-muted)">إجمالي التوريدات: ${stats.totalPurchases.toFixed(2)} | المسدد: ${stats.totalPaid.toFixed(2)}</small>
        </div>
        <div style="text-align:left; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="badge ${stats.balance > 0 ? 'badge-unpaid' : 'badge-paid'}">
            ${stats.balance > 0 ? `مستحق للمورد: ${stats.balance.toFixed(2)}` : 'خالي المديونية'}
          </span>
          <button class="btn-sm" style="background:var(--accent); color:#fff" onclick="window.openSupplierLedger('${safeName}')">كشف 📄</button>
          <button class="btn-sm" style="background:var(--warning); color:#fff" onclick="window.editSupplier(${index})" title="تعديل المورد">✏️</button>
          <button class="btn-sm" style="color:var(--danger)" onclick="window.deleteSupplier(${index})" title="حذف المورد">🗑️</button>
        </div>
      </li>
    `;
  }).join('');
}

const searchSuppliersInput = document.getElementById('search-suppliers-input');
if (searchSuppliersInput) searchSuppliersInput.addEventListener('input', renderSuppliers);

window.editSupplier = (index) => {
  const supplier = suppliersDB[index];
  if (!supplier) return;

  editingSupplierId = supplier.id;

  const sNameEl = document.getElementById('s-name');
  const sPhoneEl = document.getElementById('s-phone');
  const sBalanceEl = document.getElementById('s-balance');

  if (sNameEl) sNameEl.value = supplier.name || '';
  if (sPhoneEl) sPhoneEl.value = supplier.phone || '';
  if (sBalanceEl) sBalanceEl.value = supplier.openingBalance || 0;

  const submitBtn = supplierForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'تحديث بيانات المورد 🔄';

  if (!document.getElementById('cancel-edit-supplier-btn')) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancel-edit-supplier-btn';
    cancelBtn.className = 'btn-sm';
    cancelBtn.style.cssText = 'background: var(--danger); color: #fff; margin-top: 8px; width: 100%; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer;';
    cancelBtn.textContent = 'إلغاء التعديل ✕';
    cancelBtn.onclick = () => {
      editingSupplierId = null;
      if (supplierForm) supplierForm.reset();
      if (submitBtn) submitBtn.textContent = 'حفظ بيانات المورد';
      cancelBtn.remove();
    };
    supplierForm.appendChild(cancelBtn);
  }

  supplierForm.scrollIntoView({ behavior: 'smooth' });
};

window.deleteSupplier = async (index) => {
  const supplier = suppliersDB[index];
  if (!supplier) return;

  if (!confirm(`⚠️ هل أنت متأكد من حذف المورد "${supplier.name}"؟`)) return;

  try {
    suppliersDB.splice(index, 1);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'suppliers', suppliersDB);

    if (currentUser) {
      deleteDoc(doc(db, "users", currentUser.uid, "suppliers", String(supplier.id))).catch(() => {});
    }
    renderAllModules();
  } catch (err) {
    console.error("Delete Supplier Error:", err);
  }
};

window.openSupplierLedger = (supplierName) => {
  try {
    const supplierObj = suppliersDB.find(s => s.name && s.name.toLowerCase() === (supplierName || '').toLowerCase());
    if (!supplierObj) {
      alert('تعذر العثور على بيانات المورد!');
      return;
    }

    activeLedgerSupplierName = supplierObj.name;
    const stats = getSupplierCalculatedLedger(supplierObj);

    const ledgerTitle = document.getElementById('ledger-supplier-title');
    if (ledgerTitle) ledgerTitle.textContent = `🏭 كشف حساب مورد: ${supplierObj.name}`;
    
    const ledgerTotalPurchases = document.getElementById('ledger-supplier-total-purchases');
    if (ledgerTotalPurchases) ledgerTotalPurchases.textContent = `${stats.totalPurchases.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    
    const ledgerTotalPaid = document.getElementById('ledger-supplier-total-paid');
    if (ledgerTotalPaid) ledgerTotalPaid.textContent = `${stats.totalPaid.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    
    const ledgerBalance = document.getElementById('ledger-supplier-balance');
    if (ledgerBalance) ledgerBalance.textContent = `${stats.balance.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;

    const cardsList = document.getElementById('supplier-ledger-cards-list');
    if (cardsList) {
      let cardsHtml = '';

      if (supplierObj.openingBalance && supplierObj.openingBalance > 0) {
        cardsHtml += `
          <div class="ledger-item-card">
            <div class="lic-main">
              <div class="lic-title">رصيد افتتاحي (مستحق سابقة للمورد)</div>
            </div>
            <strong class="lic-price text-danger">${supplierObj.openingBalance.toFixed(2)} ${storeProfile.currency || 'ج.م'}</strong>
          </div>
        `;
      }

      (stats.supplierPurchases || []).forEach(pur => {
        cardsHtml += `
          <div class="ledger-item-card" onclick="window.viewPurchaseById(${pur.id})" style="cursor:pointer;">
            <div class="lic-main">
              <div class="lic-title">فاتورة توريد #${pur.id} <small style="color:#64748b;">(${pur.date || ''})</small></div>
              <div class="lic-sub">${(pur.items ? pur.items.length : 0)} أصناف - <span style="font-weight:bold;">${pur.status}</span></div>
            </div>
            <strong class="lic-price">${(pur.grandTotal || 0).toFixed(2)} ${storeProfile.currency || 'ج.م'}</strong>
          </div>
        `;
      });

      (stats.payments || []).forEach((p, pIndex) => {
        const safeSupplierName = (supplierObj.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        cardsHtml += `
          <div class="ledger-item-card pay-card">
            <div class="lic-main">
              <div class="lic-title text-success">دفعة سداد نقدي للمورد 💵 <small style="color:#64748b;">(${p.date || ''})</small></div>
              <div class="lic-sub" style="margin-top:4px;">
                <button class="btn-sm" style="background:#f59e0b; color:#fff; padding: 2px 6px;" onclick="event.stopPropagation(); window.editSupplierPayment('${safeSupplierName}', ${pIndex})">✏️</button>
                <button class="btn-sm" style="background:#ef4444; color:#fff; padding: 2px 6px;" onclick="event.stopPropagation(); window.deleteSupplierPayment('${safeSupplierName}', ${pIndex})">🗑️</button>
              </div>
            </div>
            <strong class="lic-price text-success">-${(p.amount || 0).toFixed(2)} ${storeProfile.currency || 'ج.م'}</strong>
          </div>
        `;
      });

      cardsList.innerHTML = cardsHtml ? cardsHtml : '<p style="text-align:center; color:#64748b; padding:15px;">لا توجد معاملات مسجلة للمورد</p>';
    }

    const slPrintPurchases = document.getElementById('sl-print-total-purchases');
    if (slPrintPurchases) slPrintPurchases.textContent = `${stats.totalPurchases.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    const slPrintPaid = document.getElementById('sl-print-total-paid');
    if (slPrintPaid) slPrintPaid.textContent = `${stats.totalPaid.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;
    const slPrintBal = document.getElementById('sl-print-balance');
    if (slPrintBal) slPrintBal.textContent = `${stats.balance.toFixed(2)} ${storeProfile.currency || 'ج.م'}`;

    const slLogo = document.getElementById('sl-logo');
    if (slLogo) {
      if (storeProfile.logo) {
        slLogo.src = storeProfile.logo;
        slLogo.classList.remove('hidden');
      } else {
        slLogo.classList.add('hidden');
      }
    }

    const slStoreName = document.getElementById('sl-store-name');
    if (slStoreName) slStoreName.textContent = storeProfile.name || 'اسم المنشأة';

    const slStorePhone = document.getElementById('sl-store-phone');
    if (slStorePhone) slStorePhone.textContent = storeProfile.phone ? `هاتف: ${storeProfile.phone}` : '';

    const slStoreVat = document.getElementById('sl-store-vat');
    if (slStoreVat) slStoreVat.textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';

    const slDate = document.getElementById('sl-date');
    if (slDate) slDate.textContent = new Date().toLocaleDateString('ar-EG');

    const slSupplierName = document.getElementById('sl-supplier-name');
    if (slSupplierName) slSupplierName.textContent = supplierObj.name;

    const slSupplierPhone = document.getElementById('sl-supplier-phone');
    if (slSupplierPhone) slSupplierPhone.textContent = supplierObj.phone || 'غير مسجل';

    const tableBody = document.getElementById('supplier-ledger-table-body');
    if (tableBody) {
      let rowsHtml = '';

      if (supplierObj.openingBalance && supplierObj.openingBalance > 0) {
        rowsHtml += `
          <tr>
            <td>-</td>
            <td>رصيد افتتاحي (مستحق سابقة للمورد)</td>
            <td>${supplierObj.openingBalance.toFixed(2)} ${storeProfile.currency || 'ج.م'}</td>
            <td><span style="color:#dc2626; font-weight:bold;">مستحق للمورد</span></td>
          </tr>
        `;
      }

      (stats.supplierPurchases || []).forEach(pur => {
        rowsHtml += `
          <tr>
            <td>${pur.date || '-'}</td>
            <td>فاتورة توريد / مشتريات #${pur.id} (${(pur.items ? pur.items.length : 0)} أصناف)</td>
            <td>${(pur.grandTotal || 0).toFixed(2)} ${storeProfile.currency || 'ج.م'}</td>
            <td><span style="font-weight:bold; color:${pur.status === 'مدفوعة' ? '#059669' : (pur.status === 'مدفوعة جزئياً' ? '#d97706' : '#dc2626')};">${pur.status}</span></td>
          </tr>
        `;
      });

      (stats.payments || []).forEach((p) => {
        rowsHtml += `
          <tr style="background-color: #f0fdf4 !important;">
            <td>${p.date || '-'}</td>
            <td>دفعة سداد نقدي للمورد 💵</td>
            <td style="color:#059669; font-weight:bold;">-${(p.amount || 0).toFixed(2)} ${storeProfile.currency || 'ج.م'}</td>
            <td><span style="color:#059669; font-weight:bold;">تم السداد</span></td>
          </tr>
        `;
      });

      tableBody.innerHTML = rowsHtml ? rowsHtml : '<tr><td colspan="4" style="text-align:center; color:#6b7280;">لا توجد معاملات مسجلة للمورد</td></tr>';
    }

    const ledgerModal = document.getElementById('supplier-ledger-modal');
    if (ledgerModal) ledgerModal.classList.remove('hidden');
  } catch (err) {
    console.error("Error in openSupplierLedger:", err);
  }
};

const closeSupplierLedgerBtn = document.getElementById('close-supplier-ledger-btn');
if (closeSupplierLedgerBtn) {
  closeSupplierLedgerBtn.addEventListener('click', () => {
    const ledgerModal = document.getElementById('supplier-ledger-modal');
    if (ledgerModal) ledgerModal.classList.add('hidden');
  });
}

const submitSupplierPaymentBtn = document.getElementById('submit-supplier-payment-btn');
if (submitSupplierPaymentBtn) {
  submitSupplierPaymentBtn.addEventListener('click', async () => {
    const payAmountInput = document.getElementById('supplier-pay-amount-input');
    const amount = payAmountInput ? (parseFloat(payAmountInput.value) ? parseFloat(payAmountInput.value) : 0) : 0;
    if (amount <= 0 || !activeLedgerSupplierName) return;

    const idx = suppliersDB.findIndex(s => s.name.toLowerCase() === activeLedgerSupplierName.toLowerCase());
    if (idx !== -1) {
      if (!suppliersDB[idx].payments) suppliersDB[idx].payments = [];
      suppliersDB[idx].payments.push({ amount, date: new Date().toLocaleDateString('ar-EG') });
      
      if (payAmountInput) payAmountInput.value = '';
      window.openSupplierLedger(activeLedgerSupplierName);
      renderAllModules();

      const uid = currentUser ? currentUser.uid : 'local';
      saveLocalData(uid, 'suppliers', suppliersDB);

      if (currentUser) {
        setDoc(doc(db, "users", currentUser.uid, "suppliers", String(suppliersDB[idx].id)), suppliersDB[idx]).catch(() => {});
      }
    }
  });
}

window.deleteSupplierPayment = async (supplierName, paymentIndex) => {
  if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;
  const idx = suppliersDB.findIndex(s => s.name.toLowerCase() === supplierName.toLowerCase());
  if (idx !== -1 && suppliersDB[idx].payments) {
    suppliersDB[idx].payments.splice(paymentIndex, 1);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'suppliers', suppliersDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "suppliers", String(suppliersDB[idx].id)), suppliersDB[idx]).catch(() => {});
    }
    window.openSupplierLedger(supplierName);
    renderAllModules();
  }
};

window.editSupplierPayment = async (supplierName, paymentIndex) => {
  const idx = suppliersDB.findIndex(s => s.name.toLowerCase() === supplierName.toLowerCase());
  if (idx !== -1 && suppliersDB[idx].payments && suppliersDB[idx].payments[paymentIndex]) {
    const currentAmount = suppliersDB[idx].payments[paymentIndex].amount;
    const newAmountStr = prompt('تعديل قيمة الدفعة المسددة للمورد:', currentAmount);
    if (newAmountStr !== null) {
      const newAmount = parseFloat(newAmountStr);
      if (!isNaN(newAmount) && newAmount > 0) {
        suppliersDB[idx].payments[paymentIndex].amount = newAmount;
        const uid = currentUser ? currentUser.uid : 'local';
        saveLocalData(uid, 'suppliers', suppliersDB);

        if (currentUser) {
          setDoc(doc(db, "users", currentUser.uid, "suppliers", String(suppliersDB[idx].id)), suppliersDB[idx]).catch(() => {});
        }
        window.openSupplierLedger(supplierName);
        renderAllModules();
      }
    }
  }
};

const ledgerSupplierWhatsappBtn = document.getElementById('ledger-supplier-whatsapp-btn');
if (ledgerSupplierWhatsappBtn) {
  ledgerSupplierWhatsappBtn.addEventListener('click', () => {
    if (!activeLedgerSupplierName) return;
    const supplierObj = suppliersDB.find(s => s.name.toLowerCase() === activeLedgerSupplierName.toLowerCase());
    if (!supplierObj) return;
    const stats = getSupplierCalculatedLedger(supplierObj);
    let phone = (supplierObj.phone ? supplierObj.phone : '').replace(/[^0-9]/g, '');
    if (!phone) { alert('يرجى تسجيل رقم الهاتف للمورد أولاً'); return; }
    if (!phone.startsWith('20') && phone.length === 11) phone = '2' + phone;

    let msg = `*${storeProfile.name}*\n`;
    msg += `📄 *كشف حساب المورد:* ${activeLedgerSupplierName}\n`;
    msg += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
    msg += `-----------------------------------\n`;
    msg += `📦 *إجمالي المشتريات والتوريد:* ${stats.totalPurchases.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `✅ *إجمالي الدفعات المسددة:* ${stats.totalPaid.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `📌 *الصافي / المتبقي للمورد:* ${stats.balance.toFixed(2)} ${storeProfile.currency}\n`;
    msg += `-----------------------------------\n`;
    msg += `تحياتنا لكم!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

const ledgerSupplierDownloadBtn = document.getElementById('ledger-supplier-download-btn');
if (ledgerSupplierDownloadBtn) {
  ledgerSupplierDownloadBtn.addEventListener('click', async () => {
    const ledgerCard = document.getElementById('supplier-ledger-printable-card');
    if (ledgerCard && typeof html2canvas !== 'undefined') {
      try {
        ledgerSupplierDownloadBtn.disabled = true;
        ledgerSupplierDownloadBtn.textContent = 'جاري التجهيز... ⏳';

        ledgerCard.classList.add('rendering-active');
        await new Promise(resolve => setTimeout(resolve, 200));

        const canvas = await html2canvas(ledgerCard, { 
          scale: 2, 
          backgroundColor: '#ffffff', 
          useCORS: true, 
          allowTaint: false,
          width: 794,
          windowWidth: 794
        });

        const dataUrl = canvas.toDataURL('image/png');
        const fileName = `Supplier_Statement_${activeLedgerSupplierName || 'Supplier'}_${Date.now()}.png`;

        await saveOrShareFile(dataUrl, fileName, 'image/png', `كشف حساب المورد: ${activeLedgerSupplierName}`);
      } catch (err) {
        console.error("Supplier Ledger Image Error:", err);
        alert("حدث خطأ أثناء تنزيل الصورة.");
      } finally {
        ledgerCard.classList.remove('rendering-active');
        ledgerSupplierDownloadBtn.disabled = false;
        ledgerSupplierDownloadBtn.textContent = 'صورة 🖼️';
      }
    }
  });
}

const ledgerSupplierPrintBtn = document.getElementById('ledger-supplier-print-btn');
if (ledgerSupplierPrintBtn) {
  ledgerSupplierPrintBtn.addEventListener('click', async () => {
    const ledgerCard = document.getElementById('supplier-ledger-printable-card');
    if (!activeLedgerSupplierName || !ledgerCard) return;

    try {
      ledgerCard.classList.add('rendering-active');
      await new Promise(resolve => setTimeout(resolve, 200));

      await generateAndExportPdf('supplier-ledger-printable-card', `Supplier_Statement_${activeLedgerSupplierName}.pdf`, `كشف حساب المورد: ${activeLedgerSupplierName}`);
    } finally {
      ledgerCard.classList.remove('rendering-active');
    }
  });
}

const purchaseSupplierInput = document.getElementById('purchase-supplier-name');
const purchaseSupplierPhoneInput = document.getElementById('purchase-supplier-phone');
const purchaseSupplierSuggestions = document.getElementById('purchase-supplier-suggestions');

function showPurchaseSupplierDropdown(filter = '') {
  if (!purchaseSupplierSuggestions) return;
  const val = filter.trim().toLowerCase();
  const filtered = val === '' ? suppliersDB : suppliersDB.filter(s => s.name.toLowerCase().includes(val) || (s.phone && s.phone.includes(val)));

  if (filtered.length === 0) {
    purchaseSupplierSuggestions.classList.add('hidden');
    purchaseSupplierSuggestions.innerHTML = '';
    return;
  }

  purchaseSupplierSuggestions.innerHTML = filtered.map(s => `
    <div class="suggestion-item" onmousedown="event.preventDefault(); window.selectPurchaseSupplierItem('${s.name.replace(/'/g, "\\'")}', '${s.phone ? s.phone : ''}')" ontouchstart="window.selectPurchaseSupplierItem('${s.name.replace(/'/g, "\\'")}', '${s.phone ? s.phone : ''}')">
      <strong>🏭 ${s.name}</strong>
      <small style="color:var(--text-muted); display:block;">${s.phone ? s.phone : 'بدون رقم'}</small>
    </div>
  `).join('');
  purchaseSupplierSuggestions.classList.remove('hidden');
}

if (purchaseSupplierInput) {
  purchaseSupplierInput.addEventListener('input', (e) => {
    const val = e.target.value;
    const matched = suppliersDB.find(s => s.name.toLowerCase() === val.trim().toLowerCase());
    if (matched && matched.phone && purchaseSupplierPhoneInput) {
      purchaseSupplierPhoneInput.value = matched.phone;
    }
    showPurchaseSupplierDropdown(val);
  });
  purchaseSupplierInput.addEventListener('focus', () => showPurchaseSupplierDropdown(purchaseSupplierInput.value));
}

window.selectPurchaseSupplierItem = (name, phone) => {
  if (purchaseSupplierInput) purchaseSupplierInput.value = name;
  if (phone && purchaseSupplierPhoneInput) purchaseSupplierPhoneInput.value = phone;
  setTimeout(() => {
    if (purchaseSupplierSuggestions) purchaseSupplierSuggestions.classList.add('hidden');
  }, 100);
};

const purchaseItemsBody = document.getElementById('purchase-items-body');
const purchasePayStatus = document.getElementById('purchase-pay-status');
const purchasePaidWrapper = document.getElementById('purchase-paid-wrapper');
const purchasePaidAmountInput = document.getElementById('purchase-paid-amount');

if (purchasePayStatus) {
  purchasePayStatus.addEventListener('change', () => {
    if (purchasePayStatus.value === 'مدفوعة جزئياً') {
      if (purchasePaidWrapper) purchasePaidWrapper.classList.remove('hidden');
    } else {
      if (purchasePaidWrapper) purchasePaidWrapper.classList.add('hidden');
    }
  });
}

function renderPurchaseItemsTable() {
  if (!purchaseItemsBody) return;
  
  if (activePurchaseItems.length === 0) {
    activePurchaseItems.push({ name: '', qty: 1, cost: 0, price: 0 });
  }

  purchaseItemsBody.innerHTML = activePurchaseItems.map((item, index) => `
    <tr>
      <td>
        <div class="autocomplete-wrapper">
          <input type="text" autocomplete="off" value="${item.name ? item.name : ''}" placeholder="اسم المنتجات" 
                 oninput="window.handlePurchaseItemInput(${index}, this.value)"
                 onfocus="window.handlePurchaseItemFocus(${index}, this.value)">
          <div class="autocomplete-dropdown hidden" id="purchase-item-sug-${index}"></div>
        </div>
      </td>
      <td>
        <input type="number" value="${item.qty ? item.qty : 1}" min="1" oninput="window.updatePurchaseItem(${index}, 'qty', this.value)">
      </td>
      <td>
        <input type="number" value="${item.cost ? item.cost : 0}" min="0" step="0.5" oninput="window.updatePurchaseItem(${index}, 'cost', this.value)">
      </td>
      <td>
        <input type="number" value="${item.price ? item.price : 0}" min="0" step="0.5" oninput="window.updatePurchaseItem(${index}, 'price', this.value)">
      </td>
      <td>
        <span class="p-item-total-text">${(((item.qty ? item.qty : 0)) * ((item.cost ? item.cost : 0))).toFixed(2)}</span>
      </td>
      <td>
        <button type="button" class="btn-remove" onclick="window.removePurchaseItem(${index})">✕</button>
      </td>
    </tr>
  `).join('');
  calculatePurchaseTotals();
}

function showPurchaseItemDropdown(index, val) {
  const sugBox = document.getElementById(`purchase-item-sug-${index}`);
  if (!sugBox) return;

  const query = val.trim().toLowerCase();
  const filtered = query === '' ? productsDB : productsDB.filter(p => p.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    sugBox.classList.add('hidden');
    return;
  }

  sugBox.innerHTML = filtered.map(p => `
    <div class="suggestion-item" onmousedown="event.preventDefault(); window.selectPurchaseProductItem(${index}, '${p.name.replace(/'/g, "\\'")}', ${p.cost ? p.cost : 0}, ${p.price ? p.price : 0})" ontouchstart="window.selectPurchaseProductItem(${index}, '${p.name.replace(/'/g, "\\'")}', ${p.cost ? p.cost : 0}, ${p.price ? p.price : 0})">
      <strong>📦 ${p.name}</strong>
      <span style="color:var(--text-muted); float:left;">تكلفة: ${p.cost ? p.cost : 0} | بيع: ${p.price ? p.price : 0}</span>
    </div>
  `).join('');
  sugBox.classList.remove('hidden');
}

window.handlePurchaseItemInput = (index, val) => {
  if (activePurchaseItems[index]) activePurchaseItems[index].name = val;
  const matched = productsDB.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
  if (matched && activePurchaseItems[index]) {
    activePurchaseItems[index].cost = matched.cost ? matched.cost : 0;
    activePurchaseItems[index].price = matched.price ? matched.price : 0;
  }
  calculatePurchaseTotals();
  showPurchaseItemDropdown(index, val);
};

window.handlePurchaseItemFocus = (index, val) => showPurchaseItemDropdown(index, val);

window.selectPurchaseProductItem = (index, name, cost, price) => {
  if (activePurchaseItems[index]) {
    activePurchaseItems[index].name = name;
    activePurchaseItems[index].cost = cost;
    activePurchaseItems[index].price = price;
  }
  renderPurchaseItemsTable();
};

window.updatePurchaseItem = (index, key, val) => {
  if (activePurchaseItems[index]) {
    activePurchaseItems[index][key] = parseFloat(val) ? parseFloat(val) : 0;
  }
  calculatePurchaseTotals();
  if (purchaseItemsBody) {
    const rows = purchaseItemsBody.querySelectorAll('tr');
    if (rows[index] && activePurchaseItems[index]) {
      const totalSpan = rows[index].querySelector('.p-item-total-text');
      if (totalSpan) {
        totalSpan.textContent = (((activePurchaseItems[index].qty ? activePurchaseItems[index].qty : 0)) * ((activePurchaseItems[index].cost ? activePurchaseItems[index].cost : 0))).toFixed(2);
      }
    }
  }
};

window.removePurchaseItem = (index) => {
  activePurchaseItems.splice(index, 1);
  renderPurchaseItemsTable();
};

const addPurchaseItemBtn = document.getElementById('add-purchase-item-btn');
if (addPurchaseItemBtn) {
  addPurchaseItemBtn.addEventListener('click', () => {
    activePurchaseItems.push({ name: '', qty: 1, cost: 0, price: 0 });
    renderPurchaseItemsTable();
  });
}

function calculatePurchaseTotals() {
  const total = activePurchaseItems.reduce((acc, i) => acc + (((i.qty ? i.qty : 0)) * ((i.cost ? i.cost : 0))), 0);
  const totalEl = document.getElementById('purchase-grand-total');
  if (totalEl) totalEl.textContent = `${total.toFixed(2)} ${storeProfile.currency}`;
  return total;
}

const purchaseForm = document.getElementById('purchase-form');
if (purchaseForm) {
  purchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supplierName = purchaseSupplierInput ? purchaseSupplierInput.value.trim() : '';
    const supplierPhone = purchaseSupplierPhoneInput ? purchaseSupplierPhoneInput.value.trim() : '';
    const total = calculatePurchaseTotals();

    const validItems = activePurchaseItems.filter(i => (i.name ? i.name : '').trim() !== '' && i.qty > 0);

    if (!supplierName) { alert('يرجى كتابة أو اختيار اسم المورد'); return; }
    if (validItems.length === 0) { alert('يرجى إضافة صنف واحد على الأقل بفاتورة المشتريات'); return; }

    const uid = currentUser ? currentUser.uid : 'local';

    let supplierObj = suppliersDB.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
    if (!supplierObj) {
      supplierObj = { id: Date.now(), name: supplierName, phone: supplierPhone, openingBalance: 0, payments: [] };
      suppliersDB.push(supplierObj);
    } else if (supplierPhone) {
      supplierObj.phone = supplierPhone;
    }

    const status = purchasePayStatus ? purchasePayStatus.value : 'مدفوعة';
    let paidVal = total;
    if (status === 'آجل / غير مدفوعة') paidVal = 0;
    else if (status === 'مدفوعة جزئياً') {
      paidVal = purchasePaidAmountInput ? (parseFloat(purchasePaidAmountInput.value) ? parseFloat(purchasePaidAmountInput.value) : 0) : 0;
    }

    const isoTime = new Date().toISOString();
    const zatcaBase64 = generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, isoTime, total, 0);

    const purchaseInvoice = {
      id: Date.now(),
      supplierId: supplierObj.id,
      supplier: supplierName,
      phone: supplierPhone,
      items: validItems,
      grandTotal: total,
      paidAmount: paidVal,
      dueAmount: total - paidVal,
      status: status,
      date: new Date().toLocaleDateString('ar-EG'),
      isoTime: isoTime,
      zatcaQr: zatcaBase64
    };

    let modifiedProducts = [];
    validItems.forEach(item => {
      const cleanItemName = (item.name || '').trim().toLowerCase();
      let prod = productsDB.find(p => (p.name || '').trim().toLowerCase() === cleanItemName);
      if (prod) {
        prod.stock = (parseFloat(prod.stock) || 0) + (parseFloat(item.qty) || 0);
        if (item.cost > 0) prod.cost = parseFloat(item.cost);
        if (item.price > 0) prod.price = parseFloat(item.price);
        modifiedProducts.push(prod);
      } else {
        prod = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: item.name.trim(),
          cost: parseFloat(item.cost) || 0,
          price: parseFloat(item.price) || 0,
          stock: parseFloat(item.qty) || 0
        };
        productsDB.push(prod);
        modifiedProducts.push(prod);
      }
    });

    purchasesDB.unshift(purchaseInvoice);

    saveLocalData(uid, 'purchases', purchasesDB);
    saveLocalData(uid, 'suppliers', suppliersDB);
    saveLocalData(uid, 'products', productsDB);

    activePurchaseItems = [];
    if (purchaseSupplierInput) purchaseSupplierInput.value = '';
    if (purchaseSupplierPhoneInput) purchaseSupplierPhoneInput.value = '';
    renderPurchaseItemsTable();
    renderAllModules();

    if (currentUser) {
      try {
        setDoc(doc(db, "users", uid, "purchases", String(purchaseInvoice.id)), purchaseInvoice).catch(() => {});
        setDoc(doc(db, "users", uid, "suppliers", String(supplierObj.id)), supplierObj).catch(() => {});
        modifiedProducts.forEach(prod => {
          setDoc(doc(db, "users", uid, "products", String(prod.id)), prod).catch(() => {});
        });
      } catch (err) {}
    }

    alert('✅ تم حفظ فاتورة المشتريات، وتحديث الحسابات والمخزن بنجاح!');
  });
}

function renderPurchases() {
  const container = document.getElementById('purchases-list-container');
  if (!container) return;

  container.innerHTML = purchasesDB.map(pur => `
    <li onclick="window.viewPurchaseById(${pur.id})" style="cursor: pointer;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong>فاتورة توريد #${pur.id} - ${pur.supplier}</strong>
          <span class="badge ${pur.status === 'مدفوعة' ? 'badge-paid' : (pur.status === 'مدفوعة جزئياً' ? 'badge-partial' : 'badge-unpaid')}">${pur.status}</span>
        </div>
        <small style="color:var(--text-muted); display: block; margin-top: 2px;">
          📅 ${pur.date} • 📦 ${(pur.items ? pur.items : []).length} أصناف ${pur.phone ? '• 📞 ' + pur.phone : ''}
        </small>
        <div class="inv-actions" style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;" onclick="event.stopPropagation();">
          <button class="btn-sm" style="background:var(--accent); color:#fff" onclick="window.viewPurchaseById(${pur.id})">👁️ معاينة</button>
          <button class="btn-sm" style="background:#25d366; color:#fff" onclick="window.sendSupplierWhatsAppById(${pur.id})">💬 واتساب</button>
          <button class="btn-sm" onclick="window.reprintPurchase(${pur.id})">🖨 طباعة / PDF</button>
          <button class="btn-sm" style="color:var(--danger)" onclick="window.deletePurchase(${pur.id})">🗑️</button>
        </div>
      </div>
      <div style="text-align: left;">
        <strong style="color:var(--danger); font-size: 1.05rem;">-${(pur.grandTotal ? pur.grandTotal : 0).toFixed(2)} ${storeProfile.currency}</strong>
      </div>
    </li>
  `).join('');
}

let currentActivePurchaseForPreview = null;

function populatePrintableSupplierInvoice(pur) {
  const prLogo = document.getElementById('pr-sv-logo');
  if (prLogo) {
    if (storeProfile.logo) {
      prLogo.src = storeProfile.logo;
      prLogo.classList.remove('hidden');
    } else {
      prLogo.classList.add('hidden');
    }
  }

  const prStoreName = document.getElementById('pr-sv-store-name');
  if (prStoreName) prStoreName.textContent = storeProfile.name;
  const prStorePhone = document.getElementById('pr-sv-store-phone');
  if (prStorePhone) prStorePhone.textContent = storeProfile.phone ? `هاتف: ${storeProfile.phone}` : '';
  const prStoreVat = document.getElementById('pr-sv-store-vat');
  if (prStoreVat) prStoreVat.textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';
  const prStoreAddress = document.getElementById('pr-sv-store-address');
  if (prStoreAddress) prStoreAddress.textContent = storeProfile.address ? `العنوان: ${storeProfile.address}` : '';

  const prInvId = document.getElementById('pr-sv-inv-id');
  if (prInvId) prInvId.textContent = `#${pur.id}`;
  const prDate = document.getElementById('pr-sv-date');
  if (prDate) prDate.textContent = pur.date;
  const prSupplierName = document.getElementById('pr-sv-supplier-name');
  if (prSupplierName) prSupplierName.textContent = pur.supplier;
  const prSupplierPhone = document.getElementById('pr-sv-supplier-phone');
  if (prSupplierPhone) prSupplierPhone.textContent = pur.phone ? pur.phone : '-';
  const prPaymentStatus = document.getElementById('pr-sv-payment-status');
  if (prPaymentStatus) prPaymentStatus.textContent = pur.status;

  const prTotal = document.getElementById('pr-sv-total');
  if (prTotal) prTotal.textContent = `${(pur.grandTotal ? pur.grandTotal : 0).toFixed(2)} ${storeProfile.currency}`;

  const prItemsBody = document.getElementById('pr-sv-items-body');
  if (prItemsBody) {
    prItemsBody.innerHTML = (pur.items ? pur.items : []).map(item => `
      <tr><td>${item.name}</td><td>${item.qty}</td><td>${(item.cost ? item.cost : 0).toFixed(2)}</td><td>${(item.qty * (item.cost ? item.cost : 0)).toFixed(2)}</td></tr>
    `).join('');
  }

  renderQrCode('pr-supplier-preview-qrcode', pur.zatcaQr ? pur.zatcaQr : generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, pur.isoTime ? pur.isoTime : new Date().toISOString(), pur.grandTotal, 0));
}

function openSupplierInvoicePreview(pur) {
  currentActivePurchaseForPreview = pur;
  const modal = document.getElementById('supplier-view-modal');
  if (modal) modal.classList.remove('hidden');

  const vLogo = document.getElementById('sv-logo');
  if (vLogo) {
    if (storeProfile.logo) {
      vLogo.src = storeProfile.logo;
      vLogo.classList.remove('hidden');
    } else {
      vLogo.classList.add('hidden');
    }
  }

  const vStoreName = document.getElementById('sv-store-name');
  if (vStoreName) vStoreName.textContent = storeProfile.name;
  const vStorePhone = document.getElementById('sv-store-phone');
  if (vStorePhone) vStorePhone.textContent = storeProfile.phone;
  const vStoreVat = document.getElementById('sv-store-vat');
  if (vStoreVat) vStoreVat.textContent = storeProfile.vatNo ? `الرقم الضريبي: ${storeProfile.vatNo}` : '';
  const vStoreAddress = document.getElementById('sv-store-address');
  if (vStoreAddress) vStoreAddress.textContent = storeProfile.address;
  
  const vInvId = document.getElementById('sv-inv-id');
  if (vInvId) vInvId.textContent = `رقم فاتورة المشتريات: #${pur.id}`;
  const vDate = document.getElementById('sv-date');
  if (vDate) vDate.textContent = `التاريخ: ${pur.date}`;
  
  const vSupplierName = document.getElementById('sv-supplier-name');
  if (vSupplierName) vSupplierName.textContent = pur.supplier;
  const vSupplierPhone = document.getElementById('sv-supplier-phone');
  if (vSupplierPhone) vSupplierPhone.textContent = pur.phone ? pur.phone : '-';
  const vPaymentStatus = document.getElementById('sv-payment-status');
  if (vPaymentStatus) vPaymentStatus.textContent = pur.status;
  
  const vTotal = document.getElementById('sv-total');
  if (vTotal) vTotal.textContent = `${(pur.grandTotal ? pur.grandTotal : 0).toFixed(2)} ${storeProfile.currency}`;

  const vItemsBody = document.getElementById('sv-items-body');
  if (vItemsBody) {
    vItemsBody.innerHTML = (pur.items ? pur.items : []).map(item => `
      <tr><td>${item.name}</td><td>${item.qty}</td><td>${(item.cost ? item.cost : 0).toFixed(2)}</td><td>${(item.qty * (item.cost ? item.cost : 0)).toFixed(2)}</td></tr>
    `).join('');
  }

  renderQrCode('supplier-preview-qrcode', pur.zatcaQr ? pur.zatcaQr : generateZatcaTlvBase64(storeProfile.name, storeProfile.vatNo, pur.isoTime ? pur.isoTime : new Date().toISOString(), pur.grandTotal, 0));
  
  populatePrintableSupplierInvoice(pur);
}

const closeSupplierViewBtn = document.getElementById('close-supplier-view-btn');
if (closeSupplierViewBtn) {
  closeSupplierViewBtn.addEventListener('click', () => {
    const modal = document.getElementById('supplier-view-modal');
    if (modal) modal.classList.add('hidden');
  });
}

const supplierDownloadImgBtn = document.getElementById('supplier-download-img-btn');
if (supplierDownloadImgBtn) {
  supplierDownloadImgBtn.addEventListener('click', async () => {
    if (!currentActivePurchaseForPreview) return;
    const printableCard = document.getElementById('supplier-printable-card');
    if (printableCard && typeof html2canvas !== 'undefined') {
      try {
        supplierDownloadImgBtn.disabled = true;
        supplierDownloadImgBtn.textContent = 'جاري التجهيز... ⏳';

        populatePrintableSupplierInvoice(currentActivePurchaseForPreview);
        printableCard.classList.add('rendering-active');
        await new Promise(resolve => setTimeout(resolve, 200));

        const canvas = await html2canvas(printableCard, { 
          scale: 2, 
          useCORS: true, 
          allowTaint: false, 
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
          logging: false 
        });

        const dataUrl = canvas.toDataURL('image/png');
        const fileName = `Purchase_Invoice_${currentActivePurchaseForPreview.id}.png`;

        await saveOrShareFile(dataUrl, fileName, 'image/png', 'فاتورة المشتريات والتوريد');
      } catch (err) {
        console.error("Supplier Image Error:", err);
      } finally {
        if (printableCard) printableCard.classList.remove('rendering-active');
        supplierDownloadImgBtn.disabled = false;
        supplierDownloadImgBtn.textContent = 'تحميل كصورة 🖼️';
      }
    }
  });
}

const supplierPrintViewBtn = document.getElementById('supplier-print-view-btn');
if (supplierPrintViewBtn) {
  supplierPrintViewBtn.addEventListener('click', async () => {
    if (currentActivePurchaseForPreview) {
      populatePrintableSupplierInvoice(currentActivePurchaseForPreview);
      await generateAndExportPdf('supplier-printable-card', `Purchase_Invoice_${currentActivePurchaseForPreview.id}.pdf`, `فاتورة توريد #${currentActivePurchaseForPreview.id}`);
    }
  });
}

function printPurchaseInvoice(pur) {
  openSupplierInvoicePreview(pur);
  generateAndExportPdf('supplier-printable-card', `Purchase_Invoice_${pur.id}.pdf`, `فاتورة توريد #${pur.id}`);
}

function sendSupplierWhatsApp(pur) {
  let phone = (pur.phone ? pur.phone : '').replace(/[^0-9]/g, '');
  if (!phone) { alert('يرجى كتابة رقم الهاتف للمورد لإرسال الفاتورة عبر واتساب'); return; }
  if (!phone.startsWith('20') && phone.length === 11) phone = '2' + phone;

  let msg = `*${storeProfile.name}*\n`;
  msg += `🧾 *فاتورة مشتريات / توريد رقم:* #${pur.id}\n`;
  msg += `🏭 *المورد:* ${pur.supplier}\n`;
  msg += `📅 *التاريخ:* ${pur.date}\n`;
  msg += `-----------------------------------\n`;
  pur.items.forEach(i => {
    msg += `• ${i.name} (×${i.qty}) = ${(i.qty * (i.cost ? i.cost : 0)).toFixed(2)} ${storeProfile.currency}\n`;
  });
  msg += `-----------------------------------\n`;
  msg += `💰 *الإجمالي الكلي:* ${pur.grandTotal.toFixed(2)} ${storeProfile.currency}\n`;
  msg += `📌 *حالة الدفع:* ${pur.status}\n\n`;
  msg += `شكراً لكم!`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

window.viewPurchaseById = (id) => {
  const pur = purchasesDB.find(p => p.id === id);
  if (pur) openSupplierInvoicePreview(pur);
};

window.sendSupplierWhatsAppById = (id) => {
  const pur = purchasesDB.find(p => p.id === id);
  if (pur) sendSupplierWhatsApp(pur);
};

window.reprintPurchase = (id) => {
  const pur = purchasesDB.find(p => p.id === id);
  if (pur) printPurchaseInvoice(pur);
};

window.deletePurchase = async (id) => {
  if (!confirm('تأكيد حذف فاتورة المشتريات؟')) return;
  try {
    purchasesDB = purchasesDB.filter(p => p.id !== id);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'purchases', purchasesDB);

    if (currentUser) {
      deleteDoc(doc(db, "users", currentUser.uid, "purchases", String(id))).catch(() => {});
    }
    renderAllModules();
  } catch (err) {
    console.error("Delete Purchase Error:", err);
  }
};

// ==========================================
// Treasury & Expenses Engine
// ==========================================
const expenseForm = document.getElementById('expense-form');
if (expenseForm) {
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const expTitleEl = document.getElementById('exp-title');
    const expAmountEl = document.getElementById('exp-amount');
    const title = expTitleEl ? expTitleEl.value : '';
    const amount = expAmountEl ? (parseFloat(expAmountEl.value) ? parseFloat(expAmountEl.value) : 0) : 0;

    const newExp = { id: Date.now(), title, amount, date: new Date().toLocaleDateString('ar-EG') };
    expensesDB.push(newExp);

    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'expenses', expensesDB);

    if (currentUser) {
      setDoc(doc(db, "users", currentUser.uid, "expenses", String(newExp.id)), newExp).catch(() => {});
    }
    e.target.reset();
    renderAllModules();
    alert('✅ تم تسجيل المصروف بنجاح');
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
  const exp = expensesDB[idx];
  if (!exp) return;
  try {
    expensesDB.splice(idx, 1);
    const uid = currentUser ? currentUser.uid : 'local';
    saveLocalData(uid, 'expenses', expensesDB);

    if (currentUser) {
      deleteDoc(doc(db, "users", currentUser.uid, "expenses", String(exp.id))).catch(() => {});
    }
    renderAllModules();
  } catch (err) {
    console.error("Delete Expense Error:", err);
  }
};

function updateDashboardStats() {
  const totalSales = invoicesDB.reduce((acc, i) => acc + (i.grandTotal ? i.grandTotal : 0), 0);
  const totalExpensesAmount = expensesDB.reduce((acc, e) => acc + (e.amount ? e.amount : 0), 0);
  const netProfit = totalSales - totalExpensesAmount;

  let totalDebts = 0;
  clientsDB.forEach(c => {
    totalDebts += getClientCalculatedLedger(c).balance;
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

// ==========================================
// Backup, Import & CSV/Excel Export
// ==========================================
const exportJsonBtn = document.getElementById('export-json-btn');
if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', async () => {
    try {
      const data = { 
        invoices: invoicesDB, 
        archived_invoices: archivedInvoicesDB, 
        clients: clientsDB, 
        suppliers: suppliersDB, 
        purchases: purchasesDB, 
        products: productsDB, 
        expenses: expensesDB, 
        storeProfile 
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      const fileName = `backup_cloud_${Date.now()}.json`;
      const blob = new Blob([jsonString], { type: 'application/json' });

      const success = await saveOrShareFile(blob, fileName, 'application/json', 'النسخة الاحتياطية للبيانات');
      
      if (!success) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(jsonString);
          alert('📋 تم نسخ بيانات النسخة الاحتياطية للحافظة بنجاح!');
        }
      }
    } catch (err) {
      console.error("Export JSON Error:", err);
      alert("حدث خطأ أثناء استخراج النسخة الاحتياطية.");
    }
  });
}

const importJsonInput = document.getElementById('import-json-input');
if (importJsonInput) {
  importJsonInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        
        if (!importedData || typeof importedData !== 'object') {
          throw new Error('ملف التنسيق غير صالح');
        }

        if (confirm('⚠️ هل أنت متأكد من استيراد هذه النسخة الاحتياطية؟ سيتم دمج البيانات وتحديثها فوراً.')) {
          const uid = currentUser ? currentUser.uid : 'local';

          if (Array.isArray(importedData.invoices)) {
            invoicesDB = importedData.invoices;
            saveLocalData(uid, 'invoices', invoicesDB);
            if (currentUser) invoicesDB.forEach(inv => setDoc(doc(db, "users", uid, "invoices", String(inv.id)), inv).catch(() => {}));
          }
          if (Array.isArray(importedData.archived_invoices)) {
            archivedInvoicesDB = importedData.archived_invoices;
            saveLocalData(uid, 'archived_invoices', archivedInvoicesDB);
            if (currentUser) archivedInvoicesDB.forEach(inv => setDoc(doc(db, "users", uid, "archive", String(inv.id)), inv).catch(() => {}));
          }
          if (Array.isArray(importedData.clients)) {
            clientsDB = importedData.clients;
            saveLocalData(uid, 'clients', clientsDB);
            if (currentUser) clientsDB.forEach(c => setDoc(doc(db, "users", uid, "clients", String(c.id)), c).catch(() => {}));
          }
          if (Array.isArray(importedData.suppliers)) {
            suppliersDB = importedData.suppliers;
            saveLocalData(uid, 'suppliers', suppliersDB);
            if (currentUser) suppliersDB.forEach(s => setDoc(doc(db, "users", uid, "suppliers", String(s.id)), s).catch(() => {}));
          }
          if (Array.isArray(importedData.purchases)) {
            purchasesDB = importedData.purchases;
            saveLocalData(uid, 'purchases', purchasesDB);
            if (currentUser) purchasesDB.forEach(pur => setDoc(doc(db, "users", uid, "purchases", String(pur.id)), pur).catch(() => {}));
          }
          if (Array.isArray(importedData.products)) {
            productsDB = importedData.products;
            saveLocalData(uid, 'products', productsDB);
            if (currentUser) productsDB.forEach(p => setDoc(doc(db, "users", uid, "products", String(p.id)), p).catch(() => {}));
          }
          if (Array.isArray(importedData.expenses)) {
            expensesDB = importedData.expenses;
            saveLocalData(uid, 'expenses', expensesDB);
            if (currentUser) expensesDB.forEach(exp => setDoc(doc(db, "users", uid, "expenses", String(exp.id)), exp).catch(() => {}));
          }
          if (importedData.storeProfile) {
            storeProfile = Object.assign({}, storeProfile, importedData.storeProfile);
            saveLocalData(uid, 'profile', storeProfile);
            if (currentUser) setDoc(doc(db, "users", uid, "data", "profile"), storeProfile).catch(() => {});
          }

          updateNextInvoiceNumber();
          alert('✅ تم استيراد وحفظ النسخة الاحتياطية بنجاح!');
          renderAllModules();
          updateHeaderUI();
        }
      } catch (error) {
        alert('❌ حدث خطأ أثناء قراءة الملف. تأكد من اختيار ملف JSON صحيح.');
        console.error("Import JSON Error:", error);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  });
}

const exportCsvBtn = document.getElementById('export-csv-btn');
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', async () => {
    try {
      let csv = 'رقم الفاتورة,العميل,الهاتف,الحالة,التاريخ,الإجمالي\n';
      invoicesDB.forEach(inv => {
        csv += `${inv.id},"${inv.client}","${inv.phone ? inv.phone : ''}",${inv.status},${inv.date},${inv.grandTotal}\n`;
      });

      const fileName = `sales_report_${Date.now()}.csv`;
      const csvContent = "\ufeff" + csv;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

      await saveOrShareFile(blob, fileName, 'text/csv', 'تقرير فواتير المبيعات Excel');
    } catch (err) {
      console.error("Export CSV Error:", err);
      alert("حدث خطأ أثناء استخراج التقرير.");
    }
  });
}

// ==========================================
// System Settings
// ==========================================
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
      const uid = currentUser ? currentUser.uid : 'local';
      saveLocalData(uid, 'profile', storeProfile);

      if (currentUser) {
        await syncDocToCloud('profile', storeProfile);
      }
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
  renderArchivedInvoices();
  renderProducts();
  renderClients();
  renderSuppliers();
  renderPurchaseItemsTable();
  renderPurchases();
  renderExpenses();
  updateDashboardStats();
}

// ==========================================
// Application Bootstrapping
// ==========================================
applyTheme(localStorage.getItem('app_theme') ? localStorage.getItem('app_theme') : 'dark');
applyLanguage(currentLang);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn("SW Registration Error:", err);
    });
  });
}

updateHeaderUI();
if (addItemBtn) addItemBtn.click();
renderPurchaseItemsTable();
