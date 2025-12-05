// ===== ExchangeMiniApp — GOLD Version =====

const LOCAL_KEY = "exchangeMiniApp_localRows_v1";

const state = {
  remoteRows: [],
  localRows: [],
  rows: [],
};

// ---------- Helpers ----------

function sumAmount(rows, type) {
  return rows
    .filter((r) => (r.tx_type || "").toLowerCase() === type.toLowerCase())
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatNumber(x) {
  const n = Number(x) || 0;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Deal ID generator: NAME + DATE + COUNTER
function generateDealId(customer, txDate, allRows) {
  const nameRaw = (customer || "DEAL").trim().toUpperCase();
  const nameLetters = nameRaw.replace(/[^A-Z]/g, "") || "DEAL";
  const prefix =
    nameLetters.length >= 4
      ? nameLetters.slice(0, 4)
      : nameLetters.padEnd(4, "X");

  let dateObj;
  if (txDate) {
    dateObj = new Date(txDate);
  } else {
    dateObj = new Date();
  }
  const day = String(dateObj.getDate()).padStart(2, "0");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = months[dateObj.getMonth()] || "XXX";
  const year = dateObj.getFullYear();
  const dateCode = `${day}${mon}${year}`;

  const basePrefix = `${prefix}-${dateCode}`;
  const existing = (allRows || []).filter(
    (r) => typeof r.deal_id === "string" && r.deal_id.startsWith(basePrefix)
  );
  const counter = existing.length + 1;
  const counterStr = String(counter).padStart(3, "0");

  return `${basePrefix}-${counterStr}`;
}

// Auto calculation for payable when conversion
function autoCalcPayable(base, target, amount, rate) {
  const a = Number(amount);
  const r = Number(rate);
  if (!a || !r || !base || !target) return null;

  const key = `${base.toUpperCase()}>${target.toUpperCase()}`;

  switch (key) {
    case "RMB>IRR":
      return a * r;
    case "RMB>AED":
    case "RMB>USD":
      return a / r;
    case "USD>IRR":
    case "USD>AED":
      return a * r;
    default:
      // default fallback
      return a * r;
  }
}

// ---------- Data loading ----------

async function loadRemoteData() {
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

function loadLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Error loading local rows", err);
    return [];
  }
}

function saveLocalData() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state.localRows));
  } catch (err) {
    console.error("Error saving local rows", err);
  }
}

// ---------- Rendering ----------

function renderAlerts(rows) {
  const el = document.getElementById("alerts");
  if (!el) return;

  const { errors, warnings } = calcAlerts(rows);

  if (!errors.length && !warnings.length) {
    el.innerHTML = `<div class="stat">
      <span class="stat-label">Alerts</span>
      <div class="stat-value" style="font-size:0.95rem;">Everything looks OK ✓</div>
    </div>`;
    return;
  }

  const errHtml = errors.length
    ? `<div>❌ <strong>${errors.length}</strong> critical issue(s) in conversions.</div>`
    : "";
  const warnHtml = warnings.length
    ? `<div>⚠️ <strong>${warnings.length}</strong> warning(s) (missing payable / trader rate).</div>`
    : "";

  el.innerHTML = `<div class="stat">
    <span class="stat-label">Alerts</span>
    <div style="margin-top:0.35rem;font-size:0.9rem;">
      ${errHtml}${warnHtml}
    </div>
  </div>`;
}

function calcAlerts(rows) {
  const errors = [];
  const warnings = [];

  rows.forEach((r, idx) => {
    const type = (r.tx_type || "").toLowerCase();
    const payable = Number(r.payable);
    const traderRate = Number(r.trader_rate);
    const hasPayable = !Number.isNaN(payable) && payable !== 0;
    const hasRate = !Number.isNaN(traderRate) && traderRate !== 0;

    if (type === "conversion") {
      if (!hasPayable && !hasRate) {
        errors.push(idx);
      } else if (!hasPayable || !hasRate) {
        warnings.push(idx);
      }
    }
  });

  return { errors, warnings };
}

function renderDashboard(rows) {
  const el = document.getElementById("dashboard");
  if (!el) return;

  const today = todayIso();

  const totalTx = rows.length;
  const todayTx = rows.filter((r) => r.tx_date === today).length;
  const totalInflow = sumAmount(rows, "inflow");
  const totalOutflow = sumAmount(rows, "outflow");
  const conversions = rows.filter(
    (r) => (r.tx_type || "").toLowerCase() === "conversion"
  ).length;

  el.innerHTML = `
    <div class="stat">
      <div class="stat-label">All Transactions</div>
      <div class="stat-value">${formatNumber(totalTx)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Today (${today})</div>
      <div class="stat-value">${formatNumber(todayTx)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Inflow (amount)</div>
      <div class="stat-value">${formatNumber(totalInflow)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Outflow (amount)</div>
      <div class="stat-value">${formatNumber(totalOutflow)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Conversions</div>
      <div class="stat-value">${formatNumber(conversions)}</div>
    </div>
  `;
}

function renderDeals(rows) {
  const el = document.getElementById("deals");
  if (!el) return;

  const latest = [...rows]
    .sort((a, b) => (a.tx_date || "").localeCompare(b.tx_date || ""))
    .reverse()
    .slice(0, 30);

  const itemsHtml = latest
    .map((r) => {
      const type = (r.tx_type || "").toLowerCase();
      let sign = "";
      if (type === "inflow") sign = "+";
      else if (type === "outflow" || type === "conversion") sign = "−";

      const baseCur = r.base_currency || "";
      const amount = r.amount ? `${sign}${formatNumber(r.amount)} ${baseCur}` : "";

      const id = r.deal_id || "(no ID)";
      const date = r.tx_date || "";
      const customer = r.customer || "";
      const localBadge = r.__local ? " • (local)" : "";

      return `
        <div class="deal-item">
          <div class="deal-main">
            <div class="deal-id">${id}${localBadge}</div>
            <div class="deal-amount">${amount}</div>
          </div>
          <div class="deal-meta">
            ${date} • ${type || " ? "} • ${customer}
          </div>
        </div>
      `;
    })
    .join("");

  el.innerHTML = `
    <h2>Deals</h2>
    ${itemsHtml || '<div class="deal-meta">No deals yet.</div>'}
  `;
}

function renderAll() {
  renderAlerts(state.rows);
  renderDashboard(state.rows);
  renderDeals(state.rows);
}

// ---------- New Deal Form Logic ----------

function openNewDealForm() {
  const card = document.getElementById("new-deal-card");
  if (!card) return;
  card.classList.remove("hidden");

  // default date today
  const dateInput = document.getElementById("tx_date");
  if (dateInput && !dateInput.value) {
    dateInput.value = todayIso();
  }

  // pre-fill Deal ID (draft)
  const idInput = document.getElementById("deal_id");
  const customer = document.getElementById("customer")?.value || "";
  const draftId = generateDealId(customer, dateInput.value, state.rows);
  if (idInput && !idInput.value) {
    idInput.value = draftId;
  }
}

function cancelNewDealForm() {
  const card = document.getElementById("new-deal-card");
  if (card) card.classList.add("hidden");
  const form = document.getElementById("newDealForm");
  if (form) form.reset();
  const idInput = document.getElementById("deal_id");
  if (idInput) idInput.value = "";
}

function handleNewDealSubmit(mode) {
  const form = document.getElementById("newDealForm");
  if (!form) return;

  const tx_date = document.getElementById("tx_date").value || todayIso();
  const customer = document.getElementById("customer").value || "";
  const exchanger = document.getElementById("exchanger").value || "";
  const account_id = document.getElementById("account_id").value || "";
  const tx_type = document.getElementById("tx_type").value || "";
  const base_currency = document.getElementById("base_currency").value || "";
  const amount = Number(document.getElementById("amount").value || 0);
  const target_currency =
    document.getElementById("target_currency").value || "";
  let payable = document.getElementById("payable").value;
  let trader_rate = document.getElementById("trader_rate").value;
  let exchanger_rate = document.getElementById("exchanger_rate").value;
  const notes = document.getElementById("notes").value || "";
  let deal_id = document.getElementById("deal_id").value.trim();

  if (!tx_type || !base_currency || !amount || !customer) {
    alert("Please fill at least: Date, Customer, Tx Type, Base Currency, Amount.");
    return;
  }

  if (!deal_id) {
    deal_id = generateDealId(customer, tx_date, state.rows);
  }

  // auto calc payable for conversion if possible
  if (tx_type.toLowerCase() === "conversion") {
    if (!payable) {
      const auto = autoCalcPayable(
        base_currency,
        target_currency,
        amount,
        trader_rate
      );
      if (auto != null) {
        payable = auto;
        const payInput = document.getElementById("payable");
        if (payInput) payInput.value = String(auto);
      }
    }
  }

  const row = {
    deal_id,
    tx_date,
    tx_type,
    customer,
    exchanger,
    account_id,
    base_currency,
    amount,
    target_currency,
    payable: payable === "" ? null : Number(payable),
    trader_rate: trader_rate === "" ? null : Number(trader_rate),
    exchanger_rate: exchanger_rate === "" ? null : Number(exchanger_rate),
    notes,
    __local: true,
  };

  state.localRows.push(row);
  saveLocalData();

  state.rows = [...state.remoteRows, ...state.localRows];
  renderAll();

  if (mode === "saveNew") {
    // reset for next deal, but نگه‌داشتن تاریخ و مشتری خوب است؟
    const keepDate = tx_date;
    form.reset();
    document.getElementById("tx_date").value = keepDate;
    document.getElementById("customer").value = customer;

    const newDraftId = generateDealId(customer, keepDate, state.rows);
    document.getElementById("deal_id").value = newDraftId;
  } else {
    cancelNewDealForm();
  }
}

// ---------- Refresh button ----------

function refreshApp() {
  // فقط از سرور دوباره می‌خوانیم؛ localRows سرجای خودش می‌ماند
  init(true);
}

// ---------- Init ----------

async function init(forceRemote) {
  if (!state.remoteRows.length || forceRemote) {
    state.remoteRows = await loadRemoteData();
  }
  state.localRows = loadLocalData();
  state.rows = [...state.remoteRows, ...state.localRows];
  renderAll();
}

document.addEventListener("DOMContentLoaded", () => {
  init(false);
});

// make handlers global for inline HTML
window.openNewDealForm = openNewDealForm;
window.cancelNewDealForm = cancelNewDealForm;
window.handleNewDealSubmit = handleNewDealSubmit;
window.refreshApp = refreshApp;
