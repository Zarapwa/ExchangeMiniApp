/* ExchangeMini - stable nav + data loader (iOS Safari friendly) */

const APP_VERSION = "vmini-1.0.4";
const DATA_URL = "./data.json";
const LOCAL_KEY = "exchangeMini.localTx.v1";

const state = {
  tx: [],
  dealAgg: [],     // [{deal_id, customer, base, totalAmount, txCount}]
  activeDealId: null,
  debug: false
};

function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function logDebug(msg){
  if(!state.debug) return;
  const el = $("#debugLog");
  if(el){
    el.textContent += (el.textContent ? "\n" : "") + msg;
  }
  // also console
  try{ console.log("[DEBUG]", msg); }catch(e){}
}

function setView(name){
  const views = $all(".view");
  views.forEach(v => v.classList.remove("is-active"));
  const target = document.querySelector(`.view[data-view="${name}"]`);
  if(target) target.classList.add("is-active");

  const links = $all(".nav-link");
  links.forEach(b => b.classList.remove("is-active"));
  const activeBtn = document.querySelector(`.nav-link[data-view="${name}"]`);
  if(activeBtn) activeBtn.classList.add("is-active");

  logDebug(`setView("${name}")`);
}

function setupNav(){
  // Event delegation fixes iOS tap edge cases
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-link");
    if(!btn) return;
    const view = btn.dataset.view;
    if(!view) return;
    e.preventDefault();
    setView(view);
  }, { passive: false });

  // Debug button toggles debug panel
  $("#debugBtn").addEventListener("click", () => {
    state.debug = !state.debug;
    if(state.debug){
      $("#debugLog").textContent = "";
      logDebug("Debug enabled");
      logDebug("App version: " + APP_VERSION);
      logDebug("User agent: " + navigator.userAgent);
      setView("debug");
    }else{
      setView("dashboard");
    }
  });

  $("#reloadData").addEventListener("click", async () => {
    logDebug("Reloading data.json...");
    await loadData(true);
    renderAll();
    logDebug("Reload done.");
  });

  $("#clearLocal").addEventListener("click", () => {
    localStorage.removeItem(LOCAL_KEY);
    logDebug("Local cache cleared: " + LOCAL_KEY);
  });
}

function toNumber(x){
  if(x === null || x === undefined) return 0;
  if(typeof x === "number") return isFinite(x) ? x : 0;
  const s = String(x).replace(/,/g,"").trim();
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function normDate(d){
  if(!d) return "";
  // accept "YYYY-MM-DD" or full timestamp
  const s = String(d).trim();
  if(s.length >= 10) return s.slice(0,10);
  return s;
}

function todayISO(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,"0");
  const d = String(now.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

async function fetchJSON(url, bustCache=false){
  // cache bust is essential on GitHub Pages + iOS Safari
  const u = bustCache ? `${url}?v=${Date.now()}` : url;
  const res = await fetch(u, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
  return await res.json();
}

async function loadData(bustCache=false){
  // 1) primary: data.json
  let data = null;
  try{
    data = await fetchJSON(DATA_URL, bustCache);
    logDebug("Loaded data.json ok");
  }catch(err){
    logDebug("Failed to load data.json: " + (err?.message || err));
    data = null;
  }

  // Accept {transactions:[...]} or [...]
  let tx = [];
  if(Array.isArray(data)) tx = data;
  else if(data && Array.isArray(data.transactions)) tx = data.transactions;
  else if(data && Array.isArray(data.allTransactions)) tx = data.allTransactions;

  // 2) fallback: local storage (optional)
  if(!tx.length){
    try{
      const raw = localStorage.getItem(LOCAL_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(Array.isArray(parsed)) tx = parsed;
        logDebug("Loaded from local cache");
      }
    }catch(e){}
  }

  // normalize
  tx = tx.map((t) => ({
    ...t,
    deal_id: String(t.deal_id ?? "").trim(),
    customer: String(t.customer ?? "").trim(),
    tx_date: normDate(t.tx_date ?? t.date ?? ""),
    tx_type: String(t.tx_type ?? t.type ?? "").trim(),
    base_currency: String(t.base_currency ?? t.base ?? "").trim(),
    target_currency: String(t.target_currency ?? t.target ?? "").trim(),
    amount: toNumber(t.amount),
    payable: toNumber(t.payable ?? t.target_amount ?? 0),
    notes: String(t.notes ?? "").trim()
  })).filter(t => t.deal_id || t.customer || t.tx_date);

  state.tx = tx;
  buildAggregates();
}

function buildAggregates(){
  const map = new Map();
  for(const t of state.tx){
    const key = t.deal_id || "(no-deal)";
    if(!map.has(key)){
      map.set(key, {
        deal_id: key,
        customer: t.customer || "",
        base: t.base_currency || "",
        totalAmount: 0,
        txCount: 0
      });
    }
    const row = map.get(key);
    row.txCount += 1;
    // sum base amount only if base_currency exists
    row.totalAmount += (t.base_currency ? toNumber(t.amount) : 0);
    if(!row.customer && t.customer) row.customer = t.customer;
    if(!row.base && t.base_currency) row.base = t.base_currency;
  }
  state.dealAgg = Array.from(map.values()).sort((a,b) => (b.txCount - a.txCount));
}

function fmt(n){
  const x = toNumber(n);
  // keep it simple (no Intl edge cases)
  const s = Math.round(x * 100) / 100;
  return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/* RENDER */

function renderDashboard(){
  $("#appVersion").textContent = APP_VERSION;

  const totalDeals = new Set(state.tx.map(t => t.deal_id).filter(Boolean)).size;
  $("#dashTotalDeals").textContent = String(totalDeals);

  const today = todayISO();
  $("#dashTodayLabel").textContent = today;
  const todayDeals = new Set(state.tx.filter(t => t.tx_date === today).map(t => t.deal_id).filter(Boolean)).size;
  $("#dashTodayDeals").textContent = String(todayDeals);

  $("#dashTotalTx").textContent = String(state.tx.length);

  // currency summary (base)
  const curMap = new Map();
  for(const t of state.tx){
    const c = t.base_currency || "";
    if(!c) continue;
    curMap.set(c, (curMap.get(c) || 0) + toNumber(t.amount));
  }
  const curRows = Array.from(curMap.entries()).sort((a,b) => Math.abs(b[1]) - Math.abs(a[1]));
  const curEl = $("#dashCurrencySummary");
  curEl.innerHTML = "";
  if(!curRows.length){
    curEl.innerHTML = `<div class="k">No base currency totals</div><div>—</div>`;
  }else{
    for(const [k,v] of curRows){
      const dk = document.createElement("div");
      dk.className = "k";
      dk.textContent = k;
      const dv = document.createElement("div");
      dv.textContent = fmt(v);
      curEl.appendChild(dk);
      curEl.appendChild(dv);
    }
  }

  // latest activity
  const latest = [...state.tx]
    .sort((a,b) => (String(b.timestamp||b.tx_date||"").localeCompare(String(a.timestamp||a.tx_date||""))))
    .slice(0, 6);

  const le = $("#dashLatest");
  le.innerHTML = "";
  if(!latest.length){
    le.innerHTML = `<div class="k">No transactions</div><div>—</div>`;
  }else{
    for(const t of latest){
      const left = document.createElement("div");
      left.className = "k";
      left.textContent = `${t.tx_date || "—"} • ${t.deal_id || "—"}`;
      const right = document.createElement("div");
      right.textContent = `${t.base_currency || ""} ${fmt(t.amount)} ${t.tx_type ? "• " + t.tx_type : ""}`.trim();
      le.appendChild(left);
      le.appendChild(right);
    }
  }
}

function renderDeals(){
  const tb = $("#dealsTable tbody");
  tb.innerHTML = "";

  $("#dealsCountLabel").textContent = `${state.dealAgg.length} deal(s)`;

  for(const d of state.dealAgg){
    const tr = document.createElement("tr");
    tr.dataset.dealId = d.deal_id;

    tr.innerHTML = `
      <td>${escapeHtml(d.deal_id)}</td>
      <td>${escapeHtml(d.customer || "—")}</td>
      <td>${escapeHtml(d.base || "—")}</td>
      <td>${escapeHtml(d.base ? `${d.base} ${fmt(d.totalAmount)}` : fmt(d.totalAmount))}</td>
      <td>${escapeHtml(String(d.txCount))}</td>
    `;

    tr.addEventListener("click", () => {
      state.activeDealId = d.deal_id;
      setView("transactions");
      renderTransactions(); // apply filter
    });

    tb.appendChild(tr);
  }
}

function renderTransactions(){
  const tb = $("#txTable tbody");
  tb.innerHTML = "";

  const q = ($("#txSearch").value || "").trim().toLowerCase();
  const activeDeal = state.activeDealId;

  let rows = state.tx;

  if(activeDeal){
    rows = rows.filter(t => t.deal_id === activeDeal);
    $("#txContextLabel").textContent = `Deal: ${activeDeal}`;
  }else{
    $("#txContextLabel").textContent = `All transactions`;
  }

  if(q){
    rows = rows.filter(t => {
      const s = `${t.deal_id} ${t.customer} ${t.base_currency} ${t.target_currency} ${t.tx_type} ${t.notes}`.toLowerCase();
      return s.includes(q);
    });
  }

  rows = rows
    .slice()
    .sort((a,b) => String(b.tx_date||"").localeCompare(String(a.tx_date||"")));

  for(const t of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.tx_date || "—")}</td>
      <td>${escapeHtml(t.deal_id || "—")}</td>
      <td>${escapeHtml(t.tx_type || "—")}</td>
      <td>${escapeHtml(t.base_currency || "—")}</td>
      <td>${escapeHtml(fmt(t.amount))}</td>
      <td>${escapeHtml(t.target_currency || "—")}</td>
      <td>${escapeHtml(fmt(t.payable))}</td>
      <td>${escapeHtml(t.customer || "—")}</td>
    `;
    tb.appendChild(tr);
  }
}

function wireTxControls(){
  $("#txSearch").addEventListener("input", () => renderTransactions());
  $("#txClearFilter").addEventListener("click", () => {
    $("#txSearch").value = "";
    state.activeDealId = null;
    renderTransactions();
  });
}

function renderAll(){
  renderDashboard();
  renderDeals();
  renderTransactions();
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* INIT */
document.addEventListener("DOMContentLoaded", async () => {
  $("#appVersion").textContent = APP_VERSION;

  setupNav();
  wireTxControls();

  // default view
  setView("dashboard");

  // load and render
  await loadData(true);
  renderAll();

  logDebug("App initialized");
});
