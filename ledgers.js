// ==========================================
// Clients & Suppliers Ledger Engine
// ==========================================

export function calculateClientLedger(clientObj, invoicesDB) {
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

export function calculateSupplierLedger(supplierObj, purchasesDB) {
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
