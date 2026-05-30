/* ====== Main Application ====== */

// ---- State ----
let allCustomers = [];
let allInvoices = [];
let allPayments = [];
let pendingInvoices = [];
let currentWalletPhone = null;
let currentWalletData = null;

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', async () => {
  // Set default month
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('invoiceMonth').value = defaultMonth;
  document.getElementById('collectionMonth').value = defaultMonth;

  // Load data with listeners
  onCustomersChange(customers => {
    allCustomers = customers;
    renderCustomerTable();
    updateDashboard();
  });
  onInvoicesChange(invoices => {
    allInvoices = invoices;
    updateDashboard();
    if (document.getElementById('page-collection').classList.contains('active')) renderCollectionTable();
    renderStatement();
    renderPaymentsTable();
  });
  onPaymentsChange(payments => {
    allPayments = payments;
    updateDashboard();
    renderPaymentsTable();
  });

  // Load settings
  const lastMonth = await getSetting('lastMonth');
  if (lastMonth) {
    document.getElementById('invoiceMonth').value = lastMonth;
    document.getElementById('collectionMonth').value = lastMonth;
  }

  // Populate statement months
  populateStatementMonths();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Dark mode
  const darkToggle = document.getElementById('darkModeToggle');
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
    darkToggle.textContent = '☀️ الوضع الفاتح';
  }
  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    darkToggle.textContent = isDark ? '☀️ الوضع الفاتح' : '🌙 الوضع الداكن';
  });
});

// ---- Navigation ----
function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    // Trigger page-specific updates
    if (page === 'dashboard') updateDashboard();
    if (page === 'collection') renderCollectionTable();
    if (page === 'payments') renderPaymentsTable();
    if (page === 'statement') { populateStatementMonths(); renderStatement(); }
  }
}

// ---- Notification ----
function notify(message, type = 'success') {
  const el = document.getElementById('notification');
  el.textContent = message;
  el.className = `notification ${type}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function showLoading(show) {
  document.getElementById('loadingBar').classList.toggle('active', show);
}

// ---- Dashboard ----
function updateDashboard() {
  const customers = allCustomers;
  const invoices = allInvoices;
  const payments = allPayments;

  // Count lines (phones)
  let totalLines = 0;
  customers.forEach(c => {
    totalLines++;
    if (c.extraPhones) {
      const lines = Array.isArray(c.extraPhones) ? c.extraPhones : c.extraPhones.split('\n').filter(p => p.trim());
      totalLines += lines.length;
    }
  });

  const totalInvoices = invoices.length;
  // Revenue = planPrice of paid invoices
  let totalRevenue = 0;
  let totalCost = 0;
  let totalUnpaidRevenue = 0;
  invoices.forEach(inv => {
    const cust = customers.find(c => c.id === inv.customerId || c.phone === inv.phone);
    const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
    if (inv.status === 'paid') {
      totalRevenue += planP;
      totalCost += inv.amount;
    } else if (inv.status === 'unpaid' || inv.status === 'partial') {
      totalUnpaidRevenue += planP;
    }
  });
  const totalPaid = totalRevenue;
  const totalUnpaid = totalUnpaidRevenue;
  const totalProfit = totalRevenue - totalCost;

  document.getElementById('statCustomers').textContent = customers.length;
  document.getElementById('statLines').textContent = totalLines;
  document.getElementById('statInvoices').textContent = totalInvoices;
  document.getElementById('statPaid').textContent = totalPaid.toFixed(2);
  document.getElementById('statUnpaid').textContent = totalUnpaid.toFixed(2);
  document.getElementById('statProfit').textContent = totalProfit.toFixed(2);

  // Top delinquent customers (based on unpaid planPrice)
  const customerDebt = {};
  invoices.filter(i => i.status === 'unpaid' || i.status === 'partial').forEach(i => {
    const key = i.customerId || i.phone;
    const cust = customers.find(c => c.id === i.customerId || c.phone === i.phone);
    const planP = i.planPrice || (cust ? cust.planPrice : 0) || 0;
    customerDebt[key] = (customerDebt[key] || 0) + planP;
  });
  const sorted = Object.entries(customerDebt)
    .map(([key, debt]) => {
      const c = customers.find(cu => cu.id === key || cu.phone === key);
      return { name: c ? c.name : key, phone: c ? c.phone : key, debt };
    })
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 5);

  const tbody = document.querySelector('#topDelinquentTable tbody');
  tbody.innerHTML = sorted.map((c, i) =>
    `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.phone}</td><td>${c.debt.toFixed(2)}</td></tr>`
  ).join('');

  initDashboardCharts(payments, invoices);
}

// ---- Customers ----
function renderCustomerTable() {
  const search = (document.getElementById('customerSearch')?.value || '').trim().toLowerCase();
  const filtered = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search) || c.phone.includes(search)
  );
  const tbody = document.querySelector('#customerTable tbody');
  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.phone}</td>
      <td>${c.planPrice || 0}</td>
      <td>${c.plan || 'مفوتر'}</td>
      <td>${c.nationalId || '-'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editCustomer('${c.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function showAddCustomerModal() {
  document.getElementById('customerModalTitle').textContent = 'إضافة عميل جديد';
  document.getElementById('editCustomerId').value = '';
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custPlanPrice').value = '';
  document.getElementById('custPlan').value = 'مفوتر';
  document.getElementById('custNationalId').value = '';
  document.getElementById('custExtraPhones').value = '';
  document.getElementById('customerModal').style.display = 'flex';
}

function closeCustomerModal() {
  document.getElementById('customerModal').style.display = 'none';
}

function editCustomer(id) {
  const c = allCustomers.find(cu => cu.id === id);
  if (!c) return;
  document.getElementById('customerModalTitle').textContent = 'تعديل عميل';
  document.getElementById('editCustomerId').value = id;
  document.getElementById('custName').value = c.name;
  document.getElementById('custPhone').value = c.phone;
  document.getElementById('custPlanPrice').value = c.planPrice || 0;
  document.getElementById('custPlan').value = c.plan || 'مفوتر';
  document.getElementById('custNationalId').value = c.nationalId || '';
  document.getElementById('custExtraPhones').value = Array.isArray(c.extraPhones) ? c.extraPhones.join('\n') : (c.extraPhones || '');
  document.getElementById('customerModal').style.display = 'flex';
}

async function deleteCustomer(id) {
  if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
  showLoading(true);
  await deleteCustomerFromFB(id);
  notify('تم حذف العميل بنجاح');
  showLoading(false);
}

async function saveCustomer(e) {
  e.preventDefault();
  const id = document.getElementById('editCustomerId').value;
  const extraRaw = document.getElementById('custExtraPhones').value;
  const extraPhones = extraRaw ? extraRaw.split('\n').map(s => s.trim()).filter(s => s) : [];
  const customer = {
    name: document.getElementById('custName').value.trim(),
    phone: document.getElementById('custPhone').value.trim(),
    planPrice: parseFloat(document.getElementById('custPlanPrice').value) || 0,
    plan: document.getElementById('custPlan').value,
    nationalId: document.getElementById('custNationalId').value.trim(),
    extraPhones
  };
  if (id) customer.id = id;
  showLoading(true);
  await saveCustomerToFB(customer);
  closeCustomerModal();
  notify(id ? 'تم تعديل العميل' : 'تم إضافة العميل');
  showLoading(false);
}

async function importCustomersFromExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      showLoading(true);
      const data = new Uint8Array(ev.target.result);
      const customers = parseExcelCustomers(data);
      if (customers.length === 0) { notify('لم يتم العثور على بيانات', 'error'); showLoading(false); return; }
      let saved = 0;
      for (const c of customers) {
        await saveCustomerToFB(c);
        saved++;
      }
      notify(`تم استيراد ${saved} عميل بنجاح`);
    } catch (err) { notify('خطأ في قراءة الملف: ' + err.message, 'error'); }
    showLoading(false);
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

// ---- Import Invoices ----
async function importInvoicesFromExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  const month = document.getElementById('invoiceMonth').value;
  if (!month) { notify('يرجى اختيار الشهر', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      const parsed = parseExcelInvoices(data);
      if (parsed.length === 0) { notify('لم يتم العثور على بيانات', 'error'); return; }
      pendingInvoices = [];
      const checked = [];
      for (const inv of parsed) {
        const existing = await getInvoiceByPhoneMonth(inv.phone, month);
        if (existing) {
          checked.push({ ...inv, status: '⚠️ موجود مسبقًا', canSave: false });
        } else {
          checked.push({ ...inv, status: 'جديد', canSave: true });
          const cust = allCustomers.find(c => c.phone === inv.phone || (c.extraPhones && c.extraPhones.includes(inv.phone)));
          pendingInvoices.push({
            ...inv, month, status: 'unpaid', paid: 0,
            customerId: cust ? cust.id : '',
            customerName: cust ? cust.name : '',
            planPrice: cust ? (cust.planPrice || 0) : 0
          });
        }
      }
      renderInvoicePreview(checked);
      notify(`تم العثور على ${parsed.length} فاتورة، ${pendingInvoices.length} جديدة`);
    } catch (err) { notify('خطأ في قراءة الملف: ' + err.message, 'error'); }
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

async function importInvoicesFromJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const month = document.getElementById('invoiceMonth').value;
  if (!month) { notify('يرجى اختيار الشهر', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed)) throw new Error('يجب أن يكون المصفوفة');
      pendingInvoices = [];
      const checked = [];
      for (const inv of parsed) {
        const existing = await getInvoiceByPhoneMonth(inv.phone, month);
        if (existing) {
          checked.push({ ...inv, status: '⚠️ موجود مسبقًا', canSave: false });
        } else {
          checked.push({ ...inv, status: 'جديد', canSave: true });
          const cust = allCustomers.find(c => c.phone === inv.phone);
          pendingInvoices.push({ ...inv, month, status: 'unpaid', paid: 0, customerId: cust ? cust.id : '', customerName: cust ? cust.name : '', planPrice: cust ? (cust.planPrice || 0) : 0 });
        }
      }
      renderInvoicePreview(checked);
      notify(`تم العثور على ${parsed.length} فاتورة، ${pendingInvoices.length} جديدة`);
    } catch (err) { notify('خطأ في قراءة JSON: ' + err.message, 'error'); }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function renderInvoicePreview(checked) {
  const tbody = document.querySelector('#invoicePreviewTable tbody');
  tbody.innerHTML = checked.map(inv => `
    <tr style="${inv.canSave ? '' : 'opacity:0.5'}">
      <td>${inv.phone}</td>
      <td>${inv.plan || '-'}</td>
      <td>${inv.amount}</td>
      <td>${inv.status}</td>
    </tr>
  `).join('');
  document.getElementById('invoicePreview').style.display = 'block';
}

async function saveInvoices() {
  if (pendingInvoices.length === 0) { notify('لا توجد فواتير جديدة للحفظ', 'warning'); return; }
  showLoading(true);
  try {
    await saveInvoicesBatch(pendingInvoices);
    await setSetting('lastMonth', document.getElementById('invoiceMonth').value);
    let success = pendingInvoices.length;
    let failed = 0;
    document.getElementById('invoiceResult').innerHTML =
      `<div class="card"><p>✅ تم حفظ <strong>${success}</strong> فاتورة بنجاح</p>${failed ? `<p>❌ فشل <strong>${failed}</strong> فاتورة</p>` : ''}</div>`;
    pendingInvoices = [];
    document.getElementById('invoicePreview').style.display = 'none';
    notify(`تم حفظ ${success} فاتورة`);
  } catch (err) { notify('خطأ في الحفظ: ' + err.message, 'error'); }
  showLoading(false);
}

function cancelInvoiceImport() {
  pendingInvoices = [];
  document.getElementById('invoicePreview').style.display = 'none';
}

async function generatePrepaidInvoices() {
  const month = document.getElementById('invoiceMonth').value;
  if (!month) { notify('يرجى اختيار الشهر', 'error'); return; }
  if (!confirm('سيتم توليد فاتورة لكل عميل بنفس سعر الباقة. هل أنت متأكد؟')) return;
  showLoading(true);
  let count = 0;
  for (const c of allCustomers) {
    const existing = await getInvoiceByPhoneMonth(c.phone, month);
    if (!existing) {
      await saveInvoiceToFB({
        phone: c.phone,
        customerId: c.id,
        customerName: c.name,
        month,
        amount: 0,
        planPrice: c.planPrice || 0,
        paid: 0,
        status: 'unpaid',
        plan: c.plan || 'مفوتر'
      });
      count++;
    }
    if (c.extraPhones) {
      const phones = Array.isArray(c.extraPhones) ? c.extraPhones : c.extraPhones.split('\n').filter(p => p.trim());
      for (const ph of phones) {
        const phTrim = ph.trim();
        if (!phTrim) continue;
        const existing2 = await getInvoiceByPhoneMonth(phTrim, month);
        if (!existing2) {
          await saveInvoiceToFB({
            phone: phTrim,
            customerId: c.id,
            customerName: c.name,
            month,
            amount: 0,
            planPrice: c.planPrice || 0,
            paid: 0,
            status: 'unpaid',
            plan: c.plan || 'مفوتر'
          });
          count++;
        }
      }
    }
  }
  notify(`تم توليد ${count} فاتورة مسبقة`);
  showLoading(false);
}

// ---- Collection ----
async function renderCollectionTable() {
  const month = document.getElementById('collectionMonth').value;
  const filter = document.getElementById('collectionFilter').value;
  const search = (document.getElementById('collectionSearch')?.value || '').trim().toLowerCase();
  if (!month) return;

  let invoices = allInvoices.filter(i => i.month === month);
  if (filter === 'unpaid') invoices = invoices.filter(i => i.status === 'unpaid');
  else if (filter === 'paid') invoices = invoices.filter(i => i.status === 'paid');
  else if (filter === 'partial') invoices = invoices.filter(i => i.status === 'partial');

  // Search summary
  const summaryDiv = document.getElementById('collectionSearchSummary');
  if (search) {
    const related = allCustomers.filter(c => c.name.toLowerCase().includes(search) || c.phone.includes(search));
    let totalPlanPrice = 0;
    let totalInvoiceAmount = 0;
    const relatedPhones = [];
    related.forEach(c => {
      totalPlanPrice += c.planPrice || 0;
      relatedPhones.push(c.phone);
      if (c.extraPhones) {
        const phones = Array.isArray(c.extraPhones) ? c.extraPhones : c.extraPhones.split('\n').filter(p => p.trim());
        phones.forEach(ph => relatedPhones.push(ph));
      }
    });
    const relatedInvoices = allInvoices.filter(i => i.month === month && relatedPhones.includes(i.phone));
    totalInvoiceAmount = relatedInvoices.reduce((s, i) => s + i.amount, 0);
    if (related.length > 0) {
      summaryDiv.style.display = 'block';
      summaryDiv.innerHTML = `
        <strong>نتائج البحث:</strong> ${related.length} عميل<br>
        <strong>إجمالي أسعار الباقات:</strong> ${totalPlanPrice.toFixed(2)}<br>
        <strong>إجمالي الفواتير:</strong> ${totalInvoiceAmount.toFixed(2)}
      `;
    } else {
      summaryDiv.style.display = 'none';
    }
    // Filter invoices by search
    const matchedPhones = allCustomers.filter(c =>
      c.name.toLowerCase().includes(search) || c.phone.includes(search)
    ).reduce((acc, c) => {
      acc.push(c.phone);
      if (c.extraPhones) {
        const phones = Array.isArray(c.extraPhones) ? c.extraPhones : c.extraPhones.split('\n').filter(p => p.trim());
        phones.forEach(ph => acc.push(ph));
      }
      return acc;
    }, []);
    invoices = invoices.filter(i => matchedPhones.includes(i.phone));
  } else {
    summaryDiv.style.display = 'none';
  }

  const tbody = document.querySelector('#collectionTable tbody');
  let hasLowPlan = false;
  tbody.innerHTML = invoices.map(inv => {
    const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
    const name = cust ? cust.name : (inv.customerName || '-');
    const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
    const paid = inv.paid || 0;
    const profit = inv.status === 'paid' ? (planP - inv.amount) : 0;
    const lowWarning = (planP < inv.amount && inv.amount > 0);
    if (lowWarning) hasLowPlan = true;
    const warnIcon = lowWarning ? `<span class="badge badge-warning" title="سعر الباقة أقل من الفاتورة!">⚠️</span>` : '';
    const statusLabel = inv.status === 'paid' ? '<span class="badge badge-success">مدفوعة</span>' :
      inv.status === 'partial' ? `<span class="badge badge-warning">جزئي (${paid})</span>` :
      '<span class="badge badge-danger">غير مدفوعة</span>';
    return `
      <tr>
        <td>${inv.phone} ${warnIcon}</td>
        <td>${name}</td>
        <td>${inv.plan || '-'}</td>
        <td>${inv.amount}</td>
        <td>${planP}</td>
        <td>${paid}</td>
        <td>${profit.toFixed(2)}</td>
        <td>${statusLabel}</td>
        <td><input type="number" id="planPrice_${inv.id}" value="${planP}" class="form-group" style="width:80px" onchange="updatePlanPrice('${inv.id}', this.value, '${inv.month}')"></td>
        <td>
          <button class="btn btn-success btn-sm" onclick="payInvoice('${inv.id}')" ${inv.status === 'paid' ? 'disabled' : ''}>💰 دفع</button>
          ${inv.status === 'paid' ? `<button class="btn btn-warning btn-sm" onclick="unpayInvoice('${inv.id}')">↩️ إلغاء</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  // Show global warning if any low plan prices
  if (hasLowPlan && !search) {
    const lowCount = invoices.filter(inv => {
      const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
      const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
      return planP < inv.amount && inv.amount > 0;
    }).length;
    summaryDiv.style.display = 'block';
    summaryDiv.innerHTML = `<div class="badge badge-warning" style="font-size:1rem;padding:0.5rem 1rem">⚠️ يوجد <strong>${lowCount}</strong> رقم سعر باقته أقل من قيمة الفاتورة. يرجى مراجعة وتعديل سعر الباقة أو تجاهل التنبيه.</div>`;
  } else if (!search) {
    summaryDiv.style.display = 'none';
  }

  // Total
  const totalCollectible = invoices.reduce((s, i) => {
    const cust = allCustomers.find(c => c.id === i.customerId || c.phone === i.phone);
    const planP = i.planPrice || (cust ? cust.planPrice : 0) || 0;
    if (i.status === 'unpaid' || i.status === 'partial') return s + planP;
    return s;
  }, 0);
  document.getElementById('collectionTotal').textContent = `الإجمالي المطلوب تحصيله (سعر الباقات): ${totalCollectible.toFixed(2)}`;
}

async function updatePlanPrice(invoiceId, price, month) {
  const inv = allInvoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
  if (cust) {
    cust.planPrice = parseFloat(price) || 0;
    await saveCustomerToFB(cust);
    inv.planPrice = parseFloat(price) || 0;
    await saveInvoiceToFB(inv);
    notify('تم تحديث سعر الباقة');
    renderCollectionTable();
  }
}

async function payInvoice(id) {
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  if (inv.status === 'paid') { notify('الفاتورة مدفوعة بالفعل'); return; }
  const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
  const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
  if (planP <= 0) { notify('سعر الباقة صفر، يرجى تحديد سعر الباقة أولاً', 'error'); return; }

  // Warn if planPrice < invoice amount
  if (planP < inv.amount && inv.amount > 0) {
    const action = confirm(`⚠️ تحذير: سعر الباقة (${planP}) أقل من قيمة الفاتورة (${inv.amount})!\n\nالخسارة المتوقعة: ${(planP - inv.amount).toFixed(2)}\n\nاختر "موافق" لتعديل سعر الباقة ليتوافق مع الفاتورة، أو "إلغاء" للتجاهل والاستمرار في الدفع.`);
    if (action) {
      // User wants to adjust - prompt for new price
      const newPrice = prompt('أدخل سعر الباقة الجديد (أو اتركه فارغًا للتجاهل):', inv.amount);
      if (newPrice !== null && newPrice !== '') {
        const newPlanP = parseFloat(newPrice);
        if (newPlanP > 0) {
          cust.planPrice = newPlanP;
          inv.planPrice = newPlanP;
          await saveCustomerToFB(cust);
          await saveInvoiceToFB(inv);
          notify(`تم تعديل سعر الباقة إلى ${newPlanP}`);
          renderCollectionTable();
          return;
        }
      }
    }
  }

  // Check wallet
  const wallet = await getWallet(inv.phone);
  let payAmount = planP;
  if (wallet.balance > 0) {
    const useWallet = confirm(`للعميل رصيد محفظة: ${wallet.balance.toFixed(2)}. هل تريد استخدامه للدفع؟`);
    if (useWallet) {
      const deduct = Math.min(wallet.balance, planP);
      payAmount = planP;
      wallet.balance -= deduct;
      wallet.transactions = wallet.transactions || [];
      wallet.transactions.push({ type: 'payment', amount: deduct, date: Date.now(), desc: `دفع سعر باقة ${inv.month}` });
      await saveWalletToFB(inv.phone, wallet);
    }
  }

  inv.paid = (inv.paid || 0) + payAmount;
  inv.status = 'paid';
  await saveInvoiceToFB(inv);

  await savePaymentToFB({
    phone: inv.phone,
    customerId: inv.customerId,
    customerName: inv.customerName,
    month: inv.month,
    amount: payAmount,
    date: Date.now(),
    type: 'collection'
  });

  notify(`تم تحصيل سعر الباقة: ${payAmount.toFixed(2)}`);
  renderCollectionTable();
}

async function collectAll() {
  const month = document.getElementById('collectionMonth').value;
  const filter = document.getElementById('collectionFilter').value;
  let invoices = allInvoices.filter(i => i.month === month && (i.status === 'unpaid' || i.status === 'partial'));
  if (invoices.length === 0) { notify('لا توجد فواتير غير مدفوعة', 'warning'); return; }

  // Check for low plan prices
  let warnings = [];
  for (const inv of invoices) {
    const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
    const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
    if (planP < inv.amount && inv.amount > 0) {
      warnings.push(`${inv.phone}: الباقة ${planP} < الفاتورة ${inv.amount}`);
    }
  }
  if (warnings.length > 0) {
    const msg = '⚠️ تحذير: الأرقام التالية سعر باقتها أقل من الفاتورة:\n' + warnings.join('\n') +
      '\n\nاختر "موافق" لتعديل الأسعار تلقائيًا لتساوي الفاتورة، أو "إلغاء" للتجاهل والاستمرار.';
    if (confirm(msg)) {
      for (const inv of invoices) {
        const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
        const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
        if (planP < inv.amount && inv.amount > 0) {
          const newP = inv.amount;
          if (cust) { cust.planPrice = newP; await saveCustomerToFB(cust); }
          inv.planPrice = newP;
          await saveInvoiceToFB(inv);
        }
      }
      notify('تم تعديل أسعار الباقات تلقائيًا');
    }
  }

  if (!confirm(`سيتم تحصيل ${invoices.length} فاتورة. هل أنت متأكد؟`)) return;
  showLoading(true);
  let total = 0;
  for (const inv of invoices) {
    const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
    const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
    if (planP <= 0) continue;
    inv.paid = planP;
    inv.status = 'paid';
    await saveInvoiceToFB(inv);
    await savePaymentToFB({
      phone: inv.phone,
      customerId: inv.customerId,
      customerName: inv.customerName,
      month: inv.month,
      amount: planP,
      date: Date.now(),
      type: 'collection'
    });
    total += planP;
  }
  notify(`تم تحصيل ${total.toFixed(2)} لـ ${invoices.length} فاتورة`);
  showLoading(false);
  renderCollectionTable();
}

async function unpayInvoice(id) {
  if (!confirm('هل تريد إلغاء دفع هذه الفاتورة؟')) return;
  const inv = allInvoices.find(i => i.id === id);
  if (!inv) return;
  inv.paid = 0;
  inv.status = 'unpaid';
  await saveInvoiceToFB(inv);
  notify('تم إلغاء الدفع');
  renderCollectionTable();
}

async function deleteInvoice(id) {
  if (!confirm('هل تريد حذف هذه الفاتورة؟')) return;
  await deleteInvoiceFromFB(id);
  notify('تم حذف الفاتورة');
}

// ---- Wallet ----
async function searchWallet() {
  const search = (document.getElementById('walletSearch').value || '').trim().toLowerCase();
  const resultsDiv = document.getElementById('walletResults');
  const editArea = document.getElementById('walletEditArea');

  if (!search) { resultsDiv.innerHTML = ''; editArea.style.display = 'none'; return; }

  const matched = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search) || c.phone.includes(search)
  );

  if (matched.length === 0) {
    resultsDiv.innerHTML = '<p>لا توجد نتائج</p>';
    editArea.style.display = 'none';
    return;
  }

  // Show customer options
  resultsDiv.innerHTML = matched.map(c => `
    <div class="card" style="cursor:pointer;margin-bottom:0.5rem" onclick="selectWallet('${c.phone}')">
      <strong>${c.name}</strong> - ${c.phone}
    </div>
  `).join('');

  // If only one match, auto-select
  if (matched.length === 1) {
    await selectWallet(matched[0].phone);
  } else {
    editArea.style.display = 'none';
  }
}

async function selectWallet(phone) {
  currentWalletPhone = phone;
  const wallet = await getWallet(phone);
  currentWalletData = wallet;
  const cust = allCustomers.find(c => c.phone === phone);
  document.getElementById('walletResults').innerHTML = `
    <div class="card">
      <strong>${cust ? cust.name : phone}</strong> - ${phone}
      <br>الرصيد الحالي: <strong id="walletBalanceDisplay">${wallet.balance.toFixed(2)}</strong>
    </div>
  `;
  renderWalletTransactions(phone, wallet);
  document.getElementById('walletEditArea').style.display = 'block';
  document.getElementById('walletBalance').textContent = `الرصيد الحالي: ${wallet.balance.toFixed(2)}`;
}

function renderWalletTransactions(phone, wallet) {
  const tbody = document.querySelector('#walletTransactionsTable tbody');
  const transactions = wallet.transactions || [];
  let balance = 0;
  tbody.innerHTML = transactions.map(t => {
    const isCredit = t.type === 'deposit' || t.type === 'settle_credit';
    const isDebit = t.type === 'payment' || t.type === 'withdraw' || t.type === 'settle_debit';
    const amount = t.amount || 0;
    if (isCredit) balance += amount;
    else if (isDebit) balance -= amount;
    const date = t.date ? new Date(t.date).toLocaleDateString('ar-EG') : '-';
    const desc = t.desc || t.type || '-';
    return `<tr>
      <td>${date}</td>
      <td>${desc}</td>
      <td>${isDebit ? amount.toFixed(2) : '-'}</td>
      <td>${isCredit ? amount.toFixed(2) : '-'}</td>
      <td>${balance.toFixed(2)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">لا توجد معاملات</td></tr>';
}

async function walletDeposit() {
  if (!currentWalletPhone || !currentWalletData) { notify('اختر عميلاً أولاً', 'warning'); return; }
  const amount = parseFloat(document.getElementById('walletDepositAmount').value);
  if (!amount || amount <= 0) { notify('أدخل مبلغًا صحيحًا', 'error'); return; }
  currentWalletData.balance += amount;
  currentWalletData.lastDeposit = amount;
  currentWalletData.lastDepositDate = Date.now();
  currentWalletData.transactions = currentWalletData.transactions || [];
  currentWalletData.transactions.push({ type: 'deposit', amount, date: Date.now(), desc: 'إيداع في المحفظة' });
  document.getElementById('walletBalance').textContent = `الرصيد الحالي: ${currentWalletData.balance.toFixed(2)}`;
  document.getElementById('walletDepositAmount').value = '';
  await saveWalletToFB(currentWalletPhone, currentWalletData);
  renderWalletTransactions(currentWalletPhone, currentWalletData);
  document.getElementById('walletBalanceDisplay').textContent = currentWalletData.balance.toFixed(2);
  notify(`تم إيداع ${amount.toFixed(2)}`);
}

async function walletWithdraw() {
  if (!currentWalletPhone || !currentWalletData) { notify('اختر عميلاً أولاً', 'warning'); return; }
  const amount = parseFloat(document.getElementById('walletWithdrawAmount').value);
  if (!amount || amount <= 0) { notify('أدخل مبلغًا صحيحًا', 'error'); return; }
  if (amount > currentWalletData.balance) { notify('الرصيد غير كافٍ', 'error'); return; }
  currentWalletData.balance -= amount;
  currentWalletData.transactions = currentWalletData.transactions || [];
  currentWalletData.transactions.push({ type: 'withdraw', amount, date: Date.now(), desc: 'سحب من المحفظة' });
  document.getElementById('walletBalance').textContent = `الرصيد الحالي: ${currentWalletData.balance.toFixed(2)}`;
  document.getElementById('walletWithdrawAmount').value = '';
  await saveWalletToFB(currentWalletPhone, currentWalletData);
  renderWalletTransactions(currentWalletPhone, currentWalletData);
  document.getElementById('walletBalanceDisplay').textContent = currentWalletData.balance.toFixed(2);
  notify(`تم سحب ${amount.toFixed(2)}`);
}

async function walletSettle() {
  if (!currentWalletPhone || !currentWalletData) { notify('اختر عميلاً أولاً', 'warning'); return; }
  const unpaid = allInvoices.filter(i =>
    (i.phone === currentWalletPhone) &&
    (i.status === 'unpaid' || i.status === 'partial')
  );
  if (unpaid.length === 0) { notify('لا توجد فواتير غير مدفوعة للتسوية', 'warning'); return; }
  // Calculate total due based on planPrice (not invoice amount)
  let totalDue = 0;
  for (const inv of unpaid) {
    const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
    totalDue += inv.planPrice || (cust ? cust.planPrice : 0) || 0;
  }
  if (totalDue <= 0) { notify('لا توجد فواتير غير مدفوعة', 'warning'); return; }
  const useAmount = Math.min(currentWalletData.balance, totalDue);
  if (useAmount <= 0) { notify('الرصيد صفر، لا يمكن التسوية', 'warning'); return; }
  if (!confirm(`سيتم استخدام ${useAmount.toFixed(2)} من المحفظة لتسوية ${unpaid.length} فاتورة (إجمالي سعر الباقات: ${totalDue.toFixed(2)}). هل أنت متأكد؟`)) return;

  currentWalletData.balance -= useAmount;
  currentWalletData.transactions = currentWalletData.transactions || [];
  currentWalletData.transactions.push({ type: 'settle_debit', amount: useAmount, date: Date.now(), desc: 'تسوية فواتير' });
  await saveWalletToFB(currentWalletPhone, currentWalletData);

  let remaining = useAmount;
  for (const inv of unpaid) {
    if (remaining <= 0) break;
    const cust = allCustomers.find(c => c.id === inv.customerId || c.phone === inv.phone);
    const planP = inv.planPrice || (cust ? cust.planPrice : 0) || 0;
    const pay = Math.min(remaining, planP);
    inv.paid = (inv.paid || 0) + pay;
    inv.status = 'paid';
    await saveInvoiceToFB(inv);
    await savePaymentToFB({
      phone: inv.phone,
      customerId: inv.customerId,
      customerName: inv.customerName,
      month: inv.month,
      amount: pay,
      date: Date.now(),
      type: 'wallet_settle'
    });
    remaining -= pay;
  }
  renderWalletTransactions(currentWalletPhone, currentWalletData);
  document.getElementById('walletBalance').textContent = `الرصيد الحالي: ${currentWalletData.balance.toFixed(2)}`;
  document.getElementById('walletBalanceDisplay').textContent = currentWalletData.balance.toFixed(2);
  notify(`تمت التسوية: ${useAmount.toFixed(2)}`);
}

async function saveWallet() {
  if (!currentWalletPhone || !currentWalletData) { notify('اختر عميلاً أولاً', 'warning'); return; }
  await saveWalletToFB(currentWalletPhone, currentWalletData);
  notify('تم حفظ المحفظة');
}

// ---- Statement ----
function populateStatementMonths() {
  const months = [...new Set(allInvoices.map(i => i.month).filter(Boolean))].sort();
  const sel = document.getElementById('statementMonth');
  sel.innerHTML = '<option value="all">كل الأشهر</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('');
}

function searchStatement() {
  const search = (document.getElementById('statementSearch').value || '').trim().toLowerCase();
  const listDiv = document.getElementById('statementCustomerList');
  if (!search) { listDiv.style.display = 'none'; document.getElementById('statementTable').querySelector('tbody').innerHTML = ''; return; }
  const matched = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search) || c.phone.includes(search)
  );
  if (matched.length === 0) {
    listDiv.innerHTML = '<p>لا توجد نتائج</p>';
    listDiv.style.display = 'block';
    return;
  }
  listDiv.style.display = 'block';
  listDiv.innerHTML = matched.map(c => {
    // Show all phone numbers under this customer
    const phones = [c.phone];
    if (c.extraPhones) {
      const extra = Array.isArray(c.extraPhones) ? c.extraPhones : c.extraPhones.split('\n').filter(p => p.trim());
      extra.forEach(p => phones.push(p));
    }
    const customerPhones = phones.join('، ');
    const custInvoices = allInvoices.filter(i => i.customerId === c.id || phones.includes(i.phone));
    const totalInvoices = custInvoices.reduce((s, i) => s + i.amount, 0);
    const totalPaid = custInvoices.reduce((s, i) => s + (i.paid || 0), 0);
    const remaining = totalInvoices - totalPaid;
    return `
      <div class="card" style="cursor:pointer;margin-bottom:0.5rem" onclick="selectStatementCustomer('${c.id}')">
        <strong>${c.name}</strong> - ${customerPhones}<br>
        <small>إجمالي الفواتير: ${totalInvoices.toFixed(2)} | المدفوعات: ${totalPaid.toFixed(2)} | المتبقي: ${remaining.toFixed(2)}</small>
      </div>`;
  }).join('');
}

async function selectStatementCustomer(customerId) {
  const cust = allCustomers.find(c => c.id === customerId);
  if (!cust) return;
  // Show summary
  const phones = [cust.phone];
  if (cust.extraPhones) {
    const extra = Array.isArray(cust.extraPhones) ? cust.extraPhones : cust.extraPhones.split('\n').filter(p => p.trim());
    extra.forEach(p => phones.push(p));
  }
  const custInvoices = allInvoices.filter(i => i.customerId === cust.id || phones.includes(i.phone));
  const totalInvoices = custInvoices.reduce((s, i) => s + i.amount, 0);
  let totalPlanRevenue = 0;
  let totalPaidPlan = 0;
  custInvoices.forEach(i => {
    const planP = i.planPrice || cust.planPrice || 0;
    if (i.status === 'paid') totalPaidPlan += planP;
    totalPlanRevenue += planP;
  });
  const remainingPlan = totalPlanRevenue - totalPaidPlan;

  document.getElementById('statementSummary').innerHTML = `
    <strong>${cust.name}</strong><br>
    رقم الهاتف: ${cust.phone}<br>
    الأرقام: ${phones.join('، ')}<br>
    إجمالي الفواتير (التكلفة): ${totalInvoices.toFixed(2)}<br>
    إجمالي سعر الباقات: ${totalPlanRevenue.toFixed(2)}<br>
    إجمالي المدفوعات (المحصل): ${totalPaidPlan.toFixed(2)}<br>
    الرصيد المتبقي: <strong style="color:${remainingPlan > 0 ? '#e74c3c' : '#27ae60'}">${remainingPlan.toFixed(2)}</strong>
  `;
  renderStatement();
}

function renderStatement() {
  const filter = document.getElementById('statementFilter').value;
  const monthFilter = document.getElementById('statementMonth').value;
  const summaryText = document.getElementById('statementSummary').textContent;
  if (!summaryText || summaryText === '') return;

  // Get customer from summary
  const nameMatch = summaryText.match(/^(.+)/);
  if (!nameMatch) return;
  const cust = allCustomers.find(c => summaryText.includes(c.name));
  if (!cust) return;

  const phones = [cust.phone];
  if (cust.extraPhones) {
    const extra = Array.isArray(cust.extraPhones) ? cust.extraPhones : cust.extraPhones.split('\n').filter(p => p.trim());
    extra.forEach(p => phones.push(p));
  }

  let transactions = [];

  // Invoice transactions (debit)
  let invs = allInvoices.filter(i => phones.includes(i.phone));
  if (monthFilter !== 'all') invs = invs.filter(i => i.month === monthFilter);
  invs.forEach(inv => {
    if (filter === 'all' || filter === 'invoice') {
      transactions.push({
        date: inv.month ? new Date(inv.month + '-01').getTime() : 0,
        phone: inv.phone,
        desc: `فاتورة ${inv.month} - ${inv.plan || ''}`,
        debit: inv.amount,
        credit: 0
      });
    }
    // Plan prices
    if (filter === 'all' || filter === 'plan') {
      transactions.push({
        date: inv.month ? new Date(inv.month + '-01').getTime() : 0,
        phone: inv.phone,
        desc: `باقة ${inv.month} - ${inv.plan || ''}`,
        debit: cust.planPrice || 0,
        credit: 0
      });
    }
  });

  // Payment transactions (credit)
  let pays = allPayments.filter(p => phones.includes(p.phone));
  if (monthFilter !== 'all') pays = pays.filter(p => p.month === monthFilter);
  pays.forEach(p => {
    if (filter === 'all' || filter === 'invoice') {
      transactions.push({
        date: p.date || 0,
        phone: p.phone,
        desc: `دفع ${p.month || ''} - ${p.type || ''}`,
        debit: 0,
        credit: p.amount
      });
    }
  });

  // Wallet transactions
  phones.forEach(async (ph) => {
    // Wallet handled separately since it's async
  });

  transactions.sort((a, b) => a.date - b.date);
  let runningBalance = 0;
  const tbody = document.querySelector('#statementTable tbody');
  tbody.innerHTML = transactions.map(t => {
    runningBalance += t.credit - t.debit;
    return `<tr>
      <td>${t.date ? new Date(t.date).toLocaleDateString('ar-EG') : '-'}</td>
      <td>${t.phone}</td>
      <td>${t.desc}</td>
      <td>${t.debit > 0 ? t.debit.toFixed(2) : '-'}</td>
      <td>${t.credit > 0 ? t.credit.toFixed(2) : '-'}</td>
      <td>${runningBalance.toFixed(2)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">لا توجد معاملات</td></tr>';
}

function printStatement() {
  const content = document.getElementById('page-statement').cloneNode(true);
  // Remove buttons from print
  content.querySelectorAll('.btn, .search-bar').forEach(el => el.remove());
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <html dir="rtl"><head><meta charset="UTF-8"><title>كشف حساب</title>
    <link rel="stylesheet" href="css/style.css">
    <style>body{padding:20px;background:#fff;color:#000} .table{width:100%}</style>
    </head><body>${content.innerHTML}</body></html>
  `);
  printWin.document.close();
  printWin.print();
}

// ---- Payments History ----
function renderPaymentsTable() {
  const search = (document.getElementById('paymentSearch')?.value || '').trim().toLowerCase();
  let payments = [...allPayments];
  if (search) {
    payments = payments.filter(p =>
      p.phone.includes(search) ||
      (p.customerName && p.customerName.toLowerCase().includes(search))
    );
  }
  payments.sort((a, b) => (b.date || 0) - (a.date || 0));
  const tbody = document.querySelector('#paymentsTable tbody');
  tbody.innerHTML = payments.map(p => {
    const cust = p.customerName || (allCustomers.find(c => c.phone === p.phone)?.name) || '-';
    return `<tr>
      <td>${p.date ? new Date(p.date).toLocaleDateString('ar-EG') : '-'}</td>
      <td>${p.month || '-'}</td>
      <td>${p.phone}</td>
      <td>${cust}</td>
      <td>${p.amount || 0}</td>
      <td>${p.type === 'collection' ? 'تحصيل' : p.type === 'wallet_settle' ? 'تسوية محفظة' : p.type === 'wallet_deposit' ? 'إيداع' : p.type || '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">لا توجد مدفوعات</td></tr>';
}

function exportPayments() {
  exportTableToExcel('paymentsTable', `payments_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ---- Backup ----
async function exportBackup() {
  showLoading(true);
  try {
    const data = await exportFullBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('تم تصدير النسخة الاحتياطية');
  } catch (err) { notify('خطأ في التصدير: ' + err.message, 'error'); }
  showLoading(false);
}

async function restoreBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟')) { e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      showLoading(true);
      const data = JSON.parse(ev.target.result);
      await restoreFullBackup(data);
      notify('تمت استعادة النسخة الاحتياطية بنجاح');
    } catch (err) { notify('خطأ في الاستعادة: ' + err.message, 'error'); }
    showLoading(false);
    e.target.value = '';
  };
  reader.readAsText(file);
}
