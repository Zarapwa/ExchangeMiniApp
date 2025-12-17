/* ExchangeMini - Stable SPA (no hash, no sticky, GitHub Pages friendly) */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    debug: false,
    data: [],
    selectedDealId: "",
    currentView: "dashboard",
    dealsIndex: [], // derived
    txFiltered: [],
  };

  function setFooter(text) {
    const el = $("#footer-status");
    if (el) el.textContent = text;
  }

  function setDashStatus(text) {
    const el = $("#dash-status");
    if (el) el.textContent = text;
  }

  function log(...args) {
    if (!state.debug) return;
    console.log("[EXMINI]", ...args);
  }

  function safeStr(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function norm(s) {
    return safeStr(s).trim().toLowerCase();
  }

  function parseDateLoose(s) {
    // Accept "2025-07-30" and also sloppy strings; fallback to NaN
    const t = Date.parse(safeStr(s));
    return Number.isFinite(t) ? t : NaN;
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function getDealId(tx) {
    // Your file uses deal_id (string)
    return safeStr(tx.deal_id);
  }

  function getTxDate(tx) {
    return safeStr(tx.tx_date);
  }

  function buildDerived() {
    const rows = Array.isArray(state.data) ? state.data : [];
    const byDeal = new Map();

    for (const tx of rows) {
      const dealId = getDealId(tx);
      if (!dealId) continue;

      if (!byDeal.has(dealId)) {
        byDeal.set(dealId, {
          deal_id: dealId,
          customers: new Set(),
          exchangers: new Set(),
          txCount: 0,
          lastDate: "",
          lastDateTs: NaN,
        });
      }
      const d = byDeal.get(dealId);
      d.txCount += 1;
      if (tx.customer) d.customers.add(safeStr(tx.customer));
      if (tx.exchanger) d.exchangers.add(safeStr(tx.exchanger));

      const dt = getTxDate(tx);
      const ts = parseDateLoose(dt);
      if (Number.isFinite(ts) && (!Number.isFinite(d.lastDateTs) || ts > d.lastDateTs)) {
        d.lastDateTs = ts;
        d.lastDate = dt;
      }
    }

    const deals = Array.from(byDeal.values())
      .sort((a, b) => {
        const at = Number.isFinite(a.lastDateTs) ? a.lastDateTs : -Infinity;
        const bt = Number.isFinite(b.lastDateTs) ? b.lastDateTs : -Infinity;
        return bt - at;
      })
      .map(d => ({
        deal_id: d.deal_id,
        customer: Array.from(d.customers).filter(Boolean)[0] || "",
        exchanger: Array.from(d.exchangers).filter(Boolean)[0] || "",
        txCount: d.txCount,
        lastDate: d.lastDate || "",
      }));

    state.dealsIndex = deals;
  }

  function filterDeals(q) {
    const s = norm(q);
    if (!s) return state.dealsIndex.slice();

    return state.dealsIndex.filter(d => {
      const hay = [
        d.deal_id,
        d.customer,
        d.exchanger,
        String(d.txCount),
        d.lastDate,
      ].map(norm).join(" ");
      return hay.includes(s);
    });
  }

  function filterTx(q) {
    const s = norm(q);
    const rows = Array.isArray(state.data) ? state.data : [];

    let filtered = rows;

    if (state.selectedDealId) {
      filtered = filtered.filter(tx => getDealId(tx) === state.selectedDealId);
    }
    if (s) {
      filtered = filtered.filter(tx => {
        const hay = [
          tx.tx_date,
          tx.deal_id,
          tx.tx_type,
          tx.customer,
          tx.exchanger,
          tx.account_id,
          tx.base_currency,
          tx.target_currency,
          tx.amount,
          tx.payable,
          tx.notes,
        ].map(norm).join(" ");
        return hay.includes(s);
      });
    }

    // sort by date desc if possible
    filtered = filtered.slice().sort((a, b) => {
      const at = parseDateLoose(a.tx_date);
      const bt = parseDateLoose(b.tx_date);
      if (Number.isFinite(at) && Number.isFinite(bt)) return bt - at;
      return norm(b.tx_date).localeCompare(norm(a.tx_date));
    });

    state.txFiltered = filtered;
  }

  function showView(view) {
    const views = $$(".view");
    for (const v of views) {
      const isTarget = v.dataset.view === view;
      v.classList.toggle("hidden", !isTarget);
    }

    $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    state.currentView = view;

    // Update view-specific subtitles
    if (view === "transactions") {
      const sub = $("#tx-subtitle");
      if (sub) sub.textContent = state.selectedDealId ? `Deal: ${state.selectedDealId}` : "All transactions";
    }
    if (view === "dashboard") {
      const sel = $("#kpi-selected-deal");
      if (sel) sel.textContent = state.selectedDealId ? state.selectedDealId : "All";
    }
  }

  function renderDashboard() {
    const totalTx = Array.isArray(state.data) ? state.data.length : 0;
    const totalDeals = state.dealsIndex.length;

    $("#kpi-total-deals").textContent = String(totalDeals);
    $("#kpi-total-tx").textContent = String(totalTx);

    const lastTs = Math.max(
      ...state.data.map(r => parseDateLoose(r.tx_date)).filter(Number.isFinite),
      -Infinity
    );
    $("#kpi-last-date").textContent = Number.isFinite(lastTs) ? new Date(lastTs).toISOString().slice(0, 10) : "—";

    const sel = $("#kpi-selected-deal");
    if (sel) sel.textContent = state.selectedDealId ? state.selectedDealId : "All";

    // Quick list (top 6)
    const list = $("#dash-deal-list");
    list.innerHTML = "";
    const top = state.dealsIndex.slice(0, 6);
    for (const d of top) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-item";
      item.dataset.deal = d.deal_id;

      const left = document.createElement("div");
      left.className = "list-left";
      left.innerHTML = `
        <div class="list-title">${escapeHtml(d.deal_id)}</div>
        <div class="list-sub">${escapeHtml(d.customer || "—")} · ${escapeHtml(d.exchanger || "—")}</div>
      `;

      const right = document.createElement("div");
      right.className = "muted";
      right.textContent = `${d.txCount} tx · ${d.lastDate || "—"}`;

      item.appendChild(left);
      item.appendChild(right);
      list.appendChild(item);
    }

    setDashStatus("Loaded.");
  }

  function renderDealsTable(rows) {
    const el = $("#deals-table");
    el.innerHTML = "";

    $("#deals-count").textContent = `${rows.length} deal(s)`;

    for (const d of rows) {
      const row = document.createElement("div");
      row.className = "trow";
      row.dataset.deal = d.deal_id;

      // Desktop layout columns exist via CSS grid; on mobile it stacks.
      row.innerHTML = `
        <button type="button" aria-label="Open deal ${escapeHtml(d.deal_id)}">${escapeHtml(d.deal_id)}</button>
        <div class="muted">${escapeHtml(d.customer || "—")}</div>
        <div class="muted">${escapeHtml(d.exchanger || "—")}</div>
        <div class="muted">${escapeHtml(String(d.txCount))}</div>
        <div class="muted">${escapeHtml(d.lastDate || "—")}</div>
      `;

      el.appendChild(row);
    }
  }

  function renderTransactionsTable() {
    const el = $("#tx-table");
    el.innerHTML = "";

    for (const tx of state.txFiltered) {
      const base = `${safeStr(tx.base_currency)} ${safeStr(tx.amount)}`.trim();
      const target = `${safeStr(tx.target_currency)}`.trim();
      const payable = safeStr(tx.payable);

      const row = document.createElement("div");
      row.className = "trow";

      row.innerHTML = `
        <div>${escapeHtml(safeStr(tx.tx_date))}</div>
        <div class="muted">${escapeHtml(safeStr(tx.deal_id))}</div>
        <div>${escapeHtml(safeStr(tx.tx_type))}</div>
        <div class="muted">${escapeHtml(safeStr(tx.customer))}</div>
        <div class="muted">${escapeHtml(base || "—")}</div>
        <div class="muted">${escapeHtml(target || "—")}</div>
        <div>${escapeHtml(payable || "—")}</div>
      `;

      el.appendChild(row);
    }

    const sub = $("#tx-subtitle");
    if (sub) sub.textContent = state.selectedDealId ? `Deal: ${state.selectedDealId}` : "All transactions";
  }

  function renderReportDealOptions() {
    const sel = $("#report-deal");
    if (!sel) return;
    const current = sel.value;

    sel.innerHTML = `<option value="">Select deal…</option>`;
    for (const d of state.dealsIndex) {
      const opt = document.createElement("option");
      opt.value = d.deal_id;
      opt.textContent = d.deal_id;
      sel.appendChild(opt);
    }
    // restore if still exists
    if (current && state.dealsIndex.some(d => d.deal_id === current)) sel.value = current;
  }

  function setSelectedDeal(dealId) {
    state.selectedDealId = dealId || "";
    // update dashboard KPI
    const sel = $("#kpi-selected-deal");
    if (sel) sel.textContent = state.selectedDealId ? state.selectedDealId : "All";

    // re-filter tx using current search
    filterTx($("#tx-search").value);
    renderTransactionsTable();
  }

  async function loadData() {
    setFooter("Loading data.json…");
    setDashStatus("Loading…");

    // IMPORTANT: Keep structure unchanged. Just fetch and use as-is.
    const url = `data.json`; // no hash, no query tricks
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`Failed to load data.json (${res.status})`);
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
      throw new Error("data.json must be a JSON array");
    }

    state.data = json;
    buildDerived();

    // initial filters
    renderDashboard();
    renderDealsTable(state.dealsIndex);
    filterTx(""); // all or selected
    renderTransactionsTable();
    renderReportDealOptions();

    setFooter(`Loaded ${state.data.length} transactions.`);
  }

  function wireNavigation() {
    document.addEventListener("click", (e) => {
      // NAV buttons
      const navBtn = e.target.closest(".nav-link");
      if (navBtn) {
        const view = navBtn.dataset.view;
        if (view) {
          showView(view);
        }
        return;
      }

      // Dashboard quick deal buttons
      const quick = e.target.closest(".list-item");
      if (quick && quick.dataset.deal) {
        setSelectedDeal(quick.dataset.deal);
        showView("transactions");
        return;
      }

      // Deals row click
      const dealRow = e.target.closest("#deals-table .trow");
      if (dealRow && dealRow.dataset.deal) {
        setSelectedDeal(dealRow.dataset.deal);
        showView("transactions");
        return;
      }
    });
  }

  function wireControls() {
    $("#btn-debug").addEventListener("click", () => {
      state.debug = !state.debug;
      $("#btn-debug").setAttribute("aria-pressed", String(state.debug));
      $("#btn-debug").classList.toggle("pill-primary", state.debug);
      $("#btn-debug").classList.toggle("pill-ghost", !state.debug);
      setFooter(state.debug ? "Debug ON" : "Debug OFF");
    });

    $("#btn-clear-selection").addEventListener("click", () => {
      setSelectedDeal("");
      // keep view, just reset
      if (state.currentView === "dashboard") renderDashboard();
    });

    // Deals search
    $("#deal-search").addEventListener("input", (e) => {
      const rows = filterDeals(e.target.value);
      renderDealsTable(rows);
    });
    $("#deal-search-clear").addEventListener("click", () => {
      $("#deal-search").value = "";
      renderDealsTable(state.dealsIndex);
    });

    // Tx search
    $("#tx-search").addEventListener("input", (e) => {
      filterTx(e.target.value);
      renderTransactionsTable();
    });
    $("#tx-search-clear").addEventListener("click", () => {
      $("#tx-search").value = "";
      filterTx("");
      renderTransactionsTable();
    });

    // Reports generate placeholder
    $("#btn-make-report").addEventListener("click", () => {
      const deal = $("#report-deal").value;
      const out = $("#report-output");
      if (!deal) {
        out.textContent = "Select a deal first.";
        return;
      }
      const rows = state.data.filter(r => safeStr(r.deal_id) === deal);
      const header = `Deal Report: ${deal}\nTransactions: ${rows.length}\n`;
      out.textContent = header + "\n" + rows.slice(0, 50).map(r => {
        return `${safeStr(r.tx_date)} | ${safeStr(r.tx_type)} | ${safeStr(r.base_currency)} ${safeStr(r.amount)} -> ${safeStr(r.target_currency)} ${safeStr(r.payable)}`;
      }).join("\n");
    });
  }

  function escapeHtml(s) {
    return safeStr(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function boot() {
    try {
      wireNavigation();
      wireControls();
      showView("dashboard");
      await loadData();
      log("Boot complete");
    } catch (err) {
      console.error(err);
      setFooter(`Error: ${err.message}`);
      setDashStatus("Error loading data.");
      alert(`Error:\n${err.message}\n\nMake sure data.json is in the same folder and is valid JSON array.`);
    }
  }

  boot();
})();
