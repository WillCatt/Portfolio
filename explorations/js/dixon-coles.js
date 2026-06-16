/* Dixon-Coles bivariate-Poisson — the exact match engine, shared by the
   "tune the model" simulator (forecast.js) and the "inside the model" tab
   (forecast-model.js). One copy of the math so the two can never drift apart.

   match(p) takes the genuinely-fitted strengths and returns every intermediate
   the visualisers need: the log-mu term breakdown, the two Poisson goal
   distributions, the raw and rho-corrected score grids, and the 1X2 split. */
(function () {
  "use strict";

  // Poisson pmf vector P(k goals) for k = 0..N, mean mu.
  function poisVec(mu, N) {
    var v = [], p = Math.exp(-mu), t = p;
    v.push(t);
    for (var i = 1; i <= N; i++) { t *= mu / i; v.push(t); }
    return v;
  }

  // p = { S, ha, rho, vz, vscale, hosts, country, home, away,
  //       wA, wD, wH, wV, N }
  //   S      team -> [attack, defence] log-strengths
  //   ha     fitted home/host advantage   rho  Dixon-Coles draw correction
  //   vz     team -> squad-value z-score   vscale  weight on that z-score
  //   hosts  list of host nations          country host nation of this fixture
  //   wA/wD/wH/wV  weights on attack / defence / home edge / squad value (0..n)
  function match(p) {
    var S = p.S;
    if (!S[p.home] || !S[p.away]) return null;
    var wA = p.wA == null ? 1 : p.wA, wD = p.wD == null ? 1 : p.wD,
        wH = p.wH == null ? 1 : p.wH, wV = p.wV == null ? 0 : p.wV;
    var vz = p.vz || {}, vscale = p.vscale || 0, hosts = p.hosts || [],
        N = p.N || 8, rho = p.rho || 0;

    // log-mu of a team's goals = attack(self) - defence(opponent) + value + home edge
    function term(team, oppo) {
      var att = wA * S[team][0];
      var def = -wD * S[oppo][1];
      var val = wV * vscale * (vz[team] || 0);
      var adv = (hosts.indexOf(team) >= 0 && team === p.country) ? wH * p.ha : 0;
      return { att: att, def: def, val: val, adv: adv, sum: att + def + val + adv };
    }
    var tH = term(p.home, p.away), tA = term(p.away, p.home);
    var muH = Math.exp(tH.sum), muA = Math.exp(tA.sum);

    var ph = poisVec(muH, N), pa = poisVec(muA, N);
    var rawGrid = [], grid = [], i, j;
    for (i = 0; i <= N; i++) {
      rawGrid.push([]);
      for (j = 0; j <= N; j++) rawGrid[i].push(ph[i] * pa[j]);
    }
    for (i = 0; i <= N; i++) grid.push(rawGrid[i].slice());
    // Dixon-Coles low-score correction — only the four cells below touch.
    grid[0][0] *= 1 - muH * muA * rho;
    grid[0][1] *= 1 + muH * rho;
    grid[1][0] *= 1 + muA * rho;
    grid[1][1] *= 1 - rho;

    var tot = 0, h = 0, d = 0;
    for (i = 0; i <= N; i++) for (j = 0; j <= N; j++) {
      tot += grid[i][j];
      if (i > j) h += grid[i][j]; else if (i === j) d += grid[i][j];
    }
    var ngrid = [];
    for (i = 0; i <= N; i++) { ngrid.push([]); for (j = 0; j <= N; j++) ngrid[i].push(grid[i][j] / tot); }

    return {
      muH: muH, muA: muA,
      ph: ph, pa: pa,
      rawGrid: rawGrid,        // before rho (normalised? no — raw products)
      grid: ngrid,             // after rho, normalised to sum 1
      termsH: tH, termsA: tA,  // attack/defence/value/adv breakdown
      home: h / tot, draw: d / tot, away: 1 - (h + d) / tot
    };
  }

  window.DC = { match: match, poisVec: poisVec };
})();
