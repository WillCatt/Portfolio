/* Forecast — "Inside the model" tab. Opens up the Dixon-Coles engine: the team
   ratings map, a live step-by-step anatomy of one prediction, what time-decay
   does to a rating, and how squad value lines up with on-pitch form.
   Shares the match math with the simulator via window.DC. Hand-drawn D3,
   hub palette, no build step. */
(function () {
  "use strict";

  var INK = "#1a1714", MUTED = "#7a6e63", LINE = "#e6ded2", AMBER = "#b06a16",
      TEAL = "#2a8f8f", PANEL = "#fffdfa";
  var HEAT = ["#faf8f4", "#f2dcae", "#e8c98f", "#d39a3f", "#b06a16", "#7a430b"];
  function heat(t) {
    t = Math.max(0, Math.min(1, Math.sqrt(t))); var n = HEAT.length - 1, i = Math.floor(t * n), f = t * n - i;
    return i >= n ? HEAT[n] : d3.interpolateRgb(HEAT[i], HEAT[i + 1])(f);
  }
  var pct = function (x, d) { return x == null || isNaN(x) ? "—" : (100 * x).toFixed(d || 0) + "%"; };

  // 48 World Cup teams → confederation, for colour-coding the ratings map.
  var CONF_COLOR = { UEFA: "#b06a16", CONMEBOL: "#2a8f8f", CONCACAF: "#4a6d8c", CAF: "#3a8f57", AFC: "#c0533b", OFC: "#7d5ba6" };
  var CONF = {};
  (function () {
    var groups = {
      UEFA: ["Austria", "Belgium", "Bosnia and Herzegovina", "Croatia", "Czech Republic", "England", "France", "Germany", "Netherlands", "Norway", "Portugal", "Scotland", "Spain", "Sweden", "Switzerland", "Turkey"],
      CONMEBOL: ["Argentina", "Brazil", "Colombia", "Ecuador", "Paraguay", "Uruguay"],
      CONCACAF: ["Canada", "Curaçao", "Haiti", "Mexico", "Panama", "United States"],
      CAF: ["Algeria", "Cape Verde", "DR Congo", "Egypt", "Ghana", "Ivory Coast", "Morocco", "Senegal", "South Africa", "Tunisia"],
      AFC: ["Australia", "Iran", "Iraq", "Japan", "Jordan", "Qatar", "Saudi Arabia", "South Korea", "Uzbekistan"],
      OFC: ["New Zealand"]
    };
    Object.keys(groups).forEach(function (c) { groups[c].forEach(function (t) { CONF[t] = c; }); });
  })();

  var SIM = null, FC = null, rendered = false, pipeIdx = 0;

  function defaultPreset() { return SIM.decay_presets.find(function (p) { return p.key === "default"; }); }

  // published-model parameters for one fixture: all weights on, value off, rho + recency on
  function published(f) {
    var pre = defaultPreset();
    return DC.match({
      S: pre.strengths, ha: pre.home_adv, rho: pre.rho,
      vz: SIM.value_z, vscale: SIM.meta.value_scale, hosts: SIM.hosts, country: f.country,
      home: f.home, away: f.away, N: SIM.meta.max_goals, wA: 1, wD: 1, wH: 1, wV: 0
    });
  }

  function tipFor(wrapSel) {
    var t = wrapSel.append("div").attr("class", "tooltip");
    return {
      show: function (ev, html) { var p = d3.pointer(ev, wrapSel.node()); t.html(html).style("left", p[0] + "px").style("top", p[1] + "px").style("opacity", 1); },
      hide: function () { t.style("opacity", 0); }
    };
  }

  // ── 01 · ratings map ──────────────────────────────────────────────────────
  function ratingsMap() {
    var sel = d3.select("#mdl-ratings"); sel.html("");
    var pre = defaultPreset();
    var data = Object.keys(pre.strengths).map(function (t) {
      return { team: t, att: pre.strengths[t][0], def: pre.strengths[t][1], conf: CONF[t] || "—" };
    });
    // legend
    var leg = d3.select("#mdl-legend"); leg.html("");
    ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"].forEach(function (c) {
      var s = leg.append("span"); s.append("i").style("background", CONF_COLOR[c]); s.append("text").text(c);
    });

    var W = sel.node().clientWidth || 720, H = Math.max(380, Math.min(520, W * 0.66)), m = { t: 16, r: 18, b: 48, l: 56 };
    var x = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.att; })).nice().range([m.l, W - m.r]);
    var y = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.def; })).nice().range([H - m.b, m.t]);
    var mx = d3.mean(data, function (d) { return d.att; }), my = d3.mean(data, function (d) { return d.def; });
    var wrap = d3.select(sel.node().parentNode); // .chart-wrap (positioned) for the tooltip
    var tip = tipFor(wrap);

    var svg = sel.append("svg").attr("viewBox", "0 0 " + W + " " + H).attr("height", H);
    // mean crosshair
    svg.append("line").attr("x1", x(mx)).attr("x2", x(mx)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", LINE).attr("stroke-dasharray", "4 4");
    svg.append("line").attr("y1", y(my)).attr("y2", y(my)).attr("x1", m.l).attr("x2", W - m.r).attr("stroke", LINE).attr("stroke-dasharray", "4 4");
    // axis labels
    svg.append("text").attr("x", (m.l + W - m.r) / 2).attr("y", H - 10).attr("text-anchor", "middle").attr("class", "axis-label").text("weaker  ·  attacking strength  ·  stronger →");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -(m.t + H - m.b) / 2).attr("y", 16).attr("text-anchor", "middle").attr("class", "axis-label").text("← stronger  ·  defensive strength");

    var g = svg.append("g").selectAll("circle").data(data).join("circle")
      .attr("cx", function (d) { return x(d.att); }).attr("cy", function (d) { return y(d.def); }).attr("r", 5.5)
      .attr("fill", function (d) { return CONF_COLOR[d.conf] || MUTED; }).attr("fill-opacity", .82).attr("stroke", "#fff").attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mousemove", function (ev, d) {
        d3.select(this).attr("r", 7.5);
        tip.show(ev, "<b>" + d.team + "</b><div class='t-sub'>" + d.conf + "</div>" +
          "<div class='t-row'><span>attack</span><b>" + d.att.toFixed(2) + "</b></div>" +
          "<div class='t-row'><span>defence</span><b>" + d.def.toFixed(2) + "</b></div>");
      })
      .on("mouseleave", function () { d3.select(this).attr("r", 5.5); tip.hide(); });

    // statically label the standout teams (top by combined rating) so the map reads at a glance
    var notable = data.slice().sort(function (a, b) { return (b.att + b.def) - (a.att + a.def); }).slice(0, 7);
    svg.append("g").selectAll("text").data(notable).join("text")
      .attr("class", "mdl-dot-label").attr("x", function (d) { return x(d.att) + 8; }).attr("y", function (d) { return y(d.def) + 3; })
      .text(function (d) { return d.team; });
  }

  // ── 02 · anatomy of a prediction ──────────────────────────────────────────
  function pipeline(idx) {
    var f = SIM.fixtures[idx];
    var r = published(f);
    var eqBox = d3.select("#mdl-eq"); eqBox.html("");
    if (!r) {
      eqBox.html("<p style='color:var(--muted)'>No fitted rating for one of these teams.</p>");
      d3.select("#mdl-pois").html(""); d3.select("#mdl-pipe-grid").html(""); d3.select("#mdl-rho").html("");
      d3.select("#mdl-pipe-1x2").html(""); d3.select("#mdl-pipe-1x2lbl").html(""); d3.select("#mdl-pipe-cap").text("");
      return;
    }

    // Step 1 — the log-mu ledger for each side
    function ledger(name, t, mu) {
      var row = eqBox.append("div").attr("class", "mdl-eqrow");
      row.append("div").attr("class", "who").html(name + " <b>" + mu.toFixed(2) + " xG</b>");
      var terms = row.append("div").attr("class", "mdl-terms");
      function chip(cls, label, val) {
        var c = terms.append("span").attr("class", "mdl-term " + cls);
        c.append("span").text((val >= 0 ? "+" : "−") + Math.abs(val).toFixed(2));
        c.append("small").text(label);
      }
      chip("att", "attack", t.att);
      terms.append("span").attr("class", "mdl-op").text("−");
      chip("def", "opp. defence", -t.def); // t.def is already negative; show the magnitude subtracted
      if (Math.abs(t.adv) > 1e-9) { terms.append("span").attr("class", "mdl-op").text("+"); chip("adv", "home edge", t.adv); }
      terms.append("span").attr("class", "mdl-op").text("→ exp →");
    }
    ledger(f.home, r.termsH, r.muH);
    ledger(f.away, r.termsA, r.muA);

    // Step 2 — two Poisson distributions
    poissonChart(r);

    // Step 3 — score grid + rho effect
    gridChart(r, f);

    // Step 4 — 1X2 bar (this is exactly the published forecast)
    var bar = d3.select("#mdl-pipe-1x2"); bar.html("");
    [["h", r.home], ["d", r.draw], ["a", r.away]].forEach(function (x) {
      bar.append("div").attr("class", x[0]).style("width", (100 * x[1]) + "%").text(x[1] >= 0.08 ? pct(x[1]) : "");
    });
    d3.select("#mdl-pipe-1x2lbl").html("<span>" + f.home + " win</span><span>draw</span><span>" + f.away + " win</span>");

    var fcFix = FC && FC.fixtures.find(function (q) { return q.home === f.home && q.away === f.away; });
    var match = fcFix ? "These are exactly the odds shown on <strong>The forecast</strong> tab (" +
      pct(fcFix.p_home) + " / " + pct(fcFix.p_draw) + " / " + pct(fcFix.p_away) + ") — same engine, rebuilt here in the open." :
      "Win / draw / loss is just the score grid folded along its diagonal.";
    d3.select("#mdl-pipe-cap").html(match);
  }

  function poissonChart(r) {
    var sel = d3.select("#mdl-pois"); sel.html("");
    var K = 7; // show 0..6 goals
    var W = sel.node().clientWidth || 720, H = 220, m = { t: 12, r: 14, b: 34, l: 34 };
    var x0 = d3.scaleBand().domain(d3.range(K).map(String)).range([m.l, W - m.r]).padding(0.28);
    var x1 = d3.scaleBand().domain(["h", "a"]).range([0, x0.bandwidth()]).padding(0.12);
    var ymax = d3.max([d3.max(r.ph.slice(0, K)), d3.max(r.pa.slice(0, K))]);
    var y = d3.scaleLinear().domain([0, ymax]).range([H - m.b, m.t]);
    var svg = sel.append("svg").attr("viewBox", "0 0 " + W + " " + H).attr("height", H);
    for (var k = 0; k < K; k++) {
      var gx = x0(String(k));
      svg.append("rect").attr("x", gx + x1("h")).attr("width", x1.bandwidth()).attr("y", y(r.ph[k])).attr("height", y(0) - y(r.ph[k])).attr("rx", 2).attr("fill", AMBER).attr("fill-opacity", .9);
      svg.append("rect").attr("x", gx + x1("a")).attr("width", x1.bandwidth()).attr("y", y(r.pa[k])).attr("height", y(0) - y(r.pa[k])).attr("rx", 2).attr("fill", TEAL).attr("fill-opacity", .85);
      svg.append("text").attr("x", gx + x0.bandwidth() / 2).attr("y", H - m.b + 16).attr("text-anchor", "middle").attr("class", "axis-label").text(k);
    }
    svg.append("text").attr("x", (m.l + W - m.r) / 2).attr("y", H - 4).attr("text-anchor", "middle").attr("class", "axis-label").text("goals scored — probability of each total");
    // tiny legend
    svg.append("rect").attr("x", W - m.r - 150).attr("y", m.t).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", AMBER);
    svg.append("text").attr("x", W - m.r - 135).attr("y", m.t + 9).attr("class", "axis-label").text("home");
    svg.append("rect").attr("x", W - m.r - 78).attr("y", m.t).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", TEAL);
    svg.append("text").attr("x", W - m.r - 63).attr("y", m.t + 9).attr("class", "axis-label").text("away");
  }

  function gridChart(r, f) {
    var sel = d3.select("#mdl-pipe-grid"); sel.html("");
    var g = r.grid, N = 6, cell = 30, pad = 22, S = N * cell;
    var svg = sel.append("svg").attr("viewBox", "0 0 " + (S + pad + 6) + " " + (S + pad + 16)).attr("height", S + pad + 16).attr("width", S + pad + 6);
    var root = svg.append("g").attr("transform", "translate(" + pad + ",6)");
    var max = 0, i, j; for (i = 0; i < N; i++) for (j = 0; j < N; j++) max = Math.max(max, g[i][j]);
    var lowCells = { "0,0": 1, "0,1": 1, "1,0": 1, "1,1": 1 };
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      var low = lowCells[i + "," + j];
      root.append("rect").attr("x", j * cell).attr("y", i * cell).attr("width", cell - 2).attr("height", cell - 2).attr("rx", 3)
        .attr("fill", heat(g[i][j] / max))
        .attr("stroke", low ? TEAL : "none").attr("stroke-width", low ? 2 : 0).attr("stroke-dasharray", low ? "3 2" : null);
    }
    for (i = 0; i < N; i++) {
      root.append("text").attr("x", -7).attr("y", i * cell + cell / 2 - 1).attr("text-anchor", "end").attr("dy", ".35em").attr("font-family", "JetBrains Mono, monospace").attr("font-size", 9).attr("fill", MUTED).text(i);
      root.append("text").attr("x", i * cell + cell / 2 - 1).attr("y", S + 10).attr("text-anchor", "middle").attr("font-family", "JetBrains Mono, monospace").attr("font-size", 9).attr("fill", MUTED).text(i);
    }
    svg.append("text").attr("x", 4).attr("y", S / 2 + 6).attr("transform", "rotate(-90,8," + (S / 2 + 6) + ")").attr("text-anchor", "middle").attr("font-family", "JetBrains Mono, monospace").attr("font-size", 9).attr("fill", MUTED).text(f.home + " goals");
    svg.append("text").attr("x", pad + S / 2).attr("y", S + pad + 14).attr("text-anchor", "middle").attr("font-family", "JetBrains Mono, monospace").attr("font-size", 9).attr("fill", MUTED).text(f.away + " goals");

    // rho effect: compare draw probability with and without the correction
    var pre = defaultPreset();
    var noRho = DC.match({ S: pre.strengths, ha: pre.home_adv, rho: 0, vz: SIM.value_z, vscale: SIM.meta.value_scale, hosts: SIM.hosts, country: f.country, home: f.home, away: f.away, N: SIM.meta.max_goals, wA: 1, wD: 1, wH: 1, wV: 0 });
    var dDraw = r.draw - noRho.draw;
    var arrow = dDraw >= 0 ? "<b class='up'>+" + (100 * dDraw).toFixed(1) + " pts</b>" : "<b class='dn'>" + (100 * dDraw).toFixed(1) + " pts</b>";
    d3.select("#mdl-rho").html(
      "<div class='k'>Dixon-Coles ρ correction</div>" +
      "The four dashed cells (0-0, 1-0, 0-1, 1-1) are where independent Poissons get football wrong. " +
      "ρ = " + pre.rho.toFixed(3) + " nudges them, shifting the draw probability " + arrow + " " +
      "(" + pct(noRho.draw) + " → " + pct(r.draw) + ").");
  }

  // ── 03 · recency / time-decay ─────────────────────────────────────────────
  function recencyChart() {
    var sel = d3.select("#mdl-recency"); sel.html("");
    var order = ["equal", "slow", "default", "fast", "hot"];
    var presets = order.map(function (k) { return SIM.decay_presets.find(function (p) { return p.key === k; }); });
    var shortLbl = { equal: "all history", slow: "4-yr", default: "2-yr", fast: "1-yr", hot: "6-mo" };
    var teams = Object.keys(defaultPreset().strengths);
    function overall(pre, t) { return pre.strengths[t] ? pre.strengths[t][0] + pre.strengths[t][1] : null; }
    // pick the biggest movers between all-history and recent-form
    var movers = teams.map(function (t) {
      var a = overall(presets[0], t), b = overall(presets[4], t);
      return { team: t, span: (a == null || b == null) ? -1 : Math.abs(b - a) };
    }).filter(function (d) { return d.span >= 0; }).sort(function (a, b) { return b.span - a.span; }).slice(0, 6).map(function (d) { return d.team; });

    var W = sel.node().clientWidth || 720, H = 360, m = { t: 18, r: 110, b: 40, l: 44 };
    var x = d3.scalePoint().domain(order).range([m.l, W - m.r]).padding(0.5);
    var allVals = []; movers.forEach(function (t) { presets.forEach(function (p) { var v = overall(p, t); if (v != null) allVals.push(v); }); });
    var y = d3.scaleLinear().domain(d3.extent(allVals)).nice().range([H - m.b, m.t]);
    var color = d3.scaleOrdinal().domain(movers).range(["#b06a16", "#2a8f8f", "#c0533b", "#4a6d8c", "#3a8f57", "#7d5ba6"]);
    var svg = sel.append("svg").attr("viewBox", "0 0 " + W + " " + H).attr("height", H);
    // x ticks
    order.forEach(function (k) {
      svg.append("line").attr("x1", x(k)).attr("x2", x(k)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", LINE);
      svg.append("text").attr("x", x(k)).attr("y", H - m.b + 16).attr("text-anchor", "middle").attr("class", "axis-label").text(shortLbl[k]);
    });
    svg.append("text").attr("x", (m.l + W - m.r) / 2).attr("y", H - 4).attr("text-anchor", "middle").attr("class", "axis-label").text("← weights all history evenly      ·      weights recent form heavily →");
    var line = d3.line().x(function (d) { return x(d.k); }).y(function (d) { return y(d.v); });
    movers.forEach(function (t) {
      var pts = order.map(function (k, i) { return { k: k, v: overall(presets[i], t) }; }).filter(function (d) { return d.v != null; });
      svg.append("path").attr("d", line(pts)).attr("fill", "none").attr("stroke", color(t)).attr("stroke-width", 2).attr("stroke-opacity", .85);
      svg.append("circle").attr("cx", x("hot")).attr("cy", y(pts[pts.length - 1].v)).attr("r", 3.5).attr("fill", color(t));
      svg.append("text").attr("x", W - m.r + 8).attr("y", y(pts[pts.length - 1].v) + 4).attr("class", "series-label").attr("fill", color(t)).text(t);
    });
  }

  // ── 04 · squad value vs on-pitch rating ───────────────────────────────────
  function valueChart() {
    var sel = d3.select("#mdl-value"); sel.html("");
    var pre = defaultPreset(), vz = SIM.value_z;
    var data = Object.keys(pre.strengths).filter(function (t) { return vz[t] != null; }).map(function (t) {
      return { team: t, vz: vz[t], rating: pre.strengths[t][0] + pre.strengths[t][1], conf: CONF[t] || "—" };
    });
    var W = sel.node().clientWidth || 720, H = Math.max(360, Math.min(480, W * 0.6)), m = { t: 16, r: 18, b: 46, l: 52 };
    var x = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.vz; })).nice().range([m.l, W - m.r]);
    var y = d3.scaleLinear().domain(d3.extent(data, function (d) { return d.rating; })).nice().range([H - m.b, m.t]);
    var wrap = d3.select(sel.node().parentNode); var tip = tipFor(wrap);
    var svg = sel.append("svg").attr("viewBox", "0 0 " + W + " " + H).attr("height", H);

    // least-squares trend line (illustrative)
    var n = data.length, sx = d3.sum(data, function (d) { return d.vz; }), sy = d3.sum(data, function (d) { return d.rating; });
    var sxx = d3.sum(data, function (d) { return d.vz * d.vz; }), sxy = d3.sum(data, function (d) { return d.vz * d.rating; });
    var b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
    var xd = x.domain();
    svg.append("line").attr("x1", x(xd[0])).attr("y1", y(a + b * xd[0])).attr("x2", x(xd[1])).attr("y2", y(a + b * xd[1])).attr("stroke", MUTED).attr("stroke-dasharray", "5 4").attr("stroke-width", 1.2);

    svg.append("text").attr("x", (m.l + W - m.r) / 2).attr("y", H - 10).attr("text-anchor", "middle").attr("class", "axis-label").text("squad market value (z-score) →");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -(m.t + H - m.b) / 2).attr("y", 16).attr("text-anchor", "middle").attr("class", "axis-label").text("on-pitch rating (attack + defence) →");

    svg.append("g").selectAll("circle").data(data).join("circle")
      .attr("cx", function (d) { return x(d.vz); }).attr("cy", function (d) { return y(d.rating); }).attr("r", 5)
      .attr("fill", function (d) { return CONF_COLOR[d.conf] || MUTED; }).attr("fill-opacity", .8).attr("stroke", "#fff").attr("stroke-width", 1).style("cursor", "pointer")
      .on("mousemove", function (ev, d) {
        d3.select(this).attr("r", 7);
        tip.show(ev, "<b>" + d.team + "</b>" +
          "<div class='t-row'><span>value z</span><b>" + d.vz.toFixed(2) + "</b></div>" +
          "<div class='t-row'><span>rating</span><b>" + d.rating.toFixed(2) + "</b></div>");
      })
      .on("mouseleave", function () { d3.select(this).attr("r", 5); tip.hide(); });
  }

  // ── orchestration ─────────────────────────────────────────────────────────
  function renderAll() {
    ratingsMap();
    pipeline(pipeIdx);
    recencyChart();
    valueChart();
    rendered = true;
  }

  function buildPicker() {
    var sel = d3.select("#mdl-pipe-select");
    SIM.fixtures.forEach(function (f, k) {
      var date = new Date(f.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
      sel.append("option").attr("value", k).text(date + " · " + f.home + " v " + f.away);
    });
    // default to a host fixture so the home-edge term is visible
    pipeIdx = Math.max(0, SIM.fixtures.findIndex(function (f) { return SIM.hosts.indexOf(f.home) >= 0 && f.home === f.country; }));
    sel.property("value", pipeIdx).on("change", function () { pipeIdx = +this.value; pipeline(pipeIdx); });
  }

  function initTabs() {
    var btns = Array.prototype.slice.call(document.querySelectorAll(".tab-btn"));
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
        b.classList.add("active"); b.setAttribute("aria-selected", "true");
        document.querySelectorAll(".tab-pane").forEach(function (p) { p.hidden = (p.id !== b.dataset.tab); });
        if (b.dataset.tab === "pane-model" && !rendered && SIM && FC) renderAll();
      });
    });
  }

  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  function boot() {
    initTabs();
    Promise.all([d3.json("../data/forecast.json"), d3.json("../data/simulator.json")]).then(function (r) {
      FC = r[0]; SIM = r[1];
      buildPicker();
      window.addEventListener("resize", debounce(function () {
        var pane = document.getElementById("pane-model");
        if (rendered && pane && !pane.hidden) renderAll();
      }, 200));
    }).catch(function (e) {
      d3.select("#mdl-ratings").html("<p style='color:var(--muted)'>Couldn't load the model bundle.</p>");
      console.error("forecast-model:", e);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
