let fbDB = null;
let fbAvailable = false;

try {
  if (typeof firebase !== 'undefined') {
    const firebaseConfig = {
      apiKey: "AIzaSyBfFRxvmhg8aqtuDgXAOofFGpVPklUF-gs",
      authDomain: "mobile-invoic-118d4.firebaseapp.com",
      databaseURL: "https://mobile-invoic-118d4-default-rtdb.firebaseio.com",
      projectId: "mobile-invoic-118d4",
      storageBucket: "mobile-invoic-118d4.firebasestorage.app",
      messagingSenderId: "795305971254",
      appId: "1:795305971254:web:7e8e874cfd805d33ec1297"
    };
    firebase.initializeApp(firebaseConfig);
    fbDB = firebase.database();
    fbAvailable = true;
  }
} catch (e) {
  console.warn('Firebase غير متاح، استخدام التخزين المحلي', e);
  fbAvailable = false;
}

// ---- LocalStorage fallback helpers ----
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem('vf_' + key)); } catch(e) { return null; }
}
function lsSet(key, data) {
  try { localStorage.setItem('vf_' + key, JSON.stringify(data)); } catch(e) {}
}
function lsGetArray(key) {
  const d = lsGet(key);
  return Array.isArray(d) ? d : [];
}
function lsGenId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ---- Unified listeners ----
const _cbs = { customers: [], invoices: [], payments: [] };

function _notifyListeners(type, data) {
  (_cbs[type] || []).forEach(cb => cb(data));
}

// ---- Customers ----
async function getCustomers() {
  if (fbAvailable) {
    const snap = await fbDB.ref('customers').once('value');
    const d = snap.val();
    return d ? Object.entries(d).map(([id, c]) => ({ id, ...c })) : [];
  }
  return lsGetArray('customers');
}

async function saveCustomerToFB(customer) {
  if (fbAvailable) {
    if (customer.id) {
      await fbDB.ref('customers/' + customer.id).update(customer);
    } else {
      const ref = fbDB.ref('customers').push();
      await ref.set(customer);
      return ref.key;
    }
    return;
  }
  let list = lsGetArray('customers');
  if (customer.id) {
    const idx = list.findIndex(c => c.id === customer.id);
    if (idx >= 0) list[idx] = customer;
    else list.push(customer);
  } else {
    customer.id = lsGenId();
    list.push(customer);
  }
  lsSet('customers', list);
}

async function deleteCustomerFromFB(id) {
  if (fbAvailable) { await fbDB.ref('customers/' + id).remove(); return; }
  let list = lsGetArray('customers');
  lsSet('customers', list.filter(c => c.id !== id));
}

// ---- Invoices ----
async function getInvoices(month) {
  if (fbAvailable) {
    const snap = await fbDB.ref('invoices').once('value');
    const d = snap.val();
    let list = d ? Object.entries(d).map(([id, inv]) => ({ id, ...inv })) : [];
    if (month) list = list.filter(inv => inv.month === month);
    return list;
  }
  let list = lsGetArray('invoices');
  if (month) list = list.filter(inv => inv.month === month);
  return list;
}

async function getInvoiceByPhoneMonth(phone, month) {
  if (fbAvailable) {
    const snap = await fbDB.ref('invoices').once('value');
    const d = snap.val();
    if (!d) return null;
    const entry = Object.entries(d).find(([id, inv]) => inv.phone === phone && inv.month === month);
    return entry ? { id: entry[0], ...entry[1] } : null;
  }
  const list = lsGetArray('invoices');
  return list.find(inv => inv.phone === phone && inv.month === month) || null;
}

async function saveInvoiceToFB(invoice) {
  if (fbAvailable) {
    if (invoice.id) {
      await fbDB.ref('invoices/' + invoice.id).update(invoice);
    } else {
      const ref = fbDB.ref('invoices').push();
      await ref.set(invoice);
      return ref.key;
    }
    return;
  }
  let list = lsGetArray('invoices');
  if (invoice.id) {
    const idx = list.findIndex(inv => inv.id === invoice.id);
    if (idx >= 0) list[idx] = invoice;
    else list.push(invoice);
  } else {
    invoice.id = lsGenId();
    list.push(invoice);
  }
  lsSet('invoices', list);
}

async function deleteInvoiceFromFB(id) {
  if (fbAvailable) { await fbDB.ref('invoices/' + id).remove(); return; }
  let list = lsGetArray('invoices');
  lsSet('invoices', list.filter(inv => inv.id !== id));
}

async function saveInvoicesBatch(invoices) {
  if (fbAvailable) {
    const updates = {};
    for (const inv of invoices) {
      const ref = fbDB.ref('invoices').push();
      updates[ref.key] = inv;
    }
    await fbDB.ref('invoices').update(updates);
    return;
  }
  let list = lsGetArray('invoices');
  for (const inv of invoices) {
    inv.id = lsGenId();
    list.push(inv);
  }
  lsSet('invoices', list);
}

// ---- Payments ----
async function getPayments() {
  if (fbAvailable) {
    const snap = await fbDB.ref('payments').once('value');
    const d = snap.val();
    return d ? Object.entries(d).map(([id, p]) => ({ id, ...p })) : [];
  }
  return lsGetArray('payments');
}

async function savePaymentToFB(payment) {
  if (fbAvailable) {
    const ref = fbDB.ref('payments').push();
    await ref.set(payment);
    return ref.key;
  }
  let list = lsGetArray('payments');
  payment.id = lsGenId();
  list.push(payment);
  lsSet('payments', list);
}

// ---- Wallets ----
async function getWallet(phone) {
  if (fbAvailable) {
    const snap = await fbDB.ref('wallets/' + phone).once('value');
    return snap.val() || { balance: 0, transactions: [], lastDeposit: 0, lastDepositDate: null };
  }
  const all = lsGet('wallets') || {};
  return all[phone] || { balance: 0, transactions: [], lastDeposit: 0, lastDepositDate: null };
}

async function saveWalletToFB(phone, wallet) {
  if (fbAvailable) { await fbDB.ref('wallets/' + phone).set(wallet); return; }
  const all = lsGet('wallets') || {};
  all[phone] = wallet;
  lsSet('wallets', all);
}

// ---- Settings ----
async function getSetting(key) {
  if (fbAvailable) {
    const snap = await fbDB.ref('settings/' + key).once('value');
    return snap.val();
  }
  const all = lsGet('settings') || {};
  return all[key];
}

async function setSetting(key, value) {
  if (fbAvailable) { await fbDB.ref('settings/' + key).set(value); return; }
  const all = lsGet('settings') || {};
  all[key] = value;
  lsSet('settings', all);
}

// ---- Backup ----
async function exportFullBackup() {
  if (fbAvailable) {
    const snap = await fbDB.ref('/').once('value');
    return snap.val();
  }
  return {
    customers: lsGetArray('customers'),
    invoices: lsGetArray('invoices'),
    payments: lsGetArray('payments'),
    wallets: lsGet('wallets') || {},
    settings: lsGet('settings') || {}
  };
}

async function restoreFullBackup(data) {
  if (fbAvailable) { await fbDB.ref('/').set(data); return; }
  if (data.customers) lsSet('customers', data.customers);
  if (data.invoices) lsSet('invoices', data.invoices);
  if (data.payments) lsSet('payments', data.payments);
  if (data.wallets) lsSet('wallets', data.wallets);
  if (data.settings) lsSet('settings', data.settings);
}

// ---- Listeners ----
function onCustomersChange(callback) {
  _cbs.customers.push(callback);
  if (fbAvailable) {
    fbDB.ref('customers').on('value', (snap) => {
      const d = snap.val();
      callback(d ? Object.entries(d).map(([id, c]) => ({ id, ...c })) : []);
    });
  } else {
    // Poll-based fallback for localStorage
    let last = JSON.stringify(lsGetArray('customers'));
    setInterval(() => {
      const cur = JSON.stringify(lsGetArray('customers'));
      if (cur !== last) { last = cur; callback(lsGetArray('customers')); }
    }, 1000);
    callback(lsGetArray('customers'));
  }
}

function onInvoicesChange(callback) {
  _cbs.invoices.push(callback);
  if (fbAvailable) {
    fbDB.ref('invoices').on('value', (snap) => {
      const d = snap.val();
      callback(d ? Object.entries(d).map(([id, inv]) => ({ id, ...inv })) : []);
    });
  } else {
    let last = JSON.stringify(lsGetArray('invoices'));
    setInterval(() => {
      const cur = JSON.stringify(lsGetArray('invoices'));
      if (cur !== last) { last = cur; callback(lsGetArray('invoices')); }
    }, 1000);
    callback(lsGetArray('invoices'));
  }
}

function onPaymentsChange(callback) {
  _cbs.payments.push(callback);
  if (fbAvailable) {
    fbDB.ref('payments').on('value', (snap) => {
      const d = snap.val();
      callback(d ? Object.entries(d).map(([id, p]) => ({ id, ...p })) : []);
    });
  } else {
    let last = JSON.stringify(lsGetArray('payments'));
    setInterval(() => {
      const cur = JSON.stringify(lsGetArray('payments'));
      if (cur !== last) { last = cur; callback(lsGetArray('payments')); }
    }, 1000);
    callback(lsGetArray('payments'));
  }
}
