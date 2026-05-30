/* QuoteGuard — golden-set results explorer.
 * Renders the locally-generated full-system results (real Ollama LLM +
 * extractive fallback) over all 66 gold questions from a static JSON, so the
 * live site shows the *full* system's quality with no API at view time.
 * Self-initialises when #qg-gold is swapped into the WORKED EXAMPLES tab.
 */
(function () {
  "use strict";
  const ASSET = "../assets/quoteguard/gold_results.json";
  let DATA = null, loading = null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const pct = (n, d) => d ? Math.round(100 * n / d) + "%" : "—";
  const TONE = { grounded: "ok", grounded_extractive_fallback: "ok", extractive: "ok",
    refused_advice: "block", refused_pricing: "block", refused_prompt_injection: "block",
    insufficient_support: "warn", no_answer_in_document: "warn" };

  function statHeader(s, cfg) {
    const a = s.answerable;
    const cards = [
      [pct(s.retrieval_hit, a), "gold page retrieved (top 5)"],
      [pct(s.llm_cited_correct, a), "LLM cited the correct page"],
      [pct(s.llm_grounded, a), "answerable Qs answered, not refused"],
      [`${s.unanswerable_handled}/${s.unanswerable}`, "unanswerable Qs correctly refused"],
    ];
    return `<div class="gr-stats">${cards.map(([n, l]) =>
      `<div class="gr-stat"><div class="gr-num">${n}</div><div class="gr-lbl">${l}</div></div>`).join("")}</div>
      <p class="gr-cfg">Full system: <code>${esc(cfg.retriever)}</code> retrieval + <code>${esc(cfg.llm_model)}</code> (run locally). Each answerable question is checked against its gold supporting page; you can read the gold answer next to the system's and judge the wording yourself.</p>`;
  }

  function filters(data) {
    const cats = [...new Set(data.map(q => q.category))].sort();
    const diffs = [...new Set(data.map(q => q.difficulty))].sort();
    return `<div class="gr-filters">
      <input id="gr-search" class="gr-search" placeholder="Search questions…" />
      <select id="gr-cat"><option value="">All categories</option>${cats.map(c => `<option>${esc(c)}</option>`).join("")}</select>
      <select id="gr-diff"><option value="">All difficulties</option>${diffs.map(d => `<option>${esc(d)}</option>`).join("")}</select>
      <label class="gr-chk"><input type="checkbox" id="gr-miss"> retrieval misses only</label>
    </div>`;
  }

  function badge(ok, t, f) { return ok === null ? "" : `<span class="gr-b ${ok ? "ok" : "no"}">${ok ? t : f}</span>`; }

  function cites(list) {
    return list.length ? `<div class="gr-cites">${list.map(c =>
      `<span class="qg-cite">p. ${c.pages.join(", ")}${c.heading ? " · " + esc(c.heading) : ""}</span>`).join("")}</div>` : "";
  }

  function detail(q) {
    const trace = q.trace.map(t =>
      `<div class="qg-tr ${t.decision}"><span class="qg-trg">${esc(t.guard)}</span><span class="qg-trd ${t.decision}">${t.decision}</span><div class="qg-trr">${esc(t.stage)} · ${esc(t.reason)}</div></div>`).join("");
    const ev = q.retrieved.map((r, i) => {
      const gold = r.pages.some(p => q.gold_pages.includes(p));
      return `<div class="qg-evi"><span class="qg-evh">${i + 1}. ${esc(r.id)} · p. ${r.pages.join(", ")} · score ${r.score}${gold ? ' <span class="gr-goldpage">gold page</span>' : ""}</span><p>${esc(r.text)}…</p></div>`;
    }).join("");
    const col = (h, a, c, status) =>
      `<div class="gr-col"><div class="gr-h">${h}${status ? ` <span class="qg-status ${TONE[status] || "warn"}">${esc(status)}</span>` : ""}</div><div class="gr-a">${esc(a)}</div>${c ? cites(c) : ""}</div>`;
    return `<div class="gr-detail">
      <div class="gr-cols">
        <div class="gr-col gold"><div class="gr-h">Gold answer${q.gold_pages.length ? ` · p. ${q.gold_pages.join(", ")}` : ""}</div><div class="gr-a">${esc(q.gold_answer)}</div></div>
        ${col("Full system &middot; " + esc(q.llm.backend), q.llm.answer, q.llm.citations, q.llm.status)}
        ${col("Extractive fallback", q.extractive.answer, q.extractive.citations, q.extractive.status)}
      </div>
      <details class="gr-more"><summary>Guardrail trace &amp; retrieved evidence</summary>
        <div class="gr-twocol"><div class="gr-trace">${trace}</div><div class="gr-evwrap">${ev}</div></div>
      </details>
      <details class="gr-raw"><summary>Raw record (JSON)</summary><pre>${esc(JSON.stringify(q, null, 2))}</pre></details></div>`;
  }

  function row(q) {
    const hit = q.answerable ? badge(q.retrieval_hit, "page found", "page missed") : "";
    const cite = q.answerable ? badge(q.llm_cited_correct, "cited ✓", "cite ✗")
      : `<span class="gr-b ok">refusal expected</span>`;
    return `<div class="gr-item" data-cat="${esc(q.category)}" data-diff="${esc(q.difficulty)}" data-hit="${q.retrieval_hit}" data-text="${esc((q.question + " " + q.category + " " + q.id).toLowerCase())}">
      <button class="gr-q"><span class="gr-id">${esc(q.id)}</span><span class="gr-qt">${esc(q.question)}</span>
        <span class="gr-tags"><span class="gr-chip">${esc(q.category)}</span>${hit}${cite}</span></button>
      ${detail(q)}</div>`;
  }

  function applyFilters(root) {
    const term = root.querySelector("#gr-search").value.toLowerCase().trim();
    const cat = root.querySelector("#gr-cat").value, diff = root.querySelector("#gr-diff").value;
    const miss = root.querySelector("#gr-miss").checked;
    let shown = 0;
    root.querySelectorAll(".gr-item").forEach(el => {
      const ok = (!term || el.dataset.text.includes(term)) && (!cat || el.dataset.cat === cat)
        && (!diff || el.dataset.diff === diff) && (!miss || el.dataset.hit === "false");
      el.style.display = ok ? "" : "none";
      if (ok) shown++;
    });
    root.querySelector("#gr-count").textContent = `${shown} question${shown === 1 ? "" : "s"}`;
  }

  function render(root) {
    const d = DATA;
    root.innerHTML = statHeader(d.summary, d.config) + filters(d.questions)
      + `<div class="gr-count" id="gr-count"></div><div class="gr-list">${d.questions.map(row).join("")}</div>`;
    root.querySelectorAll(".gr-q").forEach(b => b.addEventListener("click", () => b.parentElement.classList.toggle("open")));
    ["#gr-search", "#gr-cat", "#gr-diff", "#gr-miss"].forEach(sel => {
      const el = root.querySelector(sel); el.addEventListener(sel === "#gr-search" ? "input" : "change", () => applyFilters(root));
    });
    applyFilters(root);
  }

  async function ensureData() {
    if (DATA) return DATA;
    if (!loading) loading = fetch(ASSET).then(r => r.json()).then(d => (DATA = d));
    return loading;
  }
  async function init(el) {
    el.innerHTML = `<p class="qg-loading">Loading the full golden-set results…</p>`;
    try { await ensureData(); render(el); }
    catch (e) { el.innerHTML = `<p class="qg-loading">Could not load results. ${esc(String(e))}</p>`; }
  }

  if (typeof document !== "undefined") {
    const obs = new MutationObserver(() => {
      const el = document.getElementById("qg-gold");
      if (el && !el.dataset.ready) { el.dataset.ready = "1"; init(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const initial = document.getElementById("qg-gold");
    if (initial && !initial.dataset.ready) { initial.dataset.ready = "1"; init(initial); }
  }
})();
