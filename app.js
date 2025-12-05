//============ STATE ============//
const state = {
  rows: [],
};

//============ LOAD DATA ============//
async function loadData() {
  try {
    const res = await fetch("data.json?cache=" + Date.now());
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data;
  } catch (err) {
    console.error("Error loading data.json", err);
    return [];
  }
}

//============ SUM ============//
function sum(rows, type) {
  return rows
    .filter((r) => (r.tx_type || "").toLowerCase() === type.toLowerCase())
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

//============ ALERT SYSTEM ============//
function checkAlerts(rows) {
  let warnings = 0;
  let errors = 0;

  rows.forEach((r) => {
    if (r.tx_type === "conversion") {
      const payable = Number(r.payable);
      const trader = Number(r.trader_rate);

      if (!payable || !trader) errors++;
    }
  });

  return { warnings, errors };
}

//============ RENDER ALERTS ============//
function renderAlerts() {
  const el = document.getElementById("alerts");
  const { errors } = checkAlerts(state.rows);

  if (errors > 0) {
    el.innerHTML = `<div class="alert alert-danger">There are ${errors} critical errors!</div>`;
  } else {
    el.innerHTML = `<div class="alert alert-success">Everything looks OK ✓</div>`;
  }
}

//============ RENDER DASHBOARD ============//
function renderDashboard() {
  const today = new Date().toISOString().slice(0, 10);

  const inflow = sum(state.rows, "inflow");
  const outflow = sum(state.rows, "outflow");
  const conv = state.rows.filter((r) => r.tx_type === "conversion").length;

  document.getElementById("dashboard").innerHTML = `
    <div class="card">All Transactions<br><b>${state.rows.length}</b></div>
    <div class="card">Today (${today})<br><b>${state.rows.filter(r => r.tx_date === today).length}</b></div>
    <div class="card">Total Inflow<br><b>${inflow}</b></div>
    <div class="card">Total Outflow<br><b>${outflow}</b></div>
    <div class="card">Conversions<br><b>${conv}</b></div>
  `;
}

//============ RENDER DEAL LIST ============//
function renderDeals() {
  const list = state.rows
    .map(
      (r) => `
      <div class="deal-item">
        <b>${r.deal_id}</b> — ${r.tx_type} — ${r.amount} ${r.base_currency}
      </div>`
    )
    .join("");

  document.getElementById("deals").innerHTML = list;
}

//============ FULL REFRESH ============//
async function refresh() {
  state.rows = await loadData();
  renderAlerts();
  renderDashboard();
  renderDeals();
}

//============ INIT ============//
refresh();

// Register SW
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
