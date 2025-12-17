const state = {
  deals: {},
  transactions: []
};

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  loadData().then(() => {
    renderDashboard();
    renderDeals();
    renderTransactions();
  });
  showView("dashboard");
});

function setupNav() {
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showView(btn.dataset.view);
    });
  });
}

function showView(name) {
  document.querySelectorAll(".view").forEach(v => {
    v.classList.toggle("hidden", v.dataset.view !== name);
  });
}

async function loadData() {
  try {
    const res = await fetch("data.json");
    const data = await res.json();

    state.transactions = data;
    state.deals = {};

    data.forEach(tx => {
      if (!state.deals[tx.deal_id]) {
        state.deals[tx.deal_id] = [];
      }
      state.deals[tx.deal_id].push(tx);
    });
  } catch (e) {
    console.error("Data load failed", e);
  }
}

function renderDashboard() {
  document.getElementById("total-deals").textContent =
    Object.keys(state.deals).length;

  document.getElementById("total-transactions").textContent =
    state.transactions.length;
}

function renderDeals() {
  const ul = document.getElementById("deals-list");
  ul.innerHTML = "";
  Object.keys(state.deals).forEach(id => {
    const li = document.createElement("li");
    li.textContent = id;
    ul.appendChild(li);
  });
}

function renderTransactions() {
  const ul = document.getElementById("transactions-list");
  ul.innerHTML = "";
  state.transactions.forEach(tx => {
    const li = document.createElement("li");
    li.textContent = `${tx.deal_id} - ${tx.amount} ${tx.currency}`;
    ul.appendChild(li);
  });
}
