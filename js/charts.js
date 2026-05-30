/* ====== Chart.js Charts ====== */
let paymentChartInstance = null;
let invoiceChartInstance = null;

function initDashboardCharts(paymentsData, invoicesData) {
  // Payment trend chart (monthly)
  const monthlyPayments = {};
  paymentsData.forEach(p => {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthlyPayments[key] = (monthlyPayments[key] || 0) + p.amount;
  });
  const sortedPayMonths = Object.keys(monthlyPayments).sort();
  const payValues = sortedPayMonths.map(m => monthlyPayments[m]);

  const ctx1 = document.getElementById('paymentChart');
  if (!ctx1) return;
  if (paymentChartInstance) paymentChartInstance.destroy();
  paymentChartInstance = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: sortedPayMonths,
      datasets: [{
        label: 'المدفوعات',
        data: payValues,
        borderColor: '#27ae60',
        backgroundColor: 'rgba(39,174,96,0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: 'top', rtl: true } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Invoice vs Payment chart (monthly comparison)
  const monthlyInvoices = {};
  invoicesData.forEach(inv => {
    if (inv.month) {
      monthlyInvoices[inv.month] = (monthlyInvoices[inv.month] || 0) + (inv.amount || 0);
    }
  });
  const allMonths = [...new Set([...Object.keys(monthlyPayments), ...Object.keys(monthlyInvoices)])].sort();
  const invVals = allMonths.map(m => monthlyInvoices[m] || 0);
  const payVals2 = allMonths.map(m => monthlyPayments[m] || 0);

  const ctx2 = document.getElementById('invoiceChart');
  if (!ctx2) return;
  if (invoiceChartInstance) invoiceChartInstance.destroy();
  invoiceChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: allMonths,
      datasets: [
        { label: 'الفواتير', data: invVals, backgroundColor: '#e74c3c' },
        { label: 'المدفوعات', data: payVals2, backgroundColor: '#27ae60' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: 'top', rtl: true } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
