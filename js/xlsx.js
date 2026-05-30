/* ====== Excel / File Operations ====== */

// ---- Parse Excel customers ----
function parseExcelCustomers(data) {
  const wb = XLSX.read(data, { type: 'array', codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Expected columns: الاسم, رقم الهاتف, سعر الباقة, الخطة, الرقم القومي
  const customers = [];
  let headerFound = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const rowStr = row.map(String);
    // Try to detect header row
    if (/اسم|phone|name/i.test(rowStr[0]) && /رقم|phone|mobile|tel/i.test(rowStr[1])) {
      headerFound = true;
      continue;
    }
    if (headerFound || i === 0) {
      const name = String(row[0] || '').trim();
      const phone = String(row[1] || '').trim();
      if (name && phone) {
        customers.push({
          name,
          phone,
          planPrice: parseFloat(row[2]) || 0,
          plan: String(row[3] || 'مفوتر').trim(),
          nationalId: String(row[4] || '').trim()
        });
      }
    }
  }
  return customers;
}

// ---- Parse Excel invoices ----
function parseExcelInvoices(data) {
  const wb = XLSX.read(data, { type: 'array', codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const invoices = [];
  let headerFound = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const rowStr = row.map(String);
    if (/رقم|phone|mobile/i.test(rowStr[0]) && /خطة|plan/i.test(rowStr[1])) {
      headerFound = true;
      continue;
    }
    if (headerFound || i === 0) {
      const phone = String(row[0] || '').trim();
      const amount = parseFloat(row[2]) || 0;
      if (phone && amount > 0) {
        invoices.push({
          phone,
          plan: String(row[1] || 'مفوتر').trim(),
          amount
        });
      }
    }
  }
  return invoices;
}

// ---- Generate Excel from table ----
function exportTableToExcel(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Sheet1' });
  XLSX.writeFile(wb, filename);
}
