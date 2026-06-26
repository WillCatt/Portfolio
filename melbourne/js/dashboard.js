/* Melbourne Pulse — render the daily snapshot + the sentiment trend.
   Pure client-side: fetch two static JSON files written by the daily Python job. */
(function () {
  "use strict";

  const POS = "#3a8f57", NEU = "#b9ab97", NEG = "#c0533b", AMBER = "#b06a16", MUTED = "#7a6e63";
  const $ = (id) => document.getElementById(id);

  const sentColor = (s) => (s >= 0.05 ? POS : s <= -0.05 ? NEG : NEU);
  const fmtScore = (s) => (s > 0 ? "+" : "") + s.toFixed(2);

  function prettyDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  }

  Promise.all([
    fetch("data/melbourne.json").then((r) => r.json()),
    fetch("data/history.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ])
    .then(([d, history]) => { renderToday(d); renderTrend(history); })
    .catch((err) => {
      $("mood").textContent = "Couldn't load today's data.";
      console.error("[melbourne]", err);
    });

  function renderToday(d) {
    const dig = d.digest || {};
    const s = d.sentiment || {};

    // hero
    $("mood").innerHTML = dig.mood ? `Today the city feels <em>${dig.mood}</em>.` : "—";
    $("asof").textContent = `${prettyDate(d.date)} · updated ${new Date(d.generated_at)
      .toLocaleString("en-AU", { hour: "2-digit", minute: "2-digit" })}`;

    // source status chips
    const platformName = d.platform === "reddit" ? "Reddit" : "Mastodon";
    const labels = { social: platformName, weather: "Weather", events: "Events", news: "Headlines" };
    $("srcrow").innerHTML = Object.entries(d.sources_ok || {})
      .map(([k, ok]) => `<span class="srcchip ${ok ? "on" : "off"}"><span class="s"></span>${labels[k] || k}</span>`)
      .join("");
    const ph = $("posts-head");
    if (ph) ph.textContent = d.platform === "reddit" ? "Top of r/melbourne" : "What Melbourne's posting";

    // digest
    $("d-mood").textContent = dig.mood || "—";
    $("d-body").textContent = dig.digest || "";
    $("d-threads").innerHTML = (dig.threads || []).map((t) => `<li>${esc(t)}</li>`).join("");
    $("d-by").textContent = dig.model && !/^none/.test(dig.model)
      ? `summary by ${dig.model}` : "summary generated locally";

    // sentiment gauge
    const mean = s.mean ?? 0;
    $("g-num").textContent = fmtScore(mean);
    $("g-num").style.color = sentColor(mean);
    $("g-lbl").textContent = s.label ? `${s.label} overall` : "no discussion captured";
    const sh = s.share || { positive: 0, neutral: 0, negative: 0 };
    $("g-bar").innerHTML =
      `<span class="p" style="width:${(sh.positive * 100).toFixed(1)}%"></span>` +
      `<span class="u" style="width:${(sh.neutral * 100).toFixed(1)}%"></span>` +
      `<span class="n" style="width:${(sh.negative * 100).toFixed(1)}%"></span>`;
    $("g-key").innerHTML =
      `<span class="k kp"><b>${pct(sh.positive)}</b> pos</span>` +
      `<span class="k ku"><b>${pct(sh.neutral)}</b> neu</span>` +
      `<span class="k kn"><b>${pct(sh.negative)}</b> neg</span>`;
    $("g-meta").textContent = `${s.n_posts || 0} posts · ${s.n_comments || 0} comments scored`;

    // weather
    const w = d.weather || {};
    if (w.today) {
      $("wx-big").innerHTML = `${w.today.tmax}°<small> / ${w.today.tmin}°</small>`;
      $("wx-label").textContent = w.today.label + " today";
    } else { $("wx-big").textContent = "—"; }
    const rows = [];
    if (w.yesterday) rows.push(`<div>Yesterday <b>${w.yesterday.tmax}° / ${w.yesterday.tmin}°</b>, ${w.yesterday.rain}mm</div>`);
    if (w.air) {
      const band = w.air.band.replace(" ", "");
      rows.push(`<div>Air quality <span class="aqi ${band}">${w.air.band}</span> · PM2.5 ${w.air.pm25}</div>`);
    }
    $("wx-rows").innerHTML = rows.join("");

    // topics
    const tp = d.topics || [];
    $("topics").innerHTML = tp.length
      ? tp.map((t) => `<span class="topic"><span class="tdot" style="background:${sentColor(t.sentiment)}"></span>${esc(t.term)} <span class="tn">${t.threads}×</span></span>`).join("")
      : `<span class="empty">No recurring topics yet — needs the social feed.</span>`;

    // posts
    const posts = d.posts || [];
    $("posts").innerHTML = posts.length
      ? posts.map((p) => `<li><span class="pscore">▲ ${p.score}</span>` +
          `<a class="ptitle" href="${p.permalink}" target="_blank" rel="noopener">${esc(p.title)}` +
          `<span class="ps" style="background:${sentColor(p.sentiment)}" title="sentiment ${fmtScore(p.sentiment)}"></span></a>` +
          `<span class="pmeta">${p.num_comments} replies</span></li>`).join("")
      : `<li class="empty">No posts captured yet — the morning run fills this in.</li>`;

    // events
    const ev = d.events || { configured: false, list: [] };
    $("events").innerHTML = ev.list && ev.list.length
      ? ev.list.map((e) => `<li><a href="${e.url}" target="_blank" rel="noopener">${esc(e.name)}</a>` +
          `<div class="meta">${esc(e.venue)}${e.date ? " · " + e.date : ""}</div></li>`).join("")
      : `<li class="empty">${ev.configured ? "Nothing listed right now." : "Events feed not configured."}</li>`;

    // news
    const news = d.news || [];
    $("news").innerHTML = news.length
      ? news.map((n) => `<li><a href="${n.url}" target="_blank" rel="noopener">${esc(n.title)}</a> <span class="meta">${esc(n.source)}</span></li>`).join("")
      : `<li class="empty">No local headlines matched today.</li>`;
  }

  function renderTrend(history) {
    const svg = d3.select("#trend");
    const W = 1000, H = 320, m = { t: 24, r: 54, b: 36, l: 44 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const data = (history || []).filter((r) => r.sentiment_mean != null)
      .map((r) => ({ ...r, d: new Date(r.date + "T00:00:00") }));

    if (data.length === 0) {
      $("trend-cap").textContent = "The trend chart begins once the first daily run lands.";
      return;
    }

    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const x = d3.scaleTime()
      .domain(data.length > 1 ? d3.extent(data, (r) => r.d)
        : [d3.timeDay.offset(data[0].d, -1), d3.timeDay.offset(data[0].d, 1)])
      .range([0, iw]);
    const ext = d3.extent(data, (r) => r.sentiment_mean);
    const pad = Math.max(0.1, (ext[1] - ext[0]) * 0.4);
    const y = d3.scaleLinear().domain([Math.min(ext[0] - pad, -0.2), Math.max(ext[1] + pad, 0.2)]).range([ih, 0]);

    // temp overlay axis (right)
    const temps = data.filter((r) => r.temp_max != null);
    const yT = d3.scaleLinear()
      .domain([d3.min(temps, (r) => r.temp_min) - 2 || 0, d3.max(temps, (r) => r.temp_max) + 2 || 30])
      .range([ih, 0]);

    // zero baseline
    g.append("line").attr("class", "zero-line").attr("x1", 0).attr("x2", iw)
      .attr("y1", y(0)).attr("y2", y(0));

    // axes
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(Math.min(data.length, 7)).tickFormat(d3.timeFormat("%-d %b")));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("+.1f")));
    if (temps.length > 1) {
      g.append("g").attr("class", "axis").attr("transform", `translate(${iw},0)`)
        .call(d3.axisRight(yT).ticks(4).tickFormat((v) => v + "°"));
      const tline = d3.line().x((r) => x(r.d)).y((r) => yT(r.temp_max)).curve(d3.curveMonotoneX);
      g.append("path").datum(temps).attr("fill", "none").attr("stroke", AMBER)
        .attr("stroke-width", 1.2).attr("stroke-dasharray", "2 4").attr("opacity", 0.55).attr("d", tline);
      g.append("text").attr("x", iw).attr("y", -8).attr("text-anchor", "end")
        .attr("fill", AMBER).attr("opacity", 0.7).attr("font-size", 10).text("max temp °C");
    }

    if (data.length > 1) {
      const area = d3.area().x((r) => x(r.d)).y0(y(0)).y1((r) => y(r.sentiment_mean)).curve(d3.curveMonotoneX);
      const line = d3.line().x((r) => x(r.d)).y((r) => y(r.sentiment_mean)).curve(d3.curveMonotoneX);
      g.append("path").datum(data).attr("fill", POS).attr("opacity", 0.08).attr("d", area);
      g.append("path").datum(data).attr("fill", "none").attr("stroke", "#2f6f9f")
        .attr("stroke-width", 2).attr("d", line);
    }
    g.selectAll(".pt").data(data).enter().append("circle")
      .attr("cx", (r) => x(r.d)).attr("cy", (r) => y(r.sentiment_mean)).attr("r", 4)
      .attr("fill", (r) => sentColor(r.sentiment_mean)).attr("stroke", "#fffdfa").attr("stroke-width", 1.5)
      .append("title").text((r) => `${r.date}: ${fmtScore(r.sentiment_mean)} (${r.n_units} units)`);

    $("trend-cap").innerHTML = data.length > 1
      ? `<strong>${data.length} days</strong> of mood so far. The dashed amber line is the day's max temperature — watch for the wet-and-grumpy correlation as the record grows.`
      : `Day one. One point so far — the line fills in with each morning's run.`;
  }

  const pct = (x) => Math.round((x || 0) * 100) + "%";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
})();
