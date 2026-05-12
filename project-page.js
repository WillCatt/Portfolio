// project-page.js — shared loader for project detail pages
// Reads window.PROJECT + <template> tags, renders header + tabs

(function () {
  const P = window.PROJECT;
  if (!P) { console.error("window.PROJECT not defined"); return; }
  document.title = `${P.title} · William Catt`;

  const root = document.getElementById("root");
  const hasApp = !!document.getElementById("tab-app") && P.demo !== false;

  const statusLabel = P.status === "live" ? "LIVE" : P.status === "wip" ? "IN PROGRESS" : "ARCHIVED";

  const tabsAvailable = [
    { key: "writeup", label: "WRITE-UP" },
    { key: "code", label: "CODE" },
    hasApp ? { key: "app", label: "APP" } : null
  ].filter(Boolean);

  root.innerHTML = `
    <div class="page">
      <div class="topbar">
        <a href="../index.html" style="color: var(--accent); font-size: 13px;">william_catt<span style="opacity:0.4">.portfolio</span></a>
        <a href="../all-projects.html">← all projects</a>
      </div>

      <header class="proj-header">
        <div class="proj-index" style="color:${P.color}">${P.index}</div>
        <h1 class="proj-title">${P.title}</h1>
        <p class="proj-subtitle">${P.subtitle}</p>
        <div class="proj-meta">
          <span class="status-pill ${P.status}">
            <span class="status-dot ${P.status}"></span>${statusLabel}
          </span>
          <div class="proj-tags">
            ${P.tags.map(t => `<span class="proj-tag">${t}</span>`).join("")}
          </div>
        </div>
      </header>

      <nav class="tabs" id="tabs">
        ${tabsAvailable.map((t, i) => `<button class="tab${i === 0 ? " active" : ""}" data-tab="${t.key}">${t.label}</button>`).join("")}
      </nav>

      <div id="tab-content"></div>
    </div>
  `;

  const tabContent = document.getElementById("tab-content");
  const tabButtons = document.querySelectorAll(".tab");

  function showTab(key) {
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
    const tpl = document.getElementById(`tab-${key}`);
    tabContent.innerHTML = "";
    if (tpl) tabContent.appendChild(tpl.content.cloneNode(true));
  }

  tabButtons.forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
  showTab(tabsAvailable[0].key);
})();
