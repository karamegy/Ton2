// ============================================================================
// giti Core Plus v2.0 - Modular Extension Engine (Zero-Intrusion Architecture)
// بدون زر الباركود + رادار تحصيلات الديون مرتبط مباشرة بكشف حساب العملاء
// ============================================================================

(function initGitiCorePlus() {
  const LOW_STOCK_THRESHOLD = 5;
  let lowStockFilterActive = false;
  let showAllDebtors = false;
  let activeThermalInvoice = null;
  let thermalPaperWidth = localStorage.getItem('giti_thermal_width') || '80mm';
  let refreshTimer = null;

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

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findInvoiceById(id) {
    const numId = parseInt(String(id).replace(/[^0-9]/g, ''), 10);
    if (isNaN(numId)) return null;
    const active = readStore('invoices', []);
    const archived = readStore('archived_invoices', []);
    return active.find(i => parseInt(i.id, 10) === numId) || archived.find(i => parseInt(i.id, 10) === numId) || null;
  }

  function buildProductCostMap() {
    const products = readStore('products', []);
    const purchases = readStore('purchases', []);
    const costMap = {};

    purchases.forEach(pur => {
      (pur.items || []).forEach(it => {
        const key = (it.name || '').trim().toLowerCase();
        const unitCost = parseFloat(it.price) || 0;
        if (key && unitCost > 0) costMap[key] = unitCost;
      });
    });

    products.forEach(p => {
      const key = (p.name || '').trim().toLowerCase();
      const explicitCost = parseFloat(p.cost ?? p.costPrice ?? p.buyPrice ?? 0) || 0;
      if (key && explicitCost > 0) {
        costMap[key] = explicitCost;
      }
    });

    return costMap;
  }

  async function shareOrDownloadFile(dataUrlOrBlob, fileName, mimeType, shareTitle) {
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
      console.error('File Export Error:', err);
      alert('⚠️ تعذر تصدير الملف.');
      return false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshAllAddons, 90);
  }

  // مراقبة أي تحديث في بيانات التطبيق داخل localStorage لتحديث الإضافات تلقائياً
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (
      typeof key === 'string' &&
      key.startsWith('giti_') &&
      key !== 'giti_thermal_width' &&
      key !== 'giti_thermal_footer' &&
      key !== 'giti_last_backup_ts'
    ) {
      scheduleRefresh();
    }
  };

  // ==========================================================================
  // 1. حاسبة الخزينة الفعلي ودرج الكاش + تحليل الأرباح والأكثر مبيعاً
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

    const totalSalesVolume = invoices.reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) || 0), 0);
    const totalPurchasesVolume = purchases.reduce((sum, pur) => sum + (parseFloat(pur.grandTotal) || 0), 0);
    const operatingNet = totalSalesVolume - totalPurchasesVolume - totalExpenses;

    const itemStats = {};
    invoices.forEach(inv => {
      (inv.items || []).forEach(it => {
        const name = (it.name || '').trim();
        if (!name) return;
        if (!itemStats[name]) itemStats[name] = { qty: 0, revenue: 0 };
        const q = parseFloat(it.qty) || 0;
        const p = parseFloat(it.price) || 0;
        itemStats[name].qty += q;
        itemStats[name].revenue += q * p;
      });
    });

    const topItems = Object.entries(itemStats)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 3);

    const topItemsHtml = topItems.length > 0
      ? topItems.map(([name, st], idx) => `
          <span style="background: var(--input-bg); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 8px; font-size: 0.78rem;">
            ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} <strong>${escapeHtml(name)}</strong> (${st.qty} قطعة)
          </span>
        `).join('')
      : `<span style="font-size: 0.78rem; color: var(--text-muted);">لا توجد مبيعات مسجلة بعد</span>`;

    widget.innerHTML = `
      <div class="card-header" style="margin-bottom: 10px;">
        <h3 style="font-size: 1rem;">💰 ملخص الخزينة ودرج الكاش الفعلي</h3>
        <span class="badge ${netDrawerCash >= 0 ? 'badge-paid' : 'badge-unpaid'}">
          ${netDrawerCash >= 0 ? 'فائض نقدي' : 'عجز نقدي'}
        </span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 10px; text-align: center;">
        <div style="background: var(--input-bg); padding: 10px; border-radius: 10px; border: 1px solid var(--border-color);">
          <small style="color: var(--text-muted); display: block;">📥 إجمالي المقبوضات</small>
          <strong style="color: var(--success); font-size: 0.98rem;">+${totalCashIn.toFixed(2)} ${currency}</strong>
        </div>
        <div style="background: var(--input-bg); padding: 10px; border-radius: 10px; border: 1px solid var(--border-color);">
          <small style="color: var(--text-muted); display: block;">📤 مدفوعات ومصروفات</small>
          <strong style="color: var(--danger); font-size: 0.98rem;">-${totalCashOut.toFixed(2)} ${currency}</strong>
        </div>
        <div style="background: var(--input-bg); padding: 10px; border-radius: 10px; border: 1px solid var(--accent);">
          <small style="color: var(--text-muted); display: block;">🏦 صافي الكاش بالدرج</small>
          <strong style="color: ${netDrawerCash >= 0 ? 'var(--accent)' : 'var(--danger)'}; font-size: 1.1rem;">
            ${netDrawerCash.toFixed(2)} ${currency}
          </strong>
        </div>
        <div style="background: var(--input-bg); padding: 10px; border-radius: 10px; border: 1px solid var(--border-color);">
          <small style="color: var(--text-muted); display: block;">📈 صافي حركة النشاط</small>
          <strong style="color: ${operatingNet >= 0 ? 'var(--success)' : 'var(--warning)'}; font-size: 0.98rem;">
            ${operatingNet.toFixed(2)} ${currency}
          </strong>
        </div>
      </div>
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-color); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <small style="color: var(--text-muted); font-weight: 700;">🔥 الأكثر مبيعاً:</small>
        ${topItemsHtml}
      </div>
    `;
  }

  // ==========================================================================
  // 2. رادار نواقص المخزن الذكي + تقييم رأس المال وجرد المخزن
  // ==========================================================================
  function updateLowStockRadar() {
    const products = readStore('products', []);
    const lowItems = products.filter(p => (parseFloat(p.stock) || 0) <= LOW_STOCK_THRESHOLD);
    const costMap = buildProductCostMap();
    const currency = getCurrency();

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
      let valCard = document.getElementById('giti-inventory-valuation-card');
      if (!valCard) {
        valCard = document.createElement('div');
        valCard.id = 'giti-inventory-valuation-card';
        valCard.style.cssText = 'background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08)); border: 1px solid var(--border-color); border-radius: 12px; padding: 10px; margin: 10px 0;';
        prodListContainer.parentElement.insertBefore(valCard, prodListContainer);
      }

      let totalCostCapital = 0;
      let totalRetailValue = 0;
      products.forEach(p => {
        const stock = Math.max(0, parseFloat(p.stock) || 0);
        const sellPrice = parseFloat(p.price) || 0;
        const key = (p.name || '').trim().toLowerCase();
        const unitCost = costMap[key] || 0;

        totalCostCapital += stock * unitCost;
        totalRetailValue += stock * sellPrice;
      });
      const expectedProfit = totalRetailValue - totalCostCapital;

      valCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
          <strong style="font-size: 0.85rem;">📦 تقييم جرد المخزن ورأس المال</strong>
          <button type="button" id="giti-export-products-csv" class="btn-sm" style="background: #0f766e; color: #fff; font-size: 0.75rem;">📊 تصدير المخزن Excel</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
          <div style="background: var(--input-bg); padding: 7px 4px; border-radius: 8px; border: 1px solid var(--border-color);">
            <small style="color: var(--text-muted); display: block; font-size: 0.72rem;">💼 رأس المال (تكلفة)</small>
            <strong style="font-size: 0.88rem;">${totalCostCapital.toFixed(2)} ${currency}</strong>
          </div>
          <div style="background: var(--input-bg); padding: 7px 4px; border-radius: 8px; border: 1px solid var(--border-color);">
            <small style="color: var(--text-muted); display: block; font-size: 0.72rem;">🏷️ القيمة البيعية</small>
            <strong style="color: var(--accent); font-size: 0.88rem;">${totalRetailValue.toFixed(2)} ${currency}</strong>
          </div>
          <div style="background: var(--input-bg); padding: 7px 4px; border-radius: 8px; border: 1px solid var(--border-color);">
            <small style="color: var(--text-muted); display: block; font-size: 0.72rem;">✨ الربح المتوقع</small>
            <strong style="color: var(--success); font-size: 0.88rem;">+${expectedProfit.toFixed(2)} ${currency}</strong>
          </div>
        </div>
      `;

      const expProdBtn = document.getElementById('giti-export-products-csv');
      if (expProdBtn) expProdBtn.onclick = exportProductsToExcelCSV;

      let filterBar = document.getElementById('giti-stock-filter-bar');
      if (!filterBar) {
        filterBar = document.createElement('div');
        filterBar.id = 'giti-stock-filter-bar';
        filterBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 8px 0; gap: 8px; flex-wrap: wrap;';
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
  // 3. كتالوج الأصناف السريعة داخل الفاتورة الحية (بدون باركود)
  // ==========================================================================
  function injectLiveInvoiceTools() {
    const paperHeader = document.querySelector('.paper-header');
    if (!paperHeader) return;

    // التأكد من إزالة زر الباركود إن وجد
    const oldScanBtn = document.getElementById('giti-barcode-scan-btn');
    if (oldScanBtn) oldScanBtn.remove();

    if (!document.getElementById('giti-quick-catalog-btn')) {
      const catBtn = document.createElement('button');
      catBtn.type = 'button';
      catBtn.id = 'giti-quick-catalog-btn';
      catBtn.className = 'btn-sm';
      catBtn.style.cssText = 'background: var(--accent); color: #fff; font-weight: 800; gap: 5px;';
      catBtn.innerHTML = '⚡ أصناف سريعة';
      catBtn.onclick = openQuickCatalogModal;
      paperHeader.insertBefore(catBtn, paperHeader.lastElementChild);
    }
  }

  function addProductToLiveInvoice(queryText) {
    const products = readStore('products', []);
    const clean = (queryText || '').trim().toLowerCase();
    const matched = products.find(p =>
      (p.name && p.name.trim().toLowerCase() === clean) ||
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
        setTimeout(updateLiveInvoiceProfitGuard, 40);
        return targetName;
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
    setTimeout(updateLiveInvoiceProfitGuard, 40);
    return targetName;
  }

  function openQuickCatalogModal() {
    let modal = document.getElementById('giti-quick-catalog-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'giti-quick-catalog-modal';
      modal.className = 'modal hidden';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 460px;">
          <div class="modal-header">
            <h3 style="font-size: 1.05rem;">⚡ الإضافة السريعة من المخزن</h3>
            <button type="button" id="giti-close-catalog-btn" class="btn-close">✕</button>
          </div>
          <input type="text" id="giti-catalog-search" placeholder="🔍 ابحث باسم الصنف واضغط Enter للإضافة..." style="margin-bottom: 8px;">
          <div id="giti-catalog-feedback" style="font-size: 0.8rem; color: var(--success); font-weight: 700; min-height: 20px; margin-bottom: 6px;"></div>
          <div id="giti-catalog-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 8px; max-height: 52vh; overflow-y: auto; padding: 2px;"></div>
          <div class="modal-actions-row" style="margin-top: 10px;">
            <button type="button" id="giti-done-catalog-btn" class="btn-success">✔️ تم (العودة للفاتورة)</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeFn = () => modal.classList.add('hidden');
      document.getElementById('giti-close-catalog-btn').onclick = closeFn;
      document.getElementById('giti-done-catalog-btn').onclick = closeFn;

      const searchInput = document.getElementById('giti-catalog-search');
      searchInput.addEventListener('input', () => renderQuickCatalogItems(searchInput.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          e.preventDefault();
          const added = addProductToLiveInvoice(searchInput.value.trim());
          const fb = document.getElementById('giti-catalog-feedback');
          if (fb && added) fb.textContent = `✅ تمت إضافة: ${added}`;
          searchInput.value = '';
          renderQuickCatalogItems('');
        }
      });

      document.getElementById('giti-catalog-grid').addEventListener('click', (e) => {
        const card = e.target.closest('[data-prod-name]');
        if (!card) return;
        const pName = card.getAttribute('data-prod-name');
        addProductToLiveInvoice(pName);
        const fb = document.getElementById('giti-catalog-feedback');
        if (fb) fb.textContent = `✅ تمت إضافة "${pName}" (المس مجدداً لزيادة الكمية)`;
      });
    }

    const searchInput = document.getElementById('giti-catalog-search');
    const fb = document.getElementById('giti-catalog-feedback');
    if (searchInput) searchInput.value = '';
    if (fb) fb.textContent = 'المس أي صنف لإضافته مباشرة إلى الفاتورة';
    renderQuickCatalogItems('');
    modal.classList.remove('hidden');
  }

  function renderQuickCatalogItems(filterText = '') {
    const grid = document.getElementById('giti-catalog-grid');
    if (!grid) return;

    const products = readStore('products', []);
    const currency = getCurrency();
    const q = filterText.trim().toLowerCase();

    const filtered = q
      ? products.filter(p => (p.name || '').toLowerCase().includes(q))
      : products;

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">لا توجد أصناف مطابقة في المخزن</div>`;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const stock = parseFloat(p.stock) || 0;
      const price = parseFloat(p.price) || 0;
      const stockColor = stock <= 0 ? 'var(--danger)' : stock <= LOW_STOCK_THRESHOLD ? 'var(--warning)' : 'var(--success)';
      return `
        <button type="button" data-prod-name="${escapeHtml(p.name)}" style="background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 8px; text-align: right; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; color: inherit;">
          <strong style="font-size: 0.85rem; line-height: 1.3; word-break: break-word;">${escapeHtml(p.name)}</strong>
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 0.76rem;">
            <span style="color: var(--accent); font-weight: 800;">${price.toFixed(2)} ${currency}</span>
            <span style="color: ${stockColor}; font-weight: 700;">رصيد: ${stock}</span>
          </div>
        </button>
      `;
    }).join('');
  }

  // ==========================================================================
  // 4. مؤشر ربح الفاتورة الحية وحماية الخصم (Live Invoice Profit Guard)
  // ==========================================================================
  function updateLiveInvoiceProfitGuard() {
    const grandTotalEl = document.getElementById('grand-total');
    const itemsBody = document.getElementById('items-body');
    if (!grandTotalEl || !itemsBody) return;

    const container = grandTotalEl.closest('.totals-box, .paper-footer, .invoice-totals') || grandTotalEl.parentElement;
    if (!container) return;

    let indicator = document.getElementById('giti-live-profit-guard');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'giti-live-profit-guard';
      indicator.style.cssText = 'margin-top: 8px; padding: 7px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;';
      container.appendChild(indicator);
    }

    const costMap = buildProductCostMap();
    const currency = getCurrency();
    const rows = Array.from(itemsBody.querySelectorAll('tr'));

    let grossSales = 0;
    let totalKnownCost = 0;
    let hasAnyCost = false;

    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs.length < 3) return;
      const name = (inputs[0].value || '').trim().toLowerCase();
      const qty = parseFloat(inputs[1].value) || 0;
      const sellPrice = parseFloat(inputs[2].value) || 0;
      if (!name || qty <= 0) return;

      grossSales += qty * sellPrice;
      const unitCost = costMap[name] || 0;
      if (unitCost > 0) {
        hasAnyCost = true;
        totalKnownCost += qty * unitCost;
      }
    });

    const discountInput = document.getElementById('discount') || document.getElementById('inv-discount');
    const discountVal = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
    const netSalesAfterDiscount = Math.max(0, grossSales - discountVal);

    if (grossSales <= 0) {
      indicator.style.display = 'none';
      return;
    }

    indicator.style.display = 'flex';

    if (!hasAnyCost) {
      indicator.style.background = 'rgba(99, 102, 241, 0.1)';
      indicator.style.border = '1px solid rgba(99, 102, 241, 0.25)';
      indicator.style.color = 'var(--text-muted)';
      indicator.innerHTML = `<span>💡 أضف سعر الشراء للأصناف بالمخزن لحساب ربح الفاتورة تلقائياً</span>`;
      return;
    }

    const netProfit = netSalesAfterDiscount - totalKnownCost;
    const marginPct = netSalesAfterDiscount > 0 ? ((netProfit / netSalesAfterDiscount) * 100).toFixed(1) : '0.0';

    if (netProfit < 0) {
      indicator.style.background = 'rgba(244, 63, 94, 0.15)';
      indicator.style.border = '1px solid var(--danger)';
      indicator.style.color = 'var(--danger)';
      indicator.innerHTML = `
        <span>⚠️ تنبيه حماية السعر: الفاتورة أقل من التكلفة!</span>
        <strong>خسارة: ${netProfit.toFixed(2)} ${currency}</strong>
      `;
    } else {
      indicator.style.background = 'rgba(16, 185, 129, 0.12)';
      indicator.style.border = '1px solid rgba(16, 185, 129, 0.35)';
      indicator.style.color = 'var(--success)';
      indicator.innerHTML = `
        <span>💡 صافي ربح الفاتورة التقديري (${marginPct}%):</span>
        <strong>+${netProfit.toFixed(2)} ${currency}</strong>
      `;
    }
  }

  if (!window._gitiProfitInputBound) {
    window._gitiProfitInputBound = true;
    document.addEventListener('input', (e) => {
      if (e.target && (e.target.closest('#items-body') || e.target.id === 'discount' || e.target.id === 'inv-discount')) {
        updateLiveInvoiceProfitGuard();
      }
    });
  }

  // ==========================================================================
  // 5. رادار تحصيلات الديون المرتبط مباشرة بكشف حساب العملاء (Client Ledger)
  // ==========================================================================
  function calculateClientStatement(clientObj, invoices, clientReturns) {
    const cId = clientObj.id;
    const cNameLower = (clientObj.name || '').trim().toLowerCase();

    const cInvoices = invoices.filter(i =>
      (cId && i.clientId === cId) ||
      (i.client && cNameLower && i.client.trim().toLowerCase() === cNameLower)
    );

    const cReturns = clientReturns.filter(r =>
      (cId && r.clientId === cId) ||
      (r.client && cNameLower && r.client.trim().toLowerCase() === cNameLower)
    );

    const totalReturns = cReturns.reduce((sum, r) => sum + (parseFloat(r.grandTotal) || 0), 0);
    const cashRefunded = cReturns
      .filter(r => r.settlement === 'نقدي')
      .reduce((sum, r) => sum + (parseFloat(r.grandTotal) || 0), 0);

    let totalPurchases = (parseFloat(clientObj.openingBalance) || 0) - totalReturns;
    let totalPaid = -cashRefunded;

    cInvoices.forEach(inv => {
      totalPurchases += (parseFloat(inv.grandTotal) || 0);
      totalPaid += (parseFloat(inv.paidAmount) || 0);
    });

    (clientObj.payments || []).forEach(p => {
      totalPaid += (parseFloat(p.amount) || 0);
    });

    const rawBalance = totalPurchases - totalPaid;
    const balance = Math.max(0, rawBalance);

    const lastInvoice = cInvoices[0] || null;
    const lastPayment = (clientObj.payments && clientObj.payments.length > 0)
      ? clientObj.payments[clientObj.payments.length - 1]
      : null;

    return {
      totalPurchases,
      totalPaid,
      totalReturns,
      balance,
      invoicesCount: cInvoices.length,
      paymentsCount: (clientObj.payments || []).length,
      lastDate: (lastPayment && lastPayment.date) || (lastInvoice && lastInvoice.date) || ''
    };
  }

  function renderDebtCollectionRadar() {
    const clientsTab = document.getElementById('tab-clients');
    if (!clientsTab) return;

    const invoices = readStore('invoices', []);
    const clients = readStore('clients', []);
    const clientReturns = readStore('client_returns', []);
    const currency = getCurrency();
    const profile = getStoreProfile();

    const indebtedClients = clients
      .map(c => {
        const ledger = calculateClientStatement(c, invoices, clientReturns);
        return {
          id: c.id,
          name: c.name || 'عميل',
          phone: c.phone || '',
          openingBalance: parseFloat(c.openingBalance) || 0,
          ...ledger
        };
      })
      .filter(c => c.balance > 0.01)
      .sort((a, b) => b.balance - a.balance);

    const totalReceivables = indebtedClients.reduce((sum, c) => sum + c.balance, 0);

    const clientsTabBtn = document.querySelector('.nav-tab[data-tab="clients"]');
    if (clientsTabBtn) {
      let badge = document.getElementById('giti-overdue-badge');
      if (indebtedClients.length > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.id = 'giti-overdue-badge';
          badge.style.cssText = 'background: var(--warning); color: #000; font-size: 0.68rem; padding: 1px 6px; border-radius: 99px; margin-right: 4px; font-weight: 800;';
          clientsTabBtn.appendChild(badge);
        }
        badge.textContent = `${indebtedClients.length} مديونية`;
      } else if (badge) {
        badge.remove();
      }
    }

    let widget = document.getElementById('giti-debt-radar-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'giti-debt-radar-widget';
      widget.className = 'card';
      widget.style.cssText = 'margin-bottom: 14px; border: 1px solid rgba(245,158,11,0.45); background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(244,63,94,0.06));';
      clientsTab.insertBefore(widget, clientsTab.firstChild);
    }

    const visibleClients = showAllDebtors ? indebtedClients : indebtedClients.slice(0, 6);

    const listHtml = indebtedClients.length === 0
      ? `<p style="font-size: 0.82rem; color: var(--success); margin: 4px 0 0;">✅ ممتاز! جميع كشوف حسابات العملاء مسددة بالكامل.</p>`
      : visibleClients.map(c => {
          const isHighDebt = c.balance >= 5000;
          return `
            <div class="giti-debt-client-row" data-client-open="${escapeHtml(c.name)}" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 9px 10px; background: var(--input-bg); border-radius: 9px; border-right: 3px solid ${isHighDebt ? 'var(--danger)' : 'var(--warning)'}; margin-top: 6px; flex-wrap: wrap;">
              <div style="font-size: 0.82rem; flex: 1; min-width: 165px;">
                <strong>👤 ${escapeHtml(c.name)}</strong>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                  صافي الرصيد: <strong style="color: var(--danger);">${c.balance.toFixed(2)} ${currency}</strong>
                  • التعاملات: ${c.totalPurchases.toFixed(2)} | المسدد: ${c.totalPaid.toFixed(2)}
                </div>
              </div>
              <div style="display: flex; gap: 5px; align-items: center;" onclick="event.stopPropagation();">
                <button type="button" class="btn-sm giti-open-client-ledger-btn"
                  data-client="${escapeHtml(c.name)}"
                  style="background: var(--accent); color: #fff; font-size: 0.75rem;">
                  📄 كشف الحساب
                </button>
                <button type="button" class="btn-sm giti-debt-remind-btn"
                  data-client="${escapeHtml(c.name)}"
                  data-purchases="${c.totalPurchases.toFixed(2)}"
                  data-paid="${c.totalPaid.toFixed(2)}"
                  data-due="${c.balance.toFixed(2)}"
                  data-phone="${escapeHtml(c.phone)}"
                  style="background: #16a34a; color: #fff; font-size: 0.75rem;">
                  💬 تذكير بالرصيد
                </button>
              </div>
            </div>
          `;
        }).join('');

    const toggleMoreHtml = indebtedClients.length > 6
      ? `<div style="text-align: center; margin-top: 8px;">
           <button type="button" id="giti-toggle-more-debtors" class="btn-sm" style="background: var(--input-bg); color: var(--accent); border: 1px solid var(--border-color); font-size: 0.76rem;">
             ${showAllDebtors ? '🔼 عرض أقل' : `🔽 عرض كل العملاء المدينين (${indebtedClients.length})`}
           </button>
         </div>`
      : '';

    widget.innerHTML = `
      <div class="card-header" style="margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
        <h3 style="font-size: 0.98rem;">🔔 رادار تحصيلات العملاء (${indebtedClients.length})</h3>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="badge badge-unpaid">${totalReceivables.toFixed(2)} ${currency}</span>
          <button type="button" id="giti-export-debts-csv" class="btn-sm" style="background: #0f766e; color: #fff; font-size: 0.74rem;">📊 كشف Excel</button>
        </div>
      </div>
      ${listHtml}
      ${toggleMoreHtml}
    `;

    const expDebtBtn = document.getElementById('giti-export-debts-csv');
    if (expDebtBtn) expDebtBtn.onclick = () => exportDebtsToExcelCSV(indebtedClients);

    const toggleMoreBtn = document.getElementById('giti-toggle-more-debtors');
    if (toggleMoreBtn) {
      toggleMoreBtn.onclick = () => {
        showAllDebtors = !showAllDebtors;
        renderDebtCollectionRadar();
      };
    }

    widget.querySelectorAll('.giti-debt-client-row').forEach(row => {
      row.onclick = () => {
        const cName = row.getAttribute('data-client-open');
        if (cName && typeof window.openClientLedger === 'function') {
          window.openClientLedger(cName);
        }
      };
    });

    widget.querySelectorAll('.giti-open-client-ledger-btn').forEach(btn => {
      btn.onclick = () => {
        const cName = btn.getAttribute('data-client');
        if (cName && typeof window.openClientLedger === 'function') {
          window.openClientLedger(cName);
        }
      };
    });

    widget.querySelectorAll('.giti-debt-remind-btn').forEach(btn => {
      btn.onclick = () => {
        const cName = btn.getAttribute('data-client');
        const purchasesVal = btn.getAttribute('data-purchases');
        const paidVal = btn.getAttribute('data-paid');
        const dueVal = btn.getAttribute('data-due');
        const phone = btn.getAttribute('data-phone');

        const msg = [
          `السلام عليكم أ/ *${cName}*،`,
          `تذكير ودي من *${profile.name || 'إدارة الحسابات'}* بملخص كشف حسابكم لدينا حتى تاريخ (${new Date().toLocaleDateString('ar-EG')}):`,
          `🛍 *إجمالي التعاملات:* ${purchasesVal} ${currency}`,
          `✅ *إجمالي المدفوعات:* ${paidVal} ${currency}`,
          `💰 *صافي الرصيد المتبقي:* ${dueVal} ${currency}`,
          `شاكرين حسن تعاونكم وتعاملكم معنا.`
        ].join('\n');

        const rawPhone = String(phone || '').replace(/[^0-9]/g, '');
        const waPhone = rawPhone.length === 11 && rawPhone.startsWith('01') ? `2${rawPhone}` : rawPhone;
        const url = waPhone
          ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
      };
    });
  }

  // ==========================================================================
  // 6. التصدير المحاسبي بصيغة Excel / CSV عربي (One-Click Excel Export)
  // ==========================================================================
  function toArabicCsvBlob(headers, rows) {
    const escapeCell = (val) => {
      const s = String(val ?? '').replace(/\r?\n/g, ' ');
      if (s.includes(',') || s.includes('"') || s.includes(';')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csvLines = [
      headers.map(escapeCell).join(','),
      ...rows.map(r => r.map(escapeCell).join(','))
    ];
    return new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  }

  async function exportInvoicesToExcelCSV() {
    const invoices = readStore('invoices', []);
    if (invoices.length === 0) {
      alert('لا توجد فواتير مسجلة للتصدير.');
      return;
    }
    const headers = ['رقم الفاتورة', 'التاريخ', 'اسم العميل', 'هاتف العميل', 'المجموع الفرعي', 'الخصم', 'الضريبة', 'الإجمالي النهائي', 'المدفوع', 'المتبقي', 'الحالة'];
    const rows = invoices.map(inv => {
      const grand = parseFloat(inv.grandTotal) || 0;
      const paid = parseFloat(inv.paidAmount) || 0;
      const due = inv.dueAmount !== undefined ? (parseFloat(inv.dueAmount) || 0) : Math.max(0, grand - paid);
      return [
        inv.id,
        inv.date || '',
        inv.client || 'عميل نقدي',
        inv.phone || '',
        (parseFloat(inv.subtotal) || 0).toFixed(2),
        (parseFloat(inv.discount) || 0).toFixed(2),
        (parseFloat(inv.taxAmount) || 0).toFixed(2),
        grand.toFixed(2),
        paid.toFixed(2),
        due.toFixed(2),
        inv.status || ''
      ];
    });
    const blob = toArabicCsvBlob(headers, rows);
    const today = new Date().toISOString().slice(0, 10);
    await shareOrDownloadFile(blob, `GITI_Invoices_${today}.csv`, 'text/csv', 'سجل الفواتير Excel');
  }

  async function exportProductsToExcelCSV() {
    const products = readStore('products', []);
    if (products.length === 0) {
      alert('المخزن فارغ حالياً.');
      return;
    }
    const costMap = buildProductCostMap();
    const headers = ['كود الصنف', 'اسم الصنف', 'الكمية المتاحة', 'سعر التكلفة', 'سعر البيع', 'إجمالي التكلفة', 'إجمالي القيمة البيعية'];
    const rows = products.map(p => {
      const stock = parseFloat(p.stock) || 0;
      const price = parseFloat(p.price) || 0;
      const cost = costMap[(p.name || '').trim().toLowerCase()] || 0;
      return [
        p.id || '',
        p.name || '',
        stock,
        cost.toFixed(2),
        price.toFixed(2),
        (stock * cost).toFixed(2),
        (stock * price).toFixed(2)
      ];
    });
    const blob = toArabicCsvBlob(headers, rows);
    const today = new Date().toISOString().slice(0, 10);
    await shareOrDownloadFile(blob, `GITI_Inventory_${today}.csv`, 'text/csv', 'جرد المخزن Excel');
  }

  async function exportDebtsToExcelCSV(indebtedClients) {
    if (!indebtedClients || indebtedClients.length === 0) {
      alert('لا توجد مديونيات مسجلة على العملاء للتصدير.');
      return;
    }
    const headers = ['اسم العميل', 'رقم الهاتف', 'الرصيد الافتتاحي', 'إجمالي التعاملات', 'إجمالي المدفوعات', 'صافي المديونية المتبقية'];
    const rows = indebtedClients.map(c => [
      c.name || '',
      c.phone || '',
      (c.openingBalance || 0).toFixed(2),
      (c.totalPurchases || 0).toFixed(2),
      (c.totalPaid || 0).toFixed(2),
      (c.balance || 0).toFixed(2)
    ]);
    const blob = toArabicCsvBlob(headers, rows);
    const today = new Date().toISOString().slice(0, 10);
    await shareOrDownloadFile(blob, `GITI_Clients_Receivables_${today}.csv`, 'text/csv', 'كشف مديونيات العملاء Excel');
  }

  function injectInvoicesExcelButton() {
    const invContainer = document.getElementById('invoices-container');
    if (!invContainer || !invContainer.parentElement || document.getElementById('giti-export-invoices-csv')) return;

    const bar = document.createElement('div');
    bar.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 8px;';
    bar.innerHTML = `<button type="button" id="giti-export-invoices-csv" class="btn-sm" style="background: #0f766e; color: #fff; font-size: 0.78rem;">📊 تصدير سجل الفواتير Excel</button>`;
    invContainer.parentElement.insertBefore(bar, invContainer);
    document.getElementById('giti-export-invoices-csv').onclick = exportInvoicesToExcelCSV;
  }

  // ==========================================================================
  // 7. حارس النسخ الاحتياطي الوقائي (كل 7 أيام)
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
  // 8. محرك طباعة الإيصالات الحرارية (80mm & 58mm) + إرسال واتساب نصي
  // ==========================================================================
  function injectThermalTriggers() {
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

        <div style="display: flex; gap: 8px; margin-bottom: 10px; background: var(--input-bg); padding: 6px; border-radius: 10px; border: 1px solid var(--border-color);">
          <button type="button" id="giti-width-80-btn" class="btn-sm" style="flex: 1; font-weight: 800;">📏 ورق 80mm (كبير)</button>
          <button type="button" id="giti-width-58-btn" class="btn-sm" style="flex: 1; font-weight: 800;">📏 ورق 58mm (صغير)</button>
        </div>

        <div style="flex: 1; overflow-y: auto; background: #e5e7eb; padding: 14px 8px; border-radius: 12px; display: flex; justify-content: center; align-items: flex-start;">
          <div id="giti-thermal-paper" style="background: #ffffff; color: #000000; padding: 12px 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.18); font-family: 'Cairo', Tahoma, sans-serif; direction: rtl; text-align: right; box-sizing: border-box;">
          </div>
        </div>

        <div style="margin-top: 10px;">
          <input type="text" id="giti-thermal-footer-input" placeholder="عبارة أسفل الإيصال (مثلاً: شكراً لزيارتكم)" style="min-height: 36px; font-size: 0.8rem; padding: 6px 10px;">
        </div>

        <div class="modal-actions-row" style="margin-top: 10px; flex-wrap: wrap;">
          <button type="button" id="giti-thermal-print-btn" class="btn-success">🖨️ طباعة</button>
          <button type="button" id="giti-thermal-pdf-btn" class="btn-primary">📲 بلوتوث / PDF</button>
          <button type="button" id="giti-thermal-wa-btn" class="btn-sm" style="background: #16a34a; color: #fff; min-height: 42px;">💬 واتساب</button>
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
    document.getElementById('giti-thermal-wa-btn').onclick = shareThermalWhatsAppText;

    return modal;
  }

  function shareThermalWhatsAppText() {
    if (!activeThermalInvoice) return;
    const inv = activeThermalInvoice;
    const profile = getStoreProfile();
    const currency = profile.currency || 'ج.م';

    const lines = [
      `*${profile.name || 'GITI ERP'}*`,
      ...(profile.phone ? [`📞 هاتف: ${profile.phone}`] : []),
      ...(profile.address ? [`📍 العنوان: ${profile.address}`] : []),
      `🧾 *فاتورة مبيعات رقم #${inv.id}*`,
      `📅 التاريخ: ${inv.date || ''}`,
      `👤 العميل: ${inv.client || 'عميل نقدي'}`,
      `──────────────`,
      ...(inv.items || []).map(it => {
        const q = parseFloat(it.qty) || 0;
        const p = parseFloat(it.price) || 0;
        return `• ${it.name} (${q} × ${p.toFixed(2)}) = *${(q * p).toFixed(2)} ${currency}*`;
      }),
      `──────────────`,
      `💰 *الإجمالي: ${(parseFloat(inv.grandTotal) || 0).toFixed(2)} ${currency}*`,
      `📌 الحالة: ${inv.status || ''}`
    ];

    if (inv.status === 'مدفوعة جزئياً') {
      lines.push(`✅ المدفوع: ${(parseFloat(inv.paidAmount) || 0).toFixed(2)} ${currency}`);
      lines.push(`⏳ المتبقي: ${(parseFloat(inv.dueAmount) || 0).toFixed(2)} ${currency}`);
    }

    const rawPhone = String(inv.phone || '').replace(/[^0-9]/g, '');
    const waPhone = rawPhone.length === 11 && rawPhone.startsWith('01') ? `2${rawPhone}` : rawPhone;
    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(lines.join('\n'))}`
      : `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;

    window.open(url, '_blank');
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
          <td style="padding: 4px 2px; font-weight: 700; color: #000; word-break: break-word;">${escapeHtml(item.name)}</td>
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
        <div style="font-size: ${titleFont}; font-weight: 900; color: #000;">${escapeHtml(profile.name || 'GITI ERP')}</div>
        ${profile.phone ? `<div style="font-size: 0.9em; color: #000;">هاتف: ${escapeHtml(profile.phone)}</div>` : ''}
        ${profile.vatNo ? `<div style="font-size: 0.85em; color: #000;">الرقم الضريبي: ${escapeHtml(profile.vatNo)}</div>` : ''}
        ${profile.address ? `<div style="font-size: 0.85em; color: #000;">${escapeHtml(profile.address)}</div>` : ''}
        <div style="margin-top: 6px; padding: 3px 6px; border: 1.5px solid #000; font-weight: 900; display: inline-block; font-size: 0.95em;">
          إيصال مبيعات #${inv.id}
        </div>
      </div>

      <div style="border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 0.92em;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>التاريخ:</strong> ${escapeHtml(inv.date || '')}</span>
          <span><strong>الحالة:</strong> ${escapeHtml(inv.status || '')}</span>
        </div>
        <div><strong>العميل:</strong> ${escapeHtml(inv.client || 'عميل نقدي')}</div>
        ${inv.phone ? `<div><strong>هاتف العميل:</strong> ${escapeHtml(inv.phone)}</div>` : ''}
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
        <div style="font-size: 0.85em; font-weight: 700; margin-top: 6px; color: #000;">${escapeHtml(footerNote)}</div>
        <div style="font-size: 0.75em; margin-top: 4px; color: #374151;">Powered by GITI ERP</div>
      </div>
    `;

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

  function printThermalReceiptIframe() {
    const paper = document.getElementById('giti-thermal-paper');
    if (!paper) return;

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
        await shareOrDownloadFile(
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

        await shareOrDownloadFile(
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
  // 9. حماية فواصل الطباعة
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

  // ==========================================================================
  // تشغيل وتحديث جميع وحدات النواة
  // ==========================================================================
  function refreshAllAddons() {
    renderCashDrawerSummary();
    updateLowStockRadar();
    injectLiveInvoiceTools();
    updateLiveInvoiceProfitGuard();
    renderDebtCollectionRadar();
    injectInvoicesExcelButton();
    initBackupGuard();
    injectThermalTriggers();
    injectPrintRowProtection();
  }

  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest('.nav-tab')) {
      scheduleRefresh();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(refreshAllAddons, 400));
  } else {
    setTimeout(refreshAllAddons, 400);
  }
})();
