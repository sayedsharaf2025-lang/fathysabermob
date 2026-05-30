
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
const fbDB = firebase.database();

async function getCustomers() {
  const snap = await fbDB.ref('customers').once('value');
  const data = snap.val();
  if (!data) return [];
  return Object.entries(data).map(([id, c]) => ({ id, ...c }));
}

async function saveCustomerToFB(customer) {
  if (customer.id) {
    await fbDB.ref(`customers/${customer.id}`).update(customer);
  } else {
    const ref = fbDB.ref('customers').push();
    await ref.set(customer);
    return ref.key;
  }
}

async function deleteCustomerFromFB(id) {
  await fbDB.ref(`customers/${id}`).remove();
}

async function getInvoices(month) {
  const snap = await fbDB.ref('invoices').once('value');
  const data = snap.val();
  if (!data) return [];
  let list = Object.entries(data).map(([id, inv]) => ({ id, ...inv }));
  if (month) list = list.filter(inv => inv.month === month);
  return list;
}

async function getInvoiceByPhoneMonth(phone, month) {
  const snap = await fbDB.ref('invoices').once('value');
  const data = snap.val();
  if (!data) return null;
  const entry = Object.entries(data).find(([id, inv]) => inv.phone === phone && inv.month === month);
  return entry ? { id: entry[0], ...entry[1] } : null;
}

async function saveInvoiceToFB(invoice) {
  if (invoice.id) {
    await fbDB.ref(`invoices/${invoice.id}`).update(invoice);
  } else {
    const ref = fbDB.ref('invoices').push();
    await ref.set(invoice);
    return ref.key;
  }
}

async function deleteInvoiceFromFB(id) {
  await fbDB.ref(`invoices/${id}`).remove();
}

async function saveInvoicesBatch(invoices) {
  const updates = {};
  for (const inv of invoices) {
    const ref = fbDB.ref('invoices').push();
    updates[ref.key] = inv;
  }
  await fbDB.ref('invoices').update(updates);
}

async function getPayments() {
  const snap = await fbDB.ref('payments').once('value');
  const data = snap.val();
  if (!data) return [];
  return Object.entries(data).map(([id, p]) => ({ id, ...p }));
}

async function savePaymentToFB(payment) {
  const ref = fbDB.ref('payments').push();
  await ref.set(payment);
  return ref.key;
}

async function getWallet(phone) {
  const snap = await fbDB.ref(`wallets/${phone}`).once('value');
  return snap.val() || { balance: 0, transactions: [], lastDeposit: 0, lastDepositDate: null };
}

async function saveWalletToFB(phone, wallet) {
  await fbDB.ref(`wallets/${phone}`).set(wallet);
}

async function getSetting(key) {
  const snap = await fbDB.ref(`settings/${key}`).once('value');
  return snap.val();
}

async function setSetting(key, value) {
  await fbDB.ref(`settings/${key}`).set(value);
}

async function exportFullBackup() {
  const snap = await fbDB.ref('/').once('value');
  return snap.val();
}

async function restoreFullBackup(data) {
  await fbDB.ref('/').set(data);
}

function onCustomersChange(callback) {
  fbDB.ref('customers').on('value', (snap) => {
    const data = snap.val();
    callback(data ? Object.entries(data).map(([id, c]) => ({ id, ...c })) : []);
  });
}

function onInvoicesChange(callback) {
  fbDB.ref('invoices').on('value', (snap) => {
    const data = snap.val();
    callback(data ? Object.entries(data).map(([id, inv]) => ({ id, ...inv })) : []);
  });
}

function onPaymentsChange(callback) {
  fbDB.ref('payments').on('value', (snap) => {
    const data = snap.val();
    callback(data ? Object.entries(data).map(([id, p]) => ({ id, ...p })) : []);
  });
}
