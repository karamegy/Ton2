// ==========================================
// Invoices & Inventory Engine
// ==========================================

export function generateZatcaTlvBase64(sellerName, vatNo, timeStamp, totalAmount, vatAmount) {
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

export function renderQrCode(containerId, dataText) {
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
