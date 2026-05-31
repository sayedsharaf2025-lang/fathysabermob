async function importFromLegacyData() {
  showLoading(true);
  try {
    // Read existing Firebase data
    const snap = await fbDB.ref('/').once('value');
    const data = snap.val();
    if (!data) { notify('لا توجد بيانات في Firebase', 'error'); showLoading(false); return; }

    if (data.customers && data.customers.length > 0) {
      notify('البيانات تم ترحيلها مسبقًا', 'warning');
      showLoading(false);
      return;
    }

    let customerCount = 0;
    let invoiceCount = 0;
    let walletCount = 0;

    // 1. Migrate settings -> customers
    if (data.settings) {
      const customers = {};
      for (const [phone, info] of Object.entries(data.settings)) {
        if (info && info.name) {
          const id = 'cust_' + phone;
          customers[id] = {
            name: info.name,
            phone: phone,
            planPrice: info.price || 0,
            plan: info.ratePlan || 'مفوتر',
            nationalId: '',
            extraPhones: []
          };
          customerCount++;
        }
      }
      if (customerCount > 0) {
        await fbDB.ref('customers').set(customers);
      }
    }

    // 2. Migrate invoices
    if (data.invoices) {
      const invoices = {};
      for (const [month, monthData] of Object.entries(data.invoices)) {
        for (const [phone, inv] of Object.entries(monthData)) {
          if (inv && inv.packagePrice !== undefined) {
            const id = 'inv_' + month + '_' + phone;
            const statusMap = {
              'مدفوع بالكامل': 'paid',
              'غير مدفوع': 'unpaid',
              'مدفوع جزئي': 'partial'
            };
            const invStatus = statusMap[inv.status] || (inv.paidAmount > 0 ? 'paid' : 'unpaid');
            invoices[id] = {
              phone: phone,
              customerId: 'cust_' + phone,
              customerName: (data.settings && data.settings[phone]) ? data.settings[phone].name : '',
              month: month,
              amount: inv.totalAfterTaxes || inv.packagePrice || 0,
              planPrice: inv.packagePrice || 0,
              paid: inv.paidAmount || 0,
              status: invStatus,
              plan: inv.ratePlan || ''
            };
            invoiceCount++;
          }
        }
      }
      if (invoiceCount > 0) {
        await fbDB.ref('invoices').set(invoices);
      }
    }

    // 3. Migrate advancePayments -> wallets
    if (data.advancePayments) {
      const wallets = {};
      for (const [phone, balance] of Object.entries(data.advancePayments)) {
        if (balance > 0) {
          wallets[phone] = {
            balance: balance,
            transactions: [{ type: 'deposit', amount: balance, date: Date.now(), desc: 'رصيد سابق' }],
            lastDeposit: balance,
            lastDepositDate: Date.now()
          };
          walletCount++;
        }
      }
      if (walletCount > 0) {
        await fbDB.ref('wallets').set(wallets);
      }
    }

    // 4. Migrate extraFinancials if present
    if (data.extraFinancials && data.extraFinancials.summaryData) {
      await fbDB.ref('settings/extraFinancials').set(data.extraFinancials.summaryData);
    }

    await fbDB.ref('settings/lastMonth').set('2026-05');

    notify('تم ترحيل ' + customerCount + ' عميل، ' + invoiceCount + ' فاتورة، ' + walletCount + ' محفظة');
  } catch (err) {
    notify('خطأ في الترحيل: ' + err.message, 'error');
    console.error(err);
  }
  showLoading(false);
}
