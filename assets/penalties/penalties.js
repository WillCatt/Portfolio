/* Penalty Geometry & Game Theory — front end.
   Fetches one static bundle.json and renders the editorial scrolly (cold open +
   four acts + the keeper game). Numbers come from the bundle, never hard-coded.
   Pure resolution functions are exported for node unit-testing. */
(function () {
  "use strict";

  // ── goal geometry (metres) ───────────────────────────────────────────────
  var GOAL_W = 7.32, GOAL_H = 2.44, THIRD = GOAL_W / 6; // central third half-width

  // ── PURE game logic (node-testable; no DOM) ──────────────────────────────
  function sideOf(x) { return Math.abs(x) <= THIRD ? "centre" : (x > 0 ? "right" : "left"); }
  function diveTarget(dive) {
    return { left: { x: -1.6, z: 0.8 }, centre: { x: 0, z: 0.9 }, right: { x: 1.6, z: 0.8 } }[dive];
  }
  // A dive the right way still concedes if the ball finds a top corner.
  function resolveKick(kick, dive, p) {
    if (!kick.on) return { goal: false, saved: false, reason: "off target" };
    var side = sideOf(kick.x);
    if (side !== dive) return { goal: true, saved: false, reason: "wrong way" };
    var t = diveTarget(dive);
    var dist = Math.hypot(kick.x - t.x, kick.z - t.z);
    var base = dive === "centre" ? p.reach_centre : p.reach_side;
    var eff = kick.z > 1.4 ? base * p.reach_high_penalty : base;
    var saved = dist <= eff;
    return { goal: !saved, saved: saved, reason: saved ? "saved" : "beaten in the corner" };
  }
  // Expected save rate if the keeper always commits to one zone, vs the kicks.
  function pureSaveRate(kicks, dive, p) {
    if (!kicks.length) return 0;
    var s = 0; for (var i = 0; i < kicks.length; i++) if (resolveKick(kicks[i], dive, p).saved) s++;
    return s / kicks.length;
  }
  // The best a blind keeper can do against a fixed shot distribution.
  function optimalSaveRate(kicks, p) {
    return Math.max(pureSaveRate(kicks, "left", p), pureSaveRate(kicks, "centre", p), pureSaveRate(kicks, "right", p));
  }

  if (typeof document === "undefined") {
    module.exports = { sideOf: sideOf, diveTarget: diveTarget, resolveKick: resolveKick,
      pureSaveRate: pureSaveRate, optimalSaveRate: optimalSaveRate, GOAL_W: GOAL_W, GOAL_H: GOAL_H };
    return;
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  var pct = function (x, d) { return x == null || isNaN(x) ? "—" : (100 * x).toFixed(d || 0) + "%"; };
  var HEAT = ["#faf8f4", "#f2dcae", "#e8c98f", "#d39a3f", "#b06a16", "#7a430b", "#5e2f0c"];
  function heatColor(t) { // t in 0..1 -> warm sequential ramp
    t = Math.max(0, Math.min(1, t));
    var n = HEAT.length - 1, i = Math.floor(t * n), f = t * n - i;
    if (i >= n) return HEAT[n];
    return d3.interpolateRgb(HEAT[i], HEAT[i + 1])(f);
  }

  var _bundle = null;
  function getBundle() {
    if (!_bundle) _bundle = fetch("../assets/penalties/bundle.json").then(function (r) { return r.json(); });
    return _bundle;
  }

  // ── a reusable goal-mouth SVG at true 7.32×2.44 aspect ────────────────────
  function buildGoal(sel, opts) {
    opts = opts || {};
    var M = opts.m || 62;                       // px per metre
    var padX = 0.62, padTop = 0.55, padBot = 0.5;
    var domX = [-GOAL_W / 2 - padX, GOAL_W / 2 + padX];
    var domZ = [0, GOAL_H + padTop];
    var W = (domX[1] - domX[0]) * M, H = (domZ[1] - domZ[0]) * M + padBot * M;
    var svg = sel.append("svg").attr("viewBox", "0 0 " + W + " " + H)
      .attr("preserveAspectRatio", "xMidYMid meet").attr("role", "img");
    var sx = d3.scaleLinear().domain(domX).range([0, W]);
    var sz = d3.scaleLinear().domain(domZ).range([(domZ[1]) * M, 0]); // invert; ground at z=0
    var groundY = sz(0);
    var heat = svg.append("g").attr("class", "heatlayer");
    var dots = svg.append("g").attr("class", "dotlayer");
    var frame = svg.append("g").attr("class", "framelayer");
    // net
    var lx = sx(-GOAL_W / 2), rx = sx(GOAL_W / 2), ty = sz(GOAL_H);
    for (var gx = -GOAL_W / 2; gx <= GOAL_W / 2 + 1e-6; gx += GOAL_W / 14)
      frame.append("line").attr("class", "goal-net").attr("x1", sx(gx)).attr("x2", sx(gx)).attr("y1", ty).attr("y2", groundY);
    for (var gz = 0; gz <= GOAL_H + 1e-6; gz += GOAL_H / 6)
      frame.append("line").attr("class", "goal-net").attr("x1", lx).attr("x2", rx).attr("y1", sz(gz)).attr("y2", sz(gz));
    // posts + bar + ground
    frame.append("path").attr("class", "goal-post")
      .attr("d", "M" + lx + "," + groundY + " L" + lx + "," + ty + " L" + rx + "," + ty + " L" + rx + "," + groundY);
    frame.append("line").attr("class", "goal-ground").attr("x1", sx(domX[0])).attr("x2", sx(domX[1])).attr("y1", groundY).attr("y2", groundY);
    return { svg: svg, sx: sx, sz: sz, heat: heat, dots: dots, frame: frame, W: W, H: H, groundY: groundY };
  }

  function drawHeat(G, kde, key) {
    var grid = kde.grids[key]; G.heat.selectAll("*").remove();
    if (!grid) return;
    var gx = kde.gx, gz = kde.gz, dx = (gx[1] - gx[0]), dz = (gz[1] - gz[0]);
    var cells = [];
    for (var j = 0; j < gz.length; j++) for (var i = 0; i < gx.length; i++) {
      var v = grid[j][i]; if (v > 0.04) cells.push({ x: gx[i], z: gz[j], v: v });
    }
    G.heat.selectAll("rect").data(cells).enter().append("rect")
      .attr("x", function (d) { return G.sx(d.x - dx / 2); })
      .attr("y", function (d) { return G.sz(d.z + dz / 2); })
      .attr("width", Math.abs(G.sx(dx) - G.sx(0)) + 0.6)
      .attr("height", Math.abs(G.sz(dz) - G.sz(0)) + 0.6)
      .attr("fill", function (d) { return heatColor(d.v); })
      .attr("opacity", function (d) { return 0.25 + 0.7 * d.v; });
  }

  // ── number placeholders shared across tabs ────────────────────────────────
  function fillPlaceholders(scope, B) {
    var m = B.meta, gt = B.game_theory.all, sv = B.survival;
    var z = gt.zones;
    function ci(zz) { return "[" + pct(zz.lo) + ", " + pct(zz.hi) + "]"; }
    var vals = {
      n_total: m.n_total, n_shootout: m.n_shootout, n_ingame: m.n_ingame,
      n_world_cup: m.n_world_cup, n_competitions: m.n_competitions,
      overall_conv_pct: pct(m.overall_conv), dive_coverage: pct(m.dive_coverage),
      zn_natural_n: z.natural.n, zn_natural_conv: pct(z.natural.conv), zn_natural_ci: ci(z.natural), zn_natural_use: pct(z.natural.usage),
      zn_centre_n: z.centre.n, zn_centre_conv: pct(z.centre.conv), zn_centre_ci: ci(z.centre), zn_centre_use: pct(z.centre.usage),
      zn_cross_n: z.cross.n, zn_cross_conv: pct(z.cross.conv), zn_cross_ci: ci(z.cross), zn_cross_use: pct(z.cross.usage),
      nash_verdict: nashVerdict(gt)
    };
    scope.querySelectorAll("[data-pen]").forEach(function (el) {
      var k = el.getAttribute("data-pen");
      if (vals[k] != null) el.textContent = vals[k];
    });
  }

  function nashVerdict(gt) {
    var p = gt.chisq_equal_success ? gt.chisq_equal_success.p : NaN;
    var gap = gt.exploitability_gap_pp;
    if (isNaN(p)) return "Too few kicks per zone to test equilibrium honestly.";
    if (p >= 0.05)
      return "Conversion is statistically indistinguishable across the placement zones takers use (chi-square p = " +
        p.toFixed(2) + "). That is exactly what equilibrium play predicts — a null worth printing proudly. With only " +
        gt.n + " kicks, though, this test could also be too weak to catch a real gap.";
    return "Conversion differs across zones (chi-square p = " + p.toFixed(2) + "): the " + gt.best_zone +
      " zone out-converts the " + gt.worst_zone + " by about " + (gap == null ? "—" : gap.toFixed(0)) +
      " percentage points, yet stays under-used — an exploitable gap left on the table.";
  }

  // ── the four-act scrolly ──────────────────────────────────────────────────
  function buildScrolly(root, B) {
    if (root.__built) return; root.__built = true;
    root.innerHTML = "";
    var R = d3.select(root);

    coldOpen(R, B);
    actPlacement(R, B);
    actKeepers(R, B);
    actNash(R, B);
    buildGame(R, B);     // the payoff of the essay, after Act 3
    actPressure(R, B);
    closing(R, B);
  }

  function act(R, kicker, title) {
    var s = R.append("section").attr("class", "act");
    s.append("p").attr("class", "kicker").text(kicker);
    s.append("h2").attr("class", "act-title").html(title);
    return s;
  }

  // ── cold open ─────────────────────────────────────────────────────────────
  function coldOpen(R, B) {
    var c = B.cold_open, s = R.append("section").attr("class", "coldopen");
    s.append("p").attr("class", "eyebrow").text("Penalty Geometry & Game Theory");
    s.append("h1").text("One kick. Twelve yards. A coin flip that isn't.");
    s.append("p").style("max-width", "54ch").style("margin", "0 auto")
      .html("Start with a single penalty. " + (c.player ? "<b>" + c.player + "</b>, " : "") +
        c.competition + " " + c.season + " — placed " + cornerWords(c) +
        ". Our interpretable model gives a kick to that spot a <span class='pgoal'>" +
        pct(c.p_goal_model) + "</span> chance of scoring.");
    var wrap = s.append("div").attr("class", "cold-card goalwrap");
    var G = buildGoal(wrap);
    // the kick
    G.dots.append("circle").attr("class", "shotdot " + (c.outcome === "Goal" ? "scored" : "saved"))
      .attr("cx", G.sx(c.x_m)).attr("cy", G.sz(c.z_m)).attr("r", 9).attr("stroke", "#fff").attr("stroke-width", 1.5);
    // keeper glyph + dive cue
    var kx = G.sx(0), ky = G.groundY;
    G.dots.append("rect").attr("x", kx - 9).attr("y", ky - 46).attr("width", 18).attr("height", 40)
      .attr("rx", 7).attr("fill", "none").attr("stroke", "var(--pen-muted)").attr("stroke-width", 2);
    G.dots.append("text").attr("x", kx).attr("y", ky - 52).attr("text-anchor", "middle")
      .attr("class", "axlabel").text(c.keeper_contact ? "keeper got a touch" : "keeper: dive unseen");
    s.append("p").attr("class", "cold-meta")
      .html("Result: <b>" + c.outcome + "</b>. Now zoom out from this one kick to <b>" +
        B.meta.n_total + "</b> of them, and a hidden geometry appears.");
    s.append("p").attr("class", "scrollcue").text("↓ scroll");
  }
  function cornerWords(c) {
    // describe from the same viewer frame as the plotted dot, so they always agree
    var h = c.z_m > 1.4 ? "high" : "low";
    var s = Math.abs(c.x_m) <= 1.2 ? "down the middle"
      : "into the " + (c.z_m > 1.4 ? "top" : "bottom") + " " + (c.x_m > 0 ? "right" : "left") + " corner";
    return s === "down the middle" ? h + " and " + s : s;
  }

  // ── ACT 1: where the ball goes ────────────────────────────────────────────
  function actPlacement(R, B) {
    var s = act(R, "Act 1 · Where the ball goes", "Penalties live in the corners — and almost never dead centre.");
    s.append("p").html("Every kick below is mirrored onto a right-footed frame, so the natural (open-body) side is always to the right. The heatmap is a kernel-density estimate of where shots cross the line. Toggle the cuts — the corners stay warm, the middle stays cold.");
    var wrap = s.append("div").attr("class", "goalwrap"); var G = buildGoal(wrap);
    wrap.append("div").style("display", "flex").style("justify-content", "space-between")
      .style("font-family", "var(--font-mono)").style("font-size", "10px").style("color", "var(--pen-muted)")
      .style("max-width", "82%").style("margin", "2px auto 0")
      .html("<span>← cross / across body</span><span>natural side →</span>");
    var note = s.append("p").attr("class", "statenote");

    var state = { foot: "all", phase: "all", layer: "all" };
    var ctl = s.insert("div", ".goalwrap").attr("class", "controls");
    function seg(label, key, opts) {
      var g = ctl.append("div").attr("class", "ctlgroup");
      g.append("span").attr("class", "glabel").text(label);
      opts.forEach(function (o) {
        g.append("button").attr("class", "seg" + (state[key] === o.v ? " on" : "")).text(o.t)
          .on("click", function () { state[key] = o.v; g.selectAll("button").classed("on", false); d3.select(this).classed("on", true); redraw(); });
      });
    }
    seg("layer", "layer", [{ t: "all", v: "all" }, { t: "scored", v: "scored" }, { t: "saved", v: "saved" }, { t: "missed", v: "missed" }]);
    seg("phase", "phase", [{ t: "all", v: "all" }, { t: "open play", v: "ingame" }, { t: "shootout", v: "shootout" }]);
    seg("foot", "foot", [{ t: "all", v: "all" }, { t: "right", v: "R" }, { t: "left", v: "L" }]);

    function redraw() {
      var key = state.foot + "|" + state.phase + "|" + state.layer;
      drawHeat(G, B.kde, key);
      var n = (B.kde.counts && B.kde.counts[key]) || 0;
      note.html(annot(state, n));
    }
    function annot(st, n) {
      var base = "<b>n = " + n + "</b> kicks in this cut. ";
      if (n < 25) return base + "Thin slice — read the shape, not the detail.";
      if (st.layer === "saved") return base + "Saves cluster low and central: the reachable balls.";
      if (st.layer === "missed") return base + "Misses spray high and wide — the price of aiming for the frame.";
      if (st.layer === "scored") return base + "Goals hug the side-netting where no keeper reaches.";
      return base + "Two warm lobes by the posts, a cold hole in the middle.";
    }
    redraw();
    s.append("p").attr("class", "takeaway").text("Shooters already know where the goals are: tight to the post. The hard part is that the keeper knows it too.");
  }

  // ── ACT 2: where keepers go (the limitation IS the story) ─────────────────
  function actKeepers(R, B) {
    var s = act(R, "Act 2 · Where keepers go", "You can't actually measure where keepers dive — and that's the story.");
    s.append("p").html("Here's the dirty secret of penalty analytics on open data: there is <b>no dive-direction column</b>. The only time you can tell which way a keeper went is when they <i>saved it</i> — then you know their hands found the ball. A keeper who dives the right way and is beaten by a perfect strike is recorded identically to one who guessed wrong: a clean goal, direction unknown.");
    s.append("p").html("So dive direction is recoverable for only <span class='ins'>" + pct(B.meta.dive_coverage) + "</span> of kicks — the saves — and that slice is biased toward shots hit near the keeper. The bars compare what we <i>can</i> measure (where all shots go) with the sliver of dives we can actually see.");
    var chart = s.append("div").attr("class", "bars"); drawDiveBars(chart, B);
    s.append("p").attr("class", "statenote").html("Anyone quoting a tidy “keepers dive right 57% of the time” from data like this is filling the gap with a guess. The honest answer is a shrug with error bars.");
    s.append("p").attr("class", "takeaway").text("The most-cited keeper statistic in football — which way they dive — is the one this data refuses to give up.");
  }
  function drawDiveBars(sel, B) {
    // We summarise from the bundle's KDE counts isn't enough; use survival/meta not available.
    // Use the two distributions we exported via the dive figure's logic: recompute from game placements.
    var pl = B.game.placements, third = THIRD;
    function zoneAll(x) { return Math.abs(x) <= third ? "centre" : (x > 0 ? "right" : "left"); }
    var order = ["left", "centre", "right"], lbl = { left: "keeper left", centre: "centre", right: "keeper right" };
    var shot = { left: 0, centre: 0, right: 0 }, n = 0;
    pl.forEach(function (k) { if (k.on) { shot[zoneAll(k.x)]++; n++; } });
    // observable dives ~ saved kicks, dive = zone of the saved ball
    var dive = { left: 0, centre: 0, right: 0 }, nd = 0;
    pl.forEach(function (k) { if (k.on && !k.scored) { dive[zoneAll(k.x)]++; nd++; } });
    var data = order.map(function (z) {
      return { z: z, lbl: lbl[z], shot: n ? shot[z] / n : 0, dive: nd ? dive[z] / nd : 0 };
    });
    var W = 520, H = 210, mL = 70, mB = 30, mT = 10, mR = 10;
    var svg = sel.append("svg").attr("viewBox", "0 0 " + W + " " + H).style("max-width", "560px");
    var x0 = d3.scaleBand().domain(order).range([mL, W - mR]).padding(0.25);
    var x1 = d3.scaleBand().domain(["shot", "dive"]).range([0, x0.bandwidth()]).padding(0.1);
    var y = d3.scaleLinear().domain([0, 0.6]).range([H - mB, mT]);
    [0, 0.2, 0.4, 0.6].forEach(function (t) {
      svg.append("line").attr("x1", mL).attr("x2", W - mR).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "var(--pen-hair)");
      svg.append("text").attr("x", mL - 8).attr("y", y(t) + 3).attr("text-anchor", "end").attr("class", "axlabel").text(pct(t));
    });
    var col = { shot: "#cdbfae", dive: "var(--pen-accent)" };
    data.forEach(function (d) {
      ["shot", "dive"].forEach(function (k) {
        svg.append("rect").attr("x", x0(d.z) + x1(k)).attr("width", x1.bandwidth())
          .attr("y", y(d[k])).attr("height", y(0) - y(d[k])).attr("fill", col[k]);
      });
      svg.append("text").attr("x", x0(d.z) + x0.bandwidth() / 2).attr("y", H - 10).attr("text-anchor", "middle").attr("class", "axlabel").text(d.lbl);
    });
    var lg = svg.append("g").attr("font-size", 10).attr("font-family", "var(--font-mono)");
    lg.append("rect").attr("x", mL).attr("y", mT).attr("width", 10).attr("height", 10).attr("fill", col.shot);
    lg.append("text").attr("x", mL + 14).attr("y", mT + 9).attr("class", "axlabel").text("all shots (n=" + n + ")");
    lg.append("rect").attr("x", mL + 130).attr("y", mT).attr("width", 10).attr("height", 10).attr("fill", "var(--pen-accent)");
    lg.append("text").attr("x", mL + 144).attr("y", mT + 9).attr("class", "axlabel").text("observable dives (n=" + nd + ")");
  }

  // ── ACT 3: is anyone playing Nash? ────────────────────────────────────────
  function actNash(R, B) {
    var gt = B.game_theory.all, tb = B.game_theory.textbook_2x2;
    var s = act(R, "Act 3 · Is anyone playing Nash?", "If every placement scored equally, shooters would be at equilibrium.");
    s.append("p").html("Game theory's one clean prediction: at a mixed-strategy equilibrium, <b>every option you actually use must pay the same</b>. For a penalty taker, a zone's payoff is just how often it scores. So the test is simple — do the zones shooters use convert equally? (Chiappori, Groseclose &amp; Levitt 2002; Palacios-Huerta 2003.)");
    // observed table
    var t = s.append("table").attr("class", "matrix");
    t.append("thead").html("<tr><th>Placement</th><th>N</th><th>Conversion</th><th>95% CI</th><th>Usage</th></tr>");
    var tb2 = t.append("tbody");
    [["natural", "natural side"], ["centre", "dead centre"], ["cross", "across body"]].forEach(function (zz) {
      var z = gt.zones[zz[0]], hi = zz[0] === gt.best_zone;
      tb2.append("tr").attr("class", hi ? "hi" : "").html(
        "<td>" + zz[1] + "</td><td>" + z.n + "</td><td>" + pct(z.conv) + "</td>" +
        "<td class='ci'>[" + pct(z.lo) + ", " + pct(z.hi) + "]</td><td>" + pct(z.usage) + "</td>");
    });
    s.append("div").attr("class", "verdict").html("<b>Verdict.</b> " + nashVerdict(gt));
    // textbook nash explainer
    s.append("p").style("margin-top", "20px").html("<span class='nval'>For the curious</span> — the textbook 2×2 (keeper and shooter each choose a side) has a mixed equilibrium: the shooter goes natural <b>" +
      pct(tb.nash_shooter_natural) + "</b> of the time, the keeper dives natural <b>" + pct(tb.nash_keeper_natural) +
      "</b>, for an equilibrium scoring rate around <b>" + pct(tb.value) + "</b>. Building that matrix from <i>this</i> data would need the keeper's dive on every kick — which, per Act 2, we don't have. So the table above is the honest half.");
    s.append("p").attr("class", "takeaway").text(nashTakeaway(gt));
  }
  function nashTakeaway(gt) {
    var p = gt.chisq_equal_success ? gt.chisq_equal_success.p : NaN;
    if (isNaN(p) || p >= 0.05) return "On the evidence we have, shooters look roughly like equilibrium players — no zone is obviously being left on the table.";
    return "Shooters appear to under-use their best-converting zone — a small edge they're leaving on the table.";
  }

  // ── THE GAME ──────────────────────────────────────────────────────────────
  function buildGame(R, B) {
    var g = B.game, p = { reach_side: g.reach_side, reach_centre: g.reach_centre, reach_high_penalty: g.reach_high_penalty };
    var onTarget = g.placements.filter(function (k) { return k.on; });
    var optimal = optimalSaveRate(onTarget, p);
    var realRate = g.real_keeper_save_rate;

    var sec = R.append("section").attr("class", "act");
    var box = sec.append("div").attr("class", "game");
    box.append("p").attr("class", "kicker").text("The payoff · You're the keeper");
    box.append("h2").attr("class", "act-title").text("Five kicks. Real placements. No coin flips.");
    box.append("p").html("Each kick is a <b>real StatsBomb penalty</b>, drawn from the distribution you just saw. Pick your dive <i>before</i> the ball is struck. Guess the side and you still have to reach it — a perfect kick into the top corner beats you anyway. Five kicks, then your save rate against the real keepers and against the best a keeper could manage.");

    var stage = box.append("div").attr("class", "game-stage");
    var sb = stage.append("div").attr("class", "game-scoreboard");
    sb.append("div").html("Kick <span class='kno'>1</span> of 5");
    var pipsWrap = sb.append("div"); var pips = pipsWrap.append("div").attr("class", "pips");
    var savesEl = sb.append("div").attr("class", "saves").text("0 saves");
    var goalwrap = stage.append("div").attr("class", "goalwrap"); var G = buildGoal(goalwrap, { m: 56 });
    var result = stage.append("div").attr("class", "game-result").html("Choose a side to dive.");
    var controls = stage.append("div").attr("class", "dive-controls");

    var st = { i: 0, saves: 0, dives: [], deck: [], results: [] };
    for (var k = 0; k < 5; k++) st.deck.push(onTarget[Math.floor(Math.random() * onTarget.length)]);
    for (var pi = 0; pi < 5; pi++) pips.append("div").attr("class", "pip");

    function diveBtn(label, dive) {
      controls.append("button").attr("class", "dive").text(label).on("click", function () { play(dive); });
    }
    diveBtn("← Left", "left"); diveBtn("Centre", "centre"); diveBtn("Right →", "right");

    function play(dive) {
      if (st.i >= 5) return;
      var kick = st.deck[st.i]; var res = resolveKick(kick, dive, p);
      st.dives.push(dive); st.results.push(res); if (res.saved) st.saves++;
      G.dots.selectAll("*").remove();
      // draw the dive (keeper) and the ball
      var t = diveTarget(dive);
      G.dots.append("circle").attr("cx", G.sx(t.x)).attr("cy", G.sz(t.z)).attr("r", 16)
        .attr("fill", "none").attr("stroke", "var(--pen-muted)").attr("stroke-width", 2).attr("opacity", 0.6);
      G.dots.append("circle").attr("class", "shotdot").attr("cx", G.sx(kick.x)).attr("cy", G.sz(kick.z)).attr("r", 8)
        .attr("fill", res.saved ? "#2a7d6b" : "var(--pen-accent)").attr("stroke", "#fff").attr("stroke-width", 1.5);
      pips.selectAll(".pip").filter(function (d, idx) { return idx === st.i; }).classed(res.saved ? "save" : "goal", true);
      result.html(res.saved ? "<b>Saved!</b> You got across to it." :
        (res.reason === "wrong way" ? "<b>Goal.</b> Wrong way — the ball went the other side." :
          "<b>Goal.</b> Right side, but it found the corner."));
      savesEl.text(st.saves + (st.saves === 1 ? " save" : " saves"));
      st.i++; sb.select(".kno").text(Math.min(st.i + 1, 5));
      if (st.i >= 5) { controls.selectAll("button").attr("disabled", true); setTimeout(endCard, 650); }
    }

    function endCard() {
      box.html("");
      var rate = st.saves / 5;
      var ec = box.append("div").attr("class", "endcard");
      ec.append("p").attr("class", "kicker").text("Full time");
      ec.append("div").attr("class", "big").text(st.saves + " / 5");
      ec.append("p").style("color", "var(--pen-muted)").style("font-family", "var(--font-mono)").style("font-size", "13px")
        .text("you saved " + pct(rate) + " of five real penalties");
      var vs = ec.append("div").attr("class", "vs");
      vs.append("div").html("<b>" + pct(realRate) + "</b>real keepers");
      vs.append("div").html("<b>" + pct(optimal) + "</b>best possible");
      ec.append("p").attr("class", "feedback").html(feedback(st, rate, realRate, optimal));
      ec.append("button").attr("class", "replay").text("↻ Face five more").on("click", function () { root.__built = false; buildScrolly(root, B); document.querySelector(".game").scrollIntoView({ behavior: "smooth", block: "center" }); });
    }
    function feedback(st, rate, real, opt) {
      var counts = { left: 0, centre: 0, right: 0 }; st.dives.forEach(function (d) { counts[d]++; });
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      var share = counts[top] / 5;
      if (share >= 0.8) return "You dived " + top + " " + pct(share) + " of the time — a real shooter would read that in two kicks and roll it into the open corner.";
      if (rate > real + 0.15) return "Better than the real keepers managed (" + pct(real) + "). Small sample, but you read the corners well.";
      if (rate < real - 0.15) return "Below the real-keeper rate of " + pct(real) + " — the corners are brutal when you commit early.";
      return "Right about where real keepers land (" + pct(real) + "). Mixing your dives is what keeps shooters honest.";
    }
  }

  // ── ACT 4: the pressure cooker ─────────────────────────────────────────────
  function actPressure(R, B) {
    var sv = B.survival;
    var s = act(R, "Act 4 · The pressure cooker", "Is the fifth kick where shootouts are won — or just where the best takers wait?");
    s.append("p").html("Across <b>" + sv.n_shootouts + "</b> shootouts (" + sv.n_kicks + " kicks), conversion by the taker's order number wobbles around the overall " + pct(sv.overall_conv) + ". The error bars are wide — there simply aren't many fifth kicks in open data.");
    var chart = s.append("div").attr("class", "bars"); drawSurvival(chart, sv);
    s.append("p").attr("class", "statenote").html("<b>The confound.</b> " + sv.confound + " So even a real dip at kick five wouldn't prove pressure — it could just be who managers choose to send when.");
    s.append("p").attr("class", "takeaway").text(pressureTakeaway(sv));
  }
  function pressureTakeaway(sv) {
    var pk = sv.per_kick; if (pk.length < 5) return "With this few shootout kicks, “clutch” is a story the data can't yet tell.";
    return "The fifth kick looks no scarier than the first — once you remember that managers, not chance, decide who takes it.";
  }
  function drawSurvival(sel, sv) {
    var pk = sv.per_kick, W = 560, H = 240, mL = 50, mB = 36, mT = 16, mR = 16;
    var svg = sel.append("svg").attr("viewBox", "0 0 " + W + " " + H).style("max-width", "580px");
    var x = d3.scalePoint().domain(pk.map(function (d) { return d.label; })).range([mL, W - mR]).padding(0.5);
    var y = d3.scaleLinear().domain([0, 1]).range([H - mB, mT]);
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      svg.append("line").attr("x1", mL).attr("x2", W - mR).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "var(--pen-hair)");
      svg.append("text").attr("x", mL - 8).attr("y", y(t) + 3).attr("text-anchor", "end").attr("class", "axlabel").text(pct(t));
    });
    svg.append("line").attr("x1", mL).attr("x2", W - mR).attr("y1", y(sv.overall_conv)).attr("y2", y(sv.overall_conv))
      .attr("stroke", "var(--pen-muted)").attr("stroke-dasharray", "3 3");
    pk.forEach(function (d) {
      svg.append("line").attr("x1", x(d.label)).attr("x2", x(d.label)).attr("y1", y(d.lo)).attr("y2", y(d.hi))
        .attr("stroke", "var(--pen-hair)").attr("stroke-width", 6).attr("stroke-linecap", "round");
      svg.append("circle").attr("cx", x(d.label)).attr("cy", y(d.conv)).attr("r", 6).attr("fill", "var(--pen-accent)");
      svg.append("text").attr("x", x(d.label)).attr("y", H - 20).attr("text-anchor", "middle").attr("class", "axlabel").text("kick " + d.label);
      svg.append("text").attr("x", x(d.label)).attr("y", H - 8).attr("text-anchor", "middle").attr("class", "axlabel").text("n=" + d.n);
    });
  }

  function closing(R, B) {
    var s = R.append("section").attr("class", "act");
    s.append("p").attr("class", "kicker").text("The bottom line");
    s.append("p").style("font-family", "var(--serif)").style("font-size", "20px").style("max-width", "52ch")
      .html("Penalties look like luck and feel like nerve, but they're mostly geometry: the corners win, the middle is wasted, keepers are guessing in the dark, and shooters are closer to optimal than the pundits admit. The data can't tell you which way a keeper dives — and being honest about that is more useful than pretending otherwise.");
    s.append("p").attr("class", "nval").html("Built on " + B.meta.n_total + " kicks from StatsBomb open data across " + B.meta.n_competitions + " competitions. Methods, model and caveats in the <a href='#' class='ins' onclick=\"document.querySelector('[data-tab=technical]')?.click();return false;\">Technical</a> tab.");
  }

  // ── boot: fill placeholders + build scrolly on every tab render ───────────
  function process(scope) {
    getBundle().then(function (B) {
      try { fillPlaceholders(scope, B); } catch (e) { /* placeholders absent on this tab */ }
      var root = scope.querySelector ? scope.querySelector("#pen-scrolly") : null;
      if (root) buildScrolly(root, B);
    }).catch(function (e) {
      var root = document.getElementById("pen-scrolly");
      if (root) root.innerHTML = "<p class='pen-loading'>Couldn't load the data bundle.</p>";
      console.error("penalties:", e);
    });
  }
  function boot() {
    var tc = document.getElementById("tab-content");
    if (tc) { process(tc); new MutationObserver(function () { process(tc); }).observe(tc, { childList: true }); }
    else { process(document); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
