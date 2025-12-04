const state = {
  rows: [],
};

async function loadData() {
  try {
    const res = await fetch("data.json?cache=" + Date.now());
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("data.json is not an array");
      return [];
    }
    return data;
  } catch (err) {
    console.error("Error loading data.json", err);
    return [];
  }
}

function sumAmount(rows, type) {
  return rows
    .filter(r => (r.tx_type || "").toLowerCase() === type.toLowerCase())
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

function calcAlerts(rows) {
  const errors = [];
  const warnings = [];

  rows.forEach((r, idx) => {
    const type = (r.tx_type || "").toLowerCase();
    const payable = Number(r.payable);
    const hasPayable = !isNaN(payable);
    const traderRate = Number(r.trader_rate);
    const hasRate = !isNaN(traderRate);

    if (type === "conversion") {
      if (!hasPayable || payable === 0) errors.push(idx);
      if (!hasRate || traderRate === 0) warnings.push(idx);
    } else {
      if (hasPayable && payable !== 0) warnings.push(idx);
    }
  });

  return { errors, warnings };
}

function renderDashboard(rows) {
  const el = document.getElementById("dashboard");
  el.innerHTML = "";

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRows = rows.filter(r => (r.tx_date || "").startsWith(todayStr));

  const inflow = sumAmount(rows, "Inflow");
  const outflow = sumAmount(rows, "Outflow");
  const conversions = rows.filter(
    r => (r.tx_type || "").toLowerCase() === "conversion"
  );

  const cards = [
    { label: "All Transactions", value: rows.length },
    { label: `Today (${todayStr})`, value: todayRows.length },
    { label: "Total Inflow (amount)", value: inflow },
    { label: "Total Outflow (amount)", value: outflow },
    { label: "Conversions", value: conversions.length },
  ];

  cards.forEach(c => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <h3>${c.label}</h3>
      <div class="value">${Number(c.value).toLocaleString()}</div>
    `;
    el.appendChild(div);
  });
}

function renderDeals(rows) {
  const el = document.getElementById("deals");
  el.innerHTML = "";

  rows.forEach(r => {
    const div = document.createElement("div");
    div.className = "deal-item";

    div.innerHTML = `
      <div class="row1">
        <span class="deal-id">${safe(r.deal_id)}</span>
        <span class="deal-type">${safe(r.tx_type)} · ${safe(r.tx_date)}</span>
      </div>
      <div class="deal-row2">
        <span>${fmtNum(r.amount)} ${safe(r.base_currency)}</span>
        <span>Payable: ${fmtNum(r.payable)} ${safe(r.target_currency)}</span>
      </div>
    `;
    el.appendChild(div);
  });
}

function renderAlerts(rows) {
  const el = document.getElementById("alerts");
  el.innerHTML = "";

  const { errors, warnings } = calcAlerts(rows);

  if (!errors.length && !warnings.length) {
    const okDiv = document.createElement("div");
    okDiv.className = "alert ok";
    okDiv.textContent = "Everything looks OK ✔";
    el.appendChild(okDiv);
    return;
  }

  errors.forEach(i => {
    const r = rows[i];
    const div = document.createElement("div");
    div.className = "alert err";
    div.textContent = `Error: Conversion payable problem in deal ${safe(
      r.deal_id
    )}`;
    el.appendChild(div);
  });

  warnings.forEach(i => {
    const r = rows[i];
    const div = document.createElement("div");
    div.className = "alert warn";
    div.textContent = `Warning: Check rates/payable in deal ${safe(
      r.deal_id
    )}`;
    el.appendChild(div);
  });
}

function safe(v) {
  return v == null ? "" : String(v);
}

function fmtNum(v) {
  const n = Number(v);
  if (isNaN(n)) return "";
  return n.toLocaleString();
}

async function refreshAll() {
  const rows = await loadData();
  state.rows = rows;
  renderAlerts(rows);
  renderDashboard(rows);
  renderDeals(rows);
}

document.getElementById("refreshBtn").addEventListener("click", refreshAll);

// first load
refreshAll();