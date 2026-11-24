import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================================
// GITI Core Plus v1.2 - Modular Extension Engine (Zero-Intrusion Architecture)
// المهام:
// 1. ملخص الخزينة ودرج الكاش الفعلي (Live Cash Drawer)
// 2. رادار نواقص المخزن الذكي (Low-Stock Radar)
// 3. ماسح الباركود بالكاميرا (Smart Barcode Scanner)
// 4. حارس النسخ الاحتياطي الوقائي (Backup Guard)
// 5. محرك طباعة الإيصالات الحرارية (Thermal Receipt 80mm & 58mm)
// 6. تسوية المخزن عند حذف الفواتير/المشتريات + حماية فواصل الطباعة (Stock & Print Guard)
// ============================================================================

(function initGitiCorePlus() {
  const LOW_STOCK_THRESHOLD = 5;
  let lowStockFilterActive = false;
  let activeThermalInvoice = null;
  let thermalPaperWidth = localStorage.getItem('giti_thermal_width') || '80mm';

  // ==========================================================================
  // أدوات مساعدة لقراءة البيانات ومشاركة الملفات (متوافقة مع Capacitor & Web)
  // ==========================================================================
  function getActiveUid() {
    const uidTag = document.getElementById('user-uid-tag');
    if (uidTag && uidTag.textContent.includes('UID:')) {
      const match = uidTag.textContent.match(/UID:\s*([^\s(]+)/);
      if (match && match[1]) return match[1];
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('giti_') && key.endsWith('_invoices') && key !== 'giti_local_invoices') {
        return key.replace('giti_', '').replace('_invoices', '');
      }
    }
    return 'local';
  }

  function readStore(key, fallback = []) {
    const uid = getActiveUid();
    try {
      const raw = localStorage.getItem(`giti_${uid}_${key}`) || localStorage.getItem(`giti_local_${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getStoreProfile() {
    return readStore('profile', {
      name: 'GITI Enterprise ERP',
      phone: '',
      address: '',
      currency: 'ج.م',
      vatNo: '',
      logo: ''
    });
  }

  function getCurrency() {
    return getStoreProfile().currency || 'ج.م';
  }

  function findInvoiceById(id) {
    const numId = parseInt(String(id).replace(/[^0-9]/g, ''), 10);
    if (isNaN(numId)) return null;
    const active = readStore('invoices', []);
    const archived = readStore('archived_invoices', []);
    return active.find(i => parseInt(i.id, 10) === numId) || archived.find(i => parseInt(i.id, 10) === numId) || null;
  }

  async function shareOrDownloadThermalFile(dataUrlOrBlob, fileName, mimeType, shareTitle) {
    try {
      let base64Data = '';
      let blob;

      if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.startsWith('data:')) {
        base64Data = dataUrlOrBlob.split(',')[1];
        const res = await fetch(dataUrlOrBlob);
        blob = await res.blob();
      } else if (dataUrlOrBlob instanceof Blob) {
        blob = dataUrlOrBlob;
        base64Data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
      if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem && window.Capacitor.Plugins.Share) {
        const saved = await window.Capacitor.Plugins.Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: 'CACHE'
        });
        await window.Capacitor.Plugins.Share.share({
          title: shareTitle,
          text: shareTitle,
          url: saved.uri,
          dialogTitle: shareTitle
        });
        return true;
      }

      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: shareTitle });
          return true;
        } catch (err) {
          if (err.name === 'AbortError') return true;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (err) {
      console.error('Thermal Export Error:', err);
      alert('⚠️ تعذر تصدير الإيصال الحراري.');
      return false;
    }
  }

  // مراقبة أي تحديث في البيانات داخل localStorage لتحديث الإضافات تلقائياً
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (typeof key === 'string' && key.startsWith('giti_')) {
      setTimeout(refreshAllAddons, 80);
    }
  };

  // ==========================================================================
  // 1. حاسبة الخزينة الفعلي ودرج الكاش (Live Cash Drawer)
  // ==========================================================================
  function renderCashDrawerSummary() {
    const expensesTab = document.getElementById('tab-expenses');
    if (!expensesTab) return;

    let widget = document.getElementById('giti-cash-drawer-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'giti-cash-drawer-widget';
      widget.className = 'card';
      widget.style.cssText = 'margin-bottom: 16px; border: 1px solid var(--accent); background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(16,185,129,0.08));';
      expensesTab.insertBefore(widget, expensesTab.firstChild);
    }

    const invoices = readStore('invoices', []);
    const clients = readStore('clients', []);
    const purchases = readStore('purchases', []);
    const suppliers = readStore('suppliers', []);
    const clientReturns = readStore('client_returns', []);
    const supplierReturns = readStore('supplier_returns', []);
    const expenses = readStore('expenses', []);
    const currency = getCurrency();

    const cashFromSales = invoices.reduce((sum, inv) => sum + (parseFloat(inv.paidAmount) || 0), 0);
    const cashFromClientPayments = clients.reduce((sum, c) => {
      return sum + (c.payments || []).reduce((pSum, p) => pSum + (parseFloat(p.amount) || 0), 0);
    }, 0);
    const cashFromSupplierReturns = supplierReturns
      .filter(r => r.settlement === 'نقدي')
      .reduce((sum, r) => sum + (parseFloat(r.grandTotal) || 0), 0);

    const totalCashIn = cashFromSales + cashFromClientPayments + cashFromSupplierReturns;

    const cashToPurchases = purchases.reduce((sum, pur) => sum + (parseFloat(pur.paidAmount) || 0), 0);
    const cashToSupplierPayments = suppliers.reduce((sum, s) => {
      return sum + (s.payments || []).reduce((pSum, p) => pSum + (parseFloat(p.amount) || 0), 0);
    }, 0);
    const cashToClientReturns = clientReturns
      .filter(r => r.settlement === 'نقدي')
      .reduce((sum, r) => sum + (parseFloat(r.grandTotal) || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalCashOut = cashToPurchases + cashToSupplierPayments + cashToClientReturns + totalExpenses;
    const netDrawerCash = totalCashIn - totalCashOut;

    widget.innerHTML = `
      <div class="card-header" style="margin-bottom: 10px;">
        <h3 style="font-size: 1rem;">💰 ملخص الخزينة ودرج الكاش الفعلي</h3>
        <span class="badge ${netDrawerCash >= 0 ? 'badge-paid' : 'badge-unpaid'}">
          ${netDrawerCash >= 0 ? 'فائض نقدي' : 'عجز نقدي'}
        </span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; text-align: center;">
        <div style="background: var(--input-bg); padding: 10px; border-radius: 10px; border: 1px solid var(--border-color);">
          <small style="color: var(--text-muted); display: block;">📥 إجمالي المقبوضات</small>
          <strong style="color: var(--success); font-size: 1rem;">+${totalCashIn.toFixed(2)} ${currency}</strong>
        </div>
        <div style="background: var(--input-bg); padding: 10px; border-radius: 10px; border: 1px solid var(--border-color);">
          <small style="color: var(--text-muted); display: block;">📤 مدفوعات ومصروفات</small>
          <strong style="color: var(--danger); font-size: 1rem;">-${totalCashOut.toFixed(2)} ${currency}</strong>
        </div>
        <div style="background: var(--input-bg); padding: 10px; border-radius: 10px; border: 1px solid var(--accent);">
          <small style="color: var(--text-muted); display: block;">🏦 صافي الكاش بالدرج</small>
          <strong style="color: ${netDrawerCash >= 0 ? 'var(--accent)' : 'var(--danger)'}; font-size: 1.15rem;">
            ${netDrawerCash.toFixed(2)} ${currency}
          </strong>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 2. رادار نواقص المخزن الذكي (Low-Stock Radar)
  // ==========================================================================
  function updateLowStockRadar() {
    const products = readStore('products', []);
    const lowItems = products.filter(p => (parseFloat(p.stock) || 0) <= LOW_STOCK_THRESHOLD);

    const prodTabBtn = document.querySelector('.nav-tab[data-tab="products"]');
    if (prodTabBtn) {
      let badge = document.getElementById('giti-low-stock-badge');
      if (lowItems.length > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.id = 'giti-low-stock-badge';
          badge.style.cssText = 'background: var(--danger); color: #fff; font-size: 0.7rem; padding: 1px 6px; border-radius: 99px; margin-right: 5px; font-weight: 800;';
          prodTabBtn.appendChild(badge);
        }
        badge.textContent = `${lowItems.length} نواقص`;
      } else if (badge) {
        badge.remove();
      }
    }

    const prodListContainer = document.getElementById('products-list-container');
    if (prodListContainer && prodListContainer.parentElement) {
      let filterBar = document.getElementById('giti-stock-filter-bar');
      if (!filterBar) {
        filterBar = document.createElement('div');
        filterBar.id = 'giti-stock-filter-bar';
        filterBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 10px 0; gap: 8px; flex-wrap: wrap;';
        prodListContainer.parentElement.insertBefore(filterBar, prodListContainer);
      }

      filterBar.innerHTML = `
        <span style="font-size: 0.8rem; color: var(--text-muted);">
          إجمالي الأصناف: <strong>${products.length}</strong> | نواقص (≤ ${LOW_STOCK_THRESHOLD}): <strong class="text-danger">${lowItems.length}</strong>
        </span>
        <button type="button" id="giti-toggle-low-stock-btn" class="btn-sm" style="background: ${lowStockFilterActive ? 'var(--danger)' : 'rgba(244,63,94,0.15)'}; color: ${lowStockFilterActive ? '#fff' : 'var(--danger)'}; border: 1px solid rgba(244,63,94,0.3);">
          ${lowStockFilterActive ? '📋 عرض كل المخزن' : `🚨 فلترة النواقص (${lowItems.length})`}
        </button>
      `;

      const toggleBtn = document.getElementById('giti-toggle-low-stock-btn');
      if (toggleBtn) {
        toggleBtn.onclick = () => {
          lowStockFilterActive = !lowStockFilterActive;
          updateLowStockRadar();
        };
      }

      const itemsLi = prodListContainer.querySelectorAll('li');
      itemsLi.forEach((li, index) => {
        const prod = products[index];
        if (!prod) return;
        const isLow = (parseFloat(prod.stock) || 0) <= LOW_STOCK_THRESHOLD;
        li.style.borderRight = isLow ? '4px solid var(--danger)' : '';
        li.style.display = (lowStockFilterActive && !isLow) ? 'none' : 'flex';
      });
    }
  }

  // ==========================================================================
  // 3. ماسح الباركود السريع بالكاميرا داخل الفاتورة الحية
  // ==========================================================================
  function injectBarcodeScanner() {
    const paperHeader = document.querySelector('.paper-header');
    if (!paperHeader || document.getElementById('giti-barcode-scan-btn')) return;

    const scanBtn = document.createElement('button');
    scanBtn.type = 'button';
    scanBtn.id = 'giti-barcode-scan-btn';
    scanBtn.className = 'btn-sm';
    scanBtn.style.cssText = 'background: var(--accent); color: #fff; font-weight: 800; gap: 5px;';
    scanBtn.innerHTML = '📷 مسح باركود';
    scanBtn.onclick = openBarcodeScannerModal;

    paperHeader.insertBefore(scanBtn, paperHeader.lastElementChild);
  }

  function addProductToLiveInvoice(queryText) {
    const products = readStore('products', []);
    const clean = (queryText || '').trim().toLowerCase();
    const matched = products.find(p =>
      (p.barcode && String(p.barcode).toLowerCase() === clean) ||
      (p.name && p.name.trim().toLowerCase().includes(clean))
    );

    const targetName = matched ? matched.name : queryText.trim();
    const itemsBody = document.getElementById('items-body');
    if (!itemsBody) return;

    const rows = Array.from(itemsBody.querySelectorAll('tr'));
    for (let i = 0; i < rows.length; i++) {
      const inputs = rows[i].querySelectorAll('input');
      if (inputs[0] && inputs[0].value.trim().toLowerCase() === targetName.toLowerCase()) {
        const nextQty = (parseFloat(inputs[1].value) || 0) + 1;
        inputs[1].value = nextQty;
        if (typeof window.updateItem === 'function') window.updateItem(i, 'qty', nextQty);
        return;
      }
    }

    let targetIndex = rows.findIndex(r => {
      const inp = r.querySelector('input');
      return inp && inp.value.trim() === '';
    });

    if (targetIndex === -1) {
      const addBtn = document.getElementById('add-item-btn');
      if (addBtn) addBtn.click();
      targetIndex = itemsBody.querySelectorAll('tr').length - 1;
    }

    const updatedRows = itemsBody.querySelectorAll('tr');
    if (updatedRows[targetIndex]) {
      const nameInput = updatedRows[targetIndex].querySelector('input');
      if (nameInput) {
        nameInput.value = targetName;
        if (typeof window.handleItemInput === 'function') {
          window.handleItemInput(targetIndex, targetName);
        }
      }
    }
  }

  async function openBarcodeScannerModal() {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices) {
      const manualCode = prompt('أدخل رقم الباركود أو اسم الصنف للإضافة الفورية:');
      if (manualCode) addProductToLiveInvoice(manualCode);
      return;
    }

    let modal = document.getElementById('giti-scanner-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'giti-scanner-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center;">
          <div class="modal-header">
            <h3>📷 ماسح الباركود السريع</h3>
            <button type="button" id="giti-close-scanner" class="btn-close">✕</button>
          </div>
          <video id="giti-scanner-video" playsinline style="width: 100%; border-radius: 12px; background: #000; max-height: 260px; object-fit: cover;"></video>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">وجّه الكاميرا نحو باركود المنتج لإضافته تلقائياً</p>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');
    const video = document.getElementById('giti-scanner-video');
    let stream = null;
    let scanning = true;

    const stopScanner = () => {
      scanning = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      modal.classList.add('hidden');
    };

    document.getElementById('giti-close-scanner').onclick = stopScanner;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();

      const detector = new window.BarcodeDetector();
      const scanLoop = async () => {
        if (!scanning) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            stopScanner();
            addProductToLiveInvoice(code);
            return;
          }
        } catch {}
        requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
    } catch {
      stopScanner();
      const fallback = prompt('تعذر فتح الكاميرا. اكتب رقم الباركود أو اسم الصنف:');
      if (fallback) addProductToLiveInvoice(fallback);
    }
  }

  // ==========================================================================
  // 4. حارس النسخ الاحتياطي الوقائي (كل 7 أيام)
  // ==========================================================================
  function initBackupGuard() {
    const exportBtn = document.getElementById('export-json-btn');
    if (exportBtn && !exportBtn.dataset.gitiBound) {
      exportBtn.dataset.gitiBound = 'true';
      exportBtn.addEventListener('click', () => {
        localStorage.setItem('giti_last_backup_ts', String(Date.now()));
        const banner = document.getElementById('giti-backup-reminder');
        if (banner) banner.remove();
      });
    }

    const lastBackup = parseInt(localStorage.getItem('giti_last_backup_ts') || '0', 10);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const invoices = readStore('invoices', []);

    if (invoices.length >= 5 && Date.now() - lastBackup > sevenDaysMs && !document.getElementById('giti-backup-reminder')) {
      const mainApp = document.getElementById('main-app');
      const statsGrid = document.querySelector('.stats-grid');
      if (mainApp && statsGrid) {
        const banner = document.createElement('div');
        banner.id = 'giti-backup-reminder';
        banner.style.cssText = 'background: rgba(245, 158, 11, 0.15); border: 1px solid var(--warning); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 0.85rem;';
        banner.innerHTML = `
          <span>🛡️ <strong>تذكير وقائي:</strong> مرّ أكثر من أسبوع دون حفظ نسخة احتياطية لبياناتك.</span>
          <button type="button" id="giti-quick-backup-btn" class="btn-sm" style="background: var(--warning); color: #fff;">💾 حفظ نسخة الآن</button>
        `;
        mainApp.insertBefore(banner, statsGrid);
        document.getElementById('giti-quick-backup-btn').onclick = () => {
          if (exportBtn) exportBtn.click();
        };
      }
    }
  }

  // ==========================================================================
  // 5. محرك طباعة الإيصالات الحرارية (Thermal Receipt 80mm & 58mm)
  // ==========================================================================
  function injectThermalTriggers() {
    // 1. إضافة زر "إيصال حراري" داخل نافذة معاينة الفاتورة (#view-modal)
    const viewModalActions = document.querySelector('#view-modal .modal-actions-row');
    if (viewModalActions && !document.getElementById('giti-open-thermal-modal-btn')) {
      const thermalBtn = document.createElement('button');
      thermalBtn.type = 'button';
      thermalBtn.id = 'giti-open-thermal-modal-btn';
      thermalBtn.className = 'btn-sm';
      thermalBtn.style.cssText = 'background: #111827; color: #ffffff; border: 1px solid #374151; min-height: 42px; font-size: 0.85rem;';
      thermalBtn.innerHTML = '🧾 إيصال حراري';
      thermalBtn.onclick = () => {
        const idText = document.getElementById('v-inv-id')?.textContent || '';
        const inv = findInvoiceById(idText);
        if (inv) {
          openThermalReceiptModal(inv);
        } else {
          alert('⚠️ تعذر قراءة بيانات الفاتورة.');
        }
      };
      viewModalActions.appendChild(thermalBtn);
    }

    // 2. إضافة زر "🧾 حراري" سريع في كل بطاقة فاتورة بسجل الفواتير
    const invoiceCards = document.querySelectorAll('#invoices-container li');
    invoiceCards.forEach(li => {
      const actionsRow = li.querySelector('.inv-actions');
      if (!actionsRow || actionsRow.querySelector('.giti-row-thermal-btn')) return;

      const titleText = li.querySelector('strong')?.textContent || '';
      const idMatch = titleText.match(/#(\d+)/);
      if (!idMatch) return;

      const invId = parseInt(idMatch[1], 10);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-sm giti-row-thermal-btn';
      btn.style.cssText = 'background: #1f2937; color: #f8fafc; border: 1px solid #4b5563;';
      btn.innerHTML = '🧾 حراري';
      btn.title = 'طباعة إيصال كاشير حراري 80mm / 58mm';
      btn.onclick = (e) => {
        e.stopPropagation();
        const inv = findInvoiceById(invId);
        if (inv) openThermalReceiptModal(inv);
      };

      const deleteBtn = actionsRow.lastElementChild;
      actionsRow.insertBefore(btn, deleteBtn);
    });
  }

  function ensureThermalModal() {
    let modal = document.getElementById('giti-thermal-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'giti-thermal-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <h3 style="font-size: 1.05rem;">🧾 معاينة الإيصال الحراري (POS)</h3>
          <button type="button" id="giti-close-thermal-btn" class="btn-close">✕</button>
        </div>

        <!-- شريط اختيار مقاس ورق الكاشير -->
        <div style="display: flex; gap: 8px; margin-bottom: 10px; background: var(--input-bg); padding: 6px; border-radius: 10px; border: 1px solid var(--border-color);">
          <button type="button" id="giti-width-80-btn" class="btn-sm" style="flex: 1; font-weight: 800;">📏 ورق 80mm (كبير)</button>
          <button type="button" id="giti-width-58-btn" class="btn-sm" style="flex: 1; font-weight: 800;">📏 ورق 58mm (صغير)</button>
        </div>

        <!-- منطقة معاينة الريسيت الحراري بخلفية بيضاء ونص أسود عالي التباين -->
        <div style="flex: 1; overflow-y: auto; background: #e5e7eb; padding: 14px 8px; border-radius: 12px; display: flex; justify-content: center; align-items: flex-start;">
          <div id="giti-thermal-paper" style="background: #ffffff; color: #000000; padding: 12px 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.18); font-family: 'Cairo', Tahoma, sans-serif; direction: rtl; text-align: right; box-sizing: border-box;">
          </div>
        </div>

        <!-- تخصيص عبارة أسفل الإيصال -->
        <div style="margin-top: 10px;">
          <input type="text" id="giti-thermal-footer-input" placeholder="عبارة أسفل الإيصال (مثلاً: شكراً لزيارتكم)" style="min-height: 36px; font-size: 0.8rem; padding: 6px 10px;">
        </div>

        <!-- أزرار الطباعة والتصدير -->
        <div class="modal-actions-row" style="margin-top: 10px;">
          <button type="button" id="giti-thermal-print-btn" class="btn-success">🖨️ طباعة مباشرة</button>
          <button type="button" id="giti-thermal-pdf-btn" class="btn-primary">📲 طابعة بلوتوث / PDF</button>
          <button type="button" id="giti-thermal-img-btn" class="btn-sm" style="background: #1f2937; color: #fff; min-height: 42px;">🖼️ صورة</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('giti-close-thermal-btn').onclick = () => {
      modal.classList.add('hidden');
    };

    document.getElementById('giti-width-80-btn').onclick = () => {
      thermalPaperWidth = '80mm';
      localStorage.setItem('giti_thermal_width', '80mm');
      renderThermalReceiptContent();
    };

    document.getElementById('giti-width-58-btn').onclick = () => {
      thermalPaperWidth = '58mm';
      localStorage.setItem('giti_thermal_width', '58mm');
      renderThermalReceiptContent();
    };

    const footerInput = document.getElementById('giti-thermal-footer-input');
    footerInput.value = localStorage.getItem('giti_thermal_footer') || 'شكراً لتعاملكم معنا — نتمنى لكم يوماً سعيداً';
    footerInput.addEventListener('input', () => {
      localStorage.setItem('giti_thermal_footer', footerInput.value);
      renderThermalReceiptContent();
    });

    document.getElementById('giti-thermal-print-btn').onclick = printThermalReceiptIframe;
    document.getElementById('giti-thermal-pdf-btn').onclick = () => exportThermalReceipt('pdf');
    document.getElementById('giti-thermal-img-btn').onclick = () => exportThermalReceipt('png');

    return modal;
  }

  function openThermalReceiptModal(inv) {
    activeThermalInvoice = inv;
    const modal = ensureThermalModal();
    modal.classList.remove('hidden');
    renderThermalReceiptContent();
  }

  function renderThermalReceiptContent() {
    if (!activeThermalInvoice) return;
    const inv = activeThermalInvoice;
    const profile = getStoreProfile();
    const currency = profile.currency || 'ج.م';
    const is58 = thermalPaperWidth === '58mm';

    // تحديث أزرار اختيار المقاس
    const btn80 = document.getElementById('giti-width-80-btn');
    const btn58 = document.getElementById('giti-width-58-btn');
    if (btn80 && btn58) {
      btn80.style.background = !is58 ? 'var(--accent)' : 'transparent';
      btn80.style.color = !is58 ? '#ffffff' : 'var(--text-muted)';
      btn58.style.background = is58 ? 'var(--accent)' : 'transparent';
      btn58.style.color = is58 ? '#ffffff' : 'var(--text-muted)';
    }

    const paper = document.getElementById('giti-thermal-paper');
    if (!paper) return;

    // 80mm = 302px | 58mm = 219px (عند دقة 96DPI قياسية للويب)
    const pixelWidth = is58 ? '219px' : '302px';
    const baseFont = is58 ? '11px' : '12.5px';
    const titleFont = is58 ? '14px' : '16px';
    const totalFont = is58 ? '14px' : '16px';

    paper.style.width = pixelWidth;
    paper.style.fontSize = baseFont;
    paper.style.lineHeight = '1.45';

    const footerNote = localStorage.getItem('giti_thermal_footer') || 'شكراً لتعاملكم معنا — نتمنى لكم يوماً سعيداً';
    const itemsHtml = (inv.items || []).map(item => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const rowTotal = (qty * price).toFixed(2);
      return `
        <tr style="border-bottom: 1px dashed #9ca3af;">
          <td style="padding: 4px 2px; font-weight: 700; color: #000; word-break: break-word;">${item.name}</td>
          <td style="padding: 4px 2px; text-align: center; color: #000; white-space: nowrap;">${qty}</td>
          <td style="padding: 4px 2px; text-align: center; color: #000; white-space: nowrap;">${price.toFixed(2)}</td>
          <td style="padding: 4px 2px; text-align: left; font-weight: 800; color: #000; white-space: nowrap;">${rowTotal}</td>
        </tr>
      `;
    }).join('');

    const paidVal = parseFloat(inv.paidAmount) || 0;
    const dueVal = parseFloat(inv.dueAmount) || 0;
    const partialHtml = inv.status === 'مدفوعة جزئياً'
      ? `
        <div style="display: flex; justify-content: space-between; font-weight: 700; margin-top: 3px;">
          <span>المدفوع:</span><span>${paidVal.toFixed(2)} ${currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 800; margin-top: 2px;">
          <span>المتبقي:</span><span>${dueVal.toFixed(2)} ${currency}</span>
        </div>
      `
      : '';

    paper.innerHTML = `
      <div style="text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
        ${profile.logo ? `<img src="${profile.logo}" alt="Logo" style="max-height: ${is58 ? '38px' : '48px'}; max-width: 80%; object-fit: contain; filter: grayscale(100%) contrast(140%); margin-bottom: 4px;">` : ''}
        <div style="font-size: ${titleFont}; font-weight: 900; color: #000;">${profile.name || 'GITI ERP'}</div>
        ${profile.phone ? `<div style="font-size: 0.9em; color: #000;">هاتف: ${profile.phone}</div>` : ''}
        ${profile.vatNo ? `<div style="font-size: 0.85em; color: #000;">الرقم الضريبي: ${profile.vatNo}</div>` : ''}
        ${profile.address ? `<div style="font-size: 0.85em; color: #000;">${profile.address}</div>` : ''}
        <div style="margin-top: 6px; padding: 3px 6px; border: 1.5px solid #000; font-weight: 900; display: inline-block; font-size: 0.95em;">
          إيصال مبيعات #${inv.id}
        </div>
      </div>

      <div style="border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 0.92em;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>التاريخ:</strong> ${inv.date || ''}</span>
          <span><strong>الحالة:</strong> ${inv.status || ''}</span>
        </div>
        <div><strong>العميل:</strong> ${inv.client || 'عميل نقدي'}</div>
        ${inv.phone ? `<div><strong>هاتف العميل:</strong> ${inv.phone}</div>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 0.92em;">
        <thead>
          <tr style="border-bottom: 1.5px solid #000; background: #f3f4f6;">
            <th style="padding: 4px 2px; text-align: right; color: #000;">الصنف</th>
            <th style="padding: 4px 2px; text-align: center; color: #000;">ك</th>
            <th style="padding: 4px 2px; text-align: center; color: #000;">سعر</th>
            <th style="padding: 4px 2px; text-align: left; color: #000;">إجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="border-top: 1.5px dashed #000; padding-top: 6px; font-size: 0.95em;">
        <div style="display: flex; justify-content: space-between;">
          <span>المجموع الفرعي:</span>
          <strong>${(parseFloat(inv.subtotal) || 0).toFixed(2)} ${currency}</strong>
        </div>
        ${(parseFloat(inv.discount) || 0) > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>الخصم:</span>
            <strong>-${(parseFloat(inv.discount) || 0).toFixed(2)} ${currency}</strong>
          </div>
        ` : ''}
        ${(parseFloat(inv.taxPercent) || 0) > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>الضريبة (${inv.taxPercent}%):</span>
            <strong>${(parseFloat(inv.taxAmount) || 0).toFixed(2)} ${currency}</strong>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 6px 4px; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: ${totalFont}; font-weight: 900;">
          <span>الإجمالي:</span>
          <span>${(parseFloat(inv.grandTotal) || 0).toFixed(2)} ${currency}</span>
        </div>
        ${partialHtml}
      </div>

      <div style="text-align: center; margin-top: 10px; padding-top: 6px;">
        <div id="giti-thermal-qr" style="display: inline-block; padding: 4px; background: #fff;"></div>
        <div style="font-size: 0.85em; font-weight: 700; margin-top: 6px; color: #000;">${footerNote}</div>
        <div style="font-size: 0.75em; margin-top: 4px; color: #374151;">Powered by GITI ERP</div>
      </div>
    `;

    // توليد رمز ZATCA QR داخل الريسيت
    const qrBox = document.getElementById('giti-thermal-qr');
    if (qrBox && typeof QRCode !== 'undefined' && inv.zatcaQr) {
      qrBox.innerHTML = '';
      const qrSize = is58 ? 72 : 88;
      new QRCode(qrBox, {
        text: inv.zatcaQr,
        width: qrSize,
        height: qrSize,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // طباعة مباشرة معزولة في Iframe بمقاس 80mm أو 58mm دون التأثر بـ A4
  function printThermalReceiptIframe() {
    const paper = document.getElementById('giti-thermal-paper');
    if (!paper) return;

    // تحويل Canvas الـ QR إلى صورة لضمان ظهوره داخل نافذة الطباعة المعزولة
    const clone = paper.cloneNode(true);
    const origCanvas = paper.querySelector('#giti-thermal-qr canvas');
    const cloneQr = clone.querySelector('#giti-thermal-qr');
    if (origCanvas && cloneQr) {
      const img = document.createElement('img');
      img.src = origCanvas.toDataURL('image/png');
      img.style.width = origCanvas.style.width || '84px';
      img.style.height = origCanvas.style.height || '84px';
      cloneQr.innerHTML = '';
      cloneQr.appendChild(img);
    }

    const oldFrame = document.getElementById('giti-thermal-print-frame');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'giti-thermal-print-frame';
    iframe.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>Thermal Receipt #${activeThermalInvoice?.id || ''}</title>
        <style>
          @page {
            size: ${thermalPaperWidth} auto;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: ${thermalPaperWidth};
            background: #ffffff;
            color: #000000;
            font-family: 'Cairo', Tahoma, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #receipt-root {
            width: 100% !important;
            box-shadow: none !important;
            padding: 3mm 2.5mm !important;
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div id="receipt-root">${clone.innerHTML}</div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 300);
  }

  // تصدير الإيصال الحراري كـ PDF بمقاس 80mm/58mm أو PNG لطابعات البلوتوث
  async function exportThermalReceipt(format = 'pdf') {
    const paper = document.getElementById('giti-thermal-paper');
    if (!paper || !activeThermalInvoice) return;

    if (typeof html2canvas === 'undefined') {
      alert('⚠️ مكتبة التصوير قيد التحميل، حاول بعد لحظات.');
      return;
    }

    const pdfBtn = document.getElementById('giti-thermal-pdf-btn');
    const imgBtn = document.getElementById('giti-thermal-img-btn');
    if (pdfBtn) pdfBtn.disabled = true;
    if (imgBtn) imgBtn.disabled = true;

    try {
      const canvas = await html2canvas(paper, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const invId = activeThermalInvoice.id;
      const widthTag = thermalPaperWidth;

      if (format === 'png') {
        const dataUrl = canvas.toDataURL('image/png');
        await shareOrDownloadThermalFile(
          dataUrl,
          `Receipt_${widthTag}_${invId}.png`,
          'image/png',
          `إيصال حراري #${invId}`
        );
      } else {
        const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
        if (!jsPDFClass) {
          alert('⚠️ مكتبة PDF غير متوفرة حالياً.');
          return;
        }
        const widthMm = thermalPaperWidth === '58mm' ? 58 : 80;
        const heightMm = Math.max(60, (canvas.height * widthMm) / canvas.width);

        const pdf = new jsPDFClass({
          orientation: 'portrait',
          unit: 'mm',
          format: [widthMm, heightMm]
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm);
        const pdfBlob = pdf.output('blob');

        await shareOrDownloadThermalFile(
          pdfBlob,
          `Receipt_${widthTag}_${invId}.pdf`,
          'application/pdf',
          `إيصال حراري ${widthTag} #${invId}`
        );
      }
    } finally {
      if (pdfBtn) pdfBtn.disabled = false;
      if (imgBtn) imgBtn.disabled = false;
    }
  }

  // ==========================================================================
  // 6. معالجة رصيد المخزن عند حذف فواتير المبيعات أو المشتريات + تحسين فواصل PDF
  // ==========================================================================
  function injectPrintRowProtection() {
    if (document.getElementById('giti-print-row-fix')) return;
    const style = document.createElement('style');
    style.id = 'giti-print-row-fix';
    style.textContent = `
      .a4-official-table tr, .preview-table tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    `;
    document.head.appendChild(style);
  }

  function hookDeleteStockReconciliation() {
    // 1. اعتراض حذف فاتورة مبيعات لإعادة الكميات للمخزن عند رغبة المستخدم
    if (typeof window.deleteInvoice === 'function' && !window.deleteInvoice._gitiHooked) {
      const origDeleteInvoice = window.deleteInvoice;
      window.deleteInvoice = async function (id) {
        const inv = findInvoiceById(id);
        await origDeleteInvoice.apply(this, arguments);

        // التأكد أن الفاتورة حُذفت بالفعل (لم يتم إلغاء نافذة التأكيد)
        if (!findInvoiceById(id) && inv && Array.isArray(inv.items)) {
          const uid = getActiveUid();
          const products = readStore('products', []);
          const matchedItems = inv.items.filter(item =>
            products.some(p => (p.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase())
          );

          if (matchedItems.length > 0 && confirm(`📦 هل تريد إعادة كميات أصناف الفاتورة المحذوفة (#${id}) إلى المخزن؟`)) {
            const modified = [];
            matchedItems.forEach(item => {
              const prod = products.find(p => (p.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase());
              if (prod) {
                prod.stock = (parseFloat(prod.stock) || 0) + (parseFloat(item.qty) || 0);
                modified.push(prod);
              }
            });

            localStorage.setItem(`giti_${uid}_products`, JSON.stringify(products));
            if (uid !== 'local') {
              try {
                const fsDb = getFirestore();
                await Promise.all(modified.map(p => setDoc(doc(fsDb, "users", uid, "products", String(p.id)), p)));
              } catch {}
            }
            location.reload();
          }
        }
      };
      window.deleteInvoice._gitiHooked = true;
    }

    // 2. اعتراض حذف فاتورة مشتريات لخصم الكميات المضافة سابقاً من المخزن
    if (typeof window.deletePurchase === 'function' && !window.deletePurchase._gitiHooked) {
      const origDeletePurchase = window.deletePurchase;
      window.deletePurchase = async function (id) {
        const purchases = readStore('purchases', []);
        const pur = purchases.find(p => parseInt(p.id, 10) === parseInt(id, 10));
        await origDeletePurchase.apply(this, arguments);

        const stillExists = readStore('purchases', []).some(p => parseInt(p.id, 10) === parseInt(id, 10));
        if (!stillExists && pur && Array.isArray(pur.items)) {
          const uid = getActiveUid();
          const products = readStore('products', []);
          const matchedItems = pur.items.filter(item =>
            products.some(p => (p.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase())
          );

          if (matchedItems.length > 0 && confirm(`📦 هل تريد خصم كميات فاتورة المشتريات المحذوفة (#${id}) من رصيد المخزن؟`)) {
            const modified = [];
            matchedItems.forEach(item => {
              const prod = products.find(p => (p.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase());
              if (prod) {
                prod.stock = Math.max(0, (parseFloat(prod.stock) || 0) - (parseFloat(item.qty) || 0));
                modified.push(prod);
              }
            });

            localStorage.setItem(`giti_${uid}_products`, JSON.stringify(products));
            if (uid !== 'local') {
              try {
                const fsDb = getFirestore();
                await Promise.all(modified.map(p => setDoc(doc(fsDb, "users", uid, "products", String(p.id)), p)));
              } catch {}
            }
            location.reload();
          }
        }
      };
      window.deletePurchase._gitiHooked = true;
    }
  }

  // ==========================================================================
  // تشغيل وتحديث جميع وحدات النواة
  // ==========================================================================
  function refreshAllAddons() {
    renderCashDrawerSummary();
    updateLowStockRadar();
    injectBarcodeScanner();
    initBackupGuard();
    injectThermalTriggers();
    injectPrintRowProtection();
    hookDeleteStockReconciliation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(refreshAllAddons, 400));
  } else {
    setTimeout(refreshAllAddons, 400);
  }
})();
