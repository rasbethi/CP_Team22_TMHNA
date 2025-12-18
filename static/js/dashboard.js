document.addEventListener("DOMContentLoaded", () => {
  const status = document.querySelector(".status-chip");
  if (status) {
    const now = new Date();
    status.title = `Environment checked ${now.toLocaleString()}`;
  }
});

