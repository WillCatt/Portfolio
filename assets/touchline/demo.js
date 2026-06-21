/* Touchline — in-browser demo.
 *
 * Faithful + zero paid-API: the football database is shipped as SQLite and the
 * agent's SQL runs FOR REAL in your browser via sql.js, redrawing charts from the
 * live result. The agent's reasoning is replayed from real recorded runs (frontier
 * = Claude Opus 4.8, local = qwen2.5-coder). Live LLM planning needs a server,
 * which this page doesn't call. The "drive the SQL yourself" box runs through a JS
 * port of the same read-only SELECT-guard the real agent uses.
 *
 * Self-initialises via a MutationObserver so it never touches project-page.js.
 */
(function () {
  "use strict";
  const BASE = "../assets/touchline/";
  const SQLJS = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";

  // ---------- pure helpers (node-testable) ----------
  const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|MERGE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|GRANT|REVOKE)\b/i;
  function validateSelect(sql) {
    if (!sql || !sql.trim()) throw new Error("empty query");
    let s = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").trim();
    if (s.endsWith(";")) s = s.slice(0, -1).trim();
    if (s.includes(";")) throw new Error("only a single statement is allowed");
    const head = (s.replace(/^[(\s]+/, "").split(/\s+/)[0] || "").toUpperCase();
    if (head !== "SELECT" && head !== "WITH") throw new Error("only SELECT/WITH queries are allowed");
    if (FORBIDDEN.test(s)) throw new Error("query contains a forbidden (non-read) keyword");
    return s;
  }
  const fmtNum = v =>
    typeof v === "number" && Number.isFinite(v)
      ? (Number.isInteger(v) ? v.toLocaleString() : String(v))
      : String(v == null ? "" : v);

  // From a result, choose a label column (first non-numeric) and a value column
  // (a numeric one) so a 2+-row result can become a bar/line chart.
  function chartData(columns, rows) {
    if (!rows || rows.length < 2 || !columns || columns.length < 2) return null;
    let valIdx = -1;
    for (let j = columns.length - 1; j >= 0; j--) {
      if (rows.every(r => typeof r[j] === "number")) { valIdx = j; break; }
    }
    if (valIdx === -1) return null;
    let labIdx = columns.findIndex((_, j) => j !== valIdx);
    return {
      labels: rows.map(r => String(r[labIdx])),
      values: rows.map(r => r[valIdx]),
      labelCol: columns[labIdx], valueCol: columns[valIdx],
    };
  }

  function svgChart(d, kind) {
    const W = 560, H = 240, padL = 48, padB = 56, padT = 12, padR = 12;
    const n = d.values.length, max = Math.max(...d.values, 1);
    const iw = W - padL - padR, ih = H - padT - padB;
    const x = i => padL + (iw * (kind === "line" ? i / Math.max(n - 1, 1) : (i + 0.5) / n));
    const y = v => padT + ih * (1 - v / max);
    let body = "";
    if (kind === "line") {
      const pts = d.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
      body += `<polyline fill="none" stroke="#2a8f8f" stroke-width="2.5" points="${pts}"/>`;
      body += d.values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#2a8f8f"/>`).join("");
    } else {
      const bw = Math.min(iw / n * 0.7, 60);
      body += d.values.map((v, i) =>
        `<rect x="${x(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${padT + ih - y(v)}" fill="#b06a16" rx="2"/>` +
        `<text x="${x(i)}" y="${y(v) - 5}" text-anchor="middle" font-size="11" fill="#1a1714" font-weight="600">${fmtNum(v)}</text>`
      ).join("");
    }
    const step = Math.ceil(n / 12);
    const labels = d.labels.map((l, i) =>
      i % step ? "" : `<text x="${x(i)}" y="${H - padB + 16}" text-anchor="middle" font-size="10" fill="#7a6e63" transform="rotate(35 ${x(i)} ${H - padB + 16})">${esc(l)}</text>`
    ).join("");
    return `<svg viewBox="0 0 ${W} ${H}" class="tl-svg" role="img" aria-label="chart">` +
      `<line x1="${padL}" y1="${padT + ih}" x2="${W - padR}" y2="${padT + ih}" stroke="#e6ded2"/>` +
      `${body}${labels}` +
      `<text x="${padL}" y="${padT + 4}" font-size="11" fill="#7a6e63">${esc(d.valueCol)}</text></svg>`;
  }
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ---------- sql.js engine ----------
  let DB = null, PACK = null, building = null;
  async function ensure() {
    if (DB && PACK) return;
    if (!building) building = (async () => {
      const initSqlJs = window.initSqlJs || (await loadScript(SQLJS + "sql-wasm.js"), window.initSqlJs);
      const SQL = await initSqlJs({ locateFile: f => SQLJS + f });
      const [buf, pack] = await Promise.all([
        fetch(BASE + "touchline.sqlite").then(r => r.arrayBuffer()),
        fetch(BASE + "demo_runs.json").then(r => r.json()),
      ]);
      DB = new SQL.Database(new Uint8Array(buf));
      PACK = pack;
    })();
    return building;
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("failed to load sql.js"));
      document.head.appendChild(s);
    });
  }
  function query(sql) {
    const clean = validateSelect(sql);            // same guard as the real agent
    const res = DB.exec(clean);
    if (!res.length) return { columns: [], rows: [] };
    return { columns: res[0].columns, rows: res[0].values };
  }

  // ---------- rendering ----------
  let state = { qi: 0, brain: null };

  function table(columns, rows, cap = 12) {
    if (!columns.length) return `<p class="tl-dim">no rows</p>`;
    const head = columns.map(c => `<th>${esc(c)}</th>`).join("");
    const body = rows.slice(0, cap).map(r =>
      `<tr>${r.map(v => `<td>${esc(fmtNum(v))}</td>`).join("")}</tr>`).join("");
    const more = rows.length > cap ? `<p class="tl-dim">…and ${rows.length - cap} more rows</p>` : "";
    return `<table class="tl-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${more}`;
  }

  function renderRun(host) {
    const q = PACK.questions[state.qi];
    const run = q.runs[state.brain];
    const elPlan = host.querySelector("#tl-plan");
    const elOut = host.querySelector("#tl-out");
    if (!run) {
      elPlan.innerHTML = `<p class="tl-dim">${esc(PACK.labels[state.brain] || state.brain)} hasn't been run on this question yet.</p>`;
      elOut.innerHTML = ""; return;
    }
    // replayed reasoning
    elPlan.innerHTML = run.plan.map(p =>
      p.type === "thought"
        ? `<div class="tl-thought">${esc(p.text)}</div>`
        : `<div class="tl-sql ${p.ok ? "" : "bad"}"><span class="tl-tag">run_sql ${p.ok ? "✓" : "✗"}</span><pre>${esc(p.sql)}</pre></div>`
    ).join("") || `<p class="tl-dim">(no tool calls)</p>`;

    // live execution of the agent's own query + chart
    let out = "";
    try {
      if (run.final_sql) {
        const res = query(run.final_sql);
        out += `<div class="tl-live"><span class="tl-tag live">live in your browser ✓</span>${table(res.columns, res.rows)}</div>`;
        const spec = run.chart && run.chart.sql ? chartFromSpec(run.chart) : chartData(res.columns, res.rows);
        if (spec) out += svgChart(spec, (run.chart && run.chart.kind) || "bar");
      }
    } catch (e) { out += `<p class="tl-err">${esc(String(e.message || e))}</p>`; }

    const badge = run.correct
      ? `<span class="tl-badge ok">answer matches the gold value</span>`
      : `<span class="tl-badge no">answer missed the gold value</span>`;
    const gold = [...(q.gold.strings || []), ...(q.gold.numbers || []).map(fmtNum)].join(", ");
    out += `<div class="tl-answer"><strong>${esc(PACK.labels[state.brain])}:</strong> ${esc(run.answer || "")} ${badge}` +
      `<div class="tl-dim">gold: ${esc(gold)}</div></div>`;
    elOut.innerHTML = out;
  }

  function chartFromSpec(chart) {
    try {
      const res = query(chart.sql);
      const xi = res.columns.indexOf(chart.x), yi = res.columns.indexOf(chart.y);
      if (xi < 0 || yi < 0 || res.rows.length < 2) return null;
      return { labels: res.rows.map(r => String(r[xi])), values: res.rows.map(r => r[yi]),
               labelCol: chart.x, valueCol: chart.y };
    } catch { return null; }
  }

  function render(host) {
    const brains = PACK.brains;
    state.brain = state.brain || brains[0];  // default to the strongest model present
    host.innerHTML = `
      <p class="tl-note">The agent's reasoning is <b>replayed from real recorded runs</b>; the
        SQL tool runs <b>live in your browser</b> via sql.js and the charts redraw from the real
        result — the numbers are computed on your device, not pre-baked.</p>
      <div class="tl-controls">
        <div class="tl-brains">${brains.map(b =>
          `<button class="tl-brain ${b === state.brain ? "on" : ""}" data-b="${b}">${esc(PACK.labels[b])}</button>`).join("")}</div>
      </div>
      <div class="tl-chips">${PACK.questions.map((q, i) =>
        `<button class="tl-chip ${i === state.qi ? "on" : ""}" data-i="${i}">${esc(q.question)}</button>`).join("")}</div>
      <div class="tl-run"><div class="tl-col"><h4>Agent reasoning <span class="tl-dim">(replayed)</span></h4>
        <div id="tl-plan"></div></div>
        <div class="tl-col"><h4>Live result <span class="tl-dim">(runs now)</span></h4><div id="tl-out"></div></div></div>
      <details class="tl-play"><summary>Drive the SQL tool yourself</summary>
        <textarea id="tl-sql" spellcheck="false">SELECT tournament, COUNT(*) AS n FROM matches GROUP BY tournament ORDER BY n DESC LIMIT 8</textarea>
        <button id="tl-run">Run SELECT</button><div id="tl-play-out"></div></details>`;
    host.querySelectorAll(".tl-brain").forEach(b => b.onclick = () => { state.brain = b.dataset.b; sync(host); });
    host.querySelectorAll(".tl-chip").forEach(c => c.onclick = () => { state.qi = +c.dataset.i; sync(host); });
    host.querySelector("#tl-run").onclick = () => runPlayground(host);
    renderRun(host);
  }
  function sync(host) {
    host.querySelectorAll(".tl-brain").forEach(b => b.classList.toggle("on", b.dataset.b === state.brain));
    host.querySelectorAll(".tl-chip").forEach(c => c.classList.toggle("on", +c.dataset.i === state.qi));
    renderRun(host);
  }
  function runPlayground(host) {
    const sql = host.querySelector("#tl-sql").value;
    const out = host.querySelector("#tl-play-out");
    try {
      const res = query(sql);
      const spec = chartData(res.columns, res.rows);
      out.innerHTML = `<span class="tl-tag live">live ✓</span>${table(res.columns, res.rows)}` +
        (spec ? svgChart(spec, "bar") : "");
    } catch (e) { out.innerHTML = `<p class="tl-err">${esc(String(e.message || e))}</p>`; }
  }

  async function init(el) {
    el.innerHTML = `<p class="tl-loading">Loading the in-browser database…</p>`;
    try { await ensure(); render(el); }
    catch (e) { el.innerHTML = `<p class="tl-loading">Could not load the demo. ${esc(String(e.message || e))}</p>`; }
  }

  if (typeof document !== "undefined") {
    const obs = new MutationObserver(() => {
      const el = document.getElementById("tl-demo");
      if (el && !el.dataset.ready) { el.dataset.ready = "1"; init(el); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const initial = document.getElementById("tl-demo");
    if (initial && !initial.dataset.ready) { initial.dataset.ready = "1"; init(initial); }
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { validateSelect, chartData, fmtNum, svgChart };
  }
})();
