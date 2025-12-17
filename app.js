document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  showView("dashboard");
});

function setupNavigation() {
  const buttons = document.querySelectorAll(".nav-link");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      showView(view);

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function showView(name) {
  document.querySelectorAll("section.view").forEach(section => {
    if (section.dataset.view === name) {
      section.classList.remove("hidden");
    } else {
      section.classList.add("hidden");
    }
  });
}
