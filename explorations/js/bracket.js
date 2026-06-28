/* Bracket — hub piece 11. Fetch one static bracket.json (built + simulated by
   mlfootball/bracket.py) and draw the World Cup knockout ladder: every tie read by
   the frozen Dixon-Coles model, the whole draw Monte-Carlo'd for title odds.
   Two-sided bracket in D3, hub palette, click a tie to open it up. No build step. */
(function () {
  "use strict";

  var INK = "#1a1714", MUTED = "#7a6e63", AMBER = "#b06a16", TEAL = "#2a8f8f";
  var pct = function (x, d) { return x == null || isNaN(x) ? "—" : (100 * x).toFixed(d || 0) + "%"; };

  // All match times shown in AEST (Australia/Brisbane = UTC+10 year-round).
  var AEST = "Australia/Brisbane";
  function _dt(o) { return o.kickoff ? new Date(o.kickoff) : new Date((o.date || "") + "T00:00:00Z"); }
  function aDate(o, opts) { return _dt(o).toLocaleDateString("en-AU", Object.assign({ timeZone: AEST }, opts)); }
  function aTime(o) {
    return o.kickoff ? _dt(o).toLocaleTimeString("en-AU", { timeZone: AEST, hour: "numeric", minute: "2-digit" }).replace(/\s/g, "").toLowerCase() : "";
  }
  function whenLong(o) {
    return aDate(o, { weekday: "short", day: "numeric", month: "short" }) + (o.kickoff ? " · " + aTime(o) + " AEST" : "");
  }

  // Short labels so long names fit a 120px box.
  var NICK = {
    "Bosnia & Herzegovina": "Bosnia", "Bosnia and Herzegovina": "Bosnia",
    "South Africa": "S. Africa", "Saudi Arabia": "Saudi Arabia",
    "United States": "USA", "South Korea": "S. Korea",
    "Ivory Coast": "Ivory Coast", "Cape Verde": "Cape Verde", "DR Congo": "DR Congo"
  };
  function shortName(t) {
    if (!t) return "";
    if (NICK[t]) return NICK[t];
    return t.length > 12 ? t.slice(0, 11) + "…" : t;
  }

  // ── geometry ──────────────────────────────────────────────────────────────
  var BW = 120, BH = 44, STEP = 154, U = 54, TOP = 30;
  var DEPTH = { r32: 0, r16: 1, qf: 2, sf: 3 };
  var RLABEL = { r32: "Round of 32", r16: "Round of 16", qf: "Quarter", sf: "Semi", final: "Final" };

  function refNum(raw) {
    return (raw && (raw[0] === "W" || raw[0] === "L") && /^\d+$/.test(raw.slice(1))) ? +raw.slice(1) : null;
  }

  var STATE = { B: null, sel: null };

  function start(B) {
    STATE.B = B;
    d3.select("#br-asof").text(B.meta.asof);
    fillStats(B);
    drawBracket(B);
    drawRace(B);
    drawTake(B);
    // default selection: the next knockout tie not yet played, else the first
    var allTies = B.rounds.reduce(function (a, r) { return a.concat(r.ties); }, B.third ? [B.third] : []);
    var nextUp = allTies.filter(function (t) { return t.known && !t.played; })
      .sort(function (a, b) { return a.num - b.num; })[0];
    select((nextUp || B.rounds[0].ties[0]).num);
  }

  function fillStats(B) {
    var fav = B.tournament[0], s = d3.select("#stats");
    [{ n: B.meta.n_teams, l: "teams still standing" },
     { n: fav.team + ' <small>' + pct(fav.champ, 0) + "</small>", l: "model's title favourite" },
     { n: (B.meta.sims / 1000) + "k", l: "simulations of the draw" }
    ].forEach(function (c) {
      var d = s.append("div").attr("class", "stat");
      d.append("div").attr("class", "num").html(c.n);
      d.append("div").attr("class", "lbl").text(c.l);
    });
  }

  // ── the bracket board ───────────────────────────────────────────────────────
  function drawBracket(B) {
    var byNum = {};
    B.rounds.forEach(function (r) { r.ties.forEach(function (t) { byNum[t.num] = t; }); });
    var finalTie = B.rounds[B.rounds.length - 1].ties[0];

    // lay out each side by DFS from the final's two semi-final children, so the
    // connectors never cross regardless of feed match-numbering.
    var counter = { L: 0, R: 0 };
    function layout(num, side) {
      var t = byNum[num]; if (!t) return TOP;
      var c0 = refNum(t.home_raw), c1 = refNum(t.away_raw);
      t._side = side; t._depth = DEPTH[t.round];
      if (c0 == null && c1 == null) {            // R32 leaf
        t._y = TOP + U * (counter[side] + 0.5); counter[side]++;
      } else {
        var y0 = layout(c0, side), y1 = layout(c1, side);
        t._y = (y0 + y1) / 2;
      }
      return t._y;
    }
    var sfL = refNum(finalTie.home_raw), sfR = refNum(finalTie.away_raw);
    layout(sfL, "L"); layout(sfR, "R");
    finalTie._side = "C"; finalTie._depth = 4;
    finalTie._y = (byNum[sfL]._y + byNum[sfR]._y) / 2;

    function tieX(t) {
      if (t._side === "C") return 4 * STEP;
      return t._side === "L" ? t._depth * STEP : (8 - t._depth) * STEP;
    }

    var W = 8 * STEP + BW, boardH = TOP + 8 * U;
    var thirdH = B.third ? 86 : 8;
    var H = boardH + thirdH;

    var svg = d3.select("#bracket").html("").append("svg")
      .attr("viewBox", "0 0 " + W + " " + H).attr("width", W).attr("height", H)
      .attr("font-family", "Space Grotesk, sans-serif");

    // round labels (top of each column, both sides)
    ["r32", "r16", "qf", "sf"].forEach(function (k) {
      var d = DEPTH[k];
      [d * STEP, (8 - d) * STEP].forEach(function (x) {
        svg.append("text").attr("class", "br-rlabel").attr("x", x + BW / 2).attr("y", 16).text(RLABEL[k]);
      });
    });
    svg.append("text").attr("class", "br-rlabel").attr("x", 4 * STEP + BW / 2).attr("y", 16).text(RLABEL.final);

    // connectors first (under the boxes)
    var links = svg.append("g");
    B.rounds.forEach(function (r) {
      r.ties.forEach(function (t) {
        if (t.round === "r32") return;
        [refNum(t.home_raw), refNum(t.away_raw)].forEach(function (cn) {
          var c = byNum[cn]; if (!c) return;
          var px = tieX(t), cx = tieX(c), py = t._y, cy = c._y;
          var path;
          if (t._side === "L" || (t._side === "C" && c._side === "L")) {
            var midL = (cx + BW + px) / 2;
            path = "M" + (cx + BW) + "," + cy + " H" + midL + " V" + py + " H" + px;
          } else {
            var midR = (cx + px + BW) / 2;
            path = "M" + cx + "," + cy + " H" + midR + " V" + py + " H" + (px + BW);
          }
          links.append("path").attr("class", "br-link").attr("d", path);
        });
      });
    });

    // tie boxes
    var allTies = B.rounds.reduce(function (a, r) { return a.concat(r.ties); }, []);
    allTies.forEach(function (t) { drawTie(svg, t, tieX(t)); });

    // third-place game, centred under the board
    if (B.third) {
      B.third._side = "C"; B.third._depth = 4; B.third._y = boardH + 50;
      svg.append("text").attr("class", "br-rlabel").attr("x", 4 * STEP + BW / 2)
        .attr("y", boardH + 28).text("3rd place");
      drawTie(svg, B.third, 4 * STEP);
    }
  }

  function teamRow(g, t, y, who, otherWho) {
    var name = t[who], raw = t[who === "home" ? "home_raw" : "away_raw"];
    var adv = t[who === "home" ? "adv_home" : "adv_away"];
    var otherAdv = t[otherWho === "home" ? "adv_home" : "adv_away"];
    var cls = "nm";
    if (!name) { cls += " tbd"; }
    else if (t.played) { cls += (t.winner === name ? " adv" : " out"); }
    else if (adv != null) { cls += (adv >= otherAdv ? " adv" : " out"); }

    g.append("text").attr("class", cls).attr("x", 8).attr("y", y + 4)
      .text(name ? shortName(name) : "Winner " + (raw || "").replace(/^[WL]/, "#"));

    // right-hand value: score if played, else advance %
    if (t.played && t.score) {
      var sc = who === "home" ? t.score[0] : t.score[1];
      g.append("text").attr("class", "sc").attr("x", BW - 8).attr("y", y + 4)
        .attr("text-anchor", "end").text(sc);
    } else if (adv != null) {
      g.append("text").attr("class", "od").attr("x", BW - 8).attr("y", y + 4)
        .attr("text-anchor", "end").text(pct(adv, 0));
    }
  }

  function drawTie(svg, t, x) {
    var g = svg.append("g").attr("class", "tie").attr("transform", "translate(" + x + "," + (t._y - BH / 2) + ")")
      .attr("data-num", t.num);
    if (t.known) g.on("click", function () { select(t.num); });
    // advance meter behind the favourite's row
    if (!t.played && t.adv_home != null) {
      var topAdv = t.adv_home, botAdv = t.adv_away;
      g.append("rect").attr("class", "meter").attr("x", 1).attr("y", 1).attr("width", (BW - 2) * topAdv).attr("height", BH / 2 - 1);
      g.append("rect").attr("class", "meter").attr("x", 1).attr("y", BH / 2).attr("width", (BW - 2) * botAdv).attr("height", BH / 2 - 1);
    }
    g.append("rect").attr("class", "box").attr("width", BW).attr("height", BH).attr("rx", 7);
    g.append("line").attr("class", "divider").attr("x1", 0).attr("y1", BH / 2).attr("x2", BW).attr("y2", BH / 2);
    teamRow(g, t, BH / 4, "home", "away");
    teamRow(g, t, 3 * BH / 4, "away", "home");
  }

  function select(num) {
    STATE.sel = num;
    d3.selectAll(".tie").classed("sel", function () { return +this.getAttribute("data-num") === num; });
    var allTies = STATE.B.rounds.reduce(function (a, r) { return a.concat(r.ties); }, STATE.B.third ? [STATE.B.third] : []);
    var t = allTies.find(function (x) { return x.num === num; });
    if (t) renderCard(t, STATE.B);
  }

  // ── detail card ─────────────────────────────────────────────────────────────
  function renderCard(t, B) {
    var c = d3.select("#br-card").html("");
    if (!t.known) {
      c.append("div").attr("class", "br-empty")
        .html("This tie is still to be decided — the winners of matches " +
          (t.home_raw || "").replace(/^[WL]/, "#") + " and " + (t.away_raw || "").replace(/^[WL]/, "#") +
          " meet here. Pick a tie with both teams known to see the model's read.");
      return;
    }
    var roundName = (B.rounds.concat([{ key: "third" }]).find(function (r) { return r.key === t.round; }) || {});
    var rn = { r32: "Round of 32", r16: "Round of 16", qf: "Quarter-final", sf: "Semi-final", final: "Final", third: "Third-place play-off" }[t.round] || "";

    var h = c.append("div").attr("class", "br-mh");
    h.append("div").attr("class", "tm").text(t.home);
    h.append("div").attr("class", "mid").text("vs");
    h.append("div").attr("class", "tm away").text(t.away);
    c.append("div").attr("class", "br-meta")
      .text(rn + " · " + whenLong(t) + (t.ground ? " · " + t.ground : "") +
        (t.host_edge && t.host_edge.length ? " · " + t.host_edge[0] + " host edge" : ""));

    if (t.played && t.score) {
      var win = t.winner;
      var r = c.append("div").attr("class", "br-result");
      r.append("div").attr("class", "sc").text(t.score[0] + " – " + t.score[1]);
      r.append("div").attr("class", "who").text(win ? win + " go through" : "");
    }

    // advance meter — the knockout headline
    c.append("div").attr("class", "br-seclbl").text(t.played ? "Pre-match: chance of going through" : "Chance of going through");
    var adv = c.append("div").attr("class", "br-adv");
    adv.append("div").attr("class", "h").style("width", (100 * t.adv_home) + "%").text(t.adv_home >= 0.16 ? pct(t.adv_home) : "");
    adv.append("div").attr("class", "a").style("width", (100 * t.adv_away) + "%").text(t.adv_away >= 0.16 ? pct(t.adv_away) : "");
    var al = c.append("div").attr("class", "br-1x2lbl");
    al.append("span").text(t.home); al.append("span").text(t.away);

    // 90-minute 1X2
    c.append("div").attr("class", "br-seclbl").style("margin-top", "14px").text("In 90 minutes (win / draw / win)");
    var bar = c.append("div").attr("class", "br-1x2");
    bar.append("div").attr("class", "h").style("width", (100 * t.p_home) + "%").text(t.p_home >= 0.1 ? pct(t.p_home) : "");
    bar.append("div").attr("class", "d").style("width", (100 * t.p_draw) + "%").text(t.p_draw >= 0.1 ? pct(t.p_draw) : "");
    bar.append("div").attr("class", "a").style("width", (100 * t.p_away) + "%").text(t.p_away >= 0.1 ? pct(t.p_away) : "");

    // xG + top scorelines
    var grid = c.append("div").attr("class", "br-grid2");
    var gx = grid.append("div");
    gx.append("div").attr("class", "br-seclbl").text("Expected goals");
    gx.append("div").attr("class", "br-xg").html(t.home + " <b>" + t.exp_home + "</b><br>" + t.away + " <b>" + t.exp_away + "</b>");
    var gt = grid.append("div");
    gt.append("div").attr("class", "br-seclbl").text("Most likely scores");
    var tops = gt.append("div").attr("class", "br-tops");
    (t.top_scores || []).slice(0, 4).forEach(function (s) {
      var row = tops.append("div").attr("class", "row");
      row.append("span").attr("class", "sc").text(s.h + "–" + s.a);
      row.append("span").attr("class", "pb").text(pct(s.p, 0));
    });

    // how far each side is projected to go
    var probMap = {};
    B.tournament.forEach(function (r) { probMap[r.team] = r; });
    var ph = probMap[t.home], pa = probMap[t.away];
    if (ph && pa) {
      c.append("div").attr("class", "br-deep").html(
        "To lift the trophy — <b>" + t.home + " " + pct(ph.champ, 1) + "</b> · <b>" + t.away + " " + pct(pa.champ, 1) + "</b>");
    }
  }

  // ── title race ───────────────────────────────────────────────────────────────
  function drawRace(B) {
    var top = B.tournament.slice(0, 16);
    var max = d3.max(top, function (d) { return d.champ; }) || 1;
    var box = d3.select("#race").html("");
    top.forEach(function (d) {
      var row = box.append("div").attr("class", "race-row").on("click", function () { selectTeamNext(d.team); });
      row.append("div").attr("class", "race-name").text(d.team);
      row.append("div").attr("class", "race-bar").append("div").style("width", (100 * d.champ / max) + "%");
      row.append("div").attr("class", "race-val").text(pct(d.champ, 1));
    });
  }

  function selectTeamNext(team) {
    var all = STATE.B.rounds.reduce(function (a, r) { return a.concat(r.ties); }, []);
    var tie = all.filter(function (t) { return t.home === team || t.away === team; })
      .sort(function (a, b) { return a.num - b.num; })[0];
    if (tie) { select(tie.num); document.querySelector("#bracket").scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  function drawTake(B) {
    var f = B.tournament[0], s = B.tournament[1];
    d3.select("#br-take").html(
      "The model makes <b>" + f.team + "</b> the title favourite at " + pct(f.champ, 1) +
      ", ahead of " + s.team + " (" + pct(s.champ, 1) + ") — but with thirty-one ties between here and the trophy, " +
      "even the favourite is more likely <i>not</i> to win it than to win it.");
  }

  // ── boot ──────────────────────────────────────────────────────────────────────
  d3.json("../data/bracket.json").then(start).catch(function (e) {
    d3.select("#bracket").html('<p class="br-empty">Could not load the bracket data.</p>');
    console.error(e);
  });
})();
