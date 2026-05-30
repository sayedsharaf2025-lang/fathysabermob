/* ====== Firebase Configuration ====== */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ====== Firebase Operations ====== */

// ---- Customers ----
async function getCustomers() {
  const snap = await db.ref('customers').once('value');
  const data = snap.val();
  if (!data) return [];
  return Object.entries(data).map(([id, c]) => ({ id, ...c }));
}

async function getCustomer(id) {
  const snap = await db.ref(`customers/${id}`).once('value');
  return snap.val() ? { id, ...snap.val() } : null;
}

async function saveCustomerToFB(customer) {
  if (customer.id) {
    await db.ref(`customers/${customer.id}`).update(customer);
  } else {
    const ref = db.ref('customers').push();
    await ref.set(customer);
    return ref.key;
  }
}

async function deleteCustomerFromFB(id) {
  await db.ref(`customers/${id}`).remove();
}

// ---- Invoices ----
async function getInvoices(month) {
  const snap = await db.ref('invoices').once('value');
  const data = snap.val();
  if (!data) return [];
  let list = Object.entries(data).map(([id, inv]) => ({ id, ...inv }));
  if (month) list = list.filter(inv => inv.month === month);
  return list;
}

async function getCustomerInvoices(customerId) {
  const snap = await db.ref('invoices').once('value');
  const data = snap.val();
  if (!data) return [];
  return Object.entries(data).map(([id, inv]) => ({ id, ...inv })).filter(inv => inv.customerId === customerId);
}

async function getInvoiceByPhoneMonth(phone, month) {
  const snap = await db.ref('invoices').once('value');
  const data = snap.val();
  if (!data) return null;
  const entry = Object.entries(data).find(([id, inv]) => inv.phone === phone && inv.month === month);
  return entry ? { id: entry[0], ...entry[1] } : null;
}

async function saveInvoiceToFB(invoice) {
  if (invoice.id) {
    await db.ref(`invoices/${invoice.id}`).update(invoice);
  } else {
    const ref = db.ref('invoices').push();
    await ref.set(invoice);
    return ref.key;
  }
}

async function deleteInvoiceFromFB(id) {
  await db.ref(`invoices/${id}`).remove();
}

async function saveInvoicesBatch(invoices) {
  const updates = {};
  for (const inv of invoices) {
    const ref = db.ref('invoices').push();
    updates[ref.key] = inv;
  }
  await db.ref('invoices').update(updates);
}

// ---- Payments ----
async function getPayments() {
  const snap = await db.ref('payments').once('value');
  const data = snap.val();
  if (!data) return [];
  return Object.entries(data).map(([id, p]) => ({ id, ...p }));
}

async function savePaymentToFB(payment) {
  const ref = db.ref('payments').push();
  await ref.set(payment);
  return ref.key;
}

// ---- Wallets ----
async function getWallet(phone) {
  const snap = await db.ref(`wallets/${phone}`).once('value');
  return snap.val() || { balance: 0, transactions: [], lastDeposit: 0, lastDepositDate: null };
}

async function saveWalletToFB(phone, wallet) {
  await db.ref(`wallets/${phone}`).set(wallet);
}

async function getAllWallets() {
  const snap = await db.ref('wallets').once('value');
  return snap.val() || {};
}

// ---- Settings ----
async function getSetting(key) {
  const snap = await db.ref(`settings/${key}`).once('value');
  return snap.val();
}

async function setSetting(key, value) {
  await db.ref(`settings/${key}`).set(value);
}

// ---- Backup ----
async function exportFullBackup() {
  const snap = await db.ref('/').once('value');
  return snap.val();
}

async function restoreFullBackup(data) {
  await db.ref('/').set(data);
}

// ---- Listeners ----
function onCustomersChange(callback) {
  db.ref('customers').on('value', (snap) => {
    const data = snap.val();
    callback(data ? Object.entries(data).map(([id, c]) => ({ id, ...c })) : []);
  });
}

function onInvoicesChange(callback) {
  db.ref('invoices').on('value', (snap) => {
    const data = snap.val();
    callback(data ? Object.entries(data).map(([id, inv]) => ({ id, ...inv })) : []);
  });
}

function onPaymentsChange(callback) {
  db.ref('payments').on('value', (snap) => {
    const data = snap.val();
    callback(data ? Object.entries(data).map(([id, p]) => ({ id, ...p })) : []);
  });
}
