import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. إعدادات Firebase
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

// معرف الجهاز/المستخدم (يمكن استبداله بـ UID الخاص بـ Auth)
const DEVICE_ACCOUNT_ID = localStorage.getItem('device_id') || 'USER_DEVICE_001';
localStorage.setItem('device_id', DEVICE_ACCOUNT_ID);

const lockScreen = document.getElementById('lock-screen');
const statusBadge = document.getElementById('account-status');

// 2. الاستماع اللحظي لحالة التفعيل من Admin Master
function listenToAccountControl() {
  const userRef = doc(db, "licenses", DEVICE_ACCOUNT_ID);

  onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      
      if (data.isActive === true) {
        // الحساب نشط
        lockScreen.classList.add('hidden');
        statusBadge.textContent = "الحساب مفعل";
        statusBadge.style.background = "#22c55e";
      } else {
        // الأدمن قام بإيقاف الحساب
        lockScreen.classList.remove('hidden');
        statusBadge.textContent = "الحساب معطل";
        statusBadge.style.background = "#ef4444";
      }
    } else {
      // الحساب غير موجود في قاعدة البيانات -> يتطلب موافقة الأدمن
      lockScreen.classList.remove('hidden');
      statusBadge.textContent = "في انتظار موافقة الأدمن";
      statusBadge.style.background = "#f59e0b";
    }
  }, (error) => {
    console.error("خطأ في الاتصال بالخادم:", error);
    // في حالة انقطاع النت تماماً، يتم الاعتماد على آخر حالة مسجلة
    checkOfflinePermission();
  });
}

// 3. إدارة الفواتير محلياً 100% (LocalStorage / IndexedDB)
const saveBtn = document.getElementById('save-btn');
const invoicesContainer = document.getElementById('invoices-container');

function getLocalInvoices() {
  return JSON.parse(localStorage.getItem('invoices_db') || '[]');
}

function renderInvoices() {
  const invoices = getLocalInvoices();
  invoicesContainer.innerHTML = invoices.map(inv => `
    <li>
      <span>${inv.client}</span>
      <strong>${inv.amount} ج.م</strong>
      <small>${inv.date}</small>
    </li>
  `).join('');
}

saveBtn.addEventListener('click', () => {
  const client = document.getElementById('client-name').value;
  const amount = document.getElementById('invoice-amount').value;

  if (!client || !amount) return alert('يرجى إدخال البيانات');

  const newInvoice = {
    id: Date.now(),
    client,
    amount,
    date: new Date().toLocaleDateString('ar-EG')
  };

  const invoices = getLocalInvoices();
  invoices.push(newInvoice);
  localStorage.setItem('invoices_db', JSON.stringify(invoices));

  document.getElementById('client-name').value = '';
  document.getElementById('invoice-amount').value = '';
  renderInvoices();
});

// التشغيل الأولي
listenToAccountControl();
renderInvoices();

