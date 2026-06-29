/* Grid Lens dashboard. Vanilla D3 v7, reads data/grid.json + data/history.json. */
(function () {
  "use strict";

  // Fuel metadata, in stack order (bottom → top): fossils low, renewables high.
  const FUELS = [
    { key: "coal",                label: "Coal",       color: "#3f3a34" },
    { key: "gas",                 label: "Gas",        color: "#c77d3a" },
    { key: "distillate",          label: "Distillate", color: "#8c4a2f" },
    { key: "bioenergy",           label: "Bioenergy",  color: "#9c8a3e" },
    { key: "battery_discharging", label: "Battery",    color: "#8266a8" },
    { key: "hydro",               label: "Hydro",      color: "#2f7fae" },
    { key: "wind",                label: "Wind",       color: "#3a9d8c" },
    { key: "solar",               label: "Solar",      color: "#e6b53c" },
  ];
  const COLOR = Object.fromEntries(FUELS.map(f => [f.key, f.color]));
  const LABEL = Object.fromEntries(FUELS.map(f => [f.key, f.label]));

  // Carbon-intensity colour ramp (gCO2/kWh): clean green → amber → dirty red.
  const ciColor = d3.scaleLinear()
    .domain([50, 300, 650])
    .range(["#2f9e5f", "#d8a93a", "#c0492f"])
    .clamp(true);

  const fMW = d3.format(",.0f");
  const fInt = d3.format(",.0f");
  const TIP = document.getElementById("tip");

  function showTip(html, e) {
    TIP.innerHTML = html;
    TIP.style.opacity = 1;
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const r = TIP.getBoundingClientRect();
    if (x + r.width > innerWidth) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight) y = e.clientY - r.height - pad;
    TIP.style.left = x + "px";
    TIP.style.top = y + "px";
  }
  const hideTip = () => (TIP.style.opacity = 0);

  function ciVerdict(ci) {
    if (ci < 100) return "very clean";
    if (ci < 250) return "clean";
    if (ci < 450) return "middling";
    if (ci < 600) return "dirty";
    return "coal-heavy";
  }

  Promise.all([
    d3.json("data/grid.json"),
    d3.json("data/history.json"),
  ]).then(([g, h]) => {
    header(g);
    renderStats(g);
    renderMix(g);
    renderArea(g);
    renderRegions(g);
    renderHistory(h);
    crossCheck(g, h);
  }).catch(err => {
    console.error("Grid Lens load failed", err);
    document.getElementById("asof").textContent = "data unavailable";
  });

  // ── header / footer ──────────────────────────────────
  function header(g) {
    const d = new Date(g.as_of);
    const t = d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Sydney" });
    const day = d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "Australia/Sydney" });
    document.getElementById("asof").textContent = `live · ${day} ${t} AEST`;
    document.getElementById("genat").textContent =
      "rebuilt " + new Date(g.generated_at).toLocaleString("en-AU", { timeZone: "Australia/Sydney" });
  }

  // ── hero stats ───────────────────────────────────────
  function renderStats(g) {
    const ci = g.carbon_intensity;
    const cards = [
      {
        cls: "ci", lbl: "Carbon intensity", num: fInt(ci), unit: "g/kWh",
        sub: ciVerdict(ci) + " right now", bg: ciColor(ci),
      },
      { lbl: "Renewable share", num: g.renewable_pct, unit: "%", sub: "of generation", accent: "#3a9d8c" },
      { lbl: "Demand", num: fMW(g.demand_mw), unit: "MW", sub: "across the NEM", accent: "#2f7fae" },
      { lbl: "Wholesale price", num: "$" + fInt(g.price_aud_mwh), unit: "/MWh", sub: "spot, this interval", accent: "#c77d3a" },
    ];
    const sel = d3.select("#stats").selectAll(".stat").data(cards).join("div")
      .attr("class", d => "stat" + (d.cls ? " " + d.cls : ""));
    sel.style("background", d => d.bg || null);
    sel.html(d => `
      ${d.accent ? `<span class="bar-accent" style="background:${d.accent}"></span>` : ""}
      <div class="lbl">${d.lbl}</div>
      <div class="num">${d.num}<span class="unit">${d.unit}</span></div>
      <div class="sub">${d.sub}</div>`);
  }

  // ── current mix bar + legend ─────────────────────────
  function renderMix(g) {
    const mix = g.mix.slice().sort((a, b) =>
      FUELS.findIndex(f => f.key === a.fuel) - FUELS.findIndex(f => f.key === b.fuel));
    const total = d3.sum(mix, d => d.mw);
    document.getElementById("mix-head").textContent =
      `What's powering the grid — ${fMW(total)} MW`;

    d3.select("#mixbar").selectAll("span").data(mix).join("span")
      .style("width", d => (100 * d.mw / total) + "%")
      .style("background", d => COLOR[d.fuel])
      .on("mousemove", (e, d) => showTip(
        `<b>${LABEL[d.fuel]}</b><br>${fMW(d.mw)} MW · ${(100 * d.mw / total).toFixed(1)}%`, e))
      .on("mouseleave", hideTip);

    d3.select("#legend").selectAll(".item").data(mix).join("div")
      .attr("class", "item")
      .html(d => `<span class="swatch" style="background:${COLOR[d.fuel]}"></span>${LABEL[d.fuel]}
        <span class="pct">${(100 * d.mw / total).toFixed(0)}%</span>`);
  }

  // ── 48h stacked area ─────────────────────────────────
  function renderArea(g) {
    const keys = FUELS.map(f => f.key).filter(k => g.series.mix[k]);
    const ts = g.series.timestamps.map(s => new Date(s));
    const rows = ts.map((date, i) => {
      const r = { date };
      keys.forEach(k => (r[k] = Math.max(0, g.series.mix[k][i] || 0)));
      return r;
    });

    const W = 1040, H = 320, m = { t: 10, r: 14, b: 26, l: 46 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const svg = freshSvg("#area", W, H);
    const gp = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    const x = d3.scaleTime().domain(d3.extent(ts)).range([0, iw]);
    const stacked = d3.stack().keys(keys)(rows);
    const y = d3.scaleLinear()
      .domain([0, d3.max(stacked[stacked.length - 1], d => d[1]) * 1.02])
      .range([ih, 0]);

    gp.append("g").attr("class", "gridline")
      .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));

    const area = d3.area().x(d => x(d.data.date)).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveMonotoneX);
    gp.selectAll("path.layer").data(stacked).join("path")
      .attr("class", "layer").attr("fill", d => COLOR[d.key]).attr("d", area)
      .attr("opacity", .92);

    gp.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%a %H:%M")));
    gp.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d / 1000 + " GW"));

    // hover: nearest interval breakdown
    const bisect = d3.bisector(d => d.date).center;
    const rule = gp.append("line").attr("y1", 0).attr("y2", ih)
      .attr("stroke", "var(--text)").attr("stroke-width", 1).attr("opacity", 0);
    gp.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
      .on("mousemove", function (e) {
        const xm = x.invert(d3.pointer(e, this)[0]);
        const row = rows[bisect(rows, xm)];
        rule.attr("opacity", .4).attr("x1", x(row.date)).attr("x2", x(row.date));
        const items = keys.slice().reverse().filter(k => row[k] > 50)
          .map(k => `<span style="color:${COLOR[k]}">■</span> ${LABEL[k]} ${fMW(row[k])}`).join("<br>");
        const tot = d3.sum(keys, k => row[k]);
        showTip(`<b>${d3.timeFormat("%a %H:%M")(row.date)}</b> · ${fMW(tot)} MW<br>${items}`, e);
      })
      .on("mouseleave", () => { rule.attr("opacity", 0); hideTip(); });
  }

  // ── region small-multiples (sorted cleanest first) ───
  function renderRegions(g) {
    const NAME = { NSW1: "NSW", VIC1: "VIC", QLD1: "QLD", SA1: "SA", TAS1: "TAS" };
    const regions = g.regions.slice().sort((a, b) => a.carbon_intensity - b.carbon_intensity);
    const sel = d3.select("#regions").selectAll(".region").data(regions).join("div").attr("class", "region");
    sel.html(r => {
      const total = d3.sum(r.mix, d => d.mw) || 1;
      const ordered = r.mix.slice().sort((a, b) =>
        FUELS.findIndex(f => f.key === a.fuel) - FUELS.findIndex(f => f.key === b.fuel));
      const bands = ordered.map(d =>
        `<span style="width:${100 * d.mw / total}%;background:${COLOR[d.fuel]}" title="${LABEL[d.fuel]} ${fMW(d.mw)} MW"></span>`).join("");
      return `
        <div class="rname">${NAME[r.region] || r.region}</div>
        <div class="rci" style="color:${ciColor(r.carbon_intensity)}">${fInt(r.carbon_intensity)}<span class="u"> g/kWh</span></div>
        <div class="rren">${r.renewable_pct}% renewable</div>
        <div class="rmix">${bands}</div>`;
    });
  }

  // ── history line with metric toggle ──────────────────
  function renderHistory(h) {
    const META = {
      carbon_intensity: { label: "Carbon intensity", unit: " g/kWh", color: "#9c5a3a", fmt: fInt },
      renewable_pct:    { label: "Renewable share", unit: "%", color: "#3a9d8c", fmt: d3.format(".0f") },
      coal_pct:         { label: "Coal share", unit: "%", color: "#3f3a34", fmt: d3.format(".0f") },
      avg_price:        { label: "Avg price", unit: " $/MWh", color: "#c77d3a", fmt: d => "$" + fInt(d) },
    };
    const days = h.days.filter(d => d.carbon_intensity != null)
      .map(d => ({ ...d, date: new Date(d.date) }));
    let metric = "carbon_intensity";

    const W = 1040, H = 300, m = { t: 12, r: 16, b: 26, l: 48 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const svg = freshSvg("#history", W, H);
    const gp = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const x = d3.scaleTime().domain(d3.extent(days, d => d.date)).range([0, iw]);
    const y = d3.scaleLinear().range([ih, 0]);
    const gGrid = gp.append("g").attr("class", "gridline");
    const gArea = gp.append("path");
    const gLine = gp.append("path").attr("fill", "none").attr("stroke-width", 2);
    const gxAxis = gp.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`);
    const gyAxis = gp.append("g").attr("class", "axis");
    const focus = gp.append("circle").attr("r", 4).attr("opacity", 0);

    function draw() {
      const M = META[metric];
      const vals = days.map(d => d[metric]);
      const lo = metric === "carbon_intensity" || metric === "renewable_pct" || metric === "coal_pct"
        ? 0 : d3.min(vals) * 0.9;
      y.domain([lo, d3.max(vals) * 1.08]).nice();
      gGrid.call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
      gxAxis.call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%-d %b")));
      gyAxis.transition().duration(350).call(d3.axisLeft(y).ticks(5).tickFormat(M.fmt));

      const line = d3.line().x(d => x(d.date)).y(d => y(d[metric])).curve(d3.curveMonotoneX);
      const area = d3.area().x(d => x(d.date)).y0(ih).y1(d => y(d[metric])).curve(d3.curveMonotoneX);
      gLine.datum(days).transition().duration(350).attr("stroke", M.color).attr("d", line);
      gArea.datum(days).transition().duration(350)
        .attr("fill", M.color).attr("opacity", .10).attr("d", area);
      focus.attr("fill", M.color);
    }

    const bisect = d3.bisector(d => d.date).center;
    gp.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
      .on("mousemove", function (e) {
        const d = days[bisect(days, x.invert(d3.pointer(e, this)[0]))];
        const M = META[metric];
        focus.attr("opacity", 1).attr("cx", x(d.date)).attr("cy", y(d[metric]));
        showTip(`<b>${d3.timeFormat("%a %-d %b")(d.date)}</b><br>${M.label}: ${M.fmt(d[metric])}${M.unit}`, e);
      })
      .on("mouseleave", () => { focus.attr("opacity", 0); hideTip(); });

    d3.selectAll("#histtoggle button").on("click", function () {
      d3.selectAll("#histtoggle button").classed("on", false);
      d3.select(this).classed("on", true);
      metric = this.dataset.metric;
      draw();
    });
    draw();
  }

  // latest-day API CI vs live estimate
  function crossCheck(g, h) {
    const last = h.days.filter(d => d.carbon_intensity != null).at(-1);
    if (!last) return;
    const err = Math.abs(g.carbon_intensity - last.carbon_intensity) / last.carbon_intensity * 100;
    document.getElementById("xcheck").textContent = err.toFixed(0) + "%";
  }

  function freshSvg(sel, W, H) {
    d3.select(sel).select("svg").remove();
    return d3.select(sel).append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
  }
})();
