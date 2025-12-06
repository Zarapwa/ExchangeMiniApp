// ExchangeMini FULL — Gold+ logic, but simplified for GitHub Pages
// Data model is compatible with existing data.json

const STORAGE_KEY = "exchangeMini_transactions_v1";

let transactions = [];
let editingId = null;

// ---------- UTILITIES ----------

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n, decimals = 2) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------- LOAD / SAVE ----------

async function loadTransactions() {
  // 1) try localStorage
  const local = localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      const arr = JSON.parse(local);
      transactions = arr.map((row, idx) => ({
        id: row.id ?? idx + 1,
        ...row,
      }));
      renderAll();
      return;
    } catch (e) {
      console.error("Failed to parse localStorage", e);
    }
  }

  // 2) fallback to data.json
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) {
      console.warn("data.json not found or not ok");
      transactions = [];
    } else {
      const raw = await res.json();
      if (Array.isArray(raw)) {
        transactions = raw.map((row, idx) => ({
          id: idx + 1,
          deal_id: row.deal_id ?? row.Deal_ID ?? "",
          tx_date: row.tx_date ?? row.date ?? row.TxDate ?? "",
          customer: row.customer ?? row.Customer ?? "",
          exchanger: row.exchanger ?? row.Exchanger ?? "",
          account_id:
            row.account_id ?? row.account_from ?? row.Account_ID ?? "",
          tx_type: row.tx_type ?? row.TxType ?? row.type ?? "",
          base_currency:
            row.base_currency ?? row.BaseCurrency ?? row.base ?? "",
          amount: parseNumber(
            row.amount ?? row.Amount ?? row.base_amount ?? 0
          ),
          target_currency:
            row.target_currency ?? row.TargetCurrency ?? row.target ?? "",
          payable: parseNumber(
            row.payable ?? row.Payable ?? row.target_amount ?? 0
          ),
          trader_rate: parseNumber(
            row.trader_rate ?? row.TraderRate ?? row.trader ?? 0
          ),
          exchanger_rate: parseNumber(
            row.exchanger_rate ?? row.ExchangerRate ?? row.exchange ?? 0
          ),
          notes: row.notes ?? "",
          timestamp: row.timestamp ?? row.Timestamp ?? "",
        }));
      } else {
        transactions = [];
      }
    }
  } catch (e) {
    console.error("Failed to load data.json", e);
    transactions = [];
  }

  saveTransactions(); // seed localStorage
  renderAll();
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ---------- RENDER ----------

function renderAll() {
  renderDashboard();
  renderDealsView();
  renderTransactionsView();
  renderReportsDealList();
}

// DASHBOARD

function renderDashboard() {
  const totalTx = transactions.length;
  const totalDeals = new Set(transactions.map((t) => t.deal_id || "")).size;

  const today = todayISO();
  const todayCount = transactions.filter((t) => t.tx_date === today).length;

  document.getElementById("card-total-deals").textContent = totalDeals || "0";
  document.getElementById("card-today-deals").textContent = todayCount || "0";
  document.getElementById("card-today-date").textContent =
    formatDateDisplay(today);
  document.getElementById("card-total-tx").textContent = totalTx || "0";

  const inflowCount = transactions.filter(
    (t) => (t.tx_type || "").toLowerCase() === "inflow"
  ).length;
  const outflowCount = transactions.filter(
    (t) => (t.tx_type || "").toLowerCase() === "outflow"
  ).length;
  const convCount = transactions.filter(
    (t) => (t.tx_type || "").toLowerCase() === "conversion"
  ).length;

  document.getElementById(
    "card-tx-inflow"
  ).textContent = `${inflowCount} In`;
  document.getElementById(
    "card-tx-conversion"
  ).textContent = `${convCount} Conv`;
  document.getElementById(
    "card-tx-outflow"
  ).textContent = `${outflowCount} Out`;

  // Base currency summary
  const summaryMap = new Map();
  for (const t of transactions) {
    const base = (t.base_currency || "").toUpperCase() || "—";
    const entry = summaryMap.get(base) || { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += parseNumber(t.amount);
    summaryMap.set(base, entry);
  }

  const tbody = document.getElementById("tbl-dashboard-base-summary");
  tbody.innerHTML = "";
  if (summaryMap.size === 0) {
    tbody.innerHTML = `<tr><td colspan="3">No data</td></tr>`;
  } else {
    for (const [base, info] of summaryMap.entries()) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${base}</td>
        <td>${info.count}</td>
        <td>${formatNumber(info.amount)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  const lastTx = transactions[transactions.length - 1];
  if (lastTx) {
    document.getElementById(
      "card-last-updated"
    ).textContent = `Last updated: ${formatDateDisplay(lastTx.tx_date)}`;
  } else {
    document.getElementById("card-last-updated").textContent =
      "Last updated: —";
  }
}

// DEALS

function renderDealsView() {
  const tbody = document.getElementById("tbl-deals");
  const filterTxt = (
    document.getElementById("deals-filter-customer").value || ""
  )
    .toLowerCase()
    .trim();

  const groupMap = new Map();

  for (const t of transactions) {
    const key = t.deal_id || "";
    if (!key) continue;
    const group = groupMap.get(key) || {
      deal_id: t.deal_id,
      customer: t.customer,
      base_currency: t.base_currency,
      first_date: t.tx_date,
      last_date: t.tx_date,
      count: 0,
      total_amount: 0,
    };
    group.count += 1;
    group.total_amount += parseNumber(t.amount);
    if (!group.first_date || t.tx_date < group.first_date) {
      group.first_date = t.tx_date;
    }
    if (!group.last_date || t.tx_date > group.last_date) {
      group.last_date = t.tx_date;
    }
    groupMap.set(key, group);
  }

  let rows = Array.from(groupMap.values());

  if (filterTxt) {
    rows = rows.filter((g) =>
      (g.customer || "").toLowerCase().includes(filterTxt)
    );
  }

  rows.sort((a, b) => (a.last_date || "").localeCompare(b.last_date || ""));

  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">No deals found</td></tr>`;
    return;
  }

  for (const g of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.deal_id || "—"}</td>
      <td>${g.customer || "—"}</td>
      <td>${g.count}</td>
      <td>${formatDateDisplay(g.first_date)}</td>
      <td>${formatDateDisplay(g.last_date)}</td>
      <td>${(g.base_currency || "").toUpperCase()}</td>
      <td>${formatNumber(g.total_amount)}</td>
    `;
    tbody.appendChild(tr);
  }
}

// TRANSACTIONS

function renderTransactionsView() {
  const tbody = document.getElementById("tbl-transactions");
  const filterTxt = (document.getElementById("tx-filter").value || "")
    .toLowerCase()
    .trim();

  let rows = [...transactions];

  if (filterTxt) {
    rows = rows.filter((t) => {
      const haystack = [
        t.deal_id,
        t.customer,
        t.exchanger,
        t.account_id,
        t.tx_type,
        t.base_currency,
        t.target_currency,
        t.notes,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(filterTxt);
    });
  }

  rows.sort((a, b) => (a.tx_date || "").localeCompare(b.tx_date || ""));

  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12">No transactions</td></tr>`;
    return;
  }

  for (const t of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateDisplay(t.tx_date)}</td>
      <td>${t.deal_id || "—"}</td>
      <td>${t.customer || "—"}</td>
      <td>${t.exchanger || "—"}</td>
      <td>${t.tx_type || "—"}</td>
      <td>${(t.base_currency || "").toUpperCase()}</td>
      <td>${formatNumber(parseNumber(t.amount))}</td>
      <td>${(t.target_currency || "").toUpperCase()}</td>
      <td>${formatNumber(parseNumber(t.payable))}</td>
      <td>${t.trader_rate || "—"}</td>
      <td>${t.exchanger_rate || "—"}</td>
      <td>
        <div class="tx-actions">
          <button type="button" data-action="edit" data-id="${t.id}">Edit</button>
          <button type="button" class="tx-delete" data-action="delete" data-id="${t.id}">Del</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// REPORTS

function renderReportsDealList() {
  const select = document.getElementById("report-deal-select");
  const deals = new Map();

  for (const t of transactions) {
    if (!t.deal_id) continue;
    if (!deals.has(t.deal_id)) {
      deals.set(t.deal_id, t.customer || "");
    }
  }

  select.innerHTML = "";
  if (deals.size === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No deals";
    select.appendChild(opt);
    return;
  }

  for (const [dealId, cust] of deals.entries()) {
    const opt = document.createElement("option");
    opt.value = dealId;
    opt.textContent = cust ? `${dealId} — ${cust}` : dealId;
    select.appendChild(opt);
  }

  // Auto-generate first one
  generateReportForSelectedDeal();
}

function generateReportForSelectedDeal() {
  const select = document.getElementById("report-deal-select");
  const dealId = select.value;
  const output = document.getElementById("report-output");
  const status = document.getElementById("report-status");

  if (!dealId) {
    output.value = "";
    status.textContent = "";
    return;
  }

  const rows = transactions.filter((t) => t.deal_id === dealId);
  if (rows.length === 0) {
    output.value = "";
    status.textContent = "No rows for this deal.";
    return;
  }

  const customer = rows[0].customer || "";
  let text = "";
  text += `GHorbanzadeh Deal Report\n`;
  text += `🆔 Deal ID: ${dealId}\n`;
  text += `👤 Customer: ${customer || "—"}\n`;
  text += `━━━━━━━━━━━━━━━\n`;

  const inflow = rows.filter(
    (t) => (t.tx_type || "").toLowerCase() === "inflow"
  );
  const conv = rows.filter(
    (t) => (t.tx_type || "").toLowerCase() === "conversion"
  );
  const outflow = rows.filter(
    (t) => (t.tx_type || "").toLowerCase() === "outflow"
  );

  if (inflow.length) {
    text += `📥 Inflow\n`;
    for (const r of inflow) {
      text += `➕ ${formatNumber(r.amount)} ${r.base_currency} – Inflow\n`;
    }
    text += `\n`;
  }

  if (conv.length) {
    text += `♻️ Conversion\n`;
    for (const r of conv) {
      text += `➖ ${formatNumber(r.amount)} ${r.base_currency} × ${
        r.trader_rate || "-"
      } → ${formatNumber(r.payable)} ${r.target_currency}\n`;
    }
    text += `\n`;
  }

  if (outflow.length) {
    text += `📤 Outflow\n`;
    for (const r of outflow) {
      text += `➖ ${formatNumber(r.amount)} ${r.base_currency} – Outflow\n`;
    }
    text += `\n`;
  }

  output.value = text.trim();
  status.textContent = `Report ready for ${dealId}`;
}

// ---------- NAVIGATION ----------

function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const views = document.querySelectorAll(".view");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      views.forEach((v) => {
        if (v.id === target) {
          v.classList.add("active");
        } else {
          v.classList.remove("active");
        }
      });
    });
  });
}

// ---------- FORM / NEW DEAL ----------

function fillFormFromTx(tx) {
  document.getElementById("deal-id").value = tx.deal_id || "";
  document.getElementById("tx-date").value = tx.tx_date || "";
  document.getElementById("customer").value = tx.customer || "";
  document.getElementById("exchanger").value = tx.exchanger || "";
  document.getElementById("account-id").value = tx.account_id || "";
  document.getElementById("tx-type").value = tx.tx_type || "inflow";
  document.getElementById("base-currency").value =
    tx.base_currency || "RMB";
  document.getElementById("amount").value =
    tx.amount != null ? tx.amount : "";
  document.getElementById("target-currency").value =
    tx.target_currency || "";
  document.getElementById("payable").value =
    tx.payable != null ? tx.payable : "";
  document.getElementById("trader-rate").value =
    tx.trader_rate != null ? tx.trader_rate : "";
  document.getElementById("exchanger-rate").value =
    tx.exchanger_rate != null ? tx.exchanger_rate : "";
  document.getElementById("notes").value = tx.notes || "";

  document.getElementById(
    "form-mode-badge"
  ).textContent = `Mode: Edit #${tx.id}`;
}

function resetForm() {
  editingId = null;
  document.getElementById("deal-form").reset();
  document.getElementById("form-mode-badge").textContent = "Mode: New";
  // default date today
  document.getElementById("tx-date").value = todayISO();
}

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const tx = {
    deal_id: form["deal_id"].value.trim(),
    tx_date: form["tx_date"].value,
    customer: form["customer"].value.trim(),
    exchanger: form["exchanger"].value.trim(),
    account_id: form["account_id"].value.trim(),
    tx_type: form["tx_type"].value,
    base_currency: form["base_currency"].value,
    amount: parseNumber(form["amount"].value),
    target_currency: form["target_currency"].value,
    payable: parseNumber(form["payable"].value),
    trader_rate: parseNumber(form["trader_rate"].value),
    exchanger_rate: parseNumber(form["exchanger_rate"].value),
    notes: form["notes"].value.trim(),
    timestamp: new Date().toISOString(),
  };

  if (!tx.deal_id) {
    alert("Deal ID is required (you can use Auto-ID).");
    return;
  }

  if (!tx.tx_date) {
    alert("Date is required.");
    return;
  }

  if (editingId != null) {
    const idx = transactions.findIndex((t) => t.id === editingId);
    if (idx !== -1) {
      transactions[idx] = { ...transactions[idx], ...tx };
    }
  } else {
    const newId =
      transactions.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
    transactions.push({ id: newId, ...tx });
  }

  saveTransactions();
  renderAll();
  resetForm();
  alert("Saved.");
}

// AUTO DEAL ID (simple)

function generateDealId() {
  const customer = (document.getElementById("customer").value || "")
    .trim()
    .toUpperCase();
  const short =
    customer.length >= 4
      ? customer.slice(0, 4)
      : (customer || "DEAL").padEnd(4, "X");

  const dt = document.getElementById("tx-date").value || todayISO();
  const d = new Date(dt);
  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG",
    "SEP", "OCT", "NOV", "DEC"];
  const month = monthNames[d.getMonth()] || "XXX";
  const year = d.getFullYear();

  const baseId = `${short}-${day}${month}${year}`;

  const existing = transactions.filter((t) =>
    (t.deal_id || "").startsWith(baseId)
  );
  const seq = String(existing.length + 1).padStart(3, "0");

  const finalId = `${baseId}-${seq}`;
  document.getElementById("deal-id").value = finalId;
}

// EDIT / DELETE HANDLERS

function handleTxTableClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;

  if (!id || !action) return;

  const tx = transactions.find((t) => t.id === id);
  if (!tx) return;

  if (action === "edit") {
    editingId = id;
    fillFormFromTx(tx);

    // Switch to New Deal view
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector('.nav-btn[data-view="newdeal-view"]')
      .classList.add("active");
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    document.getElementById("newdeal-view").classList.add("active");
  } else if (action === "delete") {
    if (!confirm("Delete this transaction?")) return;
    const newArr = transactions.filter((t) => t.id !== id);
    transactions = newArr;
    saveTransactions();
    renderAll();
  }
}

// REPORT COPY

function handleCopyReport() {
  const txt = document.getElementById("report-output").value;
  const status = document.getElementById("report-status");
  if (!txt) {
    status.textContent = "Nothing to copy.";
    return;
  }
  navigator.clipboard
    .writeText(txt)
    .then(() => {
      status.textContent = "Copied to clipboard.";
      setTimeout(() => (status.textContent = ""), 1500);
    })
    .catch(() => {
      status.textContent = "Copy failed.";
    });
}

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();

  document
    .getElementById("deal-form")
    .addEventListener("submit", handleFormSubmit);
  document
    .getElementById("btn-reset-form")
    .addEventListener("click", resetForm);
  document
    .getElementById("btn-generate-dealid")
    .addEventListener("click", generateDealId);

  document
    .getElementById("tbl-transactions")
    .addEventListener("click", handleTxTableClick);

  document
    .getElementById("tx-filter")
    .addEventListener("input", renderTransactionsView);
  document
    .getElementById("deals-filter-customer")
    .addEventListener("input", renderDealsView);

  document
    .getElementById("report-deal-select")
    .addEventListener("change", generateReportForSelectedDeal);
  document
    .getElementById("btn-copy-report")
    .addEventListener("click", handleCopyReport);

  resetForm();
  loadTransactions();
});
