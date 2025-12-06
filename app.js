// ExchangeMiniApp — V102 GOLD++
// طراحی ثابت، منطق پیشرفته‌تر:
// - WhatsApp Report برای هر Deal
// - آماده‌سازی Edit/Delete (توابع پایه)
// - منطق هوشمندتر Payable برای Conversion
// - استفاده از localStorage برای تراکنش‌های جدید

const LOCAL_KEY = "ExchangeMiniApp_localRows_v1";

const state = {
  remoteRows: [],
  localRows: [],
  rows: []
};

/* ---------- Helpers ---------- */

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatNumber(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US");
}

function formatDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

// Generate Deal ID: DEAL-DDMMYY-XXX
function generateDealId(dealDate) {
  let d = dealDate ? new Date(dealDate) : new Date();
  if (Number.isNaN(d.getTime())) d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);

  const iso = d.toISOString().slice(0, 10);
  const sameDay = state.rows.filter(r => r.tx_date === iso);
  const counter = sameDay.length + 1;

  return `DEAL-${dd}${mm}${yy}-${String(counter).padStart(3, "0")}`;
}

/* ---------- Data load / save ---------- */

async function loadRemoteData() {
  try {
    const res = await fetch("data.json?cache=" + Date.now());
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("data.json is not array");
      return [];
    }
    return data;
  } catch (err) {
    console.error("Error loading data.json", err);
    return [];
  }
}

function loadLocalRows() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (err) {
    console.error("Error reading local rows", err);
    return [];
  }
}

function saveLocalRows() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state.localRows));
  } catch (err) {
    console.error("Error saving local rows", err);
  }
}

function mergeRows() {
  state.rows = [...state.remoteRows, ...state.localRows];
}

/* ---------- Stats & Dashboard ---------- */

function sumAmount(rows, type) {
  return rows
    .filter(r => (r.tx_type || "").toLowerCase() === type)
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

function countToday(rows) {
  const t = todayISO();
  return rows.filter(r => r.tx_date === t).length;
}

function countConversions(rows) {
  return rows.filter(r => (r.tx_type || "").toLowerCase() === "conversion").length;
}

function renderDashboard() {
  const rows = state.rows;

  document.getElementById("stat-all-count").textContent = rows.length;
  document.getElementById("stat-today-label").textContent = todayISO();
  document.getElementById("stat-today-count").textContent = countToday(rows);

  const inflow = sumAmount(rows, "inflow");
  const outflow = sumAmount(rows, "outflow");
  const conv = countConversions(rows);

  document.getElementById("stat-inflow-amount").textContent = formatNumber(inflow);
  document.getElementById("stat-outflow-amount").textContent = formatNumber(outflow);
  document.getElementById("stat-conversions").textContent = conv;
}

/* ---------- Alerts (بالا) ---------- */

function renderAlerts() {
  const el = document.getElementById("alerts");
  // فعلاً فقط OK – بعداً می‌توانیم هشدارهای Payable اینجا نشان بدهیم
  el.innerHTML = `
    <div class="alert-ok">
      Everything looks OK ✔
    </div>
  `;
}

/* ---------- Conversion Payable Logic ---------- */

function calcPayable(baseCur, targetCur, amount, rate) {
  if (!baseCur || !targetCur || !amount || !rate) return null;

  baseCur = baseCur.toUpperCase();
  targetCur = targetCur.toUpperCase();

  // قواعد نهایی‌شده
  if (baseCur === "RMB" && targetCur === "IRR") {
    return amount * rate;
  }
  if (baseCur === "RMB" && targetCur === "AED") {
    return amount / rate;
  }
  if (baseCur === "RMB" && targetCur === "USD") {
    return amount / rate;
  }
  if (baseCur === "USD" && targetCur === "IRR") {
    return amount * rate;
  }
  if (baseCur === "USD" && targetCur === "AED") {
    return amount * rate;
  }

  // مسیرهای دیگر → پیش‌فرض ضربی
  return amount * rate;
}

/* ---------- Deals list ---------- */

function renderDeals() {
  const container = document.getElementById("deals");
  const rows = [...state.rows];

  rows.sort((a, b) => {
    const da = a.tx_date || "";
    const db = b.tx_date || "";
    if (da < db) return 1;
    if (da > db) return -1;
    return 0;
  });

  if (rows.length === 0) {
    container.innerHTML = `<p style="opacity:.7;font-size:.85rem;">No deals yet.</p>`;
    return;
  }

  const html = rows
    .map(r => {
      const type = (r.tx_type || "").toLowerCase();
      const customer = r.customer || "";
      const exchanger = r.exchanger || "";
      const account = r.account_id || "";
      const baseCur = r.base_currency || "";
      const targetCur = r.target_currency || "";
      const dateLabel = formatDateLabel(r.tx_date);
      const dealId = r.deal_id || "";

      // Amount display
      let sign = "";
      if (type === "inflow") sign = "+";
      else if (type === "outflow" || type === "conversion") sign = "−";

      let amountValue;
      if (type === "conversion" && r.payable != null && r.payable !== "") {
        amountValue = Number(r.payable) || 0;
      } else {
        amountValue = Number(r.amount) || 0;
      }

      const currency = type === "conversion"
        ? (targetCur || baseCur || "")
        : (baseCur || targetCur || "");

      const amountClass =
        type === "inflow" ? "deal-amount positive" : "deal-amount negative";

      const subParts = [];
      if (dateLabel) subParts.push(dateLabel);
      if (type) subParts.push(type);
      if (customer) subParts.push(customer);
      if (exchanger) subParts.push(exchanger);
      if (account) subParts.push(account);

      return `
        <div class="deal-row">
          <div class="deal-title-line">
            <div class="deal-id">${dealId}</div>
            <div class="${amountClass}">
              ${sign}${formatNumber(amountValue)} ${currency}
            </div>
          </div>
          <div class="deal-sub">${subParts.join(" • ")}</div>
          <div class="deal-actions">
            <button class="btn btn-secondary btn-xs" onclick="generateReport('${dealId.replace(/'/g, "\\'")}')">
              WhatsApp
            </button>
            <!-- آماده‌سازی برای آینده:
            <button class="btn btn-secondary btn-xs" onclick="editDeal('${dealId.replace(/'/g, "\\'")}')">
              Edit
            </button>
            <button class="btn btn-secondary btn-xs" onclick="deleteDeal('${dealId.replace(/'/g, "\\'")}')">
              Delete
            </button>
            -->
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = html;
}

/* ---------- WhatsApp Report ---------- */

function generateReport(dealId) {
  const items = state.rows.filter(r => (r.deal_id || "") === dealId);
  if (!items.length) {
    alert("No data found for this Deal ID.");
    return;
  }

  const inflow = items.filter(i => (i.tx_type || "").toLowerCase() === "inflow");
  const outflow = items.filter(i => (i.tx_type || "").toLowerCase() === "outflow");
  const conv = items.filter(i => (i.tx_type || "").toLowerCase() === "conversion");

  let msg = `Deal Report\n🆔 ${dealId}\n━━━━━━━━━━━━━━━\n`;

  if (inflow.length) {
    msg += "📥 Inflow\n";
    inflow.forEach(i => {
      msg += `+ ${formatNumber(i.amount)} ${i.base_currency || ""}\n`;
    });
    msg += "\n";
  }

  if (conv.length) {
    msg += "♻️ Conversion\n";
    conv.forEach(c => {
      const amt = Number(c.amount) || 0;
      const rate = Number(c.trader_rate) || 0;
      const pay = Number(c.payable) || 0;
      msg += `− ${formatNumber(amt)} ${c.base_currency || ""} × ${rate} → ${formatNumber(pay)} ${c.target_currency || ""}\n`;
    });
    msg += "\n";
  }

  if (outflow.length) {
    msg += "📤 Outflow\n";
    outflow.forEach(o => {
      msg += `− ${formatNumber(o.amount)} ${o.base_currency || ""}\n`;
    });
    msg += "\n";
  }

  msg += "━━━━━━━━━━━━━━━\n";

  // تلاش برای Copy to Clipboard
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(msg)
      .then(() => {
        alert("WhatsApp text copied ✔\nمی‌تونی تو واتساپ Paste کنی.");
      })
      .catch(() => {
        alert(msg);
      });
  } else {
    alert(msg);
  }
}

/* ---------- New Deal Form ---------- */

function resetNewDealForm() {
  const form = document.getElementById("newDealForm");
  if (!form) return;

  form.reset();

  const today = todayISO();
  const dateInput = document.getElementById("tx_date");
  if (dateInput) dateInput.value = today;

  const idInput = document.getElementById("deal_id");
  if (idInput) idInput.value = generateDealId(today);
}

function openNewDealForm() {
  resetNewDealForm();
  const card = document.getElementById("new-deal-card");
  card.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelNewDeal() {
  const card = document.getElementById("new-deal-card");
  card.classList.add("hidden");
}

/* ---------- Save Deal ---------- */

function saveDeal(event) {
  event.preventDefault();
  const form = document.getElementById("newDealForm");
  if (!form) return;

  const tx_type = (form.tx_type.value || "").toLowerCase();
  const base_currency = form.base_currency.value || "";
  const target_currency = form.target_currency.value || "";
  const amountStr = form.amount.value.trim();
  const traderRateStr = form.trader_rate.value.trim();
  const exchangerRateStr = form.exchanger_rate.value.trim();
  let payableStr = form.payable.value.trim();

  const amount = amountStr === "" ? null : Number(amountStr);
  const trader_rate = traderRateStr === "" ? null : Number(traderRateStr);
  const exchanger_rate =
    exchangerRateStr === "" ? null : Number(exchangerRateStr);

  // منطق هوشمندتر برای Conversion
  if (tx_type === "conversion") {
    if (!base_currency || !target_currency) {
      alert("برای Conversion، Base Currency و Target Currency الزامی هستند.");
      return;
    }

    if (payableStr === "") {
      // Payable خالی است → باید از Trader Rate + Amount محاسبه شود
      if (amount == null || trader_rate == null) {
        alert("برای Conversion بدون Payable، باید Amount و Trader Rate را پر کنی.");
        return;
      }
      const p = calcPayable(base_currency, target_currency, amount, trader_rate);
      if (p == null) {
        alert("نمی‌توان Payable را با این ترکیب محاسبه کرد.");
        return;
      }
      payableStr = String(p);
    }
  }

  const payable = payableStr === "" ? null : Number(payableStr);

  const row = {
    deal_id: form.deal_id.value || generateDealId(form.tx_date.value),
    tx_date: form.tx_date.value || todayISO(),
    tx_type,
    customer: form.customer.value || "",
    exchanger: form.exchanger.value || "",
    account_id: form.account_id.value || "",
    base_currency,
    target_currency,
    amount,
    payable,
    trader_rate,
    exchanger_rate,
    trader: "", // فعلاً خالی
    notes: form.notes.value || "",
    source: "local"
  };

  state.localRows.push(row);
  saveLocalRows();
  mergeRows();
  renderDashboard();
  renderDeals();
  renderAlerts();

  cancelNewDeal();
}

/* ---------- آماده‌سازی Edit/Delete برای آینده ---------- */

function editDeal(dealId) {
  // هنوز UI و منطق کامل نشده — در نسخه بعدی
  console.log("Edit placeholder for:", dealId);
}

function deleteDeal(dealId) {
  // هنوز UI و منطق کامل نشده — در نسخه بعدی
  console.log("Delete placeholder for:", dealId);
}

/* ---------- Refresh ---------- */

function refreshApp() {
  mergeRows();
  renderDashboard();
  renderDeals();
  renderAlerts();
}

/* ---------- Init ---------- */

async function init() {
  const lbl = document.getElementById("stat-today-label");
  if (lbl) lbl.textContent = todayISO();

  const [remote, local] = await Promise.all([
    loadRemoteData(),
    loadLocalRows()
  ]);

  state.remoteRows = remote;
  state.localRows = local;
  mergeRows();

  renderDashboard();
  renderDeals();
  renderAlerts();
}

document.addEventListener("DOMContentLoaded", init);
