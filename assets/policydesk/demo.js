/* PolicyDesk in-browser demo.
 * Two parts, both zero paid-API:
 *   1. an animated replay of the real LangGraph multi-agent run (recorded traces), and
 *   2. a live BM25 retriever over the PDS chunks (runs in your browser).
 * The LLM reasoning is pre-recorded; the graph topology, retrieved evidence and BM25 are real.
 * Self-inits via MutationObserver because <template> clones don't run their scripts.
 */
(function () {
  "use strict";

  // ---------- pure helpers (unit-testable under node) ----------
  function tokenize(s) { return (String(s).toLowerCase().match(/[a-z0-9]+/g)) || []; }

  function buildBM25(chunks) {
    const docs = chunks.map(c => tokenize(c.text));
    const N = docs.length || 1;
    const df = {};
    docs.forEach(d => new Set(d).forEach(t => { df[t] = (df[t] || 0) + 1; }));
    const idf = {};
    for (const t in df) idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
    const dl = docs.map(d => d.length);
    const avgdl = dl.reduce((a, b) => a + b, 0) / N || 1;
    const tf = docs.map(d => { const m = {}; d.forEach(t => { m[t] = (m[t] || 0) + 1; }); return m; });
    return { idf, dl, avgdl, tf };
  }

  function bm25Search(index, chunks, query, k = 4) {
    const k1 = 1.5, b = 0.75, q = tokenize(query);
    return chunks.map((c, i) => {
      let s = 0;
      q.forEach(t => {
        const f = index.tf[i][t]; if (!f) return;
        s += (index.idf[t] || 0) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * index.dl[i] / index.avgdl));
      });
      return { c, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => ({ ...x.c, score: x.s }));
  }

  function stepsFromRun(run) { return (run.trace || []).map((e, idx) => ({ ...e, idx })); }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { tokenize, buildBM25, bm25Search, stepsFromRun };
  }
  if (typeof document === "undefined") return;

  // ---------- browser ----------
  const BASE = "../assets/policydesk/";
  const esc = s => String(s || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const citeHtml = s => esc(s).replace(/\(pp?\.\s*[0-9][0-9,&amp;\s]*\)/g, m => `<mark class="pd-cite">${m}</mark>`);
  const trunc = (s, n) => s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s;

  function nodeLabel(key) {
    return { guard_in: "guard·in", planner: "planner", critic: "critic", revise: "revise",
             synthesizer: "synthesiser", guard_out: "guard·out" }[key] || key;
  }

  function render(root, data, chunks) {
    const runs = data.runs || [];
    let cur = 0, step = -1, timer = null;

    root.innerHTML = `
      <div class="pd-bar">
        <select class="pd-select"></select>
        <span class="pd-tag-slot"></span>
      </div>
      <div class="pd-stage">
        <div class="pd-graph"></div>
        <div class="pd-detail"></div>
      </div>
      <div class="pd-tape"></div>
      <div class="pd-bar">
        <button class="pd-btn pd-prev">◀ step</button>
        <button class="pd-btn primary pd-play">▶ play</button>
        <button class="pd-btn pd-next">step ▶</button>
        <span class="pd-stepc" style="font-size:12px;color:var(--text-dim)"></span>
      </div>
      <div class="pd-out">
        <div class="pd-card win"><h4>Multi-agent brief <span class="pd-metrics pd-mm"></span></h4><div class="pd-brief pd-mb"></div></div>
        <div class="pd-card"><h4>Single-shot baseline <span class="pd-bb-badge"></span></h4><div class="pd-brief pd-bb"></div></div>
      </div>
      <div class="pd-live">
        <h4>Live retriever — BM25 over the 138 PDS chunks</h4>
        <div style="font-size:12.5px;color:var(--text-muted)">Type any query; this runs in your browser, no server. It's the same retrieval the research agents use per sub-question.</div>
        <input class="pd-live-in" placeholder="e.g. what does the theft section cover?" />
        <div class="pd-live-out"></div>
      </div>
      <p class="pd-note"></p>
    `;

    const sel = root.querySelector(".pd-select");
    runs.forEach((r, i) => {
      const o = document.createElement("option");
      o.value = i; o.textContent = `${r.type === "blocked" ? "⛔ " : ""}${trunc(r.question, 64)}`;
      sel.appendChild(o);
    });

    const graphEl = root.querySelector(".pd-graph");
    const detailEl = root.querySelector(".pd-detail");
    const tapeEl = root.querySelector(".pd-tape");
    const stepc = root.querySelector(".pd-stepc");
    const playBtn = root.querySelector(".pd-play");

    function run() { return runs[cur]; }
    function steps() { return stepsFromRun(run()); }

    function buildGraph() {
      const r = run();
      const sq = r.subquestions || [];
      const research = sq.length
        ? `<div class="pd-fan"><div class="pd-fan-label">Send · fan-out (${sq.length} researcher${sq.length > 1 ? "s" : ""})</div>
             <div class="pd-row">${sq.map((s, i) => `<div class="pd-node" data-node="research" data-sq="${i}">research<span class="pd-sub">${trunc(s, 22)}</span></div>`).join("")}</div></div>`
        : `<div class="pd-fan"><div class="pd-fan-label">fan-out</div><div class="pd-row"><div class="pd-node" data-node="research">research</div></div></div>`;
      graphEl.innerHTML = `
        <div class="pd-row"><div class="pd-node" data-node="guard_in">guard·in</div><span class="pd-arrow">→</span><div class="pd-node" data-node="planner">planner</div></div>
        <div class="pd-row"><span class="pd-arrow">↓</span></div>
        ${research}
        <div class="pd-row"><span class="pd-arrow">↓</span></div>
        <div class="pd-row"><div class="pd-node" data-node="critic">critic</div><span class="pd-arrow">⇄</span><div class="pd-node" data-node="revise">revise</div></div>
        <div class="pd-loop">↑ critic ⇄ revise loop (capped)</div>
        <div class="pd-row"><span class="pd-arrow">↓</span></div>
        <div class="pd-row"><div class="pd-node" data-node="synthesizer">synthesiser</div><span class="pd-arrow">→</span><div class="pd-node" data-node="guard_out">guard·out</div></div>`;
    }

    function paintGraph() {
      const st = steps();
      graphEl.querySelectorAll(".pd-node").forEach(n => n.classList.remove("active", "done", "flag"));
      for (let i = 0; i <= step && i < st.length; i++) {
        const e = st[i];
        let nodes = graphEl.querySelectorAll(`.pd-node[data-node="${e.node}"]`);
        if (e.node === "research" && e.subquestion != null) {
          const idx = (run().subquestions || []).indexOf(e.subquestion);
          const m = graphEl.querySelector(`.pd-node[data-node="research"][data-sq="${idx}"]`);
          nodes = m ? [m] : nodes;
        }
        nodes.forEach(n => {
          n.classList.add(i === step ? "active" : "done");
          if (e.node === "critic" && e.flagged > 0) n.classList.add("flag");
        });
      }
    }

    function detailFor(e) {
      const r = run();
      if (e.node === "guard_in") {
        return e.kind ? `<h4>Input guard — blocked</h4><p>Refused as <b>${esc(e.kind)}</b>. The graph short-circuits to the end; no agents run.</p><div class="pd-draft">${esc(e.detail || "")}</div>`
          : `<h4>Input guard</h4><p>Question is in scope (not advice / pricing / injection). Passing to the planner.</p>`;
      }
      if (e.node === "planner") {
        const sq = r.subquestions || [];
        return `<h4>Planner — decomposed into ${sq.length}</h4>${sq.map(s => `<span class="pd-q">${esc(s)}</span>`).join("")}`;
      }
      if (e.node === "research") {
        const sq = e.subquestion;
        const draft = (r.initial_drafts || {})[sq] || "";
        const ev = (r.evidence || {})[sq] || [];
        return `<h4>Researcher — ${esc(trunc(sq, 48))}</h4>
          <div class="pd-step-meta">retrieved pages: <span class="pd-pages">${(e.retrieved_pages || []).join(", ")}</span></div>
          <div class="pd-draft">${citeHtml(draft)}</div>
          ${ev.slice(0, 2).map(c => `<div class="pd-ev"><span class="pd-pages">p. ${(c.pages || []).join(", ")}</span> ${esc(trunc(c.text, 150))}</div>`).join("")}`;
      }
      if (e.node === "critic") {
        const cs = e.critiques || [];
        return `<h4>Critic — round ${e.round}, flagged ${e.flagged}/${cs.length}</h4>
          ${cs.map(c => `<div style="margin:6px 0"><span class="pd-verdict ${c.verdict}">${c.verdict}</span>${esc(trunc(c.subquestion, 40))}<div style="font-size:12px;color:var(--text-muted);margin-top:3px">${esc(c.reason)}</div></div>`).join("")}`;
      }
      if (e.node === "revise") {
        const sq = e.subquestion;
        return `<h4>Revise — ${esc(trunc(sq, 48))}</h4><p style="font-size:12px;color:var(--text-muted)">Re-drafted to fix the critic's note:</p><div class="pd-draft">${citeHtml((r.final_drafts || {})[sq] || "")}</div>`;
      }
      if (e.node === "synthesizer") return `<h4>Synthesiser</h4><p>Merging the ${(r.subquestions || []).length} grounded findings into one cited brief.</p>`;
      if (e.node === "guard_out") return `<h4>Output guard — ${e.grounded ? "grounded ✓" : "ungrounded"}</h4><p>Cited pages: <span class="pd-pages">${(e.cited_pages || []).join(", ") || "—"}</span>${(e.unsupported || []).length ? ` · unsupported: ${e.unsupported.join(", ")}` : ""}. Brief released below.</p>`;
      return `<h4>${esc(e.node)}</h4><p>${esc(e.label || "")}</p>`;
    }

    function paint() {
      const st = steps();
      buildGraphIfNeeded();
      paintGraph();
      const e = step >= 0 && step < st.length ? st[step] : null;
      detailEl.innerHTML = e ? detailFor(e) : `<h4>Ready</h4><p style="color:var(--text-muted)">Press <b>play</b> to watch the multi-agent graph run on this question, or step through it. Every value below is from a real recorded run on <code>${esc(data.model)}</code>.</p>`;
      tapeEl.innerHTML = st.map((e, i) => `<div class="pd-tick ${i < step ? "played" : ""} ${i === step ? "cur" : ""}" data-i="${i}" title="${esc(e.node)}"></div>`).join("");
      tapeEl.querySelectorAll(".pd-tick").forEach(t => t.onclick = () => { stop(); step = +t.dataset.i; paint(); });
      stepc.textContent = `step ${Math.max(step + 1, 0)} / ${st.length}`;
      root.querySelector(".pd-prev").disabled = step < 0;
      root.querySelector(".pd-next").disabled = step >= st.length - 1;
    }

    let builtFor = -1;
    function buildGraphIfNeeded() { if (builtFor !== cur) { buildGraph(); builtFor = cur; } }

    function paintOutputs() {
      const r = run();
      root.querySelector(".pd-mb").innerHTML = citeHtml(r.final_brief);
      root.querySelector(".pd-mm").innerHTML =
        `<span><b>${r.usage.llm_calls}</b> calls</span><span><b>${r.revision_count}</b> rev</span><span><b>${r.latency_s}</b>s</span>`;
      const b = r.baseline;
      root.querySelector(".pd-bb").innerHTML = citeHtml(b.answer);
      root.querySelector(".pd-bb-badge").innerHTML =
        `<span class="pd-metrics"><span>${b.grounded ? "grounded" : "ungrounded"}</span><span>gold <b>${Math.round(b.gold_coverage * 100)}%</b></span><span><b>1</b> call</span></span>`;
      const tagSlot = root.querySelector(".pd-tag-slot");
      tagSlot.innerHTML = `<span class="pd-tag ${r.type}">${r.type === "multi" ? "multi-part" : r.type === "blocked" ? "guardrail" : "simple"}</span>`;
    }

    function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.textContent = "▶ play"; } }
    function play() {
      if (timer) return stop();
      playBtn.textContent = "⏸ pause";
      timer = setInterval(() => {
        const st = steps();
        if (step >= st.length - 1) return stop();
        step++; paint();
      }, 1150);
    }

    function selectRun(i) { stop(); cur = i; step = -1; builtFor = -1; paintOutputs(); paint(); }

    sel.onchange = () => selectRun(+sel.value);
    root.querySelector(".pd-prev").onclick = () => { stop(); if (step >= 0) step--; paint(); };
    root.querySelector(".pd-next").onclick = () => { stop(); const st = steps(); if (step < st.length - 1) step++; paint(); };
    playBtn.onclick = play;

    // live BM25
    const liveIn = root.querySelector(".pd-live-in");
    const liveOut = root.querySelector(".pd-live-out");
    if (chunks && chunks.length) {
      const index = buildBM25(chunks);
      const search = () => {
        const q = liveIn.value.trim();
        if (!q) { liveOut.innerHTML = ""; return; }
        const hits = bm25Search(index, chunks, q, 4);
        liveOut.innerHTML = hits.length
          ? hits.map(h => `<div class="pd-hit"><span class="pd-pages">p. ${(h.pages || []).join(", ")}</span> · ${esc(h.heading || "")}<div style="color:var(--text-muted);margin-top:3px">${esc(trunc(h.text, 180))}</div></div>`).join("")
          : `<div class="pd-hit" style="color:var(--text-muted)">No matching chunk.</div>`;
      };
      let deb; liveIn.oninput = () => { clearTimeout(deb); deb = setTimeout(search, 180); };
    } else {
      root.querySelector(".pd-live").style.display = "none";
    }

    root.querySelector(".pd-note").innerHTML =
      `<b>What's faithful vs lightweight.</b> Faithful: the graph topology, the sub-question decomposition, the real retrieved evidence, the recorded agent outputs and critic verdicts, and the live BM25 retriever above. Lightweight: the LLM reasoning is <em>pre-recorded</em> from a local <code>${esc(data.model)}</code> run (no API at view time), and these are a handful of illustrative questions, not the full eval set.`;

    selectRun(0);
  }

  function init(root) {
    root.innerHTML = `<p class="pd-loading">Loading the recorded agent runs…</p>`;
    Promise.all([
      fetch(BASE + "agent_runs.json").then(r => r.json()),
      fetch(BASE + "chunks.json").then(r => r.json()).catch(() => []),
    ]).then(([data, chunks]) => render(root, data, chunks))
      .catch(err => { root.innerHTML = `<p class="pd-loading">Couldn't load the demo data (${esc(err.message || err)}).</p>`; });
  }

  const seen = new WeakSet();
  function scan() { document.querySelectorAll("#pd-demo").forEach(el => { if (!seen.has(el)) { seen.add(el); init(el); } }); }
  if (document.readyState !== "loading") scan();
  document.addEventListener("DOMContentLoaded", scan);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
